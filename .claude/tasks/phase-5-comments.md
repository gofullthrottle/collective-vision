# Phase 5: Comments

**Total Effort**: 4 hours
**Agent**: Backend + Frontend
**Wave**: 5 (Can run in parallel with Landing)
**Priority**: P1 - Enhances engagement

---

## Overview

The comments schema already exists (`feedback_comments` table). This phase wires it to the API and displays comments in the widget.

---

## Epic 5.1: Comments API (1.5h)

### Task 5.1.1: List Comments Endpoint (30min)
**Description**: Create GET endpoint to list comments for a feedback item.

**Acceptance Criteria**:
- [ ] `GET /api/v1/:workspace/:board/feedback/:id/comments`
- [ ] Filter out `is_internal = 1` for public API
- [ ] Include author name
- [ ] Order by created_at ASC (oldest first)
- [ ] Paginate with limit/offset

**Files**:
- `src/worker.ts` - Add `listComments` function

**Code**:
```typescript
async function listComments(
  request: Request,
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: string,
  url: URL
): Promise<Response> {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Verify feedback belongs to workspace/board
  const feedback = await env.DB.prepare(`
    SELECT f.id
    FROM feedback_items f
    JOIN boards b ON f.board_id = b.id
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE f.id = ? AND w.slug = ? AND b.slug = ?
  `).bind(feedbackId, workspaceSlug, boardSlug).first();

  if (!feedback) {
    return jsonResponse({ error: 'Feedback not found' }, 404);
  }

  const comments = await env.DB.prepare(`
    SELECT
      c.id,
      c.body,
      c.created_at,
      u.name as author_name,
      u.external_user_id
    FROM feedback_comments c
    LEFT JOIN end_users u ON c.author_id = u.id
    WHERE c.feedback_id = ? AND c.is_internal = 0
    ORDER BY c.created_at ASC
    LIMIT ? OFFSET ?
  `).bind(feedbackId, limit, offset).all();

  return jsonResponse({
    data: comments.results,
    meta: { limit, offset }
  });
}
```

**Route**:
```typescript
// In handleApi
const commentsMatch = path.match(/^\/api\/v1\/([^\/]+)\/([^\/]+)\/feedback\/(\d+)\/comments$/);
if (commentsMatch) {
  const [, workspace, board, feedbackId] = commentsMatch;
  if (method === 'GET') return listComments(request, env, workspace, board, feedbackId, url);
  if (method === 'POST') return createComment(request, env, workspace, board, feedbackId);
}
```

**Dependencies**: Phase 0 complete

---

### Task 5.1.2: Create Comment Endpoint (30min)
**Description**: Create POST endpoint to add a comment.

**Acceptance Criteria**:
- [ ] `POST /api/v1/:workspace/:board/feedback/:id/comments`
- [ ] Body: `{ body: string, externalUserId: string }`
- [ ] Validate body length (1-2000 chars)
- [ ] Create end_user if needed
- [ ] Return created comment

**Files**:
- `src/worker.ts` - Add `createComment` function

**Code**:
```typescript
async function createComment(
  request: Request,
  env: Env,
  workspaceSlug: string,
  boardSlug: string,
  feedbackId: string
): Promise<Response> {
  const body = await request.json() as {
    body: string;
    externalUserId: string;
  };

  // Validate
  if (!body.body || body.body.length < 1 || body.body.length > 2000) {
    return jsonResponse({ error: 'Comment body required (1-2000 chars)' }, 400);
  }
  if (!body.externalUserId) {
    return jsonResponse({ error: 'externalUserId required' }, 400);
  }

  // Verify feedback exists and get workspace
  const feedbackData = await env.DB.prepare(`
    SELECT f.id, b.workspace_id
    FROM feedback_items f
    JOIN boards b ON f.board_id = b.id
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE f.id = ? AND w.slug = ? AND b.slug = ?
  `).bind(feedbackId, workspaceSlug, boardSlug).first<{ id: number; workspace_id: number }>();

  if (!feedbackData) {
    return jsonResponse({ error: 'Feedback not found' }, 404);
  }

  // Get or create user
  const user = await getOrCreateEndUser(env, feedbackData.workspace_id, body.externalUserId);

  // Create comment
  const result = await env.DB.prepare(`
    INSERT INTO feedback_comments (feedback_id, author_id, body, is_internal)
    VALUES (?, ?, ?, 0)
  `).bind(feedbackId, user.id, body.body).run();

  return jsonResponse({
    data: {
      id: result.meta.last_row_id,
      body: body.body,
      author_name: user.name,
      created_at: new Date().toISOString()
    }
  }, 201);
}
```

