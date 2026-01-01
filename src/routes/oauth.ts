/**
 * OAuth Routes
 *
 * Handles OAuth authentication flows for Google and GitHub.
 * Uses Authorization Code Flow for security.
 */

import type { Env } from "../worker";
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserInfo,
  generateOAuthState,
  type OAuthProvider,
  type OAuthConfig,
} from "../lib/auth/oauth";
import {
  generateSecureToken,
  generateId,
  hashToken,
  generateAccessToken,
  calculateExpiry,
  SESSION_EXPIRY_DAYS,
} from "../lib/auth";

// =============================================================================
// Response Helpers
// =============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function redirectResponse(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}

// =============================================================================
// OAuth Configuration
// =============================================================================

function getOAuthConfig(provider: OAuthProvider, env: Env): OAuthConfig | null {
  switch (provider) {
    case "google":
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        redirectUri: `${env.APP_URL || "http://localhost:8787"}/api/v1/oauth/google/callback`,
      };
    case "github":
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return null;
      }
      return {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: `${env.APP_URL || "http://localhost:8787"}/api/v1/oauth/github/callback`,
      };
    default:
      return null;
  }
}

// =============================================================================
// OAuth Initiation
// =============================================================================

/**
 * Start OAuth flow - redirect to provider
 * GET /api/v1/oauth/:provider
 */
async function handleOAuthStart(
  provider: OAuthProvider,
  env: Env
): Promise<Response> {
  const config = getOAuthConfig(provider, env);
  if (!config) {
    return errorResponse(
      "PROVIDER_NOT_CONFIGURED",
      `${provider} OAuth is not configured`,
      501
    );
  }

  // Generate and store state for CSRF protection
  const state = generateOAuthState();
  const stateId = generateId("ostate");

  // Store state in database with short expiry (10 minutes)
  await env.DB.prepare(
    `INSERT INTO oauth_states (id, state_hash, provider, expires_at, created_at)
     VALUES (?, ?, ?, datetime('now', '+10 minutes'), datetime('now'))`
  )
    .bind(stateId, await hashToken(state), provider)
    .run();

  // Redirect to provider authorization URL
  const authUrl = getAuthorizationUrl(provider, config, state);
  return redirectResponse(authUrl);
}

// =============================================================================
// OAuth Callback
// =============================================================================

/**
 * Handle OAuth callback from provider
 * GET /api/v1/oauth/:provider/callback
 */
