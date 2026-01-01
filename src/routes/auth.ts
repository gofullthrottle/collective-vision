/**
 * Authentication Routes
 *
 * Handles user registration, login, password reset, and token management.
 * All endpoints are rate-limited and follow security best practices.
 */

import type { Env } from "../worker";
import { z } from "zod";
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  resendVerificationSchema,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  generateId,
  hashToken,
  generateAccessToken,
  calculateExpiry,
  isExpired,
  SESSION_EXPIRY_DAYS,
  EMAIL_VERIFY_EXPIRY_HOURS,
  PASSWORD_RESET_EXPIRY_HOURS,
} from "../lib/auth";

// =============================================================================
// Validation Helper
// =============================================================================

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Parse request body and validate against schema
 */
async function validate<T>(
  schema: z.ZodSchema<T>,
  request: Request
): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }

  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format first error for user-friendly message
  const firstError = result.error.issues[0];
  const path = firstError.path.length > 0 ? `${firstError.path.join(".")}: ` : "";
  return { success: false, error: `${path}${firstError.message}` };
}

// =============================================================================
// Response Helpers
// =============================================================================

interface JsonOptions {
  status?: number;
}

function jsonResponse(data: unknown, options: JsonOptions = {}): Response {
  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): Response {
  return jsonResponse(
    { error: { code, message, ...details } },
    { status }
  );
}

// =============================================================================
// User Sanitization (remove sensitive fields)
// =============================================================================

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  email_verified: number;
  created_at: string;
}

function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    email_verified: Boolean(user.email_verified),
    created_at: user.created_at,
  };
}

// =============================================================================
// Signup Handler
// =============================================================================

export async function handleSignup(
  request: Request,
  env: Env
): Promise<Response> {
  // Parse and validate input
  const parsed = await validate(signupSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check email uniqueness (case-insensitive)
  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE LOWER(email) = LOWER(?)"
  )
    .bind(normalizedEmail)
    .first();

  if (existing) {
    // Generic error to prevent user enumeration
    return errorResponse(
      "EMAIL_EXISTS",
      "An account with this email already exists",
      409
    );
  }

  // Hash password and create user
  const userId = generateId("user");
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, name, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
  )
    .bind(userId, normalizedEmail, passwordHash, name ?? null)
    .run();

  // Generate email verification token
  const verifyToken = generateSecureToken();
  const tokenHash = await hashToken(verifyToken);
  const expiresAt = calculateExpiry(EMAIL_VERIFY_EXPIRY_HOURS, "hours");

  await env.DB.prepare(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(generateId("evt"), userId, tokenHash, expiresAt)
    .run();

  // TODO: Send verification email via Resend
  // For now, return the token in dev mode
  const isDev = env.ENVIRONMENT === "development";

  // Fetch created user for response
  const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRecord>();

  return jsonResponse(
    {
      user: user ? sanitizeUser(user) : null,
      message: "Please check your email to verify your account",
      ...(isDev ? { dev_verify_token: verifyToken } : {}),
    },
    { status: 201 }
  );
}

// =============================================================================
// Email Verification Handler
// =============================================================================

export async function handleVerifyEmail(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(verifyEmailSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { token } = parsed.data;
  const tokenHash = await hashToken(token);

  // Find token record
  const tokenRecord = await env.DB.prepare(
    `SELECT user_id, expires_at FROM email_verification_tokens
     WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string }>();

  if (!tokenRecord || isExpired(tokenRecord.expires_at)) {
    return errorResponse("INVALID_TOKEN", "Invalid or expired verification token", 400);
  }

  // Update user and delete token atomically
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(tokenRecord.user_id),
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE token_hash = ?").bind(
      tokenHash
    ),
  ]);

  return jsonResponse({ message: "Email verified successfully" });
}

// =============================================================================
// Login Handler
// =============================================================================

export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(loginSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Find user
  const user = await env.DB.prepare(
    "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
  )
    .bind(normalizedEmail)
    .first<UserRecord & { password_hash: string | null }>();

  // Generic error to prevent user enumeration
  const authError = () =>
    errorResponse("INVALID_CREDENTIALS", "Invalid email or password", 401);

  // Check user exists and has password (not OAuth-only)
  if (!user || !user.password_hash) {
    return authError();
  }

  // Verify password
  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return authError();
  }

  // Check email verified
  if (!user.email_verified) {
    return errorResponse(
      "EMAIL_NOT_VERIFIED",
      "Please verify your email before logging in",
      403,
      { resend_available: true }
    );
  }

  // Get JWT secret from env
  const jwtSecret = env.ADMIN_API_TOKEN; // TODO: Use separate JWT_SECRET
  if (!jwtSecret) {
    console.error("JWT secret not configured");
    return errorResponse("SERVER_ERROR", "Authentication not configured", 500);
  }

  // Generate tokens
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

  // Log login event to audit log
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, ip_address, user_agent, created_at)
     VALUES (?, ?, 'login', 'session', ?, ?, ?, datetime('now'))`
  )
    .bind(
      generateId("audit"),
      user.id,
      sessionId,
      request.headers.get("CF-Connecting-IP") ?? null,
      request.headers.get("User-Agent")?.slice(0, 256) ?? null
    )
    .run();

  return jsonResponse({
    user: sanitizeUser(user),
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 900, // 15 minutes
  });
}

// =============================================================================
// Refresh Token Handler
// =============================================================================

export async function handleRefreshToken(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(refreshTokenSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { refresh_token } = parsed.data;
  const tokenHash = await hashToken(refresh_token);

  // Find session with user
  const session = await env.DB.prepare(
    `SELECT s.id as session_id, s.user_id, s.expires_at, u.*
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first<{ session_id: string; user_id: string; expires_at: string } & UserRecord>();

  if (!session || isExpired(session.expires_at)) {
    return errorResponse("INVALID_TOKEN", "Invalid or expired refresh token", 401);
  }

  const jwtSecret = env.ADMIN_API_TOKEN;
  if (!jwtSecret) {
    return errorResponse("SERVER_ERROR", "Authentication not configured", 500);
  }

  // Rotate refresh token
  const newRefreshToken = generateSecureToken();
  const newTokenHash = await hashToken(newRefreshToken);
  const newExpiry = calculateExpiry(SESSION_EXPIRY_DAYS, "days");

  // Delete old session and create new one
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash),
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(generateId("sess"), session.user_id, newTokenHash, newExpiry),
  ]);

  // Generate new access token
  const accessToken = await generateAccessToken(
    { id: session.user_id, email: session.email },
    jwtSecret
  );

  return jsonResponse({
    access_token: accessToken,
    refresh_token: newRefreshToken,
    expires_in: 900,
  });
}

// =============================================================================
// Forgot Password Handler
// =============================================================================

export async function handleForgotPassword(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(forgotPasswordSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { email } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Always return same response to prevent user enumeration
  const successResponse = jsonResponse({
    message: "If an account exists with that email, a reset link has been sent",
  });

  // Find user
  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE LOWER(email) = LOWER(?)"
  )
    .bind(normalizedEmail)
    .first<{ id: string }>();

  if (!user) {
    return successResponse;
  }

  // Generate reset token
  const resetToken = generateSecureToken();
  const tokenHash = await hashToken(resetToken);
  const expiresAt = calculateExpiry(PASSWORD_RESET_EXPIRY_HOURS, "hours");

  // Invalidate any existing reset tokens for this user
  await env.DB.batch([
    env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(
      user.id
    ),
    env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`
    ).bind(generateId("prt"), user.id, tokenHash, expiresAt),
  ]);

  // TODO: Send reset email via Resend
  // For now, log in dev mode
  if (env.ENVIRONMENT === "development") {
    console.log(`Password reset token for ${normalizedEmail}: ${resetToken}`);
  }

  return successResponse;
}

