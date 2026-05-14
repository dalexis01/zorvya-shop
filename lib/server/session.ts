import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import type { StoredSession } from "@/lib/shop/types";
import { findUserById, toSessionUser } from "@/lib/server/users";

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

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "zorvya-customer-session-secret"
  );
}

function encodeSessionToken(input: StoredSession) {
  const payload = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function decodeSessionToken(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", getSessionSecret())
    .update(payload)
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
      Buffer.from(payload, "base64url").toString("utf8")
    ) as StoredSession;

    if (!parsed?.id || !parsed?.userId || !parsed?.createdAt || !parsed?.expiresAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function createSessionForUser(userId: string) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS);
  const session: StoredSession = {
    id: randomBytes(24).toString("hex"),
    userId,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    encodeSessionToken(session),
    getCookieOptions(session.expiresAt)
  );

  return session;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
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
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = decodeSessionToken(token);

  if (!session) {
    await destroyCurrentSession();
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
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
