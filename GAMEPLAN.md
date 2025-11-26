# Collective Vision – Implementation Gameplan

This document tells an agent (e.g., GPT-5.1-Codex running in this repo) **what to build and how**, based on the current concept and initial Cloudflare/D1 scaffold.

Your goal: turn this into a production-ready, AI-native feedback platform that is trivial to embed (like Mintlify for docs) and cheap to run on Cloudflare.

---

## 1. MVP Scope

### 1.1 Actors
- **End User (Visitor)**: Submits ideas, votes, and (later) comments via an embedded widget or public board.
- **Product Admin/Moderator**: Curates feedback, updates statuses, moderates/filters items, manages tags.
- **Workspace Owner**: Configures workspace/boards, branding, and integrations (Jira/Linear/etc. later).

### 1.2 Core Flows (MVP)
- Public feedback board per product via `(workspace_slug, board_slug)`.
- End users can:
  - View top ideas for a board.
  - Submit a new idea with optional description.
  - Upvote existing ideas (1 vote per user per item).
- Admins (initially via JSON API, later via UI) can:
  - Change feedback `status` (e.g., `open`, `under_review`, `planned`, `in_progress`, `done`, `declined`).
  - Toggle visibility (`is_hidden`).
  - Control moderation (`moderation_state`: `pending`, `approved`, `rejected`).

### 1.3 Moderation & MCP Alignment
- Each feedback item has:
  - `source` (`widget`, `api`, `mcp`, `import`, etc.).
  - `moderation_state` and `is_hidden`.
- Feedback from an MCP server or other automated sources can:
  - Default to `moderation_state = 'pending'` and `is_hidden = 1`.
  - Be surfaced in an admin UI for review (approve → becomes visible; reject → stays hidden/archived).

### 1.4 Multi-Tenancy Model
- **Workspaces** represent products or organizations.
- **Boards** represent specific feedback surfaces per workspace (e.g., “Product feedback”, “Internal roadmap ideas”).
- Tenancy is enforced by `workspace_id` on relevant tables and `(workspace_slug, board_slug)` in API paths.

---

## 2. Data Model (D1 Schema)

Backed by `schema.sql` in the repo root. Key tables:

- `workspaces` (`schema.sql:5`)
  - Fields: `id`, `slug` (unique), `name`, `created_at`.
  - Purpose: Multi-tenant boundary for all data.

- `boards` (`schema.sql:12`)
  - Fields: `id`, `workspace_id`, `slug`, `name`, `is_public`, `created_at`.
  - Constraints: `UNIQUE (workspace_id, slug)`.
  - Purpose: Named feedback boards per workspace.

- `end_users` (`schema.sql:23`)
  - Fields: `id`, `workspace_id`, `external_user_id`, `email`, `name`, `created_at`.
  - Constraints: `UNIQUE (workspace_id, external_user_id)` and `UNIQUE (workspace_id, email)`.
  - Purpose: Logical end user per workspace, keyed by an externally provided identifier or anonymous UID from the widget.

- `feedback_items` (`schema.sql:35`)
  - Fields: `id`, `board_id`, `author_id`, `title`, `description`, `status`, `source`, `moderation_state`, `is_hidden`, `created_at`, `updated_at`.
  - Purpose: Canonical feedback entity with status, moderation, and visibility.

- `feedback_votes` (`schema.sql:51`)
  - Fields: `id`, `feedback_id`, `user_id`, `weight`, `created_at`.
  - Constraints: `UNIQUE (feedback_id, user_id)` for one vote per user per item.
  - Purpose: Voting mechanism and basis for ranking.

- `feedback_comments` (`schema.sql:62`)
  - Fields: `id`, `feedback_id`, `author_id`, `body`, `is_internal`, `created_at`.
  - Purpose: Public and internal discussions per feedback item.

- `feedback_tags` & `feedback_item_tags` (`schema.sql:73`, `schema.sql:82`)
  - Tags per workspace and many-to-many relation between feedback and tags.
  - Purpose: Filtering, AI labeling, MCP queries by tag (e.g., “bug”, “feature_request”).

