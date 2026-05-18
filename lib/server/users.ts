import "server-only";

import { randomUUID } from "node:crypto";

import type { SessionUser, StoredUser } from "@/lib/shop/types";
import { getCustomerPool, normalizeCustomerEmail, normalizeCustomerPhone, trimCustomerText } from "@/lib/server/customer-db";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";

type StoredUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string;
  address: string;
  is_blocked: boolean;
  blocked_at: Date | string | null;
  accepted_terms_at: Date | string | null;
  accepted_terms_version: string | null;
  email_verified_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToStoredUser(row: StoredUserRow): StoredUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    phone: row.phone,
    address: row.address,
    isBlocked: Boolean(row.is_blocked),
    blockedAt: toIsoString(row.blocked_at),
    acceptedTermsAt: toIsoString(row.accepted_terms_at),
    acceptedTermsVersion: row.accepted_terms_version ?? null,
    emailVerifiedAt: toIsoString(row.email_verified_at),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
  };
}

async function findUserByField(field: "id" | "email" | "phone_normalized", value: string) {
  const pool = await getCustomerPool();
  const result = await pool.query<StoredUserRow>(
    `
      SELECT
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
      FROM users
      WHERE ${field} = $1
      LIMIT 1
    `,
    [value]
  );

  return result.rows[0] ? rowToStoredUser(result.rows[0]) : null;
}

async function syncDefaultAddress(userId: string, address: string, updatedAt: string) {
  const pool = await getCustomerPool();
  const normalizedAddress = trimCustomerText(address);

  if (!normalizedAddress) {
    await pool.query("DELETE FROM addresses WHERE user_id = $1 AND is_default = TRUE", [userId]);
    return;
  }

  await pool.query(
    `
      INSERT INTO addresses (
        id,
        user_id,
        label,
        address_line,
        city,
        country,
        reference,
        latitude,
        longitude,
        is_default,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, 'Principal', $3, 'Paramaribo', 'Suriname', NULL, NULL, NULL, TRUE, $4::timestamptz, $5::timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        address_line = EXCLUDED.address_line,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        reference = EXCLUDED.reference,
        is_default = TRUE,
        updated_at = EXCLUDED.updated_at
    `,
    [`addr-${userId}`, userId, normalizedAddress, updatedAt, updatedAt]
  );
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
  return findUserByField("id", userId);
}

export async function findUserByEmail(email: string) {
  return findUserByField("email", normalizeCustomerEmail(email));
}

