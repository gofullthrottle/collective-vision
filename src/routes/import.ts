/**
 * Import Routes
 * Handle data imports from various platforms
 */

import type { Env } from '../worker';

interface ImportJobRecord {
  id: number;
  workspace_id: number;
  source_type: string;
  source_config: string | null;
  status: string;
  total_items: number;
  processed_items: number;
  imported_items: number;
  failed_items: number;
  duplicate_items: number;
  error_log: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ExternalSourceRecord {
  id: number;
  workspace_id: number;
  source_type: string;
  name: string;
  config: string;
  is_active: number;
  sync_frequency: string;
  last_sync_at: string | null;
  last_sync_status: string | null;
}

// Supported import sources
const IMPORT_SOURCES = ['uservoice', 'canny', 'csv', 'intercom', 'zendesk', 'json'] as const;
type ImportSource = typeof IMPORT_SOURCES[number];

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
// Epic 5.1: Import Infrastructure
// ============================================================================

/**
 * List import jobs
 */
async function listImportJobs(env: Env, workspaceId: number, params: URLSearchParams): Promise<Response> {
  const status = params.get('status');
  const limit = Math.min(parseInt(params.get('limit') || '20', 10), 100);
  const offset = parseInt(params.get('offset') || '0', 10);

  let query = `
    SELECT id, source_type, status, total_items, processed_items, imported_items,
           failed_items, duplicate_items, started_at, completed_at, created_at
    FROM import_jobs
    WHERE workspace_id = ?
  `;
  const queryParams: unknown[] = [workspaceId];

  if (status) {
    query += ' AND status = ?';
    queryParams.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  queryParams.push(limit, offset);

  const jobs = await env.DB
    .prepare(query)
    .bind(...queryParams)
    .all<Omit<ImportJobRecord, 'workspace_id' | 'source_config' | 'error_log'>>();

  const countResult = await env.DB
    .prepare('SELECT COUNT(*) as count FROM import_jobs WHERE workspace_id = ?')
    .bind(workspaceId)
    .first<{ count: number }>();

  return jsonResponse({
    jobs: jobs.results,
    total: countResult?.count || 0,
    limit,
    offset,
  });
}

/**
 * Get import job details
 */
async function getImportJob(env: Env, workspaceId: number, jobId: number): Promise<Response> {
  const job = await env.DB
    .prepare(`
      SELECT * FROM import_jobs
      WHERE id = ? AND workspace_id = ?
    `)
    .bind(jobId, workspaceId)
    .first<ImportJobRecord>();

  if (!job) {
    return errorResponse(404, 'Import job not found');
  }

  // Get item breakdown
  const itemBreakdown = await env.DB
    .prepare(`
      SELECT status, COUNT(*) as count
      FROM import_job_items
      WHERE import_job_id = ?
      GROUP BY status
    `)
    .bind(jobId)
    .all<{ status: string; count: number }>();

  // Get recent errors
  const recentErrors = await env.DB
    .prepare(`
      SELECT source_id, error_message, created_at
      FROM import_job_items
      WHERE import_job_id = ? AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT 10
    `)
    .bind(jobId)
    .all<{ source_id: string; error_message: string; created_at: string }>();

  return jsonResponse({
    ...job,
    source_config: job.source_config ? JSON.parse(job.source_config) : null,
    item_breakdown: Object.fromEntries(itemBreakdown.results.map(i => [i.status, i.count])),
    recent_errors: recentErrors.results,
  });
}

/**
 * Create new import job
 */
async function createImportJob(
  env: Env,
  workspaceId: number,
  userId: number,
  body: { source_type: string; config?: Record<string, unknown>; items?: unknown[] }
): Promise<Response> {
  if (!IMPORT_SOURCES.includes(body.source_type as ImportSource)) {
    return errorResponse(400, `Invalid source type. Supported: ${IMPORT_SOURCES.join(', ')}`);
  }

  // For CSV/JSON imports, items must be provided directly
  if ((body.source_type === 'csv' || body.source_type === 'json') && !body.items?.length) {
    return errorResponse(400, 'Items required for CSV/JSON import');
  }

  const result = await env.DB
    .prepare(`
      INSERT INTO import_jobs (workspace_id, source_type, source_config, status, created_by, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now'))
      RETURNING id, created_at
    `)
    .bind(workspaceId, body.source_type, body.config ? JSON.stringify(body.config) : null, userId)
    .first<{ id: number; created_at: string }>();

  if (!result) {
    return errorResponse(500, 'Failed to create import job');
  }

  // If items provided, queue them
  if (body.items?.length) {
    const itemValues = body.items.map(() => '(?, ?, ?, \'pending\', datetime(\'now\'))').join(',');
    const itemParams: unknown[] = [];

    for (const item of body.items) {
      const sourceId = (item as Record<string, unknown>).id?.toString() ||
                       (item as Record<string, unknown>).external_id?.toString() ||
                       crypto.randomUUID();
      itemParams.push(result.id, sourceId, JSON.stringify(item));
    }

    await env.DB
      .prepare(`INSERT INTO import_job_items (import_job_id, source_id, raw_data, status, created_at) VALUES ${itemValues}`)
      .bind(...itemParams)
      .run();

    // Update total count
    await env.DB
      .prepare('UPDATE import_jobs SET total_items = ? WHERE id = ?')
      .bind(body.items.length, result.id)
      .run();
  }

  return jsonResponse({
    id: result.id,
    source_type: body.source_type,
    status: 'pending',
    total_items: body.items?.length || 0,
    created_at: result.created_at,
    message: 'Import job created. Processing will begin shortly.',
  }, 201);
}

/**
 * Start processing an import job
 */
async function startImportJob(env: Env, workspaceId: number, jobId: number): Promise<Response> {
  const job = await env.DB
    .prepare('SELECT id, status, source_type FROM import_jobs WHERE id = ? AND workspace_id = ?')
    .bind(jobId, workspaceId)
    .first<{ id: number; status: string; source_type: string }>();

  if (!job) {
    return errorResponse(404, 'Import job not found');
  }

  if (job.status !== 'pending') {
    return errorResponse(400, `Cannot start job with status: ${job.status}`);
  }

  // Update status
  await env.DB
    .prepare(`UPDATE import_jobs SET status = 'processing', started_at = datetime('now') WHERE id = ?`)
    .bind(jobId)
    .run();

  // Process items in batches
  await processImportBatch(env, workspaceId, jobId, job.source_type);

  return jsonResponse({
    id: jobId,
    status: 'processing',
    message: 'Import job processing started',
  });
}

/**
 * Process a batch of import items
 */
async function processImportBatch(
  env: Env,
  workspaceId: number,
  jobId: number,
  sourceType: string
): Promise<void> {
  // Get pending items
  const items = await env.DB
    .prepare(`
      SELECT id, source_id, raw_data
      FROM import_job_items
      WHERE import_job_id = ? AND status = 'pending'
      LIMIT 100
    `)
    .bind(jobId)
    .all<{ id: number; source_id: string; raw_data: string }>();

  if (items.results.length === 0) {
    // No more items, mark job as completed
    await env.DB
      .prepare(`
        UPDATE import_jobs
        SET status = 'completed', completed_at = datetime('now')
        WHERE id = ?
      `)
      .bind(jobId)
      .run();
    return;
  }

  // Get default board for workspace
  const board = await env.DB
    .prepare('SELECT id FROM boards WHERE workspace_id = ? LIMIT 1')
    .bind(workspaceId)
    .first<{ id: number }>();

  if (!board) {
    await env.DB
      .prepare(`UPDATE import_jobs SET status = 'failed', error_log = 'No board found in workspace' WHERE id = ?`)
      .bind(jobId)
      .run();
    return;
  }

  let imported = 0;
  let failed = 0;
  let duplicates = 0;

  for (const item of items.results) {
    try {
      const data = JSON.parse(item.raw_data);
      const transformed = transformImportItem(data, sourceType);

      // Check for duplicates by title
      const existing = await env.DB
        .prepare(`
          SELECT id FROM feedback_items
          WHERE board_id IN (SELECT id FROM boards WHERE workspace_id = ?)
            AND title = ?
        `)
        .bind(workspaceId, transformed.title)
        .first<{ id: number }>();

      if (existing) {
        await env.DB
          .prepare(`UPDATE import_job_items SET status = 'duplicate', feedback_id = ? WHERE id = ?`)
          .bind(existing.id, item.id)
          .run();
        duplicates++;
        continue;
      }

      // Insert feedback
      const feedback = await env.DB
        .prepare(`
          INSERT INTO feedback_items (
            board_id, title, description, status, moderation_state, is_hidden,
            source, source_url, source_metadata, created_at, updated_at
          ) VALUES (?, ?, ?, 'open', 'pending', 1, 'import', ?, ?, datetime('now'), datetime('now'))
          RETURNING id
        `)
        .bind(
          board.id,
          transformed.title,
          transformed.description || null,
          transformed.source_url || null,
          JSON.stringify({ import_source: sourceType, original_id: item.source_id })
        )
        .first<{ id: number }>();

      if (feedback) {
        await env.DB
          .prepare(`UPDATE import_job_items SET status = 'imported', feedback_id = ? WHERE id = ?`)
          .bind(feedback.id, item.id)
          .run();
        imported++;
      }
    } catch (err) {
      await env.DB
        .prepare(`UPDATE import_job_items SET status = 'failed', error_message = ? WHERE id = ?`)
        .bind(err instanceof Error ? err.message : 'Unknown error', item.id)
        .run();
      failed++;
    }
  }

  // Update job counts
  await env.DB
    .prepare(`
      UPDATE import_jobs
      SET processed_items = processed_items + ?,
          imported_items = imported_items + ?,
          failed_items = failed_items + ?,
          duplicate_items = duplicate_items + ?
      WHERE id = ?
    `)
    .bind(items.results.length, imported, failed, duplicates, jobId)
    .run();

  // Check if more items to process (simplified - in production use Queues)
  // For now, we process synchronously
}

/**
 * Transform import item based on source type
 */
function transformImportItem(
  data: Record<string, unknown>,
  sourceType: string
): { title: string; description?: string; source_url?: string } {
  switch (sourceType) {
    case 'uservoice':
      return {
        title: String(data.title || data.subject || 'Untitled'),
        description: String(data.body || data.text || data.description || ''),
        source_url: String(data.url || data.link || ''),
      };

    case 'canny':
      return {
        title: String(data.title || 'Untitled'),
        description: String(data.details || data.body || ''),
        source_url: data.url ? String(data.url) : undefined,
      };

    case 'intercom':
      return {
        title: String(data.subject || data.title || 'Customer Feedback'),
        description: String((typeof data.body === 'string' ? data.body.trim() : data.body) || data.text || data.message || ''),
        source_url: data.conversation_url ? String(data.conversation_url) : undefined,
      };

    case 'zendesk':
      return {
        title: String(data.subject || 'Support Ticket'),
        description: String(data.description || data.raw_subject || ''),
        source_url: data.url ? String(data.url) : undefined,
      };

    case 'csv':
    case 'json':
    default:
      return {
        title: String(data.title || data.name || data.subject || data[Object.keys(data)[0]] || 'Untitled'),
        description: String(data.description || data.body || data.text || data.content || ''),
        source_url: String(data.url || data.link || data.source_url || ''),
      };
  }
}

/**
 * Cancel import job
 */
async function cancelImportJob(env: Env, workspaceId: number, jobId: number): Promise<Response> {
  const result = await env.DB
    .prepare(`
      UPDATE import_jobs
      SET status = 'cancelled', completed_at = datetime('now')
      WHERE id = ? AND workspace_id = ? AND status IN ('pending', 'processing')
    `)
    .bind(jobId, workspaceId)
    .run();

  if (result.meta?.changes === 0) {
    return errorResponse(400, 'Cannot cancel job (not found or already completed)');
  }

  return jsonResponse({ id: jobId, status: 'cancelled' });
}

// ============================================================================
// Epic 5.2: Platform-Specific Importers
// ============================================================================

/**
 * Get import templates for different platforms
 */
async function getImportTemplates(): Promise<Response> {
  return jsonResponse({
    templates: [
      {
        source_type: 'csv',
        description: 'Import from CSV file',
        required_columns: ['title'],
        optional_columns: ['description', 'status', 'votes', 'created_at', 'source_url'],
        example: 'title,description,votes\n"Add dark mode","Users want dark theme",45',
      },
      {
        source_type: 'json',
        description: 'Import from JSON array',
        required_fields: ['title'],
        optional_fields: ['description', 'status', 'votes', 'created_at', 'source_url'],
        example: '[{"title": "Add dark mode", "description": "Users want dark theme", "votes": 45}]',
      },
      {
        source_type: 'uservoice',
        description: 'Import from UserVoice export',
        documentation: 'https://developer.uservoice.com/docs/api/v2/reference/',
        config_required: ['api_key', 'subdomain'],
      },
      {
        source_type: 'canny',
        description: 'Import from Canny export',
        documentation: 'https://developers.canny.io/api-reference',
        config_required: ['api_key'],
      },
      {
        source_type: 'intercom',
        description: 'Import from Intercom conversations',
        documentation: 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/',
        config_required: ['access_token'],
        config_optional: ['tag_id', 'conversation_status'],
      },
      {
        source_type: 'zendesk',
        description: 'Import from Zendesk tickets',
        documentation: 'https://developer.zendesk.com/api-reference/',
        config_required: ['subdomain', 'email', 'api_token'],
        config_optional: ['ticket_status', 'tag'],
      },
    ],
  });
}

/**
 * Parse CSV data
 */
function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const items: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].match(/("([^"]|"")*"|[^,]*)/g) || [];
    const item: Record<string, string> = {};

