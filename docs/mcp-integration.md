# MCP Integration Guide

Collective Vision provides a Model Context Protocol (MCP) server that enables AI agents to interact with your feedback data programmatically.

## Overview

The MCP server exposes feedback operations as JSON-RPC 2.0 tools, allowing AI agents to:
- Query and search feedback items
- Submit new feedback from various sources
- Vote on and comment on feedback
- Update feedback status
- Get insights, themes, and trends

## Quick Start

### 1. Generate an API Key

```bash
# Via API (requires admin auth)
curl -X POST https://your-workspace.collective.vision/api/v1/your-workspace/api-keys \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Agent", "scopes": ["read", "write"]}'
```

The response includes your API key (format: `cv_mcp_xxxxxxxxxxxx`). Store it securely - it won't be shown again.

### 2. Discover Available Tools

```bash
curl https://your-workspace.collective.vision/mcp/.well-known/mcp.json
```

### 3. Make Tool Calls

```bash
curl -X POST https://your-workspace.collective.vision/mcp \
  -H "Authorization: Bearer cv_mcp_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "list_feedback",
      "arguments": {
        "status": "open",
        "limit": 10
      }
    }
  }'
```

## Available Tools

### Query Tools (read scope)

#### list_feedback
List feedback items with filtering and pagination.

**Parameters:**
- `board_slug` (string, optional): Filter by board
- `status` (string, optional): open, under_review, planned, in_progress, done, declined
- `tags` (array, optional): Filter by tag names
- `themes` (array, optional): Filter by theme IDs
- `sentiment_min` (number, optional): Minimum sentiment score (0-1)
- `sentiment_max` (number, optional): Maximum sentiment score (0-1)
- `created_after` (string, optional): ISO date filter
- `created_before` (string, optional): ISO date filter
- `sort_by` (string, optional): created_at, vote_count, sentiment_score, urgency_score
- `sort_order` (string, optional): asc, desc
- `limit` (number, optional): 1-100, default 20
- `offset` (number, optional): Pagination offset

**Response:**
```json
{
  "items": [...],
  "total": 150,
  "has_more": true
}
```

#### get_feedback
Get a single feedback item with full details.

**Parameters:**
- `feedback_id` (string, required): The feedback ID
- `include_comments` (boolean, optional): Include comments
- `include_votes` (boolean, optional): Include vote details

#### search_feedback
Semantic search across feedback using AI embeddings.

**Parameters:**
- `query` (string, required): Natural language search query
- `board_slug` (string, optional): Limit to specific board
- `limit` (number, optional): 1-50, default 10

**Response:**
```json
{
  "items": [
    {
      "feedback": {...},
      "similarity_score": 0.92
    }
  ],
  "total": 5
}
```

#### get_themes
List detected themes in feedback.

**Parameters:**
- `min_items` (number, optional): Minimum items in theme

**Response:**
```json
{
  "themes": [
    {
      "id": "theme_123",
      "name": "Mobile Performance",
      "description": "Issues related to mobile app speed",
      "item_count": 45,
      "trend": "rising"
    }
  ]
}
```

#### get_trends
Get trending topics and anomalies.

**Parameters:**
- `days` (number, optional): Analysis period (default 30)

**Response:**
```json
{
  "trending_themes": [
    {"id": "...", "name": "API Reliability", "growth_rate": 2.5}
  ],
  "anomalies": [
    {"type": "spike", "description": "3x increase in payment issues", "severity": "high"}
  ],
  "summary": "Payment-related feedback increased significantly..."
}
```

#### get_statistics
Get aggregate statistics for the workspace.

**Response:**
```json
{
  "total_feedback": 1250,
  "total_votes": 4500,
  "total_comments": 890,
  "by_status": {"open": 450, "in_progress": 120, ...},
  "by_source": {"widget": 800, "mcp": 250, "import": 200},
  "avg_sentiment": 0.65,
  "avg_urgency": 0.45,
  "top_themes": [...]
}
```

### Write Tools (write scope)

#### submit_feedback
Submit new feedback (goes to moderation queue).

**Parameters:**
- `board_slug` (string, required): Target board
- `title` (string, required): Feedback title (max 160 chars)
- `description` (string, optional): Detailed description (max 4000 chars)
- `source_context` (object, optional): Metadata about the source
  - `agent_id`: Your agent identifier
  - `original_source`: Where feedback originated (e.g., "reddit", "discord")
  - `original_url`: Link to original content
  - `user_identifier`: Unique user ID for deduplication

**Response:**
```json
{
  "id": 123,
  "title": "...",
  "board_slug": "...",
  "status": "open",
  "moderation_state": "pending",
  "message": "Feedback submitted. Will be visible after moderation."
}
```

