/**
 * LLM Integration for Classification
 *
 * Uses Claude API for intelligent feedback classification,
 * sentiment analysis, and urgency detection.
 */

// =============================================================================
// Types
// =============================================================================

export type FeedbackType =
  | "bug"
  | "feature_request"
  | "improvement"
  | "question"
  | "praise"
  | "complaint";

export type UrgencyLevel = "normal" | "urgent" | "critical";

export interface ClassificationResult {
  type: FeedbackType;
  product_area: string | null;
  urgency: UrgencyLevel;
  confidence: number;
  sentiment_score: number; // -1 (negative) to +1 (positive)
  urgency_keywords: string[];
  summary?: string;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

interface ClaudeResponse {
  id: string;
  content: Array<{
    type: "text";
    text: string;
  }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-haiku-20241022";
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;

// Urgency keywords for quick detection
const URGENCY_KEYWORDS = {
  critical: [
    "broken",
    "down",
    "crash",
    "data loss",
    "security",
    "urgent",
    "emergency",
    "asap",
    "immediately",
    "production",
    "outage",
  ],
  urgent: [
    "blocking",
    "can't work",
    "stuck",
    "important",
    "deadline",
    "need help",
    "high priority",
    "serious",
  ],
};

// =============================================================================
// Classification Prompt
// =============================================================================

const CLASSIFICATION_PROMPT = `You are a feedback classification expert. Analyze the following user feedback and return a JSON response.

Feedback Types:
- bug: Something is broken or not working as expected
- feature_request: Request for new functionality
- improvement: Enhancement to existing features
- question: User needs help or clarification
- praise: Positive feedback or compliment
- complaint: Negative feedback (not a specific bug)

Urgency Levels:
- critical: Blocking work, data loss, security issue
- urgent: Important but not critical, affects productivity
- normal: Standard priority, can wait

Respond ONLY with valid JSON in this exact format:
{
  "type": "bug|feature_request|improvement|question|praise|complaint",
  "product_area": "string or null - inferred area of the product",
  "urgency": "normal|urgent|critical",
  "confidence": 0.0-1.0,
  "sentiment_score": -1.0 to 1.0 (negative to positive),
  "urgency_keywords": ["list", "of", "detected", "keywords"],
  "summary": "One sentence summary of the feedback"
}`;

// =============================================================================
// LLM Client
// =============================================================================

export class LLMClient {
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private timeout: number;

  constructor(config: LLMConfig) {
    if (!config.apiKey) {
      throw new LLMError("CONFIG_ERROR", "Claude API key is required");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODEL;
    this.maxRetries = config.maxRetries || MAX_RETRIES;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Classify feedback using Claude
   */
  async classifyFeedback(
    title: string,
    description?: string | null
  ): Promise<ClassificationResult> {
    const feedbackText = this.formatFeedback(title, description);

    const messages: ClaudeMessage[] = [
      {
        role: "user",
        content: `${CLASSIFICATION_PROMPT}\n\nFeedback to analyze:\nTitle: ${title}\n${description ? `Description: ${description}` : ""}`,
      },
    ];

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.callClaude(messages);
        const parsed = this.parseClassificationResponse(response);

        // Enhance with keyword detection
        const detectedKeywords = this.detectUrgencyKeywords(feedbackText);
        if (detectedKeywords.length > 0) {
          parsed.urgency_keywords = [
            ...new Set([...parsed.urgency_keywords, ...detectedKeywords]),
          ];
        }

        return parsed;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof LLMError && !error.retryable) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // All retries failed - return a fallback classification
    console.error(`LLM classification failed after ${this.maxRetries} attempts:`, lastError);
    return this.fallbackClassification(title, description);
  }

  /**
   * Call Claude API
   */
  private async callClaude(messages: ClaudeMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: DEFAULT_MAX_TOKENS,
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();

        if (response.status === 429) {
          throw new LLMError("RATE_LIMITED", "Claude API rate limit reached", true);
        }

        if (response.status >= 500) {
          throw new LLMError("API_ERROR", `Claude API error: ${response.status}`, true);
        }

        throw new LLMError(
          "API_ERROR",
          `Claude API request failed: ${response.status} - ${errorBody}`,
          false
        );
      }

      const data = (await response.json()) as ClaudeResponse;

      if (!data.content || data.content.length === 0) {
        throw new LLMError("EMPTY_RESPONSE", "Claude returned empty response", true);
      }

      return data.content[0].text;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LLMError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new LLMError("TIMEOUT", "Claude API request timed out", true);
      }

