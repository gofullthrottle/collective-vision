/**
 * External Sources Routes
 * Brand monitoring, external sources, and multi-channel listeners
 */

import type { Env } from '../worker';

// Supported source types
const SOURCE_TYPES = ['reddit', 'discord', 'slack', 'twitter', 'github', 'intercom'] as const;
const LISTENER_TYPES = ['discord_webhook', 'slack_app', 'email_inbox', 'sentry', 'ga', 'custom_webhook'] as const;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

async function verifyAdmin(request: Request, env: Env): Promise<{ userId: number; workspaceId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  const session = await env.DB
    .prepare(`
      SELECT s.user_id, wu.workspace_id
      FROM sessions s
      JOIN workspace_users wu ON wu.user_id = s.user_id
      WHERE s.token = ?
        AND s.expires_at > datetime('now')
        AND wu.role IN ('owner', 'admin')
      LIMIT 1
    `)
    .bind(token)
    .first<{ user_id: number; workspace_id: number }>();

  return session ? { userId: session.user_id, workspaceId: session.workspace_id } : null;
}

// ============================================================================
// Epic 5.3: Brand Mention Monitoring
// ============================================================================

/**
 * List brand keywords
 */
async function listBrandKeywords(env: Env, workspaceId: number): Promise<Response> {
  const keywords = await env.DB
    .prepare(`
      SELECT id, keyword, keyword_type, is_active, match_count, created_at
      FROM brand_keywords
      WHERE workspace_id = ?
      ORDER BY match_count DESC, created_at DESC
    `)
    .bind(workspaceId)
    .all<{ id: number; keyword: string; keyword_type: string; is_active: number; match_count: number; created_at: string }>();

  return jsonResponse({ keywords: keywords.results });
}

/**
 * Add brand keyword
 */
async function addBrandKeyword(
  env: Env,
  workspaceId: number,
  body: { keyword: string; keyword_type?: string }
): Promise<Response> {
  const keyword = body.keyword.trim().toLowerCase();
  if (keyword.length < 2) {
    return errorResponse(400, 'Keyword must be at least 2 characters');
  }

  const keywordType = body.keyword_type || 'brand';
  if (!['brand', 'product', 'competitor'].includes(keywordType)) {
    return errorResponse(400, 'Invalid keyword type');
  }

  // Check for duplicate
  const existing = await env.DB
    .prepare('SELECT id FROM brand_keywords WHERE workspace_id = ? AND keyword = ?')
    .bind(workspaceId, keyword)
    .first<{ id: number }>();

  if (existing) {
    return errorResponse(409, 'Keyword already exists');
  }

  const result = await env.DB
    .prepare(`
      INSERT INTO brand_keywords (workspace_id, keyword, keyword_type, is_active, created_at)
      VALUES (?, ?, ?, 1, datetime('now'))
      RETURNING id, created_at
    `)
    .bind(workspaceId, keyword, keywordType)
    .first<{ id: number; created_at: string }>();

  return jsonResponse({
    id: result?.id,
    keyword,
    keyword_type: keywordType,
    is_active: true,
    created_at: result?.created_at,
  }, 201);
}

/**
 * Delete brand keyword
 */
async function deleteBrandKeyword(env: Env, workspaceId: number, keywordId: number): Promise<Response> {
  const result = await env.DB
    .prepare('DELETE FROM brand_keywords WHERE id = ? AND workspace_id = ?')
    .bind(keywordId, workspaceId)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Keyword not found');
  }

  return new Response(null, { status: 204 });
}

/**
 * List brand mentions
 */
async function listBrandMentions(
  env: Env,
  workspaceId: number,
  params: URLSearchParams
): Promise<Response> {
  const status = params.get('status') || 'new';
  const sourceType = params.get('source_type');
  const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100);
  const offset = parseInt(params.get('offset') || '0', 10);

  let query = `
    SELECT id, source_type, source_url, source_author, title, content,
           sentiment_score, relevance_score, status, discovered_at
    FROM brand_mentions
    WHERE workspace_id = ?
  `;
  const queryParams: unknown[] = [workspaceId];

  if (status !== 'all') {
    query += ' AND status = ?';
    queryParams.push(status);
  }

  if (sourceType) {
    query += ' AND source_type = ?';
    queryParams.push(sourceType);
  }

  query += ' ORDER BY discovered_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const mentions = await env.DB
    .prepare(query)
    .bind(...queryParams)
    .all<{
      id: number;
      source_type: string;
      source_url: string | null;
      source_author: string | null;
      title: string | null;
      content: string;
      sentiment_score: number | null;
      relevance_score: number | null;
      status: string;
      discovered_at: string;
    }>();

  const countQuery = `
    SELECT COUNT(*) as count FROM brand_mentions WHERE workspace_id = ?
    ${status !== 'all' ? ' AND status = ?' : ''}
    ${sourceType ? ' AND source_type = ?' : ''}
  `;
  const countParams: (number | string)[] = [workspaceId];
  if (status !== 'all') countParams.push(status);
  if (sourceType) countParams.push(sourceType);

  const count = await env.DB
    .prepare(countQuery)
    .bind(...countParams)
    .first<{ count: number }>();

  return jsonResponse({
    mentions: mentions.results,
    total: count?.count || 0,
    limit,
    offset,
  });
}

