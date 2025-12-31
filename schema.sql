-- D1 schema for Collective Vision feedback MVP

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS end_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  external_user_id TEXT,
  email TEXT,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, external_user_id),
  UNIQUE (workspace_id, email)
);

CREATE TABLE IF NOT EXISTS feedback_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  author_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, under_review, planned, in_progress, done, declined
  source TEXT,                         -- widget, api, mcp, import, etc.
  moderation_state TEXT NOT NULL DEFAULT 'approved', -- pending, approved, rejected
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES end_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS feedback_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES end_users(id) ON DELETE CASCADE,
  UNIQUE (feedback_id, user_id)
);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feedback_id INTEGER NOT NULL,
  author_id INTEGER,
  body TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES end_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS feedback_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS feedback_item_tags (
  feedback_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (feedback_id, tag_id),
  FOREIGN KEY (feedback_id) REFERENCES feedback_items(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES feedback_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedback_board
  ON feedback_items(board_id, is_hidden, moderation_state, status);

CREATE INDEX IF NOT EXISTS idx_votes_feedback
  ON feedback_votes(feedback_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
