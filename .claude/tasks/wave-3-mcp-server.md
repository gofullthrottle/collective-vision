# Wave 3: MCP Server + Agent Integration

**Duration**: 18-24 hours
**Dependencies**: Wave 2 (needs AI features for rich queries)
**Priority**: High (enables agent ecosystem)

---

## Epic 3.1: MCP Server Core (8h)

### Tasks

#### 3.1.1 MCP SDK Setup (2h)
- [ ] Install TypeScript MCP SDK
- [ ] Configure MCP server as Worker endpoint
- [ ] Set up tool registration system
- [ ] Implement JSON-RPC 2.0 handling
- [ ] Add error response formatting

**Files:**
- `src/mcp/server.ts`
- `src/mcp/tools/index.ts`

**Endpoint:**
- `POST /mcp` - Main MCP endpoint
- `GET /mcp/.well-known/mcp.json` - Discovery

**Acceptance Criteria:**
- MCP server responds to initialize
- Tool list returned on tools/list
- Errors properly formatted

#### 3.1.2 MCP Authentication (2h)
- [ ] API key authentication for MCP requests
- [ ] Extract workspace context from key
- [ ] Rate limiting per API key
- [ ] Scope validation (read/write permissions)

**Auth Flow:**
```typescript
// API key in header or tool parameter
Authorization: Bearer cv_mcp_xxxxx

// Or in tool input
{
  "method": "tools/call",
  "params": {
    "name": "list_feedback",
    "arguments": {
      "api_key": "cv_mcp_xxxxx", // pragma: allowlist secret
      "board_slug": "main"
    }
  }
}
```

**Acceptance Criteria:**
- Unauthorized requests rejected
- Keys scoped to workspace
- Usage tracked

#### 3.1.3 Tool Registration Framework (2h)
- [ ] Create tool definition interface
- [ ] JSON Schema generation for inputs
- [ ] Tool handler registration
- [ ] Input validation against schema
- [ ] Response formatting

