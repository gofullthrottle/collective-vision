# Wave 8: Polish, i18n & Enterprise

**Duration**: 35-45 hours
**Dependencies**: All previous waves (final polish)
**Priority**: Medium-Low (enterprise readiness)

---

## Epic 8.1: Multi-Language Support (12h)

### Tasks

#### 8.1.1 i18n Framework Setup (3h)
- [ ] Choose i18n library (i18next or similar)
- [ ] Configure for Workers environment
- [ ] Set up translation file structure
- [ ] Locale detection (browser, user preference)

**File Structure:**
```
src/locales/
├── en/
│   ├── common.json
│   ├── widget.json
│   ├── admin.json
│   └── emails.json
├── es/
├── fr/
├── de/
├── ja/
└── zh/
```

**Acceptance Criteria:**
- Framework integrated
- Hot-reload in dev
- Fallback to English

#### 8.1.2 Widget Translation (3h)
- [ ] Extract all strings from widget
- [ ] Create translation keys
- [ ] Translate to 5 languages:
  - Spanish (es)
  - French (fr)
  - German (de)
  - Japanese (ja)
  - Chinese Simplified (zh)
- [ ] Language selector or auto-detect

**Widget Config:**
```html
<script
  src="/widget.js"
  data-workspace="acme"
  data-board="main"
  data-language="es"
></script>
```

**Acceptance Criteria:**
- Widget fully translated
- Language configurable
- RTL basics (if applicable)

#### 8.1.3 Admin UI Localization (3h)
- [ ] Extract all admin strings
- [ ] Translate dashboard, settings, etc.
- [ ] User language preference
- [ ] Date/number formatting per locale

**Acceptance Criteria:**
- Admin fully translated
- Preference persisted
- Formatting correct

#### 8.1.4 Email Template Localization (1.5h)
- [ ] Translate all email templates
- [ ] User's preferred language
- [ ] Fallback chain (user → workspace → English)

**Acceptance Criteria:**
- Emails in correct language
- All templates covered

#### 8.1.5 Auto-Translation of Feedback (1.5h)
- [ ] Optional auto-translation
- [ ] Store original and translated
- [ ] Show translation toggle
- [ ] Use LLM or translation API

**Database:**
```sql
ALTER TABLE feedback_items ADD COLUMN original_language TEXT;
ALTER TABLE feedback_items ADD COLUMN translations TEXT; -- JSON
```

**Acceptance Criteria:**
- Feedback translatable
- Original preserved
- Toggle in UI

---

## Epic 8.2: Performance & Scalability (8h)

### Tasks

#### 8.2.1 Edge Caching Optimization (2h)
- [ ] Cache API responses at edge
- [ ] Cache-Control headers
- [ ] ETags for conditional requests
- [ ] Cache invalidation strategy

**Cache Strategy:**
- Public board list: 60s TTL
- Individual feedback: 30s TTL
- Static assets: 1 year (versioned)
- User-specific: No cache

**Acceptance Criteria:**
- Caching working
- Invalidation reliable
- Performance improved

#### 8.2.2 Database Query Optimization (2h)
- [ ] Add missing indexes
- [ ] Optimize slow queries
- [ ] Query result caching
- [ ] Connection pooling (if applicable)

**Common Optimizations:**
```sql
-- Add composite indexes for common queries
CREATE INDEX idx_feedback_board_status ON feedback_items(board_id, status, is_hidden);
CREATE INDEX idx_votes_user ON feedback_votes(user_id, created_at);

-- Analyze query plans
EXPLAIN QUERY PLAN SELECT ...;
```

**Acceptance Criteria:**
- All queries < 50ms
- No N+1 queries
- Indexes documented

#### 8.2.3 CDN for Static Assets (1.5h)
- [ ] Configure Cloudflare CDN
- [ ] Optimize image delivery
- [ ] Minify JS/CSS
- [ ] Compression (gzip/brotli)

**Acceptance Criteria:**
- Assets cached globally
- Images optimized
- Bundle size minimized

#### 8.2.4 Load Testing & Benchmarking (2.5h)
- [ ] Create load test suite
- [ ] Test scenarios:
  - 100 concurrent users
  - 1000 feedback items per board
  - Spike traffic patterns
- [ ] Document performance baselines
- [ ] Identify bottlenecks

**Tools:**
- k6 or Artillery for load testing
- Cloudflare Analytics for real metrics

**Acceptance Criteria:**
- Load tests passing
- Baselines documented
- Bottlenecks identified

---

## Epic 8.3: Testing & Quality (10h)

### Tasks

#### 8.3.1 Unit Test Coverage (4h)
- [ ] Achieve 80%+ coverage
- [ ] Test all API endpoints
- [ ] Test auth flows
- [ ] Test AI utilities
- [ ] Mock external services

**Test Structure:**
```
tests/
├── unit/
│   ├── api/
│   ├── auth/
│   ├── ai/
│   └── utils/
├── integration/
│   ├── database.test.ts
│   └── stripe.test.ts
└── fixtures/
```

**Acceptance Criteria:**
- 80%+ coverage
- All critical paths tested
- CI runs tests

#### 8.3.2 Integration Tests (2.5h)
- [ ] Test API with real D1
- [ ] Test Stripe webhooks
- [ ] Test OAuth flows
- [ ] Test MCP server

**Acceptance Criteria:**
- Integration tests passing
- External services mocked appropriately
- Reliable in CI

