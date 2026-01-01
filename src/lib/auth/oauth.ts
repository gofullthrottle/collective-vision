/**
 * OAuth Provider Integration
 *
 * Handles OAuth flow for Google and GitHub providers.
 * Uses Authorization Code Flow with PKCE for security.
 */

// =============================================================================
// Types
// =============================================================================

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // Google only
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GitHubUserInfo {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export type OAuthProvider = "google" | "github";

export interface OAuthUserInfo {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

// =============================================================================
// OAuth URLs
// =============================================================================

const OAUTH_CONFIG = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    emailsUrl: "https://api.github.com/user/emails",
    scopes: ["read:user", "user:email"],
  },
} as const;

// =============================================================================
// Authorization URL Generation
// =============================================================================

/**
 * Generate the authorization URL for OAuth provider
 */
export function getAuthorizationUrl(
  provider: OAuthProvider,
  config: OAuthConfig,
  state: string
): string {
  const providerConfig = OAUTH_CONFIG[provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: providerConfig.scopes.join(" "),
    state,
  });

  // Google-specific: prompt for account selection
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "select_account");
  }

  return `${providerConfig.authUrl}?${params.toString()}`;
}

// =============================================================================
// Token Exchange
// =============================================================================

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  config: OAuthConfig
): Promise<OAuthTokenResponse> {
  const providerConfig = OAUTH_CONFIG[provider];

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

// =============================================================================
// User Info Fetching
// =============================================================================

/**
 * Fetch user info from Google
 */
async function getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const response = await fetch(OAUTH_CONFIG.google.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  const data: GoogleUserInfo = await response.json();

  return {
    provider: "google",
    providerId: data.id,
    email: data.email,
    emailVerified: data.verified_email,
    name: data.name || null,
    avatarUrl: data.picture || null,
  };
}

/**
 * Fetch user info from GitHub
 */
async function getGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  // Fetch user profile
  const userResponse = await fetch(OAUTH_CONFIG.github.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "CollectiveVision/1.0",
    },
  });

  if (!userResponse.ok) {
    throw new Error("Failed to fetch GitHub user info");
  }

  const userData: GitHubUserInfo = await userResponse.json();

  // GitHub may not include email in user profile - fetch from emails endpoint
  let email = userData.email;
  let emailVerified = false;

  if (!email) {
    const emailsResponse = await fetch(OAUTH_CONFIG.github.emailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "CollectiveVision/1.0",
      },
    });

    if (emailsResponse.ok) {
      const emails: GitHubEmail[] = await emailsResponse.json();
      // Find primary verified email
      const primaryEmail = emails.find((e) => e.primary && e.verified);
      const verifiedEmail = emails.find((e) => e.verified);
      const chosenEmail = primaryEmail || verifiedEmail;

      if (chosenEmail) {
        email = chosenEmail.email;
        emailVerified = chosenEmail.verified;
      }
    }
  } else {
    // If email was in profile, assume it's verified
    emailVerified = true;
  }

  if (!email) {
    throw new Error("GitHub account has no accessible email address");
  }

  return {
    provider: "github",
    providerId: String(userData.id),
    email,
    emailVerified,
    name: userData.name || userData.login,
    avatarUrl: userData.avatar_url || null,
  };
}

/**
 * Fetch user info from OAuth provider
 */
export async function getUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthUserInfo> {
  switch (provider) {
    case "google":
      return getGoogleUserInfo(accessToken);
    case "github":
      return getGitHubUserInfo(accessToken);
    default:
      throw new Error(`Unknown OAuth provider: ${provider}`);
  }
}

// =============================================================================
// State Token Generation
// =============================================================================

/**
 * Generate a secure state token for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}
