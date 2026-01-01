/**
 * MCP Authentication Module
 * Handles API key validation and context extraction
 */

import type { MCPContext, MCPEnv, ApiKeyRecord, JsonRpcError } from './types';
import { MCP_ERROR_CODES } from './types';

// Rate limit configuration
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
};

// In-memory rate limit tracking (would use KV/Durable Objects in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Hash an API key for comparison
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract API key from request
 * Supports both Authorization header and tool parameter
 */
export function extractApiKey(
  request: Request,
  params?: Record<string, unknown>
): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check tool params for authentication token (from user request)
  // nosec - example placeholder api_key variable, not a real secret
  if (params && typeof params.api_key === 'string') {
    return params.api_key;
  }

  return null;
}

/**
 * Validate API key and build MCP context
 */
export async function validateApiKey(
  apiKey: string,
  env: MCPEnv
): Promise<{ context: MCPContext } | { error: JsonRpcError }> {
  // Validate key format
  if (!apiKey.startsWith('cv_mcp_') || apiKey.length < 20) {
    return {
      error: {
        code: MCP_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid API key format',
        data: { hint: 'API keys should start with cv_mcp_' },
      },
    };
  }

  // Hash the key for lookup
  const keyHash = await hashApiKey(apiKey);

  // Look up the key in the database
  const keyRecord = await env.DB
    .prepare(`
      SELECT ak.id, ak.user_id, ak.workspace_id, ak.name, ak.scopes, ak.last_used_at,
             w.slug as workspace_slug
      FROM api_keys ak
      LEFT JOIN workspaces w ON w.id = ak.workspace_id
      WHERE ak.key_hash = ?
    `)
    .bind(keyHash)
    .first<ApiKeyRecord & { workspace_slug: string | null }>();

  if (!keyRecord) {
    return {
      error: {
        code: MCP_ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid API key',
      },
    };
  }

  if (!keyRecord.workspace_id || !keyRecord.workspace_slug) {
    return {
      error: {
        code: MCP_ERROR_CODES.FORBIDDEN,
        message: 'API key not associated with a workspace',
        data: { hint: 'MCP API keys must be scoped to a specific workspace' },
      },
    };
  }

  // Parse scopes
  const scopes = keyRecord.scopes ? keyRecord.scopes.split(',') : ['read'];
  const permissions: ('read' | 'write')[] = [];
  if (scopes.includes('read') || scopes.includes('mcp:read') || scopes.includes('*')) {
    permissions.push('read');
  }
  if (scopes.includes('write') || scopes.includes('mcp:write') || scopes.includes('*')) {
    permissions.push('write');
  }

  // Check rate limit
  const rateLimitResult = checkRateLimit(keyRecord.id.toString());
  if (!rateLimitResult.allowed) {
    return {
      error: {
        code: MCP_ERROR_CODES.RATE_LIMITED,
        message: 'Rate limit exceeded',
        data: {
          retry_after: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          limit: RATE_LIMIT.maxRequests,
          window_seconds: RATE_LIMIT.windowMs / 1000,
        },
      },
    };
  }

  // Update last_used_at
  await env.DB
    .prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
    .bind(keyRecord.id)
    .run();

  return {
    context: {
      workspaceId: keyRecord.workspace_id,
      workspaceSlug: keyRecord.workspace_slug,
      apiKeyId: keyRecord.id.toString(),
      permissions,
      rateLimitRemaining: rateLimitResult.remaining,
    },
  };
}

/**
 * Check rate limit for an API key
 */
function checkRateLimit(keyId: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(keyId);

  if (!entry || now > entry.resetAt) {
    // Create new window
    rateLimitStore.set(keyId, {
      count: 1,
      resetAt: now + RATE_LIMIT.windowMs,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT.maxRequests - 1,
      resetAt: now + RATE_LIMIT.windowMs,
    };
  }

  if (entry.count >= RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Verify context has required permission
 */
export function requirePermission(
  context: MCPContext,
  permission: 'read' | 'write'
): JsonRpcError | null {
  if (!context.permissions.includes(permission)) {
    return {
      code: MCP_ERROR_CODES.FORBIDDEN,
      message: `Permission denied: requires '${permission}' scope`,
      data: { required: permission, granted: context.permissions },
    };
  }
  return null;
}

/**
 * Generate a new MCP API key
 */
export async function generateMcpApiKey(): Promise<{ key: string; hash: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const key = 'cv_mcp_' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashApiKey(key);
  return { key, hash };
}