    headers.forEach((header, idx) => {
      let value = values[idx] || '';
      value = value.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
      item[header] = value;
    });

    if (item.title || item.name || item.subject) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Upload and preview import file
 */
async function previewImport(
  env: Env,
  workspaceId: number,
  body: { source_type: string; data: string }
): Promise<Response> {
  let items: Record<string, unknown>[];

  try {
    if (body.source_type === 'csv') {
      items = parseCSV(body.data);
    } else if (body.source_type === 'json') {
      items = JSON.parse(body.data);
      if (!Array.isArray(items)) {
        return errorResponse(400, 'JSON must be an array');
      }
    } else {
      return errorResponse(400, 'Preview only supports csv and json');
    }
  } catch (err) {
    return errorResponse(400, `Parse error: ${err instanceof Error ? err.message : 'Invalid format'}`);
  }

  // Transform and validate
  const preview = items.slice(0, 10).map((item, idx) => {
    try {
      const transformed = transformImportItem(item, body.source_type);
      return {
        row: idx + 1,
        valid: true,
        ...transformed,
        original: item,
      };
    } catch (err) {
      return {
        row: idx + 1,
        valid: false,
        error: err instanceof Error ? err.message : 'Transform failed',
        original: item,
      };
    }
  });

  return jsonResponse({
    total_rows: items.length,
    preview,
    valid_count: preview.filter(p => p.valid).length,
    columns_detected: Object.keys(items[0] || {}),
  });
}

// ============================================================================
// Main Route Handler
// ============================================================================

export async function handleImportRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  const auth = await verifyAdmin(request, env);
  if (!auth) {
    return errorResponse(401, 'Unauthorized');
  }

