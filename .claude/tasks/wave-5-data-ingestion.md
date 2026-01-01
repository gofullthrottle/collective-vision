# Wave 5: Data Ingestion & Migration

**Duration**: 25-32 hours
**Dependencies**: Wave 2 (needs semantic dedup for imports)
**Priority**: Medium (expands data sources)

---

## Epic 5.1: Import Infrastructure (6h)

### Tasks

#### 5.1.1 Import Job Management (2h)
- [ ] Create import job table
- [ ] Job states: pending, processing, completed, failed
- [ ] Progress tracking (processed/total)
- [ ] Error logging per item

**Database:**
```sql
CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  board_id TEXT NOT NULL REFERENCES boards(id),
  source_type TEXT NOT NULL,
  source_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  created_items INTEGER DEFAULT 0,
  duplicate_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  error_log TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE import_item_logs (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(id),
  source_id TEXT,
  status TEXT NOT NULL,
  feedback_id TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**API:**
```json
GET /api/v1/workspaces/:id/imports
POST /api/v1/workspaces/:id/imports
GET /api/v1/imports/:id
GET /api/v1/imports/:id/logs
```

**Acceptance Criteria:**
- Jobs trackable
- Progress visible
- Errors logged per item

#### 5.1.2 Duplicate Detection During Import (2h)
- [ ] Check each item against existing feedback
- [ ] Use semantic similarity (Wave 2)
- [ ] Options: skip, merge, create anyway
- [ ] Report duplicates in job summary

**Import Options:**
```json
{
  "duplicate_handling": "skip" | "merge" | "create",
  "similarity_threshold": 0.85
}
```

**Acceptance Criteria:**
- Duplicates detected during import
- User choice respected
- Stats accurate

#### 5.1.3 Source Attribution (1h)
- [ ] Store original source info
- [ ] Link to original URL if available
- [ ] Track import job ID on items
- [ ] Query by source

**Fields:**
```sql
ALTER TABLE feedback_items ADD COLUMN import_job_id TEXT;
ALTER TABLE feedback_items ADD COLUMN source_url TEXT;
ALTER TABLE feedback_items ADD COLUMN source_id TEXT;
```

**Acceptance Criteria:**
- Sources traceable
- Original links preserved
- Queryable by source

#### 5.1.4 Rollback Capability (1h)
- [ ] Delete all items from a failed import
- [ ] Soft delete with restore option
- [ ] Rollback confirmation required

**API:**
```json
POST /api/v1/imports/:id/rollback
{
  "confirm": true
}
```

**Acceptance Criteria:**
- Rollback cleans up
- Confirmation required
- Audit logged

---

## Epic 5.2: Platform-Specific Importers (10h)

### Tasks

#### 5.2.1 UserVoice Importer (2.5h)
- [ ] UserVoice API integration
- [ ] OAuth or API token auth
- [ ] Map UserVoice fields to Collective Vision:
  - Suggestion → Feedback
  - Category → Tags
  - Status → Status
  - Votes → Vote records
  - Comments → Comments
- [ ] Handle pagination
- [ ] Export file format support (.csv from UV)

**Field Mapping:**
```json
{
  "title": "suggestion.title",
  "description": "suggestion.text",
  "status": {"map": {"open": "open", "completed": "done", ...}},
  "votes": "suggestion.vote_count",
  "created_at": "suggestion.created_at"
}
```

**Acceptance Criteria:**
- Full UserVoice data imported
- Votes preserved
- Comments included

#### 5.2.2 Canny Importer (2.5h)
- [ ] Canny API integration
- [ ] API key authentication
- [ ] Field mapping:
  - Post → Feedback
  - Board → Board
  - Status → Status
  - Votes → Votes
  - Comments → Comments
- [ ] Handle categories and tags

**Acceptance Criteria:**
- Canny data fully imported
- Board structure preserved
- Status mapped correctly

#### 5.2.3 Productboard Importer (2.5h)
- [ ] Productboard API integration
- [ ] OAuth authentication
- [ ] Field mapping:
  - Insight → Feedback
  - Feature → Tag
  - Importance → Priority
- [ ] Handle attachments

**Acceptance Criteria:**
- Productboard insights imported
- Feature links preserved
- Importance mapped to priority

#### 5.2.4 Generic CSV Importer (2.5h)
- [ ] File upload endpoint
- [ ] Column mapping UI
- [ ] Preview before import
- [ ] Support various date formats
- [ ] Handle encoding issues (UTF-8, etc.)

**Flow:**
1. Upload CSV
2. Preview first 10 rows
3. Map columns to fields
4. Configure options (dedup, etc.)
5. Start import
6. Monitor progress

**Column Mapping UI:**
```
Your Column    →    Our Field
-----------         ---------
[Title      ]  →    [Title           ▼]
[Body       ]  →    [Description     ▼]
[Upvotes    ]  →    [Votes           ▼]
[Created    ]  →    [Created Date    ▼]
```

**Acceptance Criteria:**
- Any CSV importable
- Mapping intuitive
- Preview shows expected result

---

## Epic 5.3: Brand Mention Monitoring (8h)

### Tasks

#### 5.3.1 Firecrawl Integration Setup (2h)
- [ ] Firecrawl API configuration
- [ ] Store API key securely
- [ ] Test basic crawling
- [ ] Rate limiting awareness

**Environment:**
```
FIRECRAWL_API_KEY=fc_xxx
```

**Acceptance Criteria:**
- Firecrawl API accessible
- Rate limits respected
- Errors handled

#### 5.3.2 Brand Keyword Configuration (1.5h)
- [ ] Configure keywords per workspace
- [ ] Include product names, company name
- [ ] Negative keywords (exclude false positives)
- [ ] Test keyword matching

**Admin Config:**
```json
{
  "brand_monitoring": {
    "keywords": ["collective vision", "cv feedback", "our app"],
    "exclude": ["collective vision mutual fund"],
    "domains_to_watch": ["reddit.com", "twitter.com", "hn.algolia.com"]
  }
}
```

**Acceptance Criteria:**
- Keywords configurable
- Exclusions work
- Domain filtering

#### 5.3.3 Pain Point Detection (2h)
- [ ] LLM analysis of mentions
- [ ] Detect complaints, bugs, feature requests
- [ ] Filter noise (positive mentions, unrelated)
- [ ] Extract actionable feedback

**Detection Prompt:**
```
Analyze this mention of [brand]. Classify as:
- complaint: User is unhappy about something
- bug_report: User describing a problem
- feature_request: User wanting something new
- question: User needs help
- positive: Praise or recommendation
- unrelated: Not about the product

