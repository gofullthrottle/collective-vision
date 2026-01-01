/**
 * Reddit Integration
 *
 * ASSUMPTIONS:
 * - Reddit OAuth credentials available in environment:
 *   - REDDIT_CLIENT_ID
 *   - REDDIT_CLIENT_SECRET
 *   - REDDIT_REFRESH_TOKEN (for app-only access)
 * - Using Reddit OAuth2 API (https://oauth.reddit.com)
 * - Rate limit: 60 requests per minute
 *
 * Features:
 * - Subreddit monitoring
 * - Keyword search across Reddit
 * - Comment syncing for threads
 * - Post/comment creation (for engagement)
 */

export interface RedditConfig {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  userAgent: string;
}

export interface RedditToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expiresAt: number;
}

export interface RedditPost {
  id: string;
  name: string; // Full ID (t3_xxx)
  title: string;
  selftext: string;
  author: string;
  subreddit: string;
  subreddit_name_prefixed: string;
  url: string;
  permalink: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
  is_self: boolean;
  link_flair_text?: string;
}

export interface RedditComment {
  id: string;
  name: string; // Full ID (t1_xxx)
  body: string;
  author: string;
  subreddit: string;
  permalink: string;
  score: number;
  created_utc: number;
  parent_id: string;
  link_id: string;
  replies?: RedditComment[];
}

export interface RedditSearchResult {
  posts: RedditPost[];
  after?: string;
  before?: string;
}

export class RedditClient {
  private config: RedditConfig;
  private token: RedditToken | null = null;
  private baseUrl = 'https://oauth.reddit.com';
  private authUrl = 'https://www.reddit.com/api/v1/access_token';

  constructor(config: RedditConfig) {
    this.config = config;
  }

