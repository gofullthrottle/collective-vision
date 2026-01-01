/**
 * AI Routes
 *
 * Endpoints for managing AI-powered features:
 * - Duplicate detection and management
 * - Theme clustering
 * - AI processing triggers
 * - Usage tracking
 */

import type { Env } from "../worker";
import { z } from "zod";
import { requireAuth, requireWorkspaceAccess } from "../middleware/auth";
import {
  processFeedback,
  getPendingFeedback,
  type FeedbackItem,
  type PipelineResult,
} from "../lib/ai";
import { generateId } from "../lib/auth";

// =============================================================================
// Response Helpers
// =============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ error: { code, message } }, status);
}

// =============================================================================
// Validation
// =============================================================================

async function validateBody<T>(
  schema: z.ZodSchema<T>,
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  const path = firstError.path.length > 0 ? `${firstError.path.join(".")}: ` : "";
  return { success: false, error: `${path}${firstError.message}` };
}

// =============================================================================
// Schemas
// =============================================================================

const processFeedbackSchema = z.object({
  feedback_ids: z.array(z.string()).min(1).max(100),
  skip_duplicates: z.boolean().optional(),
  skip_classification: z.boolean().optional(),
});

const duplicateActionSchema = z.object({
  action: z.enum(["merge", "dismiss"]),
});

const themeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// =============================================================================
// Duplicate Management
// =============================================================================

/**
 * GET /api/v1/workspaces/:workspace/ai/duplicates
 * List duplicate suggestions for review
 */
async function handleListDuplicates(
  workspaceId: number,
  url: URL,
  env: Env
): Promise<Response> {
  const status = url.searchParams.get("status") || "pending";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const duplicates = await env.DB.prepare(
    `SELECT
       ds.id,
       ds.feedback_id,
       ds.suggested_duplicate_id,
       ds.similarity_score,
       ds.status,
       ds.created_at,
       f1.title as feedback_title,
       f1.description as feedback_description,
       f2.title as duplicate_title,
       f2.description as duplicate_description
     FROM duplicate_suggestions ds
     JOIN feedback_items f1 ON ds.feedback_id = f1.id
     JOIN feedback_items f2 ON ds.suggested_duplicate_id = f2.id
     JOIN boards b ON f1.board_id = b.id
     WHERE b.workspace_id = ? AND ds.status = ?
     ORDER BY ds.similarity_score DESC
     LIMIT ? OFFSET ?`
  )
    .bind(workspaceId, status, limit, offset)
    .all();

  return jsonResponse({
    duplicates: duplicates.results.map((d) => ({
      id: d.id,
      similarity_score: d.similarity_score,
      status: d.status,
      created_at: d.created_at,
      feedback: {
        id: d.feedback_id,
        title: d.feedback_title,
        description: d.feedback_description,
      },
      suggested_duplicate: {
        id: d.suggested_duplicate_id,
        title: d.duplicate_title,
        description: d.duplicate_description,
      },
    })),
  });
}

/**
 * POST /api/v1/workspaces/:workspace/ai/duplicates/:id
 * Merge or dismiss a duplicate suggestion
 */
