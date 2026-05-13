import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readDataFile, writeDataFile } from "../storage";

import type { AdminPermission, AdminSessionUser, AdminUser } from "@/lib/shop/admin-types";
import { hashPassword, verifyPassword } from "../passwords";

const ADMIN_USERS_FILE = "admin-users.json";
const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_ADMIN_EMAIL = "admin@sorvya.local";
const DEFAULT_ADMIN_PASSWORD_HASH =
  "6df71481898e4670cdc20c6952ca8e54:6802c39ca2ba851bc620f1e2c5dfb8b689062ec78c38f9a09f065e04e0198aa94463276e3d1ac1900dde54ca008d7bb4ec1d8af65434f5b622f709019fa7d960";
const DEFAULT_ADMIN_USER: AdminUser = {
  id: "default-admin-user",
  email: DEFAULT_ADMIN_EMAIL,
  passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
  name: "Admin",
  role: "admin",
  permissions: [
    "products.create",
    "products.read",
    "products.update",
    "products.delete",
    "orders.read",
    "orders.update",
    "orders.delete",
    "support.read",
    "support.respond",
    "users.read",
    "users.update",
    "content.update",
    "admin.manage_staff",
  ],
  isActive: true,
  createdAt: "2026-05-12T00:00:00.000Z",
  updatedAt: "2026-05-12T00:00:00.000Z",
  lastLoginAt: null,
  createdBy: "system",
};

async function readAdminUsers() {
  const users = await readDataFile<AdminUser[]>(ADMIN_USERS_FILE, []);

  if (users.length === 0) {
    return [DEFAULT_ADMIN_USER];
  }

  const hasDefaultAdmin = users.some(
    (user) => normalizeEmail(user.email) === DEFAULT_ADMIN_EMAIL
  );

  if (hasDefaultAdmin) {
    return users.map((user) =>
      normalizeEmail(user.email) === DEFAULT_ADMIN_EMAIL
        ? ({
            ...user,
            passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
            permissions: DEFAULT_ADMIN_USER.permissions,
            role: "admin" as const,
            isActive: true,
          } satisfies AdminUser)
        : user
    );
  }

  return [DEFAULT_ADMIN_USER, ...users];
}

async function writeAdminUsers(users: AdminUser[]) {
  await writeDataFile(ADMIN_USERS_FILE, users);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "zorvya-admin-session-secret"
  );
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

export async function findAdminUserByEmail(email: string) {
  const users = await readAdminUsers();
  const normalizedEmail = normalizeEmail(email);
  return users.find((user) => user.email === normalizedEmail) ?? null;
}

export async function findAdminUserById(userId: string) {
  const users = await readAdminUsers();
  return users.find((user) => user.id === userId) ?? null;
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

  // Update last login
  const users = await readAdminUsers();
  const updatedUsers = users.map((u) =>
    u.id === user.id ? { ...u, lastLoginAt: new Date().toISOString() } : u
  );
  await writeAdminUsers(updatedUsers);

  return user;
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
    return null; // Session expired
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

  // Assign default permissions based on role
  const permissions = getDefaultPermissions(input.role);

  const newUser: AdminUser = {
    id: userId,
    email: normalizeEmail(input.email),
    passwordHash,
    name: input.name.trim(),
    role: input.role,
    permissions,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: null,
    createdBy: input.createdBy,
  };

  const users = await readAdminUsers();
  users.push(newUser);
  await writeAdminUsers(users);

  return newUser;
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
        "support.read",
        "support.respond",
        "users.read",
        "users.update",
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
        "support.read",
        "support.respond",
        "users.read",
      ];

    case "support_agent":
      return ["support.read", "support.respond", "users.read", "orders.read"];
  }
}

export async function updateAdminUser(
  userId: string,
  updates: Partial<Omit<AdminUser, "id" | "createdAt" | "createdBy">>
) {
  const users = await readAdminUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const updated: AdminUser = {
    ...user,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const updatedUsers = users.map((u) => (u.id === userId ? updated : u));
  await writeAdminUsers(updatedUsers);

  return updated;
}
