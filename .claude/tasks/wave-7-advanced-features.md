# Wave 7: Advanced Features

**Duration**: 28-36 hours
**Dependencies**: Waves 2, 3, 4 (needs AI, MCP, analytics)
**Priority**: Medium (expansion features)

---

## Epic 7.1: Public Roadmaps (10h)

### Tasks

#### 7.1.1 Roadmap Data Model (1.5h)
- [ ] Create roadmap tables
- [ ] Phases (Now, Next, Later, etc.)
- [ ] Items linked to feedback
- [ ] Custom statuses per roadmap

**Database:**
```sql
CREATE TABLE roadmaps (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL DEFAULT 'Public Roadmap',
  slug TEXT NOT NULL,
  is_public INTEGER DEFAULT 1,
  settings TEXT, -- JSON config
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, slug)
);

CREATE TABLE roadmap_phases (
  id TEXT PRIMARY KEY,
  roadmap_id TEXT NOT NULL REFERENCES roadmaps(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE roadmap_items (
  id TEXT PRIMARY KEY,
  phase_id TEXT NOT NULL REFERENCES roadmap_phases(id),
  feedback_id TEXT REFERENCES feedback_items(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planned',
  target_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Acceptance Criteria:**
- Schema supports flexible roadmaps
- Phases customizable
- Items linkable to feedback

#### 7.1.2 Roadmap Management API (2h)
- [ ] CRUD for roadmaps
- [ ] CRUD for phases
- [ ] CRUD for items
- [ ] Drag-drop ordering
- [ ] Link feedback to roadmap items

**API:**
```
POST /api/v1/workspaces/:id/roadmaps
GET /api/v1/roadmaps/:id
PATCH /api/v1/roadmaps/:id
DELETE /api/v1/roadmaps/:id

POST /api/v1/roadmaps/:id/phases
PATCH /api/v1/phases/:id
DELETE /api/v1/phases/:id

POST /api/v1/phases/:id/items
PATCH /api/v1/items/:id
POST /api/v1/items/:id/reorder
```

**Acceptance Criteria:**
- Full CRUD working
- Ordering persisted
- Feedback linkage

#### 7.1.3 Public Roadmap Page (2.5h)
- [ ] SEO-friendly public URL: `/roadmap/:workspace/:slug`
- [ ] Responsive kanban-style view
- [ ] Phase columns with items
- [ ] Click to view item details
- [ ] Vote from roadmap (if enabled)

**URL:**
```
https://feedback.collective.vision/roadmap/acme/product
```

**Features:**
- Kanban board layout
- Phase headers with descriptions
- Item cards with vote counts
- Expandable item details
- Subscribe button

**Acceptance Criteria:**
- Beautiful public page
- SEO optimized (meta tags, OG)
- Mobile responsive

#### 7.1.4 Status Updates & Changelogs (2h)
- [ ] Changelog entries per workspace
- [ ] Link changelog to roadmap items
- [ ] Markdown content support
- [ ] Public changelog page

**Database:**
```sql
CREATE TABLE changelogs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Markdown
  version TEXT,
  published_at TEXT,
  roadmap_items TEXT, -- JSON array of item IDs
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Public Page:**
- Reverse chronological
- Version tags
- Linked features

**Acceptance Criteria:**
- Changelog entries creatable
- Public page live
- Items linked

#### 7.1.5 Subscriber Notifications (2h)
- [ ] Subscribe to roadmap updates
- [ ] Email on changelog publish
- [ ] Email on item status change
- [ ] Unsubscribe handling

**Notification Types:**
- New changelog published
- Item moved to new phase
- Item completed
- Weekly digest (optional)

**Acceptance Criteria:**
- Subscriptions working
- Emails sent correctly
- Unsubscribe easy

---

## Epic 7.2: Project Management Integrations (12h)

### Tasks

#### 7.2.1 Integration Framework (2h)
- [ ] OAuth flow handling
- [ ] Token storage and refresh
- [ ] Integration config per workspace
- [ ] Sync status tracking

**Database:**
```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL, -- Encrypted JSON
  status TEXT DEFAULT 'connected',
  last_sync_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE integration_mappings (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL REFERENCES integrations(id),
  feedback_id TEXT NOT NULL REFERENCES feedback_items(id),
  external_id TEXT NOT NULL,
  external_url TEXT,
  sync_direction TEXT DEFAULT 'both', -- to_external, from_external, both
  last_sync_at TEXT DEFAULT (datetime('now')),
  UNIQUE(integration_id, feedback_id)
);
```

**Acceptance Criteria:**
- OAuth flows working
- Tokens securely stored
- Refresh handling

#### 7.2.2 Jira Integration (3h)
- [ ] Jira Cloud OAuth
- [ ] Project selection
- [ ] Create Jira issue from feedback
- [ ] Sync status bidirectionally:
  - CV planned → Jira To Do
  - CV in_progress → Jira In Progress
  - CV done → Jira Done
- [ ] Link in both systems

**Field Mapping:**
```json
{
  "cv_field": "title",
  "jira_field": "summary"
},
{
  "cv_field": "description",
  "jira_field": "description"
},
{
  "cv_status_map": {
    "planned": "To Do",
    "in_progress": "In Progress",
    "done": "Done"
  }
}
```

**Acceptance Criteria:**
- Jira issues created
- Status synced both ways
- Links preserved

#### 7.2.3 Linear Integration (2.5h)
- [ ] Linear OAuth
- [ ] Team/project selection
- [ ] Create Linear issue from feedback
- [ ] Status sync