Indexes:
- `idx_feedback_board` on `(board_id, is_hidden, moderation_state, status)` for fast public listing.
- `idx_votes_feedback` on `feedback_id` for quick vote aggregation.

---

## 3. Cloudflare-Native Architecture

### 3.1 Surfaces
- **Cloudflare Worker API** (`src/worker.ts`):
  - `GET /health` – basic health check.
  - `GET /widget.js` – serves embeddable feedback widget script.
  - `GET /api/v1/:workspace/:board/feedback` – list public feedback items with vote counts.
  - `POST /api/v1/:workspace/:board/feedback` – create new feedback item.
  - `POST /api/v1/:workspace/:board/feedback/:id/votes` – upvote a feedback item.
- **Future**:
  - Admin UI as a Cloudflare Pages app using the same API origin.
  - MCP-specific routes or a sibling Worker using the same D1 binding.

### 3.2 Storage Layout
- **D1** (`wrangler.toml:7–11`):
  - Single relational store for all tenants.
  - Bound in the Worker as `env.DB: D1Database`.
- **Future KV / Durable Objects (optional)**:
  - KV for cached board configuration/branding and rate limits.
  - Durable Objects for real-time counters or higher-volume voting if needed.

### 3.3 Routing & Multi-Tenancy
- API paths embed tenancy:
  - `/api/v1/:workspace_slug/:board_slug/feedback[...]`.
- Helper `getOrCreateWorkspaceAndBoard` (`src/worker.ts:315–365`):
  - Automatically creates a workspace and board if they don’t exist.
  - Allows teams to start using the widget immediately without a separate provisioning flow.

### 3.4 Deployment Topology
- Worker configured in `wrangler.toml`:
  - `main = "src/worker.ts"`, `name = "collective-vision-feedback"`.
  - D1 binding `DB` with `database_name = "collective-vision-feedback"`.
- Typical commands:
  - `wrangler d1 create collective-vision-feedback` → paste `database_id` into `wrangler.toml`.
  - `wrangler d1 execute collective-vision-feedback --file=schema.sql` → apply schema.
  - `wrangler dev` / `wrangler deploy` → run locally or deploy.

### 3.5 Client Strategy (SPA vs Mobile App)
- **Primary client**: a single, responsive **SPA** (admin + public UI where needed) served via Cloudflare Pages and backed by the existing API.
- **Mobile behavior**:
  - Design the SPA to be fully responsive for phone and tablet layouts.
  - Make it **PWA-ready** (installable on iOS/Android home screens) so power users get an app-like experience without a separate native codebase.
- **Rationale**:
  - Minimizes multi-platform drift and keeps all features in one place while core flows and AI capabilities are still evolving.
  - Fits the Cloudflare-native, API-first architecture and keeps hosting/ops costs minimal.
- **Future native apps**:
  - Only consider dedicated iOS/Android apps once there is clear usage pull and specific native needs (deep notifications, offline, OS-level sharing, etc.).
  - Treat them as additional clients consuming the same HTTP API, not separate backends.

---

## 4. Current Scaffold (What Exists Now)

### 4.1 Worker Logic (`src/worker.ts`)

- **Widget Script Endpoint**
  - `GET /widget.js` returns `WIDGET_JS`, a self-contained script that:
    - Reads `data-workspace`, `data-board`, and optional `data-api-base` from the `<script>` tag.
    - Renders:
      - A heading (“Feedback”).
      - A list of top feedback items with an upvote button.
      - A form to submit new feedback (title + optional description).
    - Generates/stores an anonymous UID in `localStorage` under key `cv_uid`.
    - Calls the API to fetch items, submit new feedback, and register votes.

- **Widget Integration Example**
  ```html
  <script
    src="https://your-feedback-domain.com/widget.js"
    data-workspace="acme"
    data-board="main"
  ></script>
  ```
  - Optional: `data-api-base="https://api.your-feedback-domain.com"` to point to a specific API origin.