If it's a complaint, bug, or feature request, extract the core feedback.
```

**Acceptance Criteria:**
- Mentions accurately classified
- Noise filtered
- Actionable items extracted

#### 5.3.4 Automatic Feedback Creation (1.5h)
- [ ] Create feedback from relevant mentions
- [ ] Set source = 'firecrawl'
- [ ] Set moderation_state = 'pending'
- [ ] Include source URL
- [ ] Notify admin of new items

**Acceptance Criteria:**
- Feedback created automatically
- Requires moderation
- Source linked

#### 5.3.5 Scheduled Crawl Jobs (1h)
- [ ] Configure crawl schedule (daily, weekly)
- [ ] Run crawls in background
- [ ] Store crawl history
- [ ] Dedup against previous crawls

**Cron Schedule:**
```json
{
  "schedule": "0 6 * * *",  // Daily at 6 AM
  "sources": ["reddit", "twitter", "hacker_news"]
}
```

**Acceptance Criteria:**
- Crawls run on schedule
- No duplicate mentions
- History viewable

---

## Epic 5.4: Multi-Channel Listeners (8h)

### Tasks

#### 5.4.1 Reddit Monitoring (2.5h)
- [ ] Reddit API integration (OAuth)
- [ ] Subreddit watching
- [ ] Keyword alerts across Reddit
- [ ] Comment syncing for threads
- [ ] Rate limit handling (60 req/min)

**Configuration:**
```json
{
  "reddit": {
    "subreddits": ["r/SaaS", "r/webdev"],
    "keywords": ["collective vision", "feedback tool"],
    "sync_comments": true
  }
}
```

**Acceptance Criteria:**
- Reddit posts captured
- Comments synced
- Rate limits respected

#### 5.4.2 Discord Bot Integration (2h)
- [ ] Discord bot application
- [ ] Slash commands:
  - `/feedback submit` - Submit feedback
  - `/feedback status <id>` - Check status
- [ ] Channel monitoring (optional)
- [ ] Thread creation for discussions

**Bot Permissions:**
- Read Messages
- Send Messages
- Create Threads
- Use Slash Commands

**Acceptance Criteria:**
- Bot installable
- Commands working
- Feedback captured

#### 5.4.3 Slack App Integration (2h)
- [ ] Slack app manifest
- [ ] Slash commands (similar to Discord)
- [ ] Channel monitoring
- [ ] Message shortcuts (submit as feedback)

**Slash Commands:**
- `/cv submit [title]` - Submit feedback
- `/cv vote [id]` - Vote on item
- `/cv status [id]` - Check status

**Acceptance Criteria:**
- App installable
- Commands functional
- OAuth flow working

#### 5.4.4 Support Ticket Integration (1.5h)
- [ ] Webhook receivers for:
  - Zendesk
  - Intercom
  - HelpScout
- [ ] Map ticket fields to feedback
- [ ] Tag as 'support' source
- [ ] Link back to original ticket

**Webhook Payload (Zendesk example):**
```json
{
  "ticket_id": "12345",
  "subject": "App crashes on login",
  "description": "...",
  "priority": "high",
  "requester_email": "..."
}
```

**Acceptance Criteria:**
- Webhooks received
- Tickets converted
- Links preserved

---

## Definition of Done for Wave 5

- [ ] Import infrastructure complete
- [ ] UserVoice, Canny, Productboard importers working
- [ ] CSV import with mapping UI
- [ ] Brand monitoring capturing mentions
- [ ] Reddit monitoring active
- [ ] Discord and Slack bots functional
- [ ] Support ticket webhooks receiving

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 5.1 Import Infrastructure | 6h | Medium |
| 5.2 Platform Importers | 10h | Medium-High |
| 5.3 Brand Monitoring | 8h | High |
| 5.4 Multi-Channel Listeners | 8h | High |

**Total: 32h (optimistic: 25h)**
