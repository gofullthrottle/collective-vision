/**
 * Pain Point Detection using LLM
 *
 * Analyzes brand mentions to classify them and extract actionable feedback.
 * Uses LiteLLM for classification and extraction.
 */

import { LiteLLMClient } from './client';

export type MentionCategory =
  | 'complaint'      // User is unhappy about something
  | 'bug_report'     // User describing a problem/bug
  | 'feature_request' // User wanting something new
  | 'question'       // User needs help
  | 'positive'       // Praise or recommendation
  | 'unrelated';     // Not about the product

export interface PainPointAnalysis {
  category: MentionCategory;
  confidence: number;
  isActionable: boolean;
  extractedFeedback?: {
    title: string;
    description: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    suggestedTags: string[];
  };
  sentiment: {
    score: number;
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
  };
  reasoning: string;
}

export interface MentionContext {
  content: string;
  title?: string;
  source?: string;
  author?: string;
  url?: string;
}

export class PainPointDetector {
  private llm: LiteLLMClient;
  private brandKeywords: string[];
  private productName: string;

  constructor(
    llm: LiteLLMClient,
    options: {
      brandKeywords?: string[];
      productName?: string;
    } = {}
  ) {
    this.llm = llm;
    this.brandKeywords = options.brandKeywords || [];
    this.productName = options.productName || 'the product';
  }

  /**
   * Analyze a mention and detect pain points
   */
  async analyze(mention: MentionContext): Promise<PainPointAnalysis> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(mention);

    const response = await this.llm.complete(userPrompt, {
      system: systemPrompt,
      model: 'gpt-4o-mini', // Fast and cost-effective for classification
      temperature: 0.1,
      jsonMode: true,
    });

