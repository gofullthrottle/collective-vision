/**
 * Platform Integration Routes
 *
 * Handles webhooks and interactions from:
 * - Discord (slash commands, interactions)
 * - Slack (events, slash commands, modals)
 * - Reddit (OAuth callback, webhook notifications)
 *
 * Routes:
 * - POST /api/v1/platforms/discord/interactions - Discord interaction webhook
 * - POST /api/v1/platforms/slack/events - Slack events API
 * - POST /api/v1/platforms/slack/commands - Slack slash commands
 * - POST /api/v1/platforms/slack/interactivity - Slack interactive components
 * - GET  /api/v1/platforms/slack/oauth - Slack OAuth callback
 * - GET  /api/v1/platforms/reddit/oauth - Reddit OAuth callback
 */

import type { Env } from '../worker';
import { createDiscordClient, DiscordClient, DiscordInteraction, createFeedbackEmbed } from '../lib/platforms/discord';
import { createSlackClient, SlackClient, parseSlackCommand, SlackInteraction, SlackEvent, SlackOAuthResponse } from '../lib/platforms/slack';
import { createRedditClient, RedditClient } from '../lib/platforms/reddit';

interface PlatformEnv extends Env {
  // Discord
  DISCORD_BOT_TOKEN?: string;
  DISCORD_APPLICATION_ID?: string;
  DISCORD_PUBLIC_KEY?: string;
  // Slack
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  SLACK_CLIENT_ID?: string;
  SLACK_CLIENT_SECRET?: string;
  // Reddit
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
  REDDIT_REFRESH_TOKEN?: string;
  REDDIT_USER_AGENT?: string;
  // App
  APP_URL?: string;
}

// Initialize clients lazily
let discordClient: DiscordClient | null = null;
let slackClient: SlackClient | null = null;
let redditClient: RedditClient | null = null;

function getDiscordClient(env: PlatformEnv): DiscordClient | null {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_APPLICATION_ID) return null;
  if (!discordClient) {
    discordClient = createDiscordClient({
      DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
      DISCORD_APPLICATION_ID: env.DISCORD_APPLICATION_ID,
      DISCORD_PUBLIC_KEY: env.DISCORD_PUBLIC_KEY,
    });
  }
  return discordClient;
}

function getSlackClient(env: PlatformEnv): SlackClient | null {
  if (!env.SLACK_BOT_TOKEN || !env.SLACK_SIGNING_SECRET) return null;
  if (!slackClient) {
    slackClient = createSlackClient({
      SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN,
      SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET,
      SLACK_CLIENT_ID: env.SLACK_CLIENT_ID,
      SLACK_CLIENT_SECRET: env.SLACK_CLIENT_SECRET,
    });
  }
  return slackClient;
}

function getRedditClient(env: PlatformEnv): RedditClient | null {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) return null;
  if (!redditClient) {
    redditClient = createRedditClient({
      REDDIT_CLIENT_ID: env.REDDIT_CLIENT_ID,
      REDDIT_CLIENT_SECRET: env.REDDIT_CLIENT_SECRET,
      REDDIT_REFRESH_TOKEN: env.REDDIT_REFRESH_TOKEN,
      REDDIT_USER_AGENT: env.REDDIT_USER_AGENT,
    });
  }
  return redditClient;
}

export async function handlePlatformRoutes(
  request: Request,
  pathname: string,
  env: PlatformEnv
): Promise<Response | null> {
  // Discord interactions
  if (pathname === '/api/v1/platforms/discord/interactions' && request.method === 'POST') {
    return handleDiscordInteraction(request, env);
  }

  // Slack routes
  if (pathname === '/api/v1/platforms/slack/events' && request.method === 'POST') {
    return handleSlackEvents(request, env);
  }

  if (pathname === '/api/v1/platforms/slack/commands' && request.method === 'POST') {
    return handleSlackCommands(request, env);
  }

  if (pathname === '/api/v1/platforms/slack/interactivity' && request.method === 'POST') {
    return handleSlackInteractivity(request, env);
  }

  if (pathname === '/api/v1/platforms/slack/oauth' && request.method === 'GET') {
    return handleSlackOAuth(request, env);
  }

  // Reddit OAuth callback
  if (pathname === '/api/v1/platforms/reddit/oauth' && request.method === 'GET') {
    return handleRedditOAuth(request, env);
  }

  // Platform status/health
  if (pathname === '/api/v1/platforms/status' && request.method === 'GET') {
    return handlePlatformStatus(env);
  }

  // Admin: Register Discord commands
  if (pathname === '/api/v1/platforms/discord/register-commands' && request.method === 'POST') {
    return handleDiscordRegisterCommands(request, env);
  }

  return null;
}

