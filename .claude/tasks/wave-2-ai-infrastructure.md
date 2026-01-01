# Wave 2: AI Infrastructure + P0 Capabilities

**Duration**: 35-45 hours
**Dependencies**: Wave 1 (needs auth for API access, user context)
**Priority**: Critical (core differentiator)

---

## Epic 2.1: AI Infrastructure Foundation (10h)

### Tasks

#### 2.1.1 Embedding Service Setup (2h)
- [ ] Configure Cloudflare Workers AI binding
- [ ] Create embedding utility module
- [ ] Implement `generateEmbedding(text)` function
- [ ] Use `@cf/baai/bge-base-en-v1.5` model (768 dimensions)
- [ ] Handle rate limits and errors
- [ ] Add caching for repeated texts

**Files:**
- `src/lib/ai/embeddings.ts`

**Code Example:**
```typescript
export async function generateEmbedding(
  ai: Ai,
  text: string
): Promise<number[]> {
  const result = await ai.run('@cf/baai/bge-base-en-v1.5', {
    text: [text]
  });
  return result.data[0];
}
```

**Acceptance Criteria:**
- Embeddings generated for any text
- Errors handled gracefully
- Response time < 500ms

#### 2.1.2 Vector Store Setup (2h)
- [ ] Create Vectorize index
- [ ] Configure with 768 dimensions (matching embedding model)
- [ ] Create vector operations utility
- [ ] Implement `upsertVector(id, embedding, metadata)`
- [ ] Implement `queryVectors(embedding, topK, filter)`
- [ ] Add index binding to wrangler.toml

**Commands:**
```bash
wrangler vectorize create feedback-embeddings --dimensions=768 --metric=cosine
```

**Files:**
- `src/lib/ai/vectors.ts`

**Acceptance Criteria:**
- Vectors can be stored and queried
- Metadata filtering works
- Query returns similarity scores

#### 2.1.3 LLM Integration for Classification (2h)
- [ ] Configure Claude API access (via environment)
- [ ] Create LLM utility module
- [ ] Implement `classifyFeedback(text)` function
- [ ] Use structured output for consistent results
- [ ] Handle API errors and rate limits
- [ ] Implement retry logic

**Files:**
- `src/lib/ai/llm.ts`

**Response Format:**
```typescript
interface ClassificationResult {
  type: 'bug' | 'feature_request' | 'question' | 'praise' | 'complaint';
  product_area: string | null;
  confidence: number;
  urgency_keywords: string[];
}
```

**Acceptance Criteria:**
- Claude API calls working
- Structured responses parsed correctly
- Fallback on API failure

#### 2.1.4 AI Processing Queue (2h)
- [ ] Create Cloudflare Queue for AI jobs
- [ ] Define job types: embed, classify, sentiment, theme
- [ ] Create producer function `enqueueAIJob(feedbackId, types[])`
- [ ] Create consumer that processes jobs
- [ ] Implement retry with exponential backoff
- [ ] Dead letter handling

**Files:**
- `src/lib/ai/queue.ts`
- `src/workers/ai-processor.ts`

**Acceptance Criteria:**
- Jobs processed asynchronously
- Failed jobs retried 3 times
- Dead letter queue for manual review

#### 2.1.5 Cost Tracking & Limits (2h)
- [ ] Track AI usage per workspace
- [ ] Count embedding generations
- [ ] Count LLM calls
- [ ] Enforce tier limits
- [ ] Alert on approaching limits

**Database:**
```sql
CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  embeddings_count INTEGER DEFAULT 0,
  llm_calls_count INTEGER DEFAULT 0,
  UNIQUE(workspace_id, date)
);
```

**Acceptance Criteria:**
- Usage tracked per day
- Limits enforced per tier
- Dashboard shows usage

---

## Epic 2.2: Semantic Deduplication (P0) (8h)

### Tasks

#### 2.2.1 Embedding on Feedback Creation (1.5h)
- [ ] Hook into feedback creation flow
- [ ] Generate embedding for title + description
- [ ] Store embedding ID in feedback_items
- [ ] Upsert to Vectorize with metadata

