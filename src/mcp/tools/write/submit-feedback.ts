/**
 * submit_feedback MCP Tool
 * Creates new feedback via MCP (pending moderation)
 */

import type { MCPToolDefinition, ToolHandler, SubmitFeedbackInput } from '../../types';

export const SUBMIT_FEEDBACK_DEFINITION: MCPToolDefinition = {
  name: 'submit_feedback',
  description: 'Submit new feedback. Items submitted via MCP default to pending moderation.',
  inputSchema: {
    type: 'object',
    properties: {
      board_slug: {
        type: 'string',
        description: 'The board slug to submit feedback to',
      },
      title: {
        type: 'string',
        description: 'Feedback title (max 160 characters)',
      },
      description: {
        type: 'string',
        description: 'Optional detailed description (max 4000 characters)',
      },
      source_context: {
        type: 'object',
        description: 'Optional context about the feedback source',
      },
    },
    required: ['board_slug', 'title'],
  },
};

export const submitFeedback: ToolHandler = async (params, context, env) => {
  const {
    board_slug,
    title,
    description,
    source_context,
  } = params as unknown as SubmitFeedbackInput;

  // Validate title length
  if (title.length > 160) {
    throw new Error('Title must be 160 characters or less');
  }

  // Validate description length
  if (description && description.length > 4000) {
    throw new Error('Description must be 4000 characters or less');
  }

  // Get or create board
  const board = await env.DB
    .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
    .bind(board_slug, context.workspaceId)
    .first<{ id: number }>();

  if (!board) {
    throw new Error(`Board '${board_slug}' not found in workspace`);
  }

  // Generate feedback ID
  const feedbackId = crypto.randomUUID();

  // Build source metadata
  const sourceMetadata = source_context ? JSON.stringify(source_context) : null;
  const sourceUrl = source_context?.original_url || null;

  // Insert feedback (pending moderation for MCP submissions)
  const result = await env.DB
    .prepare(`
      INSERT INTO feedback_items (
        board_id,
        title,
        description,
        status,
        moderation_state,
        is_hidden,
        source,
        source_url,
        source_metadata,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'open', 'pending', 1, 'mcp', ?, ?, datetime('now'), datetime('now'))
      RETURNING id, created_at
    `)
    .bind(
      board.id,
      title,
      description || null,
      sourceUrl,
      sourceMetadata
    )
    .first<{ id: number; created_at: string }>();

  if (!result) {
    throw new Error('Failed to create feedback');
  }

  // Queue for AI processing if available
  // Note: AI queue would be triggered here in production

  return {
    id: result.id,
    title,
    board_slug,
    status: 'open',
    moderation_state: 'pending',
    message: 'Feedback submitted successfully. It will be visible after moderation approval.',
    created_at: result.created_at,
  };
};
