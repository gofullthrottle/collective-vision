/**
 * update_status MCP Tool
 * Updates feedback item status
 */

import type { MCPToolDefinition, ToolHandler, UpdateStatusInput } from '../../types';
import { MCP_ERROR_CODES } from '../../types';

export const UPDATE_STATUS_DEFINITION: MCPToolDefinition = {
  name: 'update_status',
  description: 'Update the status of a feedback item. Automatically adds a status change comment.',
  inputSchema: {
    type: 'object',
    properties: {
      feedback_id: {
        type: 'string',
        description: 'The ID of the feedback item to update',
      },
      status: {
        type: 'string',
        description: 'The new status',
        enum: ['open', 'under_review', 'planned', 'in_progress', 'done', 'declined'],
      },
      comment: {
        type: 'string',
        description: 'Optional comment explaining the status change',
      },
    },
    required: ['feedback_id', 'status'],
  },
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  under_review: 'Under Review',
  planned: 'Planned',
  in_progress: 'In Progress',
  done: 'Done',
  declined: 'Declined',
};

export const updateStatus: ToolHandler = async (params, context, env) => {
  const { feedback_id, status, comment } = params as unknown as UpdateStatusInput;

  // Parse ID
  const id = parseInt(feedback_id, 10);
  if (isNaN(id)) {
    throw new Error('Invalid feedback_id format');
  }

  // Validate status
  const validStatuses = ['open', 'under_review', 'planned', 'in_progress', 'done', 'declined'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Get current feedback with workspace verification
  const feedback = await env.DB
    .prepare(`
      SELECT f.id, f.status as current_status, f.title, b.workspace_id
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE f.id = ?
        AND b.workspace_id = ?
    `)
    .bind(id, context.workspaceId)
    .first<{ id: number; current_status: string; title: string; workspace_id: number }>();

  if (!feedback) {
    throw {
      code: MCP_ERROR_CODES.NOT_FOUND,
      message: 'Feedback item not found',
    };
  }

  // Check if status is actually changing
  if (feedback.current_status === status) {
    return {
      success: true,
      feedback_id: id,
      status,
      message: 'Status unchanged',
      changed: false,
    };
  }

  // Update status
  await env.DB
    .prepare(`
      UPDATE feedback_items
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(status, id)
    .run();

  // Add status change comment
  const statusComment = comment
    ? `Status changed to ${STATUS_LABELS[status]}: ${comment}`
    : `Status changed to ${STATUS_LABELS[status]}`;

  await env.DB
    .prepare(`
      INSERT INTO feedback_comments (
        feedback_id,
        body,
        is_internal,
        author_type,
        author_name,
        created_at
      ) VALUES (?, ?, 0, 'system', 'System', datetime('now'))
    `)
    .bind(id, statusComment)
    .run();

  // Record in status history (if table exists)
  try {
    await env.DB
      .prepare(`
        INSERT INTO feedback_status_history (
          feedback_id,
          from_status,
          to_status,
          changed_by,
          comment,
          created_at
        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(id, feedback.current_status, status, `mcp:${context.apiKeyId}`, comment || null)
      .run();
  } catch {
    // Status history table may not exist, skip silently
  }

  return {
    success: true,
    feedback_id: id,
    previous_status: feedback.current_status,
    status,
    message: `Status updated from ${STATUS_LABELS[feedback.current_status]} to ${STATUS_LABELS[status]}`,
    changed: true,
  };
};
