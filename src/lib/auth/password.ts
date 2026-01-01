/**
 * Password hashing and verification utilities
 *
 * Uses bcryptjs for password hashing (Workers-compatible).
 * All functions are async for consistency and future-proofing.
 */

import bcrypt from "bcryptjs";

/** Password work factor for bcrypt. Higher = more secure but slower */
const WORK_FACTOR = 10;

/** Minimum password length requirement */
export const MIN_PASSWORD_LENGTH = 8;

/** Maximum password length (prevents DoS via extremely long passwords) */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Password validation error with details
 */
export class PasswordValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "PasswordValidationError";
  }
}

/**
 * Validate password strength requirements
 * @throws PasswordValidationError if password doesn't meet requirements
 */
export function validatePasswordStrength(password: string): void {
  // pragma: allowlist secret
  if (!password || typeof password !== "string") {
    throw new PasswordValidationError(
      "Password is required",
      "PASSWORD_REQUIRED"
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      "PASSWORD_TOO_SHORT"
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new PasswordValidationError(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
      "PASSWORD_TOO_LONG"
    );
  }
}

/**
 * Hash a password securely using bcrypt
 * @param password - Plain text password
 * @returns Promise<string> - Bcrypt hash
 * @throws PasswordValidationError if password doesn't meet requirements
 */
export async function hashPassword(password: string): Promise<string> {
  validatePasswordStrength(password);
  return bcrypt.hash(password, WORK_FACTOR);
}

/**
 * Verify a password against a hash
 * Uses timing-safe comparison built into bcrypt.compare
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise<boolean> - True if password matches
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    // If hash is malformed or comparison fails, return false
    return false;
  }
}
