import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";

import { readDataFile, writeDataFile } from "@/lib/server/storage";

type AuthCodePurpose = "verify-email" | "reset-password" | "change-email";

type StoredAuthCode = {
  id: string;
  userId: string;
  email: string;
  purpose: AuthCodePurpose;
  codeHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

const AUTH_CODES_FILE = "auth-codes.json";
const AUTH_CODE_DURATION_MINUTES = 15;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function readAuthCodes() {
  const codes = await readDataFile<StoredAuthCode[]>(AUTH_CODES_FILE, []);
  const now = Date.now();
  const activeCodes = codes.filter((entry) => new Date(entry.expiresAt).getTime() > now);

  if (activeCodes.length !== codes.length) {
    await writeDataFile(AUTH_CODES_FILE, activeCodes);
  }

  return activeCodes;
}

async function writeAuthCodes(codes: StoredAuthCode[]) {
  await writeDataFile(AUTH_CODES_FILE, codes);
}

export async function createAuthCode(input: {
  userId: string;
  email: string;
  purpose: AuthCodePurpose;
}) {
  const codes = await readAuthCodes();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_CODE_DURATION_MINUTES * 60 * 1000);
  const nextCode = String(randomInt(100000, 1000000));
  const normalizedEmail = normalizeEmail(input.email);
  const remainingCodes = codes.filter(
    (entry) =>
      !(
        entry.userId === input.userId &&
        entry.email === normalizedEmail &&
        entry.purpose === input.purpose &&
        entry.consumedAt === null
      )
  );

  remainingCodes.push({
    id: randomUUID(),
    userId: input.userId,
    email: normalizedEmail,
    purpose: input.purpose,
    codeHash: hashCode(nextCode),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    consumedAt: null,
  });

  await writeAuthCodes(remainingCodes);

  return {
    code: nextCode,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyAuthCode(input: {
  userId: string;
  email: string;
  purpose: AuthCodePurpose;
  code: string;
}) {
  const normalizedEmail = normalizeEmail(input.email);
  const codes = await readAuthCodes();
  const nextCodeHash = hashCode(input.code.trim());
  const codeIndex = codes.findIndex(
    (entry) =>
      entry.userId === input.userId &&
      entry.email === normalizedEmail &&
      entry.purpose === input.purpose &&
      entry.consumedAt === null &&
      entry.codeHash === nextCodeHash
  );

  if (codeIndex === -1) {
    return false;
  }

  const updatedCodes = [...codes];
  updatedCodes[codeIndex] = {
    ...updatedCodes[codeIndex],
    consumedAt: new Date().toISOString(),
  };
  await writeAuthCodes(updatedCodes);

  return true;
}
