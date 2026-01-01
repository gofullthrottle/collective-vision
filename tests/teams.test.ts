/**
 * Team Routes Tests
 *
 * Tests for team membership management, invitations, and role-based access control.
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env, SELF } from "cloudflare:test";
import { generateId, hashToken, generateSecureToken, signJwt } from "../src/lib/auth";

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

describe("Team API", () => {
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let workspaceId: number;
  let ownerMembershipId: string;
  let adminMembershipId: string;
  let memberMembershipId: string;
  let viewerMembershipId: string;

  beforeAll(async () => {
    // Create tables
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
      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id TEXT PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'member', 'viewer')),
        token_hash TEXT UNIQUE NOT NULL,
        invited_by TEXT,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )
    `).run();
  });

  beforeEach(async () => {
    // Clean up
    await env.DB.prepare("DELETE FROM workspace_invitations").run();
    await env.DB.prepare("DELETE FROM team_memberships").run();
    await env.DB.prepare("DELETE FROM workspaces").run();
    await env.DB.prepare("DELETE FROM sessions").run();
    await env.DB.prepare("DELETE FROM users").run();

    // Create workspace
    await env.DB.prepare(
      "INSERT INTO workspaces (slug, name) VALUES ('test-workspace', 'Test Workspace')"
    ).run();
    const ws = await env.DB.prepare("SELECT id FROM workspaces WHERE slug = 'test-workspace'").first<{ id: number }>();
    workspaceId = ws!.id;

    // Create users
    const ownerId = generateId("usr");
    const adminId = generateId("usr");
    const memberId = generateId("usr");
    const viewerId = generateId("usr");
    const outsiderId = generateId("usr");

    await env.DB.prepare(
      "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
    ).bind(ownerId, "owner@example.com", "Owner User").run();
    await env.DB.prepare(
      "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
    ).bind(adminId, "admin@example.com", "Admin User").run();
    await env.DB.prepare(
      "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
    ).bind(memberId, "member@example.com", "Member User").run();
    await env.DB.prepare(
      "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
    ).bind(viewerId, "viewer@example.com", "Viewer User").run();
    await env.DB.prepare(
      "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
    ).bind(outsiderId, "outsider@example.com", "Outsider User").run();

    // Create memberships
    ownerMembershipId = generateId("mem");
    adminMembershipId = generateId("mem");
    memberMembershipId = generateId("mem");
    viewerMembershipId = generateId("mem");

    await env.DB.prepare(
      "INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at) VALUES (?, ?, ?, 'owner', datetime('now'))"
    ).bind(ownerMembershipId, ownerId, workspaceId).run();
    await env.DB.prepare(
      "INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at) VALUES (?, ?, ?, 'admin', datetime('now'))"
    ).bind(adminMembershipId, adminId, workspaceId).run();
    await env.DB.prepare(
      "INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at) VALUES (?, ?, ?, 'member', datetime('now'))"
    ).bind(memberMembershipId, memberId, workspaceId).run();
    await env.DB.prepare(
      "INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at) VALUES (?, ?, ?, 'viewer', datetime('now'))"
    ).bind(viewerMembershipId, viewerId, workspaceId).run();

    // Generate JWT tokens
    const secret = env.ADMIN_API_TOKEN || "test-secret";
    ownerToken = await signJwt({ sub: ownerId, email: "owner@example.com" }, secret, 3600);
    adminToken = await signJwt({ sub: adminId, email: "admin@example.com" }, secret, 3600);
    memberToken = await signJwt({ sub: memberId, email: "member@example.com" }, secret, 3600);
    viewerToken = await signJwt({ sub: viewerId, email: "viewer@example.com" }, secret, 3600);
    outsiderToken = await signJwt({ sub: outsiderId, email: "outsider@example.com" }, secret, 3600);
  });

  describe("GET /api/v1/workspaces/:workspace/team", () => {
    it("should list team members with roles", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team", viewerToken);
      expect(res.status).toBe(200);
      const data = await res.json() as { members: Array<{ user: { email: string }; role: string }> };
      expect(data.members).toHaveLength(4);
      // Sorted by role hierarchy
      expect(data.members[0].role).toBe("owner");
      expect(data.members[1].role).toBe("admin");
      expect(data.members[2].role).toBe("member");
      expect(data.members[3].role).toBe("viewer");
    });

    it("should require authentication", async () => {
      const res = await SELF.fetch("https://test.local/api/v1/workspaces/test-workspace/team");
      expect(res.status).toBe(401);
    });

    it("should require workspace membership", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team", outsiderToken);
      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent workspace", async () => {
      const res = await authedFetch("/api/v1/workspaces/nonexistent/team", ownerToken);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/workspaces/:workspace/team/invites", () => {
    it("should allow owner to invite new user", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", ownerToken, {
        method: "POST",
        body: JSON.stringify({ email: "newuser@example.com", role: "member" }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as { message: string; invitation_id: string };
      expect(data.message).toBe("Invitation sent");
      expect(data.invitation_id).toBeDefined();
    });

    it("should allow admin to invite new user", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", adminToken, {
        method: "POST",
        body: JSON.stringify({ email: "newuser2@example.com", role: "member" }),
      });
      expect(res.status).toBe(201);
    });

    it("should not allow member to invite", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", memberToken, {
        method: "POST",
        body: JSON.stringify({ email: "newuser3@example.com", role: "member" }),
      });
      expect(res.status).toBe(403);
    });

    it("should not allow viewer to invite", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", viewerToken, {
        method: "POST",
        body: JSON.stringify({ email: "newuser4@example.com", role: "member" }),
      });
      expect(res.status).toBe(403);
    });

    it("should add existing user directly", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", ownerToken, {
        method: "POST",
        body: JSON.stringify({ email: "outsider@example.com", role: "member" }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as { message: string; membership_id: string };
      expect(data.message).toBe("User added to team");
      expect(data.membership_id).toBeDefined();
    });

    it("should reject duplicate invitation", async () => {
      // First invitation
      await authedFetch("/api/v1/workspaces/test-workspace/team/invites", ownerToken, {
        method: "POST",
        body: JSON.stringify({ email: "newuser5@example.com", role: "member" }),
      });
      // Second invitation
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", ownerToken, {
        method: "POST",
        body: JSON.stringify({ email: "newuser5@example.com", role: "admin" }),
      });
      expect(res.status).toBe(409);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("PENDING_INVITATION");
    });

    it("should reject inviting existing member", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", ownerToken, {
        method: "POST",
        body: JSON.stringify({ email: "member@example.com", role: "admin" }),
      });
      expect(res.status).toBe(409);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("ALREADY_MEMBER");
    });
  });

  describe("POST /api/v1/invitations/:token/accept", () => {
    it("should accept valid invitation", async () => {
      // Create new user and invitation
      const newUserId = generateId("usr");
      await env.DB.prepare(
        "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
      ).bind(newUserId, "invitee@example.com", "Invitee User").run();

      const inviteToken = generateSecureToken();
      const tokenHash = await hashToken(inviteToken);
      const inviteId = generateId("inv");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(
        "INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(inviteId, workspaceId, "invitee@example.com", "member", tokenHash, expiresAt).run();

      const secret = env.ADMIN_API_TOKEN || "test-secret";
      const inviteeToken = await signJwt({ sub: newUserId, email: "invitee@example.com" }, secret, 3600);

      const res = await authedFetch(`/api/v1/invitations/${inviteToken}/accept`, inviteeToken, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const data = await res.json() as { message: string; workspace: { slug: string }; role: string };
      expect(data.message).toBe("Invitation accepted");
      expect(data.workspace?.slug).toBe("test-workspace");
      expect(data.role).toBe("member");
    });

    it("should reject expired invitation", async () => {
      const newUserId = generateId("usr");
      await env.DB.prepare(
        "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
      ).bind(newUserId, "expired@example.com", "Expired User").run();

      const inviteToken = generateSecureToken();
      const tokenHash = await hashToken(inviteToken);
      const inviteId = generateId("inv");
      const expiresAt = new Date(Date.now() - 1000).toISOString(); // Already expired

      await env.DB.prepare(
        "INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(inviteId, workspaceId, "expired@example.com", "member", tokenHash, expiresAt).run();

      const secret = env.ADMIN_API_TOKEN || "test-secret";
      const expiredUserToken = await signJwt({ sub: newUserId, email: "expired@example.com" }, secret, 3600);

      const res = await authedFetch(`/api/v1/invitations/${inviteToken}/accept`, expiredUserToken, {
        method: "POST",
      });
      expect(res.status).toBe(400);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("INVITATION_EXPIRED");
    });

    it("should reject wrong email", async () => {
      const newUserId = generateId("usr");
      await env.DB.prepare(
        "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
      ).bind(newUserId, "wrongemail@example.com", "Wrong Email User").run();

      const inviteToken = generateSecureToken();
      const tokenHash = await hashToken(inviteToken);
      const inviteId = generateId("inv");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(
        "INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(inviteId, workspaceId, "different@example.com", "member", tokenHash, expiresAt).run();

      const secret = env.ADMIN_API_TOKEN || "test-secret";
      const wrongEmailToken = await signJwt({ sub: newUserId, email: "wrongemail@example.com" }, secret, 3600);

      const res = await authedFetch(`/api/v1/invitations/${inviteToken}/accept`, wrongEmailToken, {
        method: "POST",
      });
      expect(res.status).toBe(403);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("EMAIL_MISMATCH");
    });
  });

  describe("PATCH /api/v1/workspaces/:workspace/team/:memberId", () => {
    it("should allow owner to change member role", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${memberMembershipId}`,
        ownerToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "admin" }),
        }
      );
      expect(res.status).toBe(200);
      const data = await res.json() as { message: string; new_role: string };
      expect(data.new_role).toBe("admin");
    });

    it("should allow admin to demote member to viewer", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${memberMembershipId}`,
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "viewer" }),
        }
      );
      expect(res.status).toBe(200);
    });

    it("should not allow admin to promote to admin", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${memberMembershipId}`,
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "admin" }),
        }
      );
      expect(res.status).toBe(403);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should not allow modifying owner", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${ownerMembershipId}`,
        ownerToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "admin" }),
        }
      );
      expect(res.status).toBe(403);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("CANNOT_MODIFY_OWNER");
    });

    it("should not allow self-modification", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${adminMembershipId}`,
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "viewer" }),
        }
      );
      expect(res.status).toBe(403);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("CANNOT_MODIFY_SELF");
    });

    it("should not allow member to change roles", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${viewerMembershipId}`,
        memberToken,
        {
          method: "PATCH",
          body: JSON.stringify({ role: "member" }),
        }
      );
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/workspaces/:workspace/team/:memberId", () => {
    it("should allow owner to remove member", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${memberMembershipId}`,
        ownerToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(200);
      const data = await res.json() as { message: string };
      expect(data.message).toBe("Member removed");
    });

    it("should allow admin to remove member", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${viewerMembershipId}`,
        adminToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(200);
    });

    it("should not allow admin to remove other admin", async () => {
      // First add another admin
      const newAdminId = generateId("usr");
      await env.DB.prepare(
        "INSERT INTO users (id, email, email_verified_at, name) VALUES (?, ?, datetime('now'), ?)"
      ).bind(newAdminId, "admin2@example.com", "Admin2 User").run();

      const newAdminMembershipId = generateId("mem");
      await env.DB.prepare(
        "INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at) VALUES (?, ?, ?, 'admin', datetime('now'))"
      ).bind(newAdminMembershipId, newAdminId, workspaceId).run();

      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${newAdminMembershipId}`,
        adminToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(403);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("INSUFFICIENT_PERMISSIONS");
    });

    it("should not allow removing owner", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${ownerMembershipId}`,
        ownerToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(403);
      const data = await res.json() as { error: { code: string } };
      expect(data.error.code).toBe("CANNOT_REMOVE_OWNER");
    });

    it("should allow member to leave (self-removal)", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/${memberMembershipId}`,
        memberToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(200);
      const data = await res.json() as { message: string };
      expect(data.message).toBe("Left workspace");
    });
  });

  describe("GET /api/v1/workspaces/:workspace/team/invites", () => {
    beforeEach(async () => {
      // Create pending invitation
      const inviteToken = generateSecureToken();
      const tokenHash = await hashToken(inviteToken);
      const inviteId = generateId("inv");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(
        "INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(inviteId, workspaceId, "pending@example.com", "member", tokenHash, expiresAt).run();
    });

    it("should allow admin to list invitations", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", adminToken);
      expect(res.status).toBe(200);
      const data = await res.json() as { invitations: Array<{ email: string; role: string }> };
      expect(data.invitations).toHaveLength(1);
      expect(data.invitations[0].email).toBe("pending@example.com");
    });

    it("should allow owner to list invitations", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", ownerToken);
      expect(res.status).toBe(200);
    });

    it("should not allow member to list invitations", async () => {
      const res = await authedFetch("/api/v1/workspaces/test-workspace/team/invites", memberToken);
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/v1/workspaces/:workspace/team/invites/:inviteId", () => {
    let inviteId: string;

    beforeEach(async () => {
      const inviteToken = generateSecureToken();
      const tokenHash = await hashToken(inviteToken);
      inviteId = generateId("inv");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(
        "INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(inviteId, workspaceId, "revokable@example.com", "member", tokenHash, expiresAt).run();
    });

    it("should allow admin to revoke invitation", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/invites/${inviteId}`,
        adminToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(200);
      const data = await res.json() as { message: string };
      expect(data.message).toBe("Invitation revoked");
    });

    it("should return 404 for non-existent invitation", async () => {
      const res = await authedFetch(
        "/api/v1/workspaces/test-workspace/team/invites/inv_nonexistent",
        adminToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(404);
    });

    it("should not allow member to revoke invitation", async () => {
      const res = await authedFetch(
        `/api/v1/workspaces/test-workspace/team/invites/${inviteId}`,
        memberToken,
        { method: "DELETE" }
      );
      expect(res.status).toBe(403);
    });
  });
});
