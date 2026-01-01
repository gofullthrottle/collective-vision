/**
 * Tag Taxonomy
 *
 * Default tag definitions for feedback classification.
 * These are seeded when a workspace is created.
 */

// =============================================================================
// Types
// =============================================================================

export interface TagDefinition {
  slug: string;
  name: string;
  description: string;
  color: string;
}

// =============================================================================
// Default Tags
// =============================================================================

/**
 * Default feedback type tags
 */
export const DEFAULT_TYPE_TAGS: readonly TagDefinition[] = [
  {
    slug: "bug",
    name: "Bug",
    description: "Something is broken or not working as expected",
    color: "#EF4444",
  },
  {
    slug: "feature_request",
    name: "Feature Request",
    description: "Request for new functionality",
    color: "#8B5CF6",
  },
  {
    slug: "improvement",
    name: "Improvement",
    description: "Enhancement to existing features",
    color: "#3B82F6",
  },
  {
    slug: "question",
    name: "Question",
    description: "User needs help or clarification",
    color: "#F59E0B",
  },
  {
    slug: "praise",
    name: "Praise",
    description: "Positive feedback or compliment",
    color: "#10B981",
  },
  {
    slug: "complaint",
    name: "Complaint",
    description: "Negative feedback that isn't a specific bug",
    color: "#6B7280",
  },
] as const;

/**
 * Default urgency tags
 */
export const DEFAULT_URGENCY_TAGS: readonly TagDefinition[] = [
  {
    slug: "urgent",
    name: "Urgent",
    description: "Important, affects productivity",
    color: "#EA580C",
  },
  {
    slug: "critical",
    name: "Critical",
    description: "Blocking work, data loss, or security issue",
    color: "#DC2626",
  },
] as const;

/**
 * All default system tags
 */
export const ALL_DEFAULT_TAGS: readonly TagDefinition[] = [
  ...DEFAULT_TYPE_TAGS,
  ...DEFAULT_URGENCY_TAGS,
];

// =============================================================================
// Type exports
// =============================================================================

export type FeedbackTypeSlug = (typeof DEFAULT_TYPE_TAGS)[number]["slug"];
export type UrgencySlug = (typeof DEFAULT_URGENCY_TAGS)[number]["slug"];

/**
 * Get tag definition by slug
 */
export function getTagDefinition(slug: string): TagDefinition | undefined {
  return ALL_DEFAULT_TAGS.find((tag) => tag.slug === slug);
}

/**
 * Check if a slug is a valid type tag
 */
export function isTypeTag(slug: string): slug is FeedbackTypeSlug {
  return DEFAULT_TYPE_TAGS.some((tag) => tag.slug === slug);
}

/**
 * Check if a slug is an urgency tag
 */
export function isUrgencyTag(slug: string): slug is UrgencySlug {
  return DEFAULT_URGENCY_TAGS.some((tag) => tag.slug === slug);
}
