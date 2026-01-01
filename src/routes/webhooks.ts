/**
 * Webhook Routes
 * Handle webhook registration and delivery for real-time notifications
 */

import type { Env } from '../worker';

interface WebhookRecord {
  id: number;
  workspace_id: number;
  url: string;
  events: string;
  secret_hash: string;
  is_active: number;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

interface WebhookPayload {
  event: string;
  timestamp: string;
  workspace_id: number;
  data: unknown;
}

// Supported webhook events
export const WEBHOOK_EVENTS = [
  'feedback.created',
  'feedback.updated',
  'feedback.status_changed',
  'feedback.voted',
  'comment.created',
  'theme.detected',
  'duplicate.suggested',
] as const;

type WebhookEvent = typeof WEBHOOK_EVENTS[number];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Verify admin authentication
 */
async function verifyAdmin(request: Request, env: Env): Promise<{ userId: number; workspaceId: number } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  // Check session token
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

  if (!session) {
    return null;
  }

  return { userId: session.user_id, workspaceId: session.workspace_id };
}

/**
 * Hash webhook secret for storage
 */
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate webhook signature for payload
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureArray = Array.from(new Uint8Array(signature));
  return 'sha256=' + signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * List webhooks for workspace
 */
async function listWebhooks(env: Env, workspaceId: number): Promise<Response> {
  const webhooks = await env.DB
    .prepare(`
      SELECT id, url, events, is_active, created_at, last_triggered_at, failure_count
      FROM webhooks
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `)
    .bind(workspaceId)
    .all<Omit<WebhookRecord, 'workspace_id' | 'secret_hash'>>();

  return jsonResponse({
    webhooks: webhooks.results.map(w => ({
      ...w,
      events: JSON.parse(w.events),
    })),
  });
}

/**
 * Create a new webhook
 */
async function createWebhook(
  env: Env,
  workspaceId: number,
  body: { url: string; events: string[]; secret?: string }
): Promise<Response> {
  // Validate URL
  try {
    new URL(body.url);
  } catch {
    return errorResponse(400, 'Invalid URL');
  }

  // Validate events
  const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (invalidEvents.length > 0) {
    return errorResponse(400, `Invalid events: ${invalidEvents.join(', ')}`);
  }

  // Generate secret if not provided
  const secret = body.secret || crypto.randomUUID();
  const secretHash = await hashSecret(secret);

  const result = await env.DB
    .prepare(`
      INSERT INTO webhooks (workspace_id, url, events, secret_hash, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, datetime('now'))
      RETURNING id, created_at
    `)
    .bind(workspaceId, body.url, JSON.stringify(body.events), secretHash)
    .first<{ id: number; created_at: string }>();

  if (!result) {
    return errorResponse(500, 'Failed to create webhook');
  }

  return jsonResponse({
    id: result.id,
    url: body.url,
    events: body.events,
    secret, // Only returned on creation
    is_active: true,
    created_at: result.created_at,
  }, 201);
}

/**
 * Update a webhook
 */