#### vote_feedback
Register a vote on feedback.

**Parameters:**
- `feedback_id` (string, required): The feedback ID
- `user_identifier` (string, optional): Unique identifier for vote deduplication

**Response:**
```json
{
  "success": true,
  "vote_count": 45,
  "already_voted": false
}
```

#### add_comment
Add a comment to feedback.

**Parameters:**
- `feedback_id` (string, required): The feedback ID
- `body` (string, required): Comment text (max 4000 chars)
- `is_internal` (boolean, optional): Team-only comment

#### update_status
Update feedback status (triggers webhook).

**Parameters:**
- `feedback_id` (string, required): The feedback ID
- `status` (string, required): New status
- `comment` (string, optional): Status change explanation

## Authentication

### API Key Authentication

Include your API key in requests using either:

1. **Authorization Header** (recommended):
```
Authorization: Bearer cv_mcp_your_api_key
```

2. **Request Parameter**:
```json
{
  "params": {
    "name": "list_feedback",
    "arguments": {
      "api_key": "cv_mcp_your_api_key", // pragma: allowlist secret
      ...
    }
  }
}
```

### Rate Limiting

- 1000 requests per day per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Remaining`: Requests remaining today
  - `X-RateLimit-Reset`: When limit resets (ISO timestamp)

### Scopes

- `read`: Query tools only
- `write`: All tools including mutations

## Webhooks

Subscribe to real-time events when feedback changes.

### Available Events
- `feedback.created`
- `feedback.updated`
- `feedback.status_changed`
- `feedback.voted`
- `comment.created`
- `theme.detected`
- `duplicate.suggested`

### Webhook Payload
```json
{
  "event": "feedback.status_changed",
  "timestamp": "2025-12-31T12:00:00Z",
  "workspace_id": 123,
  "data": {
    "feedback_id": 456,
    "previous_status": "open",
    "new_status": "in_progress"
  }
}
```

### Signature Verification
```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## Error Handling

### JSON-RPC Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC structure |
| -32601 | Method Not Found | Unknown method |
| -32602 | Invalid Params | Invalid parameters |
| -32603 | Internal Error | Server error |
| -32000 | Unauthorized | Invalid/missing API key |
| -32001 | Forbidden | Insufficient permissions |
| -32002 | Not Found | Resource not found |
| -32003 | Rate Limited | Rate limit exceeded |

### Error Response Example
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "error": {
    "code": -32001,
    "message": "Write permission required for this tool",
    "data": {
      "required": "write",
      "provided": ["read"]
    }
  }
}
```

## Example: LangChain Integration

```python
from langchain.tools import StructuredTool
from langchain_anthropic import ChatAnthropic
import httpx

class CollectiveVisionMCP:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.client = httpx.Client()

    def call_tool(self, tool_name: str, arguments: dict) -> dict:
        response = self.client.post(
            f"{self.base_url}/mcp",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            json={
                "jsonrpc": "2.0",
                "id": "1",
                "method": "tools/call",
                "params": {
                    "name": tool_name,
                    "arguments": arguments
                }
            }
        )
        result = response.json()
        if "error" in result:
            raise Exception(result["error"]["message"])
        return result["result"]

# Create LangChain tools
cv = CollectiveVisionMCP(
    api_key="cv_mcp_xxx",  # pragma: allowlist secret
    base_url="https://your-workspace.collective.vision"
)

search_tool = StructuredTool.from_function(
    func=lambda query: cv.call_tool("search_feedback", {"query": query}),
    name="search_feedback",
    description="Search feedback using natural language"
)

submit_tool = StructuredTool.from_function(
    func=lambda title, description: cv.call_tool("submit_feedback", {
        "board_slug": "general",
        "title": title,
        "description": description
    }),
    name="submit_feedback",
    description="Submit new feedback"
)

# Use with Claude
llm = ChatAnthropic(model="claude-sonnet-4-20250514")
llm_with_tools = llm.bind_tools([search_tool, submit_tool])
```

## Example: Claude Desktop MCP Config

```json
{
  "mcpServers": {
    "collective-vision": {
      "command": "curl",
      "args": ["-s", "https://your-workspace.collective.vision/mcp"],
      "env": {
        "CV_API_KEY": "cv_mcp_your_api_key"  // pragma: allowlist secret
      }
    }
  }
}
```

## Best Practices

1. **Use semantic search** for finding related feedback before submitting new items
2. **Include source_context** when submitting feedback from external sources
3. **Subscribe to webhooks** for real-time updates instead of polling
4. **Handle rate limits gracefully** with exponential backoff
5. **Use specific scopes** - request only the permissions you need