**Tool Definition:**
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  handler: (input: unknown, context: MCPContext) => Promise<unknown>;
}
```

**Acceptance Criteria:**
- Tools easily definable
- Schemas auto-generated
- Validation automatic

#### 3.1.4 Error Handling & Logging (2h)
- [ ] MCP error codes (tool errors, auth errors, rate limits)
- [ ] Structured error responses
- [ ] Request/response logging
- [ ] Performance metrics

**Error Response:**
```json
{
  "error": {
    "code": -32000,
    "message": "Rate limit exceeded",
    "data": {
      "retry_after": 60,
      "limit": 100,
      "used": 100
    }
  }
}
```

**Acceptance Criteria:**
- Errors actionable for agents
- Logs don't leak sensitive data
- Metrics exportable

---

## Epic 3.2: MCP Query Tools (6h)

### Tasks

#### 3.2.1 list_feedback Tool (1.5h)
- [ ] List feedback with comprehensive filters
- [ ] Pagination support
- [ ] Sort options

**Input Schema:**
```json
{
  "board_slug": "string (required)",
  "status": "string[] (optional)",
  "tags": "string[] (optional)",
  "theme_id": "string (optional)",
  "sentiment_min": "number (optional)",
  "sentiment_max": "number (optional)",
  "urgency_min": "number (optional)",
  "created_after": "string (optional, ISO date)",
  "created_before": "string (optional)",
  "limit": "number (default 20, max 100)",
  "offset": "number (default 0)",
  "sort_by": "votes|created_at|priority|sentiment",
  "sort_order": "asc|desc"
}
```

**Output:**
```json
{
  "items": [...],
  "total": 150,
  "has_more": true
}
```

**Acceptance Criteria:**
- All filters work correctly
- Pagination handles large datasets
- Response time < 500ms

#### 3.2.2 get_feedback Tool (0.5h)
- [ ] Get single feedback item with full details
- [ ] Include vote count, comments, tags
- [ ] Include AI analysis (sentiment, themes)

**Input:**
```json
{
  "feedback_id": "string (required)"
}
```

**Acceptance Criteria:**
- Full item details returned
- 404 for non-existent items

#### 3.2.3 search_feedback Tool (1.5h)
- [ ] Semantic search across feedback
- [ ] Use vector similarity
- [ ] Combine with filters

**Input:**
```json
{
  "query": "string (required)",
  "board_slug": "string (optional)",
  "status": "string[] (optional)",
  "limit": "number (default 10)"
}
```

**Output:**
```json
{
  "items": [
    {
      "feedback": {...},
      "similarity_score": 0.92
    }
  ]
}
```

**Acceptance Criteria:**
- Semantic search returns relevant results
- Scores meaningful
- Fast response (< 1s)

#### 3.2.4 get_themes Tool (1h)
- [ ] List all themes for workspace
- [ ] Include item counts
- [ ] Include trend direction

**Input:**
```json
{
  "board_slug": "string (optional)"
}
```

**Output:**
```json
{
  "themes": [
    {
      "id": "theme_xxx",
      "name": "Mobile App Performance",
      "description": "...",
      "item_count": 45,
      "trend": "rising"
    }
  ]
}
```

**Acceptance Criteria:**
- All themes returned
- Counts accurate
- Trends calculated

#### 3.2.5 get_trends Tool (1h)
- [ ] Trending topics (new themes, spikes)
- [ ] Anomaly detection
- [ ] Time-based comparison

**Input:**
```json
{
  "timeframe": "7d|30d|90d",
  "board_slug": "string (optional)"
}
```

**Output:**
```json
{
  "trending_themes": [...],
  "anomalies": [
    {
      "type": "spike",
      "description": "3x normal volume for 'mobile crashes'",
      "severity": "high"
    }
  ],
  "summary": "This week saw a 25% increase in..."
}
```

**Acceptance Criteria:**
- Trends accurately detected
- Anomalies flagged
- Summary useful

#### 3.2.6 get_statistics Tool (0.5h)
- [ ] Aggregate stats for workspace/board
- [ ] Total items, votes, by status
- [ ] Sentiment distribution
- [ ] Top contributors

**Output:**
```json
{
  "total_feedback": 1250,
  "total_votes": 8500,
  "by_status": {
    "open": 450,
    "planned": 120,
    "in_progress": 80,
    "done": 600
  },
  "avg_sentiment": 0.35,
  "avg_resolution_time_days": 14
}
```

---

## Epic 3.3: MCP Write Tools (4h)

### Tasks

#### 3.3.1 submit_feedback Tool (1.5h)
- [ ] Create new feedback via MCP
- [ ] Source = 'mcp'
- [ ] Default to pending moderation
- [ ] Support metadata from agent

**Input:**
```json
{
  "board_slug": "string (required)",
  "title": "string (required)",
  "description": "string (optional)",
  "source_context": {
    "agent_id": "string",
    "original_source": "slack|reddit|support",
    "original_url": "string (optional)",
    "user_identifier": "string (optional)"
  }
}
```

**Behavior:**
- Creates with `moderation_state = 'pending'`
- Creates with `is_hidden = 1` (until approved)
- Queues for AI processing

**Acceptance Criteria:**
- Feedback created with proper attribution
- Pending until moderator approves
- AI processing triggered

#### 3.3.2 vote_feedback Tool (0.5h)
- [ ] Register vote from agent context
- [ ] Deduplicate by source context
- [ ] Return updated vote count

**Input:**
```json
{
  "feedback_id": "string (required)",
  "user_identifier": "string (optional for dedup)"
}
```

**Acceptance Criteria:**
- Votes tracked
- No double-voting per identifier
- Count returned

#### 3.3.3 add_comment Tool (1h)
- [ ] Add comment to feedback
- [ ] Mark as from agent
- [ ] Support internal comments

**Input:**
```json
{
  "feedback_id": "string (required)",
  "body": "string (required)",
  "is_internal": "boolean (default false)"
}
```

**Acceptance Criteria:**
- Comments added with agent attribution
- Internal comments hidden from public
- Notifications triggered

#### 3.3.4 update_status Tool (1h)
- [ ] Update feedback status
- [ ] Require appropriate permissions
- [ ] Add status change comment automatically

**Input:**
```json
{
  "feedback_id": "string (required)",
  "status": "open|under_review|planned|in_progress|done|declined",
  "comment": "string (optional, reason for change)"
}
```

**Acceptance Criteria:**
- Status updated
- History tracked
- Subscribers notified

---

## Epic 3.4: Agent Framework Integration (6h)

### Tasks

#### 3.4.1 MCP Documentation (2h)
- [ ] Complete tool documentation
- [ ] Authentication guide
- [ ] Example agent configurations
- [ ] Best practices for agents

**Docs:**
- `docs/mcp/README.md`
- `docs/mcp/tools-reference.md`
- `docs/mcp/authentication.md`
- `docs/mcp/examples.md`

**Acceptance Criteria:**
- Comprehensive documentation
- Working examples
- Copy-paste ready configs

#### 3.4.2 LangChain Tool Wrappers (2h)
- [ ] Create LangChain tool definitions
- [ ] Publish as npm package or example code
- [ ] Include authentication handling
- [ ] Document usage

**Example:**
```python
from langchain.tools import Tool
from collective_vision import CollectiveVisionClient

cv = CollectiveVisionClient(api_key="...")

list_feedback_tool = Tool(
    name="list_feedback",
    description="List feedback from Collective Vision",
    func=cv.list_feedback
)
```

**Acceptance Criteria:**
- Tools work with LangChain
- Easy to integrate
- Well documented

#### 3.4.3 Webhook System (2h)
- [ ] `POST /api/v1/workspaces/:id/webhooks` - create webhook
- [ ] Event types:
  - `feedback.created`
  - `feedback.status_changed`
  - `feedback.duplicate_detected`
  - `theme.new_detected`
  - `theme.spike_detected`
- [ ] Webhook payload signing
- [ ] Retry with exponential backoff

**Webhook Payload:**
```json
{
  "event": "feedback.created",
  "timestamp": "...",
  "data": {
    "feedback": {...}
  },
  "signature": "sha256=..."
}
```

**Acceptance Criteria:**
- Webhooks delivered reliably
- Signatures verifiable
- Failed webhooks retried

---

## Definition of Done for Wave 3

- [ ] MCP server responding to all defined tools
- [ ] Authentication working with API keys
- [ ] Query tools returning correct data
- [ ] Write tools creating/updating data
- [ ] Documentation complete
- [ ] At least one external agent tested
- [ ] Webhooks functional

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 3.1 MCP Server Core | 8h | High |
| 3.2 MCP Query Tools | 6h | Medium |
| 3.3 MCP Write Tools | 4h | Medium |
| 3.4 Agent Integration | 6h | Medium |

**Total: 24h (optimistic: 18h)**
