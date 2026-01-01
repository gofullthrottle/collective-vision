/**
 * AI Utilities
 *
 * Exports all AI-related functions for embeddings, vectors, LLM, and queue processing.
 */

// Embeddings
export {
  generateEmbedding,
  generateEmbeddings,
  combineTextForEmbedding,
  cosineSimilarity,
  EmbeddingServiceError,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  MAX_TEXT_LENGTH,
  type EmbeddingResult,
  type EmbeddingError,
} from "./embeddings";

// Vector Store
export {
  upsertVector,
  upsertVectors,
  findSimilar,
  findDuplicates,
  getVectorsByIds,
  deleteVectors,
  VectorStoreError,
  DUPLICATE_THRESHOLD,
  SIMILAR_THRESHOLD,
  type VectorMetadata,
  type SimilarFeedback,
} from "./vectors";

// LLM
export {
  LLMClient,
  createLLMClient,
  LLMError,
  type FeedbackType,
  type UrgencyLevel,
  type ClassificationResult,
  type LLMConfig,
} from "./llm";

// Queue
export {
  createAIJob,
  enqueueAIJob,
  enqueueAIJobBatch,
  expandJobTypes,
  shouldRetry,
  createRetryJob,
  createDeadLetter,
  getProcessingStatus,
  createJobResult,
  processAIJobBatch,
  type AIJobType,
  type AIJob,
  type AIJobResult,
  type AIProcessingStatus as QueueAIProcessingStatus,
  type DeadLetterJob,
  type AIProcessor,
  type MessageBatch,
} from "./queue";

// Pipeline
export {
  processFeedback,
  processFeedbackBatch,
  getPendingFeedback,
  trackAIUsage,
  type PipelineEnv,
  type FeedbackItem,
  type PipelineResult,
  type AIProcessingStatus,
} from "./pipeline";

// Taxonomy
export {
  DEFAULT_TYPE_TAGS,
  DEFAULT_URGENCY_TAGS,
  ALL_DEFAULT_TAGS,
  getTagDefinition,
  isTypeTag,
  isUrgencyTag,
  type TagDefinition,
  type FeedbackTypeSlug,
  type UrgencySlug,
} from "./taxonomy";
