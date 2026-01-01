/**
 * Auth API Tests
 *
 * Tests for authentication endpoints: signup, login, logout, token refresh,
 * email verification, and password reset flows.
 */

import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/worker";

// Test helpers
async function makeRequest(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: unknown }> {
  const request = new Request(`http://localhost${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

// Setup: create auth tables before tests
async function setupAuthTables() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT,
      avatar_url TEXT,
      email_verified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
}

// Cleanup helper
async function cleanupAuthTables() {
  await env.DB.prepare("DELETE FROM audit_logs").run();
  await env.DB.prepare("DELETE FROM password_reset_tokens").run();
  await env.DB.prepare("DELETE FROM email_verification_tokens").run();
  await env.DB.prepare("DELETE FROM sessions").run();
  await env.DB.prepare("DELETE FROM users").run();
}

describe("Auth API", () => {
  beforeEach(async () => {
    await setupAuthTables();
    await cleanupAuthTables();
  });

  describe("POST /api/v1/auth/signup", () => {
    it("should create a new user with valid data", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "SecurePass123!", // pragma: allowlist secret
          name: "Test User",
        }),
      });

      expect(status).toBe(201);
      const typedBody = body as {
        user: { id: string; email: string; name: string };
        message: string;
      };
      expect(typedBody.user).toBeDefined();
      expect(typedBody.user.email).toBe("test@example.com");
      expect(typedBody.user.name).toBe("Test User");
      expect(typedBody.message).toContain("verify your account");
    });

    it("should reject duplicate email", async () => {
      // First signup
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "SecurePass123!", // pragma: allowlist secret
        }),
      });

      // Duplicate attempt
      const { status, body } = await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "duplicate@example.com",
          password: "AnotherPass456!", // pragma: allowlist secret
        }),
      });

      expect(status).toBe(409);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("EMAIL_EXISTS");
    });

    it("should validate password length", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "short",
        }),
      });

      expect(status).toBe(400);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("VALIDATION_ERROR");
    });

    it("should validate email format", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "not-an-email",
          password: "SecurePass123!",
        }),
      });

      expect(status).toBe(400);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      // Create a verified user for login tests
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "login@example.com",
          password: "SecurePass123!",
        }),
      });
      // Manually verify the email for login test
      await env.DB.prepare(
        `UPDATE users SET email_verified = 1 WHERE email = 'login@example.com'`
      ).run();
    });

    it("should login with valid credentials", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "login@example.com",
          password: "SecurePass123!", // pragma: allowlist secret
        }),
      });

      expect(status).toBe(200);
      const typedBody = body as {
        user: { email: string };
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      expect(typedBody.user.email).toBe("login@example.com");
      expect(typedBody.access_token).toBeDefined();
      expect(typedBody.refresh_token).toBeDefined();
      expect(typedBody.expires_in).toBe(900);
    });

    it("should reject invalid password", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "login@example.com",
          password: "WrongPassword!", // pragma: allowlist secret
        }),
      });

      expect(status).toBe(401);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject non-existent user", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "SomePassword123!",
        }),
      });

      expect(status).toBe(401);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject unverified email", async () => {
      // Create unverified user
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "unverified@example.com",
          password: "SecurePass123!",
        }),
      });

      const { status, body } = await makeRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "unverified@example.com",
          password: "SecurePass123!",
        }),
      });

      expect(status).toBe(403);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("EMAIL_NOT_VERIFIED");
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should refresh tokens with valid refresh token", async () => {
      // Signup and verify
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "refresh@example.com",
          password: "SecurePass123!",
        }),
      });
      await env.DB.prepare(
        `UPDATE users SET email_verified = 1 WHERE email = 'refresh@example.com'`
      ).run();

      // Login to get tokens
      const loginRes = await makeRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "refresh@example.com",
          password: "SecurePass123!",
        }),
      });

      const loginBody = loginRes.body as { refresh_token: string };

      // Refresh
      const { status, body } = await makeRequest("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: loginBody.refresh_token,
        }),
      });

      expect(status).toBe(200);
      const typedBody = body as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };
      expect(typedBody.access_token).toBeDefined();
      expect(typedBody.refresh_token).toBeDefined();
      // New refresh token should be different (rotation)
      expect(typedBody.refresh_token).not.toBe(loginBody.refresh_token);
    });

    it("should reject invalid refresh token", async () => {
      const { status, body } = await makeRequest("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: "invalid-token-that-does-not-exist",
        }),
      });

      expect(status).toBe(401);
      const typedBody = body as { error: { code: string } };
      expect(typedBody.error.code).toBe("INVALID_TOKEN");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should invalidate session on logout", async () => {
      // Signup, verify, login
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "logout@example.com",
          password: "SecurePass123!",
        }),
      });
      await env.DB.prepare(
        `UPDATE users SET email_verified = 1 WHERE email = 'logout@example.com'`
      ).run();

      const loginRes = await makeRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "logout@example.com",
          password: "SecurePass123!",
        }),
      });

      const loginBody = loginRes.body as { refresh_token: string };

      // Logout
      const { status, body } = await makeRequest("/api/v1/auth/logout", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: loginBody.refresh_token,
        }),
      });

      expect(status).toBe(200);
      const typedBody = body as { message: string };
      expect(typedBody.message).toContain("Logged out");

      // Try to use the refresh token again - should fail
      const refreshRes = await makeRequest("/api/v1/auth/refresh", {
        method: "POST",
        body: JSON.stringify({
          refresh_token: loginBody.refresh_token,
        }),
      });

      expect(refreshRes.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/forgot-password", () => {
    it("should return success even for non-existent email (no enumeration)", async () => {
      const { status, body } = await makeRequest(
        "/api/v1/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "nonexistent@example.com",
          }),
        }
      );

      expect(status).toBe(200);
      const typedBody = body as { message: string };
      expect(typedBody.message).toContain("If an account exists");
    });

    it("should create reset token for existing user", async () => {
      // Create user
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "reset@example.com",
          password: "SecurePass123!",
        }),
      });

      const { status, body } = await makeRequest(
        "/api/v1/auth/forgot-password",
        {
          method: "POST",
          body: JSON.stringify({
            email: "reset@example.com",
          }),
        }
      );

      expect(status).toBe(200);

      // Verify token was created in DB
      const tokens = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM password_reset_tokens
         WHERE user_id = (SELECT id FROM users WHERE email = 'reset@example.com')`
      ).first<{ count: number }>();

      expect(tokens?.count).toBe(1);
    });
  });

  describe("POST /api/v1/auth/resend-verification", () => {
    it("should create new verification token", async () => {
      // Create unverified user
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "resend@example.com",
          password: "SecurePass123!",
        }),
      });

      const { status, body } = await makeRequest(
        "/api/v1/auth/resend-verification",
        {
          method: "POST",
          body: JSON.stringify({
            email: "resend@example.com",
          }),
        }
      );

      expect(status).toBe(200);
      const typedBody = body as { message: string };
      expect(typedBody.message).toContain("If an unverified account exists");
    });

    it("should not leak verified status", async () => {
      // Create and verify user
      await makeRequest("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: "verified@example.com",
          password: "SecurePass123!",
        }),
      });
      await env.DB.prepare(
        `UPDATE users SET email_verified = 1 WHERE email = 'verified@example.com'`
      ).run();

      // Request resend - should return same message (no enumeration)
      const { status, body } = await makeRequest(
        "/api/v1/auth/resend-verification",
        {
          method: "POST",
          body: JSON.stringify({
            email: "verified@example.com",
          }),
        }
      );

      expect(status).toBe(200);
      const typedBody = body as { message: string };
      expect(typedBody.message).toContain("If an unverified account exists");
    });
  });
});
