/**
 * list_feedback MCP Tool
 * Lists feedback items with comprehensive filters
 */

import type { MCPToolDefinition, ToolHandler, FeedbackItem, ListFeedbackResponse } from '../../types';

export const LIST_FEEDBACK_DEFINITION: MCPToolDefinition = {
  name: 'list_feedback',
  description: 'List feedback items with comprehensive filters, pagination, and sorting options.',
  inputSchema: {
    type: 'object',
    properties: {
      board_slug: {
        type: 'string',
        description: 'Board slug to filter by (optional - if not provided, lists from all boards)',
      },
      status: {
        type: 'array',
        description: 'Filter by status(es): open, under_review, planned, in_progress, done, declined',
      },
      tags: {
        type: 'array',
        description: 'Filter by tag names',
      },
      theme_id: {
        type: 'string',
        description: 'Filter by AI-detected theme ID',
      },
      sentiment_min: {
        type: 'number',
        description: 'Minimum sentiment score (-1 to 1)',
        minimum: -1,
        maximum: 1,
      },
      sentiment_max: {
        type: 'number',
        description: 'Maximum sentiment score (-1 to 1)',
        minimum: -1,
        maximum: 1,
      },
      urgency_min: {
        type: 'number',
        description: 'Minimum urgency score (0 to 1)',
        minimum: 0,
        maximum: 1,
      },
      created_after: {
        type: 'string',
        description: 'Filter items created after this ISO date',
      },
      created_before: {
        type: 'string',
        description: 'Filter items created before this ISO date',
      },
      limit: {
        type: 'number',
        description: 'Number of items to return (default 20, max 100)',
        default: 20,
        minimum: 1,
        maximum: 100,
      },
      offset: {
        type: 'number',
        description: 'Number of items to skip (for pagination)',
        default: 0,
        minimum: 0,
      },
      sort_by: {
        type: 'string',
        description: 'Sort field',
        enum: ['votes', 'created_at', 'updated_at', 'priority', 'sentiment', 'urgency'],
        default: 'created_at',
      },
      sort_order: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: [],
  },
};

export const listFeedback: ToolHandler = async (params, context, env) => {
  const {
    board_slug,
    status,
    tags,
    theme_id,
    sentiment_min,
    sentiment_max,
    urgency_min,
    created_after,
    created_before,
    limit = 20,
    offset = 0,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = params as {
    board_slug?: string;
    status?: string[];
    tags?: string[];
    theme_id?: string;
    sentiment_min?: number;
    sentiment_max?: number;
    urgency_min?: number;
    created_after?: string;
    created_before?: string;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: string;
  };

  // Build query
  const conditions: string[] = [];
  const bindParams: (string | number)[] = [];
  let paramIndex = 1;

  // Always filter by workspace
  conditions.push('b.workspace_id = ?');
  bindParams.push(context.workspaceId);
  paramIndex++;

  // Only show approved, visible items
  conditions.push("f.moderation_state = 'approved'");
  conditions.push('f.is_hidden = 0');

  // Board filter
  if (board_slug) {
    conditions.push('b.slug = ?');
    bindParams.push(board_slug);
    paramIndex++;
  }

  // Status filter
  if (status && Array.isArray(status) && status.length > 0) {
    const placeholders = status.map(() => '?').join(', ');
    conditions.push(`f.status IN (${placeholders})`);
    bindParams.push(...status);
    paramIndex += status.length;
  }

  // Theme filter
  if (theme_id) {
    conditions.push('f.theme_id = ?');
    bindParams.push(theme_id);
    paramIndex++;
  }

  // Sentiment filters
  if (sentiment_min !== undefined) {
    conditions.push('f.sentiment_score >= ?');
    bindParams.push(sentiment_min);
    paramIndex++;
  }
  if (sentiment_max !== undefined) {
    conditions.push('f.sentiment_score <= ?');
    bindParams.push(sentiment_max);
    paramIndex++;
  }

  // Urgency filter
  if (urgency_min !== undefined) {
    conditions.push('f.urgency_score >= ?');
    bindParams.push(urgency_min);
    paramIndex++;
  }

  // Date filters
  if (created_after) {
    conditions.push('f.created_at >= ?');
    bindParams.push(created_after);
    paramIndex++;
  }
  if (created_before) {
    conditions.push('f.created_at <= ?');
    bindParams.push(created_before);
    paramIndex++;
  }

  // Sort field mapping
  const sortFieldMap: Record<string, string> = {
    votes: 'vote_count',
    created_at: 'f.created_at',
    updated_at: 'f.updated_at',
    priority: 'f.priority',
    sentiment: 'f.sentiment_score',
    urgency: 'f.urgency_score',
  };
  const sortField = sortFieldMap[sort_by] || 'f.created_at';
  const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

  // Count query
  const countQuery = `
    SELECT COUNT(*) as total
    FROM feedback_items f
    JOIN boards b ON b.id = f.board_id
    WHERE ${conditions.join(' AND ')}
  `;

  const countResult = await env.DB
    .prepare(countQuery)
    .bind(...bindParams)
    .first<{ total: number }>();

  const total = countResult?.total || 0;

  // Main query with votes and comments count
  const mainQuery = `
    SELECT
      f.id,
      f.board_id,
      f.user_id,
      f.title,
      f.description,
      f.status,
      f.moderation_state,
      f.is_hidden,
      f.source,
      f.priority,
      f.sentiment_score,
      f.urgency_score,
      f.ai_tags,
      f.theme_id,
      f.embedding_id,
      f.created_at,
      f.updated_at,
      b.slug as board_slug,
      COALESCE(SUM(v.weight), 0) as vote_count,
      (SELECT COUNT(*) FROM feedback_comments c WHERE c.feedback_id = f.id AND c.is_internal = 0) as comment_count
    FROM feedback_items f
    JOIN boards b ON b.id = f.board_id
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY f.id
    ORDER BY ${sortField} ${sortDir}
    LIMIT ? OFFSET ?
  `;

  const items = await env.DB
    .prepare(mainQuery)
    .bind(...bindParams, limit, offset)
    .all<FeedbackItem & { board_slug: string }>();

  // Filter by tags if specified (requires join)
  let filteredItems = items.results || [];
  if (tags && Array.isArray(tags) && tags.length > 0) {
    // Get items that have ALL specified tags
    const taggedItemIds = await env.DB
      .prepare(`
        SELECT fit.feedback_id
        FROM feedback_item_tags fit
        JOIN feedback_tags ft ON ft.id = fit.tag_id
        WHERE ft.name IN (${tags.map(() => '?').join(', ')})
        GROUP BY fit.feedback_id
        HAVING COUNT(DISTINCT ft.name) = ?
      `)
      .bind(...tags, tags.length)
      .all<{ feedback_id: number }>();

    const taggedIds = new Set(taggedItemIds.results?.map(r => r.feedback_id) || []);
    filteredItems = filteredItems.filter(item => taggedIds.has(item.id));
  }

  const response: ListFeedbackResponse = {
    items: filteredItems,
    total,
    has_more: offset + filteredItems.length < total,
  };

  return response;
};