  const method = request.method;
  const url = new URL(request.url);

  // Templates: GET /api/v1/:workspace/import/templates
  if (pathname.match(/^\/api\/v1\/[^/]+\/import\/templates$/) && method === 'GET') {
    return getImportTemplates();
  }

  // Preview: POST /api/v1/:workspace/import/preview
  if (pathname.match(/^\/api\/v1\/[^/]+\/import\/preview$/) && method === 'POST') {
    const body = await request.json() as { source_type: string; data: string };
    return previewImport(env, auth.workspaceId, body);
  }

  // List jobs: GET /api/v1/:workspace/import/jobs
  if (pathname.match(/^\/api\/v1\/[^/]+\/import\/jobs$/) && method === 'GET') {
    return listImportJobs(env, auth.workspaceId, url.searchParams);
  }

  // Create job: POST /api/v1/:workspace/import/jobs
  if (pathname.match(/^\/api\/v1\/[^/]+\/import\/jobs$/) && method === 'POST') {
    const body = await request.json() as { source_type: string; config?: Record<string, unknown>; items?: unknown[] };
    return createImportJob(env, auth.workspaceId, auth.userId, body);
  }

  // Get job: GET /api/v1/:workspace/import/jobs/:id
  const jobMatch = pathname.match(/^\/api\/v1\/[^/]+\/import\/jobs\/(\d+)$/);
  if (jobMatch && method === 'GET') {
    return getImportJob(env, auth.workspaceId, parseInt(jobMatch[1], 10));
  }

  // Start job: POST /api/v1/:workspace/import/jobs/:id/start
  const startMatch = pathname.match(/^\/api\/v1\/[^/]+\/import\/jobs\/(\d+)\/start$/);
  if (startMatch && method === 'POST') {
    return startImportJob(env, auth.workspaceId, parseInt(startMatch[1], 10));
  }

  // Cancel job: POST /api/v1/:workspace/import/jobs/:id/cancel
  const cancelMatch = pathname.match(/^\/api\/v1\/[^/]+\/import\/jobs\/(\d+)\/cancel$/);
  if (cancelMatch && method === 'POST') {
    return cancelImportJob(env, auth.workspaceId, parseInt(cancelMatch[1], 10));
  }

  return null;
}
