import { z } from 'zod';

// ============================================================================
// Constants
// ============================================================================

export const MAX_TITLE_LENGTH = 160;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_EXTERNAL_USER_ID_LENGTH = 100;
export const MAX_TAG_NAME_LENGTH = 50;
export const MAX_TAG_COLOR_LENGTH = 20;
export const MAX_SLUG_LENGTH = 100;

// Arrays for Zod enum validation
const STATUS_VALUES = ['open', 'planned', 'in_progress', 'done', 'declined'] as const;
const MODERATION_STATE_VALUES = ['pending', 'approved', 'rejected'] as const;
const SOURCE_VALUES = ['widget', 'api', 'mcp', 'import'] as const;

// Sets for runtime validation (backwards compatible with .has() calls)
// Cast to Set<string> to allow .has() with any string parameter
export const ALLOWED_STATUSES: Set<string> = new Set(STATUS_VALUES);
export const ALLOWED_MODERATION_STATES: Set<string> = new Set(MODERATION_STATE_VALUES);
export const ALLOWED_SOURCES: Set<string> = new Set(SOURCE_VALUES);

// ============================================================================
// Base Schemas
// ============================================================================

export const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(MAX_SLUG_LENGTH, `Slug must be <= ${MAX_SLUG_LENGTH} characters`)
  .regex(/^[a-z0-9-_]+$/i, 'Slug can only contain letters, numbers, hyphens, and underscores');

export const feedbackStatusSchema = z.enum(STATUS_VALUES);
export const moderationStateSchema = z.enum(MODERATION_STATE_VALUES);
export const feedbackSourceSchema = z.enum(SOURCE_VALUES);

// ============================================================================
// Public Endpoint Schemas
// ============================================================================

/** POST /api/v1/:workspace/:board/feedback */
export const createFeedbackSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(MAX_TITLE_LENGTH, `Title must be <= ${MAX_TITLE_LENGTH} characters`)
    .transform((v) => v.trim()),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `Description must be <= ${MAX_DESCRIPTION_LENGTH} characters`)
    .transform((v) => v?.trim() || null)
    .nullable()
    .optional(),
  externalUserId: z
    .string()
    .max(MAX_EXTERNAL_USER_ID_LENGTH, `User ID must be <= ${MAX_EXTERNAL_USER_ID_LENGTH} characters`)
    .transform((v) => v?.trim() || null)
    .nullable()
    .optional(),
});

/** POST /api/v1/:workspace/:board/feedback/:id/votes */
export const voteSchema = z.object({
  externalUserId: z
    .string()
    .max(MAX_EXTERNAL_USER_ID_LENGTH, `User ID must be <= ${MAX_EXTERNAL_USER_ID_LENGTH} characters`)
    .transform((v) => v?.trim() || null)
    .nullable()
    .optional(),
});

/** POST /api/v1/:workspace/:board/feedback/:id/comments */
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(MAX_COMMENT_LENGTH, `Comment must be <= ${MAX_COMMENT_LENGTH} characters`)
    .transform((v) => v.trim()),
  externalUserId: z
    .string()
    .max(MAX_EXTERNAL_USER_ID_LENGTH, `User ID must be <= ${MAX_EXTERNAL_USER_ID_LENGTH} characters`)
    .transform((v) => v?.trim() || null)
    .nullable()
    .optional(),
});

// ============================================================================
// Admin Endpoint Schemas
// ============================================================================

/** PATCH /api/v1/admin/workspaces/:workspace/feedback/:id */
export const updateFeedbackSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(MAX_TITLE_LENGTH, `Title must be <= ${MAX_TITLE_LENGTH} characters`)
    .transform((v) => v.trim())
    .optional(),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, `Description must be <= ${MAX_DESCRIPTION_LENGTH} characters`)
    .transform((v) => v?.trim() || null)
    .nullable()
    .optional(),
  status: feedbackStatusSchema.optional(),
  moderation_state: moderationStateSchema.optional(),
  is_hidden: z.boolean().optional(),
  tags: z.array(z.number().int().positive('Tag ID must be a positive integer')).optional(),
});

/** POST /api/v1/admin/workspaces/:workspace/feedback/bulk */
export const bulkUpdateFeedbackSchema = z.object({
  ids: z
    .array(z.number().int().positive('Feedback ID must be a positive integer'))
    .min(1, 'At least one ID is required')
    .max(100, 'Maximum 100 items per bulk operation'),
  updates: z.object({
    status: feedbackStatusSchema.optional(),
    moderation_state: moderationStateSchema.optional(),
    is_hidden: z.boolean().optional(),
  }).refine(
    (data) => data.status !== undefined || data.moderation_state !== undefined || data.is_hidden !== undefined,
    'At least one update field is required'
  ),
});

/** POST /api/v1/admin/workspaces/:workspace/tags */
export const createTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(MAX_TAG_NAME_LENGTH, `Tag name must be <= ${MAX_TAG_NAME_LENGTH} characters`)
    .transform((v) => v.trim()),
  color: z
    .string()
    .max(MAX_TAG_COLOR_LENGTH, `Color must be <= ${MAX_TAG_COLOR_LENGTH} characters`)
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5500)')
    .optional()
    .default('#808080'),
});

/** PATCH /api/v1/admin/workspaces/:workspace/tags/:id */
export const updateTagSchema = z.object({
  name: z
    .string()
    .min(1, 'Tag name is required')
    .max(MAX_TAG_NAME_LENGTH, `Tag name must be <= ${MAX_TAG_NAME_LENGTH} characters`)
    .transform((v) => v.trim())
    .optional(),
  color: z
    .string()
    .max(MAX_TAG_COLOR_LENGTH, `Color must be <= ${MAX_TAG_COLOR_LENGTH} characters`)
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color (e.g., #FF5500)')
    .optional(),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/** GET /api/v1/:workspace/:board/feedback query params */
export const listFeedbackQuerySchema = z.object({
  status: feedbackStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

/** GET /api/v1/admin/workspaces/:workspace/feedback query params */
export const adminListFeedbackQuerySchema = z.object({
  status: feedbackStatusSchema.optional(),
  moderation_state: moderationStateSchema.optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(['created_at', 'updated_at', 'vote_count', 'title']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

// ============================================================================
// Validation Helpers
// ============================================================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodIssue[] };

/**
 * Validate data against a Zod schema.
 * Returns a discriminated union for easy error handling.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error message for API response
  const firstError = result.error.issues[0];
  const path = firstError.path.length > 0 ? `${firstError.path.join('.')}: ` : '';
  const message = `${path}${firstError.message}`;

  return {
    success: false,
    error: message,
    details: result.error.issues,
  };
}

/**
 * Parse URL search params into an object for validation.
 */
export function parseSearchParams(url: URL, keys: string[]): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// Type Exports
// ============================================================================

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
export type BulkUpdateFeedbackInput = z.infer<typeof bulkUpdateFeedbackSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>;
export type AdminListFeedbackQuery = z.infer<typeof adminListFeedbackQuerySchema>;
export type FeedbackStatus = z.infer<typeof feedbackStatusSchema>;
export type ModerationState = z.infer<typeof moderationStateSchema>;
export type FeedbackSource = z.infer<typeof feedbackSourceSchema>;
