/**
 * Embedding Service
 *
 * Generates text embeddings using Cloudflare Workers AI.
 * Uses the BGE (BAAI General Embedding) model for semantic similarity.
 */

// The Ai type from @cloudflare/workers-types
type Ai = {
  run(
    model: string,
    inputs: { text: string | string[] }
  ): Promise<{ data: number[][] }>;
};

// =============================================================================
// Types
// =============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingError {
  code: string;
  message: string;
  retryable: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * BGE Base English v1.5 - 768 dimensions
 * Good balance of quality and performance for text similarity
 */
export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Maximum text length for embedding (tokens)
 * BGE base supports up to 512 tokens (~2000 characters)
 */
export const MAX_TEXT_LENGTH = 2000;

// =============================================================================
// Embedding Generation
// =============================================================================

/**
 * Generate an embedding for a single text input
 *
 * @param ai - Cloudflare Workers AI binding
 * @param text - Text to embed (will be truncated if too long)
 * @returns Embedding vector (768 dimensions)
 */
export async function generateEmbedding(
  ai: Ai,
  text: string
): Promise<EmbeddingResult> {
  // Normalize and truncate text
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    throw new EmbeddingServiceError(
      "EMPTY_TEXT",
      "Cannot generate embedding for empty text",
      false
    );
  }

  try {
    const result = await ai.run(EMBEDDING_MODEL, {
      text: [normalizedText],
    });

    if (!result.data || !result.data[0]) {
      throw new EmbeddingServiceError(
        "EMPTY_RESPONSE",
        "AI model returned empty embedding",
        true
      );
    }

    return {
      embedding: result.data[0],
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    };
  } catch (error) {
    if (error instanceof EmbeddingServiceError) {
      throw error;
    }

    // Handle rate limits
    if (error instanceof Error && error.message.includes("rate limit")) {
      throw new EmbeddingServiceError(
        "RATE_LIMITED",
        "AI service rate limit reached",
        true
      );
    }

    // Handle other errors
    throw new EmbeddingServiceError(
      "AI_ERROR",
      `Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`,
      true
    );
  }
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * @param ai - Cloudflare Workers AI binding
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors
 */
export async function generateEmbeddings(
  ai: Ai,
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  // Normalize all texts
  const normalizedTexts = texts.map(normalizeText).filter(Boolean);

  if (normalizedTexts.length === 0) {
    throw new EmbeddingServiceError(
      "ALL_EMPTY",
      "All texts are empty after normalization",
      false
    );
  }

  try {
    const result = await ai.run(EMBEDDING_MODEL, {
      text: normalizedTexts,
    });

    if (!result.data || result.data.length !== normalizedTexts.length) {
      throw new EmbeddingServiceError(
        "BATCH_MISMATCH",
        `Expected ${normalizedTexts.length} embeddings, got ${result.data?.length ?? 0}`,
        true
      );
    }

    return result.data.map((embedding) => ({
      embedding,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }));
  } catch (error) {
    if (error instanceof EmbeddingServiceError) {
      throw error;
    }

    throw new EmbeddingServiceError(
      "BATCH_ERROR",
      `Failed to generate batch embeddings: ${error instanceof Error ? error.message : "Unknown error"}`,
      true
    );
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalize text for embedding generation
 * - Trims whitespace
 * - Removes excessive newlines
 * - Truncates to max length
 */
function normalizeText(text: string): string {
  if (!text) return "";

  return text
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .slice(0, MAX_TEXT_LENGTH); // Truncate
}

/**
 * Combine title and description for embedding
 * Weighted format: "Title: {title}. Description: {description}"
 */
export function combineTextForEmbedding(
  title: string,
  description?: string | null
): string {
  const parts: string[] = [];

  if (title?.trim()) {
    parts.push(`Title: ${title.trim()}`);
  }

  if (description?.trim()) {
    parts.push(`Description: ${description.trim()}`);
  }

  return parts.join(". ");
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embedding dimensions must match");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

// =============================================================================
// Error Class
// =============================================================================

export class EmbeddingServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean
  ) {
    super(message);
    this.name = "EmbeddingServiceError";
  }

  toJSON(): EmbeddingError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}
