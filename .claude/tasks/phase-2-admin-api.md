# Phase 2: Admin API

**Total Effort**: 6 hours
**Agent**: Backend Specialist
**Wave**: 1-2 (Starts after Phase 0 auth)
**Priority**: P0 - Required for Admin UI

---

## API Design Principles

- RESTful endpoints under `/api/v1/admin/`
- All routes require `X-API-Key` header
- Consistent response format: `{ data, meta?, error? }`
- Pagination: `?limit=20&offset=0`
- Filtering: Query parameters for each filterable field

---

## Epic 2.1: Auth Middleware (1h)

### Task 2.1.1: Implement Auth Middleware (30min)
**Description**: Create reusable authentication middleware for admin routes.

**Acceptance Criteria**:
- [ ] Check `X-API-Key` header against `ADMIN_API_KEY` env var
- [ ] Return 401 `{error: "Unauthorized"}` if missing or invalid
- [ ] Return 403 if rate limited (use separate admin rate limit)
- [ ] Log auth failures (without exposing key)

**Files**:
- `src/worker.ts` - Add `requireAdminAuth` function

**Code**:
```typescript
function requireAdminAuth(request: Request, env: Env): Response | null {
  const apiKey = request.headers.get('X-API-Key');

  if (!apiKey) {
    return jsonResponse({ error: 'Missing X-API-Key header' }, 401);
  }

  if (apiKey !== env.ADMIN_API_KEY) {
    console.log('Admin auth failed: invalid key');
    return jsonResponse({ error: 'Invalid API key' }, 401);
  }

  return null; // Auth passed
}
```

**Dependencies**: Phase 0 complete

---

### Task 2.1.2: Admin Route Handler Structure (30min)
**Description**: Set up the routing structure for admin endpoints.

**Acceptance Criteria**:
- [ ] Route matcher for `/api/v1/admin/workspaces/:workspace/*`
- [ ] Workspace validation (must exist)
- [ ] Proper 404 for undefined routes
- [ ] Method validation (405 for wrong methods)

**Files**:
- `src/worker.ts` - Add `handleAdminApi` function

**Code**:
```typescript
async function handleAdminApi(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const path = url.pathname.replace('/api/v1/admin', '');
  const method = request.method;

  // /workspaces/:workspace/feedback
  const feedbackMatch = path.match(/^\/workspaces\/([^\/]+)\/feedback$/);
  if (feedbackMatch) {
    const workspace = feedbackMatch[1];
    if (method === 'GET') return listAdminFeedback(request, env, workspace, url);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // /workspaces/:workspace/feedback/:id
  const feedbackItemMatch = path.match(/^\/workspaces\/([^\/]+)\/feedback\/(\d+)$/);
  if (feedbackItemMatch) {
    const [, workspace, id] = feedbackItemMatch;
    if (method === 'PATCH') return updateFeedback(request, env, workspace, id);
    if (method === 'DELETE') return deleteFeedback(request, env, workspace, id);
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // ... more routes

  return jsonResponse({ error: 'Not found' }, 404);
}
```

**Dependencies**: Task 2.1.1

---

## Epic 2.2: Filtered Feedback List (1.5h)

### Task 2.2.1: List Endpoint with Filters (1h)
**Description**: Create GET endpoint to list feedback with filtering options.

**Acceptance Criteria**:
- [ ] `GET /api/v1/admin/workspaces/:workspace/feedback`
- [ ] Filter by `status` (comma-separated: `open,planned`)
- [ ] Filter by `moderation_state` (pending, approved, rejected)
- [ ] Filter by `board` (board slug)
- [ ] Filter by `is_hidden` (true/false)
- [ ] Search by `q` (searches title and description)
- [ ] Sort by `sort` (created_at, vote_count, updated_at)
- [ ] Sort direction `order` (asc, desc)
- [ ] Pagination: `limit` (default 20, max 100), `offset`

**Files**:
- `src/worker.ts` - Add `listAdminFeedback` function

