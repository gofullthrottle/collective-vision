-- Migration 003: MCP Server and Webhooks
-- Adds tables for MCP API keys and webhook subscriptions

-- MCP API Keys table
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT '["read"]', -- JSON array: ["read", "write"]
  is_active INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,
  requests_today INTEGER DEFAULT 0,
  last_request_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- Index for API key lookups
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_hash ON mcp_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_workspace ON mcp_api_keys(workspace_id);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT NOT NULL, -- JSON array of event types
  secret_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(workspace_id, is_active);

-- Webhook delivery log (for debugging)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms INTEGER
);

-- Index for delivery lookups
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_time ON webhook_deliveries(delivered_at);

-- Clean up old delivery logs (keep 7 days)
-- This would be run periodically via a scheduled worker
-- DELETE FROM webhook_deliveries WHERE delivered_at < datetime('now', '-7 days');

-- MCP usage tracking
CREATE TABLE IF NOT EXISTS mcp_usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id INTEGER NOT NULL REFERENCES mcp_api_keys(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  success INTEGER NOT NULL,
  duration_ms INTEGER,
  error_code INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for usage analytics
CREATE INDEX IF NOT EXISTS idx_mcp_usage_key ON mcp_usage_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_tool ON mcp_usage_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_usage_time ON mcp_usage_log(created_at);