      throw new LLMError(
        "NETWORK_ERROR",
        `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
        true
      );
    }
  }

  /**
   * Parse Claude's JSON response
   */
  private parseClassificationResponse(response: string): ClassificationResult {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "");
    }

    try {
      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.type || !parsed.urgency) {
        throw new Error("Missing required fields");
      }

      // Validate enum values
      const validTypes: FeedbackType[] = [
        "bug",
        "feature_request",
        "improvement",
        "question",
        "praise",
        "complaint",
      ];
      const validUrgency: UrgencyLevel[] = ["normal", "urgent", "critical"];

      if (!validTypes.includes(parsed.type)) {
        parsed.type = "question"; // Default fallback
      }

      if (!validUrgency.includes(parsed.urgency)) {
        parsed.urgency = "normal";
      }

      return {
        type: parsed.type,
        product_area: parsed.product_area || null,
        urgency: parsed.urgency,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
        sentiment_score: Math.max(-1, Math.min(1, parsed.sentiment_score || 0)),
        urgency_keywords: Array.isArray(parsed.urgency_keywords)
          ? parsed.urgency_keywords
          : [],
        summary: parsed.summary || undefined,
      };
    } catch {
      throw new LLMError(
        "PARSE_ERROR",
        `Failed to parse Claude response: ${response.slice(0, 100)}...`,
        false
      );
    }
  }

  /**
   * Detect urgency keywords in text
   */
  private detectUrgencyKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    const detected: string[] = [];

    for (const keyword of URGENCY_KEYWORDS.critical) {
      if (lowerText.includes(keyword)) {
        detected.push(keyword);
      }
    }

    for (const keyword of URGENCY_KEYWORDS.urgent) {
      if (lowerText.includes(keyword)) {
        detected.push(keyword);
      }
    }

    return detected;
  }

  /**
   * Fallback classification when LLM fails
   */
  private fallbackClassification(
    title: string,
    description?: string | null
  ): ClassificationResult {
    const text = this.formatFeedback(title, description).toLowerCase();
    const keywords = this.detectUrgencyKeywords(text);

    // Simple heuristic classification
    let type: FeedbackType = "question";
    let urgency: UrgencyLevel = "normal";
    let sentiment = 0;

    // Detect type from keywords
    if (
      text.includes("bug") ||
      text.includes("error") ||
      text.includes("broken") ||
      text.includes("crash")
    ) {
      type = "bug";
      sentiment = -0.3;
    } else if (
      text.includes("feature") ||
      text.includes("would be nice") ||
      text.includes("please add")
    ) {
      type = "feature_request";
    } else if (
      text.includes("improve") ||
      text.includes("better") ||
      text.includes("enhance")
    ) {
      type = "improvement";
    } else if (
      text.includes("love") ||
      text.includes("great") ||
      text.includes("awesome") ||
      text.includes("thank")
    ) {
      type = "praise";
      sentiment = 0.8;
    } else if (
      text.includes("hate") ||
      text.includes("terrible") ||
      text.includes("worst")
    ) {
      type = "complaint";
      sentiment = -0.8;
    }

    // Detect urgency
    if (keywords.some((k) => URGENCY_KEYWORDS.critical.includes(k))) {
      urgency = "critical";
    } else if (keywords.some((k) => URGENCY_KEYWORDS.urgent.includes(k))) {
      urgency = "urgent";
    }

    return {
      type,
      product_area: null,
      urgency,
      confidence: 0.3, // Low confidence for fallback
      sentiment_score: sentiment,
      urgency_keywords: keywords,
    };
  }

  /**
   * Format feedback for analysis
   */
  private formatFeedback(title: string, description?: string | null): string {
    return `${title}${description ? ` ${description}` : ""}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class LLMError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "LLMError";
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an LLM client from environment config
 */
export function createLLMClient(apiKey: string, model?: string): LLMClient {
  return new LLMClient({
    apiKey,
    model,
  });
}
