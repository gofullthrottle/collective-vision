# Phase 0: Foundation Hardening

**Total Effort**: 4 hours
**Agent**: Backend Specialist
**Wave**: 0 (No dependencies)
**Priority**: P0 - Must complete before all other phases

---

## Epic 0.1: Scaffold Validation (1h)

### Task 0.1.1: Verify Development Environment (30min)
**Description**: Ensure wrangler dev runs correctly and D1 database is accessible.

**Acceptance Criteria**:
- [ ] `wrangler dev` starts without errors
- [ ] Worker responds to `GET /health` with `{ok: true}`
- [ ] D1 database binding works (can query tables)
- [ ] Document any required setup steps

**Files**:
- `wrangler.toml` (verify config)
- `src/worker.ts` (verify entry point)

**Technical Notes**:
- Check that `database_id` in wrangler.toml matches actual D1 database
- Verify schema.sql has been applied to D1
- Test with `wrangler d1 execute collective-vision-feedback --command="SELECT * FROM workspaces LIMIT 1"`

**Dependencies**: None

---

### Task 0.1.2: Test Existing Endpoints (30min)
**Description**: Verify all existing API endpoints work correctly.

**Acceptance Criteria**:
- [ ] `GET /widget.js` returns JavaScript content
- [ ] `GET /api/v1/test/main/feedback` returns empty array or existing items
- [ ] `POST /api/v1/test/main/feedback` creates new item
- [ ] `POST /api/v1/test/main/feedback/:id/votes` registers vote
- [ ] Auto-provisioning creates workspace and board on first use

**Files**:
- `src/worker.ts:280-313` (handleApi)
- `src/worker.ts:315-365` (getOrCreateWorkspaceAndBoard)

**Technical Notes**:
- Use curl or httpie to test endpoints
- Document any bugs found for immediate fix
- Verify CORS headers are working for cross-origin requests

**Dependencies**: Task 0.1.1

---

## Epic 0.2: Input Validation & Error Handling (1.5h)

### Task 0.2.1: Add Validation Schemas (45min)
**Description**: Create validation schemas for all request bodies.

**Acceptance Criteria**:
- [ ] Create validation helpers (no external deps, simple runtime checks)
- [ ] Validate `createFeedback` body: title (required, 1-200 chars), description (optional, max 2000)
- [ ] Validate `voteOnFeedback` body: externalUserId (required)
- [ ] Return 400 with clear error message on validation failure

**Files**:
- `src/worker.ts` - Add validation functions
- Create `src/validation.ts` (optional, can inline)

**Code Pattern**:
```typescript
interface ValidationError {
  field: string;
  message: string;
}

function validateFeedback(body: unknown): { valid: true; data: CreateFeedbackBody } | { valid: false; errors: ValidationError[] } {
  // Implementation
}
```

**Dependencies**: Task 0.1.2

---

### Task 0.2.2: Improve Error Responses (45min)
**Description**: Standardize error responses across all endpoints.

**Acceptance Criteria**:
- [ ] All errors return JSON with `{error: string, details?: object}`
- [ ] 400 for validation errors with field-level details
- [ ] 404 for not found resources
- [ ] 500 for internal errors (log details, return generic message)
- [ ] Error responses include request ID for debugging

**Files**:
- `src/worker.ts` - Update all error handling

**Code Pattern**:
```typescript
function errorResponse(status: number, error: string, details?: object): Response {
  return new Response(
    JSON.stringify({ error, details, requestId: crypto.randomUUID() }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Dependencies**: Task 0.2.1

---

## Epic 0.3: Admin Authentication (1h)

### Task 0.3.1: Create Auth Middleware (30min)
**Description**: Implement API key authentication for admin routes.

**Acceptance Criteria**:
- [ ] Check `X-API-Key` header on all `/admin/*` routes
- [ ] API key stored in Worker environment variable `ADMIN_API_KEY`
- [ ] Return 401 with `{error: "Unauthorized"}` if key missing/invalid
- [ ] Pass through if valid

**Files**:
- `src/worker.ts` - Add auth middleware
- `wrangler.toml` - Document env var requirement

**Code Pattern**:
```typescript
function requireAdminAuth(request: Request, env: Env): Response | null {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || apiKey !== env.ADMIN_API_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null; // Continue to handler
}
```

**Technical Notes**:
- For local dev, set in `.dev.vars` file
- For production, use `wrangler secret put ADMIN_API_KEY`

**Dependencies**: Task 0.2.2

---

### Task 0.3.2: Add Admin Route Structure (30min)
**Description**: Set up routing structure for admin endpoints.

**Acceptance Criteria**:
- [ ] Add `/api/v1/admin/*` route matching in main handler
- [ ] All admin routes require auth middleware
- [ ] Return 404 for undefined admin routes
- [ ] Add `GET /api/v1/admin/health` as test endpoint

**Files**:
- `src/worker.ts` - Add admin routing

**Code Pattern**:
```typescript
// In main fetch handler
if (url.pathname.startsWith('/api/v1/admin')) {
  const authError = requireAdminAuth(request, env);
  if (authError) return authError;
  return handleAdminApi(request, env, url);
}
```

**Dependencies**: Task 0.3.1

---

## Epic 0.4: Rate Limiting (30min)

### Task 0.4.1: Implement Basic Rate Limiting (30min)
**Description**: Add rate limiting to prevent abuse.

**Acceptance Criteria**:
- [ ] Limit public endpoints to 100 requests/minute per IP
- [ ] Limit vote endpoint to 10 votes/minute per user
- [ ] Return 429 with `{error: "Too many requests", retryAfter: seconds}`
- [ ] Use Cloudflare's built-in rate limiting or simple in-memory counter

**Files**:
- `src/worker.ts` - Add rate limiting
- `wrangler.toml` - Configure rate limiting (if using CF native)

**Technical Notes**:
- For MVP, use simple in-memory Map with expiry
- Can upgrade to Durable Objects or CF Rate Limiting later
- Consider using `request.cf.asn` or IP for rate key

**Code Pattern**:
```typescript
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
```

**Dependencies**: Task 0.3.2

---

## Phase 0 Completion Checklist

- [ ] All existing endpoints work correctly
- [ ] Input validation returns helpful errors
- [ ] Admin routes require authentication
- [ ] Rate limiting prevents abuse
- [ ] Ready for Phase 1 (Widget) and Phase 2 (Admin API)

---

**Next Phase**: Phase 1 (Widget Polish) - can start in parallel after Task 0.1.2
