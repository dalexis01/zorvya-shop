import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { AdminPermission, AdminSessionUser, AdminUser } from "@/lib/shop/admin-types";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { getAdminRuntimePool } from "@/lib/server/admin/runtime-db";

const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AdminUserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: AdminUser["role"];
  permissions_json: AdminPermission[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  created_by: string;
};

let warnedAboutDevSecret = false;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapAdminUserRow(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: normalizeEmail(row.email),
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role,
    permissions: Array.isArray(row.permissions_json) ? row.permissions_json : [],
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
  };
}

function getAdminSessionSecret() {
  const secret = (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ""
  ).trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== "production") {
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn(
        "[admin/auth] ADMIN_SESSION_SECRET no configurado; usando secreto temporal solo para desarrollo."
      );
    }

    return "dev-only-admin-session-secret";
  }

  throw new Error("ADMIN_SESSION_SECRET_MISSING");
}

function encodeAdminSessionToken(input: { adminUserId: string; expiresAt: string }) {
  const payload = JSON.stringify(input);
  const payloadBase64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", getAdminSessionSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

function decodeAdminSessionToken(token: string) {
  const [payloadBase64, signature] = token.split(".");

  if (!payloadBase64 || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getAdminSessionSecret())
    .update(payloadBase64)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    ) as { adminUserId?: string; expiresAt?: string };

    if (!parsed.adminUserId || !parsed.expiresAt) {
      return null;
    }

    return {
      adminUserId: parsed.adminUserId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function getDefaultPermissions(
  role: "admin" | "worker" | "support_agent"
): AdminPermission[] {
  switch (role) {
    case "admin":
      return [
        "products.create",
        "products.read",
        "products.update",
        "products.delete",
        "orders.read",
        "orders.update",
        "orders.delete",
        "blocks.read",
        "blocks.manage",
        "support.read",
        "support.respond",
        "users.read",
        "users.update",
        "providers.read",
        "providers.manage",
        "settings.manage",
        "revenue.read",
        "ai_products.manage",
        "content.update",
        "admin.manage_staff",
      ];

    case "worker":
      return [
        "products.create",
        "products.read",
        "products.update",
        "orders.read",
        "orders.update",
        "blocks.read",
        "blocks.manage",
        "support.read",
        "support.respond",
        "users.read",
        "providers.read",
        "settings.manage",
      ];

    case "support_agent":
      return ["support.read", "support.respond", "users.read", "orders.read"];
  }
}

export function hasAdminPermission(
  user: Pick<AdminUser, "role" | "permissions"> | Pick<AdminSessionUser, "role" | "permissions">,
  permission: AdminPermission
) {
  return user.role === "admin" || user.permissions.includes(permission);
}

export function assertAdminPermission(
  user: Pick<AdminUser, "role" | "permissions"> | Pick<AdminSessionUser, "role" | "permissions">,
  permission: AdminPermission
) {
  if (!hasAdminPermission(user, permission)) {
    throw new Error("FORBIDDEN");
  }
}

export async function findAdminUserByEmail(email: string) {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<AdminUserRow>(
    `
      SELECT
        id,
        email,
        password_hash,
        name,
        role,
        permissions_json,
        is_active,
        created_at::text,
        updated_at::text,
        last_login_at::text,
        created_by
      FROM admin_users
      WHERE LOWER(email) = $1
      LIMIT 1
    `,
    [normalizeEmail(email)]
  );

  return result.rows[0] ? mapAdminUserRow(result.rows[0]) : null;
}

export async function findAdminUserById(userId: string) {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<AdminUserRow>(
    `
      SELECT
        id,
        email,
        password_hash,
        name,
        role,
        permissions_json,
        is_active,
        created_at::text,
        updated_at::text,
        last_login_at::text,
        created_by
      FROM admin_users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] ? mapAdminUserRow(result.rows[0]) : null;
}

export async function authenticateAdminUser(email: string, password: string) {
  const user = await findAdminUserByEmail(email);

  if (!user || !user.isActive) {
    return null;
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);

  if (!isValidPassword) {
    return null;
  }

  const pool = await getAdminRuntimePool();
  await pool.query(
    `UPDATE admin_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [user.id]
  );

  return {
    ...user,
    lastLoginAt: new Date().toISOString(),
  };
}

export async function createAdminSession(adminUserId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);

  return encodeAdminSessionToken({
    adminUserId,
    expiresAt: expiresAt.toISOString(),
  });
}

export async function findAdminSession(sessionId: string) {
  const session = decodeAdminSessionToken(sessionId);

  if (!session) {
    return null;
  }

  const expiresAt = new Date(session.expiresAt);
  if (expiresAt < new Date()) {
    return null;
  }

  const user = await findAdminUserById(session.adminUserId);
  if (!user || !user.isActive) {
    return null;
  }

  return { session, user };
}

export async function deleteAdminSession(sessionId: string) {
  void sessionId;
}

export async function toAdminSessionUser(user: AdminUser): Promise<AdminSessionUser> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  };
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "worker" | "support_agent";
  createdBy: string;
}) {
  const existingUser = await findAdminUserByEmail(input.email);
  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);
  const userId = randomUUID();
  const permissions = getDefaultPermissions(input.role);
  const pool = await getAdminRuntimePool();

  await pool.query(
    `
      INSERT INTO admin_users (
        id,
        email,
        password_hash,
        name,
        role,
        permissions_json,
        is_active,
        created_at,
        updated_at,
        last_login_at,
        created_by
      ) VALUES (
        $1, LOWER($2), $3, $4, $5, $6::jsonb, TRUE, NOW(), NOW(), NULL, $7
      )
    `,
    [
      userId,
      input.email,
      passwordHash,
      input.name.trim(),
      input.role,
      JSON.stringify(permissions),
      input.createdBy,
    ]
  );

  return findAdminUserById(userId);
}

export async function updateAdminUser(
  userId: string,
  updates: Partial<Omit<AdminUser, "id" | "createdAt" | "createdBy">>
) {
  const current = await findAdminUserById(userId);

  if (!current) {
    throw new Error("USER_NOT_FOUND");
  }

  const next: AdminUser = {
    ...current,
    ...updates,
    email: normalizeEmail(updates.email ?? current.email),
    permissions: updates.permissions ?? current.permissions,
    updatedAt: new Date().toISOString(),
  };

  const pool = await getAdminRuntimePool();
  await pool.query(
    `
      UPDATE admin_users
      SET
        email = LOWER($2),
        password_hash = $3,
        name = $4,
        role = $5,
        permissions_json = $6::jsonb,
        is_active = $7,
        updated_at = $8::timestamptz,
        last_login_at = $9::timestamptz
      WHERE id = $1
    `,
    [
      userId,
      next.email,
      next.passwordHash,
      next.name,
      next.role,
      JSON.stringify(next.permissions),
      next.isActive,
      next.updatedAt,
      next.lastLoginAt ?? null,
    ]
  );

  return next;
}
