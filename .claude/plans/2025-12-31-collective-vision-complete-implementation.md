# Collective Vision - Complete Implementation Plan

**Created**: 2025-12-31
**Project**: AI-Native Feedback Platform
**Target**: Full product implementation from current MVP to production-ready platform

---

## Executive Summary

This plan transforms Collective Vision from its current MVP scaffold into a complete, production-ready AI-native feedback platform. The implementation spans **9 waves**, **42 epics**, and approximately **205-270 hours** of development work.

### Current State (Completed)
- Embeddable feedback widget with voting and comments
- Multi-tenant workspace/board architecture
- Admin dashboard with stats and feedback management
- Tags system, moderation workflow
- "Powered by Collective Vision" badge
- Landing page, About, Contact pages

### Target State
- Full user authentication with OAuth
- AI-powered deduplication, tagging, and sentiment analysis
- MCP server for AI agent integration
- Multi-channel data ingestion (Reddit, Discord, support tickets)
- Stripe monetization with subscription tiers
- Public roadmaps and PM tool integrations
- Enterprise-ready with i18n, compliance, and scale

---

## Wave Overview

| Wave | Name | Epics | Hours | Dependencies |
|------|------|-------|-------|--------------|
| 0 | Foundation Hardening | 3 | 8-12h | None |
| 1 | Authentication & User Management | 6 | 20-28h | Wave 0 |
| 2 | AI Infrastructure + P0 Capabilities | 6 | 35-45h | Wave 1 |
| 3 | MCP Server + Agent Integration | 4 | 18-24h | Wave 2 |
| 4 | Analytics & Integrations | 5 | 16-22h | Wave 1 |
| 5 | Data Ingestion & Migration | 4 | 25-32h | Wave 2 |
| 6 | Monetization & Scaling | 5 | 20-26h | Wave 1 |
| 7 | Advanced Features | 4 | 28-36h | Waves 2,3,4 |
| 8 | Polish, i18n & Enterprise | 5 | 35-45h | All previous |

**Total: 42 epics, 205-270 hours**

---

## Dependency Graph

```
Wave 0 (Foundation)
    │
    v
Wave 1 (Authentication) ─────────────────────────┐
    │                                             │
    ├──────────────┬──────────────┐              │
    v              v              v              v
Wave 2 (AI)    Wave 4 (Analytics) Wave 6 (Monetization)
    │              │              │
    ├──────────────┤              │
    v              v              │
Wave 3 (MCP)   Wave 5 (Ingestion) │
    │              │              │
    └──────────────┼──────────────┘
                   v
              Wave 7 (Advanced)
                   │
                   v
              Wave 8 (Enterprise)
```

---

## Parallel Execution Strategy

With 2-3 agents working concurrently:

| Phase | Duration | Waves | Agents |
|-------|----------|-------|--------|
| A | Week 1-2 | Wave 0 + Wave 1 | Backend, Frontend |
| B | Week 3-4 | Wave 2 + Wave 4 | AI/ML, Frontend |
| C | Week 5-6 | Wave 3 + Wave 5 | Integration, AI/ML |
| D | Week 7 | Wave 6 + Wave 7 | Backend, Frontend |
| E | Week 8 | Wave 8 | All agents |

**Compressed Timeline: 5-6 weeks with parallelization**

---

## Technical Architecture Decisions

### Authentication
- **Approach**: Roll-own with Workers + D1
- **JWT**: Short-lived access tokens + refresh tokens
- **OAuth**: Google and GitHub via direct OAuth 2.0
- **Sessions**: Stored in D1 with HttpOnly cookies

### AI Infrastructure
- **Embeddings**: Cloudflare Workers AI (`@cf/baai/bge-base-en-v1.5`)
- **Vector Storage**: Cloudflare Vectorize
- **LLM Classification**: Claude 3.5 Haiku via API
- **Queue**: Cloudflare Queues for async processing

### Real-time Features
- **MVP**: Polling (5-second intervals)
- **Future**: Cloudflare Durable Objects for WebSockets

### File Storage
- **R2**: Avatars, exports, attachments
- **Pre-signed URLs**: For secure uploads/downloads

### Email
- **Service**: Resend (simple API, good DX)
- **Types**: Verification, password reset, notifications

### Admin UI
- **Framework**: React + Tailwind + shadcn/ui
- **Hosting**: Cloudflare Pages
- **PWA**: Service worker for offline support

### MCP Server
- **Deployment**: Separate Worker endpoint (`/mcp/*`)
- **Auth**: API key-based for agents
- **SDK**: TypeScript MCP SDK

---

## Database Schema Extensions

### Wave 1: Authentication
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id)
);

CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL, -- google, github
  provider_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT REFERENCES workspaces(id),
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Wave 2: AI Capabilities
```sql
ALTER TABLE feedback_items ADD COLUMN embedding_id TEXT;
ALTER TABLE feedback_items ADD COLUMN sentiment_score REAL;
ALTER TABLE feedback_items ADD COLUMN urgency_score REAL;
ALTER TABLE feedback_items ADD COLUMN ai_tags TEXT; -- JSON array
ALTER TABLE feedback_items ADD COLUMN theme_id TEXT;
ALTER TABLE feedback_items ADD COLUMN ai_processed_at TEXT;

CREATE TABLE themes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  description TEXT,
  centroid_embedding_id TEXT,
  item_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ai_processing_jobs (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES feedback_items(id),
  job_type TEXT NOT NULL, -- embed, classify, sentiment, theme
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE duplicate_suggestions (
  id TEXT PRIMARY KEY,
  source_feedback_id TEXT NOT NULL REFERENCES feedback_items(id),
  target_feedback_id TEXT NOT NULL REFERENCES feedback_items(id),
  similarity_score REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Wave 5: Data Ingestion
```sql
CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  source_type TEXT NOT NULL, -- uservoice, canny, csv, etc.
  status TEXT NOT NULL DEFAULT 'pending',
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  error_log TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE external_sources (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  source_type TEXT NOT NULL, -- reddit, discord, slack, twitter
  config TEXT NOT NULL, -- JSON config
  is_active INTEGER DEFAULT 1,
  last_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Wave 6: Monetization
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan_id TEXT NOT NULL, -- free, pro, enterprise
  status TEXT NOT NULL, -- active, canceled, past_due
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  metric_type TEXT NOT NULL, -- api_calls, ai_processing, storage
  quantity INTEGER NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE workspaces ADD COLUMN plan_tier TEXT DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN custom_domain TEXT;
ALTER TABLE workspaces ADD COLUMN badge_hidden INTEGER DEFAULT 0;
```

### Wave 7: Roadmaps & Integrations
```sql
CREATE TABLE roadmap_phases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE roadmap_items (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL REFERENCES roadmap_phases(id),
  feedback_id TEXT REFERENCES feedback_items(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  target_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE changelogs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL, -- jira, linear, asana, github
  config TEXT NOT NULL, -- JSON with OAuth tokens, project IDs
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE integration_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  feedback_id TEXT NOT NULL REFERENCES feedback_items(id),
  external_id TEXT NOT NULL, -- Jira ticket ID, etc.
  external_url TEXT,
  sync_status TEXT DEFAULT 'synced',
  last_sync_at TEXT DEFAULT (datetime('now'))
);
```

---

## Growth & Distribution Requirements

### Design-Led Virality
- Widget performance budget: < 50KB, < 100ms load
- "Linear-grade" visual polish throughout
- Lighthouse audits integrated into CI

### Powered-By Loop
- Badge links with UTM tracking
- "Thank you" CTA: "Create a roadmap like this in 30 seconds"
- A/B testing framework for badge experiments
- Tweet-to-remove-badge experiment ready

### Radical Freemium
- Generous free tier (unlimited boards, 1000 feedback/month)
- Upgrade triggers: branding, AI features, integrations
- Feature flags for tier enforcement

### SEO/GEO Surfaces
- Public boards on SEO-friendly URLs
- Schema.org markup for feedback boards
- Sitemap generation
- Meta tag management
- GEO optimization for AI search engines

---

## Success Metrics to Track

1. Widget impressions
2. Feedback submissions (by source)
3. Vote engagement rate
4. Badge click-through rate
5. Free → Paid conversion
6. Time to first feedback
7. Boards per workspace
8. AI feature usage (dedup accepted, auto-tags kept)
9. MCP agent interactions
10. Import volume by source

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| D1 scaling limits | High | Monitor queries, plan Hyperdrive |
| AI processing costs | Medium | Usage tracking, tier limits, caching |
| OAuth complexity | Medium | Consider Clerk if issues arise |
| Multi-channel API changes | Medium | Abstract source interfaces |
| Timeline creep | High | Regular checkpoints, MVP-first |

---

## Agent Specializations

For marathon execution with parallel agents:

1. **Backend Agent**: API endpoints, D1 operations, authentication, business logic
2. **AI/ML Agent**: Embeddings, classification, clustering, Workers AI integration
3. **Frontend Agent**: Admin UI, widget enhancements, Cloudflare Pages app
4. **Integration Agent**: MCP server, third-party APIs, OAuth flows, imports
5. **DevOps Agent**: Testing, CI/CD, deployment, monitoring, security

---

## Task Files

Detailed task breakdowns are in `.claude/tasks/`:
- `wave-0-foundation-hardening.md`
- `wave-1-authentication.md`
- `wave-2-ai-infrastructure.md`
- `wave-3-mcp-server.md`
- `wave-4-analytics.md`
- `wave-5-data-ingestion.md`
- `wave-6-monetization.md`
- `wave-7-advanced-features.md`
- `wave-8-enterprise-polish.md`

---

## Checkpoint Gates

### After Wave 1 (Authentication)
- [ ] Users can sign up, log in, reset password
- [ ] OAuth (Google, GitHub) functional
- [ ] Team roles working
- [ ] API keys can be generated

### After Wave 2 (AI)
- [ ] Embeddings generated for all feedback
- [ ] Duplicate detection suggesting merges
- [ ] Auto-tags appearing on new feedback
- [ ] Sentiment scores visible in admin

### After Wave 3 (MCP)
- [ ] MCP server responding to tool calls
- [ ] Agents can query feedback by tag/status
- [ ] Agents can submit feedback

### After Wave 6 (Monetization)
- [ ] Stripe checkout working
- [ ] Tier limits enforced
- [ ] Upgrade/downgrade flows functional

### After Wave 8 (Enterprise)
- [ ] All tests passing > 80% coverage
- [ ] Security audit complete
- [ ] GDPR compliance features working

---

## Next Steps

1. Review this plan
2. Approve to proceed with task file generation
3. Sync to ClickUp
4. Begin marathon execution

---

*Generated: 2025-12-31*
*Estimated Duration: 5-7 weeks with parallel execution*