**Dependencies**: Task 5.1.1

---

### Task 5.1.3: Admin Comment Endpoints (30min)
**Description**: Add admin endpoints for comment moderation.

**Acceptance Criteria**:
- [ ] `GET /api/v1/admin/workspaces/:workspace/comments` - List all (including internal)
- [ ] `PATCH /api/v1/admin/workspaces/:workspace/comments/:id` - Update visibility
- [ ] `DELETE /api/v1/admin/workspaces/:workspace/comments/:id` - Delete comment

**Files**:
- `src/worker.ts` - Add admin comment endpoints

**Code**:
```typescript
async function listAdminComments(
  request: Request,
  env: Env,
  workspaceSlug: string,
  url: URL
): Promise<Response> {
  const feedbackId = url.searchParams.get('feedback_id');

  const workspace = await getWorkspace(env, workspaceSlug);
  if (!workspace) return jsonResponse({ error: 'Workspace not found' }, 404);

  let query = `
    SELECT
      c.*,
      u.name as author_name,
      f.title as feedback_title
    FROM feedback_comments c
    LEFT JOIN end_users u ON c.author_id = u.id
    JOIN feedback_items f ON c.feedback_id = f.id
    JOIN boards b ON f.board_id = b.id
    WHERE b.workspace_id = ?
  `;
  const bindings: any[] = [workspace.id];

  if (feedbackId) {
    query += ' AND c.feedback_id = ?';
    bindings.push(feedbackId);
  }

  query += ' ORDER BY c.created_at DESC LIMIT 100';

  const comments = await env.DB.prepare(query).bind(...bindings).all();

  return jsonResponse({ data: comments.results });
}

async function updateComment(
  request: Request,
  env: Env,
  workspaceSlug: string,
  commentId: string
): Promise<Response> {
  const body = await request.json() as { is_hidden?: boolean };

  // Verify comment belongs to workspace
  const comment = await env.DB.prepare(`
    SELECT c.id FROM feedback_comments c
    JOIN feedback_items f ON c.feedback_id = f.id
    JOIN boards b ON f.board_id = b.id
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE c.id = ? AND w.slug = ?
  `).bind(commentId, workspaceSlug).first();

  if (!comment) return jsonResponse({ error: 'Comment not found' }, 404);

  if (body.is_hidden !== undefined) {
    await env.DB.prepare(
      'UPDATE feedback_comments SET is_internal = ? WHERE id = ?'
    ).bind(body.is_hidden ? 1 : 0, commentId).run();
  }

  return jsonResponse({ success: true });
}

async function deleteComment(
  env: Env,
  workspaceSlug: string,
  commentId: string
): Promise<Response> {
  // Verify ownership
  const comment = await env.DB.prepare(`
    SELECT c.id FROM feedback_comments c
    JOIN feedback_items f ON c.feedback_id = f.id
    JOIN boards b ON f.board_id = b.id
    JOIN workspaces w ON b.workspace_id = w.id
    WHERE c.id = ? AND w.slug = ?
  `).bind(commentId, workspaceSlug).first();

  if (!comment) return jsonResponse({ error: 'Comment not found' }, 404);

  await env.DB.prepare('DELETE FROM feedback_comments WHERE id = ?').bind(commentId).run();

  return new Response(null, { status: 204 });
}
```

**Dependencies**: Task 5.1.2

---

## Epic 5.2: Widget Comments Display (2h)

### Task 5.2.1: Comment List Component (1h)
**Description**: Add comments display to widget feedback items.