**Code**:
```typescript
async function listAdminFeedback(
  request: Request,
  env: Env,
  workspaceSlug: string,
  url: URL
): Promise<Response> {
  const params = url.searchParams;

  // Get workspace
  const workspace = await env.DB.prepare(
    'SELECT id FROM workspaces WHERE slug = ?'
  ).bind(workspaceSlug).first<{ id: number }>();

  if (!workspace) {
    return jsonResponse({ error: 'Workspace not found' }, 404);
  }

  // Build query
  let query = `
    SELECT
      f.*,
      b.slug as board_slug,
      b.name as board_name,
      COALESCE(SUM(v.weight), 0) as vote_count
    FROM feedback_items f
    JOIN boards b ON f.board_id = b.id
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    WHERE b.workspace_id = ?
  `;
  const bindings: any[] = [workspace.id];

  // Apply filters
  const status = params.get('status');
  if (status) {
    const statuses = status.split(',').map(s => s.trim());
    query += ` AND f.status IN (${statuses.map(() => '?').join(',')})`;
    bindings.push(...statuses);
  }

  const moderation = params.get('moderation_state');
  if (moderation) {
    query += ' AND f.moderation_state = ?';
    bindings.push(moderation);
  }

  const board = params.get('board');
  if (board) {
    query += ' AND b.slug = ?';
    bindings.push(board);
  }

  const hidden = params.get('is_hidden');
  if (hidden !== null) {
    query += ' AND f.is_hidden = ?';
    bindings.push(hidden === 'true' ? 1 : 0);
  }

  const search = params.get('q');
  if (search) {
    query += ' AND (f.title LIKE ? OR f.description LIKE ?)';
    const searchTerm = `%${search}%`;
    bindings.push(searchTerm, searchTerm);
  }

  query += ' GROUP BY f.id';

  // Sorting
  const sort = params.get('sort') || 'created_at';
  const order = params.get('order') || 'desc';
  const validSorts = ['created_at', 'updated_at', 'vote_count', 'title'];
  const validOrders = ['asc', 'desc'];

  if (validSorts.includes(sort) && validOrders.includes(order)) {
    query += ` ORDER BY ${sort === 'vote_count' ? 'vote_count' : `f.${sort}`} ${order.toUpperCase()}`;
  }

  // Pagination
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100);
  const offset = parseInt(params.get('offset') || '0');
  query += ' LIMIT ? OFFSET ?';
  bindings.push(limit, offset);

  const results = await env.DB.prepare(query).bind(...bindings).all();

  // Get total count for pagination
  // (simplified - in production, use a separate count query)

  return jsonResponse({
    data: results.results,
    meta: {
      limit,
      offset,
      count: results.results?.length || 0
    }
  });
}
```

**Dependencies**: Task 2.1.2

---

### Task 2.2.2: Include Related Data (30min)
**Description**: Enhance list endpoint to include tags, author info, and comment counts.

**Acceptance Criteria**:
- [ ] Include tags array for each item
- [ ] Include author info (name, email if available)
- [ ] Include comment count
- [ ] Use efficient joins (avoid N+1)

**Files**:
- `src/worker.ts` - Enhance `listAdminFeedback`

**SQL Enhancement**:
```sql
SELECT
  f.*,
  b.slug as board_slug,
  b.name as board_name,
  u.name as author_name,
  u.email as author_email,
  COALESCE(SUM(v.weight), 0) as vote_count,
  (SELECT COUNT(*) FROM feedback_comments c WHERE c.feedback_id = f.id) as comment_count,
  (SELECT GROUP_CONCAT(t.name) FROM feedback_item_tags fit
   JOIN feedback_tags t ON fit.tag_id = t.id
   WHERE fit.feedback_id = f.id) as tags
FROM feedback_items f
JOIN boards b ON f.board_id = b.id
LEFT JOIN end_users u ON f.author_id = u.id
LEFT JOIN feedback_votes v ON v.feedback_id = f.id
WHERE b.workspace_id = ?
GROUP BY f.id
```

**Dependencies**: Task 2.2.1

---

## Epic 2.3: Status & Moderation Updates (1h)

### Task 2.3.1: Update Feedback Item (1h)
**Description**: Create PATCH endpoint to update feedback properties.

**Acceptance Criteria**:
- [ ] `PATCH /api/v1/admin/workspaces/:workspace/feedback/:id`
- [ ] Update `status` (validate against allowed values)
- [ ] Update `moderation_state` (pending, approved, rejected)
- [ ] Update `is_hidden` (boolean)
- [ ] Update `tags` (array of tag IDs to set)
- [ ] Partial updates (only update provided fields)
- [ ] Return updated item

**Files**:
- `src/worker.ts` - Add `updateFeedback` function

