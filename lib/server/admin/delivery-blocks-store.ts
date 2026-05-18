import "server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const BLOCKS_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "003_delivery_blocks.sql"
);

let blocksPoolInstance: Pool | null = null;
let blocksSchemaReadyPromise: Promise<void> | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockStatus = "draft" | "ready" | "in_delivery" | "completed" | "cancelled";

export interface DeliveryBlock {
  id: string;
  name: string;
  status: BlockStatus;
  routeDistanceKm: number | null;
  routeDurationMinutes: number | null;
  routePolyline: string | null;
  totalAmount: number;
  totalDeliveryFee: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  notes: string | null;
  orders?: DeliveryBlockOrderSlot[];
}

export interface DeliveryBlockOrderSlot {
  blockId: string;
  orderId: string;
  position: number;
  legDistanceKm: number | null;
  legDurationMinutes: number | null;
  createdAt: string;
}

// ─── Pool setup ───────────────────────────────────────────────────────────────

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl(cs: string) {
  if (process.env.PGSSL === "disable") return false;
  return cs.includes("supabase") || process.env.NODE_ENV === "production";
}

async function getBlocksPool(): Promise<Pool> {
  const cs = getConnectionString();
  if (!cs) throw new Error("BLOCKS_DB_NOT_CONFIGURED");

  if (!blocksPoolInstance) {
    blocksPoolInstance = new Pool({
      connectionString: cs,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: shouldUseSsl(cs) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!blocksSchemaReadyPromise) {
    blocksSchemaReadyPromise = readFile(BLOCKS_SCHEMA_FILE, "utf8")
      .then((sql) => blocksPoolInstance!.query(sql))
      .then(() => undefined)
      .catch((err) => {
        blocksSchemaReadyPromise = null;
        throw err;
      });
  }

  await blocksSchemaReadyPromise;
  return blocksPoolInstance;
}

// ─── Row converters ───────────────────────────────────────────────────────────

function toBlock(row: Record<string, unknown>): DeliveryBlock {
  return {
    id: String(row.id),
    name: String(row.name),
    status: String(row.status) as BlockStatus,
    routeDistanceKm: row.route_distance_km != null ? Number(row.route_distance_km) : null,
    routeDurationMinutes: row.route_duration_minutes != null ? Number(row.route_duration_minutes) : null,
    routePolyline: row.route_polyline ? String(row.route_polyline) : null,
    totalAmount: Number(row.total_amount ?? 0),
    totalDeliveryFee: Number(row.total_delivery_fee ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    createdBy: String(row.created_by ?? "admin"),
    notes: row.notes ? String(row.notes) : null,
  };
}

function toSlot(row: Record<string, unknown>): DeliveryBlockOrderSlot {
  return {
    blockId: String(row.block_id),
    orderId: String(row.order_id),
    position: Number(row.position ?? 0),
    legDistanceKm: row.leg_distance_km != null ? Number(row.leg_distance_km) : null,
    legDurationMinutes: row.leg_duration_minutes != null ? Number(row.leg_duration_minutes) : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

// ─── Blocks CRUD ──────────────────────────────────────────────────────────────

export async function listDeliveryBlocks(): Promise<DeliveryBlock[]> {
  const pool = await getBlocksPool();
  const res = await pool.query<Record<string, unknown>>(
    `SELECT * FROM delivery_blocks ORDER BY created_at DESC LIMIT 100`
  );
  return res.rows.map(toBlock);
}

export async function getDeliveryBlockById(id: string): Promise<DeliveryBlock | null> {
  const pool = await getBlocksPool();

  const [blockRes, slotsRes] = await Promise.all([
    pool.query<Record<string, unknown>>(
      `SELECT * FROM delivery_blocks WHERE id = $1`,
      [id]
    ),
    pool.query<Record<string, unknown>>(
      `SELECT * FROM delivery_block_orders WHERE block_id = $1 ORDER BY position ASC`,
      [id]
    ),
  ]);

  if (!blockRes.rows[0]) return null;

  const block = toBlock(blockRes.rows[0]);
  block.orders = slotsRes.rows.map(toSlot);
  return block;
}

export async function createDeliveryBlock(input: {
  name: string;
  orderIds: string[];
  totalAmount?: number;
  totalDeliveryFee?: number;
  createdBy?: string;
}): Promise<DeliveryBlock> {
  const pool = await getBlocksPool();
  const id = `BLK-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO delivery_blocks (id, name, status, total_amount, total_delivery_fee, created_at, updated_at, created_by)
       VALUES ($1, $2, 'draft', $3, $4, $5::timestamptz, $5::timestamptz, $6)`,
      [id, input.name.trim(), input.totalAmount ?? 0, input.totalDeliveryFee ?? 0, now, input.createdBy ?? "admin"]
    );

    for (let i = 0; i < input.orderIds.length; i++) {
      await client.query(
        `INSERT INTO delivery_block_orders (block_id, order_id, position, created_at)
         VALUES ($1, $2, $3, $4::timestamptz)
         ON CONFLICT (order_id) DO UPDATE SET block_id = $1, position = $3`,
        [id, input.orderIds[i], i, now]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const block = await getDeliveryBlockById(id);
  if (!block) throw new Error("Failed to fetch created block");
  return block;
}

export async function updateDeliveryBlock(
  id: string,
  updates: {
    name?: string;
    status?: BlockStatus;
    notes?: string | null;
    totalAmount?: number;
    totalDeliveryFee?: number;
    routeDistanceKm?: number | null;
    routeDurationMinutes?: number | null;
    routePolyline?: string | null;
  }
): Promise<DeliveryBlock | null> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();

  const setClauses: string[] = ["updated_at = $1::timestamptz"];
  const params: unknown[] = [now];

  if (updates.name !== undefined) { params.push(updates.name.trim()); setClauses.push(`name = $${params.length}`); }
  if (updates.status !== undefined) { params.push(updates.status); setClauses.push(`status = $${params.length}`); }
  if (updates.notes !== undefined) { params.push(updates.notes); setClauses.push(`notes = $${params.length}`); }
  if (updates.totalAmount !== undefined) { params.push(updates.totalAmount); setClauses.push(`total_amount = $${params.length}`); }
  if (updates.totalDeliveryFee !== undefined) { params.push(updates.totalDeliveryFee); setClauses.push(`total_delivery_fee = $${params.length}`); }
  if (updates.routeDistanceKm !== undefined) { params.push(updates.routeDistanceKm); setClauses.push(`route_distance_km = $${params.length}`); }
  if (updates.routeDurationMinutes !== undefined) { params.push(updates.routeDurationMinutes); setClauses.push(`route_duration_minutes = $${params.length}`); }
  if (updates.routePolyline !== undefined) { params.push(updates.routePolyline); setClauses.push(`route_polyline = $${params.length}`); }

  params.push(id);
  await pool.query(
    `UPDATE delivery_blocks SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
    params
  );

  return getDeliveryBlockById(id);
}

export async function deleteDeliveryBlock(id: string): Promise<void> {
  const pool = await getBlocksPool();
  await pool.query(`DELETE FROM delivery_blocks WHERE id = $1`, [id]);
}

// ─── Block orders ─────────────────────────────────────────────────────────────

export async function addOrderToBlock(blockId: string, orderId: string): Promise<void> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();

  const posRes = await pool.query<{ max: number | null }>(
    `SELECT MAX(position) AS max FROM delivery_block_orders WHERE block_id = $1`,
    [blockId]
  );
  const nextPos = (posRes.rows[0]?.max ?? -1) + 1;

  await pool.query(
    `INSERT INTO delivery_block_orders (block_id, order_id, position, created_at)
     VALUES ($1, $2, $3, $4::timestamptz)
     ON CONFLICT (order_id) DO UPDATE SET block_id = $1, position = $3`,
    [blockId, orderId, nextPos, now]
  );

  await pool.query(
    `UPDATE delivery_blocks SET updated_at = $1::timestamptz WHERE id = $2`,
    [now, blockId]
  );
}

export async function removeOrderFromBlock(blockId: string, orderId: string): Promise<void> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();

  await pool.query(
    `DELETE FROM delivery_block_orders WHERE block_id = $1 AND order_id = $2`,
    [blockId, orderId]
  );

  // Reorder remaining slots
  await pool.query(
    `UPDATE delivery_block_orders SET position = sub.new_pos
     FROM (SELECT order_id, ROW_NUMBER() OVER (ORDER BY position ASC) - 1 AS new_pos
           FROM delivery_block_orders WHERE block_id = $1) AS sub
     WHERE delivery_block_orders.order_id = sub.order_id AND delivery_block_orders.block_id = $1`,
    [blockId]
  );

  await pool.query(
    `UPDATE delivery_blocks SET updated_at = $1::timestamptz WHERE id = $2`,
    [now, blockId]
  );
}

export async function reorderBlockOrders(blockId: string, orderedIds: string[]): Promise<void> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        `UPDATE delivery_block_orders SET position = $1 WHERE block_id = $2 AND order_id = $3`,
        [i, blockId, orderedIds[i]]
      );
    }
    await client.query(
      `UPDATE delivery_blocks SET updated_at = $1::timestamptz WHERE id = $2`,
      [now, blockId]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function updateBlockRoute(
  blockId: string,
  route: { distanceKm: number; durationMinutes: number; polyline?: string; legs?: Array<{ orderId: string; distanceKm: number; durationMinutes: number }> }
): Promise<void> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();

  await pool.query(
    `UPDATE delivery_blocks SET route_distance_km = $1, route_duration_minutes = $2, route_polyline = $3, updated_at = $4::timestamptz WHERE id = $5`,
    [route.distanceKm, route.durationMinutes, route.polyline ?? null, now, blockId]
  );

  if (route.legs) {
    for (const leg of route.legs) {
      await pool.query(
        `UPDATE delivery_block_orders SET leg_distance_km = $1, leg_duration_minutes = $2 WHERE block_id = $3 AND order_id = $4`,
        [leg.distanceKm, leg.durationMinutes, blockId, leg.orderId]
      );
    }
  }
}

// ─── Available orders for block (not assigned to any block) ──────────────────

export async function getAssignedOrderIds(): Promise<Set<string>> {
  const pool = await getBlocksPool();
  const res = await pool.query<{ order_id: string }>(
    `SELECT DISTINCT order_id FROM delivery_block_orders dbo
     JOIN delivery_blocks db ON dbo.block_id = db.id
     WHERE db.status NOT IN ('completed', 'cancelled')`
  );
  return new Set(res.rows.map((r) => r.order_id));
}