**Metadata:**
```json
{
  "feedback_id": "fb_xxx",
  "board_id": "board_xxx",
  "workspace_id": "ws_xxx",
  "created_at": "2024-..."
}
```

**Acceptance Criteria:**
- All new feedback gets embedded
- Embedding stored before response

#### 2.2.2 Duplicate Detection (2h)
- [ ] On new feedback, query similar vectors
- [ ] Filter to same workspace
- [ ] Threshold: 0.85 cosine similarity = likely duplicate
- [ ] Return top 3 candidates
- [ ] Store in `duplicate_suggestions` table

**Algorithm:**
```typescript
async function findDuplicates(feedbackId: string, embedding: number[]) {
  const similar = await vectorize.query(embedding, {
    topK: 5,
    filter: { workspace_id: workspaceId }
  });

  return similar.matches
    .filter(m => m.score > 0.85 && m.id !== feedbackId);
}
```

**Acceptance Criteria:**
- Duplicates detected within 2 seconds
- High-confidence matches flagged
- No false positives at 0.85 threshold

#### 2.2.3 Duplicate Suggestion API (1.5h)
- [ ] `GET /api/v1/feedback/:id/duplicates` - get suggestions
- [ ] `POST /api/v1/feedback/:id/duplicates/:suggestedId/merge` - merge
- [ ] `POST /api/v1/feedback/:id/duplicates/:suggestedId/dismiss` - dismiss

**Merge Logic:**
- Combine votes (no double-counting same user)
- Combine comments
- Keep newer title/description or let admin choose
- Mark merged item as hidden with reference

**Acceptance Criteria:**
- Admins can see duplicate suggestions
- Merge preserves all data
- Dismiss removes from suggestions

#### 2.2.4 Admin UI for Duplicates (2h)
- [ ] Duplicates review section in admin
- [ ] Show similarity score
- [ ] Side-by-side comparison
- [ ] One-click merge or dismiss
- [ ] Bulk actions

**Acceptance Criteria:**
- Intuitive duplicate review flow
- Can process duplicates quickly
- Merge action is reversible (soft delete)

#### 2.2.5 Batch Processing for Existing Feedback (1h)
- [ ] Script to embed all existing feedback
- [ ] Process in batches of 100
- [ ] Run duplicate detection on all
- [ ] Generate initial suggestions

**Acceptance Criteria:**
- Can run on existing data
- Progress reporting
- Handles interruption gracefully

---

## Epic 2.3: Auto-Tagging & Intent Classification (P0) (8h)

### Tasks

#### 2.3.1 Tag Taxonomy Definition (1h)
- [ ] Define default type tags:
  - `bug` - Something is broken
  - `feature_request` - New functionality wanted
  - `improvement` - Enhancement to existing
  - `question` - User needs help
  - `praise` - Positive feedback
  - `complaint` - Negative but not bug
- [ ] Define urgency tags:
  - `urgent` - Blocking work
  - `critical` - Major impact
- [ ] Allow workspace-custom tags

**Database:**
```sql
-- Mark tags as auto-generatable
ALTER TABLE feedback_tags ADD COLUMN is_ai_tag INTEGER DEFAULT 0;
```

#### 2.3.2 Classification Prompt Engineering (2h)
- [ ] Create classification prompt
- [ ] Include taxonomy in prompt
- [ ] Request structured JSON output
- [ ] Test on sample feedback
- [ ] Iterate until 90%+ accuracy

**Prompt Structure:**
```
Classify this user feedback. Return JSON with:
- type: one of [bug, feature_request, improvement, question, praise, complaint]
- product_area: inferred product area or null
- urgency: one of [normal, urgent, critical]
- confidence: 0-1 score

Feedback:
Title: {title}
Description: {description}
```

**Acceptance Criteria:**
- Consistent JSON output
- High accuracy on test set
- Handles edge cases

