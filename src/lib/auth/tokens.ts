/**
 * Token generation and hashing utilities
 *
 * All tokens are:
 * - Cryptographically random (crypto.randomUUID or crypto.getRandomValues)
 * - Stored as SHA-256 hashes (never plain text)
 * - URL-safe (base64url encoded where needed)
 */

/** Token length in bytes (32 bytes = 256 bits) */
const TOKEN_BYTES = 32;

/** Session token expiry in days */
export const SESSION_EXPIRY_DAYS = 7;

/** Email verification token expiry in hours */
export const EMAIL_VERIFY_EXPIRY_HOURS = 24;

/** Password reset token expiry in hours */
export const PASSWORD_RESET_EXPIRY_HOURS = 1;

/** Invitation token expiry in days */
export const INVITATION_EXPIRY_DAYS = 7;

/**
 * Generate a cryptographically secure random token
 * @returns Base64url-encoded random token
 */
export function generateSecureToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  // Convert to base64url (URL-safe base64)
  return arrayBufferToBase64Url(bytes.buffer);
}

/**
 * Generate a unique ID with prefix for easy identification
 * @param prefix - Prefix for the ID (e.g., "user", "sess", "team")
 * @returns ID in format: prefix_ulid
 */
export function generateId(prefix: string): string {
  // Use crypto.randomUUID and format it
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${uuid}`;
}

/**
 * Generate an API key with identifiable prefix
 * Format: cv_{env}_{random}
 * @param env - Environment: "live" | "test"
 * @returns API key string
 */
export function generateApiKey(env: "live" | "test"): string {
  const token = generateSecureToken();
  return `cv_${env}_${token}`;
}

/**
 * Extract the prefix from an API key for display
 * @param apiKey - Full API key
 * @returns First 12 characters for identification
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12);
}

/**
 * Hash a token using SHA-256 for secure storage
 * @param token - Plain text token
 * @returns SHA-256 hash as hex string
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return arrayBufferToHex(hashBuffer);
}

/**
 * Calculate expiry time from now
 * @param amount - Number of time units
 * @param unit - Time unit: "hours" | "days"
 * @returns ISO timestamp string
 */
export function calculateExpiry(
  amount: number,
  unit: "hours" | "days"
): string {
  const ms = unit === "hours" ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

/**
 * Check if a timestamp has expired
 * @param expiresAt - ISO timestamp string
 * @returns True if expired
 */
export function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert ArrayBuffer to base64url string
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Convert to base64 and make URL-safe
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
