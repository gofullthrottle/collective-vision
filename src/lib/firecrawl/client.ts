/**
 * Firecrawl API Client
 *
 * ASSUMPTIONS:
 * - Firecrawl is available at https://firecrawl.jfcreations.com
 * - Uses standard Firecrawl v1 API endpoints
 * - API key is stored in env.FIRECRAWL_API_KEY
 * - Rate limiting is handled by the Firecrawl server
 *
 * Firecrawl API Reference: https://docs.firecrawl.dev/api-reference
 */

export interface FirecrawlConfig {
  baseUrl: string;
  apiKey: string;
}

export interface CrawlRequest {
  url: string;
  limit?: number;
  scrapeOptions?: {
    formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
    onlyMainContent?: boolean;
    includeTags?: string[];
    excludeTags?: string[];
    waitFor?: number;
  };
  maxDepth?: number;
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  ignoreSitemap?: boolean;
}

export interface ScrapeRequest {
  url: string;
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  timeout?: number;
}

export interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
  timeout?: number;
}

export interface SearchRequest {
  query: string;
  limit?: number;
  lang?: string;
  country?: string;
  scrapeOptions?: ScrapeOptions;
}

export interface CrawlResult {
  success: boolean;
  id?: string;
  url?: string;
  status?: 'scraping' | 'completed' | 'failed';
}

export interface CrawlStatusResult {
  success: boolean;
  status: 'scraping' | 'completed' | 'failed' | 'cancelled';
  completed: number;
  total: number;
  creditsUsed: number;
  expiresAt: string;
  data?: ScrapedPage[];
  next?: string;
}

export interface ScrapedPage {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  links?: string[];
  screenshot?: string;
  metadata: {
    title?: string;
    description?: string;
    language?: string;
    keywords?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogUrl?: string;
    ogImage?: string;
    ogLocaleAlternate?: string[];
    ogSiteName?: string;
    sourceURL: string;
    statusCode?: number;
  };
}

export interface SearchResult {
  success: boolean;
  data?: Array<{
    url: string;
    title: string;
    description: string;
    markdown?: string;
  }>;
}

export class FirecrawlClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: FirecrawlConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'DELETE' = 'GET',
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firecrawl API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Scrape a single URL
   */
  async scrape(request: ScrapeRequest): Promise<ScrapedPage> {
    const result = await this.request<{ success: boolean; data: ScrapedPage }>('/v1/scrape', 'POST', request);
    if (!result.success) {
      throw new Error('Scrape failed');
    }
    return result.data;
  }

  /**
   * Start a crawl job
   */
  async crawl(request: CrawlRequest): Promise<CrawlResult> {
    return this.request<CrawlResult>('/v1/crawl', 'POST', request);
  }

  /**
   * Check crawl status
   */
  async getCrawlStatus(crawlId: string): Promise<CrawlStatusResult> {
    return this.request<CrawlStatusResult>(`/v1/crawl/${crawlId}`);
  }

  /**
   * Cancel a crawl job
   */
  async cancelCrawl(crawlId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/v1/crawl/${crawlId}`, 'DELETE');
  }

  /**
   * Search the web and optionally scrape results
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    return this.request<SearchResult>('/v1/search', 'POST', request);
  }

  /**
   * Search for brand mentions across multiple sources
   */
  async searchBrandMentions(
    keywords: string[],
    options: {
      domains?: string[];
      excludeDomains?: string[];
      limit?: number;
      lang?: string;
    } = {}
  ): Promise<Array<{
    url: string;
    title: string;
    content: string;
    source: string;
    matchedKeyword: string;
  }>> {
    const results: Array<{
      url: string;
      title: string;
      content: string;
      source: string;
      matchedKeyword: string;
    }> = [];

    for (const keyword of keywords) {
      // Build search query with domain filters
      let query = keyword;
      if (options.domains?.length) {
        query += ' ' + options.domains.map(d => `site:${d}`).join(' OR ');
      }

      try {
        const searchResult = await this.search({
          query,
          limit: options.limit || 10,
          lang: options.lang || 'en',
          scrapeOptions: {
            formats: ['markdown'],
            onlyMainContent: true,
          },
        });

        if (searchResult.success && searchResult.data) {
          for (const item of searchResult.data) {
            // Skip excluded domains
            if (options.excludeDomains?.some(d => item.url.includes(d))) {
              continue;
            }

            // Extract domain as source
            const urlObj = new URL(item.url);
            const source = urlObj.hostname.replace('www.', '');

            results.push({
              url: item.url,
              title: item.title,
              content: item.markdown || item.description,
              source,
              matchedKeyword: keyword,
            });
          }
        }
      } catch (error) {
        console.error(`Error searching for keyword "${keyword}":`, error);
        // Continue with other keywords
      }
    }

    return results;
  }

  /**
   * Crawl specific platform for mentions
   */
  async crawlPlatform(
    platform: 'reddit' | 'hackernews' | 'twitter',
    keywords: string[],
    options: { limit?: number } = {}
  ): Promise<ScrapedPage[]> {
    const platformUrls: Record<string, string> = {
      reddit: 'https://www.reddit.com/search/?q=',
      hackernews: 'https://hn.algolia.com/?query=',
      twitter: 'https://twitter.com/search?q=',
    };

    const baseUrl = platformUrls[platform];
    if (!baseUrl) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const results: ScrapedPage[] = [];

    for (const keyword of keywords) {
      const searchUrl = `${baseUrl}${encodeURIComponent(keyword)}`;

      try {
        const scraped = await this.scrape({
          url: searchUrl,
          formats: ['markdown', 'links'],
          onlyMainContent: true,
          waitFor: 2000, // Wait for dynamic content
        });

        results.push(scraped);
      } catch (error) {
        console.error(`Error crawling ${platform} for "${keyword}":`, error);
      }
    }

    return results;
  }
}

/**
 * Create a Firecrawl client from environment
 */
export function createFirecrawlClient(env: { FIRECRAWL_API_KEY?: string; FIRECRAWL_BASE_URL?: string }): FirecrawlClient {
  const baseUrl = env.FIRECRAWL_BASE_URL || 'https://firecrawl.jfcreations.com';
  const apiKey = env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is required');
  }

  return new FirecrawlClient({ baseUrl, apiKey });
}