#### 2.3.3 Auto-Tag on Creation (2h)
- [ ] Call LLM classification after embedding
- [ ] Parse response and validate
- [ ] Create or find matching tags
- [ ] Associate tags with feedback
- [ ] Store AI tags separately from manual

**Flow:**
```typescript
async function autoTagFeedback(feedbackId: string) {
  const feedback = await getFeedback(feedbackId);
  const classification = await classifyFeedback(feedback);

  await applyTags(feedbackId, [
    classification.type,
    classification.urgency
  ], { source: 'ai' });
}
```

**Acceptance Criteria:**
- All new feedback auto-tagged
- AI tags visually distinct
- Manual tags not overwritten

#### 2.3.4 Tag Override UI (1.5h)
- [ ] Show AI-suggested tags in admin
- [ ] Allow confirm/reject/modify
- [ ] Track tag accuracy (accepted vs rejected)
- [ ] Use for model feedback

**Acceptance Criteria:**
- Easy to correct AI tags
- Corrections tracked for improvement
- Bulk tag editing possible

#### 2.3.5 Batch Classification for Existing (1.5h)
- [ ] Script to classify all untagged feedback
- [ ] Rate limit to avoid API costs
- [ ] Progress tracking
- [ ] Resume capability

**Acceptance Criteria:**
- Can process historical data
- Cost estimate before running
- Results reviewable before applying

---

## Epic 2.4: Sentiment + Urgency Scoring (P0) (5h)

### Tasks

#### 2.4.1 Sentiment Analysis (2h)
- [ ] Add sentiment to classification prompt
- [ ] Or use dedicated sentiment model
- [ ] Score from -1 (negative) to +1 (positive)
- [ ] Store in feedback_items.sentiment_score

**Acceptance Criteria:**
- Accurate sentiment detection
- Handles mixed sentiment
- Score stored with feedback

#### 2.4.2 Urgency Detection (1.5h)
- [ ] Define urgency keywords: "broken", "urgent", "blocking", "can't work", "critical", "ASAP", "immediately"
- [ ] Check for keywords in title/description
- [ ] LLM-enhanced urgency detection
- [ ] Score 0-1 for urgency
- [ ] Store in feedback_items.urgency_score

**Acceptance Criteria:**
- High urgency for blocking issues
- Keywords detected reliably
- Score correlates with actual urgency

#### 2.4.3 Combined Priority Score (1h)
- [ ] Calculate priority score:
  ```
  priority = (votes * 0.3) + (sentiment * -0.2) + (urgency * 0.5)
  ```
- [ ] Normalize to 0-100 scale
- [ ] Weight configurable per workspace

**Acceptance Criteria:**
- Priority score makes intuitive sense
- High urgency items surface quickly
- Negative sentiment boosts priority

#### 2.4.4 Priority Sorting in Admin (0.5h)
- [ ] Add priority column to feedback list
- [ ] Sort by priority option
- [ ] Filter by priority range
- [ ] Visual priority indicators

**Acceptance Criteria:**
- Priority visible in admin
- Sortable and filterable
- Color coding for quick scanning

---

## Epic 2.5: Theme Clustering (P0) (8h)

### Tasks

#### 2.5.1 Clustering Algorithm (2.5h)
- [ ] Implement k-means or HDBSCAN on embeddings
- [ ] Determine optimal cluster count dynamically
- [ ] Handle incremental clustering (new items)
- [ ] Re-cluster periodically (weekly)

**Approach:**
```typescript
async function clusterFeedback(workspaceId: string) {
  // Fetch all embeddings for workspace
  const embeddings = await getAllEmbeddings(workspaceId);

  // Run clustering
  const clusters = await runClustering(embeddings);

  // Update feedback items with theme_id
  await assignThemes(clusters);
}
```

**Acceptance Criteria:**
- Meaningful clusters generated
- Stable across runs
- Handles 1000+ items

#### 2.5.2 Theme Naming with LLM (1.5h)
- [ ] Generate theme name from cluster sample
- [ ] Use LLM to summarize theme
- [ ] Store theme name and description
- [ ] Auto-regenerate on significant changes

