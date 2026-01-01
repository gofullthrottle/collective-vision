-- Migration 005: Wave 4-5 Platform Integrations and Analytics
-- Adds support for:
-- - Platform installations (Discord, Slack, Reddit OAuth)
-- - Workspace settings for brand monitoring
-- - Generated reports storage
-- - AI processing columns on feedback
-- - Analytics configuration per workspace/board

-- =============================================================================
-- PLATFORM INSTALLATIONS
-- =============================================================================
-- Stores OAuth tokens and installation data for platform integrations

CREATE TABLE IF NOT EXISTS platform_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL, -- 'discord', 'slack', 'reddit'
  team_id TEXT NOT NULL,
  team_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  bot_user_id TEXT,
  scope TEXT,
  webhook_url TEXT,
  channel_id TEXT,
  installed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (platform, team_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_installations_platform
  ON platform_installations(platform);

-- =============================================================================
-- WORKSPACE SETTINGS
-- =============================================================================
-- Extended settings for workspaces including brand monitoring and analytics

CREATE TABLE IF NOT EXISTS workspace_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL UNIQUE,
  -- Brand monitoring settings
  brand_monitoring_enabled INTEGER NOT NULL DEFAULT 0,
  keywords TEXT, -- JSON array of keywords
  platforms TEXT, -- JSON array of platforms to monitor
  last_crawl_at TEXT,
  crawl_frequency_hours INTEGER DEFAULT 6,
  -- Analytics settings
  analytics_enabled INTEGER NOT NULL DEFAULT 0,
  ga4_measurement_id TEXT,
  ga4_api_secret TEXT,
  clarity_project_id TEXT,
  custom_pixels TEXT, -- JSON array of custom pixel configurations
  -- Report settings
  reports_enabled INTEGER NOT NULL DEFAULT 0,
  daily_report_enabled INTEGER NOT NULL DEFAULT 0,
  weekly_report_enabled INTEGER NOT NULL DEFAULT 0,
  report_recipients TEXT, -- JSON array of email addresses
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- =============================================================================
-- GENERATED REPORTS
-- =============================================================================
-- Stores generated PDF reports for download/email

CREATE TABLE IF NOT EXISTS generated_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  report_type TEXT NOT NULL, -- 'daily', 'weekly', 'custom'
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON with report metadata and base64 PDF bytes
  file_size INTEGER,
  download_count INTEGER DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_workspace
  ON generated_reports(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_reports_type
  ON generated_reports(report_type, created_at DESC);

-- =============================================================================
-- AI PROCESSING COLUMNS ON FEEDBACK_ITEMS
-- =============================================================================
-- Add columns for AI classification and processing status

-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE
-- These will error if columns already exist - safe to ignore

ALTER TABLE feedback_items ADD COLUMN ai_processed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feedback_items ADD COLUMN ai_category TEXT; -- complaint, bug_report, feature_request, etc.
ALTER TABLE feedback_items ADD COLUMN ai_confidence REAL;
ALTER TABLE feedback_items ADD COLUMN sentiment_score REAL;
ALTER TABLE feedback_items ADD COLUMN relevance_score REAL;
ALTER TABLE feedback_items ADD COLUMN ai_reasoning TEXT;
ALTER TABLE feedback_items ADD COLUMN ai_suggested_tags TEXT; -- JSON array
ALTER TABLE feedback_items ADD COLUMN source_url TEXT;
ALTER TABLE feedback_items ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE feedback_items ADD COLUMN metadata TEXT; -- JSON for additional data

-- Add user_id column if it doesn't exist (for platform users)
ALTER TABLE feedback_items ADD COLUMN user_id INTEGER REFERENCES end_users(id);

CREATE INDEX IF NOT EXISTS idx_feedback_ai_processed
  ON feedback_items(ai_processed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_archived
  ON feedback_items(is_archived, created_at DESC);

-- =============================================================================
-- BOARD ANALYTICS SETTINGS
-- =============================================================================
-- Per-board analytics configuration (overrides workspace defaults)

CREATE TABLE IF NOT EXISTS board_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL UNIQUE,
  -- Analytics overrides
  analytics_enabled INTEGER, -- NULL means inherit from workspace
  ga4_measurement_id TEXT,
  custom_pixels TEXT, -- JSON array
  -- Display settings
  show_vote_count INTEGER DEFAULT 1,
  show_status INTEGER DEFAULT 1,
  allow_anonymous_voting INTEGER DEFAULT 1,
  require_moderation INTEGER DEFAULT 0,
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- =============================================================================
-- SAVED VIEWS
-- =============================================================================
-- User-created views with saved filters and display preferences

CREATE TABLE IF NOT EXISTS saved_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  -- View configuration
  filters TEXT NOT NULL, -- JSON: {statuses: [], tags: [], sources: [], dateRange: {}}
  sort_by TEXT DEFAULT 'created_at',
  sort_order TEXT DEFAULT 'desc',
  display_mode TEXT DEFAULT 'list', -- 'list', 'kanban', 'table'
  columns TEXT, -- JSON array of visible columns
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_views_workspace
  ON saved_views(workspace_id, is_public);

-- =============================================================================
-- DASHBOARD WIDGETS
-- =============================================================================
-- Customizable dashboard widgets for admin UI

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  user_id INTEGER,
  -- Widget configuration
  widget_type TEXT NOT NULL, -- 'status_chart', 'vote_trend', 'top_feedback', 'sentiment_gauge', 'source_breakdown'
  title TEXT,
  position INTEGER NOT NULL DEFAULT 0, -- Order in dashboard
  width TEXT DEFAULT 'half', -- 'full', 'half', 'third'
  height TEXT DEFAULT 'medium', -- 'small', 'medium', 'large'
  config TEXT, -- JSON widget-specific configuration
  -- Visibility
  is_visible INTEGER NOT NULL DEFAULT 1,
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_workspace
  ON dashboard_widgets(workspace_id, user_id, is_visible);

-- =============================================================================
-- USER SESSIONS (for scheduled cleanup)
-- =============================================================================
-- Session storage for OAuth and admin users

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
  ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON user_sessions(user_id);

-- =============================================================================
-- BRAND MENTIONS (crawled content)
-- =============================================================================
-- Stores discovered brand mentions for review

CREATE TABLE IF NOT EXISTS brand_mentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  -- Source information
  source TEXT NOT NULL, -- 'reddit', 'hackernews', 'twitter', 'web'
  source_url TEXT NOT NULL,
  source_id TEXT,
  source_author TEXT,
  -- Content
  title TEXT,
  content TEXT NOT NULL,
  -- AI analysis
  category TEXT, -- complaint, bug_report, feature_request, etc.
  confidence REAL,
  sentiment_score REAL,
  is_actionable INTEGER NOT NULL DEFAULT 0,
  ai_reasoning TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewed, converted, dismissed
  converted_feedback_id INTEGER,
  -- Timestamps
  discovered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (converted_feedback_id) REFERENCES feedback_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_brand_mentions_workspace
  ON brand_mentions(workspace_id, status, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_mentions_actionable
  ON brand_mentions(workspace_id, is_actionable, status);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