async function handleDuplicateAction(
  duplicateId: string,
  request: Request,
  userId: string,
  env: Env
): Promise<Response> {
  const parsed = await validateBody(duplicateActionSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { action } = parsed.data;

  // Get the duplicate suggestion
  const suggestion = await env.DB.prepare(
    `SELECT ds.*, f1.board_id
     FROM duplicate_suggestions ds
     JOIN feedback_items f1 ON ds.feedback_id = f1.id
     WHERE ds.id = ?`
  )
    .bind(duplicateId)
    .first<{
      id: string;
      feedback_id: string;
      suggested_duplicate_id: string;
      status: string;
      board_id: string;
    }>();

  if (!suggestion) {
    return errorResponse("NOT_FOUND", "Duplicate suggestion not found", 404);
  }

  if (suggestion.status !== "pending") {
    return errorResponse("ALREADY_PROCESSED", "This suggestion has already been processed");
  }

  if (action === "dismiss") {
    // Just mark as dismissed
    await env.DB.prepare(
      `UPDATE duplicate_suggestions
       SET status = 'dismissed', reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    )
      .bind(userId, duplicateId)
      .run();

    return jsonResponse({ message: "Duplicate dismissed" });
  }

  // Merge action - combine votes, comments, and hide the duplicate
  await env.DB.batch([
    // Move votes (avoid duplicates from same user)
    env.DB.prepare(
      `INSERT OR IGNORE INTO feedback_votes (id, feedback_id, user_id, weight, created_at)
       SELECT ?, ?, user_id, weight, created_at
       FROM feedback_votes
       WHERE feedback_id = ?`
    ).bind(
      generateId("vote"),
      suggestion.feedback_id,
      suggestion.suggested_duplicate_id
    ),

    // Move comments
    env.DB.prepare(
      `UPDATE feedback_comments
       SET feedback_id = ?
       WHERE feedback_id = ?`
    ).bind(suggestion.feedback_id, suggestion.suggested_duplicate_id),

    // Mark duplicate as merged and hidden
    env.DB.prepare(
      `UPDATE feedback_items
       SET is_hidden = 1, merged_into = ?, merged_at = datetime('now'), merged_by = ?
       WHERE id = ?`
    ).bind(suggestion.feedback_id, userId, suggestion.suggested_duplicate_id),

    // Update suggestion status
    env.DB.prepare(
      `UPDATE duplicate_suggestions
       SET status = 'merged', reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).bind(userId, duplicateId),
  ]);

  return jsonResponse({ message: "Feedback items merged" });
}

/**
 * GET /api/v1/feedback/:id/duplicates
 * Get duplicate suggestions for a specific feedback item
 */
async function handleGetFeedbackDuplicates(
  feedbackId: string,
  env: Env
): Promise<Response> {
  const duplicates = await env.DB.prepare(
    `SELECT
       ds.id,
       ds.suggested_duplicate_id,
       ds.similarity_score,
       ds.status,
       f.title,
       f.description,
       f.created_at
     FROM duplicate_suggestions ds
     JOIN feedback_items f ON ds.suggested_duplicate_id = f.id
     WHERE ds.feedback_id = ?
     ORDER BY ds.similarity_score DESC`
  )
    .bind(feedbackId)
    .all();

  return jsonResponse({
    duplicates: duplicates.results.map((d) => ({
      suggestion_id: d.id,
      feedback_id: d.suggested_duplicate_id,
      similarity_score: d.similarity_score,
      status: d.status,
      title: d.title,
      description: d.description,
      created_at: d.created_at,
    })),
  });
}

// =============================================================================
// Theme Management
// =============================================================================

/**
 * GET /api/v1/workspaces/:workspace/ai/themes
 * List all themes for a workspace
 */
async function handleListThemes(
  workspaceId: number,
  env: Env
): Promise<Response> {
  const themes = await env.DB.prepare(
    `SELECT
       t.id,
       t.name,
       t.description,
       t.auto_generated,
       t.created_at,
       COUNT(f.id) as item_count
     FROM themes t
     LEFT JOIN feedback_items f ON f.theme_id = t.id
     WHERE t.workspace_id = ?
     GROUP BY t.id
     ORDER BY item_count DESC`
  )
    .bind(workspaceId)
    .all();

  return jsonResponse({
    themes: themes.results.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      auto_generated: Boolean(t.auto_generated),
      item_count: t.item_count,
      created_at: t.created_at,
    })),
  });
}

/**
 * POST /api/v1/workspaces/:workspace/ai/themes
 * Create a new theme
 */
