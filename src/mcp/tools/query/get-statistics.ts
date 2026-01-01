/**
 * get_statistics MCP Tool
 * Aggregate statistics for workspace/board
 */

import type { MCPToolDefinition, ToolHandler, StatisticsResponse } from '../../types';

export const GET_STATISTICS_DEFINITION: MCPToolDefinition = {
  name: 'get_statistics',
  description: 'Get aggregate statistics including totals, status breakdown, sentiment distribution, and top themes.',
  inputSchema: {
    type: 'object',
    properties: {
      board_slug: {
        type: 'string',
        description: 'Optional board slug to filter by',
      },
    },
    required: [],
  },
};

export const getStatistics: ToolHandler = async (params, context, env) => {
  const { board_slug } = params as { board_slug?: string };

  // Build board filter
  let boardCondition = '';
  let boardJoinCondition = '';
  const bindParams: (number | string)[] = [context.workspaceId];

  if (board_slug) {
    const board = await env.DB
      .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
      .bind(board_slug, context.workspaceId)
      .first<{ id: number }>();

    if (board) {
      boardCondition = 'AND f.board_id = ?';
      boardJoinCondition = 'AND b.id = ?';
      bindParams.push(board.id);
    }
  }

  // Total feedback count
  const totalFeedback = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${boardJoinCondition}
    `)
    .bind(...bindParams)
    .first<{ count: number }>();

  // Total votes
  const totalVotes = await env.DB
    .prepare(`
      SELECT COALESCE(SUM(v.weight), 0) as count
      FROM feedback_votes v
      JOIN feedback_items f ON f.id = v.feedback_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
        ${boardJoinCondition}
    `)
    .bind(...bindParams)
    .first<{ count: number }>();

  // Total comments
  const totalComments = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM feedback_comments c
      JOIN feedback_items f ON f.id = c.feedback_id
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND c.is_internal = 0
        AND f.moderation_state = 'approved'
        ${boardJoinCondition}
    `)
    .bind(...bindParams)
    .first<{ count: number }>();

  // By status breakdown
  const byStatus = await env.DB
    .prepare(`
      SELECT f.status, COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${boardJoinCondition}
      GROUP BY f.status
    `)
    .bind(...bindParams)
    .all<{ status: string; count: number }>();

  const statusMap: Record<string, number> = {};
  for (const row of byStatus.results || []) {
    statusMap[row.status] = row.count;
  }

  // By source breakdown
  const bySource = await env.DB
    .prepare(`
      SELECT f.source, COUNT(*) as count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${boardJoinCondition}
      GROUP BY f.source
    `)
    .bind(...bindParams)
    .all<{ source: string; count: number }>();

  const sourceMap: Record<string, number> = {};
  for (const row of bySource.results || []) {
    sourceMap[row.source] = row.count;
  }

  // Average sentiment and urgency
  const averages = await env.DB
    .prepare(`
      SELECT
        AVG(f.sentiment_score) as avg_sentiment,
        AVG(f.urgency_score) as avg_urgency
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        AND f.sentiment_score IS NOT NULL
        ${boardJoinCondition}
    `)
    .bind(...bindParams)
    .first<{ avg_sentiment: number | null; avg_urgency: number | null }>();

  // Top themes
  const topThemes = await env.DB
    .prepare(`
      SELECT
        t.id,
        t.name,
        COUNT(f.id) as count
      FROM themes t
      LEFT JOIN feedback_items f ON f.theme_id = t.id
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${boardCondition}
      WHERE t.workspace_id = ?
      GROUP BY t.id
      HAVING count > 0
      ORDER BY count DESC
      LIMIT 5
    `)
    .bind(...bindParams)
    .all<{ id: string; name: string; count: number }>();

  const response: StatisticsResponse = {
    total_feedback: totalFeedback?.count || 0,
    total_votes: totalVotes?.count || 0,
    total_comments: totalComments?.count || 0,
    by_status: statusMap,
    by_source: sourceMap,
    avg_sentiment: averages?.avg_sentiment !== null
      ? Math.round((averages?.avg_sentiment || 0) * 100) / 100
      : null,
    avg_urgency: averages?.avg_urgency !== null
      ? Math.round((averages?.avg_urgency || 0) * 100) / 100
      : null,
    top_themes: topThemes.results || [],
  };

  return response;
};