**Code**:
```typescript
async function updateFeedback(
  request: Request,
  env: Env,
  workspaceSlug: string,
  feedbackId: string
): Promise<Response> {
  const body = await request.json() as {
    status?: string;
    moderation_state?: string;
    is_hidden?: boolean;
    tags?: number[];
  };

  // Validate workspace and feedback ownership
  const item = await env.DB.prepare(`
    SELECT f.id, f.board_id
    FROM feedback_items f
    JOIN boards b ON f.board_id = b.id
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE f.id = ? AND w.slug = ?
  `).bind(feedbackId, workspaceSlug).first<{ id: number; board_id: number }>();

  if (!item) {
    return jsonResponse({ error: 'Feedback item not found' }, 404);
  }

  // Build update query
  const updates: string[] = [];
  const bindings: any[] = [];

  if (body.status !== undefined) {
    const validStatuses = ['open', 'under_review', 'planned', 'in_progress', 'done', 'declined'];
    if (!validStatuses.includes(body.status)) {
      return jsonResponse({ error: 'Invalid status', valid: validStatuses }, 400);
    }
    updates.push('status = ?');
    bindings.push(body.status);
  }

  if (body.moderation_state !== undefined) {
    const validStates = ['pending', 'approved', 'rejected'];
    if (!validStates.includes(body.moderation_state)) {
      return jsonResponse({ error: 'Invalid moderation_state', valid: validStates }, 400);
    }
    updates.push('moderation_state = ?');
    bindings.push(body.moderation_state);
  }

  if (body.is_hidden !== undefined) {
    updates.push('is_hidden = ?');
    bindings.push(body.is_hidden ? 1 : 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    bindings.push(feedbackId);

    await env.DB.prepare(`
      UPDATE feedback_items
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...bindings).run();
  }

  // Handle tags update
  if (body.tags !== undefined) {
    // Remove existing tags
    await env.DB.prepare(
      'DELETE FROM feedback_item_tags WHERE feedback_id = ?'
    ).bind(feedbackId).run();

    // Add new tags
    if (body.tags.length > 0) {
      const tagInserts = body.tags.map(tagId =>
        env.DB.prepare(
          'INSERT INTO feedback_item_tags (feedback_id, tag_id) VALUES (?, ?)'
        ).bind(feedbackId, tagId)
      );
      await env.DB.batch(tagInserts);
    }
  }

  // Fetch and return updated item
  const updated = await env.DB.prepare(`
    SELECT f.*, COALESCE(SUM(v.weight), 0) as vote_count
    FROM feedback_items f
    LEFT JOIN feedback_votes v ON v.feedback_id = f.id
    WHERE f.id = ?
    GROUP BY f.id
  `).bind(feedbackId).first();

  return jsonResponse({ data: updated });
}
```

**Dependencies**: Task 2.2.2

---

## Epic 2.4: Tags CRUD (1h)

### Task 2.4.1: Tags List and Create (30min)
**Description**: Implement GET and POST for tags.

**Acceptance Criteria**:
- [ ] `GET /api/v1/admin/workspaces/:workspace/tags` - List all tags
- [ ] `POST /api/v1/admin/workspaces/:workspace/tags` - Create tag
- [ ] Tag has: name, color (hex), workspace_id
- [ ] Return usage count for each tag

**Files**:
- `src/worker.ts` - Add tag endpoints

**Code**:
```typescript
async function listTags(
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  const workspace = await getWorkspace(env, workspaceSlug);
  if (!workspace) return jsonResponse({ error: 'Workspace not found' }, 404);

  const tags = await env.DB.prepare(`
    SELECT t.*,
      (SELECT COUNT(*) FROM feedback_item_tags fit WHERE fit.tag_id = t.id) as usage_count
    FROM feedback_tags t
    WHERE t.workspace_id = ?
    ORDER BY t.name
  `).bind(workspace.id).all();

  return jsonResponse({ data: tags.results });
}

