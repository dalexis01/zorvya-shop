import "server-only";

import { randomUUID } from "node:crypto";

import type { SessionUser, StoredUser } from "@/lib/shop/types";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import { readDataFile, writeDataFile } from "@/lib/server/storage";

const USERS_FILE = "users.json";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmedPhone = phone.trim();
  const hasLeadingPlus = trimmedPhone.startsWith("+");
  const digitsOnly = trimmedPhone.replace(/[^\d]/g, "");

  return `${hasLeadingPlus ? "+" : ""}${digitsOnly}`;
}

function trimText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStoredUser(user: StoredUser): StoredUser {
  return {
    ...user,
    isBlocked: Boolean(user.isBlocked),
    blockedAt: user.blockedAt ?? null,
    acceptedTermsAt: user.acceptedTermsAt ?? null,
    acceptedTermsVersion: user.acceptedTermsVersion ?? null,
    emailVerifiedAt:
      "emailVerifiedAt" in user ? user.emailVerifiedAt ?? null : user.createdAt,
  };
}

async function readUsers() {
  const users = await readDataFile<StoredUser[]>(USERS_FILE, []);
  return users.map(normalizeStoredUser);
}

async function writeUsers(users: StoredUser[]) {
  await writeDataFile(USERS_FILE, users);
}

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    createdAt: user.createdAt,
  };
}

export async function findUserById(userId: string) {
  const users = await readUsers();
  return users.find((user) => user.id === userId) ?? null;
}

export async function findUserByEmail(email: string) {
  const users = await readUsers();
  const normalizedEmail = normalizeEmail(email);
  return users.find((user) => user.email === normalizedEmail) ?? null;
}

export async function findUserByPhone(phone: string) {
  const users = await readUsers();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  return users.find((user) => normalizePhone(user.phone) === normalizedPhone) ?? null;
}

export async function findUserByLoginIdentifier(identifier: string) {
  const normalizedIdentifier = identifier.trim();

  if (normalizedIdentifier.includes("@")) {
    return findUserByEmail(normalizedIdentifier);
  }

  return findUserByPhone(normalizedIdentifier);
}

export async function createUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
  acceptedTermsAt: string;
  acceptedTermsVersion: string;
}) {
  const users = await readUsers();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);

  if (users.some((user) => user.email === normalizedEmail)) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  if (normalizedPhone && users.some((user) => normalizePhone(user.phone) === normalizedPhone)) {
    throw new Error("PHONE_ALREADY_EXISTS");
  }

  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: randomUUID(),
    name: trimText(input.name),
    email: normalizedEmail,
    passwordHash: await hashPassword(input.password),
    phone: trimText(input.phone),
    address: "",
    isBlocked: false,
    blockedAt: null,
    acceptedTermsAt: input.acceptedTermsAt,
    acceptedTermsVersion: input.acceptedTermsVersion,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  users.push(newUser);
  await writeUsers(users);

  return newUser;
}

export async function authenticateUser(
  identifier: string,
  password: string
): Promise<
  | { success: true; user: StoredUser }
  | {
      success: false;
      reason: "not_found" | "password" | "blocked" | "unverified";
      user: StoredUser | null;
    }
> {
  const user = await findUserByLoginIdentifier(identifier);

  if (!user) {
    return {
      success: false,
      reason: "not_found",
      user: null,
    };
  }

  if (user.isBlocked) {
    return {
      success: false,
      reason: "blocked",
      user,
    };
  }

  if (!user.emailVerifiedAt) {
    return {
      success: false,
      reason: "unverified",
      user,
    };
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return {
      success: false,
      reason: "password",
      user,
    };
  }

  return {
    success: true,
    user,
  };
}

export async function updateUserContact(
  userId: string,
  input: {
    name?: string;
    phone?: string;
    address?: string;
  }
) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index === -1) {
    return null;
  }

  const currentUser = users[index];
  const nextPhone =
    typeof input.phone === "string" ? trimText(input.phone) : currentUser.phone;
  const normalizedPhone = normalizePhone(nextPhone);
  const conflictingPhoneUser = users.find(
    (user) => user.id !== userId && normalizedPhone && normalizePhone(user.phone) === normalizedPhone
  );

  if (conflictingPhoneUser) {
    throw new Error("PHONE_ALREADY_EXISTS");
  }

  const updatedUser: StoredUser = {
    ...currentUser,
    name: input.name ? trimText(input.name) : currentUser.name,
    phone: nextPhone,
    address:
      typeof input.address === "string" ? trimText(input.address) : currentUser.address,
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  await writeUsers(users);

  return updatedUser;
}

export async function updateUserEmail(userId: string, email: string) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index === -1) {
    return null;
  }

  const normalizedEmail = normalizeEmail(email);
  const conflictingEmailUser = users.find(
    (user) => user.id !== userId && user.email === normalizedEmail
  );

  if (conflictingEmailUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const updatedUser: StoredUser = {
    ...users[index],
    email: normalizedEmail,
    emailVerifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  await writeUsers(users);

  return updatedUser;
}

export async function getAllUsers() {
  return readUsers();
}

export async function updateUserBlockedState(userId: string, isBlocked: boolean) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index === -1) {
    return null;
  }

  const currentUser = users[index];
  const updatedUser: StoredUser = {
    ...currentUser,
    isBlocked,
    blockedAt: isBlocked ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  await writeUsers(users);

  return updatedUser;
}

export async function markUserEmailVerified(userId: string) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index === -1) {
    return null;
  }

  const updatedUser: StoredUser = {
    ...users[index],
    emailVerifiedAt: users[index].emailVerifiedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  await writeUsers(users);

  return updatedUser;
}

export async function updateUserPassword(userId: string, password: string) {
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === userId);

  if (index === -1) {
    return null;
  }

  const updatedUser: StoredUser = {
    ...users[index],
    passwordHash: await hashPassword(password),
    updatedAt: new Date().toISOString(),
  };

  users[index] = updatedUser;
  await writeUsers(users);

  return updatedUser;
}