async function handleOAuthCallback(
  provider: OAuthProvider,
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle provider errors
  if (error) {
    const errorDescription = url.searchParams.get("error_description") || error;
    return redirectToAppWithError("OAUTH_DENIED", errorDescription, env);
  }

  if (!code || !state) {
    return redirectToAppWithError("INVALID_CALLBACK", "Missing code or state", env);
  }

  // Validate state token
  const stateHash = await hashToken(state);
  const stateRecord = await env.DB.prepare(
    `SELECT id, provider, expires_at FROM oauth_states
     WHERE state_hash = ? AND provider = ?`
  )
    .bind(stateHash, provider)
    .first<{ id: string; provider: string; expires_at: string }>();

  if (!stateRecord) {
    return redirectToAppWithError("INVALID_STATE", "Invalid or expired state token", env);
  }

  // Check expiry
  if (new Date(stateRecord.expires_at) < new Date()) {
    await env.DB.prepare("DELETE FROM oauth_states WHERE id = ?")
      .bind(stateRecord.id)
      .run();
    return redirectToAppWithError("STATE_EXPIRED", "OAuth state expired, please try again", env);
  }

  // Delete used state
  await env.DB.prepare("DELETE FROM oauth_states WHERE id = ?")
    .bind(stateRecord.id)
    .run();

  const config = getOAuthConfig(provider, env);
  if (!config) {
    return redirectToAppWithError("PROVIDER_NOT_CONFIGURED", "OAuth provider not configured", env);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await exchangeCodeForToken(provider, code, config);

    // Get user info from provider
    const userInfo = await getUserInfo(provider, tokenResponse.access_token);

    // Find or create user
    const { user, isNewUser } = await findOrCreateOAuthUser(userInfo, env);

    // Link OAuth account if not already linked
    await linkOAuthAccount(user.id, userInfo, tokenResponse.access_token, env);

    // Get JWT secret
    const jwtSecret = env.ADMIN_API_TOKEN;
    if (!jwtSecret) {
      return redirectToAppWithError("SERVER_ERROR", "Authentication not configured", env);
    }

    // Generate session tokens
    const accessToken = await generateAccessToken(
      { id: user.id, email: user.email },
      jwtSecret
    );
    const refreshToken = generateSecureToken();
    const refreshTokenHash = await hashToken(refreshToken);

    // Create session
    const sessionId = generateId("sess");
    const sessionExpiry = calculateExpiry(SESSION_EXPIRY_DAYS, "days");

    await env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        sessionId,
        user.id,
        refreshTokenHash,
        request.headers.get("CF-Connecting-IP") ?? null,
        request.headers.get("User-Agent")?.slice(0, 256) ?? null,
        sessionExpiry
      )
      .run();

    // Log OAuth login
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata, created_at)
       VALUES (?, ?, 'oauth_login', 'session', ?, ?, datetime('now'))`
    )
      .bind(
        generateId("audit"),
        user.id,
        sessionId,
        JSON.stringify({ provider, is_new_user: isNewUser })
      )
      .run();

    // Redirect to app with tokens
    return redirectToAppWithTokens(accessToken, refreshToken, isNewUser, env);
  } catch (err) {
    console.error("OAuth callback error:", err);
    const message = err instanceof Error ? err.message : "OAuth authentication failed";
    return redirectToAppWithError("OAUTH_FAILED", message, env);
  }
}

// =============================================================================
// User Management
// =============================================================================

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  email_verified: number;
  created_at: string;
}

/**
 * Find existing user or create new one from OAuth info
 */
async function findOrCreateOAuthUser(
  userInfo: {
    provider: OAuthProvider;
    providerId: string;
    email: string;
    emailVerified: boolean;
    name: string | null;
    avatarUrl: string | null;
  },
  env: Env
): Promise<{ user: UserRecord; isNewUser: boolean }> {
  const normalizedEmail = userInfo.email.toLowerCase().trim();

  // Check if OAuth account already linked
  const existingLink = await env.DB.prepare(
    `SELECT u.* FROM users u
     JOIN oauth_accounts oa ON oa.user_id = u.id
     WHERE oa.provider = ? AND oa.provider_user_id = ?`
  )
    .bind(userInfo.provider, userInfo.providerId)
    .first<UserRecord>();

  if (existingLink) {
    return { user: existingLink, isNewUser: false };
  }

  // Check if user exists with same email
  const existingUser = await env.DB.prepare(
    `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`
  )
    .bind(normalizedEmail)
    .first<UserRecord>();

  if (existingUser) {
    return { user: existingUser, isNewUser: false };
  }

  // Create new user
  const userId = generateId("user");
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar_url, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  )
    .bind(
      userId,
      normalizedEmail,
      userInfo.name,
      userInfo.avatarUrl,
      userInfo.emailVerified ? 1 : 0
    )
    .run();

  const newUser = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(userId)
    .first<UserRecord>();

  if (!newUser) {
    throw new Error("Failed to create user");
  }

  return { user: newUser, isNewUser: true };
}

/**
 * Link OAuth account to user
 */
async function linkOAuthAccount(
  userId: string,
  userInfo: {
    provider: OAuthProvider;
    providerId: string;
    email: string;
  },
  accessToken: string,
  env: Env
): Promise<void> {
  // Check if already linked
  const existing = await env.DB.prepare(
    `SELECT id FROM oauth_accounts
     WHERE user_id = ? AND provider = ?`
  )
    .bind(userId, userInfo.provider)
    .first();

  if (existing) {
    // Update access token
    await env.DB.prepare(
      `UPDATE oauth_accounts SET access_token = ?, updated_at = datetime('now')
       WHERE user_id = ? AND provider = ?`
    )
      .bind(accessToken, userId, userInfo.provider)
      .run();
  } else {
    // Create new link
    await env.DB.prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, access_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        generateId("oauth"),
        userId,
        userInfo.provider,
        userInfo.providerId,
        accessToken
      )
      .run();
  }
}

// =============================================================================
// Redirect Helpers
// =============================================================================

function getAppUrl(env: Env): string {
  return env.APP_URL || "http://localhost:8787";
}

function redirectToAppWithTokens(
  accessToken: string,
  refreshToken: string,
  isNewUser: boolean,
  env: Env
): Response {
  const appUrl = getAppUrl(env);
  const params = new URLSearchParams({
    access_token: accessToken,
    refresh_token: refreshToken,
    is_new_user: String(isNewUser),
  });
  return redirectResponse(`${appUrl}/auth/callback?${params.toString()}`);
}

function redirectToAppWithError(code: string, message: string, env: Env): Response {
  const appUrl = getAppUrl(env);
  const params = new URLSearchParams({
    error: code,
    error_description: message,
  });
  return redirectResponse(`${appUrl}/auth/callback?${params.toString()}`);
}

// =============================================================================
// Route Handler
// =============================================================================

export async function handleOAuthRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  if (!pathname.startsWith("/api/v1/oauth/")) {
    return null;
  }

  const route = pathname.replace("/api/v1/oauth/", "");

  // GET /api/v1/oauth/:provider
  if (request.method === "GET" && !route.includes("/")) {
    const provider = route as OAuthProvider;
    if (provider === "google" || provider === "github") {
      return handleOAuthStart(provider, env);
    }
    return errorResponse("INVALID_PROVIDER", "Unknown OAuth provider", 400);
  }

  // GET /api/v1/oauth/:provider/callback
  if (request.method === "GET" && route.endsWith("/callback")) {
    const provider = route.replace("/callback", "") as OAuthProvider;
    if (provider === "google" || provider === "github") {
      return handleOAuthCallback(provider, request, env);
    }
    return errorResponse("INVALID_PROVIDER", "Unknown OAuth provider", 400);
  }

  return null;
}