export async function findUserByPhone(phone: string) {
  const normalizedPhone = normalizeCustomerPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  return findUserByField("phone_normalized", normalizedPhone);
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
  const pool = await getCustomerPool();
  const normalizedEmail = normalizeCustomerEmail(input.email);
  const normalizedPhone = normalizeCustomerPhone(input.phone);

  if (await findUserByEmail(normalizedEmail)) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  if (normalizedPhone && (await findUserByPhone(input.phone))) {
    throw new Error("PHONE_ALREADY_EXISTS");
  }

  const now = new Date().toISOString();
  const newUser: StoredUser = {
    id: randomUUID(),
    name: trimCustomerText(input.name),
    email: normalizedEmail,
    passwordHash: await hashPassword(input.password),
    phone: trimCustomerText(input.phone),
    address: "",
    isBlocked: false,
    blockedAt: null,
    acceptedTermsAt: input.acceptedTermsAt,
    acceptedTermsVersion: input.acceptedTermsVersion,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await pool.query(
    `
      INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        phone,
        phone_normalized,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, FALSE, NULL, $8::timestamptz, $9, NULL, $10::timestamptz, $11::timestamptz
      )
    `,
    [
      newUser.id,
      newUser.name,
      newUser.email,
      newUser.passwordHash,
      newUser.phone,
      normalizedPhone,
      newUser.address,
      newUser.acceptedTermsAt,
      newUser.acceptedTermsVersion,
      newUser.createdAt,
      newUser.updatedAt,
    ]
  );

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
  const currentUser = await findUserById(userId);

  if (!currentUser) {
    return null;
  }

  const pool = await getCustomerPool();
  const nextPhone =
    typeof input.phone === "string" ? trimCustomerText(input.phone) : currentUser.phone;
  const normalizedPhone = normalizeCustomerPhone(nextPhone);

  if (normalizedPhone) {
    const conflictingPhoneUser = await pool.query<{ id: string }>(
      `
        SELECT id
        FROM users
        WHERE id <> $1 AND phone_normalized = $2
        LIMIT 1
      `,
      [userId, normalizedPhone]
    );

    if (conflictingPhoneUser.rows[0]) {
      throw new Error("PHONE_ALREADY_EXISTS");
    }
  }

  const updatedAt = new Date().toISOString();
  const nextAddress =
    typeof input.address === "string" ? trimCustomerText(input.address) : currentUser.address;

  const result = await pool.query<StoredUserRow>(
    `
      UPDATE users
      SET
        name = $2,
        phone = $3,
        phone_normalized = $4,
        address = $5,
        updated_at = $6::timestamptz
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
    `,
    [
      userId,
      input.name ? trimCustomerText(input.name) : currentUser.name,
      nextPhone,
      normalizedPhone,
      nextAddress,
      updatedAt,
    ]
  );

  const updatedUser = result.rows[0] ? rowToStoredUser(result.rows[0]) : null;

  if (updatedUser) {
    await syncDefaultAddress(userId, updatedUser.address, updatedUser.updatedAt);
  }

  return updatedUser;
}

export async function updateUserEmail(userId: string, email: string) {
  const pool = await getCustomerPool();
  const normalizedEmail = normalizeCustomerEmail(email);

  const conflictingEmailUser = await pool.query<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE id <> $1 AND email = $2
      LIMIT 1
    `,
    [userId, normalizedEmail]
  );

  if (conflictingEmailUser.rows[0]) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const result = await pool.query<StoredUserRow>(
    `
      UPDATE users
      SET
        email = $2,
        email_verified_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
    `,
    [userId, normalizedEmail]
  );

  return result.rows[0] ? rowToStoredUser(result.rows[0]) : null;
}

export async function getBlockedUserCount(): Promise<number> {
  try {
    const pool = await getCustomerPool();
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) FILTER (WHERE is_blocked = true)::text AS count FROM users`
    );
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function getAllUsers() {
  const pool = await getCustomerPool();
  const result = await pool.query<StoredUserRow>(
    `
      SELECT
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
      FROM users
      ORDER BY created_at DESC, id DESC
    `
  );

  return result.rows.map(rowToStoredUser);
}

export async function updateUserBlockedState(userId: string, isBlocked: boolean) {
  const pool = await getCustomerPool();
  const result = await pool.query<StoredUserRow>(
    `
      UPDATE users
      SET
        is_blocked = $2,
        blocked_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
    `,
    [userId, isBlocked]
  );

  return result.rows[0] ? rowToStoredUser(result.rows[0]) : null;
}

export async function markUserEmailVerified(userId: string) {
  const pool = await getCustomerPool();
  const result = await pool.query<StoredUserRow>(
    `
      UPDATE users
      SET
        email_verified_at = COALESCE(email_verified_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
    `,
    [userId]
  );

  return result.rows[0] ? rowToStoredUser(result.rows[0]) : null;
}

export async function updateUserPassword(userId: string, password: string) {
  const pool = await getCustomerPool();
  const passwordHash = await hashPassword(password);
  const result = await pool.query<StoredUserRow>(
    `
      UPDATE users
      SET
        password_hash = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        name,
        email,
        password_hash,
        phone,
        address,
        is_blocked,
        blocked_at,
        accepted_terms_at,
        accepted_terms_version,
        email_verified_at,
        created_at,
        updated_at
    `,
    [userId, passwordHash]
  );

  return result.rows[0] ? rowToStoredUser(result.rows[0]) : null;
}

export async function findOrCreateGuestUser(input: {
  name: string;
  email: string;
  phone: string;
  address?: string;
}): Promise<StoredUser | null> {
  const email = normalizeCustomerEmail(input.email);
  if (!email) return null;

  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const pool = await getCustomerPool();
  const now = new Date().toISOString();
  const tempPassword = `Guest-${randomUUID().slice(0, 12)}`;
  const passwordHash = await hashPassword(tempPassword);
  const normalizedPhone = normalizeCustomerPhone(input.phone);

  const id = randomUUID();

  try {
    await pool.query(
      `INSERT INTO users (
        id, name, email, password_hash, phone, phone_normalized, address,
        is_blocked, blocked_at, accepted_terms_at, accepted_terms_version,
        email_verified_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, FALSE, NULL, NULL, NULL, NULL, $8::timestamptz, $9::timestamptz
      ) ON CONFLICT (email) DO NOTHING`,
      [
        id,
        trimCustomerText(input.name),
        email,
        passwordHash,
        trimCustomerText(input.phone),
        normalizedPhone,
        input.address ? trimCustomerText(input.address) : "",
        now,
        now,
      ]
    );
    return (await findUserByEmail(email));
  } catch (err) {
    console.error("[users] findOrCreateGuestUser failed:", err);
    return null;
  }
}
