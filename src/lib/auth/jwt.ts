/**
 * JWT utilities for access token generation and verification
 *
 * Uses Web Crypto API for HMAC-SHA256 signing (Workers-compatible).
 * No external dependencies required.
 */

/** JWT access token expiry in seconds (15 minutes) */
export const ACCESS_TOKEN_EXPIRY_SECONDS = 900;

/** JWT payload interface */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  iat: number; // Issued at
  exp: number; // Expiry
}

/** Result of JWT verification */
export interface JwtVerifyResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: "EXPIRED" | "INVALID_SIGNATURE" | "MALFORMED";
}

/**
 * Sign a JWT using HMAC-SHA256
 * @param payload - JWT payload to sign
 * @param secret - Signing secret
 * @returns Signed JWT string
 */
export async function signJwt(
  payload: JwtPayload,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const message = `${encodedHeader}.${encodedPayload}`;

  const signature = await hmacSign(message, secret);

  return `${message}.${signature}`;
}

/**
 * Verify a JWT and return the payload
 * @param token - JWT string to verify
 * @param secret - Signing secret
 * @returns Verification result with payload or error
 */
export async function verifyJwt(
  token: string,
  secret: string
): Promise<JwtVerifyResult> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "MALFORMED" };
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const message = `${encodedHeader}.${encodedPayload}`;

    // Verify signature
    const expectedSignature = await hmacSign(message, secret);
    if (!timingSafeEqual(signature, expectedSignature)) {
      return { valid: false, error: "INVALID_SIGNATURE" };
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtPayload;

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: "EXPIRED" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: "MALFORMED" };
  }
}

/**
 * Generate an access token for a user
 * @param user - User object with id and email
 * @param secret - JWT secret
 * @returns Signed access token
 */
export async function generateAccessToken(
  user: { id: string; email: string },
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY_SECONDS,
  };

  return signJwt(payload, secret);
}

/**
 * Extract user ID from a verified JWT payload
 * @param token - JWT string
 * @param secret - JWT secret
 * @returns User ID if valid, null otherwise
 */
export async function getUserIdFromToken(
  token: string,
  secret: string
): Promise<string | null> {
  const result = await verifyJwt(token, secret);
  return result.valid && result.payload ? result.payload.sub : null;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Base64url encode a string
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64url decode a string
 */
function base64UrlDecode(str: string): string {
  // Add padding if needed
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  if (padding) {
    base64 += "=".repeat(4 - padding);
  }
  return atob(base64);
}

/**
 * HMAC-SHA256 sign a message
 */
async function hmacSign(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const bytes = new Uint8Array(signature);

  // Convert to base64url
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
