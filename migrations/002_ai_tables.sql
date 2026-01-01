-- Migration 002: AI Infrastructure Tables
-- Run with: wrangler d1 execute collective-vision-feedback --file=migrations/002_ai_tables.sql
-- Idempotent: Safe to run multiple times (uses IF NOT EXISTS)

PRAGMA foreign_keys = ON;

-- =============================================================================
-- AI PROCESSING STATUS
-- =============================================================================

-- Track AI processing status for each feedback item
-- This allows us to know which items have been processed and when
ALTER TABLE feedback_items ADD COLUMN ai_status TEXT DEFAULT 'pending'
  CHECK(ai_status IN ('pending', 'processing', 'completed', 'failed', 'partial'));

ALTER TABLE feedback_items ADD COLUMN ai_processed_at TEXT;

-- Embedding ID reference (the vector ID in Vectorize)
ALTER TABLE feedback_items ADD COLUMN embedding_id TEXT;

-- =============================================================================
-- CLASSIFICATION & SCORING
-- =============================================================================

-- Feedback type classification
ALTER TABLE feedback_items ADD COLUMN ai_type TEXT
  CHECK(ai_type IN ('bug', 'feature_request', 'improvement', 'question', 'praise', 'complaint'));

-- Product area (inferred by AI)
ALTER TABLE feedback_items ADD COLUMN ai_product_area TEXT;

-- Classification confidence (0-1)
ALTER TABLE feedback_items ADD COLUMN ai_confidence REAL;

-- Sentiment score (-1 to +1)
ALTER TABLE feedback_items ADD COLUMN sentiment_score REAL;

-- Urgency score (0 to 1)
ALTER TABLE feedback_items ADD COLUMN urgency_score REAL;

-- Urgency level
ALTER TABLE feedback_items ADD COLUMN urgency_level TEXT
  CHECK(urgency_level IN ('normal', 'urgent', 'critical'));

-- Combined priority score (0-100)
ALTER TABLE feedback_items ADD COLUMN priority_score REAL;

-- AI-generated summary
ALTER TABLE feedback_items ADD COLUMN ai_summary TEXT;

-- =============================================================================
-- DUPLICATE DETECTION
-- =============================================================================

-- Duplicate suggestions table
CREATE TABLE IF NOT EXISTS duplicate_suggestions (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL,
  suggested_duplicate_id TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'merged', 'dismissed')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
  FOREIGN KEY (suggested_duplicate_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(feedback_id, suggested_duplicate_id)
);

-- Merged feedback tracking
ALTER TABLE feedback_items ADD COLUMN merged_into TEXT REFERENCES feedback_items(id);
ALTER TABLE feedback_items ADD COLUMN merged_at TEXT;
ALTER TABLE feedback_items ADD COLUMN merged_by TEXT REFERENCES users(id);

-- =============================================================================
-- THEME CLUSTERING
-- =============================================================================

-- Themes table for feedback clusters
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  item_count INTEGER DEFAULT 0,
  auto_generated INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Theme assignment
ALTER TABLE feedback_items ADD COLUMN theme_id TEXT REFERENCES themes(id);

-- =============================================================================
-- AI USAGE TRACKING (Cost Management)
-- =============================================================================

-- Track AI usage per workspace per day
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  embeddings_count INTEGER DEFAULT 0,
  llm_calls_count INTEGER DEFAULT 0,
  vector_queries_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE(workspace_id, date)
);

-- =============================================================================
-- AI JOB TRACKING (Dead Letter Queue)
-- =============================================================================

-- Dead letter jobs for manual review
CREATE TABLE IF NOT EXISTS ai_dead_letters (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  job_types TEXT NOT NULL, -- JSON array of failed job types
  failure_reason TEXT NOT NULL,
  last_error TEXT,
  original_job TEXT, -- Full job JSON for debugging
  retry_count INTEGER DEFAULT 0,
  resolved INTEGER DEFAULT 0,
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- TAGS - MARK AI TAGS
-- =============================================================================

-- Mark tags as AI-generated
ALTER TABLE feedback_tags ADD COLUMN is_ai_tag INTEGER DEFAULT 0;

-- =============================================================================
-- INDEXES
-- =============================================================================

-- AI processing status
CREATE INDEX IF NOT EXISTS idx_feedback_ai_status ON feedback_items(ai_status);
CREATE INDEX IF NOT EXISTS idx_feedback_ai_type ON feedback_items(ai_type);
CREATE INDEX IF NOT EXISTS idx_feedback_theme ON feedback_items(theme_id);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback_items(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON feedback_items(urgency_level);

-- Duplicate suggestions
CREATE INDEX IF NOT EXISTS idx_duplicates_feedback ON duplicate_suggestions(feedback_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_status ON duplicate_suggestions(status);

-- Themes
CREATE INDEX IF NOT EXISTS idx_themes_workspace ON themes(workspace_id);

-- AI usage
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace ON ai_usage(workspace_id, date);

-- Dead letters
CREATE INDEX IF NOT EXISTS idx_dead_letters_workspace ON ai_dead_letters(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dead_letters_resolved ON ai_dead_letters(resolved);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 'Migration 002: AI tables created successfully' AS status;