**Acceptance Criteria**:
- [ ] "View comments" button on each item
- [ ] Collapsible comment thread
- [ ] Show comment count badge
- [ ] Display author name and relative time
- [ ] Load comments on expand (lazy)

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup**:
```html
<article class="cv-item">
  <!-- Existing vote button and content -->

  <div class="cv-comments-section">
    <button class="cv-comments-toggle" onclick="toggleComments(${itemId})">
      <svg class="cv-comment-icon">...</svg>
      <span class="cv-comment-count">${commentCount}</span>
      <span>Comments</span>
      <svg class="cv-chevron">...</svg>
    </button>

    <div class="cv-comments-list" id="comments-${itemId}" hidden>
      <!-- Comments loaded here -->
    </div>
  </div>
</article>
```

**CSS**:
```css
.cv-comments-toggle {
  display: flex;
  align-items: center;
  gap: var(--cv-space-2);
  padding: var(--cv-space-2) var(--cv-space-3);
  font-size: var(--cv-text-sm);
  color: var(--cv-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--cv-radius-sm);
  transition: color var(--cv-transition-fast);
}

.cv-comments-toggle:hover {
  color: var(--cv-text);
}

.cv-comments-list {
  margin-top: var(--cv-space-3);
  padding-left: var(--cv-space-4);
  border-left: 2px solid var(--cv-border);
}

.cv-comment {
  padding: var(--cv-space-3) 0;
  border-bottom: 1px solid var(--cv-border);
}

.cv-comment:last-child {
  border-bottom: none;
}

.cv-comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--cv-space-1);
}

.cv-comment-author {
  font-weight: 500;
  font-size: var(--cv-text-sm);
}

.cv-comment-time {
  font-size: var(--cv-text-xs);
  color: var(--cv-text-muted);
}

.cv-comment-body {
  font-size: var(--cv-text-sm);
  color: var(--cv-text-secondary);
  white-space: pre-wrap;
}
```

**JavaScript**:
```javascript
async function toggleComments(itemId) {
  const list = document.getElementById(`comments-${itemId}`);
  const toggle = list.previousElementSibling;

  if (!list.hidden) {
    list.hidden = true;
    toggle.classList.remove('cv-expanded');
    return;
  }

  // Show loading
  list.innerHTML = '<div class="cv-loading">Loading...</div>';
  list.hidden = false;
  toggle.classList.add('cv-expanded');

  try {
    const res = await fetch(`${API_BASE}/${WORKSPACE}/${BOARD}/feedback/${itemId}/comments`);
    const { data } = await res.json();

    if (data.length === 0) {
      list.innerHTML = `
        <p class="cv-no-comments">No comments yet. Be the first!</p>
        ${renderCommentForm(itemId)}
      `;
    } else {
      list.innerHTML = `
        ${data.map(renderComment).join('')}
        ${renderCommentForm(itemId)}
      `;
    }
  } catch (e) {
    list.innerHTML = '<p class="cv-error">Failed to load comments</p>';
  }
}

function renderComment(comment) {
  return `
    <div class="cv-comment">
      <div class="cv-comment-header">
        <span class="cv-comment-author">${escapeHtml(comment.author_name || 'Anonymous')}</span>
        <span class="cv-comment-time">${formatRelativeTime(comment.created_at)}</span>
      </div>
      <p class="cv-comment-body">${escapeHtml(comment.body)}</p>
    </div>
  `;
}
```

**Dependencies**: Task 5.1.2

---

### Task 5.2.2: Add Comment Form (1h)
**Description**: Add inline form to post new comments.

**Acceptance Criteria**:
- [ ] Textarea for comment input
- [ ] Submit button
- [ ] Character count (max 2000)
- [ ] Optimistic update on submit
- [ ] Error handling

**Files**:
- `src/worker.ts` (WIDGET_JS)

