/**
 * Brand Monitoring Crawler
 *
 * Orchestrates Firecrawl and LLM pain point detection
 * to automatically discover and process brand mentions.
 */

import { FirecrawlClient, ScrapedPage } from './client';
import { LiteLLMClient } from '../llm/client';
import { PainPointDetector, PainPointAnalysis, MentionContext } from '../llm/pain-point-detector';

export interface CrawlConfig {
  keywords: string[];
  excludeKeywords?: string[];
  domains?: string[];
  excludeDomains?: string[];
  limit?: number;
  lang?: string;
}

export interface DiscoveredMention {
  id: string;
  url: string;
  title: string;
  content: string;
  source: string;
  author?: string;
  discoveredAt: string;
  analysis?: PainPointAnalysis;
}

export interface CrawlResult {
  success: boolean;
  mentionsFound: number;
  actionableMentions: number;
  mentions: DiscoveredMention[];
  errors?: string[];
  crawlDuration: number;
}

export class BrandMonitoringCrawler {
  private firecrawl: FirecrawlClient;
  private detector: PainPointDetector;
  private productName: string;

  constructor(
    firecrawl: FirecrawlClient,
    llm: LiteLLMClient,
    options: {
      productName?: string;
      brandKeywords?: string[];
    } = {}
  ) {
    this.firecrawl = firecrawl;
    this.productName = options.productName || 'the product';
    this.detector = new PainPointDetector(llm, {
      productName: this.productName,
      brandKeywords: options.brandKeywords,
    });
  }

  /**
   * Run a brand monitoring crawl
   */
  async crawl(config: CrawlConfig): Promise<CrawlResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const mentions: DiscoveredMention[] = [];

    try {
      // Search for brand mentions
      const searchResults = await this.firecrawl.searchBrandMentions(
        config.keywords,
        {
          domains: config.domains,
          excludeDomains: config.excludeDomains,
          limit: config.limit || 20,
          lang: config.lang || 'en',
        }
      );

      // Filter out excluded keywords
      const filteredResults = config.excludeKeywords?.length
        ? searchResults.filter(r =>
            !config.excludeKeywords!.some(ek =>
              r.content.toLowerCase().includes(ek.toLowerCase())
            )
          )
        : searchResults;

      // Convert to MentionContext for analysis
      const mentionContexts: MentionContext[] = filteredResults.map(r => ({
        content: r.content,
        title: r.title,
        source: r.source,
        url: r.url,
      }));

      // Analyze with pain point detector
      const analyses = await this.detector.analyzeBatch(mentionContexts);

      // Build discovered mentions
      for (let i = 0; i < filteredResults.length; i++) {
        const result = filteredResults[i];
        const analysis = analyses[i];

        mentions.push({
          id: this.generateId(),
          url: result.url,
          title: result.title,
          content: result.content.substring(0, 5000), // Limit content size
          source: result.source,
          discoveredAt: new Date().toISOString(),
          analysis,
        });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error during crawl');
    }

    const actionableMentions = mentions.filter(m => m.analysis?.isActionable).length;

    return {
      success: errors.length === 0,
      mentionsFound: mentions.length,
      actionableMentions,
      mentions,
      errors: errors.length > 0 ? errors : undefined,
      crawlDuration: Date.now() - startTime,
    };
  }

  /**
   * Crawl specific platforms
   */
  async crawlPlatforms(
    platforms: Array<'reddit' | 'hackernews' | 'twitter'>,
    keywords: string[]
  ): Promise<CrawlResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const mentions: DiscoveredMention[] = [];

