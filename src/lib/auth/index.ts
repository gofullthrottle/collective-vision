/**
 * Authentication utilities
 *
 * This module exports all auth-related functions for:
 * - Password hashing and verification
 * - Token generation and hashing
 * - JWT signing and verification
 */

export {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  PasswordValidationError,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "./password";

export {
  generateSecureToken,
  generateId,
  generateApiKey,
  getApiKeyPrefix,
  hashToken,
  calculateExpiry,
  isExpired,
  SESSION_EXPIRY_DAYS,
  EMAIL_VERIFY_EXPIRY_HOURS,
  PASSWORD_RESET_EXPIRY_HOURS,
  INVITATION_EXPIRY_DAYS,
} from "./tokens";

export {
  signJwt,
  verifyJwt,
  generateAccessToken,
  getUserIdFromToken,
  ACCESS_TOKEN_EXPIRY_SECONDS,
  type JwtPayload,
  type JwtVerifyResult,
} from "./jwt";

export {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  resendVerificationSchema,
  type SignupInput,
  type LoginInput,
  type VerifyEmailInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type RefreshTokenInput,
  type ResendVerificationInput,
} from "./validation";

export {
  getAuthorizationUrl,
  exchangeCodeForToken,
  getUserInfo,
  generateOAuthState,
  type OAuthConfig,
  type OAuthProvider,
  type OAuthUserInfo,
} from "./oauth";