async function updateWebhook(
  env: Env,
  workspaceId: number,
  webhookId: number,
  body: { url?: string; events?: string[]; is_active?: boolean }
): Promise<Response> {
  // Verify ownership
  const existing = await env.DB
    .prepare('SELECT id FROM webhooks WHERE id = ? AND workspace_id = ?')
    .bind(webhookId, workspaceId)
    .first<{ id: number }>();

  if (!existing) {
    return errorResponse(404, 'Webhook not found');
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.url !== undefined) {
    try {
      new URL(body.url);
    } catch {
      return errorResponse(400, 'Invalid URL');
    }
    updates.push('url = ?');
    params.push(body.url);
  }

  if (body.events !== undefined) {
    const invalidEvents = body.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return errorResponse(400, `Invalid events: ${invalidEvents.join(', ')}`);
    }
    updates.push('events = ?');
    params.push(JSON.stringify(body.events));
  }

  if (body.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(body.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'No updates provided');
  }

  params.push(webhookId);
  await env.DB
    .prepare(`UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  const updated = await env.DB
    .prepare('SELECT id, url, events, is_active, created_at, last_triggered_at, failure_count FROM webhooks WHERE id = ?')
    .bind(webhookId)
    .first<Omit<WebhookRecord, 'workspace_id' | 'secret_hash'>>();

  return jsonResponse({
    ...updated,
    events: JSON.parse(updated?.events || '[]'),
  });
}

/**
 * Delete a webhook
 */
async function deleteWebhook(env: Env, workspaceId: number, webhookId: number): Promise<Response> {
  const result = await env.DB
    .prepare('DELETE FROM webhooks WHERE id = ? AND workspace_id = ?')
    .bind(webhookId, workspaceId)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(404, 'Webhook not found');
  }

  return new Response(null, { status: 204 });
}

/**
 * Rotate webhook secret
 */
async function rotateSecret(env: Env, workspaceId: number, webhookId: number): Promise<Response> {
  const existing = await env.DB
    .prepare('SELECT id FROM webhooks WHERE id = ? AND workspace_id = ?')
    .bind(webhookId, workspaceId)
    .first<{ id: number }>();

  if (!existing) {
    return errorResponse(404, 'Webhook not found');
  }

  const newSecret = crypto.randomUUID();
  const secretHash = await hashSecret(newSecret);

  await env.DB
    .prepare('UPDATE webhooks SET secret_hash = ? WHERE id = ?')
    .bind(secretHash, webhookId)
    .run();

  return jsonResponse({ secret: newSecret });
}

/**
 * Trigger webhooks for an event
 * Called internally when events occur
 */
export async function triggerWebhooks(
  env: Env,
  workspaceId: number,
  event: WebhookEvent,
  data: unknown
): Promise<void> {
  const webhooks = await env.DB
    .prepare(`
      SELECT id, url, secret_hash, events
      FROM webhooks
      WHERE workspace_id = ?
        AND is_active = 1
        AND failure_count < 5
    `)
    .bind(workspaceId)
    .all<{ id: number; url: string; secret_hash: string; events: string }>();

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data,
  };

  const payloadString = JSON.stringify(payload);

  for (const webhook of webhooks.results) {
    const events = JSON.parse(webhook.events) as string[];
    if (!events.includes(event) && !events.includes('*')) {
      continue;
    }

    // Fire and forget - we don't wait for webhook delivery
    deliverWebhook(env, webhook.id, webhook.url, webhook.secret_hash, payloadString).catch(err => {
      console.error(`Webhook delivery error [${webhook.id}]:`, err);
    });
  }
}

/**
 * Deliver a webhook payload
 */
async function deliverWebhook(
  env: Env,
  webhookId: number,
  url: string,
  secretHash: string,
  payload: string
): Promise<void> {
  // We need the original secret to sign, but we only have the hash
  // In production, you'd store the secret in encrypted form or use a signing key
  // For now, we'll use the hash itself as part of the signature
  const signature = await signPayload(payload, secretHash);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': JSON.parse(payload).event,
        'User-Agent': 'CollectiveVision-Webhooks/1.0',
      },
      body: payload,
    });

    if (response.ok) {
      // Reset failure count on success
      await env.DB
        .prepare('UPDATE webhooks SET last_triggered_at = datetime(\'now\'), failure_count = 0 WHERE id = ?')
        .bind(webhookId)
        .run();
    } else {
      // Increment failure count
      await env.DB
        .prepare('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?')
        .bind(webhookId)
        .run();
    }
  } catch (err) {
    // Network error - increment failure count
    await env.DB
      .prepare('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?')
      .bind(webhookId)
      .run();
  }
}

/**
 * Test a webhook endpoint
 */
async function testWebhook(env: Env, workspaceId: number, webhookId: number): Promise<Response> {
  const webhook = await env.DB
    .prepare('SELECT id, url, secret_hash FROM webhooks WHERE id = ? AND workspace_id = ?')
    .bind(webhookId, workspaceId)
    .first<{ id: number; url: string; secret_hash: string }>();

  if (!webhook) {
    return errorResponse(404, 'Webhook not found');
  }

  const testPayload: WebhookPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data: { message: 'This is a test webhook delivery' },
  };

  const payloadString = JSON.stringify(testPayload);
  const signature = await signPayload(payloadString, webhook.secret_hash);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': 'test',
        'User-Agent': 'CollectiveVision-Webhooks/1.0',
      },
      body: payloadString,
    });

    return jsonResponse({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    });
  }
}

/**
 * Handle webhook routes
 */
export async function handleWebhookRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  // All webhook routes require admin auth
  const auth = await verifyAdmin(request, env);
  if (!auth) {
    return errorResponse(401, 'Unauthorized');
  }

  const method = request.method;

  // List webhooks: GET /api/v1/:workspace/webhooks
  const listMatch = pathname.match(/^\/api\/v1\/[^/]+\/webhooks$/);
  if (listMatch && method === 'GET') {
    return listWebhooks(env, auth.workspaceId);
  }

  // Create webhook: POST /api/v1/:workspace/webhooks
  if (listMatch && method === 'POST') {
    const body = await request.json() as { url: string; events: string[]; secret?: string };
    return createWebhook(env, auth.workspaceId, body);
  }

  // Single webhook operations
  const singleMatch = pathname.match(/^\/api\/v1\/[^/]+\/webhooks\/(\d+)$/);
  if (singleMatch) {
    const webhookId = parseInt(singleMatch[1], 10);

    if (method === 'PATCH') {
      const body = await request.json() as { url?: string; events?: string[]; is_active?: boolean };
      return updateWebhook(env, auth.workspaceId, webhookId, body);
    }

    if (method === 'DELETE') {
      return deleteWebhook(env, auth.workspaceId, webhookId);
    }
  }

  // Rotate secret: POST /api/v1/:workspace/webhooks/:id/rotate
  const rotateMatch = pathname.match(/^\/api\/v1\/[^/]+\/webhooks\/(\d+)\/rotate$/);
  if (rotateMatch && method === 'POST') {
    const webhookId = parseInt(rotateMatch[1], 10);
    return rotateSecret(env, auth.workspaceId, webhookId);
  }

  // Test webhook: POST /api/v1/:workspace/webhooks/:id/test
  const testMatch = pathname.match(/^\/api\/v1\/[^/]+\/webhooks\/(\d+)\/test$/);
  if (testMatch && method === 'POST') {
    const webhookId = parseInt(testMatch[1], 10);
    return testWebhook(env, auth.workspaceId, webhookId);
  }

  return null;
}
