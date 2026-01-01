/**
 * Authentication Middleware
 *
 * Provides middleware for protecting routes and checking permissions.
 * Supports both JWT tokens and API keys.
 */

import type { Env } from "../worker";
import { verifyJwt, type JwtPayload } from "../lib/auth/jwt";
import { hashToken } from "../lib/auth/tokens";

// =============================================================================
// Types
// =============================================================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
}

export interface AuthContext {
  user: AuthenticatedUser;
  workspaceId?: number;
  role?: "owner" | "admin" | "member" | "viewer";
  isApiKey?: boolean;
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: string; code: string; status: number };

// =============================================================================
// Response Helpers
// =============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authError(code: string, message: string, status = 401): Response {
  return jsonResponse({ error: { code, message } }, status);
}

// =============================================================================
// Token Extraction
// =============================================================================

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Check if token is an API key (starts with cv_)
 */
function isApiKey(token: string): boolean {
  return token.startsWith("cv_");
}

// =============================================================================
// JWT Authentication
// =============================================================================

/**
 * Authenticate a JWT token
 */
async function authenticateJwt(
  token: string,
  env: Env
): Promise<AuthResult> {
  const jwtSecret = env.ADMIN_API_TOKEN;
  if (!jwtSecret) {
    return {
      success: false,
      error: "Authentication not configured",
      code: "AUTH_NOT_CONFIGURED",
      status: 500,
    };
  }

  const result = await verifyJwt(token, jwtSecret);

  if (!result.valid) {
    if (result.error === "EXPIRED") {
      return {
        success: false,
        error: "Token expired",
        code: "TOKEN_EXPIRED",
        status: 401,
      };
    }
    return {
      success: false,
      error: "Invalid token",
      code: "INVALID_TOKEN",
      status: 401,
    };
  }

  const payload = result.payload as JwtPayload;

  return {
    success: true,
    context: {
      user: {
        id: payload.sub,
        email: payload.email,
      },
    },
  };
}

// =============================================================================
// API Key Authentication
// =============================================================================

/**
 * Authenticate an API key
 */
async function authenticateApiKey(
  apiKey: string,
  env: Env
): Promise<AuthResult> {
  const keyHash = await hashToken(apiKey);

  const keyRecord = await env.DB.prepare(
    `SELECT ak.*, u.email, u.name
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ? AND ak.revoked_at IS NULL`
  )
    .bind(keyHash)
    .first<{
      id: string;
      user_id: string;
      workspace_id: number | null;
      scopes: string | null;
      expires_at: string | null;
      email: string;
      name: string | null;
    }>();

  if (!keyRecord) {
    return {
      success: false,
      error: "Invalid API key",
      code: "INVALID_API_KEY",
      status: 401,
    };
  }

  // Check expiry
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return {
      success: false,
      error: "API key expired",
      code: "API_KEY_EXPIRED",
      status: 401,
    };
  }

  // Update last used timestamp
  await env.DB.prepare(
    `UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`
  )
    .bind(keyRecord.id)
    .run();

  return {
    success: true,
    context: {
      user: {
        id: keyRecord.user_id,
        email: keyRecord.email,
        name: keyRecord.name,
      },
      workspaceId: keyRecord.workspace_id ?? undefined,
      isApiKey: true,
    },
  };
}

// =============================================================================
// Authentication Middleware
// =============================================================================

/**
 * Authenticate request and return context
 */
export async function authenticate(
  request: Request,
  env: Env
): Promise<AuthResult> {
  const token = extractBearerToken(request);

  if (!token) {
    return {
      success: false,
      error: "Authorization header required",
      code: "MISSING_AUTH",
      status: 401,
    };
  }

  if (isApiKey(token)) {
    return authenticateApiKey(token, env);
  }

  return authenticateJwt(token, env);
}

/**
 * Middleware that requires authentication
 * Returns a Response if auth fails, null if auth succeeds
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<{ response: Response } | { context: AuthContext }> {
  const result = await authenticate(request, env);

  if (!result.success) {
    return { response: authError(result.code, result.error, result.status) };
  }

  return { context: result.context };
}

// =============================================================================
// Workspace Permissions
// =============================================================================

/**
 * Check if user has access to a workspace with minimum role
 */
export async function checkWorkspaceAccess(
  userId: string,
  workspaceId: number,
  minimumRole: "owner" | "admin" | "member" | "viewer",
  env: Env
): Promise<{ hasAccess: boolean; role?: string }> {
  const roleHierarchy = ["viewer", "member", "admin", "owner"];
  const minimumRoleIndex = roleHierarchy.indexOf(minimumRole);

  const membership = await env.DB.prepare(
    `SELECT role FROM team_memberships
     WHERE user_id = ? AND workspace_id = ? AND accepted_at IS NOT NULL`
  )
    .bind(userId, workspaceId)
    .first<{ role: string }>();

  if (!membership) {
    return { hasAccess: false };
  }

  const userRoleIndex = roleHierarchy.indexOf(membership.role);
  return {
    hasAccess: userRoleIndex >= minimumRoleIndex,
    role: membership.role,
  };
}

/**
 * Middleware that requires workspace membership with minimum role
 */
export async function requireWorkspaceAccess(
  request: Request,
  workspaceId: number,
  minimumRole: "owner" | "admin" | "member" | "viewer",
  env: Env
): Promise<{ response: Response } | { context: AuthContext }> {
  // First check authentication
  const authResult = await requireAuth(request, env);
  if ("response" in authResult) {
    return authResult;
  }

  const { context } = authResult;

  // Check workspace access
  const accessResult = await checkWorkspaceAccess(
    context.user.id,
    workspaceId,
    minimumRole,
    env
  );

  if (!accessResult.hasAccess) {
    return {
      response: authError(
        "INSUFFICIENT_PERMISSIONS",
        `Requires ${minimumRole} role or higher`,
        403
      ),
    };
  }

  return {
    context: {
      ...context,
      workspaceId,
      role: accessResult.role as "owner" | "admin" | "member" | "viewer",
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create auth context from a user record
 */
export function createAuthContext(user: {
  id: string;
  email: string;
  name?: string | null;
}): AuthContext {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
}
