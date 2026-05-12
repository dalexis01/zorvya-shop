import "server-only";

import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import type { StoredSession } from "@/lib/shop/types";
import { readDataFile, writeDataFile } from "@/lib/server/storage";
import { findUserById, toSessionUser } from "@/lib/server/users";

const SESSIONS_FILE = "sessions.json";
const SESSION_COOKIE_NAME = "sorvya_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function getCookieOptions(expiresAt: string) {
  return {
    expires: new Date(expiresAt),
    httpOnly: true,
    path: "/",
    priority: "high" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

async function readSessions() {
  const sessions = await readDataFile<StoredSession[]>(SESSIONS_FILE, []);
  const now = Date.now();
  const activeSessions = sessions.filter(
    (session) => new Date(session.expiresAt).getTime() > now
  );

  if (activeSessions.length !== sessions.length) {
    await writeDataFile(SESSIONS_FILE, activeSessions);
  }

  return activeSessions;
}

async function writeSessions(sessions: StoredSession[]) {
  await writeDataFile(SESSIONS_FILE, sessions);
}

export async function createSessionForUser(userId: string) {
  const sessions = await readSessions();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS);

  const newSession: StoredSession = {
    id: randomBytes(32).toString("hex"),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  sessions.push(newSession);
  await writeSessions(sessions);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, newSession.id, getCookieOptions(newSession.expiresAt));

  return newSession;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    const sessions = await readSessions();
    const remainingSessions = sessions.filter((session) => session.id !== sessionId);
    await writeSessions(remainingSessions);
  }

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  const sessions = await readSessions();
  const session = sessions.find((entry) => entry.id === sessionId) ?? null;

  if (!session) {
    await destroyCurrentSession();
    return null;
  }

  return session;
}

export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    await destroyCurrentSession();
    return null;
  }

  return toSessionUser(user);
}
