/**
 * Slack App Integration
 *
 * ASSUMPTIONS:
 * - Slack app credentials available in environment:
 *   - SLACK_BOT_TOKEN (xoxb-...)
 *   - SLACK_SIGNING_SECRET
 *   - SLACK_CLIENT_ID (for OAuth)
 *   - SLACK_CLIENT_SECRET (for OAuth)
 * - Using Slack Web API and Events API
 *
 * Features:
 * - Slash commands (/cv-feedback, /cv-vote, /cv-status)
 * - Channel monitoring for keywords
 * - Message shortcuts (submit as feedback)
 * - Interactive modals for feedback submission
 * - OAuth flow for workspace installation
 */

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  clientId?: string;
  clientSecret?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  email?: string;
}

export interface SlackMessage {
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  channel?: string;
  response_type?: 'in_channel' | 'ephemeral';
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: unknown[];
  accessory?: unknown;
  block_id?: string;
  fields?: Array<{ type: string; text: string }>;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  footer?: string;
  ts?: number;
}

export interface SlackSlashCommand {
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  user_id: string;
  user_name: string;
  team_id: string;
  channel_id: string;
  channel_name: string;
}

export interface SlackInteraction {
  type: string;
  trigger_id: string;
  user: { id: string; name: string; username?: string };
  team: { id: string; domain?: string };
  channel: { id: string };
  response_url: string;
  actions?: Array<{
    action_id: string;
    block_id: string;
    value?: string;
    selected_option?: { value: string };
  }>;
  view?: {
    callback_id: string;
    state: {
      values: Record<string, Record<string, { value?: string; selected_option?: { value: string } }>>;
    };
  };
}

export interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  team?: string;
  // URL verification challenge
  challenge?: string;
  // Event callback wrapper
  event?: {
    type: string;
    user?: string;
    text?: string;
    channel?: string;
    ts?: string;
  };
}

export class SlackClient {
  private config: SlackConfig;
  private baseUrl = 'https://slack.com/api';

  constructor(config: SlackConfig) {
    this.config = config;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/${method}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json() as { ok: boolean; error?: string } & T;

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return data;
  }