/**
 * Update mention status
 */
async function updateMentionStatus(
  env: Env,
  workspaceId: number,
  userId: number,
  mentionId: number,
  body: { status: string }
): Promise<Response> {
  if (!['reviewed', 'converted', 'ignored'].includes(body.status)) {
    return errorResponse(400, 'Invalid status');
  }

  const result = await env.DB
    .prepare(`
      UPDATE brand_mentions
      SET status = ?, reviewed_at = datetime('now'), reviewed_by = ?
      WHERE id = ? AND workspace_id = ?
    `)
    .bind(body.status, userId, mentionId, workspaceId)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Mention not found');
  }

  return jsonResponse({ id: mentionId, status: body.status });
}

/**
 * Convert mention to feedback
 */
async function convertMentionToFeedback(
  env: Env,
  workspaceId: number,
  userId: number,
  mentionId: number,
  body: { board_slug: string; title?: string }
): Promise<Response> {
  const mention = await env.DB
    .prepare('SELECT * FROM brand_mentions WHERE id = ? AND workspace_id = ?')
    .bind(mentionId, workspaceId)
    .first<{
      id: number;
      source_type: string;
      source_url: string | null;
      title: string | null;
      content: string;
    }>();

  if (!mention) {
    return errorResponse(404, 'Mention not found');
  }

  // Get board
  const board = await env.DB
    .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
    .bind(body.board_slug, workspaceId)
    .first<{ id: number }>();

  if (!board) {
    return errorResponse(404, 'Board not found');
  }

  // Create feedback
  const title = body.title || mention.title || mention.content.slice(0, 160);
  const feedback = await env.DB
    .prepare(`
      INSERT INTO feedback_items (
        board_id, title, description, status, moderation_state, is_hidden,
        source, source_url, source_metadata, created_at, updated_at
      ) VALUES (?, ?, ?, 'open', 'approved', 0, 'mention', ?, ?, datetime('now'), datetime('now'))
      RETURNING id, created_at
    `)
    .bind(
      board.id,
      title,
      mention.content,
      mention.source_url,
      JSON.stringify({ mention_id: mentionId, source_type: mention.source_type })
    )
    .first<{ id: number; created_at: string }>();

  // Update mention
  await env.DB
    .prepare(`
      UPDATE brand_mentions
      SET status = 'converted', feedback_id = ?, reviewed_at = datetime('now'), reviewed_by = ?
      WHERE id = ?
    `)
    .bind(feedback?.id, userId, mentionId)
    .run();

  return jsonResponse({
    mention_id: mentionId,
    feedback_id: feedback?.id,
    title,
    message: 'Mention converted to feedback',
  });
}

/**
 * Get mention stats
 */
