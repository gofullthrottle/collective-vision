-- Migration 004: Import & Data Ingestion Infrastructure
-- Adds tables for import jobs, external sources, and brand monitoring

-- Import jobs table
CREATE TABLE IF NOT EXISTS import_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- uservoice, canny, csv, intercom, zendesk
  source_config TEXT, -- JSON config for source
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  imported_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  duplicate_items INTEGER DEFAULT 0,
  error_log TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace ON import_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

-- Import job items (individual records in an import)
CREATE TABLE IF NOT EXISTS import_job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_id TEXT, -- ID from source system
  status TEXT NOT NULL DEFAULT 'pending', -- pending, imported, duplicate, failed, skipped
  feedback_id INTEGER REFERENCES feedback_items(id),
  raw_data TEXT NOT NULL, -- JSON of original data
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_import_items_job ON import_job_items(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON import_job_items(status);

-- External sources (connected platforms for monitoring)
CREATE TABLE IF NOT EXISTS external_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- reddit, discord, slack, twitter, github, intercom
  name TEXT NOT NULL, -- User-friendly name
  config TEXT NOT NULL, -- JSON with credentials, subreddits, channels, etc.
  is_active INTEGER NOT NULL DEFAULT 1,
  sync_frequency TEXT DEFAULT 'hourly', -- hourly, daily, realtime
  last_sync_at TEXT,
  last_sync_status TEXT, -- success, failed, partial
  last_sync_error TEXT,
  items_synced_total INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_external_sources_workspace ON external_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_external_sources_active ON external_sources(workspace_id, is_active);

-- Brand mentions (monitored mentions)
CREATE TABLE IF NOT EXISTS brand_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- reddit, twitter, discord, etc.
  source_id TEXT, -- External ID (post ID, tweet ID)
  source_url TEXT, -- Link to original content
  source_author TEXT,
  source_subreddit TEXT, -- For Reddit
  source_channel TEXT, -- For Discord/Slack
  title TEXT,
  content TEXT NOT NULL,
  sentiment_score REAL,
  relevance_score REAL, -- How relevant to brand
  status TEXT DEFAULT 'new', -- new, reviewed, converted, ignored
  feedback_id INTEGER REFERENCES feedback_items(id), -- If converted to feedback
  metadata TEXT, -- JSON with additional source-specific data
  discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_brand_mentions_workspace ON brand_mentions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_status ON brand_mentions(status);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_source ON brand_mentions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_brand_mentions_discovered ON brand_mentions(discovered_at);

-- Brand keywords (what to monitor)
CREATE TABLE IF NOT EXISTS brand_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  keyword_type TEXT DEFAULT 'brand', -- brand, product, competitor
  is_active INTEGER NOT NULL DEFAULT 1,
  match_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brand_keywords_workspace ON brand_keywords(workspace_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_keywords_unique ON brand_keywords(workspace_id, keyword);

-- Listener configurations (multi-channel)
CREATE TABLE IF NOT EXISTS listener_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  listener_type TEXT NOT NULL, -- discord_webhook, slack_app, email_inbox, sentry, ga
  config TEXT NOT NULL, -- JSON configuration
  target_board_id INTEGER REFERENCES boards(id),
  auto_approve INTEGER DEFAULT 0, -- Whether to auto-approve incoming feedback
  filter_rules TEXT, -- JSON rules for filtering
  transform_template TEXT, -- Template for transforming data
  is_active INTEGER NOT NULL DEFAULT 1,
  events_received INTEGER DEFAULT 0,
  events_processed INTEGER DEFAULT 0,
  last_event_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_listener_configs_workspace ON listener_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_listener_configs_active ON listener_configs(workspace_id, is_active);

-- Listener events log
CREATE TABLE IF NOT EXISTS listener_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listener_id INTEGER NOT NULL REFERENCES listener_configs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  raw_payload TEXT NOT NULL,
  processed_payload TEXT,
  status TEXT DEFAULT 'pending', -- pending, processed, failed, ignored
  feedback_id INTEGER REFERENCES feedback_items(id),
  error_message TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_listener_events_listener ON listener_events(listener_id);
CREATE INDEX IF NOT EXISTS idx_listener_events_status ON listener_events(status);
CREATE INDEX IF NOT EXISTS idx_listener_events_received ON listener_events(received_at);