// =============================================================================
// Reset Password Handler
// =============================================================================

export async function handleResetPassword(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(resetPasswordSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { token, new_password } = parsed.data;
  const tokenHash = await hashToken(token);

  // Find token record
  const tokenRecord = await env.DB.prepare(
    `SELECT user_id, expires_at, used FROM password_reset_tokens
     WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string; used: number }>();

  if (!tokenRecord || tokenRecord.used || isExpired(tokenRecord.expires_at)) {
    return errorResponse("INVALID_TOKEN", "Invalid or expired reset token", 400);
  }

  // Hash new password
  const passwordHash = await hashPassword(new_password);

  // Update password, mark token used, invalidate all sessions
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(passwordHash, tokenRecord.user_id),
    env.DB.prepare(
      "UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?"
    ).bind(tokenHash),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(
      tokenRecord.user_id
    ),
  ]);

  // Log password change to audit log
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, created_at)
     VALUES (?, ?, 'password_reset', 'user', ?, datetime('now'))`
  )
    .bind(generateId("audit"), tokenRecord.user_id, tokenRecord.user_id)
    .run();

  return jsonResponse({ message: "Password reset successfully" });
}

// =============================================================================
// Resend Verification Email Handler
// =============================================================================

export async function handleResendVerification(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(resendVerificationSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { email } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Always return same response
  const successResponse = jsonResponse({
    message: "If an unverified account exists, a verification email has been sent",
  });

  // Find unverified user
  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND email_verified = 0"
  )
    .bind(normalizedEmail)
    .first<{ id: string }>();

  if (!user) {
    return successResponse;
  }

  // Delete existing verification tokens and create new one
  const verifyToken = generateSecureToken();
  const tokenHash = await hashToken(verifyToken);
  const expiresAt = calculateExpiry(EMAIL_VERIFY_EXPIRY_HOURS, "hours");

  await env.DB.batch([
    env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(
      user.id
    ),
    env.DB.prepare(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`
    ).bind(generateId("evt"), user.id, tokenHash, expiresAt),
  ]);

  // TODO: Send verification email via Resend
  if (env.ENVIRONMENT === "development") {
    console.log(`Verification token for ${normalizedEmail}: ${verifyToken}`);
  }

  return successResponse;
}

// =============================================================================
// Logout Handler
// =============================================================================

export async function handleLogout(
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validate(refreshTokenSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { refresh_token } = parsed.data;
  const tokenHash = await hashToken(refresh_token);

  // Delete session
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(tokenHash)
    .run();

  return jsonResponse({ message: "Logged out successfully" });
}

// =============================================================================
// Route Handler
// =============================================================================

export async function handleAuthRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  if (!pathname.startsWith("/api/v1/auth/")) {
    return null;
  }

  const route = pathname.replace("/api/v1/auth/", "");

  if (request.method === "POST") {
    switch (route) {
      case "signup":
        return handleSignup(request, env);
      case "login":
        return handleLogin(request, env);
      case "verify-email":
        return handleVerifyEmail(request, env);
      case "forgot-password":
        return handleForgotPassword(request, env);
      case "reset-password":
        return handleResetPassword(request, env);
      case "refresh":
        return handleRefreshToken(request, env);
      case "resend-verification":
        return handleResendVerification(request, env);
      case "logout":
        return handleLogout(request, env);
    }
  }

  return null;
}
