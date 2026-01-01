/**
 * Vector Store Operations
 *
 * Manages vector storage and semantic search using Cloudflare Vectorize.
 * Stores feedback embeddings for duplicate detection and theme clustering.
 */

import { EMBEDDING_DIMENSIONS } from "./embeddings";

// =============================================================================
// Types
// =============================================================================

/**
 * Vectorize index interface (from @cloudflare/workers-types)
 */
interface VectorizeIndex {
  upsert(vectors: VectorizeVector[]): Promise<VectorizeUpsertResult>;
  query(
    vector: number[],
    options: VectorizeQueryOptions
  ): Promise<VectorizeMatches>;
  getByIds(ids: string[]): Promise<VectorizeVector[]>;
  deleteByIds(ids: string[]): Promise<VectorizeDeleteResult>;
}

interface VectorizeVector {
  id: string;
  values: number[];
  metadata?: VectorMetadata;
}

interface VectorizeUpsertResult {
  count: number;
}

interface VectorizeQueryOptions {
  topK: number;
  filter?: Record<string, unknown>;
  returnValues?: boolean;
  returnMetadata?: boolean;
}

interface VectorizeMatches {
  matches: VectorizeMatch[];
  count: number;
}

interface VectorizeMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: VectorMetadata;
}

interface VectorizeDeleteResult {
  count: number;
}

/**
 * Metadata stored with each vector
 */
export interface VectorMetadata {
  feedback_id: string;
  board_id: string;
  workspace_id: number;
  created_at: string;
  title?: string;
  type?: string;
}

/**
 * Query result with similarity score
 */
export interface SimilarFeedback {
  feedbackId: string;
  score: number;
  metadata: VectorMetadata;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Similarity threshold for duplicate detection
 * 0.85+ = likely duplicate
 * 0.70-0.85 = related/similar
 * <0.70 = different
 */
export const DUPLICATE_THRESHOLD = 0.85;
export const SIMILAR_THRESHOLD = 0.70;

// =============================================================================
// Vector Operations
// =============================================================================

/**
 * Store a feedback embedding in the vector index
 */
export async function upsertVector(
  vectorize: VectorizeIndex,
  feedbackId: string,
  embedding: number[],
  metadata: VectorMetadata
): Promise<void> {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new VectorStoreError(
      "DIMENSION_MISMATCH",
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
    );
  }

  try {
    await vectorize.upsert([
      {
        id: feedbackId,
        values: embedding,
        metadata,
      },
    ]);
  } catch (error) {
    throw new VectorStoreError(
      "UPSERT_FAILED",
      `Failed to upsert vector: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Store multiple feedback embeddings in batch
 */
export async function upsertVectors(
  vectorize: VectorizeIndex,
  vectors: Array<{
    feedbackId: string;
    embedding: number[];
    metadata: VectorMetadata;
  }>
): Promise<number> {
  if (vectors.length === 0) return 0;

  // Validate dimensions
  for (const v of vectors) {
    if (v.embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new VectorStoreError(
        "DIMENSION_MISMATCH",
        `Vector ${v.feedbackId} has wrong dimensions: ${v.embedding.length}`
      );
    }
  }

  try {
    const result = await vectorize.upsert(
      vectors.map((v) => ({
        id: v.feedbackId,
        values: v.embedding,
        metadata: v.metadata,
      }))
    );
    return result.count;
  } catch (error) {
    throw new VectorStoreError(
      "BATCH_UPSERT_FAILED",
      `Failed to batch upsert vectors: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Find similar feedback items using vector similarity search
 */
export async function findSimilar(
  vectorize: VectorizeIndex,
  embedding: number[],
  options: {
    topK?: number;
    workspaceId?: number;
    excludeId?: string;
    minScore?: number;
  } = {}
): Promise<SimilarFeedback[]> {
  const { topK = 10, workspaceId, excludeId, minScore = SIMILAR_THRESHOLD } = options;

  // Build filter
  const filter: Record<string, unknown> = {};
  if (workspaceId !== undefined) {
    filter.workspace_id = workspaceId;
  }

  try {
    const results = await vectorize.query(embedding, {
      topK: topK + (excludeId ? 1 : 0), // Fetch extra if we need to exclude self
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      returnMetadata: true,
    });

    return results.matches
      .filter((m) => m.id !== excludeId && m.score >= minScore)
      .slice(0, topK)
      .map((m) => ({
        feedbackId: m.id,
        score: m.score,
        metadata: m.metadata as VectorMetadata,
      }));
  } catch (error) {
    throw new VectorStoreError(
      "QUERY_FAILED",
      `Failed to query vectors: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Find potential duplicates (high similarity matches)
 */
export async function findDuplicates(
  vectorize: VectorizeIndex,
  embedding: number[],
  workspaceId: number,
  excludeId?: string
): Promise<SimilarFeedback[]> {
  return findSimilar(vectorize, embedding, {
    topK: 5,
    workspaceId,
    excludeId,
    minScore: DUPLICATE_THRESHOLD,
  });
}

/**
 * Get vectors by their IDs
 */
export async function getVectorsByIds(
  vectorize: VectorizeIndex,
  ids: string[]
): Promise<Map<string, number[]>> {
  if (ids.length === 0) return new Map();

  try {
    const vectors = await vectorize.getByIds(ids);
    const result = new Map<string, number[]>();
    for (const v of vectors) {
      result.set(v.id, v.values);
    }
    return result;
  } catch (error) {
    throw new VectorStoreError(
      "GET_FAILED",
      `Failed to get vectors: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Delete vectors by their IDs
 */
export async function deleteVectors(
  vectorize: VectorizeIndex,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;

  try {
    const result = await vectorize.deleteByIds(ids);
    return result.count;
  } catch (error) {
    throw new VectorStoreError(
      "DELETE_FAILED",
      `Failed to delete vectors: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class VectorStoreError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "VectorStoreError";
  }
}
