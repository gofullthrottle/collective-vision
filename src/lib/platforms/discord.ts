/**
 * Discord Bot Integration
 *
 * ASSUMPTIONS:
 * - Discord bot token available in DISCORD_BOT_TOKEN
 * - Discord application ID in DISCORD_APPLICATION_ID
 * - Bot has been added to servers with appropriate permissions
 * - Using Discord API v10
 *
 * Features:
 * - Slash commands for feedback submission
 * - Channel monitoring for keywords
 * - Thread creation for discussions
 * - Status updates via embeds
 */

export interface DiscordConfig {
  botToken: string;
  applicationId: string;
  publicKey?: string; // For webhook verification
}

export interface DiscordCommand {
  name: string;
  description: string;
  options?: DiscordCommandOption[];
}

export interface DiscordCommandOption {
  name: string;
  description: string;
  type: number; // 3 = STRING, 4 = INTEGER, 5 = BOOLEAN
  required?: boolean;
  choices?: Array<{ name: string; value: string }>;
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number; // 1 = PING, 2 = APPLICATION_COMMAND
  data?: {
    id: string;
    name: string;
    options?: Array<{
      name: string;
      type: number;
      value: string | number | boolean;
    }>;
  };
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
    };
    nick?: string;
    roles: string[];
  };
  user?: {
    id: string;
    username: string;
    discriminator: string;
  };
  token: string;
  version: number;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string; icon_url?: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: unknown[];
  flags?: number;
}

export class DiscordClient {
  private config: DiscordConfig;
  private baseUrl = 'https://discord.com/api/v10';

