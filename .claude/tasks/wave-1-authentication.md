# Wave 1: Authentication & User Management

**Duration**: 20-28 hours
**Dependencies**: Wave 0
**Priority**: Critical (enables monetization, analytics, MCP, everything)

---

## Epic 1.1: Database Schema Extensions (3h)

### Tasks

#### 1.1.1 Create User Tables Migration (1h)
- [ ] Create `users` table with all fields
- [ ] Create `sessions` table
- [ ] Create `password_reset_tokens` table
- [ ] Add indexes for email, token lookups

**SQL:**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

**Acceptance Criteria:**
- Migration runs without errors
- Indexes created for performance

#### 1.1.2 Create Team Membership Tables (1h)
- [ ] Create `team_memberships` table
- [ ] Define role enum (owner, admin, member, viewer)
- [ ] Add workspace foreign key

**SQL:**
```sql
CREATE TABLE team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id)
);

CREATE INDEX idx_memberships_user ON team_memberships(user_id);
CREATE INDEX idx_memberships_workspace ON team_memberships(workspace_id);
```

#### 1.1.3 Create OAuth & API Key Tables (1h)
- [ ] Create `oauth_accounts` table
- [ ] Create `api_keys` table
- [ ] Add proper foreign key constraints

**SQL:**
```sql
CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK(provider IN ('google', 'github')),
  provider_user_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  key_hash TEXT UNIQUE NOT NULL,
  scopes TEXT, -- JSON array of allowed scopes
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Epic 1.2: Email/Password Authentication (8h)

### Tasks

#### 1.2.1 Password Hashing Utility (1h)
- [ ] Implement bcrypt or argon2 hashing (via Workers-compatible library)
- [ ] Create hash and verify functions
- [ ] Add timing-safe comparison
- [ ] Document password requirements

**Files:**
- `src/lib/auth/password.ts`

**Acceptance Criteria:**
- Passwords hashed with work factor 10+
- Verification timing-safe
- Password min 8 chars enforced

#### 1.2.2 Sign-Up Endpoint (2h)
- [ ] `POST /api/v1/auth/signup`
- [ ] Validate email format and uniqueness
- [ ] Validate password strength
- [ ] Create user with hashed password
- [ ] Generate email verification token
- [ ] Send verification email via Resend
- [ ] Return user object (no password)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepass123", // pragma: allowlist secret
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_xxx",
    "email": "user@example.com",
    "name": "John Doe",
    "email_verified": false
  },
  "message": "Verification email sent"
}
```

**Acceptance Criteria:**
- Duplicate email returns 409
- Weak password returns 400
- Email sent on success

#### 1.2.3 Email Verification (1h)
- [ ] `POST /api/v1/auth/verify-email`
- [ ] Accept token from email link
- [ ] Mark user as verified
- [ ] Delete used token

**Acceptance Criteria:**
- Valid token verifies user
- Expired/invalid token returns 400
- Token single-use

#### 1.2.4 Login Endpoint (1.5h)
- [ ] `POST /api/v1/auth/login`
- [ ] Validate credentials
- [ ] Generate JWT access token (15min expiry)
- [ ] Generate refresh token (7 day expiry)
- [ ] Create session record
- [ ] Set HttpOnly cookies

**Response:**
```json
{
  "user": { ... },
  "access_token": "eyJ...",
  "expires_in": 900
}
```

**Acceptance Criteria:**
- Invalid credentials return 401
- Unverified email prompts re-verification
- Tokens properly signed

#### 1.2.5 Token Refresh (1h)
- [ ] `POST /api/v1/auth/refresh`
- [ ] Validate refresh token
- [ ] Rotate refresh token (one-time use)
- [ ] Issue new access token

**Acceptance Criteria:**
- Expired refresh returns 401
- Used refresh returns 401
- New tokens issued on success

#### 1.2.6 Password Reset Flow (1.5h)
- [ ] `POST /api/v1/auth/forgot-password` - request reset
- [ ] Generate secure reset token (1 hour expiry)
- [ ] Send reset email
- [ ] `POST /api/v1/auth/reset-password` - complete reset
- [ ] Invalidate all sessions on reset

**Acceptance Criteria:**
- Reset email sent to valid users
- No user enumeration (same response for invalid email)
- Old sessions invalidated

---

## Epic 1.3: OAuth Integration (6h)

### Tasks

#### 1.3.1 OAuth Configuration (1h)
- [ ] Set up Google OAuth app
- [ ] Set up GitHub OAuth app
- [ ] Store client IDs/secrets in Cloudflare secrets
- [ ] Create OAuth config module

**Files:**
- `src/lib/auth/oauth-config.ts`

#### 1.3.2 Google OAuth Flow (2h)
- [ ] `GET /api/v1/auth/google` - redirect to Google
- [ ] `GET /api/v1/auth/google/callback` - handle callback
- [ ] Exchange code for tokens
- [ ] Fetch user profile from Google
- [ ] Create or link user account
- [ ] Generate app tokens

**Acceptance Criteria:**
- New users created with Google profile
- Existing users linked if same email
- Proper error handling for denied access

#### 1.3.3 GitHub OAuth Flow (2h)
- [ ] `GET /api/v1/auth/github` - redirect to GitHub
- [ ] `GET /api/v1/auth/github/callback` - handle callback
- [ ] Exchange code for tokens
- [ ] Fetch user profile and email from GitHub
- [ ] Create or link user account

**Acceptance Criteria:**
- Same flow as Google
- Handle GitHub users without public email