async function createTag(
  request: Request,
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  const body = await request.json() as { name: string; color?: string };

  if (!body.name || body.name.length < 1 || body.name.length > 50) {
    return jsonResponse({ error: 'Name required (1-50 chars)' }, 400);
  }

  const workspace = await getWorkspace(env, workspaceSlug);
  if (!workspace) return jsonResponse({ error: 'Workspace not found' }, 404);

  const color = body.color || '#6b7280'; // Default gray

  try {
    const result = await env.DB.prepare(`
      INSERT INTO feedback_tags (workspace_id, name, color)
      VALUES (?, ?, ?)
    `).bind(workspace.id, body.name, color).run();

    return jsonResponse({
      data: {
        id: result.meta.last_row_id,
        name: body.name,
        color,
        workspace_id: workspace.id
      }
    }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      return jsonResponse({ error: 'Tag already exists' }, 409);
    }
    throw e;
  }
}
```

**Dependencies**: Task 2.1.2

---

### Task 2.4.2: Tags Update and Delete (30min)
**Description**: Implement PATCH and DELETE for tags.

**Acceptance Criteria**:
- [ ] `PATCH /api/v1/admin/workspaces/:workspace/tags/:id` - Update tag
- [ ] `DELETE /api/v1/admin/workspaces/:workspace/tags/:id` - Delete tag
- [ ] Delete cascades to feedback_item_tags (or prevents if in use)

**Files**:
- `src/worker.ts` - Add tag update/delete endpoints

**Code**:
```typescript
async function updateTag(
  request: Request,
  env: Env,
  workspaceSlug: string,
  tagId: string
): Promise<Response> {
  const body = await request.json() as { name?: string; color?: string };

  // Verify tag belongs to workspace
  const tag = await env.DB.prepare(`
    SELECT t.id FROM feedback_tags t
    JOIN workspaces w ON t.workspace_id = w.id
    WHERE t.id = ? AND w.slug = ?
  `).bind(tagId, workspaceSlug).first();

  if (!tag) return jsonResponse({ error: 'Tag not found' }, 404);

  const updates: string[] = [];
  const bindings: any[] = [];

  if (body.name) {
    updates.push('name = ?');
    bindings.push(body.name);
  }
  if (body.color) {
    updates.push('color = ?');
    bindings.push(body.color);
  }

  if (updates.length === 0) {
    return jsonResponse({ error: 'No updates provided' }, 400);
  }

  bindings.push(tagId);
  await env.DB.prepare(`
    UPDATE feedback_tags SET ${updates.join(', ')} WHERE id = ?
  `).bind(...bindings).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM feedback_tags WHERE id = ?'
  ).bind(tagId).first();

  return jsonResponse({ data: updated });
}