**Prompt:**
```
Here are 5 sample feedback items in a cluster:
1. {title1}
2. {title2}
...

Generate a short, descriptive name (3-5 words) for this theme and a one-sentence description.
```

**Acceptance Criteria:**
- Theme names are descriptive
- Descriptions explain the theme
- Names unique within workspace

#### 2.5.3 Theme Management (2h)
- [ ] `GET /api/v1/workspaces/:id/themes` - list themes
- [ ] `GET /api/v1/themes/:id` - theme details with items
- [ ] `PATCH /api/v1/themes/:id` - rename/edit theme
- [ ] `POST /api/v1/themes/:id/merge` - merge themes
- [ ] `DELETE /api/v1/themes/:id` - delete (items become unthemed)

**Acceptance Criteria:**
- Full CRUD on themes
- Merge preserves items
- Item counts accurate

#### 2.5.4 Theme UI in Admin (1.5h)
- [ ] Theme overview page
- [ ] Item count per theme
- [ ] Drill down to theme items
- [ ] Theme trend over time
- [ ] Visual theme distribution

**Acceptance Criteria:**
- Themes easily navigable
- Insights at a glance
- Can filter feedback by theme

#### 2.5.5 Incremental Theme Assignment (0.5h)
- [ ] On new feedback, find nearest theme
- [ ] Assign if similarity > threshold
- [ ] Otherwise mark as unthemed (for next clustering)

**Acceptance Criteria:**
- New items assigned quickly
- No cluster rerun needed for each item
- Periodic full re-cluster maintains quality

---

## Epic 2.6: AI Processing Pipeline (6h)

### Tasks

#### 2.6.1 Unified Processing Flow (2h)
- [ ] Create pipeline that runs on new feedback:
  1. Generate embedding
  2. Check for duplicates
  3. Classify intent/type
  4. Analyze sentiment/urgency
  5. Assign to theme
  6. Mark as AI processed
- [ ] Make pipeline idempotent
- [ ] Handle partial failures

**Files:**
- `src/lib/ai/pipeline.ts`

**Acceptance Criteria:**
- Full pipeline runs on creation
- Partial completion handled
- Can re-run failed steps

#### 2.6.2 Background Processing (2h)
- [ ] Move heavy AI work to Queue consumer
- [ ] Immediate response on feedback creation
- [ ] Status field for processing state
- [ ] Poll or webhook for completion

**States:**
- `pending` - Waiting in queue
- `processing` - Currently running
- `completed` - All AI tasks done
- `failed` - Needs manual intervention

**Acceptance Criteria:**
- Feedback creation < 500ms
- AI processing complete within 30s
- Status visible in admin

#### 2.6.3 Retry & Error Handling (1h)
- [ ] Retry failed steps individually
- [ ] Exponential backoff
- [ ] Dead letter after 3 failures
- [ ] Admin notification for dead letters

**Acceptance Criteria:**
- Transient failures recovered
- Permanent failures surfaced
- No data loss

#### 2.6.4 AI Processing Dashboard (1h)
- [ ] Show processing queue status
- [ ] Failed items list
- [ ] Retry button for failed
- [ ] Processing metrics (avg time, success rate)

**Acceptance Criteria:**
- Visibility into AI system health
- Easy retry of failures
- Metrics for optimization

---

## Definition of Done for Wave 2

- [ ] All new feedback gets embeddings
- [ ] Duplicate suggestions generated
- [ ] Auto-tagging working with 85%+ acceptance
- [ ] Sentiment and urgency scores populated
- [ ] Themes clustered and named
- [ ] Processing pipeline running in background
- [ ] Admin can review and manage AI outputs

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 2.1 AI Infrastructure | 10h | High |
| 2.2 Semantic Deduplication | 8h | High |
| 2.3 Auto-Tagging | 8h | Medium |
| 2.4 Sentiment + Urgency | 5h | Medium |
| 2.5 Theme Clustering | 8h | High |
| 2.6 Processing Pipeline | 6h | Medium |

**Total: 45h (optimistic: 35h)**