  /**
   * Get or refresh access token
   */
  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.access_token;
    }

    const credentials = btoa(`${this.config.clientId}:${this.config.clientSecret}`);

    const body = this.config.refreshToken
      ? `grant_type=refresh_token&refresh_token=${this.config.refreshToken}`
      : `grant_type=client_credentials`;

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.config.userAgent,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Reddit auth failed: ${response.status}`);
    }

    const data = await response.json() as RedditToken;
    this.token = {
      ...data,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // 1 min buffer
    };

    return this.token.access_token;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: Record<string, string>
  ): Promise<T> {
    const token = await this.getToken();

    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': this.config.userAgent,
      },
    };

    if (body) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      options.body = new URLSearchParams(body).toString();
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Search Reddit for posts matching a query
   */
  async search(
    query: string,
    options: {
      subreddit?: string;
      sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments';
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      after?: string;
    } = {}
  ): Promise<RedditSearchResult> {
    const params = new URLSearchParams({
      q: query,
      sort: options.sort || 'relevance',
      t: options.time || 'week',
      limit: String(options.limit || 25),
      restrict_sr: options.subreddit ? 'true' : 'false',
    });

    if (options.after) {
      params.set('after', options.after);
    }

    const endpoint = options.subreddit
      ? `/r/${options.subreddit}/search?${params}`
      : `/search?${params}`;

    const data = await this.request<{
      data: {
        children: Array<{ data: RedditPost }>;
        after?: string;
        before?: string;
      };
    }>(endpoint);

    return {
      posts: data.data.children.map(c => c.data),
      after: data.data.after,
      before: data.data.before,
    };
  }

  /**
   * Get posts from a subreddit
   */
  async getSubredditPosts(
    subreddit: string,
    options: {
      sort?: 'hot' | 'new' | 'top' | 'rising';
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
      after?: string;
    } = {}
  ): Promise<RedditSearchResult> {
    const params = new URLSearchParams({
      limit: String(options.limit || 25),
    });

    if (options.time && options.sort === 'top') {
      params.set('t', options.time);
    }

    if (options.after) {
      params.set('after', options.after);
    }

    const sort = options.sort || 'hot';
    const endpoint = `/r/${subreddit}/${sort}?${params}`;

    const data = await this.request<{
      data: {
        children: Array<{ data: RedditPost }>;
        after?: string;
        before?: string;
      };
    }>(endpoint);

    return {
      posts: data.data.children.map(c => c.data),
      after: data.data.after,
      before: data.data.before,
    };
  }

  /**
   * Get comments for a post
   */
  async getComments(
    subreddit: string,
    postId: string,
    options: {
      sort?: 'confidence' | 'top' | 'new' | 'controversial' | 'old' | 'qa';
      limit?: number;
      depth?: number;
    } = {}
  ): Promise<RedditComment[]> {
    const params = new URLSearchParams({
      sort: options.sort || 'top',
      limit: String(options.limit || 100),
      depth: String(options.depth || 5),
    });

    const endpoint = `/r/${subreddit}/comments/${postId}?${params}`;

    const data = await this.request<Array<{
      data: {
        children: Array<{ data: RedditComment }>;
      };
    }>>(endpoint);

    // First element is the post, second is comments
    if (data.length < 2) {
      return [];
    }

    return this.flattenComments(data[1].data.children.map(c => c.data));
  }

  /**
   * Flatten nested comment tree
   */
  private flattenComments(comments: RedditComment[]): RedditComment[] {
    const flat: RedditComment[] = [];

    const process = (comment: RedditComment) => {
      flat.push(comment);
      if (comment.replies && Array.isArray(comment.replies)) {
        for (const reply of comment.replies) {
          process(reply);
        }
      }
    };

    for (const comment of comments) {
      process(comment);
    }

    return flat;
  }

  /**
   * Monitor multiple subreddits for new posts
   */
  async monitorSubreddits(
    subreddits: string[],
    keywords: string[],
    options: { limit?: number } = {}
  ): Promise<RedditPost[]> {
    const relevantPosts: RedditPost[] = [];
    const keywordsLower = keywords.map(k => k.toLowerCase());

    for (const subreddit of subreddits) {
      try {
        const result = await this.getSubredditPosts(subreddit, {
          sort: 'new',
          limit: options.limit || 50,
        });

        // Filter posts that mention keywords
        for (const post of result.posts) {
          const text = (post.title + ' ' + post.selftext).toLowerCase();
          if (keywordsLower.some(kw => text.includes(kw))) {
            relevantPosts.push(post);
          }
        }
      } catch (error) {
        console.error(`Error monitoring r/${subreddit}:`, error);
      }
    }

    return relevantPosts;
  }

  /**
   * Search across all of Reddit for brand mentions
   */
  async searchBrandMentions(
    keywords: string[],
    options: {
      subreddits?: string[];
      time?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
      limit?: number;
    } = {}
  ): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];
    const seenIds = new Set<string>();

    for (const keyword of keywords) {
      try {
        // Search globally or in specific subreddits
        if (options.subreddits?.length) {
          for (const subreddit of options.subreddits) {
            const result = await this.search(keyword, {
              subreddit,
              time: options.time || 'week',
              limit: options.limit || 25,
            });

            for (const post of result.posts) {
              if (!seenIds.has(post.id)) {
                seenIds.add(post.id);
                allPosts.push(post);
              }
            }
          }
        } else {
          const result = await this.search(keyword, {
            time: options.time || 'week',
            limit: options.limit || 25,
          });

          for (const post of result.posts) {
            if (!seenIds.has(post.id)) {
              seenIds.add(post.id);
              allPosts.push(post);
            }
          }
        }
      } catch (error) {
        console.error(`Error searching for "${keyword}":`, error);
      }
    }

    return allPosts;
  }

  /**
   * Convert Reddit post to feedback-compatible format
   */
  postToFeedback(post: RedditPost): {
    title: string;
    description: string;
    source: string;
    source_url: string;
    source_id: string;
    source_author: string;
    source_subreddit: string;
    metadata: Record<string, unknown>;
  } {
    return {
      title: post.title.substring(0, 200),
      description: post.selftext || post.title,
      source: 'reddit',
      source_url: `https://reddit.com${post.permalink}`,
      source_id: post.id,
      source_author: post.author,
      source_subreddit: post.subreddit,
      metadata: {
        score: post.score,
        upvote_ratio: post.upvote_ratio,
        num_comments: post.num_comments,
        created_utc: post.created_utc,
        flair: post.link_flair_text,
      },
    };
  }
}

/**
 * Create Reddit client from environment
 */
export function createRedditClient(env: {
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  REDDIT_REFRESH_TOKEN?: string;
  REDDIT_USER_AGENT?: string;
}): RedditClient {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit credentials required: REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET');
  }

  return new RedditClient({
    clientId: env.REDDIT_CLIENT_ID,
    clientSecret: env.REDDIT_CLIENT_SECRET,
    refreshToken: env.REDDIT_REFRESH_TOKEN,
    userAgent: env.REDDIT_USER_AGENT || 'CollectiveVision/1.0 (Feedback Collection Bot)',
  });
}