async function deleteTag(
  env: Env,
  workspaceSlug: string,
  tagId: string
): Promise<Response> {
  // Verify ownership
  const tag = await env.DB.prepare(`
    SELECT t.id FROM feedback_tags t
    JOIN workspaces w ON t.workspace_id = w.id
    WHERE t.id = ? AND w.slug = ?
  `).bind(tagId, workspaceSlug).first();

  if (!tag) return jsonResponse({ error: 'Tag not found' }, 404);

  // Delete tag (cascades to feedback_item_tags due to FK)
  await env.DB.prepare('DELETE FROM feedback_tags WHERE id = ?').bind(tagId).run();

  return jsonResponse({ success: true });
}
```

**Dependencies**: Task 2.4.1

---

## Epic 2.5: Bulk Operations (1.5h)

### Task 2.5.1: Bulk Update Endpoint (1h)
**Description**: Create endpoint for bulk operations on multiple feedback items.

**Acceptance Criteria**:
- [ ] `POST /api/v1/admin/workspaces/:workspace/feedback/bulk`
- [ ] Actions: `approve`, `reject`, `hide`, `unhide`, `set_status`, `add_tag`, `remove_tag`
- [ ] Accept array of feedback IDs (max 50)
- [ ] Validate all IDs belong to workspace
- [ ] Return count of affected items

**Files**:
- `src/worker.ts` - Add `bulkUpdateFeedback` function

**Code**:
```typescript
async function bulkUpdateFeedback(
  request: Request,
  env: Env,
  workspaceSlug: string
): Promise<Response> {
  const body = await request.json() as {
    ids: number[];
    action: 'approve' | 'reject' | 'hide' | 'unhide' | 'set_status' | 'add_tag' | 'remove_tag';
    status?: string;
    tag_id?: number;
  };

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return jsonResponse({ error: 'ids array required' }, 400);
  }
  if (body.ids.length > 50) {
    return jsonResponse({ error: 'Maximum 50 items per request' }, 400);
  }

  const workspace = await getWorkspace(env, workspaceSlug);
  if (!workspace) return jsonResponse({ error: 'Workspace not found' }, 404);

  // Verify all IDs belong to this workspace
  const placeholders = body.ids.map(() => '?').join(',');
  const validItems = await env.DB.prepare(`
    SELECT f.id FROM feedback_items f
    JOIN boards b ON f.board_id = b.id
    WHERE f.id IN (${placeholders}) AND b.workspace_id = ?
  `).bind(...body.ids, workspace.id).all();

  const validIds = validItems.results?.map((r: any) => r.id) || [];

  if (validIds.length === 0) {
    return jsonResponse({ error: 'No valid items found' }, 404);
  }

  const idPlaceholders = validIds.map(() => '?').join(',');
  let affectedCount = 0;

  switch (body.action) {
    case 'approve':
      await env.DB.prepare(`
        UPDATE feedback_items
        SET moderation_state = 'approved', is_hidden = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${idPlaceholders})
      `).bind(...validIds).run();
      affectedCount = validIds.length;
      break;

    case 'reject':
      await env.DB.prepare(`
        UPDATE feedback_items
        SET moderation_state = 'rejected', is_hidden = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${idPlaceholders})
      `).bind(...validIds).run();
      affectedCount = validIds.length;
      break;

    case 'hide':
      await env.DB.prepare(`
        UPDATE feedback_items SET is_hidden = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${idPlaceholders})
      `).bind(...validIds).run();
      affectedCount = validIds.length;
      break;

    case 'unhide':
      await env.DB.prepare(`
        UPDATE feedback_items SET is_hidden = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${idPlaceholders})
      `).bind(...validIds).run();
      affectedCount = validIds.length;
      break;

    case 'set_status':
      if (!body.status) {
        return jsonResponse({ error: 'status required for set_status action' }, 400);
      }
      await env.DB.prepare(`
        UPDATE feedback_items SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${idPlaceholders})
      `).bind(body.status, ...validIds).run();
      affectedCount = validIds.length;
      break;

    case 'add_tag':
      if (!body.tag_id) {
        return jsonResponse({ error: 'tag_id required for add_tag action' }, 400);
      }
      // Insert ignore to avoid duplicates
      const tagInserts = validIds.map(id =>
        env.DB.prepare(
          'INSERT OR IGNORE INTO feedback_item_tags (feedback_id, tag_id) VALUES (?, ?)'
        ).bind(id, body.tag_id)
      );
      await env.DB.batch(tagInserts);
      affectedCount = validIds.length;
      break;

    case 'remove_tag':
      if (!body.tag_id) {
        return jsonResponse({ error: 'tag_id required for remove_tag action' }, 400);
      }
      await env.DB.prepare(`
        DELETE FROM feedback_item_tags
        WHERE feedback_id IN (${idPlaceholders}) AND tag_id = ?
      `).bind(...validIds, body.tag_id).run();
      affectedCount = validIds.length;
      break;

    default:
      return jsonResponse({ error: 'Invalid action' }, 400);
  }

  return jsonResponse({
    success: true,
    affected: affectedCount,
    action: body.action
  });
}
```

**Dependencies**: Task 2.3.1, Task 2.4.2

---

### Task 2.5.2: Add Delete Feedback (30min)
**Description**: Implement delete endpoint for individual items.

**Acceptance Criteria**:
- [ ] `DELETE /api/v1/admin/workspaces/:workspace/feedback/:id`
- [ ] Cascades to votes, comments, tags
- [ ] Return 204 on success

**Files**:
- `src/worker.ts` - Add `deleteFeedback` function

**Code**:
```typescript
async function deleteFeedback(
  env: Env,
  workspaceSlug: string,
  feedbackId: string
): Promise<Response> {
  // Verify ownership
  const item = await env.DB.prepare(`
    SELECT f.id FROM feedback_items f
    JOIN boards b ON f.board_id = b.id
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE f.id = ? AND w.slug = ?
  `).bind(feedbackId, workspaceSlug).first();

  if (!item) return jsonResponse({ error: 'Feedback item not found' }, 404);

  // Delete (cascades via FK to votes, comments, item_tags)
  await env.DB.prepare('DELETE FROM feedback_items WHERE id = ?').bind(feedbackId).run();

  return new Response(null, { status: 204 });
}
```

**Dependencies**: Task 2.3.1

---

## Phase 2 Completion Checklist

- [ ] All admin routes require X-API-Key
- [ ] Feedback list supports all filter options
- [ ] Status/moderation updates work correctly
- [ ] Tags CRUD is functional
- [ ] Bulk operations handle up to 50 items
- [ ] Proper error responses for all cases
- [ ] Ready for Admin UI to consume

---

**Next Phase**: Phase 3 (Admin UI) - starts after this completes