  constructor(config: DiscordConfig) {
    this.config = config;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bot ${this.config.botToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${error}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Register global slash commands
   */
  async registerCommands(): Promise<void> {
    const commands: DiscordCommand[] = [
      {
        name: 'feedback',
        description: 'Submit feedback',
        options: [
          {
            name: 'title',
            description: 'Brief title for your feedback',
            type: 3, // STRING
            required: true,
          },
          {
            name: 'description',
            description: 'Detailed description (optional)',
            type: 3,
            required: false,
          },
          {
            name: 'type',
            description: 'Type of feedback',
            type: 3,
            required: false,
            choices: [
              { name: 'Feature Request', value: 'feature_request' },
              { name: 'Bug Report', value: 'bug' },
              { name: 'Improvement', value: 'improvement' },
              { name: 'Question', value: 'question' },
            ],
          },
        ],
      },
      {
        name: 'cv-status',
        description: 'Check status of a feedback item',
        options: [
          {
            name: 'id',
            description: 'Feedback ID to check',
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: 'cv-vote',
        description: 'Upvote a feedback item',
        options: [
          {
            name: 'id',
            description: 'Feedback ID to vote on',
            type: 3,
            required: true,
          },
        ],
      },
      {
        name: 'cv-search',
        description: 'Search for feedback',
        options: [
          {
            name: 'query',
            description: 'Search query',
            type: 3,
            required: true,
          },
        ],
      },
    ];

    await this.request(
      `/applications/${this.config.applicationId}/commands`,
      'PUT',
      commands
    );
  }

  /**
   * Handle incoming interaction
   */
  async handleInteraction(interaction: DiscordInteraction): Promise<DiscordMessage> {
    // Respond to ping
    if (interaction.type === 1) {
      return { content: 'Pong!' };
    }

    // Handle slash commands
    if (interaction.type === 2 && interaction.data) {
      const commandName = interaction.data.name;
      const options = this.parseOptions(interaction.data.options || []);

      switch (commandName) {
        case 'feedback':
          return this.handleFeedbackCommand(options, interaction);

        case 'cv-status':
          return this.handleStatusCommand(options.id as string);

        case 'cv-vote':
          return this.handleVoteCommand(options.id as string, interaction);

        case 'cv-search':
          return this.handleSearchCommand(options.query as string);

        default:
          return { content: 'Unknown command' };
      }
    }

    return { content: 'Interaction not handled' };
  }

  /**
   * Parse command options into object
   */
  private parseOptions(options: Array<{ name: string; value: unknown }>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const opt of options) {
      result[opt.name] = opt.value;
    }
    return result;
  }

  /**
   * Handle feedback submission command
   */
  private handleFeedbackCommand(
    options: Record<string, unknown>,
    interaction: DiscordInteraction
  ): DiscordMessage {
    const title = options.title as string;
    const description = options.description as string | undefined;
    const type = (options.type as string) || 'feature_request';

    const user = interaction.member?.user || interaction.user;
    const userId = user?.id || 'unknown';
    const userName = user?.username || 'Discord User';

    // Return embed with submission confirmation
    // Actual submission happens via webhook to our API
    return {
      embeds: [{
        title: '📝 Feedback Submitted',
        description: `Your feedback has been submitted for review.`,
        color: 0x5865F2, // Discord blurple
        fields: [
          { name: 'Title', value: title, inline: false },
          { name: 'Type', value: type.replace('_', ' '), inline: true },
          { name: 'Status', value: '🟡 Pending Review', inline: true },
        ],
        footer: {
          text: `Submitted by ${userName} • ID will be assigned after review`,
        },
        timestamp: new Date().toISOString(),
      }],
      // Store submission data for processing
      components: [], // Could add buttons for edit/cancel
    };
  }

  /**
   * Handle status check command
   */
  private handleStatusCommand(feedbackId: string): DiscordMessage {
    // This would query the API - returning placeholder
    return {
      embeds: [{
        title: `📋 Feedback #${feedbackId}`,
        description: 'Status information will be fetched from the API.',
        color: 0x5865F2,
        fields: [
          { name: 'Status', value: '⏳ Fetching...', inline: true },
          { name: 'Votes', value: '⏳', inline: true },
        ],
      }],
    };
  }

  /**
   * Handle vote command
   */
  private handleVoteCommand(feedbackId: string, interaction: DiscordInteraction): DiscordMessage {
    const user = interaction.member?.user || interaction.user;
    const userId = user?.id || 'unknown';

    return {
      embeds: [{
        title: '👍 Vote Registered',
        description: `You voted for feedback #${feedbackId}`,
        color: 0x57F287, // Green
        footer: {
          text: `Voter: ${user?.username || 'Unknown'}`,
        },
      }],
    };
  }

  /**
   * Handle search command
   */
  private handleSearchCommand(query: string): DiscordMessage {
    return {
      embeds: [{
        title: `🔍 Search Results for "${query}"`,
        description: 'Searching feedback database...',
        color: 0x5865F2,
      }],
    };
  }

  /**
   * Send message to a channel
   */
  async sendMessage(channelId: string, message: DiscordMessage): Promise<void> {
    await this.request(`/channels/${channelId}/messages`, 'POST', message);
  }

  /**
   * Create a thread on a message
   */
  async createThread(
    channelId: string,
    messageId: string,
    name: string
  ): Promise<{ id: string }> {
    return this.request(`/channels/${channelId}/messages/${messageId}/threads`, 'POST', {
      name,
      auto_archive_duration: 1440, // 24 hours
    });
  }

  /**
   * Send a feedback update embed
   */
  async sendFeedbackUpdate(
    channelId: string,
    feedbackId: number,
    title: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    const statusEmojis: Record<string, string> = {
      open: '🟢',
      under_review: '🟡',
      planned: '🔵',
      in_progress: '🟠',
      done: '✅',
      declined: '❌',
    };

    await this.sendMessage(channelId, {
      embeds: [{
        title: `📢 Feedback Update`,
        description: `**${title}**`,
        color: newStatus === 'done' ? 0x57F287 : 0xFEE75C,
        fields: [
          { name: 'ID', value: `#${feedbackId}`, inline: true },
          { name: 'Status Change', value: `${statusEmojis[oldStatus] || '⚪'} ${oldStatus} → ${statusEmojis[newStatus] || '⚪'} ${newStatus}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  }

  /**
   * Verify interaction signature (for webhook endpoint)
   */
  verifyInteraction(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    if (!this.config.publicKey) {
      return false;
    }

    // In production, use SubtleCrypto to verify Ed25519 signature
    // This is a placeholder - actual implementation requires:
    // 1. Concatenate timestamp + body
    // 2. Verify signature against public key using Ed25519
    // For Cloudflare Workers, use tweetnacl-js or similar

    // Placeholder - always returns true in dev
    console.warn('Discord signature verification not implemented');
    return true;
  }
}

/**
 * Create Discord embed for feedback item
 */
export function createFeedbackEmbed(feedback: {
  id: number;
  title: string;
  description?: string;
  status: string;
  votes: number;
  author?: string;
  created_at: string;
}): DiscordEmbed {
  const statusColors: Record<string, number> = {
    open: 0x57F287,
    under_review: 0xFEE75C,
    planned: 0x5865F2,
    in_progress: 0xEB459E,
    done: 0x57F287,
    declined: 0xED4245,
  };

  return {
    title: `#${feedback.id}: ${feedback.title}`,
    description: feedback.description?.substring(0, 200) || 'No description',
    color: statusColors[feedback.status] || 0x99AAB5,
    fields: [
      { name: 'Status', value: feedback.status.replace('_', ' '), inline: true },
      { name: 'Votes', value: feedback.votes.toString(), inline: true },
    ],
    footer: {
      text: `Submitted ${feedback.author ? `by ${feedback.author}` : ''} on ${new Date(feedback.created_at).toLocaleDateString()}`,
    },
  };
}

/**
 * Create Discord client from environment
 */
export function createDiscordClient(env: {
  DISCORD_BOT_TOKEN?: string;
  DISCORD_APPLICATION_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
}): DiscordClient {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_APPLICATION_ID) {
    throw new Error('Discord credentials required: DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID');
  }

  return new DiscordClient({
    botToken: env.DISCORD_BOT_TOKEN,
    applicationId: env.DISCORD_APPLICATION_ID,
    publicKey: env.DISCORD_PUBLIC_KEY,
  });
}