- **API Routing**
  - `handleApi` (`src/worker.ts:280–313`) parses:
    - `GET /api/v1/:workspace/:board/feedback` → `listFeedback`.
    - `POST /api/v1/:workspace/:board/feedback` → `createFeedback`.
    - `POST /api/v1/:workspace/:board/feedback/:id/votes` → `voteOnFeedback`.
  - `withCors` adds permissive CORS headers and OPTIONS preflight handling for embedding (`src/worker.ts:262–277`, `src/worker.ts:536–575`).

- **Tenant Helpers**
  - `getOrCreateWorkspaceAndBoard`:
    - Ensures a workspace and board row exist for any `(workspace_slug, board_slug)` used by the widget.
  - `getOrCreateEndUser`:
    - Ensures an `end_users` row exists per `workspace_id` + `external_user_id`.

- **Core Handlers**
  - `listFeedback`:
    - Joins `feedback_items` with `feedback_votes` to compute `vote_count`.
    - Filters to `is_hidden = 0` and `moderation_state = 'approved'`.
    - Orders by `vote_count DESC, created_at DESC`.
  - `createFeedback`:
    - Inserts a new row into `feedback_items` with:
      - `status = 'open'`, `source = 'widget'`, `moderation_state = 'approved'`, `is_hidden = 0`.
    - Returns the created item in JSON.
  - `voteOnFeedback`:
    - Ensures a `user_id` exists via `getOrCreateEndUser`.
    - Uses `INSERT OR IGNORE` into `feedback_votes` to enforce one vote per `(feedback_id, user_id)`.
    - Returns updated `vote_count`.

---

## 5. Competitive Feature Matrix Structure

Design a spreadsheet or Notion table for comparing UserVoice, Canny, ProductBoard, Aha! Ideas, Featurebase, Supahub, BuildBetter.ai, and Zonka, plus Collective Vision (future).

### 5.1 Columns
- `Feature Group`
  - One of: Core Feedback Collection / Organization & Management / Prioritization & Analysis / Roadmapping & Planning / Communication & Closing the Loop / Analytics & Reporting / Integrations / Customization & Branding / Enterprise Features.
- `Feature Name`
- `Description`
- One column per competitor:
  - `UserVoice`, `Canny`, `ProductBoard`, `Aha! Ideas`, `Featurebase`, `Supahub`, `BuildBetter.ai`, `Zonka`.
  - Cell values: `✅` (has/strong), `⚠️` (partial/weak), `❌` (missing), `🤖` (AI-enhanced in that product).
- `AI-First Opportunity?` (`Y/N`).
- `Priority (P0/P1/P2)` for Collective Vision.
- `Effort (XS/S/M/L/XL)` for implementation.

### 5.2 Rows
- Use the feature bullets from `feedback-platform-analysis-prompt.md` as canonical rows.
  - Each bullet in sections A–I becomes a single row.
  - Add rows for any discovered capabilities unique to competitors or clearly missing from the prompt.

---

## 6. AI Capabilities Backlog Structure

Translate the conceptual AI ideas into a concrete backlog that can be incrementally built into the product.

### 6.1 Backlog Table

Columns:
- `Capability Name`
- `Category`
  - One of: Ingestion, Processing, Prioritization, Roadmapping, Communication, Continuous Learning, Agent Mesh/Interoperability.
- `Short Description`
- `Primary User`
  - PM, Exec, Support, Eng, or “System/Agents”.
- `Priority`
  - `P0` (must-have), `P1` (should-have), `P2` (nice-to-have).
- `Effort`
  - `XS/S/M/L/XL`.
- `Leverage (Time Saved/Week)`
  - Rough estimate of time saved for the product team if this capability exists.

### 6.2 High-Leverage P0 Candidates

Seed the backlog with at least these P0–P1 ideas:
- **Semantic Deduplication (P0, M)**:
  - Detect semantically similar feedback and suggest merges, across all channels (widget, MCP, imports).
- **Auto-Tagging & Intent Classification (P0, M)**:
  - Classify feedback into categories (product area, feature, “bug” vs. “feature request” vs. “question”).
- **Sentiment + Urgency Scoring (P0, S)**:
  - Derive an urgency/impact signal from sentiment and keywords (“broken”, “urgent”, “churn”).
- **Theme Clustering (P0, M)**:
  - Cluster feedback into themes that can be surfaced in the UI and queried via MCP.
