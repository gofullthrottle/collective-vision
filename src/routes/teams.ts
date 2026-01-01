/**
 * Team & Workspace Membership Routes
 *
 * Handles team invitations, membership management, and role changes.
 */

import type { Env } from "../worker";
import { z } from "zod";
import {
  requireAuth,
  requireWorkspaceAccess,
  type AuthContext,
} from "../middleware/auth";
import {
  generateSecureToken,
  generateId,
  hashToken,
  calculateExpiry,
  isExpired,
  INVITATION_EXPIRY_DAYS,
} from "../lib/auth";

// =============================================================================
// Types & Schemas
// =============================================================================

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

type ValidRole = "owner" | "admin" | "member" | "viewer";

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

// =============================================================================
// Validation Helper
// =============================================================================

async function validateBody<T>(
  schema: z.ZodSchema<T>,
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: string }> {
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

  const firstError = result.error.issues[0];
  const path = firstError.path.length > 0 ? `${firstError.path.join(".")}: ` : "";
  return { success: false, error: `${path}${firstError.message}` };
}

// =============================================================================
// Workspace Resolution
// =============================================================================

async function getWorkspaceIdBySlug(
  slug: string,
  env: Env
): Promise<number | null> {
  const workspace = await env.DB.prepare(
    `SELECT id FROM workspaces WHERE slug = ?`
  )
    .bind(slug)
    .first<{ id: number }>();

  return workspace?.id ?? null;
}

// =============================================================================
// List Team Members
// =============================================================================

/**
 * GET /api/v1/workspaces/:workspace/team
 * List all team members for a workspace
 */
async function handleListMembers(
  workspaceId: number,
  _context: AuthContext,
  env: Env
): Promise<Response> {
  const members = await env.DB.prepare(
    `SELECT
       tm.id,
       tm.role,
       tm.accepted_at,
       tm.created_at,
       u.id as user_id,
       u.email,
       u.name,
       u.avatar_url,
       inviter.name as invited_by_name
     FROM team_memberships tm
     JOIN users u ON tm.user_id = u.id
     LEFT JOIN users inviter ON tm.invited_by = inviter.id
     WHERE tm.workspace_id = ?
     ORDER BY
       CASE tm.role
         WHEN 'owner' THEN 1
         WHEN 'admin' THEN 2
         WHEN 'member' THEN 3
         WHEN 'viewer' THEN 4
       END,
       tm.created_at ASC`
  )
    .bind(workspaceId)
    .all();

  return jsonResponse({
    members: members.results.map((m) => ({
      id: m.id,
      user: {
        id: m.user_id,
        email: m.email,
        name: m.name,
        avatar_url: m.avatar_url,
      },
      role: m.role,
      invited_by: m.invited_by_name || null,
      accepted_at: m.accepted_at,
      created_at: m.created_at,
    })),
  });
}

// =============================================================================
// Invite Member
// =============================================================================

/**
 * POST /api/v1/workspaces/:workspace/team/invites
 * Invite a new member to the workspace
 */
