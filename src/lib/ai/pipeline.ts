/**
 * AI Processing Pipeline
 *
 * Unified pipeline that runs all AI processing steps on feedback items:
 * 1. Generate embedding
 * 2. Check for duplicates
 * 3. Classify intent/type
 * 4. Analyze sentiment/urgency
 * 5. Calculate priority score
 * 6. Assign to theme (if themes exist)
 */

import type { D1Database } from "@cloudflare/workers-types";
import {
  generateEmbedding,
  combineTextForEmbedding,
  EmbeddingServiceError,
} from "./embeddings";
import {
  upsertVector,
  findDuplicates,
  type VectorMetadata,
  VectorStoreError,
  DUPLICATE_THRESHOLD,
} from "./vectors";
import {
  LLMClient,
  createLLMClient,
  type ClassificationResult,
  LLMError,
} from "./llm";
import { generateId } from "../auth";

// =============================================================================
// Types
// =============================================================================

interface Ai {
  run(model: string, inputs: { text: string | string[] }): Promise<{ data: number[][] }>;
}

// Use 'any' for Vectorize to allow flexible metadata types
// The actual VectorMetadata is validated in vectors.ts
interface VectorizeIndex {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsert(vectors: Array<{ id: string; values: number[]; metadata?: any }>): Promise<{ count: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(vector: number[], options: { topK: number; filter?: any; returnMetadata?: boolean }): Promise<{ matches: Array<{ id: string; score: number; metadata?: any }>; count: number }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByIds(ids: string[]): Promise<Array<{ id: string; values: number[]; metadata?: any }>>;
  deleteByIds(ids: string[]): Promise<{ count: number }>;
}

export interface PipelineEnv {
  DB: D1Database;
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;
  CLAUDE_API_KEY?: string;
}

export interface FeedbackItem {
  id: string;
  title: string;
  description: string | null;
  board_id: string;
  workspace_id: number;
  created_at: string;
}

export interface PipelineResult {
  feedbackId: string;
  success: boolean;
  steps: {
    embedding: StepResult;
    duplicates: StepResult;
    classification: StepResult;
    priority: StepResult;
    theme: StepResult;
  };
  classification?: ClassificationResult;
  duplicates?: Array<{ id: string; score: number }>;
  priorityScore?: number;
  processingTime: number;
}

interface StepResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export type AIProcessingStatus = "pending" | "processing" | "completed" | "failed" | "partial";

// =============================================================================
// Priority Calculation
// =============================================================================

interface PriorityWeights {
  votes: number;
  sentiment: number;
  urgency: number;
}

const DEFAULT_WEIGHTS: PriorityWeights = {
  votes: 0.3,
  sentiment: 0.2,
  urgency: 0.5,
};

/**
 * Calculate priority score (0-100)
 * Higher score = higher priority
 *
 * Components:
 * - Vote count (normalized)
 * - Negative sentiment (increases priority)
 * - Urgency score (highest weight)
 */
function calculatePriority(
  voteCount: number,
  sentimentScore: number,
  urgencyScore: number,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number {
  // Normalize vote count (assuming max ~100 votes = 1.0)
  const normalizedVotes = Math.min(voteCount / 100, 1);

  // Invert sentiment: negative = high priority, positive = low priority
  // Convert from [-1, 1] to [0, 1] where 1 is most negative
  const invertedSentiment = (1 - sentimentScore) / 2;

  // Calculate weighted sum
  const rawScore =
    normalizedVotes * weights.votes +
    invertedSentiment * weights.sentiment +
    urgencyScore * weights.urgency;

  // Scale to 0-100
  return Math.round(rawScore * 100);
}

/**
 * Convert urgency level to score
 */
function urgencyLevelToScore(level: string): number {
  switch (level) {
    case "critical":
      return 1.0;
    case "urgent":
      return 0.7;
    default:
      return 0.3;
  }
}

// =============================================================================
// Pipeline Implementation
// =============================================================================

/**
 * Run the full AI pipeline on a feedback item
 */
export async function processFeedback(
  feedback: FeedbackItem,
  env: PipelineEnv,
  options: {
    skipDuplicates?: boolean;
    skipClassification?: boolean;
    skipTheme?: boolean;
  } = {}
): Promise<PipelineResult> {
  const startTime = Date.now();

  const result: PipelineResult = {
    feedbackId: feedback.id,
    success: false,
    steps: {
      embedding: { success: false },
      duplicates: { success: false },
      classification: { success: false },
      priority: { success: false },
      theme: { success: false },
    },
    processingTime: 0,
  };

  // Mark as processing
  await updateProcessingStatus(env.DB, feedback.id, "processing");

  let embedding: number[] | null = null;
  let classification: ClassificationResult | null = null;

  // Step 1: Generate Embedding
  if (env.AI) {
    try {
      const text = combineTextForEmbedding(feedback.title, feedback.description);
      const embeddingResult = await generateEmbedding(env.AI, text);
      embedding = embeddingResult.embedding;
      result.steps.embedding.success = true;

      // Store in Vectorize if available
      if (env.VECTORIZE) {
        const metadata: VectorMetadata = {
          feedback_id: feedback.id,
          board_id: feedback.board_id,
          workspace_id: feedback.workspace_id,
          created_at: feedback.created_at,
          title: feedback.title.slice(0, 100),
        };
        await upsertVector(env.VECTORIZE, feedback.id, embedding, metadata);

        // Update embedding_id in database
        await env.DB.prepare(
          "UPDATE feedback_items SET embedding_id = ? WHERE id = ?"
        )
          .bind(feedback.id, feedback.id)
          .run();
      }
    } catch (error) {
      result.steps.embedding.error =
        error instanceof EmbeddingServiceError
          ? error.message
          : "Embedding generation failed";
    }
  } else {
    result.steps.embedding.skipped = true;
  }

  // Step 2: Check for Duplicates
  if (
    !options.skipDuplicates &&
    env.VECTORIZE &&
    embedding &&
    result.steps.embedding.success
  ) {
    try {
      const duplicates = await findDuplicates(
        env.VECTORIZE,
        embedding,
        feedback.workspace_id,
        feedback.id
      );

      if (duplicates.length > 0) {
        result.duplicates = duplicates.map((d) => ({
          id: d.feedbackId,
          score: d.score,
        }));

        // Store duplicate suggestions
        for (const dup of duplicates) {
          await storeDuplicateSuggestion(
            env.DB,
            feedback.id,
            dup.feedbackId,
            dup.score
          );
        }
      }

      result.steps.duplicates.success = true;
    } catch (error) {
      result.steps.duplicates.error =
        error instanceof VectorStoreError
          ? error.message
          : "Duplicate check failed";
    }
  } else if (options.skipDuplicates) {
    result.steps.duplicates.skipped = true;
  } else {
    result.steps.duplicates.skipped = true;
  }

  // Step 3: Classification (Type, Sentiment, Urgency)
  if (!options.skipClassification && env.CLAUDE_API_KEY) {
    try {
      const llm = createLLMClient(env.CLAUDE_API_KEY);
      classification = await llm.classifyFeedback(
        feedback.title,
        feedback.description
      );
      result.classification = classification;
      result.steps.classification.success = true;

      // Store classification results
      await storeClassification(env.DB, feedback.id, classification);
    } catch (error) {
      result.steps.classification.error =
        error instanceof LLMError
          ? error.message
          : "Classification failed";
    }
  } else if (options.skipClassification) {
    result.steps.classification.skipped = true;
  } else {
    result.steps.classification.skipped = true;
  }

  // Step 4: Calculate Priority Score
  if (classification) {
    try {
      // Get current vote count
      const voteResult = await env.DB.prepare(
        "SELECT COALESCE(SUM(weight), 0) as vote_count FROM feedback_votes WHERE feedback_id = ?"
      )
        .bind(feedback.id)
        .first<{ vote_count: number }>();

      const voteCount = voteResult?.vote_count || 0;
      const urgencyScore = urgencyLevelToScore(classification.urgency);

      result.priorityScore = calculatePriority(
        voteCount,
        classification.sentiment_score,
        urgencyScore
      );

      // Store priority score
      await env.DB.prepare(
        "UPDATE feedback_items SET priority_score = ? WHERE id = ?"
      )
        .bind(result.priorityScore, feedback.id)
        .run();

      result.steps.priority.success = true;
    } catch (error) {
      result.steps.priority.error = "Priority calculation failed";
    }
  } else {
    result.steps.priority.skipped = true;
  }

  // Step 5: Theme Assignment (skip for now - requires clustering)
  result.steps.theme.skipped = true;

  // Determine overall success
  const completedSteps = Object.values(result.steps).filter(
    (s) => s.success
  ).length;
  const totalSteps = Object.values(result.steps).filter(
    (s) => !s.skipped
  ).length;

  if (totalSteps === 0) {
    result.success = true; // All steps skipped is still success
  } else if (completedSteps === totalSteps) {
    result.success = true;
  }

  // Update final status
  const status: AIProcessingStatus =
    completedSteps === totalSteps
      ? "completed"
      : completedSteps > 0
        ? "partial"
        : "failed";

  await updateProcessingStatus(env.DB, feedback.id, status);

  result.processingTime = Date.now() - startTime;
  return result;
}

// =============================================================================
// Database Helpers
// =============================================================================

async function updateProcessingStatus(
  db: D1Database,
  feedbackId: string,
  status: AIProcessingStatus
): Promise<void> {
  await db
    .prepare(
      `UPDATE feedback_items
       SET ai_status = ?, ai_processed_at = datetime('now')
       WHERE id = ?`
    )
    .bind(status, feedbackId)
    .run();
}

async function storeClassification(
  db: D1Database,
  feedbackId: string,
  classification: ClassificationResult
): Promise<void> {
  await db
    .prepare(
      `UPDATE feedback_items SET
         ai_type = ?,
         ai_product_area = ?,
         ai_confidence = ?,
         sentiment_score = ?,
         urgency_score = ?,
         urgency_level = ?,
         ai_summary = ?
       WHERE id = ?`
    )
    .bind(
      classification.type,
      classification.product_area,
      classification.confidence,
      classification.sentiment_score,
      urgencyLevelToScore(classification.urgency),
      classification.urgency,
      classification.summary || null,
      feedbackId
    )
    .run();
}

async function storeDuplicateSuggestion(
  db: D1Database,
  feedbackId: string,
  suggestedDuplicateId: string,
  score: number
): Promise<void> {
  const id = generateId("dup");
  await db
    .prepare(
      `INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (feedback_id, suggested_duplicate_id) DO UPDATE SET
         similarity_score = excluded.similarity_score`
    )
    .bind(id, feedbackId, suggestedDuplicateId, score)
    .run();
}

// =============================================================================
// AI Usage Tracking
// =============================================================================

export async function trackAIUsage(
  db: D1Database,
  workspaceId: number,
  usage: {
    embeddings?: number;
    llmCalls?: number;
    vectorQueries?: number;
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const id = generateId("usage");

  await db
    .prepare(
      `INSERT INTO ai_usage (id, workspace_id, date, embeddings_count, llm_calls_count, vector_queries_count, total_input_tokens, total_output_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (workspace_id, date) DO UPDATE SET
         embeddings_count = ai_usage.embeddings_count + excluded.embeddings_count,
         llm_calls_count = ai_usage.llm_calls_count + excluded.llm_calls_count,
         vector_queries_count = ai_usage.vector_queries_count + excluded.vector_queries_count,
         total_input_tokens = ai_usage.total_input_tokens + excluded.total_input_tokens,
         total_output_tokens = ai_usage.total_output_tokens + excluded.total_output_tokens,
         updated_at = datetime('now')`
    )
    .bind(
      id,
      workspaceId,
      today,
      usage.embeddings || 0,
      usage.llmCalls || 0,
      usage.vectorQueries || 0,
      usage.inputTokens || 0,
      usage.outputTokens || 0
    )
    .run();
}

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Process multiple feedback items in batch
 */
export async function processFeedbackBatch(
  feedbackItems: FeedbackItem[],
  env: PipelineEnv,
  options?: {
    skipDuplicates?: boolean;
    skipClassification?: boolean;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];

  for (let i = 0; i < feedbackItems.length; i++) {
    const feedback = feedbackItems[i];
    const result = await processFeedback(feedback, env, options);
    results.push(result);

    if (options?.onProgress) {
      options.onProgress(i + 1, feedbackItems.length);
    }
  }

  return results;
}

/**
 * Get pending feedback items for processing
 */
export async function getPendingFeedback(
  db: D1Database,
  workspaceId?: number,
  limit = 100
): Promise<FeedbackItem[]> {
  let query = `
    SELECT id, title, description, board_id, workspace_id, created_at
    FROM feedback_items
    WHERE ai_status = 'pending' OR ai_status IS NULL
  `;

  if (workspaceId) {
    query += ` AND workspace_id = ?`;
  }

  query += ` ORDER BY created_at ASC LIMIT ?`;

  const stmt = workspaceId
    ? db.prepare(query).bind(workspaceId, limit)
    : db.prepare(query).bind(limit);

  const result = await stmt.all<FeedbackItem>();
  return result.results;
}
