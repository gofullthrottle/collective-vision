/**
 * get_themes MCP Tool
 * Lists all themes for the workspace with trends
 */

import type { MCPToolDefinition, ToolHandler, GetThemesResponse } from '../../types';

export const GET_THEMES_DEFINITION: MCPToolDefinition = {
  name: 'get_themes',
  description: 'List all AI-detected themes for the workspace with item counts and trend directions.',
  inputSchema: {
    type: 'object',
    properties: {
      board_slug: {
        type: 'string',
        description: 'Optional board slug to filter themes by',
      },
      include_empty: {
        type: 'boolean',
        description: 'Include themes with no items (default false)',
        default: false,
      },
    },
    required: [],
  },
};

export const getThemes: ToolHandler = async (params, context, env) => {
  const { board_slug, include_empty = false } = params as {
    board_slug?: string;
    include_empty?: boolean;
  };

  // Build query conditions
  let boardCondition = '';
  const bindParams: (number | string)[] = [context.workspaceId];

  if (board_slug) {
    // Get board ID
    const board = await env.DB
      .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
      .bind(board_slug, context.workspaceId)
      .first<{ id: number }>();

    if (board) {
      boardCondition = 'AND f.board_id = ?';
      bindParams.push(board.id);
    }
  }

  // Get themes with current item counts
  const themes = await env.DB
    .prepare(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.item_count,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT f.id) as actual_count
      FROM themes t
      LEFT JOIN feedback_items f ON f.theme_id = t.id
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${boardCondition}
      WHERE t.workspace_id = ?
      GROUP BY t.id
      ${include_empty ? '' : 'HAVING actual_count > 0'}
      ORDER BY actual_count DESC
    `)
    .bind(...bindParams)
    .all<{
      id: string;
      name: string;
      description: string | null;
      item_count: number;
      actual_count: number;
      created_at: string;
      updated_at: string;
    }>();

  // Calculate trends by comparing recent vs older items
  const themeIds = (themes.results || []).map(t => t.id);

  if (themeIds.length === 0) {
    return { themes: [] } as GetThemesResponse;
  }

  // Get counts for last 7 days vs previous 7 days
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentCounts = await env.DB
    .prepare(`
      SELECT theme_id, COUNT(*) as count
      FROM feedback_items
      WHERE theme_id IN (${themeIds.map(() => '?').join(', ')})
        AND created_at >= ?
        AND moderation_state = 'approved'
        AND is_hidden = 0
      GROUP BY theme_id
    `)
    .bind(...themeIds, oneWeekAgo.toISOString())
    .all<{ theme_id: string; count: number }>();

  const olderCounts = await env.DB
    .prepare(`
      SELECT theme_id, COUNT(*) as count
      FROM feedback_items
      WHERE theme_id IN (${themeIds.map(() => '?').join(', ')})
        AND created_at >= ?
        AND created_at < ?
        AND moderation_state = 'approved'
        AND is_hidden = 0
      GROUP BY theme_id
    `)
    .bind(...themeIds, twoWeeksAgo.toISOString(), oneWeekAgo.toISOString())
    .all<{ theme_id: string; count: number }>();

  const recentMap = new Map((recentCounts.results || []).map(r => [r.theme_id, r.count]));
  const olderMap = new Map((olderCounts.results || []).map(r => [r.theme_id, r.count]));

  // Build response with trends
  const themesWithTrends = (themes.results || []).map(theme => {
    const recent = recentMap.get(theme.id) || 0;
    const older = olderMap.get(theme.id) || 0;

    let trend: 'rising' | 'stable' | 'falling' = 'stable';
    if (older > 0) {
      const changeRate = (recent - older) / older;
      if (changeRate > 0.2) trend = 'rising';
      else if (changeRate < -0.2) trend = 'falling';
    } else if (recent > 0) {
      trend = 'rising';
    }

    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      item_count: theme.actual_count,
      trend,
    };
  });

  return { themes: themesWithTrends } as GetThemesResponse;
};
