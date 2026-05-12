import fs from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const projectRoot = process.cwd();
const ordersFilePath = path.join(projectRoot, "data", "orders.json");
const schemaFilePath = path.join(projectRoot, "db", "migrations", "001_orders_postgres.sql");

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl(connectionString) {
  if (process.env.PGSSL === "disable" || process.env.ORDERS_DB_SSL_DISABLE === "true") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
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
      "Falta DATABASE_URL, POSTGRES_URL o SUPABASE_DB_URL para migrar las ordenes."
    );
  }

  const [orders, schemaSql] = await Promise.all([
    readJsonFile(ordersFilePath, []),
    fs.readFile(schemaFilePath, "utf8"),
  ]);

  const pool = new Pool({
    connectionString,
    max: 4,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();

  try {
    console.log(`Migrando ${orders.length} orden(es) a PostgreSQL...`);
    await client.query(schemaSql);
    await client.query("BEGIN");

    for (const order of orders) {
      await client.query(
        `
          INSERT INTO orders (
            id,
            user_id,
            customer_name,
            customer_phone,
            customer_email,
            customer_address,
            delivery_type,
            pickup_date,
            pickup_time,
            requested_agent_call,
            items_json,
            subtotal,
            delivery_distance_km,
            delivery_fee,
            total,
            payment_json,
            created_at,
            updated_at,
            cancelled_at,
            cancellation_reason,
            cancelled_by,
            cancelled_by_name,
            admin_reviewed_at,
            admin_status,
            status_history_json,
            issues_json
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11::jsonb, $12, $13, $14, $15, $16::jsonb, $17::timestamptz, $18::timestamptz,
            $19::timestamptz, $20, $21, $22, $23::timestamptz, $24, $25::jsonb, $26::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            customer_name = EXCLUDED.customer_name,
            customer_phone = EXCLUDED.customer_phone,
            customer_email = EXCLUDED.customer_email,
            customer_address = EXCLUDED.customer_address,
            delivery_type = EXCLUDED.delivery_type,
            pickup_date = EXCLUDED.pickup_date,
            pickup_time = EXCLUDED.pickup_time,
            requested_agent_call = EXCLUDED.requested_agent_call,
            items_json = EXCLUDED.items_json,
            subtotal = EXCLUDED.subtotal,
            delivery_distance_km = EXCLUDED.delivery_distance_km,
            delivery_fee = EXCLUDED.delivery_fee,
            total = EXCLUDED.total,
            payment_json = EXCLUDED.payment_json,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at,
            cancelled_at = EXCLUDED.cancelled_at,
            cancellation_reason = EXCLUDED.cancellation_reason,
            cancelled_by = EXCLUDED.cancelled_by,
            cancelled_by_name = EXCLUDED.cancelled_by_name,
            admin_reviewed_at = EXCLUDED.admin_reviewed_at,
            admin_status = EXCLUDED.admin_status,
            status_history_json = EXCLUDED.status_history_json,
            issues_json = EXCLUDED.issues_json
        `,
        [
          order.id,
          order.userId ?? null,
          order.customerName ?? "",
          order.customerPhone ?? "",
          order.customerEmail ?? "",
          order.customerAddress ?? "",
          order.deliveryType,
          order.pickupDate ?? null,
          order.pickupTime ?? null,
          Boolean(order.requestedAgentCall),
          JSON.stringify(Array.isArray(order.items) ? order.items : []),
          Number(order.subtotal ?? 0),
          order.deliveryDistanceKm == null ? null : Number(order.deliveryDistanceKm),
          Number(order.deliveryFee ?? 0),
          Number(order.total ?? 0),
          JSON.stringify(order.payment ?? null),
          order.createdAt,
          order.updatedAt ?? order.createdAt,
          order.cancelledAt ?? null,
          order.cancellationReason ?? null,
          order.cancelledBy ?? null,
          order.cancelledByName ?? null,
          order.adminReviewedAt ?? null,
          order.adminStatus ?? null,
          JSON.stringify(Array.isArray(order.statusHistory) ? order.statusHistory : []),
          JSON.stringify(Array.isArray(order.issues) ? order.issues : []),
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Migracion completada correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("No se pudo migrar orders.json a PostgreSQL:", error);
  process.exitCode = 1;
});
