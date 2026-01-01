/**
 * add_comment MCP Tool
 * Adds a comment to a feedback item
 */

import type { MCPToolDefinition, ToolHandler, AddCommentInput } from '../../types';
import { MCP_ERROR_CODES } from '../../types';

export const ADD_COMMENT_DEFINITION: MCPToolDefinition = {
  name: 'add_comment',
  description: 'Add a comment to a feedback item. Supports internal (team-only) comments.',
  inputSchema: {
    type: 'object',
    properties: {
      feedback_id: {
        type: 'string',
        description: 'The ID of the feedback item to comment on',
      },
      body: {
        type: 'string',
        description: 'The comment body (max 4000 characters)',
      },
      is_internal: {
        type: 'boolean',
        description: 'Whether this is an internal comment (hidden from public)',
        default: false,
      },
    },
    required: ['feedback_id', 'body'],
  },
};

export const addComment: ToolHandler = async (params, context, env) => {
  const { feedback_id, body, is_internal = false } = params as unknown as AddCommentInput;

  // Parse ID
  const id = parseInt(feedback_id, 10);
  if (isNaN(id)) {
    throw new Error('Invalid feedback_id format');
  }

  // Validate body length
  if (body.length > 4000) {
    throw new Error('Comment body must be 4000 characters or less');
  }

  if (body.trim().length === 0) {
    throw new Error('Comment body cannot be empty');
  }

  // Verify feedback exists and belongs to workspace
  const feedback = await env.DB
    .prepare(`
      SELECT f.id, b.workspace_id
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE f.id = ?
        AND b.workspace_id = ?
    `)
    .bind(id, context.workspaceId)
    .first<{ id: number; workspace_id: number }>();

  if (!feedback) {
    throw {
      code: MCP_ERROR_CODES.NOT_FOUND,
      message: 'Feedback item not found',
    };
  }

  // Insert comment
  const result = await env.DB
    .prepare(`
      INSERT INTO feedback_comments (
        feedback_id,
        body,
        is_internal,
        author_type,
        author_name,
        created_at
      ) VALUES (?, ?, ?, 'agent', 'MCP Agent', datetime('now'))
      RETURNING id, created_at
    `)
    .bind(id, body.trim(), is_internal ? 1 : 0)
    .first<{ id: number; created_at: string }>();

  if (!result) {
    throw new Error('Failed to create comment');
  }

  // Get comment count
  const commentCount = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM feedback_comments
      WHERE feedback_id = ?
        AND is_internal = 0
    `)
    .bind(id)
    .first<{ count: number }>();

  return {
    success: true,
    comment_id: result.id,
    feedback_id: id,
    is_internal,
    public_comment_count: commentCount?.count || 0,
    created_at: result.created_at,
  };
};