async function getMentionStats(env: Env, workspaceId: number): Promise<Response> {
  const stats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_count,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_count,
        COUNT(CASE WHEN discovered_at >= datetime('now', '-24 hours') THEN 1 END) as last_24h
      FROM brand_mentions
      WHERE workspace_id = ?
    `)
    .bind(workspaceId)
    .first<{ total: number; new_count: number; converted_count: number; last_24h: number }>();

  const bySource = await env.DB
    .prepare(`
      SELECT source_type, COUNT(*) as count
      FROM brand_mentions
      WHERE workspace_id = ?
      GROUP BY source_type
    `)
    .bind(workspaceId)
    .all<{ source_type: string; count: number }>();

  return jsonResponse({
    total: stats?.total || 0,
    new: stats?.new_count || 0,
    converted: stats?.converted_count || 0,
    last_24h: stats?.last_24h || 0,
    by_source: Object.fromEntries(bySource.results.map(s => [s.source_type, s.count])),
  });
}

// ============================================================================
// Epic 5.4: Multi-Channel Listeners
// ============================================================================

/**
 * List external sources
 */
async function listExternalSources(env: Env, workspaceId: number): Promise<Response> {
  const sources = await env.DB
    .prepare(`
      SELECT id, source_type, name, is_active, sync_frequency,
             last_sync_at, last_sync_status, items_synced_total, created_at
      FROM external_sources
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `)
    .bind(workspaceId)
    .all<{
      id: number;
      source_type: string;
      name: string;
      is_active: number;
      sync_frequency: string;
      last_sync_at: string | null;
      last_sync_status: string | null;
      items_synced_total: number;
      created_at: string;
    }>();

  return jsonResponse({ sources: sources.results });
}

/**
 * Create external source
 */
async function createExternalSource(
  env: Env,
  workspaceId: number,
  body: { source_type: string; name: string; config: Record<string, unknown>; sync_frequency?: string }
): Promise<Response> {
  if (!SOURCE_TYPES.includes(body.source_type as typeof SOURCE_TYPES[number])) {
    return errorResponse(400, `Invalid source type. Supported: ${SOURCE_TYPES.join(', ')}`);
  }

  const syncFrequency = body.sync_frequency || 'hourly';
  if (!['realtime', 'hourly', 'daily'].includes(syncFrequency)) {
    return errorResponse(400, 'Invalid sync frequency');
  }

  const result = await env.DB
    .prepare(`
      INSERT INTO external_sources (workspace_id, source_type, name, config, sync_frequency, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING id, created_at
    `)
    .bind(workspaceId, body.source_type, body.name, JSON.stringify(body.config), syncFrequency)
    .first<{ id: number; created_at: string }>();

  return jsonResponse({
    id: result?.id,
    source_type: body.source_type,
    name: body.name,
    sync_frequency: syncFrequency,
    is_active: true,
    created_at: result?.created_at,
  }, 201);
}

/**
 * Update external source
 */
async function updateExternalSource(
  env: Env,
  workspaceId: number,
  sourceId: number,
  body: { name?: string; config?: Record<string, unknown>; sync_frequency?: string; is_active?: boolean }
): Promise<Response> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    params.push(body.name);
  }
  if (body.config !== undefined) {
    updates.push('config = ?');
    params.push(JSON.stringify(body.config));
  }
  if (body.sync_frequency !== undefined) {
    updates.push('sync_frequency = ?');
    params.push(body.sync_frequency);
  }
  if (body.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(body.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'No updates provided');
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(sourceId, workspaceId);

  const result = await env.DB
    .prepare(`UPDATE external_sources SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`)
    .bind(...params)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Source not found');
  }

  return jsonResponse({ id: sourceId, updated: true });
}

/**
 * Delete external source
 */
async function deleteExternalSource(env: Env, workspaceId: number, sourceId: number): Promise<Response> {
  const result = await env.DB
    .prepare('DELETE FROM external_sources WHERE id = ? AND workspace_id = ?')
    .bind(sourceId, workspaceId)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Source not found');
  }

  return new Response(null, { status: 204 });
}

/**
 * List listeners
 */
async function listListeners(env: Env, workspaceId: number): Promise<Response> {
  const listeners = await env.DB
    .prepare(`
      SELECT l.id, l.name, l.listener_type, l.is_active, l.events_received,
             l.events_processed, l.last_event_at, l.created_at,
             b.slug as target_board_slug
      FROM listener_configs l
      LEFT JOIN boards b ON b.id = l.target_board_id
      WHERE l.workspace_id = ?
      ORDER BY l.created_at DESC
    `)
    .bind(workspaceId)
    .all<{
      id: number;
      name: string;
      listener_type: string;
      is_active: number;
      events_received: number;
      events_processed: number;
      last_event_at: string | null;
      created_at: string;
      target_board_slug: string | null;
    }>();

  return jsonResponse({ listeners: listeners.results });
}

/**
 * Create listener
 */
async function createListener(
  env: Env,
  workspaceId: number,
  body: {
    name: string;
    listener_type: string;
    config: Record<string, unknown>;
    target_board_slug?: string;
    auto_approve?: boolean;
    filter_rules?: Record<string, unknown>;
  }
): Promise<Response> {
  if (!LISTENER_TYPES.includes(body.listener_type as typeof LISTENER_TYPES[number])) {
    return errorResponse(400, `Invalid listener type. Supported: ${LISTENER_TYPES.join(', ')}`);
  }

  let targetBoardId: number | null = null;
  if (body.target_board_slug) {
    const board = await env.DB
      .prepare('SELECT id FROM boards WHERE slug = ? AND workspace_id = ?')
      .bind(body.target_board_slug, workspaceId)
      .first<{ id: number }>();

    if (!board) {
      return errorResponse(404, 'Target board not found');
    }
    targetBoardId = board.id;
  }

  // Generate webhook URL if needed
  const webhookToken = crypto.randomUUID();
  const config = {
    ...body.config,
    webhook_token: webhookToken,
  };

  const result = await env.DB
    .prepare(`
      INSERT INTO listener_configs (
        workspace_id, name, listener_type, config, target_board_id,
        auto_approve, filter_rules, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      RETURNING id, created_at
    `)
    .bind(
      workspaceId,
      body.name,
      body.listener_type,
      JSON.stringify(config),
      targetBoardId,
      body.auto_approve ? 1 : 0,
      body.filter_rules ? JSON.stringify(body.filter_rules) : null
    )
    .first<{ id: number; created_at: string }>();

  return jsonResponse({
    id: result?.id,
    name: body.name,
    listener_type: body.listener_type,
    webhook_url: `/api/v1/listen/${webhookToken}`,
    webhook_token: webhookToken,
    is_active: true,
    created_at: result?.created_at,
  }, 201);
}

/**
 * Get listener details
 */
async function getListener(env: Env, workspaceId: number, listenerId: number): Promise<Response> {
  const listener = await env.DB
    .prepare(`
      SELECT l.*, b.slug as target_board_slug
      FROM listener_configs l
      LEFT JOIN boards b ON b.id = l.target_board_id
      WHERE l.id = ? AND l.workspace_id = ?
    `)
    .bind(listenerId, workspaceId)
    .first<{
      id: number;
      name: string;
      listener_type: string;
      config: string;
      target_board_slug: string | null;
      auto_approve: number;
      filter_rules: string | null;
      is_active: number;
      events_received: number;
      events_processed: number;
      last_event_at: string | null;
      created_at: string;
    }>();

  if (!listener) {
    return errorResponse(404, 'Listener not found');
  }

  // Get recent events
  const recentEvents = await env.DB
    .prepare(`
      SELECT id, event_type, status, received_at, processed_at
      FROM listener_events
      WHERE listener_id = ?
      ORDER BY received_at DESC
      LIMIT 10
    `)
    .bind(listenerId)
    .all<{ id: number; event_type: string; status: string; received_at: string; processed_at: string | null }>();

  return jsonResponse({
    ...listener,
    config: JSON.parse(listener.config),
    filter_rules: listener.filter_rules ? JSON.parse(listener.filter_rules) : null,
    recent_events: recentEvents.results,
  });
}

/**
 * Update listener
 */
async function updateListener(
  env: Env,
  workspaceId: number,
  listenerId: number,
  body: { name?: string; config?: Record<string, unknown>; is_active?: boolean; auto_approve?: boolean }
): Promise<Response> {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    params.push(body.name);
  }
  if (body.config !== undefined) {
    updates.push('config = ?');
    params.push(JSON.stringify(body.config));
  }
  if (body.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(body.is_active ? 1 : 0);
  }
  if (body.auto_approve !== undefined) {
    updates.push('auto_approve = ?');
    params.push(body.auto_approve ? 1 : 0);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'No updates provided');
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(listenerId, workspaceId);

  const result = await env.DB
    .prepare(`UPDATE listener_configs SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`)
    .bind(...params)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Listener not found');
  }

  return jsonResponse({ id: listenerId, updated: true });
}

/**
 * Delete listener
 */
async function deleteListener(env: Env, workspaceId: number, listenerId: number): Promise<Response> {
  const result = await env.DB
    .prepare('DELETE FROM listener_configs WHERE id = ? AND workspace_id = ?')
    .bind(listenerId, workspaceId)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Listener not found');
  }

  return new Response(null, { status: 204 });
}

/**
 * Handle incoming webhook event
 */
export async function handleListenerWebhook(
  request: Request,
  webhookToken: string,
  env: Env
): Promise<Response> {
  // Find listener by webhook token
  const listener = await env.DB
    .prepare(`
      SELECT l.id, l.workspace_id, l.listener_type, l.config, l.target_board_id,
             l.auto_approve, l.filter_rules, l.is_active
      FROM listener_configs l
      WHERE l.config LIKE ? AND l.is_active = 1
    `)
    .bind(`%"webhook_token":"${webhookToken}"%`)
    .first<{
      id: number;
      workspace_id: number;
      listener_type: string;
      config: string;
      target_board_id: number | null;
      auto_approve: number;
      filter_rules: string | null;
    }>();

  if (!listener) {
    return errorResponse(404, 'Listener not found or inactive');
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'Invalid JSON payload');
  }

  // Record event
  const eventType = String(payload.type || payload.event || payload.action || 'unknown');
  const event = await env.DB
    .prepare(`
      INSERT INTO listener_events (listener_id, event_type, raw_payload, status, received_at)
      VALUES (?, ?, ?, 'pending', datetime('now'))
      RETURNING id
    `)
    .bind(listener.id, eventType, JSON.stringify(payload))
    .first<{ id: number }>();

  // Update listener stats
  await env.DB
    .prepare(`
      UPDATE listener_configs
      SET events_received = events_received + 1, last_event_at = datetime('now')
      WHERE id = ?
    `)
    .bind(listener.id)
    .run();

  // Process event (extract feedback if applicable)
  try {
    const extracted = extractFeedbackFromEvent(listener.listener_type, payload);

    if (extracted && listener.target_board_id) {
      // Create feedback
      const moderationState = listener.auto_approve ? 'approved' : 'pending';
      const isHidden = listener.auto_approve ? 0 : 1;

      const feedback = await env.DB
        .prepare(`
          INSERT INTO feedback_items (
            board_id, title, description, status, moderation_state, is_hidden,
            source, source_metadata, created_at, updated_at
          ) VALUES (?, ?, ?, 'open', ?, ?, 'listener', ?, datetime('now'), datetime('now'))
          RETURNING id
        `)
        .bind(
          listener.target_board_id,
          extracted.title,
          extracted.description || null,
          moderationState,
          isHidden,
          JSON.stringify({ listener_id: listener.id, event_id: event?.id })
        )
        .first<{ id: number }>();

      // Update event
      await env.DB
        .prepare(`
          UPDATE listener_events
          SET status = 'processed', feedback_id = ?, processed_at = datetime('now')
          WHERE id = ?
        `)
        .bind(feedback?.id, event?.id)
        .run();

      // Update listener processed count
      await env.DB
        .prepare('UPDATE listener_configs SET events_processed = events_processed + 1 WHERE id = ?')
        .bind(listener.id)
        .run();
    } else {
      // Mark as ignored (no feedback extracted or no target board)
      await env.DB
        .prepare(`UPDATE listener_events SET status = 'ignored', processed_at = datetime('now') WHERE id = ?`)
        .bind(event?.id)
        .run();
    }
  } catch (err) {
    // Mark as failed
    await env.DB
      .prepare(`
        UPDATE listener_events
        SET status = 'failed', error_message = ?, processed_at = datetime('now')
        WHERE id = ?
      `)
      .bind(err instanceof Error ? err.message : 'Unknown error', event?.id)
      .run();
  }

  return jsonResponse({ received: true, event_id: event?.id });
}

/**
 * Extract feedback from event payload
 */
function extractFeedbackFromEvent(
  listenerType: string,
  payload: Record<string, unknown>
): { title: string; description?: string } | null {
  switch (listenerType) {
    case 'discord_webhook':
      // Discord message format
      if (payload.content) {
        const content = String(payload.content);
        return {
          title: content.slice(0, 160),
          description: content.length > 160 ? content : undefined,
        };
      }
      break;

    case 'slack_app':
      // Slack event format
      if (payload.text) {
        const text = String(payload.text);
        return {
          title: text.slice(0, 160),
          description: text.length > 160 ? text : undefined,
        };
      }
      break;

    case 'sentry':
      // Sentry issue format
      if (payload.event && typeof payload.event === 'object') {
        const event = payload.event as Record<string, unknown>;
        return {
          title: String(event.title || event.message || 'Sentry Issue'),
          description: String(event.message || event.culprit || ''),
        };
      }
      break;

    case 'custom_webhook':
    default:
      // Try common fields
      if (payload.title || payload.message || payload.text || payload.content) {
        const title = String(payload.title || payload.subject || payload.message || payload.text || payload.content);
        return {
          title: title.slice(0, 160),
          description: String(payload.description || payload.body || payload.content || ''),
        };
      }
  }

  return null;
}

// ============================================================================
// Main Route Handler
// ============================================================================

export async function handleSourcesRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  const method = request.method;

  // Handle webhook endpoint (no auth required)
  const webhookMatch = pathname.match(/^\/api\/v1\/listen\/([a-f0-9-]+)$/);
  if (webhookMatch && method === 'POST') {
    return handleListenerWebhook(request, webhookMatch[1], env);
  }

  // All other routes require auth
  const auth = await verifyAdmin(request, env);
  if (!auth) {
    return errorResponse(401, 'Unauthorized');
  }

  const url = new URL(request.url);

  // Brand keywords
  if (pathname.match(/^\/api\/v1\/[^/]+\/brand\/keywords$/) && method === 'GET') {
    return listBrandKeywords(env, auth.workspaceId);
  }
  if (pathname.match(/^\/api\/v1\/[^/]+\/brand\/keywords$/) && method === 'POST') {
    const body = await request.json() as { keyword: string; keyword_type?: string };
    return addBrandKeyword(env, auth.workspaceId, body);
  }
  const keywordMatch = pathname.match(/^\/api\/v1\/[^/]+\/brand\/keywords\/(\d+)$/);
  if (keywordMatch && method === 'DELETE') {
    return deleteBrandKeyword(env, auth.workspaceId, parseInt(keywordMatch[1], 10));
  }

  // Brand mentions
  if (pathname.match(/^\/api\/v1\/[^/]+\/brand\/mentions$/) && method === 'GET') {
    return listBrandMentions(env, auth.workspaceId, url.searchParams);
  }
  if (pathname.match(/^\/api\/v1\/[^/]+\/brand\/mentions\/stats$/) && method === 'GET') {
    return getMentionStats(env, auth.workspaceId);
  }
  const mentionMatch = pathname.match(/^\/api\/v1\/[^/]+\/brand\/mentions\/(\d+)$/);
  if (mentionMatch && method === 'PATCH') {
    const body = await request.json() as { status: string };
    return updateMentionStatus(env, auth.workspaceId, auth.userId, parseInt(mentionMatch[1], 10), body);
  }
  const convertMatch = pathname.match(/^\/api\/v1\/[^/]+\/brand\/mentions\/(\d+)\/convert$/);
  if (convertMatch && method === 'POST') {
    const body = await request.json() as { board_slug: string; title?: string };
    return convertMentionToFeedback(env, auth.workspaceId, auth.userId, parseInt(convertMatch[1], 10), body);
  }

  // External sources
  if (pathname.match(/^\/api\/v1\/[^/]+\/sources$/) && method === 'GET') {
    return listExternalSources(env, auth.workspaceId);
  }
  if (pathname.match(/^\/api\/v1\/[^/]+\/sources$/) && method === 'POST') {
    const body = await request.json() as { source_type: string; name: string; config: Record<string, unknown>; sync_frequency?: string };
    return createExternalSource(env, auth.workspaceId, body);
  }
  const sourceMatch = pathname.match(/^\/api\/v1\/[^/]+\/sources\/(\d+)$/);
  if (sourceMatch && method === 'PATCH') {
    const body = await request.json() as { name?: string; config?: Record<string, unknown>; sync_frequency?: string; is_active?: boolean };
    return updateExternalSource(env, auth.workspaceId, parseInt(sourceMatch[1], 10), body);
  }
  if (sourceMatch && method === 'DELETE') {
    return deleteExternalSource(env, auth.workspaceId, parseInt(sourceMatch[1], 10));
  }

  // Listeners
  if (pathname.match(/^\/api\/v1\/[^/]+\/listeners$/) && method === 'GET') {
    return listListeners(env, auth.workspaceId);
  }
  if (pathname.match(/^\/api\/v1\/[^/]+\/listeners$/) && method === 'POST') {
    const body = await request.json() as {
      name: string;
      listener_type: string;
      config: Record<string, unknown>;
      target_board_slug?: string;
      auto_approve?: boolean;
      filter_rules?: Record<string, unknown>;
    };
    return createListener(env, auth.workspaceId, body);
  }
  const listenerMatch = pathname.match(/^\/api\/v1\/[^/]+\/listeners\/(\d+)$/);
  if (listenerMatch && method === 'GET') {
    return getListener(env, auth.workspaceId, parseInt(listenerMatch[1], 10));
  }
  if (listenerMatch && method === 'PATCH') {
    const body = await request.json() as { name?: string; config?: Record<string, unknown>; is_active?: boolean; auto_approve?: boolean };
    return updateListener(env, auth.workspaceId, parseInt(listenerMatch[1], 10), body);
  }
  if (listenerMatch && method === 'DELETE') {
    return deleteListener(env, auth.workspaceId, parseInt(listenerMatch[1], 10));
  }

  return null;
}