/**
 * Handle Discord interaction webhook
 */
async function handleDiscordInteraction(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  const client = getDiscordClient(env);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Discord not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify Discord signature
  const signature = request.headers.get('X-Signature-Ed25519') || '';
  const timestamp = request.headers.get('X-Signature-Timestamp') || '';
  const body = await request.text();

  if (!client.verifyInteraction(signature, timestamp, body)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const interaction = JSON.parse(body) as DiscordInteraction;

  // Handle ping (type 1)
  if (interaction.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle application commands (type 2)
  const message = await client.handleInteraction(interaction);

  // Process feedback submission in background
  if (interaction.data?.name === 'feedback' && interaction.type === 2) {
    await processDiscordFeedback(interaction, env);
  }

  // Respond with message
  return new Response(
    JSON.stringify({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: message,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Process Discord feedback submission
 */
async function processDiscordFeedback(
  interaction: DiscordInteraction,
  env: PlatformEnv
): Promise<void> {
  if (!interaction.data?.options) return;

  const options: Record<string, string> = {};
  for (const opt of interaction.data.options) {
    options[opt.name] = String(opt.value);
  }

  const user = interaction.member?.user || interaction.user;
  const workspaceSlug = interaction.guild_id || 'discord-default';

  // Get or create workspace
  let workspace = await env.DB.prepare(
    'SELECT id FROM workspaces WHERE slug = ?'
  ).bind(workspaceSlug).first();

  if (!workspace) {
    await env.DB.prepare(
      'INSERT INTO workspaces (slug, name, created_at) VALUES (?, ?, datetime("now"))'
    ).bind(workspaceSlug, `Discord: ${interaction.guild_id}`).run();
    workspace = await env.DB.prepare(
      'SELECT id FROM workspaces WHERE slug = ?'
    ).bind(workspaceSlug).first();
  }

  // Get or create board
  let board = await env.DB.prepare(
    'SELECT id FROM boards WHERE workspace_id = ? AND slug = ?'
  ).bind(workspace!.id, 'discord-feedback').first();

  if (!board) {
    await env.DB.prepare(
      'INSERT INTO boards (workspace_id, slug, name, is_public, created_at) VALUES (?, ?, ?, 1, datetime("now"))'
    ).bind(workspace!.id, 'discord-feedback', 'Discord Feedback').run();
    board = await env.DB.prepare(
      'SELECT id FROM boards WHERE workspace_id = ? AND slug = ?'
    ).bind(workspace!.id, 'discord-feedback').first();
  }

  // Get or create end user
  const externalUserId = `discord_${user?.id}`;
  let endUser = await env.DB.prepare(
    'SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?'
  ).bind(workspace!.id, externalUserId).first();

  if (!endUser) {
    await env.DB.prepare(
      'INSERT INTO end_users (workspace_id, external_user_id, name, created_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(workspace!.id, externalUserId, user?.username || 'Discord User').run();
    endUser = await env.DB.prepare(
      'SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?'
    ).bind(workspace!.id, externalUserId).first();
  }

  // Create feedback item
  await env.DB.prepare(`
    INSERT INTO feedback_items (
      board_id, user_id, title, description, status, source,
      moderation_state, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, 'open', 'discord', 'approved', 0, datetime('now'))
  `).bind(
    board!.id,
    endUser!.id,
    options.title || 'Discord Feedback',
    options.description || '',
  ).run();
}

/**
 * Handle Slack Events API
 */
async function handleSlackEvents(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  const client = getSlackClient(env);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Slack not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();

  // Verify signature
  const timestamp = request.headers.get('X-Slack-Request-Timestamp') || '';
  const signature = request.headers.get('X-Slack-Signature') || '';

  if (!client.verifyRequest(timestamp, body, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body) as SlackEvent;

  // Handle URL verification challenge
  if (event.type === 'url_verification') {
    return new Response(JSON.stringify({ challenge: event.challenge }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Process events asynchronously
  if (event.type === 'event_callback' && event.event) {
    // Handle app mentions, messages, etc.
    console.log(`[SLACK] Received event: ${event.event.type}`);
  }

  return new Response('ok', { status: 200 });
}

/**
 * Handle Slack slash commands
 */
async function handleSlackCommands(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  const client = getSlackClient(env);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Slack not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.text();

  // Verify signature
  const timestamp = request.headers.get('X-Slack-Request-Timestamp') || '';
  const signature = request.headers.get('X-Slack-Signature') || '';

  if (!client.verifyRequest(timestamp, body, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const command = parseSlackCommand(body);
  const response = await client.handleSlashCommand(command);

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handle Slack interactive components
 */
async function handleSlackInteractivity(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  const client = getSlackClient(env);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Slack not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const formData = await request.text();
  const params = new URLSearchParams(formData);
  const payloadStr = params.get('payload') || '{}';

  // Verify signature
  const timestamp = request.headers.get('X-Slack-Request-Timestamp') || '';
  const signature = request.headers.get('X-Slack-Signature') || '';

  if (!client.verifyRequest(timestamp, formData, signature)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(payloadStr) as SlackInteraction;
  const response = await client.handleInteraction(payload);

  // Modal submissions need different response handling
  if (payload.type === 'view_submission') {
    // Process feedback in background
    await processSlackFeedback(payload, env);
    return new Response('', { status: 200 }); // Close modal
  }

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Process Slack feedback submission
 */
async function processSlackFeedback(
  payload: SlackInteraction,
  env: PlatformEnv
): Promise<void> {
  if (!payload.view?.state?.values) return;

  const values = payload.view.state.values;
  const title = values.title_block?.title_input?.value || '';
  const description = values.description_block?.description_input?.value || '';
  const type = values.type_block?.type_select?.selected_option?.value || 'feature_request';

  const workspaceSlug = `slack_${payload.team?.id || 'default'}`;
  const userId = payload.user?.id;
  const userName = payload.user?.name || payload.user?.username || 'Slack User';

  // Get or create workspace
  let workspace = await env.DB.prepare(
    'SELECT id FROM workspaces WHERE slug = ?'
  ).bind(workspaceSlug).first();

  if (!workspace) {
    await env.DB.prepare(
      'INSERT INTO workspaces (slug, name, created_at) VALUES (?, ?, datetime("now"))'
    ).bind(workspaceSlug, `Slack: ${payload.team?.domain || workspaceSlug}`).run();
    workspace = await env.DB.prepare(
      'SELECT id FROM workspaces WHERE slug = ?'
    ).bind(workspaceSlug).first();
  }

  // Get or create board
  let board = await env.DB.prepare(
    'SELECT id FROM boards WHERE workspace_id = ? AND slug = ?'
  ).bind(workspace!.id, 'slack-feedback').first();

  if (!board) {
    await env.DB.prepare(
      'INSERT INTO boards (workspace_id, slug, name, is_public, created_at) VALUES (?, ?, ?, 1, datetime("now"))'
    ).bind(workspace!.id, 'slack-feedback', 'Slack Feedback').run();
    board = await env.DB.prepare(
      'SELECT id FROM boards WHERE workspace_id = ? AND slug = ?'
    ).bind(workspace!.id, 'slack-feedback').first();
  }

  // Get or create end user
  const externalUserId = `slack_${userId}`;
  let endUser = await env.DB.prepare(
    'SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?'
  ).bind(workspace!.id, externalUserId).first();

  if (!endUser) {
    await env.DB.prepare(
      'INSERT INTO end_users (workspace_id, external_user_id, name, created_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(workspace!.id, externalUserId, userName).run();
    endUser = await env.DB.prepare(
      'SELECT id FROM end_users WHERE workspace_id = ? AND external_user_id = ?'
    ).bind(workspace!.id, externalUserId).first();
  }

  // Create feedback item
  await env.DB.prepare(`
    INSERT INTO feedback_items (
      board_id, user_id, title, description, status, source,
      moderation_state, is_hidden, created_at
    ) VALUES (?, ?, ?, ?, 'open', 'slack', 'approved', 0, datetime('now'))
  `).bind(
    board!.id,
    endUser!.id,
    title,
    description,
  ).run();
}

/**
 * Handle Slack OAuth callback
 */
async function handleSlackOAuth(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    return new Response('Slack OAuth not configured', { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  // Exchange code for token
  const redirectUri = `${env.APP_URL || url.origin}/api/v1/platforms/slack/oauth`;

  const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const tokenData = (await tokenResponse.json()) as SlackOAuthResponse;

  if (!tokenData.ok) {
    return new Response(`OAuth failed: ${tokenData.error}`, { status: 400 });
  }

  // Store the installation
  await env.DB.prepare(`
    INSERT OR REPLACE INTO platform_installations (
      platform, team_id, team_name, access_token, bot_user_id,
      scope, created_at, updated_at
    ) VALUES ('slack', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    tokenData.team?.id,
    tokenData.team?.name,
    tokenData.access_token,
    tokenData.bot_user_id,
    tokenData.scope,
  ).run();

  // Redirect to success page
  return Response.redirect(`${env.APP_URL || url.origin}/integrations/slack/success`, 302);
}

/**
 * Handle Reddit OAuth callback
 */
async function handleRedditOAuth(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  // Reddit OAuth is typically handled during initial setup
  // This callback would receive the refresh token
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Reddit OAuth error: ${error}`, { status: 400 });
  }

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    return new Response('Reddit not configured', { status: 503 });
  }

  // Exchange code for tokens
  const redirectUri = `${env.APP_URL || url.origin}/api/v1/platforms/reddit/oauth`;
  const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);

  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': env.REDDIT_USER_AGENT || 'CollectiveVision/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const tokenData = await tokenResponse.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };

  // Store the installation
  await env.DB.prepare(`
    INSERT OR REPLACE INTO platform_installations (
      platform, team_id, access_token, refresh_token, scope,
      created_at, updated_at
    ) VALUES ('reddit', ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    state || 'default',
    tokenData.access_token,
    tokenData.refresh_token,
    tokenData.scope,
  ).run();

  return Response.redirect(`${env.APP_URL || url.origin}/integrations/reddit/success`, 302);
}

/**
 * Get platform connection status
 */
async function handlePlatformStatus(env: PlatformEnv): Promise<Response> {
  const status = {
    discord: {
      configured: !!(env.DISCORD_BOT_TOKEN && env.DISCORD_APPLICATION_ID),
      commandsRegistered: false,
    },
    slack: {
      configured: !!(env.SLACK_BOT_TOKEN && env.SLACK_SIGNING_SECRET),
      oauthEnabled: !!(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET),
      installations: 0,
    },
    reddit: {
      configured: !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET),
      hasRefreshToken: !!env.REDDIT_REFRESH_TOKEN,
    },
  };

  // Count Slack installations
  if (status.slack.configured) {
    const result = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM platform_installations WHERE platform = 'slack'"
    ).first();
    status.slack.installations = (result?.count as number) || 0;
  }

  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Register Discord slash commands (admin only)
 */
async function handleDiscordRegisterCommands(
  request: Request,
  env: PlatformEnv
): Promise<Response> {
  // Check admin token
  const adminToken = request.headers.get('X-Admin-Token');
  if (!adminToken || adminToken !== env.ADMIN_API_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = getDiscordClient(env);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Discord not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await client.registerCommands();
    return new Response(JSON.stringify({ success: true, message: 'Commands registered' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to register commands',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
