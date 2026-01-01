# Collective Vision MVP - Implementation Plan

**Created**: 2025-12-27
**Goal**: Transform the existing Cloudflare Worker scaffold into a production-ready, visually striking feedback platform that's cheap to host and viral by design.
**Estimated Effort**: ~40 hours
**Wall Time (with parallelization)**: ~18-22 hours

---

## Vision Statement

Build an AI-native feedback platform that:
- **Embeds anywhere** like Disqus, but for product feedback
- **Costs nothing** to host on Cloudflare's edge
- **Looks stunning** with "Linear-grade" design quality
- **Grows virally** through powered-by badges and design-led distribution

---

## Current State

**What Exists** (from GAMEPLAN §4):
- Cloudflare Worker scaffold in `src/worker.ts`
- D1 schema with workspaces, boards, feedback_items, votes, comments, tags
- Vanilla JS widget serving from `/widget.js`
- API routes: list feedback, create feedback, vote
- Auto-provisioning of workspaces/boards on first use

**What's Missing for MVP**:
- Admin UI for moderation/status updates
- Comments wired to API (schema exists, not exposed)
- Polished widget design (current is functional but basic)
- Powered-by badge for viral distribution
- Landing page for product marketing
- Input validation and rate limiting

---

## Scope Definition

### In Scope (This Plan)
1. Polished embeddable widget with distinctive design
2. Admin UI for moderation and management
3. Landing page for product marketing
4. Comments functionality (API + widget display)
5. Growth hooks (powered-by badge, SEO optimization)
6. API hardening (validation, auth, rate limiting)

### Out of Scope (Future)
- AI capabilities (deduplication, auto-tagging, sentiment)
- MCP Feedback Agent server
- Social media monitoring
- Project management integrations
- Advanced analytics

---

## Technical Architecture

### Stack Decisions

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Widget | Vanilla JS + CSS | Minimal bundle, zero dependencies |
| API | Cloudflare Worker | Existing scaffold, edge performance |
| Database | Cloudflare D1 | Already configured, cost-effective |
| Admin UI | React + Vite + Tailwind + shadcn/ui | Modern DX, great components |
| Landing | Same Pages app as Admin | Single deployment, shared assets |
| Auth | API key (initial) | Simple for MVP, upgrade later |

### Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌──────────────────────┐     ┌───────────────────────────┐│
│   │   Worker (API)        │     │   Pages (UI)              ││
│   │   ────────────────    │     │   ───────────────────────  ││
│   │   /api/v1/*           │     │   /admin/* (React app)    ││
│   │   /widget.js          │     │   /* (Landing page)       ││
│   │   /health             │     │                           ││
│   └──────────┬───────────┘     └───────────────────────────┘│
│              │                                                │
│              ▼                                                │
│   ┌──────────────────────┐                                   │
│   │   D1 Database         │                                   │
│   │   ────────────────    │                                   │
│   │   workspaces          │                                   │
│   │   boards              │                                   │
│   │   feedback_items      │                                   │
│   │   feedback_votes      │                                   │
│   │   feedback_comments   │                                   │
│   │   feedback_tags       │                                   │
│   └──────────────────────┘                                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Direction

### Widget Aesthetic
- **Tone**: Refined minimalism with subtle depth
- **Colors**: Neutral base (slate/zinc) with customizable accent
- **Typography**: System fonts for speed, clear hierarchy
- **Differentiator**: Satisfying micro-interactions on vote, smooth transitions
- **Bundle target**: < 20KB gzipped

### Landing Page Aesthetic
- **Tone**: Bold modern with editorial influence
- **Typography**: Distinctive display font + refined body
- **Differentiator**: Live interactive widget demo as hero (not screenshot)
- **Goal**: "Would share on Twitter" quality

### Admin UI Aesthetic
- **Tone**: Clean utility with personality
- **Differentiator**: Delight in moderation actions (approve/reject animations)
- **Efficiency**: Minimal clicks to common actions

---

## Phase Breakdown

### Phase 0: Foundation Hardening (4h)

**Purpose**: Ensure the existing scaffold is production-ready before building on top.

| Epic | Tasks | Hours | Owner |
|------|-------|-------|-------|
| 0.1 Scaffold Validation | Verify wrangler dev works, test existing endpoints | 1h | Backend |
| 0.2 Input Validation | Add Zod schemas for all request bodies, proper error responses | 1.5h | Backend |
| 0.3 Admin Authentication | X-API-Key header middleware for /admin routes | 1h | Backend |
| 0.4 Rate Limiting | Cloudflare-native rate limiting (100 req/min/IP) | 0.5h | Backend |

**Success Criteria**:
- All endpoints return proper JSON with appropriate status codes
- Invalid input returns 400 with descriptive errors
- Admin routes reject requests without valid API key
- Rate limiting prevents abuse

---

### Phase 1: Widget Polish (8h)

**Purpose**: Transform the basic widget into a visually striking, memorable component.

| Epic | Tasks | Hours | Owner |
|------|-------|-------|-------|
| 1.1 Design System | CSS custom properties for colors, spacing, typography, shadows | 1h | Frontend |
| 1.2 Container Redesign | New wrapper with subtle shadow, rounded corners, smooth mount animation | 2h | Frontend |
| 1.3 Feedback List | Card-based items, avatar placeholders, vote count badges, stagger animation | 2h | Frontend |
| 1.4 Submit Form | Floating label inputs, validation states, submit button with loading | 1.5h | Frontend |
| 1.5 Powered-By Badge | "Powered by Collective Vision" link, thank-you state with CTA | 1h | Frontend |
| 1.6 Mobile Polish | Touch-friendly targets, responsive layout, gesture support | 0.5h | Frontend |

**Success Criteria**:
- Widget is visually distinctive (not generic)
- Vote action has satisfying micro-interaction
- Powered-by badge visible on free tier
- Mobile layout is touch-friendly
- Bundle size < 20KB gzipped

---

### Phase 2: Admin API (6h)

**Purpose**: Expose endpoints for admin operations not available in the public API.

| Epic | Tasks | Hours | Owner |
|------|-------|-------|-------|
| 2.1 Auth Middleware | Reusable middleware for X-API-Key validation | 1h | Backend |
| 2.2 Filtered List | GET /admin/feedback with status, moderation, board, search filters | 1.5h | Backend |
| 2.3 Status Updates | PATCH /admin/feedback/:id for status, moderation, visibility | 1h | Backend |
| 2.4 Tags CRUD | Full CRUD for tags, assign/remove from feedback items | 1h | Backend |
| 2.5 Bulk Operations | POST /admin/feedback/bulk for approve/reject/tag multiple items | 1.5h | Backend |

**API Routes**:
```
GET    /api/v1/admin/workspaces/:workspace/feedback
       ?status=open,planned&moderation=pending&board=main&search=login
PATCH  /api/v1/admin/workspaces/:workspace/feedback/:id
       {status, moderation_state, is_hidden, tags}
POST   /api/v1/admin/workspaces/:workspace/feedback/bulk
       {ids: [...], action: "approve"|"reject"|"tag", tag_id?}
GET    /api/v1/admin/workspaces/:workspace/tags
POST   /api/v1/admin/workspaces/:workspace/tags
PATCH  /api/v1/admin/workspaces/:workspace/tags/:id
DELETE /api/v1/admin/workspaces/:workspace/tags/:id
```

**Success Criteria**:
- All admin routes require valid X-API-Key
- Filtering works correctly with multiple parameters
- Bulk operations handle up to 50 items
- Proper error responses for all edge cases

---

### Phase 3: Admin UI (10h)

**Purpose**: Build a React-based admin dashboard for feedback moderation.

| Epic | Tasks | Hours | Owner |
|------|-------|-------|-------|
| 3.1 Project Setup | Vite + React + Tailwind + shadcn/ui, deploy to Pages | 1.5h | Fullstack |
| 3.2 Dashboard | Stats cards (pending, approved, total), recent activity feed | 2h | Fullstack |
| 3.3 Feedback List | Data table with sorting, filtering, pagination | 3h | Fullstack |
| 3.4 Inline Actions | Status dropdown, approve/reject buttons, tag selector | 2h | Fullstack |
| 3.5 Settings | API key management, workspace config, board settings | 1.5h | Fullstack |

**Routes**:
```
/admin              → Dashboard
/admin/feedback     → Feedback list with filters
/admin/feedback/:id → Feedback detail (optional)
/admin/tags         → Tag management
/admin/settings     → Workspace settings
```

**Success Criteria**:
- Login with API key works
- Dashboard shows feedback metrics
- List supports filtering/sorting/pagination
- Inline editing saves immediately
- Settings persist correctly

---

### Phase 4: Landing Page (8h)

**Purpose**: Create a conversion-focused landing page with live widget demo.

| Epic | Tasks | Hours | Owner |
|------|-------|-------|-------|
| 4.1 Hero Section | Headline, subhead, live embedded widget demo, CTA buttons | 2h | Frontend |
| 4.2 Features | Icon + title + description cards, staggered scroll reveal | 1.5h | Frontend |
| 4.3 Comparison | Table comparing to UserVoice, Canny with checkmarks | 1.5h | Frontend |
| 4.4 Pricing | 3-tier cards (Free, Pro, Enterprise), feature lists | 1.5h | Frontend |
| 4.5 CTA & Footer | Final CTA section, footer with links | 1h | Frontend |
| 4.6 SEO | Meta tags, OG images, structured data | 0.5h | Frontend |

**Sections**:
1. Hero with live widget
2. "Why Collective Vision?" feature grid
3. "vs. The Competition" comparison table
4. Pricing tiers
5. FAQ accordion
6. Final CTA
7. Footer

**Success Criteria**:
- Page loads in < 2 seconds
- Lighthouse score > 90
- Live widget demo is functional
- Mobile layout is polished
- SEO meta tags render correctly

---

### Phase 5: Comments (4h)

**Purpose**: Wire the existing comments schema to the API and widget.

| Epic | Tasks | Hours | Owner |
|------|-------|-------|-------|
| 5.1 Comments API | GET/POST/DELETE for feedback comments, admin moderation | 1.5h | Backend |
| 5.2 Widget Display | Collapsible comment thread under each feedback item | 2h | Frontend |
| 5.3 Admin Moderation | Comment visibility toggle in admin UI | 0.5h | Fullstack |

**API Routes**:
```
GET    /api/v1/:workspace/:board/feedback/:id/comments
POST   /api/v1/:workspace/:board/feedback/:id/comments
DELETE /api/v1/admin/workspaces/:workspace/comments/:id
PATCH  /api/v1/admin/workspaces/:workspace/comments/:id
       {is_hidden}
```

**Success Criteria**:
- Comments display in widget
- Adding comment works with immediate UI update
- Admin can hide/delete comments
- Internal comments (is_internal=1) only visible in admin

---

## Wave Execution Plan

```
Wave 0 (Foundation)     Wave 1 (Core)          Wave 2 (Widget)
─────────────────────   ─────────────────────   ─────────────────────
Backend: Validation     Backend: Admin API      Backend: Bulk ops
Frontend: Design sys    Frontend: Widget core   Frontend: Polish
                                                         ↓
                                                Wave 3 (Admin UI)
                                                ─────────────────────
                                                Fullstack: Setup
                                                Fullstack: Dashboard
                                                Fullstack: List
                                                         ↓
                                                Wave 4 (Admin UI)
                                                ─────────────────────
                                                Fullstack: Actions
                                                Fullstack: Settings
                                                         ↓
Wave 5 (Landing)        Wave 5 (Comments)
─────────────────────   ─────────────────────
Frontend: Landing       Backend: Comments API
                        Frontend: Widget comments
```

### Parallelization Strategy

| Agent | Phases | Total Hours |
|-------|--------|-------------|
| Backend Specialist | 0, 2, 5 | 12h |
| Frontend Specialist | 1, 4, 5 | 16h |
| Fullstack Specialist | 3 | 10h |

**Wall Time Estimate**: 18-22 hours with 3 parallel agents

---

## Success Metrics

### Quantitative
- Widget bundle size < 20KB gzipped
- Landing page Lighthouse score > 90
- Admin UI loads in < 1 second
- Full moderation flow in < 5 clicks

### Qualitative
- Widget design is "share-worthy"
- Admin UI feels efficient
- Landing page converts interest

---

## Risk Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scaffold has breaking issues | Low | Wave 0 validation |
| Widget bundle bloat | Medium | Strict vanilla JS, inline CSS |
| Admin UI scope creep | High | Defer features to backlog |
| CORS issues with embed | Low | Test in multiple contexts |
| D1 performance | Low | Existing indexes, monitor |

---

## Files to Create/Modify

### Modified
- `src/worker.ts` - Add admin routes, validation, rate limiting
- `schema.sql` - Add any missing indexes (if needed)
- `wrangler.toml` - Ensure bindings are correct

### Created
- `/admin/` - New Cloudflare Pages project
  - `package.json`
  - `vite.config.ts`
  - `src/App.tsx`
  - `src/pages/*.tsx`
  - `src/components/*.tsx`
- Landing page routes in admin project

---

## Next Steps

1. **Approve this plan** or request modifications
2. **Decompose into granular tasks** (/ultra-decompose)
3. **Sync to ClickUp** (/ultra-sync)
4. **Execute in waves** (/ultra-marathon)

---

*Plan created with sequential thinking analysis*
*Ready for decomposition phase*