- **AI Summaries per Item (P1, S)**:
  - Summarize long feedback threads for faster triage and reporting.
- **Dynamic Impact Score (P1, M)**:
  - Combine revenue/plan/segment data with volume and sentiment to score items.
- **AI Roadmap Drafting (P1, L)**:
  - Given constraints and priorities, propose a draft roadmap from top feedback.
- **Auto-Drafted Status Updates & Changelogs (P1, S)**:
  - Generate user-facing updates when items change status.
- **Trend & Anomaly Detection (P1, M)**:
  - Highlight emerging issues (e.g., sudden spike in “mobile crashes” feedback).
- **MCP Feedback Agent (P1, M)**:
  - Expose the feedback system as an MCP server with tools to:
    - Submit feedback from other agents.
    - Query items by tag/status.
    - Retrieve prioritized lists for planning.

---

## 7. Execution Notes for Codex

When you (GPT-5.1-Codex) are operating in this repo:
- **Short term (MVP)**:
  - Harden the existing Worker API (validation, error handling, simple rate limiting).
  - Add admin endpoints for:
    - Listing feedback with filters by status/moderation.
    - Updating `status`, `moderation_state`, `is_hidden`, and tags.
  - Scaffold a minimal admin UI (Cloudflare Pages) that:
    - Lists feedback per board.
    - Allows inline status/mode changes.
- **Medium term**:
  - Implement the feature matrix and AI backlog as planning artifacts (not user-facing).
  - Design and implement an MCP server surface on top of this D1 schema.
  - Incrementally ship P0 AI capabilities starting with semantic deduplication, auto-tagging, and theme clustering (backed by whichever model/tooling is available in the environment where this runs).

Prioritize changes that:
- Improve **feedback capture** (more boards, more channels).
- Improve **signal extraction** (tags, trends, AI analysis).
- Strengthen **distribution loops** (embeds, public boards, attribution links).

---

## 8. Requirements Trace to README.md

This section maps each feature bullet in `README.md` to where it appears in this GAMEPLAN, and whether it is part of the MVP or a future enhancement.

### 8.1 Core Requirements

1. **“A simple user feedback system where users can submit ideas, vote on them, and comment.”**
   - **Covered in GAMEPLAN**
     - Ideas + voting (MVP):
       - Section 1.2 – Core Flows (submit ideas, vote, view top ideas).
       - Section 2 – Data Model (`feedback_items`, `feedback_votes`).
     - Comments (planned, modeled but not yet wired into the widget/API):
       - Section 1.1 – Actors (“later” comments explicitly mentioned).
       - Section 2 – Data Model (`feedback_comments`).
       - Section 7 – Execution Notes (admin UI and richer board UX are the natural place to surface comments).

2. **“Build the system so that it can be easily integrated into any website, similar to Disqus, but for user feedback.”**
   - **Covered in GAMEPLAN (MVP)**
     - Section 3.1 – Surfaces (Cloudflare Worker API + `GET /widget.js`).
     - Section 4.1 – Worker Logic (Widget Script Endpoint and Widget Integration Example).
     - Section 3.3 – Routing & Multi-Tenancy (simple slug-based configuration via script tag attributes).

3. **“Build the system so I can very cheaply host it via CloudFlare.”**
   - **Covered in GAMEPLAN (MVP)**
     - Section 3 – Cloudflare-Native Architecture (Workers + D1, optional KV/DO).
     - Section 3.4 – Deployment Topology (wrangler-based deploy on Cloudflare).

4. **“Present a list of UserVoice.com features and competitors' features in order to identify any additional features to implement.”**
   - **Covered in GAMEPLAN (Planning Artifact)**
     - Section 5 – Competitive Feature Matrix Structure.
     - Section 5.1 / 5.2 – Columns and rows explicitly using UserVoice + competitors and the analysis prompt.