async function handleInviteMember(
  workspaceId: number,
  context: AuthContext,
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validateBody(inviteSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { email, role } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists and is a member
  const existingUser = await env.DB.prepare(
    `SELECT u.id, tm.id as membership_id
     FROM users u
     LEFT JOIN team_memberships tm ON tm.user_id = u.id AND tm.workspace_id = ?
     WHERE LOWER(u.email) = LOWER(?)`
  )
    .bind(workspaceId, normalizedEmail)
    .first<{ id: string; membership_id: string | null }>();

  if (existingUser?.membership_id) {
    return errorResponse("ALREADY_MEMBER", "User is already a team member", 409);
  }

  // Check for pending invitation
  const pendingInvite = await env.DB.prepare(
    `SELECT id FROM workspace_invitations
     WHERE workspace_id = ? AND LOWER(email) = LOWER(?) AND accepted_at IS NULL`
  )
    .bind(workspaceId, normalizedEmail)
    .first();

  if (pendingInvite) {
    return errorResponse(
      "PENDING_INVITATION",
      "An invitation is already pending for this email",
      409
    );
  }

  // If user exists, add them directly
  if (existingUser) {
    const membershipId = generateId("mem");
    await env.DB.prepare(
      `INSERT INTO team_memberships (id, user_id, workspace_id, role, invited_by, accepted_at, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(membershipId, existingUser.id, workspaceId, role, context.user.id)
      .run();

    return jsonResponse({
      message: "User added to team",
      membership_id: membershipId,
    }, 201);
  }

  // Create invitation for non-existing user
  const inviteToken = generateSecureToken();
  const tokenHash = await hashToken(inviteToken);
  const expiresAt = calculateExpiry(INVITATION_EXPIRY_DAYS, "days");
  const inviteId = generateId("inv");

  await env.DB.prepare(
    `INSERT INTO workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(inviteId, workspaceId, normalizedEmail, role, tokenHash, context.user.id, expiresAt)
    .run();

  // TODO: Send invitation email via Resend
  const isDev = env.ENVIRONMENT === "development";

  return jsonResponse({
    message: "Invitation sent",
    invitation_id: inviteId,
    ...(isDev ? { dev_invite_token: inviteToken } : {}),
  }, 201);
}

// =============================================================================
// Accept Invitation
// =============================================================================

/**
 * POST /api/v1/invitations/:token/accept
 * Accept a workspace invitation
 */
async function handleAcceptInvitation(
  token: string,
  context: AuthContext,
  env: Env
): Promise<Response> {
  const tokenHash = await hashToken(token);

  const invitation = await env.DB.prepare(
    `SELECT id, workspace_id, email, role, expires_at, accepted_at
     FROM workspace_invitations
     WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{
      id: string;
      workspace_id: number;
      email: string;
      role: string;
      expires_at: string;
      accepted_at: string | null;
    }>();

  if (!invitation) {
    return errorResponse("INVALID_INVITATION", "Invalid or expired invitation", 404);
  }

  if (invitation.accepted_at) {
    return errorResponse("ALREADY_ACCEPTED", "Invitation already accepted", 400);
  }

  if (isExpired(invitation.expires_at)) {
    return errorResponse("INVITATION_EXPIRED", "Invitation has expired", 400);
  }

  // Check email matches
  if (context.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    return errorResponse(
      "EMAIL_MISMATCH",
      "This invitation was sent to a different email address",
      403
    );
  }

  // Check not already a member
  const existingMembership = await env.DB.prepare(
    `SELECT id FROM team_memberships WHERE user_id = ? AND workspace_id = ?`
  )
    .bind(context.user.id, invitation.workspace_id)
    .first();

  if (existingMembership) {
    return errorResponse("ALREADY_MEMBER", "Already a member of this workspace", 409);
  }

  // Accept invitation and create membership
  const membershipId = generateId("mem");

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE workspace_invitations SET accepted_at = datetime('now') WHERE id = ?`
    ).bind(invitation.id),
    env.DB.prepare(
      `INSERT INTO team_memberships (id, user_id, workspace_id, role, accepted_at, created_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(membershipId, context.user.id, invitation.workspace_id, invitation.role),
  ]);

  // Get workspace info
  const workspace = await env.DB.prepare(
    `SELECT slug, name FROM workspaces WHERE id = ?`
  )
    .bind(invitation.workspace_id)
    .first<{ slug: string; name: string | null }>();

  return jsonResponse({
    message: "Invitation accepted",
    workspace: workspace ? { slug: workspace.slug, name: workspace.name } : null,
    role: invitation.role,
  });
}

// =============================================================================
// Update Member Role
// =============================================================================

/**
 * PATCH /api/v1/workspaces/:workspace/team/:memberId
 * Update a team member's role
 */
async function handleUpdateRole(
  workspaceId: number,
  memberId: string,
  context: AuthContext,
  request: Request,
  env: Env
): Promise<Response> {
  const parsed = await validateBody(updateRoleSchema, request);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", parsed.error);
  }

  const { role: newRole } = parsed.data;

  // Get target membership
  const targetMembership = await env.DB.prepare(
    `SELECT tm.user_id, tm.role, u.email
     FROM team_memberships tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.id = ? AND tm.workspace_id = ?`
  )
    .bind(memberId, workspaceId)
    .first<{ user_id: string; role: string; email: string }>();

  if (!targetMembership) {
    return errorResponse("MEMBER_NOT_FOUND", "Team member not found", 404);
  }

  // Cannot change owner role
  if (targetMembership.role === "owner") {
    return errorResponse("CANNOT_MODIFY_OWNER", "Cannot modify workspace owner", 403);
  }

  // Cannot change own role
  if (targetMembership.user_id === context.user.id) {
    return errorResponse("CANNOT_MODIFY_SELF", "Cannot modify your own role", 403);
  }

  // Only owners and admins can change roles
  if (context.role !== "owner" && context.role !== "admin") {
    return errorResponse("INSUFFICIENT_PERMISSIONS", "Only owners and admins can modify roles", 403);
  }

  // Admins cannot promote to admin
  if (context.role === "admin" && newRole === "admin") {
    return errorResponse("INSUFFICIENT_PERMISSIONS", "Only owners can promote to admin", 403);
  }

  await env.DB.prepare(
    `UPDATE team_memberships SET role = ? WHERE id = ?`
  )
    .bind(newRole, memberId)
    .run();

  return jsonResponse({
    message: "Role updated",
    member_id: memberId,
    new_role: newRole,
  });
}

// =============================================================================
// Remove Member
// =============================================================================

/**
 * DELETE /api/v1/workspaces/:workspace/team/:memberId
 * Remove a team member
 */
async function handleRemoveMember(
  workspaceId: number,
  memberId: string,
  context: AuthContext,
  env: Env
): Promise<Response> {
  // Get target membership
  const targetMembership = await env.DB.prepare(
    `SELECT user_id, role FROM team_memberships WHERE id = ? AND workspace_id = ?`
  )
    .bind(memberId, workspaceId)
    .first<{ user_id: string; role: string }>();

  if (!targetMembership) {
    return errorResponse("MEMBER_NOT_FOUND", "Team member not found", 404);
  }

  // Cannot remove owner
  if (targetMembership.role === "owner") {
    return errorResponse("CANNOT_REMOVE_OWNER", "Cannot remove workspace owner", 403);
  }

  // Users can remove themselves (leave)
  const isSelf = targetMembership.user_id === context.user.id;

  // Non-self removal requires admin/owner
  if (!isSelf && context.role !== "owner" && context.role !== "admin") {
    return errorResponse("INSUFFICIENT_PERMISSIONS", "Only owners and admins can remove members", 403);
  }

  // Admins cannot remove other admins
  if (!isSelf && context.role === "admin" && targetMembership.role === "admin") {
    return errorResponse("INSUFFICIENT_PERMISSIONS", "Admins cannot remove other admins", 403);
  }

  await env.DB.prepare(
    `DELETE FROM team_memberships WHERE id = ?`
  )
    .bind(memberId)
    .run();

  return jsonResponse({
    message: isSelf ? "Left workspace" : "Member removed",
  });
}

// =============================================================================
// List Pending Invitations
// =============================================================================

/**
 * GET /api/v1/workspaces/:workspace/team/invites
 * List pending invitations for a workspace
 */
async function handleListInvitations(
  workspaceId: number,
  env: Env
): Promise<Response> {
  const invitations = await env.DB.prepare(
    `SELECT
       wi.id,
       wi.email,
       wi.role,
       wi.expires_at,
       wi.created_at,
       u.name as invited_by_name
     FROM workspace_invitations wi
     LEFT JOIN users u ON wi.invited_by = u.id
     WHERE wi.workspace_id = ? AND wi.accepted_at IS NULL
     ORDER BY wi.created_at DESC`
  )
    .bind(workspaceId)
    .all();

  return jsonResponse({
    invitations: invitations.results.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invited_by: inv.invited_by_name,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
    })),
  });
}

// =============================================================================
// Revoke Invitation
// =============================================================================

/**
 * DELETE /api/v1/workspaces/:workspace/team/invites/:inviteId
 * Revoke a pending invitation
 */
async function handleRevokeInvitation(
  workspaceId: number,
  inviteId: string,
  env: Env
): Promise<Response> {
  const result = await env.DB.prepare(
    `DELETE FROM workspace_invitations
     WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL`
  )
    .bind(inviteId, workspaceId)
    .run();

  if (!result.meta.changes) {
    return errorResponse("INVITATION_NOT_FOUND", "Invitation not found or already accepted", 404);
  }

  return jsonResponse({ message: "Invitation revoked" });
}

// =============================================================================
// Route Handler
// =============================================================================

export async function handleTeamRoutes(
  request: Request,
  pathname: string,
  env: Env
): Promise<Response | null> {
  // Handle invitation acceptance (doesn't require workspace context)
  const inviteMatch = pathname.match(/^\/api\/v1\/invitations\/([^/]+)\/accept$/);
  if (inviteMatch && request.method === "POST") {
    const authResult = await requireAuth(request, env);
    if ("response" in authResult) return authResult.response;
    return handleAcceptInvitation(inviteMatch[1], authResult.context, env);
  }

  // Extract workspace slug from path
  const workspaceMatch = pathname.match(/^\/api\/v1\/workspaces\/([^/]+)\/team(?:\/(.*))?$/);
  if (!workspaceMatch) return null;

  const [, workspaceSlug, subPath] = workspaceMatch;

  // Resolve workspace ID
  const workspaceId = await getWorkspaceIdBySlug(workspaceSlug, env);
  if (!workspaceId) {
    return errorResponse("WORKSPACE_NOT_FOUND", "Workspace not found", 404);
  }

  // Require viewer access minimum for all team routes
  const authResult = await requireWorkspaceAccess(request, workspaceId, "viewer", env);
  if ("response" in authResult) return authResult.response;

  const { context } = authResult;

  // Route based on method and subpath
  if (!subPath || subPath === "") {
    // GET /api/v1/workspaces/:workspace/team
    if (request.method === "GET") {
      return handleListMembers(workspaceId, context, env);
    }
  }

  if (subPath === "invites") {
    // GET /api/v1/workspaces/:workspace/team/invites
    if (request.method === "GET") {
      // Require admin+ to view invitations
      if (context.role !== "owner" && context.role !== "admin") {
        return errorResponse("INSUFFICIENT_PERMISSIONS", "Admin access required", 403);
      }
      return handleListInvitations(workspaceId, env);
    }
    // POST /api/v1/workspaces/:workspace/team/invites
    if (request.method === "POST") {
      // Require admin+ to invite
      if (context.role !== "owner" && context.role !== "admin") {
        return errorResponse("INSUFFICIENT_PERMISSIONS", "Admin access required", 403);
      }
      return handleInviteMember(workspaceId, context, request, env);
    }
  }

  // /invites/:inviteId
  const inviteSubMatch = subPath?.match(/^invites\/([^/]+)$/);
  if (inviteSubMatch && request.method === "DELETE") {
    if (context.role !== "owner" && context.role !== "admin") {
      return errorResponse("INSUFFICIENT_PERMISSIONS", "Admin access required", 403);
    }
    return handleRevokeInvitation(workspaceId, inviteSubMatch[1], env);
  }

  // /:memberId
  const memberSubMatch = subPath?.match(/^([^/]+)$/);
  if (memberSubMatch && memberSubMatch[1] !== "invites") {
    const memberId = memberSubMatch[1];
    if (request.method === "PATCH") {
      return handleUpdateRole(workspaceId, memberId, context, request, env);
    }
    if (request.method === "DELETE") {
      return handleRemoveMember(workspaceId, memberId, context, env);
    }
  }

  return null;
}
