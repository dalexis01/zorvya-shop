import "server-only";

import { createHash, randomInt, randomUUID } from "node:crypto";

import { getCustomerPool, normalizeCustomerEmail } from "@/lib/server/customer-db";

type AuthCodePurpose = "verify-email" | "reset-password" | "change-email";

const AUTH_CODE_DURATION_MINUTES = 15;

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

export async function createAuthCode(input: {
  userId: string;
  email: string;
  purpose: AuthCodePurpose;
}) {
  const pool = await getCustomerPool();
  await cleanupExpiredAuthCodes();

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
        created_at,
        expires_at,
        consumed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, NULL
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
          AND code_hash = $4
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `,
    [input.userId, normalizedEmail, input.purpose, nextCodeHash]
  );

  return Boolean(result.rows[0]);
}