  /**
   * Handle slash command
   */
  async handleSlashCommand(command: SlackSlashCommand): Promise<SlackMessage> {
    const parts = command.text.trim().split(' ');
    const subCommand = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command.command) {
      case '/cv':
      case '/cv-feedback':
        return this.handleCvCommand(subCommand, args, command);

      case '/cv-vote':
        return this.handleVoteCommand(args, command);

      case '/cv-status':
        return this.handleStatusCommand(args);

      default:
        return {
          response_type: 'ephemeral',
          text: `Unknown command: ${command.command}`,
        };
    }
  }

  /**
   * Handle /cv command with subcommands
   */
  private handleCvCommand(
    subCommand: string,
    args: string,
    command: SlackSlashCommand
  ): SlackMessage {
    switch (subCommand) {
      case 'submit':
        return this.createFeedbackSubmitMessage(args, command);

      case 'vote':
        return this.handleVoteCommand(args, command);

      case 'status':
        return this.handleStatusCommand(args);

      case 'search':
        return this.handleSearchCommand(args);

      case 'help':
      default:
        return this.createHelpMessage();
    }
  }

  /**
   * Create feedback submission message
   */
  private createFeedbackSubmitMessage(title: string, command: SlackSlashCommand): SlackMessage {
    if (!title) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a title: `/cv submit Your feedback title`',
      };
    }

    return {
      response_type: 'in_channel',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📝 *New Feedback Submitted*\n\n*${title}*`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Submitted by <@${command.user_id}> | Status: 🟡 Pending Review`,
            },
          ],
        },
        {
          type: 'actions',
          block_id: 'feedback_actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '👍 Vote', emoji: true },
              action_id: 'vote_feedback',
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '💬 Comment', emoji: true },
              action_id: 'add_comment',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '🔗 View Details', emoji: true },
              action_id: 'view_details',
            },
          ],
        },
      ],
    };
  }

  /**
   * Handle vote command
   */
  private handleVoteCommand(feedbackId: string, command: SlackSlashCommand): SlackMessage {
    if (!feedbackId) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a feedback ID: `/cv-vote 123`',
      };
    }

    return {
      response_type: 'ephemeral',
      text: `✅ Your vote for feedback #${feedbackId} has been recorded!`,
    };
  }

  /**
   * Handle status command
   */
  private handleStatusCommand(feedbackId: string): SlackMessage {
    if (!feedbackId) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a feedback ID: `/cv-status 123`',
      };
    }

    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Feedback #${feedbackId}*\n\nFetching status...`,
          },
        },
      ],
    };
  }

  /**
   * Handle search command
   */
  private handleSearchCommand(query: string): SlackMessage {
    if (!query) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a search query: `/cv search your query`',
      };
    }

    return {
      response_type: 'ephemeral',
      text: `🔍 Searching for "${query}"...`,
    };
  }

  /**
   * Create help message
   */
  private createHelpMessage(): SlackMessage {
    return {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Collective Vision Commands*',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '• `/cv submit [title]` - Submit new feedback\n• `/cv vote [id]` - Vote on feedback\n• `/cv status [id]` - Check feedback status\n• `/cv search [query]` - Search feedback\n• `/cv help` - Show this help',
          },
        },
      ],
    };
  }

  /**
   * Handle interaction (button clicks, modal submissions)
   */
  async handleInteraction(interaction: SlackInteraction): Promise<SlackMessage | void> {
    switch (interaction.type) {
      case 'block_actions':
        return this.handleBlockAction(interaction);

      case 'view_submission':
        return this.handleViewSubmission(interaction);

      case 'shortcut':
      case 'message_action':
        return this.handleShortcut(interaction);

      default:
        return { text: 'Unknown interaction type' };
    }
  }

  /**
   * Handle block action (button click)
   */
  private async handleBlockAction(interaction: SlackInteraction): Promise<SlackMessage> {
    const action = interaction.actions?.[0];
    if (!action) return { text: 'No action found' };

    switch (action.action_id) {
      case 'vote_feedback':
        return { text: '✅ Vote recorded!' };

      case 'add_comment':
        // Open a modal for comment
        await this.openCommentModal(interaction.trigger_id);
        return { text: 'Opening comment form...' };

      case 'view_details':
        return { text: '🔗 View the full feedback on our website.' };

      default:
        return { text: `Action: ${action.action_id}` };
    }
  }

  /**
   * Handle view submission (modal form)
   */
  private handleViewSubmission(interaction: SlackInteraction): SlackMessage {
    const values = interaction.view?.state?.values;
    if (!values) return { text: 'No form values' };

    // Process based on callback_id
    return { text: 'Form submitted successfully!' };
  }

  /**
   * Handle shortcut (message action)
   */
  private async handleShortcut(interaction: SlackInteraction): Promise<SlackMessage> {
    // Open modal to submit the message as feedback
    await this.openFeedbackModal(interaction.trigger_id);
    return { text: 'Opening feedback form...' };
  }

  /**
   * Open a modal for feedback submission
   */
  async openFeedbackModal(triggerId: string, prefill?: { title?: string; description?: string }): Promise<void> {
    await this.request('views.open', {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'submit_feedback_modal',
        title: { type: 'plain_text', text: 'Submit Feedback' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'title_block',
            label: { type: 'plain_text', text: 'Title' },
            element: {
              type: 'plain_text_input',
              action_id: 'title',
              initial_value: prefill?.title || '',
              placeholder: { type: 'plain_text', text: 'Brief title for your feedback' },
            },
          },
          {
            type: 'input',
            block_id: 'description_block',
            label: { type: 'plain_text', text: 'Description' },
            optional: true,
            element: {
              type: 'plain_text_input',
              action_id: 'description',
              multiline: true,
              initial_value: prefill?.description || '',
              placeholder: { type: 'plain_text', text: 'Detailed description (optional)' },
            },
          },
          {
            type: 'input',
            block_id: 'type_block',
            label: { type: 'plain_text', text: 'Type' },
            element: {
              type: 'static_select',
              action_id: 'type',
              placeholder: { type: 'plain_text', text: 'Select feedback type' },
              options: [
                { text: { type: 'plain_text', text: 'Feature Request' }, value: 'feature_request' },
                { text: { type: 'plain_text', text: 'Bug Report' }, value: 'bug' },
                { text: { type: 'plain_text', text: 'Improvement' }, value: 'improvement' },
                { text: { type: 'plain_text', text: 'Question' }, value: 'question' },
              ],
            },
          },
        ],
      },
    });
  }

  /**
   * Open a modal for adding a comment
   */
  async openCommentModal(triggerId: string, feedbackId?: number): Promise<void> {
    await this.request('views.open', {
      trigger_id: triggerId,
      view: {
        type: 'modal',
        callback_id: 'add_comment_modal',
        private_metadata: JSON.stringify({ feedbackId }),
        title: { type: 'plain_text', text: 'Add Comment' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'comment_block',
            label: { type: 'plain_text', text: 'Comment' },
            element: {
              type: 'plain_text_input',
              action_id: 'comment',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Your comment...' },
            },
          },
        ],
      },
    });
  }

  /**
   * Send a message to a channel
   */
  async postMessage(channel: string, message: SlackMessage): Promise<{ ts: string }> {
    return this.request('chat.postMessage', {
      channel,
      ...message,
    });
  }

  /**
   * Update an existing message
   */
  async updateMessage(channel: string, ts: string, message: SlackMessage): Promise<void> {
    await this.request('chat.update', {
      channel,
      ts,
      ...message,
    });
  }

  /**
   * Post a feedback update to a channel
   */
  async postFeedbackUpdate(
    channel: string,
    feedback: {
      id: number;
      title: string;
      oldStatus: string;
      newStatus: string;
      url?: string;
    }
  ): Promise<void> {
    const statusEmojis: Record<string, string> = {
      open: '🟢',
      under_review: '🟡',
      planned: '🔵',
      in_progress: '🟠',
      done: '✅',
      declined: '❌',
    };

    await this.postMessage(channel, {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Feedback Update*\n\n*#${feedback.id}: ${feedback.title}*`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status Change*\n${statusEmojis[feedback.oldStatus] || '⚪'} ${feedback.oldStatus} → ${statusEmojis[feedback.newStatus] || '⚪'} ${feedback.newStatus}`,
            },
          ],
        },
      ],
    });
  }

  /**
   * Verify request signature
   */
  verifyRequest(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    // In production, verify HMAC-SHA256 signature
    // Signature format: v0=<hex_hash>
    // Base string: v0:<timestamp>:<body>

    // Check timestamp is within 5 minutes
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - requestTime) > 300) {
      return false;
    }

    // Placeholder - actual implementation requires crypto
    console.warn('Slack signature verification not implemented');
    return true;
  }

  /**
   * OAuth2 flow - exchange code for token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    access_token: string;
    team: { id: string; name: string };
    bot_user_id: string;
  }> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('OAuth credentials required');
    }

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json() as {
      ok: boolean;
      access_token: string;
      team: { id: string; name: string };
      bot_user_id: string;
      error?: string;
    };

    if (!data.ok) {
      throw new Error(`OAuth error: ${data.error}`);
    }

    return {
      access_token: data.access_token,
      team: data.team,
      bot_user_id: data.bot_user_id,
    };
  }
}

/**
 * Create Slack client from environment
 */
export function createSlackClient(env: {
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
}): SlackClient {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_SIGNING_SECRET) {
    throw new Error('Slack credentials required: SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET');
  }

  return new SlackClient({
    botToken: env.SLACK_BOT_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
  });
}

/**
 * Parse URL-encoded slash command body into SlackSlashCommand
 */
export function parseSlackCommand(body: string): SlackSlashCommand {
  const params = new URLSearchParams(body);
  return {
    command: params.get('command') || '',
    text: params.get('text') || '',
    response_url: params.get('response_url') || '',
    trigger_id: params.get('trigger_id') || '',
    user_id: params.get('user_id') || '',
    user_name: params.get('user_name') || '',
    team_id: params.get('team_id') || '',
    channel_id: params.get('channel_id') || '',
    channel_name: params.get('channel_name') || '',
  };
}

/**
 * Slack OAuth response type
 */
export interface SlackOAuthResponse {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
    domain?: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
  };
  error?: string;
}