#### 1.3.4 Account Linking (1h)
- [ ] Allow logged-in user to link additional OAuth
- [ ] `POST /api/v1/auth/link/google`
- [ ] `POST /api/v1/auth/link/github`
- [ ] Prevent duplicate provider links

**Acceptance Criteria:**
- User can log in via any linked method
- Cannot link already-used OAuth account

---

## Epic 1.4: Team Roles & Permissions (5h)

### Tasks

#### 1.4.1 Permission System Design (1h)
- [ ] Define permission matrix:
  | Action | Owner | Admin | Member | Viewer |
  |--------|-------|-------|--------|--------|
  | View feedback | ✅ | ✅ | ✅ | ✅ |
  | Create feedback | ✅ | ✅ | ✅ | ❌ |
  | Moderate | ✅ | ✅ | ❌ | ❌ |
  | Manage team | ✅ | ✅ | ❌ | ❌ |
  | Billing | ✅ | ❌ | ❌ | ❌ |
  | Delete workspace | ✅ | ❌ | ❌ | ❌ |
- [ ] Create permission checking utilities

**Files:**
- `src/lib/auth/permissions.ts`

#### 1.4.2 Permission Middleware (1.5h)
- [ ] Create `requireAuth` middleware
- [ ] Create `requireRole(role)` middleware
- [ ] Create `requirePermission(perm)` middleware
- [ ] Apply to existing endpoints

**Acceptance Criteria:**
- Unauthenticated requests return 401
- Insufficient role returns 403
- Proper error messages

#### 1.4.3 Team Management Endpoints (2h)
- [ ] `GET /api/v1/workspaces/:id/members` - list members
- [ ] `POST /api/v1/workspaces/:id/members` - invite member
- [ ] `PATCH /api/v1/workspaces/:id/members/:userId` - update role
- [ ] `DELETE /api/v1/workspaces/:id/members/:userId` - remove member

**Acceptance Criteria:**
- Only admins+ can manage members
- Owner cannot be removed
- Role changes logged

#### 1.4.4 Invite System (0.5h)
- [ ] Generate invite tokens
- [ ] Send invite emails
- [ ] `POST /api/v1/invites/:token/accept` - accept invite

**Acceptance Criteria:**
- Invites expire after 7 days
- Can be revoked before acceptance

---

## Epic 1.5: User Profile Management (3h)

### Tasks

#### 1.5.1 Profile Endpoints (1h)
- [ ] `GET /api/v1/me` - get current user
- [ ] `PATCH /api/v1/me` - update profile
- [ ] Update name, notification preferences

**Acceptance Criteria:**
- Users can update their own profile
- Email change requires verification

#### 1.5.2 Avatar Upload (1.5h)
- [ ] Configure R2 bucket for avatars
- [ ] `POST /api/v1/me/avatar` - upload avatar
- [ ] Generate presigned URL for upload
- [ ] Store avatar URL in user record
- [ ] Resize/optimize image (if possible in Workers)

**Acceptance Criteria:**
- Max file size 2MB
- Supports JPG, PNG, WebP
- Old avatar deleted on update

#### 1.5.3 Account Deletion (0.5h)
- [ ] `DELETE /api/v1/me` - delete account
- [ ] Require password confirmation
- [ ] Cascade delete all user data
- [ ] Handle owned workspaces (transfer or delete)

**Acceptance Criteria:**
- All user data removed
- Workspace transfer offered for owners
- Confirmation required

---

## Epic 1.6: API Authentication (3h)

### Tasks

#### 1.6.1 API Key Generation (1h)
- [ ] `POST /api/v1/api-keys` - create key
- [ ] Generate secure random key
- [ ] Store hash only (key shown once)
- [ ] `GET /api/v1/api-keys` - list keys
- [ ] `DELETE /api/v1/api-keys/:id` - revoke key

**Response on create:**
```json
{
  "id": "key_xxx",
  "name": "My Integration",
  "key": "cv_live_xxxxxxxxxxxxx", // Only shown once!
  "prefix": "cv_live_xx",
  "created_at": "..."
}
```

**Acceptance Criteria:**
- Key only shown on creation
- Keys can be scoped to workspace
- Optional expiry

#### 1.6.2 API Key Authentication (1h)
- [ ] Accept `Authorization: Bearer <api_key>` header
- [ ] Validate key and scopes
- [ ] Rate limit per key
- [ ] Update `last_used_at`

**Acceptance Criteria:**
- API keys work alongside JWT auth
- Invalid keys return 401
- Key usage tracked

#### 1.6.3 Audit Logging (1h)
- [ ] Log authentication events
- [ ] Log permission denials
- [ ] Log sensitive actions (password change, etc.)
- [ ] Store in D1 or external logging

**Acceptance Criteria:**
- Security events logged
- No passwords/tokens in logs
- Logs queryable

---

## Definition of Done for Wave 1

- [ ] Users can sign up, verify email, log in
- [ ] Password reset flow complete
- [ ] Google and GitHub OAuth working
- [ ] Team roles enforced on all endpoints
- [ ] API keys can be generated and used
- [ ] All endpoints have proper auth
- [ ] Tests cover auth flows

---

## Estimated Breakdown

| Epic | Hours | Complexity |
|------|-------|------------|
| 1.1 Schema Extensions | 3h | Low |
| 1.2 Email/Password Auth | 8h | High |
| 1.3 OAuth Integration | 6h | Medium |
| 1.4 Team Roles & Permissions | 5h | Medium |
| 1.5 User Profile | 3h | Low |
| 1.6 API Authentication | 3h | Medium |

**Total: 28h (optimistic: 20h)**