**Markup/JS**:
```javascript
function renderCommentForm(itemId) {
  return `
    <form class="cv-comment-form" onsubmit="submitComment(event, ${itemId})">
      <textarea
        class="cv-comment-input"
        placeholder="Add a comment..."
        maxlength="2000"
        rows="2"
        required
      ></textarea>
      <div class="cv-comment-form-footer">
        <span class="cv-char-count">0/2000</span>
        <button type="submit" class="cv-btn cv-btn--sm cv-btn--primary">
          Post
        </button>
      </div>
    </form>
  `;
}

async function submitComment(event, itemId) {
  event.preventDefault();
  const form = event.target;
  const textarea = form.querySelector('textarea');
  const body = textarea.value.trim();

  if (!body) return;

  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Posting...';

  try {
    const res = await fetch(`${API_BASE}/${WORKSPACE}/${BOARD}/feedback/${itemId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        externalUserId: getUserId()
      })
    });

    if (!res.ok) throw new Error('Failed to post');

    const { data } = await res.json();

    // Insert new comment into list
    const list = document.getElementById(`comments-${itemId}`);
    const commentHtml = renderComment(data);
    form.insertAdjacentHTML('beforebegin', commentHtml);

    // Clear form
    textarea.value = '';
    form.querySelector('.cv-char-count').textContent = '0/2000';

    // Update comment count badge
    const countBadge = document.querySelector(`[data-item="${itemId}"] .cv-comment-count`);
    if (countBadge) {
      countBadge.textContent = parseInt(countBadge.textContent) + 1;
    }
  } catch (e) {
    alert('Failed to post comment. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post';
  }
}
```

**CSS**:
```css
.cv-comment-form {
  margin-top: var(--cv-space-3);
}

.cv-comment-input {
  width: 100%;
  padding: var(--cv-space-2) var(--cv-space-3);
  border: 1px solid var(--cv-border);
  border-radius: var(--cv-radius-sm);
  font-size: var(--cv-text-sm);
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
}

.cv-comment-input:focus {
  outline: none;
  border-color: var(--cv-accent);
  box-shadow: 0 0 0 2px var(--cv-accent-glow);
}

.cv-comment-form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--cv-space-2);
}
```

**Dependencies**: Task 5.2.1

---

## Epic 5.3: Admin Comment Moderation (30min)

### Task 5.3.1: Comments in Admin UI (30min)
**Description**: Add comment viewing and moderation to admin.

**Acceptance Criteria**:
- [ ] Show comments in feedback detail view
- [ ] Toggle to hide/show comments
- [ ] Delete comment button
- [ ] Filter by internal vs public

**Files**:
- `admin/src/components/CommentList.tsx`
- `admin/src/pages/Feedback.tsx` (add comments section)

**Component**:
```tsx
function CommentList({ feedbackId }: { feedbackId: number }) {
  const { data: comments, isLoading } = useQuery({
    queryKey: ['comments', feedbackId],
    queryFn: () => api(`/api/v1/admin/workspaces/${workspace}/comments?feedback_id=${feedbackId}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) =>
      api(`/api/v1/admin/workspaces/${workspace}/comments/${commentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['comments', feedbackId]);
      toast.success('Comment deleted');
    },
  });

  if (isLoading) return <Skeleton className="h-20" />;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comments ({comments?.data?.length || 0})</h3>

      {comments?.data?.map((comment: any) => (
        <div key={comment.id} className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-medium">{comment.author_name || 'Anonymous'}</span>
              <span className="text-muted-foreground ml-2">
                {formatRelativeTime(comment.created_at)}
              </span>
              {comment.is_internal && (
                <Badge variant="secondary" className="ml-2">Internal</Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate(comment.id)}
                  className="text-red-500"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="mt-2">{comment.body}</p>
        </div>
      ))}

      {(!comments?.data || comments.data.length === 0) && (
        <p className="text-muted-foreground">No comments yet</p>
      )}
    </div>
  );
}
```

**Dependencies**: Phase 3 Admin UI

---

## Phase 5 Completion Checklist

- [ ] Comments API endpoints work correctly
- [ ] Widget displays comments per item
- [ ] Users can post new comments
- [ ] Comments show in admin UI
- [ ] Admin can delete comments
- [ ] Comment counts display correctly

---

## All Phases Complete Checklist

- [ ] Phase 0: API hardened with auth and rate limiting
- [ ] Phase 1: Widget is polished and distinctive
- [ ] Phase 2: Admin API supports all operations
- [ ] Phase 3: Admin UI is functional
- [ ] Phase 4: Landing page converts visitors
- [ ] Phase 5: Comments enhance engagement
- [ ] Production deploy works
- [ ] All tests pass