#### 8.3.3 E2E Tests with Playwright (2.5h)
- [ ] Set up Playwright
- [ ] Test critical user flows:
  - Widget embedding
  - Feedback submission
  - Voting
  - Admin login
  - Roadmap viewing
- [ ] Screenshot comparisons

**Acceptance Criteria:**
- E2E tests passing
- Visual regression caught
- Runs in CI

#### 8.3.4 API Documentation (1h)
- [ ] OpenAPI specification
- [ ] Auto-generated from code
- [ ] Hosted API docs
- [ ] Try-it-out functionality

**Acceptance Criteria:**
- Full API documented
- Spec valid
- Interactive docs

---

## Epic 8.4: Security & Compliance (10h)

### Tasks

#### 8.4.1 Security Audit (3h)
- [ ] Review authentication flows
- [ ] Check authorization logic
- [ ] Input validation review
- [ ] Output encoding review
- [ ] Secrets management audit
- [ ] Dependency vulnerability scan

**Checklist:**
- [ ] No SQL injection
- [ ] No XSS vulnerabilities
- [ ] No CSRF issues
- [ ] Rate limiting in place
- [ ] Secrets not in code

**Acceptance Criteria:**
- Audit complete
- Critical issues fixed
- Report documented

#### 8.4.2 OWASP Compliance Review (2h)
- [ ] Review against OWASP Top 10
- [ ] Document mitigations
- [ ] Fix any gaps
- [ ] Create security headers

**OWASP Top 10 Checklist:**
1. Broken Access Control - ✅ Roles enforced
2. Cryptographic Failures - ✅ Passwords hashed
3. Injection - ✅ Parameterized queries
4. Insecure Design - Review
5. Security Misconfiguration - Review
6. Vulnerable Components - Scan
7. Authentication Failures - ✅ JWT + refresh
8. Data Integrity Failures - Review
9. Logging Failures - ✅ Audit logging
10. SSRF - N/A (minimal external calls)

**Acceptance Criteria:**
- All items addressed
- Mitigations documented
- No critical gaps

#### 8.4.3 GDPR Compliance Features (3h)
- [ ] Data export for users
- [ ] Right to deletion
- [ ] Cookie consent (widget)
- [ ] Privacy policy requirements
- [ ] Data processing agreements

**User Rights:**
- Export all my data (JSON/CSV)
- Delete my account and data
- Opt-out of analytics
- Control email preferences

**Acceptance Criteria:**
- Export working
- Deletion complete
- Consent collected

#### 8.4.4 SOC 2 Preparation (2h)
- [ ] Document security controls
- [ ] Create policies:
  - Access control policy
  - Incident response plan
  - Change management
  - Backup and recovery
- [ ] Evidence collection process

**Acceptance Criteria:**
- Policies drafted
- Controls documented
- Ready for audit

---

## Epic 8.5: DevOps & Infrastructure (5h)

### Tasks

#### 8.5.1 CI/CD Pipeline Optimization (1.5h)
- [ ] Parallel test execution
- [ ] Cache dependencies
- [ ] Fast feedback (< 5 min)
- [ ] Deployment gates

**Pipeline:**
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Checkout
      - Cache node_modules
      - Install dependencies
      - Run unit tests (parallel)
      - Run integration tests
      - Upload coverage

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - Deploy to staging
      - Run smoke tests

  deploy-production:
    needs: deploy-staging
    environment: production
    steps:
      - Deploy to production
      - Monitor for errors
```

**Acceptance Criteria:**
- Pipeline < 5 minutes
- Caching working
- Gates enforced

#### 8.5.2 Staging Environment (1h)
- [ ] Separate D1 database
- [ ] Separate R2 bucket
- [ ] Staging secrets
- [ ] Preview deployments

**Acceptance Criteria:**
- Staging isolated
- Deployments preview-able
- Data separate

#### 8.5.3 Blue-Green Deployment (1h)
- [ ] Zero-downtime deployments
- [ ] Rollback capability
- [ ] Health checks
- [ ] Traffic shifting

**Acceptance Criteria:**
- Zero downtime
- Rollback instant
- Health monitored

#### 8.5.4 Monitoring & Alerting (1.5h)
- [ ] Configure Cloudflare Analytics
- [ ] Error tracking (Sentry or similar)
- [ ] Uptime monitoring
- [ ] Alert channels (Slack, email)

**Alerts:**
- Error rate > 1%
- Response time > 1s
- 5xx errors
- Worker exceptions

**Acceptance Criteria:**
- Monitoring active
- Alerts configured
- On-call documented

---

## Definition of Done for Wave 8

- [ ] i18n complete for 5 languages
- [ ] Performance benchmarks met
- [ ] 80%+ test coverage
- [ ] Security audit passed
- [ ] GDPR features working
- [ ] CI/CD optimized
- [ ] Monitoring active

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 8.1 Multi-Language | 12h | Medium |
| 8.2 Performance | 8h | Medium |
| 8.3 Testing | 10h | Medium |
| 8.4 Security | 10h | High |
| 8.5 DevOps | 5h | Medium |

**Total: 45h (optimistic: 35h)**

---

## Post-Wave 8: Production Launch Checklist

### Technical
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Monitoring configured
- [ ] Backup verified

### Business
- [ ] Pricing finalized
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Support channels ready
- [ ] Documentation complete

### Marketing
- [ ] Landing page polished
- [ ] Launch announcement drafted
- [ ] Demo video created
- [ ] Social media ready

### Operations
- [ ] On-call schedule
- [ ] Incident response plan
- [ ] Escalation paths
- [ ] Support SLAs defined
