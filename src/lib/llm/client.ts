/**
 * LiteLLM Client
 *
 * ASSUMPTIONS:
 * - LiteLLM proxy is available at https://litellm.jfcreations.com
 * - Uses OpenAI-compatible API format
 * - API key is stored in env.LITELLM_API_KEY
 * - Default model is configurable, fallback to gpt-4o-mini
 *
 * LiteLLM provides unified access to multiple LLM providers:
 * - OpenAI (gpt-4, gpt-4o, gpt-3.5-turbo)
 * - Anthropic (claude-3-opus, claude-3-sonnet, claude-3-haiku)
 * - And many more
 */

export interface LiteLLMConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  response_format?: { type: 'text' | 'json_object' };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface EmbeddingRequest {
  model?: string;
  input: string | string[];
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class LiteLLMClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(config: LiteLLMConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
  }

  private async request<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LiteLLM API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a chat completion
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.request<ChatCompletionResponse>('/v1/chat/completions', {
      model: request.model || this.defaultModel,
      ...request,
    });
  }

  /**
   * Simple completion helper - returns just the text response
   */
  async complete(
    prompt: string,
    options: {
      system?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      jsonMode?: boolean;
    } = {}
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.chat({
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    });

    return response.choices[0]?.message?.content || '';
  }

  /**
   * Create embeddings
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return this.request<EmbeddingResponse>('/v1/embeddings', {
      model: request.model || 'text-embedding-3-small',
      input: request.input,
    });
  }

  /**
   * Get a single embedding vector
   */
  async getEmbedding(text: string, model?: string): Promise<number[]> {
    const response = await this.embed({
      model,
      input: text,
    });
    return response.data[0].embedding;
  }

  /**
   * Classify text into categories
   */
  async classify<T extends string>(
    text: string,
    categories: T[],
    options: {
      description?: string;
      examples?: Array<{ text: string; category: T }>;
      model?: string;
    } = {}
  ): Promise<{ category: T; confidence: number; reasoning?: string }> {
    const systemPrompt = `You are a precise text classifier. Classify the given text into exactly one of these categories: ${categories.join(', ')}.

${options.description ? `Context: ${options.description}` : ''}

${options.examples?.length ? `Examples:
${options.examples.map(e => `- "${e.text}" → ${e.category}`).join('\n')}` : ''}

Respond in JSON format: { "category": "<category>", "confidence": <0.0-1.0>, "reasoning": "<brief explanation>" }`;

    const response = await this.complete(text, {
      system: systemPrompt,
      model: options.model,
      temperature: 0.1,
      jsonMode: true,
    });

    try {
      const parsed = JSON.parse(response);
      return {
        category: parsed.category as T,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning,
      };
    } catch {
      // Fallback if JSON parsing fails
      const foundCategory = categories.find(c => response.toLowerCase().includes(c.toLowerCase()));
      return {
        category: foundCategory || categories[0],
        confidence: 0.3,
        reasoning: 'Parsed from text response',
      };
    }
  }

  /**
   * Extract structured data from text
   */
  async extract<T>(
    text: string,
    schema: Record<string, string>,
    options: { model?: string; instructions?: string } = {}
  ): Promise<T> {
    const schemaDescription = Object.entries(schema)
      .map(([key, desc]) => `- ${key}: ${desc}`)
      .join('\n');

    const systemPrompt = `Extract structured data from the given text according to this schema:
${schemaDescription}

${options.instructions || ''}

Respond with a JSON object matching the schema. Use null for fields that cannot be extracted.`;

    const response = await this.complete(text, {
      system: systemPrompt,
      model: options.model,
      temperature: 0,
      jsonMode: true,
    });

    return JSON.parse(response) as T;
  }

  /**
   * Summarize text
   */
  async summarize(
    text: string,
    options: {
      maxLength?: number;
      style?: 'brief' | 'detailed' | 'bullet';
      model?: string;
    } = {}
  ): Promise<string> {
    const styleInstructions = {
      brief: 'Provide a very concise summary in 1-2 sentences.',
      detailed: 'Provide a comprehensive summary covering all key points.',
      bullet: 'Provide a summary as bullet points.',
    };

    const systemPrompt = `Summarize the following text. ${styleInstructions[options.style || 'brief']}
${options.maxLength ? `Keep the summary under ${options.maxLength} characters.` : ''}`;

    return this.complete(text, {
      system: systemPrompt,
      model: options.model,
      temperature: 0.3,
    });
  }

  /**
   * Analyze sentiment
   */
  async analyzeSentiment(text: string, options: { model?: string } = {}): Promise<{
    score: number;
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
    aspects?: Array<{ aspect: string; sentiment: string }>;
  }> {
    const systemPrompt = `Analyze the sentiment of the given text.

Respond in JSON format:
{
  "score": <-1.0 to 1.0, where -1 is very negative and 1 is very positive>,
  "label": "<positive|negative|neutral|mixed>",
  "aspects": [{"aspect": "<topic>", "sentiment": "<positive|negative|neutral>"}]
}`;

    const response = await this.complete(text, {
      system: systemPrompt,
      model: options.model,
      temperature: 0.1,
      jsonMode: true,
    });

    return JSON.parse(response);
  }
}

/**
 * Create a LiteLLM client from environment
 */
export function createLiteLLMClient(env: {
  LITELLM_API_KEY?: string;
  LITELLM_BASE_URL?: string;
  LITELLM_DEFAULT_MODEL?: string;
}): LiteLLMClient {
  const baseUrl = env.LITELLM_BASE_URL || 'https://litellm.jfcreations.com';
  const apiKey = env.LITELLM_API_KEY;

  if (!apiKey) {
    throw new Error('LITELLM_API_KEY is required');
  }

  return new LiteLLMClient({
    baseUrl,
    apiKey,
    defaultModel: env.LITELLM_DEFAULT_MODEL,
  });
}
