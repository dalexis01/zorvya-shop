import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import type { StoredUser } from "@/lib/shop/types";

const CUSTOMER_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "002_customer_accounts_postgres.sql"
);
const LEGACY_USERS_FILE_PATH = path.join(process.cwd(), "data", "users.json");

let customerPoolInstance: Pool | null = null;
let customerSchemaReadyPromise: Promise<void> | null = null;

function getCustomerConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

export function isCustomerDatabaseConfigured() {
  return Boolean(getCustomerConnectionString());
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSL === "disable" || process.env.CUSTOMER_DB_SSL_DISABLE === "true") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

type LegacyUserRecord = StoredUser & {
  blockedAt?: string | null;
  acceptedTermsAt?: string | null;
  acceptedTermsVersion?: string | null;
  emailVerifiedAt?: string | null;
};

function trimText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmedPhone = phone.trim();
  const hasLeadingPlus = trimmedPhone.startsWith("+");
  const digitsOnly = trimmedPhone.replace(/[^\d]/g, "");

  if (!digitsOnly) {
    return null;
  }

  return `${hasLeadingPlus ? "+" : ""}${digitsOnly}`;
}

async function readLegacyUsersFile() {
  try {
    const raw = await readFile(LEGACY_USERS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as LegacyUserRecord[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return [];
    }

    console.error("[users] no se pudo leer data/users.json para bootstrap:", error);
    return [];
  }
}

async function bootstrapLegacyUsers(pool: Pool) {
  const existingUsers = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");

  if (Number(existingUsers.rows[0]?.count ?? "0") > 0) {
    return;
  }

  const legacyUsers = await readLegacyUsersFile();

  if (legacyUsers.length === 0) {
    console.info("[users] bootstrap omitido: no hay usuarios legacy para migrar.");
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const user of legacyUsers) {
      const normalizedEmail = normalizeEmail(user.email);
      const normalizedPhone = normalizePhone(user.phone ?? "");
      const safeAddress = trimText(user.address ?? "");

      await client.query(
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
            $1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10::timestamptz, $11, $12::timestamptz, $13::timestamptz, $14::timestamptz
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            phone = EXCLUDED.phone,
            phone_normalized = EXCLUDED.phone_normalized,
            address = EXCLUDED.address,
            is_blocked = EXCLUDED.is_blocked,
            blocked_at = EXCLUDED.blocked_at,
            accepted_terms_at = EXCLUDED.accepted_terms_at,
            accepted_terms_version = EXCLUDED.accepted_terms_version,
            email_verified_at = EXCLUDED.email_verified_at,
            updated_at = EXCLUDED.updated_at
        `,
        [
          user.id,
          trimText(user.name),
          normalizedEmail,
          user.passwordHash,
          trimText(user.phone ?? ""),
          normalizedPhone,
          safeAddress,
          Boolean(user.isBlocked),
          user.blockedAt ?? null,
          user.acceptedTermsAt ?? null,
          user.acceptedTermsVersion ?? null,
          user.emailVerifiedAt ?? null,
          user.createdAt,
          user.updatedAt ?? user.createdAt,
        ]
      );

      if (safeAddress) {
        await client.query(
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
              $1, $2, $3, $4, $5, $6, $7, NULL, NULL, TRUE, $8::timestamptz, $9::timestamptz
            )
            ON CONFLICT (id) DO UPDATE SET
              address_line = EXCLUDED.address_line,
              city = EXCLUDED.city,
              country = EXCLUDED.country,
              reference = EXCLUDED.reference,
              is_default = TRUE,
              updated_at = EXCLUDED.updated_at
          `,
          [
            `addr-${user.id}`,
            user.id,
            "Principal",
            safeAddress,
            "Paramaribo",
            "Suriname",
            null,
            user.createdAt,
            user.updatedAt ?? user.createdAt,
          ]
        );
      }
    }

    await client.query("COMMIT");
    console.info(
      `[users] bootstrap completado: ${legacyUsers.length} usuario(s) migrados desde data/users.json`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[users] fallo el bootstrap de usuarios legacy:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function ensureCustomerSchema(pool: Pool) {
  const sql = await readFile(CUSTOMER_SCHEMA_FILE, "utf8");
  await pool.query(sql);
  await bootstrapLegacyUsers(pool);
}

export async function getCustomerPool() {
  const connectionString = getCustomerConnectionString();

  if (!connectionString) {
    throw new Error("CUSTOMER_DB_NOT_CONFIGURED");
  }

  if (!customerPoolInstance) {
    customerPoolInstance = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!customerSchemaReadyPromise) {
    customerSchemaReadyPromise = ensureCustomerSchema(customerPoolInstance);
  }

  await customerSchemaReadyPromise;
  return customerPoolInstance;
}

export function normalizeCustomerEmail(email: string) {
  return normalizeEmail(email);
}

export function normalizeCustomerPhone(phone: string) {
  return normalizePhone(phone);
}

export function trimCustomerText(value: string) {
  return trimText(value);
}