    try {
      const parsed = JSON.parse(response);
      return this.validateAndNormalize(parsed);
    } catch {
      // Fallback analysis
      return this.fallbackAnalysis(mention);
    }
  }

  /**
   * Batch analyze multiple mentions
   */
  async analyzeBatch(mentions: MentionContext[]): Promise<PainPointAnalysis[]> {
    // Process in parallel with concurrency limit
    const results: PainPointAnalysis[] = [];
    const batchSize = 5;

    for (let i = 0; i < mentions.length; i += batchSize) {
      const batch = mentions.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(m => this.analyze(m)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Filter mentions to only actionable pain points
   */
  async filterActionable(mentions: MentionContext[]): Promise<Array<{
    mention: MentionContext;
    analysis: PainPointAnalysis;
  }>> {
    const analyses = await this.analyzeBatch(mentions);

    return mentions
      .map((mention, i) => ({ mention, analysis: analyses[i] }))
      .filter(({ analysis }) => analysis.isActionable);
  }

  /**
   * Extract feedback from an actionable mention
   */
  async extractFeedback(mention: MentionContext, analysis: PainPointAnalysis): Promise<{
    title: string;
    description: string;
    status: string;
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    source_context: {
      original_content: string;
      source_url?: string;
      source_author?: string;
      ai_category: MentionCategory;
      ai_confidence: number;
    };
  }> {
    // If extraction already done in analysis, use it
    if (analysis.extractedFeedback) {
      return {
        title: analysis.extractedFeedback.title,
        description: analysis.extractedFeedback.description,
        status: 'open',
        tags: analysis.extractedFeedback.suggestedTags,
        priority: analysis.extractedFeedback.urgency,
        source_context: {
          original_content: mention.content,
          source_url: mention.url,
          source_author: mention.author,
          ai_category: analysis.category,
          ai_confidence: analysis.confidence,
        },
      };
    }

    // Otherwise, extract separately
    const extracted = await this.llm.extract<{
      title: string;
      description: string;
      urgency: string;
      tags: string[];
    }>(
      mention.content,
      {
        title: 'A concise title summarizing the core issue or request (max 100 chars)',
        description: 'A detailed description of the feedback, including context and specifics',
        urgency: 'The urgency level: low, medium, high, or critical',
        tags: 'Suggested tags for categorization (array of strings)',
      },
      {
        instructions: `This is a ${analysis.category} about ${this.productName}. Extract the actionable feedback.`,
      }
    );

    return {
      title: extracted.title || mention.title || 'Untitled Feedback',
      description: extracted.description || mention.content,
      status: 'open',
      tags: extracted.tags || [],
      priority: (extracted.urgency as 'low' | 'medium' | 'high' | 'critical') || 'medium',
      source_context: {
        original_content: mention.content,
        source_url: mention.url,
        source_author: mention.author,
        ai_category: analysis.category,
        ai_confidence: analysis.confidence,
      },
    };
  }

  private buildSystemPrompt(): string {
    return `You are an expert at analyzing user feedback and brand mentions to identify pain points and actionable feedback.

BRAND/PRODUCT: ${this.productName}
${this.brandKeywords.length ? `KEYWORDS: ${this.brandKeywords.join(', ')}` : ''}

Your task is to analyze mentions and classify them into one of these categories:
- complaint: User is expressing dissatisfaction or frustration
- bug_report: User is describing a technical problem or bug
- feature_request: User is requesting new functionality or improvements
- question: User is asking for help or clarification
- positive: User is expressing satisfaction, praise, or recommendation
- unrelated: The mention is not related to the product or brand

For actionable mentions (complaint, bug_report, feature_request), extract:
- A clear, concise title
- A detailed description
- Urgency level (low/medium/high/critical)
- Suggested tags for categorization

Respond in JSON format:
{
  "category": "<category>",
  "confidence": <0.0-1.0>,
  "isActionable": <true if complaint, bug_report, or feature_request>,
  "extractedFeedback": {
    "title": "<title>",
    "description": "<description>",
    "urgency": "<low|medium|high|critical>",
    "suggestedTags": ["<tag1>", "<tag2>"]
  },
  "sentiment": {
    "score": <-1.0 to 1.0>,
    "label": "<positive|negative|neutral|mixed>"
  },
  "reasoning": "<brief explanation of classification>"
}

For non-actionable mentions, extractedFeedback can be null.`;
  }

  private buildUserPrompt(mention: MentionContext): string {
    let prompt = 'Analyze this mention:\n\n';

    if (mention.title) {
      prompt += `TITLE: ${mention.title}\n`;
    }

    prompt += `CONTENT: ${mention.content}\n`;

    if (mention.source) {
      prompt += `SOURCE: ${mention.source}\n`;
    }

    if (mention.author) {
      prompt += `AUTHOR: ${mention.author}\n`;
    }

    return prompt;
  }

  private validateAndNormalize(parsed: unknown): PainPointAnalysis {
    const result = parsed as Record<string, unknown>;

    const category = this.validateCategory(result.category as string);
    const isActionable = ['complaint', 'bug_report', 'feature_request'].includes(category);

    return {
      category,
      confidence: this.clamp(result.confidence as number, 0, 1),
      isActionable,
      extractedFeedback: isActionable && result.extractedFeedback
        ? this.normalizeExtractedFeedback(result.extractedFeedback as Record<string, unknown>)
        : undefined,
      sentiment: this.normalizeSentiment(result.sentiment as Record<string, unknown>),
      reasoning: (result.reasoning as string) || 'No reasoning provided',
    };
  }

  private validateCategory(category: string): MentionCategory {
    const validCategories: MentionCategory[] = [
      'complaint', 'bug_report', 'feature_request', 'question', 'positive', 'unrelated'
    ];

    if (validCategories.includes(category as MentionCategory)) {
      return category as MentionCategory;
    }

    // Map common alternatives
    const categoryMap: Record<string, MentionCategory> = {
      'bug': 'bug_report',
      'feature': 'feature_request',
      'request': 'feature_request',
      'issue': 'bug_report',
      'problem': 'complaint',
      'praise': 'positive',
      'feedback': 'feature_request',
      'help': 'question',
    };

    return categoryMap[category.toLowerCase()] || 'unrelated';
  }

  private normalizeExtractedFeedback(feedback: Record<string, unknown>): {
    title: string;
    description: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    suggestedTags: string[];
  } {
    const urgencyMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical',
      'urgent': 'high',
      'severe': 'critical',
    };

    return {
      title: (feedback.title as string) || 'Untitled',
      description: (feedback.description as string) || '',
      urgency: urgencyMap[(feedback.urgency as string)?.toLowerCase()] || 'medium',
      suggestedTags: Array.isArray(feedback.suggestedTags)
        ? (feedback.suggestedTags as string[])
        : [],
    };
  }

  private normalizeSentiment(sentiment: Record<string, unknown> | undefined): {
    score: number;
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
  } {
    if (!sentiment) {
      return { score: 0, label: 'neutral' };
    }

    const labelMap: Record<string, 'positive' | 'negative' | 'neutral' | 'mixed'> = {
      'positive': 'positive',
      'negative': 'negative',
      'neutral': 'neutral',
      'mixed': 'mixed',
    };

    return {
      score: this.clamp(sentiment.score as number, -1, 1),
      label: labelMap[(sentiment.label as string)?.toLowerCase()] || 'neutral',
    };
  }

  private clamp(value: number, min: number, max: number): number {
    if (typeof value !== 'number' || isNaN(value)) {
      return (min + max) / 2;
    }
    return Math.max(min, Math.min(max, value));
  }

  private fallbackAnalysis(mention: MentionContext): PainPointAnalysis {
    // Simple keyword-based fallback
    const content = (mention.content + ' ' + (mention.title || '')).toLowerCase();

    let category: MentionCategory = 'unrelated';
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';

    // Check for category indicators
    const bugIndicators = ['bug', 'crash', 'error', 'broken', 'not working', 'fails', 'issue'];
    const featureIndicators = ['would be nice', 'please add', 'feature request', 'suggestion', 'wish', 'need'];
    const complaintIndicators = ['frustrated', 'disappointed', 'terrible', 'awful', 'hate', 'worst'];
    const positiveIndicators = ['love', 'great', 'awesome', 'amazing', 'excellent', 'best'];
    const questionIndicators = ['how do', 'how to', 'can i', 'is it possible', 'help', '?'];

    if (bugIndicators.some(i => content.includes(i))) {
      category = 'bug_report';
      sentiment = 'negative';
    } else if (featureIndicators.some(i => content.includes(i))) {
      category = 'feature_request';
      sentiment = 'neutral';
    } else if (complaintIndicators.some(i => content.includes(i))) {
      category = 'complaint';
      sentiment = 'negative';
    } else if (positiveIndicators.some(i => content.includes(i))) {
      category = 'positive';
      sentiment = 'positive';
    } else if (questionIndicators.some(i => content.includes(i))) {
      category = 'question';
      sentiment = 'neutral';
    }

    // Check if it mentions the brand
    const mentionsBrand = this.brandKeywords.some(kw => content.includes(kw.toLowerCase()));
    if (!mentionsBrand && category === 'unrelated') {
      // Likely unrelated
    }

    const isActionable = ['complaint', 'bug_report', 'feature_request'].includes(category);

    return {
      category,
      confidence: 0.4, // Low confidence for fallback
      isActionable,
      extractedFeedback: isActionable ? {
        title: mention.title || content.substring(0, 100),
        description: content,
        urgency: sentiment === 'negative' ? 'medium' : 'low',
        suggestedTags: [category],
      } : undefined,
      sentiment: {
        score: sentiment === 'positive' ? 0.5 : sentiment === 'negative' ? -0.5 : 0,
        label: sentiment,
      },
      reasoning: 'Fallback keyword-based analysis (LLM unavailable)',
    };
  }
}

/**
 * Create a pain point detector from environment
 */
export function createPainPointDetector(
  llm: LiteLLMClient,
  options: { brandKeywords?: string[]; productName?: string } = {}
): PainPointDetector {
  return new PainPointDetector(llm, options);
}
