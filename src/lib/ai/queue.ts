/**
 * AI Processing Queue
 *
 * Manages asynchronous AI processing jobs using Cloudflare Queues.
 * Supports embedding generation, classification, and theme assignment.
 */

// =============================================================================
// Types
// =============================================================================

export type AIJobType =
  | "embed" // Generate embedding for feedback
  | "classify" // Classify feedback type/urgency
  | "sentiment" // Analyze sentiment
  | "theme" // Assign to theme cluster
  | "duplicate" // Check for duplicates
  | "full_pipeline"; // Run all processing

export interface AIJob {
  id: string;
  feedbackId: string;
  workspaceId: number;
  types: AIJobType[];
  priority: "high" | "normal" | "low";
  retryCount: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AIJobResult {
  jobId: string;
  feedbackId: string;
  success: boolean;
  completedTypes: AIJobType[];
  failedTypes: AIJobType[];
  errors: Array<{ type: AIJobType; error: string }>;
  processingTime: number;
}

export type AIProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "partial";

/**
 * Queue binding interface (from @cloudflare/workers-types)
 */
interface Queue<T> {
  send(message: T, options?: { contentType?: string }): Promise<void>;
  sendBatch(
    messages: Array<{ body: T; contentType?: string }>
  ): Promise<void>;
}

/**
 * Message batch for queue consumer
 */
export interface MessageBatch<T> {
  messages: Array<{
    id: string;
    body: T;
    timestamp: Date;
    ack(): void;
    retry(): void;
  }>;
  queue: string;
  ackAll(): void;
  retryAll(): void;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RETRIES = 3;
const JOB_ID_PREFIX = "job";

// =============================================================================
// Job Producer
// =============================================================================

/**
 * Create a new AI processing job
 */
export function createAIJob(
  feedbackId: string,
  workspaceId: number,
  types: AIJobType[] = ["full_pipeline"],
  priority: "high" | "normal" | "low" = "normal"
): AIJob {
  return {
    id: `${JOB_ID_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    feedbackId,
    workspaceId,
    types,
    priority,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Enqueue a job for AI processing
 */
export async function enqueueAIJob(
  queue: Queue<AIJob>,
  feedbackId: string,
  workspaceId: number,
  types?: AIJobType[],
  priority?: "high" | "normal" | "low"
): Promise<string> {
  const job = createAIJob(feedbackId, workspaceId, types, priority);

  await queue.send(job);

  return job.id;
}

/**
 * Enqueue multiple jobs in batch
 */
export async function enqueueAIJobBatch(
  queue: Queue<AIJob>,
  jobs: Array<{
    feedbackId: string;
    workspaceId: number;
    types?: AIJobType[];
    priority?: "high" | "normal" | "low";
  }>
): Promise<string[]> {
  const createdJobs = jobs.map((j) =>
    createAIJob(j.feedbackId, j.workspaceId, j.types, j.priority)
  );

  await queue.sendBatch(createdJobs.map((job) => ({ body: job })));

  return createdJobs.map((j) => j.id);
}

// =============================================================================
// Job Processing Helpers
// =============================================================================

/**
 * Expand full_pipeline into individual job types
 */
export function expandJobTypes(types: AIJobType[]): AIJobType[] {
  const expanded: AIJobType[] = [];

  for (const type of types) {
    if (type === "full_pipeline") {
      expanded.push("embed", "classify", "sentiment", "duplicate", "theme");
    } else {
      expanded.push(type);
    }
  }

  // Remove duplicates and maintain order
  return [...new Set(expanded)];
}

/**
 * Check if job should be retried
 */
export function shouldRetry(job: AIJob): boolean {
  return job.retryCount < MAX_RETRIES;
}

/**
 * Create a retry job with incremented count
 */
export function createRetryJob(job: AIJob, failedTypes: AIJobType[]): AIJob {
  return {
    ...job,
    types: failedTypes,
    retryCount: job.retryCount + 1,
    metadata: {
      ...job.metadata,
      previousJobId: job.id,
      retryReason: "partial_failure",
    },
  };
}

// =============================================================================
// Dead Letter Handling
// =============================================================================

/**
 * Dead letter job for manual review
 */
export interface DeadLetterJob {
  originalJob: AIJob;
  failureReason: string;
  lastError: string;
  failedAt: string;
}

/**
 * Create a dead letter entry
 */
export function createDeadLetter(
  job: AIJob,
  reason: string,
  error: string
): DeadLetterJob {
  return {
    originalJob: job,
    failureReason: reason,
    lastError: error,
    failedAt: new Date().toISOString(),
  };
}

// =============================================================================
// Processing Status
// =============================================================================

/**
 * Determine overall status from job result
 */
export function getProcessingStatus(result: AIJobResult): AIProcessingStatus {
  if (!result.success) {
    if (result.completedTypes.length === 0) {
      return "failed";
    }
    return "partial";
  }
  return "completed";
}

/**
 * Create a job result
 */
export function createJobResult(
  job: AIJob,
  completedTypes: AIJobType[],
  failedTypes: AIJobType[],
  errors: Array<{ type: AIJobType; error: string }>,
  processingTime: number
): AIJobResult {
  return {
    jobId: job.id,
    feedbackId: job.feedbackId,
    success: failedTypes.length === 0,
    completedTypes,
    failedTypes,
    errors,
    processingTime,
  };
}

// =============================================================================
// Queue Consumer Handler (to be used in worker)
// =============================================================================

/**
 * Base interface for the AI processor
 */
export interface AIProcessor {
  processJob(job: AIJob): Promise<AIJobResult>;
}

/**
 * Process a batch of AI jobs
 *
 * @param batch - Message batch from queue
 * @param processor - AI processor implementation
 * @param onDeadLetter - Callback for dead letter jobs
 */
export async function processAIJobBatch(
  batch: MessageBatch<AIJob>,
  processor: AIProcessor,
  onDeadLetter?: (deadLetter: DeadLetterJob) => Promise<void>
): Promise<void> {
  for (const message of batch.messages) {
    const job = message.body;

    try {
      const result = await processor.processJob(job);

      if (result.success) {
        message.ack();
      } else if (shouldRetry(job)) {
        // Retry with failed types only
        message.retry();
      } else {
        // Move to dead letter
        if (onDeadLetter) {
          const deadLetter = createDeadLetter(
            job,
            "max_retries_exceeded",
            result.errors.map((e) => `${e.type}: ${e.error}`).join("; ")
          );
          await onDeadLetter(deadLetter);
        }
        message.ack(); // Ack to prevent infinite retry
      }
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);

      if (shouldRetry(job)) {
        message.retry();
      } else {
        if (onDeadLetter) {
          const deadLetter = createDeadLetter(
            job,
            "processing_exception",
            error instanceof Error ? error.message : "Unknown error"
          );
          await onDeadLetter(deadLetter);
        }
        message.ack();
      }
    }
  }
}
