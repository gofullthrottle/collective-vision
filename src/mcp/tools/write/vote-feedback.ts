/**
 * vote_feedback MCP Tool
 * Registers a vote on feedback
 */

import type { MCPToolDefinition, ToolHandler, VoteFeedbackInput } from '../../types';
import { MCP_ERROR_CODES } from '../../types';

export const VOTE_FEEDBACK_DEFINITION: MCPToolDefinition = {
  name: 'vote_feedback',
  description: 'Register a vote on a feedback item. Votes are deduplicated by user identifier.',
  inputSchema: {
    type: 'object',
    properties: {
      feedback_id: {
        type: 'string',
        description: 'The ID of the feedback item to vote on',
      },
      user_identifier: {
        type: 'string',
        description: 'Optional user identifier for vote deduplication',
      },
    },
    required: ['feedback_id'],
  },
};

export const voteFeedback: ToolHandler = async (params, context, env) => {
  const { feedback_id, user_identifier } = params as unknown as VoteFeedbackInput;

  // Parse ID
  const id = parseInt(feedback_id, 10);
  if (isNaN(id)) {
    throw new Error('Invalid feedback_id format');
  }

  // Verify feedback exists and belongs to workspace
  const feedback = await env.DB
    .prepare(`
      SELECT f.id, f.title, b.workspace_id
      FROM feedback_items f
      JOIN boards b ON b.id = f.board_id
      WHERE f.id = ?
        AND b.workspace_id = ?
        AND f.moderation_state = 'approved'
        AND f.is_hidden = 0
    `)
    .bind(id, context.workspaceId)
    .first<{ id: number; title: string; workspace_id: number }>();

  if (!feedback) {
    throw {
      code: MCP_ERROR_CODES.NOT_FOUND,
      message: 'Feedback item not found or not accessible',
    };
  }

  // Generate voter identifier
  const voterId = user_identifier
    ? `mcp:${user_identifier}`
    : `mcp:${context.apiKeyId}:${Date.now()}`;

  // Check for existing vote
  const existingVote = await env.DB
    .prepare(`
      SELECT id FROM feedback_votes
      WHERE feedback_id = ? AND voter_id = ?
    `)
    .bind(id, voterId)
    .first<{ id: number }>();

  if (existingVote) {
    // Already voted - return current count
    const voteCount = await env.DB
      .prepare('SELECT COALESCE(SUM(weight), 0) as count FROM feedback_votes WHERE feedback_id = ?')
      .bind(id)
      .first<{ count: number }>();

    return {
      success: true,
      message: 'Vote already recorded',
      vote_count: voteCount?.count || 0,
      already_voted: true,
    };
  }

  // Insert vote
  await env.DB
    .prepare(`
      INSERT INTO feedback_votes (feedback_id, voter_id, weight, created_at)
      VALUES (?, ?, 1, datetime('now'))
    `)
    .bind(id, voterId)
    .run();

  // Get updated vote count
  const newVoteCount = await env.DB
    .prepare('SELECT COALESCE(SUM(weight), 0) as count FROM feedback_votes WHERE feedback_id = ?')
    .bind(id)
    .first<{ count: number }>();

  return {
    success: true,
    message: 'Vote recorded successfully',
    vote_count: newVoteCount?.count || 0,
    already_voted: false,
  };
};