async function handleCreateTheme(
  workspaceId: number,
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validateBody(themeSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const id = generateId("theme");

  await env.DB.prepare(
    `INSERT INTO themes (id, workspace_id, name, description, auto_generated)
     VALUES (?, ?, ?, ?, 0)`
  )
    .bind(id, workspaceId, parsed.data.name, parsed.data.description || null)
    .run();

  return jsonResponse({ id, name: parsed.data.name }, 201);
}

/**
 * PATCH /api/v1/workspaces/:workspace/ai/themes/:id
 * Update a theme
 */
async function handleUpdateTheme(
  themeId: string,
  workspaceId: number,
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validateBody(themeSchema.partial(), request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  // Convert undefined to null for D1 binding
  const name = parsed.data.name ?? null;
  const description = parsed.data.description ?? null;

  const result = await env.DB.prepare(
    `UPDATE themes
     SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = datetime('now')
     WHERE id = ? AND workspace_id = ?`
  )
    .bind(name, description, themeId, workspaceId)
    .run();

  if (!result.meta.changes) {
    return errorResponse("NOT_FOUND", "Theme not found", 404);
  }

  return jsonResponse({ message: "Theme updated" });
}

/**
 * DELETE /api/v1/workspaces/:workspace/ai/themes/:id
 * Delete a theme (items become unthemed)
 */
async function handleDeleteTheme(
  themeId: string,
  workspaceId: number,
  env: Env
): Promise<Response> {
  // Unassign all feedback items first
  await env.DB.prepare(
    `UPDATE feedback_items SET theme_id = NULL WHERE theme_id = ?`
  )
    .bind(themeId)
    .run();

  const result = await env.DB.prepare(
    `DELETE FROM themes WHERE id = ? AND workspace_id = ?`
  )
    .bind(themeId, workspaceId)
    .run();

  if (!result.meta.changes) {
    return errorResponse("NOT_FOUND", "Theme not found", 404);
  }

  return jsonResponse({ message: "Theme deleted" });
}

// =============================================================================
// AI Processing
// =============================================================================

/**
 * POST /api/v1/workspaces/:workspace/ai/process
 * Trigger AI processing for feedback items
 */
async function handleProcessFeedback(
  workspaceId: number,
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validateBody(processFeedbackSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { feedback_ids, skip_duplicates, skip_classification } = parsed.data;

  // Get feedback items
  const placeholders = feedback_ids.map(() => "?").join(",");
  const feedbackItems = await env.DB.prepare(
    `SELECT f.id, f.title, f.description, f.board_id, b.workspace_id, f.created_at
     FROM feedback_items f
     JOIN boards b ON f.board_id = b.id
     WHERE f.id IN (${placeholders}) AND b.workspace_id = ?`
  )
    .bind(...feedback_ids, workspaceId)
    .all<FeedbackItem>();

  if (feedbackItems.results.length === 0) {
    return errorResponse("NOT_FOUND", "No feedback items found");
  }

  // Process each item
  const results: PipelineResult[] = [];
  for (const feedback of feedbackItems.results) {
    const result = await processFeedback(feedback, env, {
      skipDuplicates: skip_duplicates,
      skipClassification: skip_classification,
    });
    results.push(result);
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  return jsonResponse({
    processed: results.length,
    successful,
    failed,
    results: results.map((r) => ({
      feedback_id: r.feedbackId,
      success: r.success,
      classification: r.classification,
      duplicates: r.duplicates,
      priority_score: r.priorityScore,
      processing_time_ms: r.processingTime,
    })),
  });
}

/**
 * POST /api/v1/workspaces/:workspace/ai/process-pending
 * Process all pending feedback items
 */
async function handleProcessPending(
  workspaceId: number,
  env: Env
): Promise<Response> {
  const pending = await getPendingFeedback(env.DB, workspaceId, 100);

  if (pending.length === 0) {
    return jsonResponse({ message: "No pending items to process", processed: 0 });
  }

  const results: PipelineResult[] = [];
  for (const feedback of pending) {
    const result = await processFeedback(feedback, env);
    results.push(result);
  }

  const successful = results.filter((r) => r.success).length;

  return jsonResponse({
    processed: results.length,
    successful,
    failed: results.length - successful,
  });
}

// =============================================================================
// AI Usage
// =============================================================================

/**
 * GET /api/v1/workspaces/:workspace/ai/usage
 * Get AI usage statistics
 */
async function handleGetUsage(
  workspaceId: number,
  url: URL,
  env: Env
): Promise<Response> {
  const days = Math.min(parseInt(url.searchParams.get("days") || "30"), 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const usage = await env.DB.prepare(
    `SELECT
       date,
       embeddings_count,
       llm_calls_count,
       vector_queries_count,
       total_input_tokens,
       total_output_tokens
     FROM ai_usage
     WHERE workspace_id = ? AND date >= ?
     ORDER BY date DESC`
  )
    .bind(workspaceId, startDate.toISOString().split("T")[0])
    .all();

  const initialTotals = { embeddings: 0, llm_calls: 0, vector_queries: 0, input_tokens: 0, output_tokens: 0 };
  const totals = usage.results.reduce<typeof initialTotals>(
    (acc, u) => ({
      embeddings: acc.embeddings + ((u.embeddings_count as number) || 0),
      llm_calls: acc.llm_calls + ((u.llm_calls_count as number) || 0),
      vector_queries: acc.vector_queries + ((u.vector_queries_count as number) || 0),
      input_tokens: acc.input_tokens + ((u.total_input_tokens as number) || 0),
      output_tokens: acc.output_tokens + ((u.total_output_tokens as number) || 0),
    }),
    initialTotals
  );

  return jsonResponse({
    period_days: days,
    totals,
    daily: usage.results,
  });
}

// =============================================================================
// Workspace Resolution
// =============================================================================

async function getWorkspaceIdBySlug(
  slug: string,
  env: Env
): Promise<number | null> {
  const workspace = await env.DB.prepare(
    `SELECT id FROM workspaces WHERE slug = ?`
  )
    .bind(slug)
    .first<{ id: number }>();

  return workspace?.id ?? null;
}

// =============================================================================
// Route Handler
// =============================================================================

export async function handleAIRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  // Check for feedback-specific duplicate endpoint
  const feedbackDuplicateMatch = pathname.match(
    /^\/api\/v1\/feedback\/([^/]+)\/duplicates$/
  );
  if (feedbackDuplicateMatch && request.method === "GET") {
    const authResult = await requireAuth(request, env);
    if ("response" in authResult) return authResult.response;
    return handleGetFeedbackDuplicates(feedbackDuplicateMatch[1], env);
  }

  // Extract workspace slug from path
  const workspaceMatch = pathname.match(
    /^\/api\/v1\/workspaces\/([^/]+)\/ai(?:\/(.*))?$/
  );
  if (!workspaceMatch) return null;

  const [, workspaceSlug, subPath] = workspaceMatch;

  // Resolve workspace ID
  const workspaceId = await getWorkspaceIdBySlug(workspaceSlug, env);
  if (!workspaceId) {
    return errorResponse("WORKSPACE_NOT_FOUND", "Workspace not found", 404);
  }

  // Require admin access for AI routes
  const authResult = await requireWorkspaceAccess(
    request,
    workspaceId,
    "admin",
    env
  );
  if ("response" in authResult) return authResult.response;

  const { context } = authResult;

  // Route handling
  if (!subPath || subPath === "") {
    return null;
  }

  // Duplicates
  if (subPath === "duplicates") {
    if (request.method === "GET") {
      return handleListDuplicates(workspaceId, new URL(request.url), env);
    }
  }

  const duplicateActionMatch = subPath.match(/^duplicates\/([^/]+)$/);
  if (duplicateActionMatch && request.method === "POST") {
    return handleDuplicateAction(
      duplicateActionMatch[1],
      request,
      context.user.id,
      env
    );
  }

  // Themes
  if (subPath === "themes") {
    if (request.method === "GET") {
      return handleListThemes(workspaceId, env);
    }
    if (request.method === "POST") {
      return handleCreateTheme(workspaceId, request, env);
    }
  }

  const themeMatch = subPath.match(/^themes\/([^/]+)$/);
  if (themeMatch) {
    if (request.method === "PATCH") {
      return handleUpdateTheme(themeMatch[1], workspaceId, request, env);
    }
    if (request.method === "DELETE") {
      return handleDeleteTheme(themeMatch[1], workspaceId, env);
    }
  }

  // Processing
  if (subPath === "process" && request.method === "POST") {
    return handleProcessFeedback(workspaceId, request, env);
  }

  if (subPath === "process-pending" && request.method === "POST") {
    return handleProcessPending(workspaceId, env);
  }

  // Usage
  if (subPath === "usage" && request.method === "GET") {
    return handleGetUsage(workspaceId, new URL(request.url), env);
  }

  return null;
}
