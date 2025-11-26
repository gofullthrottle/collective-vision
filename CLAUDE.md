# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Collective Vision** is an AI-native feedback platform designed to run on Cloudflare's edge infrastructure. It provides an embeddable widget (like Disqus) for user feedback collection with voting, commenting, and AI-powered analysis.

**Core Value Proposition**: UserVoice.com clone that's cheap to host on Cloudflare, easy to embed, and enhanced with AI capabilities for deduplication, prioritization, and multi-channel feedback ingestion.

## Architecture

### Tech Stack
- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Wrangler CLI
- **Frontend**: Vanilla JavaScript widget (embedded), future admin UI via Cloudflare Pages

### Multi-Tenancy Model
- **Workspaces**: Represent products or organizations
- **Boards**: Specific feedback surfaces within a workspace (e.g., "Product feedback", "Internal roadmap")
- **Tenancy**: Enforced via `workspace_id` and API paths like `/api/v1/:workspace/:board/feedback`

### Key Design Patterns
1. **Auto-provisioning**: Workspaces and boards are created on-demand when first accessed via widget
2. **Anonymous users**: Widget generates `anon_<random>` IDs stored in localStorage, mapped to `end_users` table
3. **Moderation-first**: All feedback has `moderation_state` (pending/approved/rejected) and `is_hidden` flag
4. **Source tracking**: `source` field tracks feedback origin (widget/api/mcp/import) for different moderation flows

## Development Commands

### Initial Setup
```bash
# 1. Create D1 database (first time only)
wrangler d1 create collective-vision-feedback
# Copy the database_id from output into wrangler.toml:11

# 2. Apply schema
wrangler d1 execute collective-vision-feedback --file=schema.sql

# 3. Local development
wrangler dev

# 4. Deploy to production
wrangler deploy
```

### Database Operations
```bash
# Query the database
wrangler d1 execute collective-vision-feedback --command="SELECT * FROM workspaces"

# Apply schema updates
wrangler d1 execute collective-vision-feedback --file=schema.sql

# Local D1 (dev mode uses local DB)
wrangler dev --local --persist
```

### Testing Widget Locally
When running `wrangler dev`, the widget can be embedded in any HTML page:
```html
<script
  src="http://localhost:8787/widget.js"
  data-workspace="test-workspace"
  data-board="main"
></script>
```

## Data Model (schema.sql)

**Key Tables**:
- `workspaces` - Top-level tenant boundary (id, slug, name)
- `boards` - Feedback boards per workspace (workspace_id, slug, name, is_public)
- `end_users` - Users scoped to workspace (workspace_id, external_user_id, email, name)
- `feedback_items` - Core feedback entity with status, moderation, visibility
- `feedback_votes` - One vote per user per item (UNIQUE constraint on feedback_id, user_id)
- `feedback_comments` - Comments per item (supports is_internal flag for team discussions)
- `feedback_tags` + `feedback_item_tags` - Tag system for filtering and AI categorization

**Critical Constraints**:
- Foreign keys enabled via `PRAGMA foreign_keys = ON`
- Workspaces have unique slugs
- Boards have unique `(workspace_id, slug)` pairs
- End users have unique `(workspace_id, external_user_id)` and `(workspace_id, email)`
- Votes have unique `(feedback_id, user_id)` to prevent double-voting

**Important Indexes**:
- `idx_feedback_board` on `(board_id, is_hidden, moderation_state, status)` for fast public listing
- `idx_votes_feedback` on `feedback_id` for vote count aggregation

## API Routes (src/worker.ts)

### Public Endpoints
- `GET /health` - Health check (returns `{ok: true}`)
- `GET /widget.js` - Embeddable feedback widget script
- `GET /api/v1/:workspace/:board/feedback` - List feedback items (with vote counts, filtered to approved & visible)
- `POST /api/v1/:workspace/:board/feedback` - Create new feedback item
- `POST /api/v1/:workspace/:board/feedback/:id/votes` - Upvote a feedback item

### CORS Handling
All API routes have permissive CORS headers via `withCors()` helper:
- `Access-Control-Allow-Origin`: Mirrors request origin or `*`
- `Access-Control-Allow-Credentials`: `true`
- OPTIONS preflight supported for all routes

## Code Organization (src/worker.ts)

