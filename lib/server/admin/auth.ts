import "server-only";

import { randomUUID } from "node:crypto";
import { readDataFile, writeDataFile } from "../storage";

import type { AdminPermission, AdminSessionUser, AdminUser } from "@/lib/shop/admin-types";
import { hashPassword, verifyPassword } from "../passwords";

const ADMIN_USERS_FILE = "admin-users.json";
const ADMIN_SESSIONS_FILE = "admin-sessions.json";

interface AdminStoredSession {
  id: string;
  adminUserId: string;
  createdAt: string;
  expiresAt: string;
}

async function readAdminUsers() {
  return readDataFile<AdminUser[]>(ADMIN_USERS_FILE, []);
}

async function writeAdminUsers(users: AdminUser[]) {
  await writeDataFile(ADMIN_USERS_FILE, users);
}

async function readAdminSessions() {
  return readDataFile<AdminStoredSession[]>(ADMIN_SESSIONS_FILE, []);
}

async function writeAdminSessions(sessions: AdminStoredSession[]) {
  await writeDataFile(ADMIN_SESSIONS_FILE, sessions);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const sessions = await readAdminSessions();
  sessions.push({
    id: sessionId,
    adminUserId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  await writeAdminSessions(sessions);
  return sessionId;
}

export async function findAdminSession(sessionId: string) {
  const sessions = await readAdminSessions();
  const session = sessions.find((s) => s.id === sessionId);

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
  const sessions = await readAdminSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  await writeAdminSessions(filtered);
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
