import fs from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const projectRoot = process.cwd();
const usersFilePath = path.join(projectRoot, "data", "users.json");
const schemaFilePath = path.join(
  projectRoot,
  "db",
  "migrations",
  "002_customer_accounts_postgres.sql"
);

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl(connectionString) {
  if (process.env.PGSSL === "disable" || process.env.CUSTOMER_DB_SSL_DISABLE === "true") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function normalizePhone(phone) {
  const trimmedPhone = String(phone ?? "").trim();
  const hasLeadingPlus = trimmedPhone.startsWith("+");
  const digitsOnly = trimmedPhone.replace(/[^\d]/g, "");

  if (!digitsOnly) {
    return null;
  }

  return `${hasLeadingPlus ? "+" : ""}${digitsOnly}`;
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallbackValue;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallbackValue;
    }

    throw error;
  }
}

async function main() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL, POSTGRES_URL o SUPABASE_DB_URL para migrar los usuarios."
    );
  }

  const [users, schemaSql] = await Promise.all([
    readJsonFile(usersFilePath, []),
    fs.readFile(schemaFilePath, "utf8"),
  ]);

  const pool = new Pool({
    connectionString,
    max: 4,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();

  try {
    console.log(`Migrando ${users.length} usuario(s) a PostgreSQL...`);
    await client.query(schemaSql);
    await client.query("BEGIN");

    for (const user of users) {
      const normalizedEmail = normalizeEmail(user.email);
      const normalizedPhone = normalizePhone(user.phone);

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
          String(user.name ?? "").trim(),
          normalizedEmail,
          user.passwordHash,
          String(user.phone ?? "").trim(),
          normalizedPhone,
          String(user.address ?? "").trim(),
          Boolean(user.isBlocked),
          user.blockedAt ?? null,
          user.acceptedTermsAt ?? null,
          user.acceptedTermsVersion ?? null,
          user.emailVerifiedAt ?? null,
          user.createdAt,
          user.updatedAt ?? user.createdAt,
        ]
      );

      if (String(user.address ?? "").trim()) {
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
          [
            `addr-${user.id}`,
            user.id,
            String(user.address ?? "").trim(),
            user.createdAt,
            user.updatedAt ?? user.createdAt,
          ]
        );
      }
    }

    await client.query("COMMIT");
    console.log("Migracion de usuarios completada correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("No se pudo migrar users.json a PostgreSQL:", error);
  process.exitCode = 1;
});
