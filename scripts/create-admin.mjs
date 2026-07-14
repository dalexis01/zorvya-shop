import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const RUNTIME_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "012_admin_runtime_postgres.sql"
);
const KEY_LENGTH = 64;

const [emailArg, passwordArg, nameArg, roleArg] = process.argv.slice(2);

const input = {
  email: emailArg ?? "admin@sorvya.local",
  password: passwordArg ?? "admin4466",
  name: nameArg ?? "Admin Principal",
  role: roleArg ?? "admin",
  createdBy: "system",
};

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function getDefaultPermissions(role) {
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
        "blocks.read",
        "blocks.manage",
        "support.read",
        "support.respond",
        "users.read",
        "users.update",
        "providers.read",
        "providers.manage",
        "settings.manage",
        "revenue.read",
        "ai_products.manage",
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
        "blocks.read",
        "blocks.manage",
        "support.read",
        "support.respond",
        "users.read",
        "providers.read",
        "settings.manage",
      ];
    case "support_agent":
      return ["support.read", "support.respond", "users.read", "orders.read"];
    default:
      throw new Error("INVALID_ROLE");
  }
}

function shouldUseSsl(connectionString) {
  if (process.env.PGSSL === "disable") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

async function ensureSchema(pool) {
  const sql = await readFile(RUNTIME_SCHEMA_FILE, "utf8");
  await pool.query(sql);
}

async function main() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("DATABASE_URL, POSTGRES_URL o SUPABASE_DB_URL es requerido.");
  }

  const role = input.role.trim();
  const permissions = getDefaultPermissions(role);
  const pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await ensureSchema(pool);

    const email = normalizeEmail(input.email);
    const existingUser = await pool.query(
      `SELECT id FROM admin_users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );

    if (existingUser.rowCount) {
      console.error(`Admin user already exists for ${email}`);
      process.exitCode = 1;
      return;
    }

    const userId = randomUUID();
    await pool.query(
      `
        INSERT INTO admin_users (
          id,
          email,
          password_hash,
          name,
          role,
          permissions_json,
          is_active,
          created_at,
          updated_at,
          last_login_at,
          created_by
        ) VALUES (
          $1, LOWER($2), $3, $4, $5, $6::jsonb, TRUE, NOW(), NOW(), NULL, $7
        )
      `,
      [
        userId,
        email,
        hashPassword(input.password),
        input.name.trim(),
        role,
        JSON.stringify(permissions),
        input.createdBy,
      ]
    );

    console.log("Admin user created successfully");
    console.log(
      JSON.stringify(
        {
          id: userId,
          email,
          name: input.name.trim(),
          role,
        },
        null,
        2
      )
    );
    console.log(`Login email: ${input.email}`);
    console.log(`Login password: ${input.password}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to create admin user");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
