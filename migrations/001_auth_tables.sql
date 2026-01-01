-- Migration 001: Authentication & User Management Tables
-- Run with: wrangler d1 execute collective-vision-feedback --file=migrations/001_auth_tables.sql
-- Idempotent: Safe to run multiple times (uses IF NOT EXISTS)

PRAGMA foreign_keys = ON;

-- =============================================================================
-- CORE USER TABLES
-- =============================================================================

-- Users table: Core user accounts for admin/team access
-- Note: This is separate from end_users (anonymous widget users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,                    -- Argon2id hash, NULL if OAuth-only
  name TEXT,
  avatar_url TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sessions table: Active login sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,       -- SHA256 hash of session token
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,       -- SHA256 hash of reset token
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,       -- SHA256 hash of verification token
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- USER TABLE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_updated ON users(updated_at);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verify_token ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verification_tokens(user_id);

-- =============================================================================
-- TEAM & WORKSPACE MEMBERSHIP TABLES
-- =============================================================================

-- Team memberships: Links users to workspaces with roles
-- Role hierarchy: owner > admin > member > viewer
CREATE TABLE IF NOT EXISTS team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by TEXT,                       -- User ID who sent the invite
  accepted_at TEXT,                      -- When invitation was accepted
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, workspace_id)
);

-- Workspace invitations: Pending invites by email
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member', 'viewer')),
  token_hash TEXT UNIQUE NOT NULL,       -- SHA256 hash of invitation token
  invited_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,                      -- NULL until accepted
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- TEAM TABLE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_memberships_user ON team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON team_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_role ON team_memberships(workspace_id, role);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);

-- =============================================================================
-- OAUTH & API KEY TABLES
-- =============================================================================

-- OAuth state tokens: CSRF protection for OAuth flows
CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  state_hash TEXT UNIQUE NOT NULL,      -- SHA256 hash of state token
  provider TEXT NOT NULL CHECK(provider IN ('google', 'github')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- OAuth accounts: Links external auth providers to users
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'github')),
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  access_token TEXT,                    -- Access token (consider encryption for production)
  refresh_token TEXT,                   -- Refresh token (consider encryption for production)
  token_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

-- API keys: Programmatic access tokens
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id INTEGER,                  -- NULL = account-wide key
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,              -- First 8 chars for identification (cv_live_xx)
  key_hash TEXT UNIQUE NOT NULL,         -- SHA256 hash of full key
  scopes TEXT,                           -- JSON array: ["read", "write", "admin"]
  last_used_at TEXT,
  expires_at TEXT,                       -- NULL = never expires
  revoked_at TEXT,                       -- NULL = active
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- =============================================================================
-- OAUTH & API KEY INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_oauth_states_hash ON oauth_states(state_hash);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider ON oauth_accounts(provider, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);

-- =============================================================================
-- AUDIT LOG TABLE
-- =============================================================================

-- Audit log: Security and activity events
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,                          -- NULL for anonymous/system events
  workspace_id INTEGER,                  -- NULL for account-level events
  action TEXT NOT NULL,                  -- login, logout, password_change, api_key_created, etc.
  resource_type TEXT,                    -- user, workspace, feedback, api_key, session
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,                          -- JSON with action-specific details
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
);

-- =============================================================================
-- AUDIT LOG INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

SELECT 'Migration 001: Auth tables created successfully' AS status;