### Structure
1. **Lines 5-249**: `WIDGET_JS` - Self-contained embeddable widget script
2. **Lines 251-278**: Helper functions (`jsonResponse`, `withCors`)
3. **Lines 280-313**: `handleApi` - API routing logic
4. **Lines 315-365**: `getOrCreateWorkspaceAndBoard` - Auto-provisioning
5. **Lines 367-400**: `getOrCreateEndUser` - User resolution
6. **Lines 402-434**: `listFeedback` - Public feed with vote aggregation
7. **Lines 436-484**: `createFeedback` - New item creation
8. **Lines 486-534**: `voteOnFeedback` - Voting logic with deduplication
9. **Lines 536-577**: Main fetch handler - Routes all requests

### Key Implementation Details

**Widget Auto-Configuration**:
- Widget reads `data-workspace`, `data-board`, `data-api-base` from its `<script>` tag
- Falls back to script's origin if `data-api-base` not specified
- Generates anonymous UID via `cv_uid` localStorage key

**Vote Count Aggregation**:
```sql
SELECT f.*, COALESCE(SUM(v.weight), 0) AS vote_count
FROM feedback_items f
LEFT JOIN feedback_votes v ON v.feedback_id = f.id
GROUP BY f.id
```

**Moderation Flow**:
- Widget submissions: `moderation_state = 'approved'`, `is_hidden = 0` (immediate)
- MCP/import submissions: Should default to `moderation_state = 'pending'`, `is_hidden = 1` (requires review)

## Project Status & Roadmap

### MVP (Current Scaffold)
- ✅ Embeddable widget with submit/vote
- ✅ D1 schema with moderation and tagging support
- ✅ Multi-tenant API with auto-provisioning
- ⏳ Admin UI (not yet implemented)
- ⏳ Comment threads (schema exists, not wired to API)

### Planned AI Capabilities (GAMEPLAN.md § 6.2)
Priority order for AI features:
1. **P0 - Semantic Deduplication**: Detect similar feedback across channels, suggest merges
2. **P0 - Auto-Tagging & Intent Classification**: Categorize into product areas, bug vs feature request
3. **P0 - Sentiment + Urgency Scoring**: Derive priority signals from keywords and tone
4. **P0 - Theme Clustering**: Group feedback into themes for reporting and MCP queries
5. **P1 - MCP Feedback Agent**: Expose feedback system as MCP server for agent interactions

### Future Enhancements (README.md)
- Reddit/social media monitoring and auto-ingestion
- Mobile PWA (responsive SPA, installable on iOS/Android)
- Jira/Linear/Asana integrations
- AI roadmap drafting and status update generation
- Multi-channel agent mesh (Discord, Slack, Sentry, GA, etc.)

## Growth & Distribution (MINTLIFY-GROWTH-STRATEGY-FOR-FEEDBACK-PLATFORM.md)

**Key Product Requirements**:
1. **Powered-by Badge**: Widget must include "Powered by Collective Vision" link (removable on paid plans)
2. **SEO-Friendly URLs**: Public boards should live on stable paths with proper metadata
3. **Linear-Grade Design**: Widget must be visually polished to encourage embedding
4. **Radical Freemium**: Design limits around boards/users, not core functionality

## Important Notes

### Deployment Configuration
- `wrangler.toml:1-11` defines Worker name, D1 binding, and route pattern
- **Before first deploy**: Update `database_id` on line 11 after creating D1 database
- **Before production**: Update `route` on line 5 with actual domain

### Security & Moderation
- Current implementation auto-approves widget submissions
- For MCP/API submissions, use `moderation_state = 'pending'` by default
- Admin endpoints (not yet implemented) should require authentication
- Rate limiting not yet implemented - add before production scale

### Testing Strategy
1. Widget behavior: Embed in test HTML, verify localStorage persistence
2. Vote deduplication: Test same `externalUserId` voting twice (should be idempotent)
3. Multi-tenancy: Create feedback in different workspaces/boards, verify isolation
4. CORS: Test widget embedding from different origins

## Reference Documentation

- **GAMEPLAN.md**: Complete implementation plan with competitive analysis and AI backlog
- **MINTLIFY-GROWTH-STRATEGY-FOR-FEEDBACK-PLATFORM.md**: GTM strategy and distribution loops
- **schema.sql**: Canonical database schema with comments
- **README.md**: High-level vision and future feature ideas