5. **“If the Product being reviewed is an MCP Server, then the MCP Server itself should have a tool for providing feedback on the MCP Server, and so our system should be able to integrate with that tool and receive the feedback (even if it means that the feedback is hidden until a moderator can approve it).”**
   - **Covered in GAMEPLAN (Planned, with schema support)**
     - Section 1.3 – Moderation & MCP Alignment (pending + hidden items for MCP-sourced feedback).
     - Section 2 – Data Model (`feedback_items.source`, `moderation_state`, `is_hidden`; `feedback_tags` for tagging).
     - Section 6.2 – MCP Feedback Agent (MCP server surface with tools to submit/query feedback).
     - Section 7 – Execution Notes (Medium term: “implement an MCP server surface on top of this D1 schema”).

### 8.2 Future Feature Enhancements

6. **“Monitor Reddit and other social media for mentions of the product and automatically create feedback entries.”**
   - **Partially covered (generic, not Reddit-specific)**
     - Section 6.1 – Backlog Table categories (Ingestion, Agent Mesh/Interoperability).
     - Section 6.2 – Semantic Deduplication, Auto-Tagging, Theme Clustering (the analysis layer once ingestion exists).
     - Section 7 – Execution Notes (more channels and agents over time).
   - **Note:** Specific Reddit/Twitter/etc. connectors are not enumerated yet; they belong as P1/P2 ingestion capabilities in the AI/agent backlog.

7. **“If a piece of feedback is created on Reddit, automagically sync any comments on Reddit to the feedback entry in our system.”**
   - **Partially covered (pattern, not specific implementation)**
     - Same areas as item 6 (multi-channel ingestion + AI/agent mesh).
   - **Note:** This is a concrete example of a two-way or multi-event ingestion connector and should be modeled as a specialized ingestion capability in the backlog.

8. **“Implement AI-powered sentiment analysis on user feedback to prioritize features.”**
   - **Explicitly covered**
     - Section 6.2 – Sentiment + Urgency Scoring (P0, S) used for prioritization.
     - Section 6.2 – Dynamic Impact Score (uses sentiment as one of the inputs).

9. **“Create a mobile app version of the feedback system for easier access.”**
   - **Not explicitly scoped yet**
     - Implicitly compatible with:
       - Section 3.1 – Surfaces (API-first architecture).
       - Section 4.1 – Worker Logic (HTTP API that a mobile client can consume).
   - **Note:** A mobile app should be treated as an additional client surface on top of the same API; it can be added under Surfaces in a future revision when prioritized.

10. **“Build in an MCP Server so that developers can use the MCP Server to query the feedback system for feedback items which have been tagged with specific tags (e.g., "bug", "feature request", etc.) and whether or not the team Administrator has marked the feedback item as being "Accepted" for implementation.”**
    - **Explicitly covered**
      - Section 2 – Data Model (tags and statuses designed for this use case).
      - Section 6.2 – MCP Feedback Agent (query by tag/status via MCP tools).
      - Section 7 – Execution Notes (Medium term: MCP server surface on this schema).

11. **“AI will deeply analyze feedback, user sentiment, emerging market trends, and perform a competitive analysis to recommend the most impactful features to implement next, and will perform sequential thinking in order to put together a proposed solution for the feedback.”**
    - **Covered conceptually with concrete capabilities**
      - Section 6.2 – Theme Clustering, Sentiment + Urgency Scoring, Dynamic Impact Score, AI Roadmap Drafting, AI Summaries, Trend & Anomaly Detection.
      - Section 5 – Competitive Feature Matrix (foundation for competitive analysis).

12. **“AI Agents constantly monitoring social media, git repositories, blogosphere, documentation searches and questions, Google Analytics data, Google Web Console Data, Microsoft Clarity Data, E-mails, Sentry Errors, RUM APM Data, Tracked User Sessions, and other sources to identify potential areas of improvement and automatically generate feedback entries for review by the product team.”**
    - **Covered at the pattern level (multi-channel agents)**
      - Section 6.1 – Category “Agent Mesh/Interoperability”.
      - Section 6.2 – MCP Feedback Agent (agents submitting/querying feedback).
      - Section 7 – Execution Notes (expanding channels and agents over time).
    - **Note:** Individual sources (GA, Clarity, Sentry, etc.) are not each listed; they are all examples of ingestion connectors the Agent Mesh can target.