    for (const platform of platforms) {
      try {
        const pages = await this.firecrawl.crawlPlatform(platform, keywords);

        for (const page of pages) {
          const extractedMentions = this.extractMentionsFromPage(page, platform);

          // Analyze each mention
          for (const mention of extractedMentions) {
            const analysis = await this.detector.analyze(mention);

            mentions.push({
              id: this.generateId(),
              url: mention.url || page.metadata.sourceURL,
              title: mention.title || page.metadata.title || '',
              content: mention.content,
              source: platform,
              author: mention.author,
              discoveredAt: new Date().toISOString(),
              analysis,
            });
          }
        }
      } catch (error) {
        errors.push(`${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const actionableMentions = mentions.filter(m => m.analysis?.isActionable).length;

    return {
      success: errors.length === 0,
      mentionsFound: mentions.length,
      actionableMentions,
      mentions,
      errors: errors.length > 0 ? errors : undefined,
      crawlDuration: Date.now() - startTime,
    };
  }

  /**
   * Extract individual mentions from a scraped page
   */
  private extractMentionsFromPage(page: ScrapedPage, platform: string): MentionContext[] {
    const mentions: MentionContext[] = [];

    if (!page.markdown) {
      return mentions;
    }

    // Platform-specific extraction
    switch (platform) {
      case 'reddit':
        // Reddit posts/comments are separated by markdown headers and blocks
        const redditBlocks = page.markdown.split(/(?=^#+\s)/m);
        for (const block of redditBlocks) {
          if (block.trim().length > 50) {
            mentions.push({
              content: block.trim(),
              source: 'reddit',
              url: page.metadata.sourceURL,
            });
          }
        }
        break;

      case 'hackernews':
        // HN items are typically in a list format
        const hnItems = page.markdown.split(/(?=^\d+\.\s)/m);
        for (const item of hnItems) {
          if (item.trim().length > 30) {
            mentions.push({
              content: item.trim(),
              source: 'hackernews',
              url: page.metadata.sourceURL,
            });
          }
        }
        break;

      case 'twitter':
        // Tweets are typically short blocks
        const tweets = page.markdown.split(/\n{2,}/);
        for (const tweet of tweets) {
          if (tweet.trim().length > 20 && tweet.trim().length < 500) {
            mentions.push({
              content: tweet.trim(),
              source: 'twitter',
              url: page.metadata.sourceURL,
            });
          }
        }
        break;

      default:
        // Generic: treat whole page as one mention
        mentions.push({
          content: page.markdown,
          title: page.metadata.title,
          source: platform,
          url: page.metadata.sourceURL,
        });
    }

    return mentions;
  }

  /**
   * Convert actionable mentions to feedback items
   */
  async convertToFeedback(
    mentions: DiscoveredMention[]
  ): Promise<Array<{
    title: string;
    description: string;
    status: string;
    tags: string[];
    source: string;
    source_url: string;
    sentiment_score: number;
    relevance_score: number;
    metadata: Record<string, unknown>;
  }>> {
    const feedbackItems = [];

    for (const mention of mentions) {
      if (!mention.analysis?.isActionable) {
        continue;
      }

      const extracted = await this.detector.extractFeedback(
        {
          content: mention.content,
          title: mention.title,
          source: mention.source,
          author: mention.author,
          url: mention.url,
        },
        mention.analysis
      );

      feedbackItems.push({
        title: extracted.title,
        description: extracted.description,
        status: 'open',
        tags: extracted.tags,
        source: 'firecrawl',
        source_url: mention.url,
        sentiment_score: mention.analysis.sentiment.score,
        relevance_score: mention.analysis.confidence,
        metadata: {
          ai_category: mention.analysis.category,
          ai_confidence: mention.analysis.confidence,
          ai_reasoning: mention.analysis.reasoning,
          original_source: mention.source,
          original_author: mention.author,
          discovered_at: mention.discoveredAt,
        },
      });
    }

    return feedbackItems;
  }

  private generateId(): string {
    return `mention_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Quick search for brand mentions without full analysis
 */
export async function quickSearch(
  firecrawl: FirecrawlClient,
  keywords: string[],
  options: { limit?: number; domains?: string[] } = {}
): Promise<Array<{
  url: string;
  title: string;
  snippet: string;
  source: string;
}>> {
  const results = await firecrawl.searchBrandMentions(keywords, {
    limit: options.limit || 10,
    domains: options.domains,
  });

  return results.map(r => ({
    url: r.url,
    title: r.title,
    snippet: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    source: r.source,
  }));
}
