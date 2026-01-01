/**
 * AI Routes Tests
 *
 * Tests for AI features: themes, duplicates, processing, and usage tracking.
 * Note: These tests mock AI/Vectorize bindings since they require remote resources.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { generateId, hashToken, signJwt, type JwtPayload } from "../src/lib/auth";

// Helper to create a valid JWT payload
function createJwtPayload(userId: string, email: string, expirySeconds = 3600): JwtPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: userId,
    email,
    iat: now,
    exp: now + expirySeconds,
  };
}

// Helper to create auth header
function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// Helper to make authenticated requests
async function authedFetch(path: string, token: string, options: RequestInit = {}) {
  return SELF.fetch(`https://test.local${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(token),
      ...(options.headers || {}),
    },
  });
}

describe("AI Routes", () => {
  let ownerToken: string;
  let memberToken: string;
  let workspaceId: number;
  let workspaceSlug: string;
  let boardId: string;
  let feedbackId1: string;
  let feedbackId2: string;

  beforeAll(async () => {
    // Create core tables
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        email_verified_at TEXT,
        password_hash TEXT,
        name TEXT,
        avatar_url TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT,
        settings TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS team_memberships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
        invited_by TEXT,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(user_id, workspace_id)
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        slug TEXT NOT NULL,
        name TEXT,
        description TEXT,
        is_public INTEGER DEFAULT 1,
        is_archived INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(workspace_id, slug)
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_items (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL,
        workspace_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'open',
        source TEXT DEFAULT 'widget',
        external_user_id TEXT,
        moderation_state TEXT DEFAULT 'approved',
        is_hidden INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ai_status TEXT DEFAULT 'pending',
        ai_processed_at TEXT,
        embedding_id TEXT,
        ai_type TEXT,
        ai_product_area TEXT,
        ai_confidence REAL,
        sentiment_score REAL,
        urgency_score REAL,
        urgency_level TEXT,
        priority_score REAL,
        ai_summary TEXT,
        theme_id TEXT,
        merged_into TEXT,
        merged_at TEXT,
        merged_by TEXT
      )
    `).run();

    // Create AI-specific tables
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS themes (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        item_count INTEGER DEFAULT 0,
        auto_generated INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS duplicate_suggestions (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL,
        suggested_duplicate_id TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(feedback_id, suggested_duplicate_id)
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        embeddings_count INTEGER DEFAULT 0,
        llm_calls_count INTEGER DEFAULT 0,
        vector_queries_count INTEGER DEFAULT 0,
        total_input_tokens INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(workspace_id, date)
      )
    `).run();

    // Need feedback_votes table for merge operation
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_votes (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL,
        user_id TEXT,
        weight INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(feedback_id, user_id)
      )
    `).run();

    // Need end_users table for some operations
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS end_users (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        external_user_id TEXT,
        email TEXT,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();

    // Need feedback_comments table for merge operation
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_comments (
        id TEXT PRIMARY KEY,
        feedback_id TEXT NOT NULL,
        author_id TEXT,
        body TEXT NOT NULL,
        is_internal INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();
  });

  beforeEach(async () => {
    // Clean up
    await env.DB.prepare("DELETE FROM ai_usage").run();
    await env.DB.prepare("DELETE FROM duplicate_suggestions").run();
    await env.DB.prepare("DELETE FROM themes").run();
    await env.DB.prepare("DELETE FROM feedback_votes").run();
    await env.DB.prepare("DELETE FROM feedback_comments").run();
    await env.DB.prepare("DELETE FROM end_users").run();
    await env.DB.prepare("DELETE FROM feedback_items").run();
    await env.DB.prepare("DELETE FROM boards").run();
    await env.DB.prepare("DELETE FROM team_memberships").run();
    await env.DB.prepare("DELETE FROM sessions").run();
    await env.DB.prepare("DELETE FROM workspaces").run();
    await env.DB.prepare("DELETE FROM users").run();

    // Create owner user
    const ownerId = generateId("user");
    await env.DB.prepare(`
      INSERT INTO users (id, email, email_verified_at, name)
      VALUES (?, ?, datetime('now'), ?)
    `).bind(ownerId, "owner@example.com", "Owner User").run();

    // Create member user
    const memberId = generateId("user");
    await env.DB.prepare(`
      INSERT INTO users (id, email, email_verified_at, name)
      VALUES (?, ?, datetime('now'), ?)
    `).bind(memberId, "member@example.com", "Member User").run();

    // Create workspace
    workspaceSlug = "ai-test-workspace";
    const wsResult = await env.DB.prepare(`
      INSERT INTO workspaces (slug, name) VALUES (?, ?)
    `).bind(workspaceSlug, "AI Test Workspace").run();
    workspaceId = wsResult.meta.last_row_id;

    // Create team memberships
    await env.DB.prepare(`
      INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at)
      VALUES (?, ?, ?, 'owner', datetime('now'))
    `).bind(generateId("memb"), ownerId, workspaceId).run();

    await env.DB.prepare(`
      INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at)
      VALUES (?, ?, ?, 'member', datetime('now'))
    `).bind(generateId("memb"), memberId, workspaceId).run();

    // Create sessions and tokens
    const secret = env.ADMIN_API_TOKEN || "test-secret";
    ownerToken = await signJwt(createJwtPayload(ownerId, "owner@example.com"), secret);
    const ownerSessionId = generateId("sess");
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', '+1 day'))
    `).bind(ownerSessionId, ownerId, await hashToken(ownerToken)).run();

    memberToken = await signJwt(createJwtPayload(memberId, "member@example.com"), secret);
    const memberSessionId = generateId("sess");
    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, datetime('now', '+1 day'))
    `).bind(memberSessionId, memberId, await hashToken(memberToken)).run();

    // Create board
    boardId = generateId("brd");
    await env.DB.prepare(`
      INSERT INTO boards (id, workspace_id, slug, name)
      VALUES (?, ?, 'main', 'Main Board')
    `).bind(boardId, workspaceId).run();

    // Create feedback items
    feedbackId1 = generateId("fb");
    feedbackId2 = generateId("fb");

    await env.DB.prepare(`
      INSERT INTO feedback_items (id, board_id, workspace_id, title, description, ai_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(feedbackId1, boardId, workspaceId, "Add dark mode", "Would love a dark theme option", "completed").run();

    await env.DB.prepare(`
      INSERT INTO feedback_items (id, board_id, workspace_id, title, description, ai_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(feedbackId2, boardId, workspaceId, "Night mode support", "Please add dark theme", "completed").run();
  });

  // =========================================================================
  // Themes API
  // =========================================================================

  describe("GET /api/v1/workspaces/:workspace/ai/themes", () => {
    it("should return empty themes list", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { themes: unknown[] };
      expect(body.themes).toEqual([]);
    });

    it("should return themes with item counts", async () => {
      // Create a theme
      const themeId = generateId("thm");
      await env.DB.prepare(`
        INSERT INTO themes (id, workspace_id, name, description)
        VALUES (?, ?, 'UI/UX', 'User interface feedback')
      `).bind(themeId, workspaceId).run();

      // Link feedback items to this theme to test count via JOIN
      await env.DB.prepare(`UPDATE feedback_items SET theme_id = ? WHERE id = ?`).bind(themeId, feedbackId1).run();
      await env.DB.prepare(`UPDATE feedback_items SET theme_id = ? WHERE id = ?`).bind(themeId, feedbackId2).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { themes: Array<{ id: string; name: string; item_count: number }> };
      expect(body.themes).toHaveLength(1);
      expect(body.themes[0].name).toBe("UI/UX");
      expect(body.themes[0].item_count).toBe(2);  // 2 feedback items linked
    });

    it("should require authentication", async () => {
      const resp = await SELF.fetch(`https://test.local/api/v1/workspaces/${workspaceSlug}/ai/themes`);
      expect(resp.status).toBe(401);
    });
  });

  describe("POST /api/v1/workspaces/:workspace/ai/themes", () => {
    it("should create a new theme", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes`, ownerToken, {
        method: "POST",
        body: JSON.stringify({ name: "Performance", description: "Speed and performance issues" }),
      });
      expect(resp.status).toBe(201);
      const body = await resp.json() as { id: string; name: string };
      expect(body.id).toMatch(/^theme_/);
      expect(body.name).toBe("Performance");
    });

    it("should require name", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes`, ownerToken, {
        method: "POST",
        body: JSON.stringify({ description: "No name provided" }),
      });
      expect(resp.status).toBe(400);
    });

    it("should require admin or owner role", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes`, memberToken, {
        method: "POST",
        body: JSON.stringify({ name: "Test Theme" }),
      });
      expect(resp.status).toBe(403);
    });
  });

  describe("PATCH /api/v1/workspaces/:workspace/ai/themes/:id", () => {
    it("should update theme", async () => {
      const themeId = generateId("thm");
      await env.DB.prepare(`
        INSERT INTO themes (id, workspace_id, name, description)
        VALUES (?, ?, 'Old Name', 'Old description')
      `).bind(themeId, workspaceId).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes/${themeId}`, ownerToken, {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name", description: "Updated description" }),
      });
      expect(resp.status).toBe(200);
      const body = await resp.json() as { message: string };
      expect(body.message).toBe("Theme updated");

      // Verify update in database
      const theme = await env.DB.prepare("SELECT name, description FROM themes WHERE id = ?").bind(themeId).first() as { name: string; description: string } | null;
      expect(theme?.name).toBe("New Name");
      expect(theme?.description).toBe("Updated description");
    });

    it("should return 404 for non-existent theme", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes/thm_nonexistent`, ownerToken, {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" }),
      });
      expect(resp.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/workspaces/:workspace/ai/themes/:id", () => {
    it("should delete theme", async () => {
      const themeId = generateId("thm");
      await env.DB.prepare(`
        INSERT INTO themes (id, workspace_id, name)
        VALUES (?, ?, 'To Delete')
      `).bind(themeId, workspaceId).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes/${themeId}`, ownerToken, {
        method: "DELETE",
      });
      expect(resp.status).toBe(200);

      // Verify deleted
      const check = await env.DB.prepare("SELECT * FROM themes WHERE id = ?").bind(themeId).first();
      expect(check).toBeNull();
    });
  });

  // =========================================================================
  // Duplicates API
  // =========================================================================

  describe("GET /api/v1/workspaces/:workspace/ai/duplicates", () => {
    it("should return empty duplicates list", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { duplicates: unknown[] };
      expect(body.duplicates).toEqual([]);
    });

    it("should return pending duplicates", async () => {
      // Create a duplicate suggestion
      const dupId = generateId("dup");
      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.92, 'pending')
      `).bind(dupId, feedbackId1, feedbackId2).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { duplicates: Array<{ id: string; similarity_score: number }> };
      expect(body.duplicates).toHaveLength(1);
      expect(body.duplicates[0].similarity_score).toBe(0.92);
    });

    it("should filter by status", async () => {
      const dupId1 = generateId("dup");
      const dupId2 = generateId("dup");

      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.92, 'pending')
      `).bind(dupId1, feedbackId1, feedbackId2).run();

      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.88, 'dismissed')
      `).bind(dupId2, feedbackId2, feedbackId1).run();

      // Default should only return pending
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates`, ownerToken);
      const body = await resp.json() as { duplicates: unknown[] };
      expect(body.duplicates).toHaveLength(1);

      // Get dismissed
      const resp2 = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates?status=dismissed`, ownerToken);
      const body2 = await resp2.json() as { duplicates: unknown[] };
      expect(body2.duplicates).toHaveLength(1);
    });
  });

  describe("POST /api/v1/workspaces/:workspace/ai/duplicates/:id", () => {
    it("should dismiss a duplicate", async () => {
      const dupId = generateId("dup");
      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.92, 'pending')
      `).bind(dupId, feedbackId1, feedbackId2).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates/${dupId}`, ownerToken, {
        method: "POST",
        body: JSON.stringify({ action: "dismiss" }),
      });
      expect(resp.status).toBe(200);
      const body = await resp.json() as { message: string };
      expect(body.message).toBe("Duplicate dismissed");

      // Verify status changed
      const check = await env.DB.prepare("SELECT status FROM duplicate_suggestions WHERE id = ?").bind(dupId).first() as { status: string } | null;
      expect(check?.status).toBe("dismissed");
    });

    it("should merge duplicates", async () => {
      const dupId = generateId("dup");
      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.92, 'pending')
      `).bind(dupId, feedbackId1, feedbackId2).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates/${dupId}`, ownerToken, {
        method: "POST",
        body: JSON.stringify({ action: "merge" }),
      });
      expect(resp.status).toBe(200);
      const body = await resp.json() as { message: string };
      expect(body.message).toBe("Feedback items merged");
    });

    it("should require valid action", async () => {
      const dupId = generateId("dup");
      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.92, 'pending')
      `).bind(dupId, feedbackId1, feedbackId2).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/duplicates/${dupId}`, ownerToken, {
        method: "POST",
        body: JSON.stringify({ action: "invalid" }),
      });
      expect(resp.status).toBe(400);
    });
  });

  describe("GET /api/v1/feedback/:id/duplicates", () => {
    it("should return duplicates for a feedback item", async () => {
      const dupId = generateId("dup");
      await env.DB.prepare(`
        INSERT INTO duplicate_suggestions (id, feedback_id, suggested_duplicate_id, similarity_score, status)
        VALUES (?, ?, ?, 0.92, 'pending')
      `).bind(dupId, feedbackId1, feedbackId2).run();

      const resp = await authedFetch(`/api/v1/feedback/${feedbackId1}/duplicates`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { duplicates: Array<{ feedback_id: string; similarity_score: number }> };
      expect(body.duplicates).toHaveLength(1);
      expect(body.duplicates[0].feedback_id).toBe(feedbackId2);
    });
  });

  // =========================================================================
  // AI Processing API
  // =========================================================================

  describe("POST /api/v1/workspaces/:workspace/ai/process", () => {
    it("should process specific feedback items", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/process`, ownerToken, {
        method: "POST",
        body: JSON.stringify({ feedback_ids: [feedbackId1] }),
      });
      // This will return 200 even without AI bindings, but processing would be skipped
      expect(resp.status).toBe(200);
      const body = await resp.json() as { processed: number; successful: number; failed: number };
      expect(body.processed).toBeGreaterThanOrEqual(1);
    });

    it("should require feedback_ids array", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/process`, ownerToken, {
        method: "POST",
        body: JSON.stringify({}),
      });
      expect(resp.status).toBe(400);
    });

    it("should require admin or owner role", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/process`, memberToken, {
        method: "POST",
        body: JSON.stringify({ feedback_ids: [feedbackId1] }),
      });
      expect(resp.status).toBe(403);
    });
  });

  describe("POST /api/v1/workspaces/:workspace/ai/process-pending", () => {
    it("should process all pending feedback", async () => {
      // Set feedback to pending
      await env.DB.prepare("UPDATE feedback_items SET ai_status = 'pending' WHERE id = ?").bind(feedbackId1).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/process-pending`, ownerToken, {
        method: "POST",
      });
      expect(resp.status).toBe(200);
      const body = await resp.json() as { processed: number; successful: number; failed: number } | { message: string; processed: number };
      expect(body.processed).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // AI Usage API
  // =========================================================================

  describe("GET /api/v1/workspaces/:workspace/ai/usage", () => {
    it("should return usage stats", async () => {
      // Add some usage data
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(`
        INSERT INTO ai_usage (id, workspace_id, date, embeddings_count, llm_calls_count, vector_queries_count, total_input_tokens, total_output_tokens)
        VALUES (?, ?, ?, 100, 50, 200, 5000, 1000)
      `).bind(generateId("usage"), workspaceId, today).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/usage`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as {
        period_days: number;
        totals: {
          embeddings: number;
          llm_calls: number;
          vector_queries: number;
          input_tokens: number;
          output_tokens: number;
        };
        daily: unknown[];
      };
      expect(body.period_days).toBe(30);
      expect(body.totals.embeddings).toBe(100);
      expect(body.totals.llm_calls).toBe(50);
      expect(body.totals.vector_queries).toBe(200);
      expect(body.totals.input_tokens).toBe(5000);
      expect(body.totals.output_tokens).toBe(1000);
    });

    it("should support custom period", async () => {
      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/usage?days=7`, ownerToken);
      expect(resp.status).toBe(200);
      const body = await resp.json() as { period_days: number };
      expect(body.period_days).toBe(7);
    });

    it("should require authentication", async () => {
      const resp = await SELF.fetch(`https://test.local/api/v1/workspaces/${workspaceSlug}/ai/usage`);
      expect(resp.status).toBe(401);
    });
  });

  // =========================================================================
  // Authorization Tests
  // =========================================================================

  describe("Authorization", () => {
    it("should reject requests for non-member workspaces", async () => {
      // Create a user not in the workspace
      const outsiderId = generateId("user");
      await env.DB.prepare(`
        INSERT INTO users (id, email, email_verified_at, name)
        VALUES (?, ?, datetime('now'), ?)
      `).bind(outsiderId, "outsider@example.com", "Outsider").run();

      const secret = env.ADMIN_API_TOKEN || "test-secret";
      const outsiderToken = await signJwt(createJwtPayload(outsiderId, "outsider@example.com"), secret);
      const sessionId = generateId("sess");
      await env.DB.prepare(`
        INSERT INTO sessions (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, datetime('now', '+1 day'))
      `).bind(sessionId, outsiderId, await hashToken(outsiderToken)).run();

      const resp = await authedFetch(`/api/v1/workspaces/${workspaceSlug}/ai/themes`, outsiderToken);
      expect(resp.status).toBe(403);
    });
  });
});