13. **“Integrate with project management tools like Jira, Trello, or Asana to automatically create tasks based on user feedback.”**
    - **Covered as a planned integration area**
      - Section 1.1 – Actors (Workspace Owner: “integrations (Jira/Linear/etc. later)”).
      - Section 5 – Feature Matrix (Feature Group: Integrations).
      - Section 6.1 / 6.2 – Agent Mesh (integration agents that sync to PM tools).

14. **“AI Agents Active on Company Managed Discord Servers, Slack Workspaces, and other Communication Platforms to gather, engage with, and POST new feedback items based on MULTI-CHANNEL-WIDE user interactions and sentiments, and the responses to those. Upon decisions made regarding Feedback Items, AI Agents will go out in force to communicate those decisions to the users so that users feel heard, valued, and appreciated!”**
    - **Covered conceptually**
      - Section 6.1 – Categories: Ingestion, Communication, Agent Mesh/Interoperability.
      - Section 6.2 – Auto-Drafted Status Updates & Changelogs; MCP Feedback Agent (agents both ingest and communicate).
      - Section 7 – Execution Notes (distribution loops and additional channels).
    - **Note:** Specific Discord/Slack connectors should be added as concrete P1/P2 backlog items under Communication + Agent Mesh when detailing the AI/agent roadmap.

---

## 9. Growth & Distribution Hooks (Mintlify-Inspired)

This section aligns implementation with the separate strategy document `MINTLIFY-GROWTH-STRATEGY-FOR-FEEDBACK-PLATFORM.md`. That file is the detailed GTM thesis; this section only captures the key product-level hooks that code should support.

### 9.1 Design-Led Virality
- Treat the **embedded widget and public boards** as primary marketing surfaces:
  - Prioritize a “Linear-grade” visual design (clean, minimal, fast).
  - Keep the embed light and performant so teams are comfortable placing it on high-traffic pages.

### 9.2 Powered-By & Referral Loops
- Widget and public boards should include a **“Powered by Collective Vision”** badge by default:
  - Link to the main marketing/signup site.
  - Allow for tier-based behavior:
    - Free tier: badge always on.
    - Paid tiers: configurable/whitelabel options.
- On the **“Thank you for your feedback”** state:
  - Include an optional CTA like “Building your own product? Create a roadmap like this in 30 seconds.”
- Consider an experiment-friendly structure for:
  - “Tweet to remove badge” flows (free users can temporarily remove branding by sharing on social).
  - Dynamic copy in the badge based on board type (e.g., “Free for Open Source. Powered by Collective Vision.”).

### 9.3 Radical Freemium Constraints
- Product limits and metering should be designed with a **Radical Freemium** mindset:
  - Generous free tier oriented around number of boards/ideas/users so adoption is frictionless.
  - Clear “Growth”/“Pro” tiers unlock:
    - Branding controls.
    - Advanced AI capabilities.
    - Integrations (Jira/Linear/etc.).
- Implementation implication:
  - Add a simple notion of **plan tier** at the workspace level when you start implementing billing (not required for the very first MVP, but plan schema/API so it’s easy to add).

### 9.4 SEO & GEO-Ready Surfaces
- Public boards and roadmaps should:
  - Live on **stable, SEO-friendly URLs** (e.g., `/w/:workspace/boards/:board_slug` on the marketing/Pages app).
  - Expose metadata (titles, descriptions) that can be tuned to target:
    - “User feedback board”, “feature voting”, “AI feedback”, “product ideas portal”, and competitor-alternative keywords.
- Keep the backend/API neutral but:
  - Make sure responses include enough metadata (titles, descriptions, tags, status) for the marketing/SPA layer to render SEO-friendly pages and support **Generative Engine Optimization (GEO)** content.

### 9.5 Launch Cadence Support
- The codebase should make it easy to ship **clustered improvements** (Launch Weeks) as described in the growth doc:
  - Core Experience (boards, voting, basic AI).
  - Workflow (integrations, better admin UX).
  - Enterprise/Automation (MCP, advanced AI, SSO).
- That mainly means:
  - Keeping features modular.
  - Avoiding tight coupling so related improvements can be batched and highlighted together.
