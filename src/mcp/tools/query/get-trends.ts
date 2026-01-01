/**
 * get_trends MCP Tool
 * Detects trending topics and anomalies
 */

import type { MCPToolDefinition, ToolHandler, GetTrendsResponse } from '../../types';

export const GET_TRENDS_DEFINITION: MCPToolDefinition = {
  name: 'get_trends',
  description: 'Get trending topics, anomalies, and a summary of recent feedback activity.',
  inputSchema: {
    type: 'object',
    properties: {
      timeframe: {
        type: 'string',
        description: 'Timeframe for trend analysis',
        enum: ['7d', '30d', '90d'],
        default: '7d',
      },
      board_slug: {
        type: 'string',
        description: 'Optional board slug to filter by',
      },
    },
    required: [],
  },
};

export const getTrends: ToolHandler = async (params, context, env) => {
  const { timeframe = '7d', board_slug } = params as {
    timeframe?: '7d' | '30d' | '90d';
    board_slug?: string;
  };

  // Calculate date ranges
  const now = new Date();
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
  const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);

  // Build board filter
  let boardCondition = '';
  const baseParams: (number | string)[] = [context.workspaceId];

  if (board_slug) {
    const board = await env.DB
      .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
      .bind(board_slug, context.workspaceId)
      .first<{ id: number }>();

    if (board) {
      boardCondition = 'AND f.board_id = ?';
      baseParams.push(board.id);
    }
  }

  // Get theme growth rates
  const themeGrowth = await env.DB
    .prepare(`
      SELECT
        t.id,
        t.name,
        COUNT(CASE WHEN f.created_at >= ? THEN 1 END) as current_count,
        COUNT(CASE WHEN f.created_at >= ? AND f.created_at < ? THEN 1 END) as previous_count
      FROM themes t
      LEFT JOIN feedback_items f ON f.theme_id = t.id
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${boardCondition}
      WHERE t.workspace_id = ?
      GROUP BY t.id
      HAVING current_count > 0 OR previous_count > 0
    `)
    .bind(currentStart.toISOString(), previousStart.toISOString(), currentStart.toISOString(), ...baseParams)
    .all<{
      id: string;
      name: string;
      current_count: number;
      previous_count: number;
    }>();

  // Calculate growth rates and sort by trending
  const trendingThemes = (themeGrowth.results || [])
    .map(t => {
      const growthRate = t.previous_count > 0
        ? (t.current_count - t.previous_count) / t.previous_count
        : t.current_count > 0 ? 1 : 0;
      return {
        id: t.id,
        name: t.name,
        growth_rate: Math.round(growthRate * 100) / 100,
        current_count: t.current_count,
      };
    })
    .filter(t => t.growth_rate > 0)
    .sort((a, b) => b.growth_rate - a.growth_rate)
    .slice(0, 5);

  // Detect anomalies - look for unusual spikes in daily volume
  const dailyVolumes = await env.DB
    .prepare(`
      SELECT
        DATE(f.created_at) as date,
        COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.created_at >= ?
        AND f.moderation_state = 'approved'
        ${boardCondition.replace('AND f.board_id', 'AND b.id')}
      GROUP BY DATE(f.created_at)
      ORDER BY date
    `)
    .bind(context.workspaceId, previousStart.toISOString(), ...(board_slug ? baseParams.slice(1) : []))
    .all<{ date: string; count: number }>();

  const volumes = dailyVolumes.results || [];
  const anomalies: GetTrendsResponse['anomalies'] = [];

  if (volumes.length > 7) {
    // Calculate mean and std dev for anomaly detection
    const counts = volumes.map(v => v.count);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const stdDev = Math.sqrt(counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length);

    // Check recent days for anomalies (z-score > 2)
    const recentDays = volumes.slice(-7);
    for (const day of recentDays) {
      const zScore = stdDev > 0 ? (day.count - mean) / stdDev : 0;

      if (zScore > 2) {
        anomalies.push({
          type: 'spike',
          description: `${Math.round(zScore)}x normal volume on ${day.date} (${day.count} vs avg ${Math.round(mean)})`,
          severity: zScore > 3 ? 'high' : 'medium',
        });
      } else if (zScore < -2 && day.count === 0) {
        anomalies.push({
          type: 'drop',
          description: `No feedback received on ${day.date}`,
          severity: 'low',
        });
      }
    }
  }

  // Generate summary
  const currentPeriodTotal = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.created_at >= ?
        AND f.moderation_state = 'approved'
        ${boardCondition.replace('AND f.board_id', 'AND b.id')}
    `)
    .bind(context.workspaceId, currentStart.toISOString(), ...(board_slug ? baseParams.slice(1) : []))
    .first<{ count: number }>();

  const previousPeriodTotal = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.created_at >= ?
        AND f.created_at < ?
        AND f.moderation_state = 'approved'
        ${boardCondition.replace('AND f.board_id', 'AND b.id')}
    `)
    .bind(context.workspaceId, previousStart.toISOString(), currentStart.toISOString(), ...(board_slug ? baseParams.slice(1) : []))
    .first<{ count: number }>();

  const current = currentPeriodTotal?.count || 0;
  const previous = previousPeriodTotal?.count || 0;
  const changePercent = previous > 0
    ? Math.round(((current - previous) / previous) * 100)
    : current > 0 ? 100 : 0;

  const changeDirection = changePercent > 0 ? 'increase' : changePercent < 0 ? 'decrease' : 'no change';
  const timeframeLabel = timeframe === '7d' ? 'week' : timeframe === '30d' ? 'month' : 'quarter';

  let summary = `This ${timeframeLabel} saw ${current} feedback items`;
  if (previous > 0) {
    summary += `, a ${Math.abs(changePercent)}% ${changeDirection} from the previous ${timeframeLabel}`;
  }
  summary += '.';

  if (trendingThemes.length > 0) {
    summary += ` Top trending theme: "${trendingThemes[0].name}" (+${Math.round(trendingThemes[0].growth_rate * 100)}%).`;
  }

  if (anomalies.length > 0) {
    const highSeverity = anomalies.filter(a => a.severity === 'high').length;
    if (highSeverity > 0) {
      summary += ` ${highSeverity} significant anomaly detected.`;
    }
  }

  return {
    trending_themes: trendingThemes,
    anomalies,
    summary,
  } as GetTrendsResponse;
};
