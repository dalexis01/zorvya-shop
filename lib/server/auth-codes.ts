import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";

import { getCustomerPool, normalizeCustomerEmail } from "@/lib/server/customer-db";

type AuthCodePurpose = "verify-email" | "reset-password" | "change-email";

const AUTH_CODE_DURATION_MINUTES = 15;
const AUTH_CODE_MAX_ATTEMPTS = 5;
const AUTH_CODE_MAX_REQUESTS_PER_WINDOW = 3;
const AUTH_CODE_REQUEST_WINDOW_MINUTES = 15;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

async function cleanupExpiredAuthCodes() {
  const pool = await getCustomerPool();
  await pool.query(
    `
      DELETE FROM auth_codes
      WHERE expires_at < NOW() - INTERVAL '1 day'
    `
  );
}

async function assertAuthCodeRequestAllowed(input: {
  userId: string;
  email: string;
  purpose: AuthCodePurpose;
}) {
  const pool = await getCustomerPool();
  const result = await pool.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM auth_codes
      WHERE
        user_id = $1
        AND email = $2
        AND purpose = $3
        AND created_at >= NOW() - INTERVAL '${AUTH_CODE_REQUEST_WINDOW_MINUTES} minutes'
    `,
    [input.userId, normalizeCustomerEmail(input.email), input.purpose]
  );

  if (Number(result.rows[0]?.count ?? "0") >= AUTH_CODE_MAX_REQUESTS_PER_WINDOW) {
    throw new Error("AUTH_CODE_RATE_LIMIT");
  }
}

export async function createAuthCode(input: {
  userId: string;
  email: string;
  purpose: AuthCodePurpose;
}) {
  const pool = await getCustomerPool();
  await cleanupExpiredAuthCodes();
  await assertAuthCodeRequestAllowed(input);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_CODE_DURATION_MINUTES * 60 * 1000);
  const nextCode = String(randomInt(100000, 1000000));
  const normalizedEmail = normalizeCustomerEmail(input.email);

  await pool.query(
    `
      DELETE FROM auth_codes
      WHERE
        user_id = $1
        AND email = $2
        AND purpose = $3
        AND consumed_at IS NULL
    `,
    [input.userId, normalizedEmail, input.purpose]
  );

  await pool.query(
    `
      INSERT INTO auth_codes (
        id,
        user_id,
        email,
        purpose,
        code_hash,
        attempts,
        created_at,
        expires_at,
        consumed_at
      ) VALUES (
        $1, $2, $3, $4, $5, 0, $6::timestamptz, $7::timestamptz, NULL
      )
    `,
    [
      randomUUID(),
      input.userId,
      normalizedEmail,
      input.purpose,
      hashCode(nextCode),
      now.toISOString(),
      expiresAt.toISOString(),
    ]
  );

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
  const pool = await getCustomerPool();
  await cleanupExpiredAuthCodes();

  const normalizedEmail = normalizeCustomerEmail(input.email);
  const nextCodeHash = hashCode(input.code.trim());
  const result = await pool.query<{ id: string }>(
    `
      UPDATE auth_codes
      SET consumed_at = NOW()
      WHERE id = (
        SELECT id
        FROM auth_codes
        WHERE
          user_id = $1
          AND email = $2
          AND purpose = $3
          AND consumed_at IS NULL
          AND expires_at >= NOW()
          AND attempts < $5
          AND code_hash = $4
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `,
    [input.userId, normalizedEmail, input.purpose, nextCodeHash, AUTH_CODE_MAX_ATTEMPTS]
  );

  if (result.rows[0]) {
    return true;
  }

  await pool.query(
    `
      UPDATE auth_codes
      SET attempts = attempts + 1
      WHERE id = (
        SELECT id
        FROM auth_codes
        WHERE
          user_id = $1
          AND email = $2
          AND purpose = $3
          AND consumed_at IS NULL
          AND expires_at >= NOW()
        ORDER BY created_at DESC
        LIMIT 1
      )
    `,
    [input.userId, normalizedEmail, input.purpose]
  );

  return false;
}