**Similar to Jira but for Linear's API**

**Acceptance Criteria:**
- Linear issues created
- Status synced
- Clean integration

#### 7.2.4 Asana Integration (2.5h)
- [ ] Asana OAuth
- [ ] Project selection
- [ ] Create Asana task from feedback
- [ ] Status sync via sections

**Acceptance Criteria:**
- Asana tasks created
- Sections mapped to status
- Links preserved

#### 7.2.5 GitHub Issues Integration (2h)
- [ ] GitHub OAuth
- [ ] Repository selection
- [ ] Create GitHub issue from feedback
- [ ] Label-based status sync
- [ ] Close issue when done

**Labels:**
- `cv:planned`
- `cv:in-progress`
- `cv:feedback-id:xxx`

**Acceptance Criteria:**
- Issues created
- Labels applied
- Status synced

---

## Epic 7.3: AI Roadmap Features (8h)

### Tasks

#### 7.3.1 AI-Powered Roadmap Drafting (3h)
- [ ] Analyze top feedback by theme
- [ ] Consider priority scores
- [ ] Generate proposed roadmap
- [ ] Suggest phase assignments
- [ ] Estimate relative sizing

**Algorithm:**
1. Get top N feedback by priority
2. Cluster by theme
3. LLM generates roadmap structure
4. Suggest phases and ordering
5. Present for human review

**LLM Prompt:**
```
Based on these top feedback items, create a product roadmap:

Themes:
1. Mobile App Performance (45 items, avg urgency 0.8)
2. API Improvements (32 items, avg urgency 0.5)
...

Generate a roadmap with 3-4 phases: Now, Next, Later, Future.
Assign themes to phases based on urgency and impact.
```

**Acceptance Criteria:**
- Draft roadmap generated
- Reasonable assignments
- Editable before publishing

#### 7.3.2 Priority Recommendations (2h)
- [ ] AI analyzes feedback corpus
- [ ] Considers votes, sentiment, revenue impact
- [ ] Recommends top priorities
- [ ] Explains reasoning

**Output:**
```json
{
  "recommendations": [
    {
      "feedback_id": "...",
      "title": "Mobile app crashes on startup",
      "score": 95,
      "reasoning": "High urgency (0.9), negative sentiment (-0.8), 120 votes, affects mobile users (40% of base)"
    }
  ]
}
```

**Acceptance Criteria:**
- Recommendations sensible
- Reasoning clear
- Actionable

#### 7.3.3 Status Update Generation (1.5h)
- [ ] Draft status update for item
- [ ] Summarize what was done
- [ ] Suggest user-facing message
- [ ] One-click publish

**Example:**
```
Based on commit messages and PR descriptions:

Draft Update:
"We've addressed the mobile app performance issues you reported.
The app now loads 60% faster on startup. Thank you to everyone
who voted and provided details!"
```

**Acceptance Criteria:**
- Drafts generated
- Editable
- One-click publish

#### 7.3.4 Release Notes Generation (1.5h)
- [ ] Aggregate completed items
- [ ] Generate release notes
- [ ] Format for changelog
- [ ] Include linked feedback

**Output:**
```markdown
## Version 2.5.0 - January 2025

### Improvements
- **Mobile Performance** - App now loads 60% faster (#FB-123, #FB-145)
- **API Rate Limits** - Increased limits for Pro users (#FB-201)

### Bug Fixes
- Fixed crash when uploading large images (#FB-189)

Thank you to the 450 users who voted on these features!
```

**Acceptance Criteria:**
- Notes generated
- Feedback linked
- Format publication-ready

---

## Epic 7.4: Comments Enhancement (4h)

### Tasks

#### 7.4.1 Threaded Comments (1.5h)
- [ ] Add parent_id to comments
- [ ] Nested display in UI
- [ ] Collapse/expand threads
- [ ] Reply button

**Database:**
```sql
ALTER TABLE feedback_comments ADD COLUMN parent_id TEXT
  REFERENCES feedback_comments(id);
```

**Acceptance Criteria:**
- Replies work
- Threads display correctly
- Collapse functional

#### 7.4.2 Internal Team Comments (0.5h)
- [ ] Internal flag on comments
- [ ] Only visible to team
- [ ] Visual distinction
- [ ] Filter in admin

**Acceptance Criteria:**
- Internal comments work
- Hidden from public
- Clear visual

#### 7.4.3 @Mentions & Notifications (1.5h)
- [ ] Parse @username in comments
- [ ] Notify mentioned users
- [ ] Link to user profile
- [ ] Autocomplete in input

**Acceptance Criteria:**
- Mentions detected
- Notifications sent
- Autocomplete working

#### 7.4.4 Rich Text Editing (0.5h)
- [ ] Markdown support in comments
- [ ] Preview mode
- [ ] Basic formatting toolbar
- [ ] Code blocks

**Acceptance Criteria:**
- Markdown renders
- Preview available
- Toolbar intuitive

---

## Definition of Done for Wave 7

- [ ] Public roadmap pages live
- [ ] Changelogs publishing
- [ ] Jira and Linear integrations working
- [ ] AI roadmap suggestions generating
- [ ] Threaded comments functional
- [ ] @mentions notifying users

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 7.1 Public Roadmaps | 10h | Medium |
| 7.2 PM Integrations | 12h | High |
| 7.3 AI Roadmap | 8h | High |
| 7.4 Comments | 4h | Low |

**Total: 36h (optimistic: 28h)**
