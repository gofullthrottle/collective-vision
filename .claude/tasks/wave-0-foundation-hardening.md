# Wave 0: Foundation Hardening

**Duration**: 8-12 hours
**Dependencies**: None
**Priority**: Critical (blocks all other waves)

---

## Epic 0.1: Mobile Responsive Design (4h)

### Tasks

#### 0.1.1 Audit Current CSS (1h)
- [ ] Review widget CSS for responsive issues
- [ ] Review admin dashboard CSS
- [ ] Document breakpoint strategy (mobile: 320-768, tablet: 768-1024, desktop: 1024+)
- [ ] Identify components needing updates

**Acceptance Criteria:**
- Audit document created with all issues listed
- Breakpoint strategy documented

#### 0.1.2 Implement Widget Responsive Styles (1.5h)
- [ ] Add CSS custom properties for responsive values
- [ ] Implement mobile-first breakpoints
- [ ] Fix feedback list layout on small screens
- [ ] Fix form inputs for touch devices
- [ ] Test on iOS Safari viewport

**Acceptance Criteria:**
- Widget renders correctly at 320px, 375px, 768px, 1024px
- No horizontal scrolling on mobile
- Touch targets minimum 44x44px

#### 0.1.3 Implement Admin Dashboard Responsive (1h)
- [ ] Responsive sidebar (collapsible on mobile)
- [ ] Responsive data tables (horizontal scroll or card view)
- [ ] Responsive charts and stats
- [ ] Mobile navigation pattern

**Acceptance Criteria:**
- Admin fully usable on iPad
- Admin functional on mobile (may have reduced features)

#### 0.1.4 Touch Interactions (0.5h)
- [ ] Add touch-friendly hover states
- [ ] Implement swipe gestures where appropriate
- [ ] Test on real iOS and Android devices

**Acceptance Criteria:**
- No hover-only interactions
- Touch feedback on all interactive elements

---

## Epic 0.2: API Hardening (4h)

### Tasks

#### 0.2.1 Request Validation (1.5h)
- [ ] Add zod or similar for request validation
- [ ] Define schemas for all API endpoints
- [ ] Validate request bodies on POST/PUT
- [ ] Validate URL parameters
- [ ] Return structured validation errors

**Acceptance Criteria:**
- All endpoints validate input
- Invalid requests return 400 with detailed errors
- No SQL injection possible via parameters

#### 0.2.2 Rate Limiting (1.5h)
- [ ] Implement rate limiting middleware
- [ ] Configure limits per endpoint type:
  - Public reads: 100/minute
  - Writes: 20/minute
  - Auth endpoints: 5/minute
- [ ] Use Cloudflare's rate limiting or custom D1-based
- [ ] Return 429 with Retry-After header

**Acceptance Criteria:**
- Rate limits enforced
- 429 responses include retry timing
- Limits configurable per workspace tier (future)

#### 0.2.3 Error Handling Standardization (0.5h)
- [ ] Create error response format:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human readable message",
      "details": {}
    }
  }
  ```
- [ ] Consistent HTTP status codes
- [ ] Log errors with request context (no PII)

**Acceptance Criteria:**
- All errors follow standard format
- No stack traces in production responses

#### 0.2.4 CORS Production Configuration (0.5h)
- [ ] Configure allowed origins per environment
- [ ] Whitelist production domains
- [ ] Ensure credentials handling correct
- [ ] Document CORS policy

**Acceptance Criteria:**
- Widget works from any origin
- API restricts sensitive endpoints appropriately

---

## Epic 0.3: Development Infrastructure (4h)

### Tasks

#### 0.3.1 Test Setup (1.5h)
- [ ] Add Vitest for Workers testing
- [ ] Create test utilities (mock D1, mock request)
- [ ] Write first API endpoint tests
- [ ] Configure test coverage reporting

**Acceptance Criteria:**
- `npm test` runs successfully
- At least 3 endpoint tests passing
- Coverage report generates

#### 0.3.2 Environment Configuration (1h)
- [ ] Create wrangler.toml for dev/staging/production
- [ ] Document environment variables
- [ ] Create `.env.example`
- [ ] Add secrets management documentation

**Acceptance Criteria:**
- Clear separation of environments
- No secrets in code
- Deployment docs updated

#### 0.3.3 Local Development Improvements (1h)
- [ ] Document local setup steps
- [ ] Create seed data script
- [ ] Add hot-reload configuration
- [ ] Create development widget test page

**Acceptance Criteria:**
- New developer can set up in < 15 minutes
- Local development mirrors production behavior

#### 0.3.4 CI/CD Foundation (0.5h)
- [ ] GitHub Actions workflow for tests
- [ ] Workflow for staging deployment
- [ ] Workflow for production deployment (manual trigger)

**Acceptance Criteria:**
- Tests run on PR
- Staging deploys on main merge
- Production requires manual approval

---

## Definition of Done for Wave 0

- [ ] Mobile responsive on all target devices
- [ ] All API endpoints validate input
- [ ] Rate limiting active
- [ ] Error responses standardized
- [ ] Tests passing with coverage report
- [ ] CI/CD pipeline functional
- [ ] Development docs updated

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 0.1 Mobile Responsive | 4h | Medium |
| 0.2 API Hardening | 4h | Medium |
| 0.3 Dev Infrastructure | 4h | Low |

**Total: 12h (optimistic: 8h)**
