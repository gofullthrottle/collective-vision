/**
 * get_feedback MCP Tool
 * Gets a single feedback item with full details
 */

import type { MCPToolDefinition, ToolHandler, FeedbackItem } from '../../types';
import { MCP_ERROR_CODES } from '../../types';

export const GET_FEEDBACK_DEFINITION: MCPToolDefinition = {
  name: 'get_feedback',
  description: 'Get a single feedback item with full details including votes, comments, tags, and AI analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      feedback_id: {
        type: 'string',
        description: 'The ID of the feedback item to retrieve',
      },
    },
    required: ['feedback_id'],
  },
};

export const getFeedback: ToolHandler = async (params, context, env) => {
  const { feedback_id } = params as { feedback_id: string };

  // Parse ID
  const id = parseInt(feedback_id, 10);
  if (isNaN(id)) {
    throw new Error('Invalid feedback_id format');
  }

  // Get the feedback item with workspace verification
  const item = await env.DB
    .prepare(`
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
        b.name as board_name,
        w.slug as workspace_slug
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      JOIN workspaces w ON w.id = b.workspace_id
      WHERE f.id = ? AND w.id = ?
    `)
    .bind(id, context.workspaceId)
    .first<FeedbackItem & { board_slug: string; board_name: string; workspace_slug: string }>();

  if (!item) {
    throw {
      code: MCP_ERROR_CODES.NOT_FOUND,
      message: 'Feedback item not found',
    };
  }

  // Get vote count
  const voteResult = await env.DB
    .prepare('SELECT COALESCE(SUM(weight), 0) as vote_count FROM feedback_votes WHERE feedback_id = ?')
    .bind(id)
    .first<{ vote_count: number }>();

  // Get comments (public only)
  const comments = await env.DB
    .prepare(`
      SELECT
        c.id,
        c.body,
        c.created_at,
        c.is_internal,
        eu.name as author_name
      FROM feedback_comments c
      LEFT JOIN end_users eu ON eu.id = c.user_id
      WHERE c.feedback_id = ? AND c.is_internal = 0
      ORDER BY c.created_at ASC
    `)
    .bind(id)
    .all<{
      id: number;
      body: string;
      created_at: string;
      is_internal: number;
      author_name: string | null;
    }>();

  // Get tags
  const tags = await env.DB
    .prepare(`
      SELECT ft.id, ft.name, ft.color
      FROM feedback_tags ft
      JOIN feedback_item_tags fit ON fit.tag_id = ft.id
      WHERE fit.feedback_id = ?
    `)
    .bind(id)
    .all<{ id: number; name: string; color: string | null }>();

  // Get theme details if present
  let theme = null;
  if (item.theme_id) {
    theme = await env.DB
      .prepare('SELECT id, name, description, item_count FROM themes WHERE id = ?')
      .bind(item.theme_id)
      .first<{ id: string; name: string; description: string | null; item_count: number }>();
  }

  // Parse AI tags if present
  let aiTags: string[] = [];
  if (item.ai_tags) {
    try {
      aiTags = JSON.parse(item.ai_tags);
    } catch {
      // Ignore parse errors
    }
  }

  return {
    id: item.id,
    board: {
      slug: item.board_slug,
      name: item.board_name,
    },
    title: item.title,
    description: item.description,
    status: item.status,
    source: item.source,
    priority: item.priority,
    vote_count: voteResult?.vote_count || 0,
    comment_count: comments.results?.length || 0,
    comments: comments.results || [],
    tags: tags.results || [],
    ai_analysis: {
      sentiment_score: item.sentiment_score,
      urgency_score: item.urgency_score,
      ai_tags: aiTags,
      theme: theme,
    },
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
};
