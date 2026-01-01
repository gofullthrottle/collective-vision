/**
 * search_feedback MCP Tool
 * Semantic search across feedback using vector similarity
 */

import type { MCPToolDefinition, ToolHandler, FeedbackItem, SearchFeedbackResponse } from '../../types';

export const SEARCH_FEEDBACK_DEFINITION: MCPToolDefinition = {
  name: 'search_feedback',
  description: 'Search feedback using semantic similarity. Returns items ranked by relevance to the query.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query (natural language)',
      },
      board_slug: {
        type: 'string',
        description: 'Optional board slug to filter by',
      },
      status: {
        type: 'array',
        description: 'Optional status filter',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default 10, max 50)',
        default: 10,
        minimum: 1,
        maximum: 50,
      },
      min_score: {
        type: 'number',
        description: 'Minimum similarity score (0 to 1, default 0.5)',
        default: 0.5,
        minimum: 0,
        maximum: 1,
      },
    },
    required: ['query'],
  },
};

export const searchFeedback: ToolHandler = async (params, context, env) => {
  const {
    query,
    board_slug,
    status,
    limit = 10,
    min_score = 0.5,
  } = params as {
    query: string;
    board_slug?: string;
    status?: string[];
    limit?: number;
    min_score?: number;
  };

  // Check if AI and Vectorize are available
  if (!env.AI || !env.VECTORIZE) {
    // Fall back to text search if vector search unavailable
    return fallbackTextSearch(query, board_slug, status, limit, context, env);
  }

  // Generate embedding for query
  const embeddingResult = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: query,
  });

  if (!embeddingResult.data || !embeddingResult.data[0]) {
    throw new Error('Failed to generate query embedding');
  }

  const queryVector = embeddingResult.data[0];

  // Build filter for vector query
  const filter: Record<string, unknown> = {
    workspace_id: context.workspaceId,
  };

  if (board_slug) {
    // Get board ID for filter
    const board = await env.DB
      .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
      .bind(board_slug, context.workspaceId)
      .first<{ id: number }>();

    if (board) {
      filter.board_id = board.id;
    }
  }

  // Query Vectorize index
  const vectorResults = await env.VECTORIZE.query(queryVector, {
    topK: limit * 2, // Get more results to filter
    filter,
    returnMetadata: true,
  });

  // Filter by min_score
  const matchingIds = vectorResults.matches
    .filter(m => m.score >= min_score)
    .slice(0, limit);

  if (matchingIds.length === 0) {
    return {
      items: [],
      total: 0,
    } as SearchFeedbackResponse;
  }

  // Get full feedback items
  const idPlaceholders = matchingIds.map(() => '?').join(', ');
  const feedbackIds = matchingIds.map(m => {
    // Extract feedback ID from vector ID (format: feedback_123)
    const parts = m.id.split('_');
    return parseInt(parts[1], 10);
  }).filter(id => !isNaN(id));

  let statusCondition = '';
  const bindParams: (number | string)[] = [...feedbackIds, context.workspaceId];

  if (status && Array.isArray(status) && status.length > 0) {
    statusCondition = `AND f.status IN (${status.map(() => '?').join(', ')})`;
    bindParams.push(...status);
  }

  const items = await env.DB
    .prepare(`
      SELECT
        f.id,
        f.board_id,
        f.title,
        f.description,
        f.status,
        f.source,
        f.priority,
        f.sentiment_score,
        f.urgency_score,
        f.ai_tags,
        f.created_at,
        f.updated_at,
        b.slug as board_slug,
        COALESCE(SUM(v.weight), 0) as vote_count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      WHERE f.id IN (${idPlaceholders})
        AND b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
        ${statusCondition}
      GROUP BY f.id
    `)
    .bind(...bindParams)
    .all<FeedbackItem & { board_slug: string }>();

  // Map results with similarity scores
  const scoreMap = new Map(matchingIds.map(m => {
    const parts = m.id.split('_');
    return [parseInt(parts[1], 10), m.score];
  }));

  const results = (items.results || [])
    .map(item => ({
      feedback: item,
      similarity_score: scoreMap.get(item.id) || 0,
    }))
    .sort((a, b) => b.similarity_score - a.similarity_score);

  return {
    items: results,
    total: results.length,
  } as SearchFeedbackResponse;
};

/**
 * Fallback text search when vector search is unavailable
 */
async function fallbackTextSearch(
  query: string,
  boardSlug: string | undefined,
  status: string[] | undefined,
  limit: number,
  context: { workspaceId: number },
  env: { DB: D1Database }
): Promise<SearchFeedbackResponse> {
  const conditions: string[] = [
    'b.workspace_id = ?',
    "f.moderation_state = 'approved'",
    'f.is_hidden = 0',
    "(f.title LIKE ? OR f.description LIKE ?)",
  ];
  const bindParams: (string | number)[] = [context.workspaceId, `%${query}%`, `%${query}%`];

  if (boardSlug) {
    conditions.push('b.slug = ?');
    bindParams.push(boardSlug);
  }

  if (status && Array.isArray(status) && status.length > 0) {
    conditions.push(`f.status IN (${status.map(() => '?').join(', ')})`);
    bindParams.push(...status);
  }

  const items = await env.DB
    .prepare(`
      SELECT
        f.id,
        f.board_id,
        f.title,
        f.description,
        f.status,
        f.source,
        f.priority,
        f.sentiment_score,
        f.urgency_score,
        f.ai_tags,
        f.created_at,
        f.updated_at,
        b.slug as board_slug,
        COALESCE(SUM(v.weight), 0) as vote_count
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      LEFT JOIN feedback_votes v ON v.feedback_id = f.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY f.id
      ORDER BY f.created_at DESC
      LIMIT ?
    `)
    .bind(...bindParams, limit)
    .all<FeedbackItem & { board_slug: string }>();

  return {
    items: (items.results || []).map(item => ({
      feedback: item,
      similarity_score: 0.7, // Placeholder score for text match
    })),
    total: items.results?.length || 0,
  };
}
