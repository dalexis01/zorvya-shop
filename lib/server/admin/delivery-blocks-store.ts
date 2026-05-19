import "server-only";

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient } from "pg";

const BLOCKS_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "003_delivery_blocks.sql"
);

let blocksPoolInstance: Pool | null = null;
let blocksSchemaReadyPromise: Promise<void> | null = null;

export const MAX_ORDERS_PER_BLOCK = 5;
export const MAX_PACKAGES_PER_BLOCK = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockStatus = "draft" | "ready" | "in_delivery" | "completed" | "cancelled";

// ─── ID generator ─────────────────────────────────────────────────────────────

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateBlockId(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes).map((b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

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

// ─── Blocks list cache ────────────────────────────────────────────────────────

let blocksListCache: { value: DeliveryBlock[]; expiresAt: number } | null = null;
const BLOCKS_LIST_CACHE_TTL_MS = 10_000; // 10 s

export function invalidateBlocksListCache() {
  blocksListCache = null;
}

// ─── Blocks CRUD ──────────────────────────────────────────────────────────────

export async function listDeliveryBlocks(): Promise<DeliveryBlock[]> {
  if (blocksListCache && Date.now() < blocksListCache.expiresAt) {
    return blocksListCache.value;
  }

  const pool = await getBlocksPool();
  const res = await pool.query<Record<string, unknown>>(
    `SELECT * FROM delivery_blocks ORDER BY created_at DESC LIMIT 100`
  );
  const blocks = res.rows.map(toBlock);

  if (blocks.length === 0) {
    return blocks;
  }

  const slotsRes = await pool.query<Record<string, unknown>>(
    `SELECT * FROM delivery_block_orders
     WHERE block_id = ANY($1::text[])
     ORDER BY block_id ASC, position ASC`,
    [blocks.map((block) => block.id)]
  );

  const slotsByBlock = new Map<string, DeliveryBlockOrderSlot[]>();
  for (const row of slotsRes.rows) {
    const slot = toSlot(row);
    const current = slotsByBlock.get(slot.blockId) ?? [];
    current.push(slot);
    slotsByBlock.set(slot.blockId, current);
  }

  for (const block of blocks) {
    block.orders = slotsByBlock.get(block.id) ?? [];
  }

  blocksListCache = { value: blocks, expiresAt: Date.now() + BLOCKS_LIST_CACHE_TTL_MS };
  return blocks;
}

async function recalculateBlockTotals(client: PoolClient, blockId: string, updatedAtIso: string) {
  const totalsRes = await client.query<{ total_amount: string | number | null; total_delivery_fee: string | number | null }>(
    `SELECT
       COALESCE(SUM(o.total), 0) AS total_amount,
       COALESCE(SUM(o.delivery_fee), 0) AS total_delivery_fee
     FROM delivery_block_orders dbo
     JOIN orders o ON o.id = dbo.order_id
     WHERE dbo.block_id = $1`,
    [blockId]
  );

  const totals = totalsRes.rows[0];
  await client.query(
    `UPDATE delivery_blocks
     SET total_amount = $1,
         total_delivery_fee = $2,
         updated_at = $3::timestamptz
     WHERE id = $4`,
    [
      Number(totals?.total_amount ?? 0),
      Number(totals?.total_delivery_fee ?? 0),
      updatedAtIso,
      blockId,
    ]
  );
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
  initialStatus?: BlockStatus;
}): Promise<DeliveryBlock> {
  const pool = await getBlocksPool();
  const id = generateBlockId();
  const now = new Date().toISOString();
  const uniqueOrderIds = Array.from(new Set(input.orderIds.filter(Boolean)));

  if (uniqueOrderIds.length > MAX_ORDERS_PER_BLOCK) {
    throw new Error(`BLOCK_LIMIT_EXCEEDED:${MAX_ORDERS_PER_BLOCK}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO delivery_blocks (id, name, status, total_amount, total_delivery_fee, created_at, updated_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz, $7)`,
      [id, input.name.trim(), input.initialStatus ?? "draft", input.totalAmount ?? 0, input.totalDeliveryFee ?? 0, now, input.createdBy ?? "admin"]
    );

    for (let i = 0; i < uniqueOrderIds.length; i++) {
      await client.query(
        `INSERT INTO delivery_block_orders (block_id, order_id, position, created_at)
         VALUES ($1, $2, $3, $4::timestamptz)
         ON CONFLICT (order_id) DO UPDATE SET block_id = $1, position = $3`,
        [id, uniqueOrderIds[i], i, now]
      );
    }

    await recalculateBlockTotals(client, id, now);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  invalidateBlocksListCache();
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

  invalidateBlocksListCache();
  return getDeliveryBlockById(id);
}

export async function deleteDeliveryBlock(id: string): Promise<void> {
  const pool = await getBlocksPool();
  await pool.query(`DELETE FROM delivery_blocks WHERE id = $1`, [id]);
  invalidateBlocksListCache();
}

// ─── Block orders ─────────────────────────────────────────────────────────────

export async function addOrderToBlock(blockId: string, orderId: string): Promise<void> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [countRes, currentRes] = await Promise.all([
      client.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM delivery_block_orders WHERE block_id = $1`,
        [blockId]
      ),
      client.query<{ block_id: string }>(
        `SELECT block_id FROM delivery_block_orders WHERE order_id = $1 LIMIT 1`,
        [orderId]
      ),
    ]);

    const currentBlockId = currentRes.rows[0]?.block_id ?? null;
    if (currentBlockId === blockId) {
      await client.query("COMMIT");
      return;
    }

    const currentCount = Number(countRes.rows[0]?.total ?? 0);
    if (currentCount >= MAX_ORDERS_PER_BLOCK) {
      throw new Error(`BLOCK_LIMIT_EXCEEDED:${MAX_ORDERS_PER_BLOCK}`);
    }

    const posRes = await client.query<{ max: number | null }>(
      `SELECT MAX(position) AS max FROM delivery_block_orders WHERE block_id = $1`,
      [blockId]
    );
    const nextPos = (posRes.rows[0]?.max ?? -1) + 1;

    await client.query(
      `INSERT INTO delivery_block_orders (block_id, order_id, position, created_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       ON CONFLICT (order_id) DO UPDATE SET block_id = $1, position = $3`,
      [blockId, orderId, nextPos, now]
    );

    await recalculateBlockTotals(client, blockId, now);
    if (currentBlockId && currentBlockId !== blockId) {
      await recalculateBlockTotals(client, currentBlockId, now);
    }

    await client.query("COMMIT");
    invalidateBlocksListCache();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function removeOrderFromBlock(blockId: string, orderId: string): Promise<void> {
  const pool = await getBlocksPool();
  const now = new Date().toISOString();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM delivery_block_orders WHERE block_id = $1 AND order_id = $2`,
      [blockId, orderId]
    );

    await client.query(
      `UPDATE delivery_block_orders SET position = sub.new_pos
       FROM (SELECT order_id, ROW_NUMBER() OVER (ORDER BY position ASC) - 1 AS new_pos
             FROM delivery_block_orders WHERE block_id = $1) AS sub
       WHERE delivery_block_orders.order_id = sub.order_id AND delivery_block_orders.block_id = $1`,
      [blockId]
    );

    await recalculateBlockTotals(client, blockId, now);

    await client.query("COMMIT");
    invalidateBlocksListCache();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
    invalidateBlocksListCache();
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

export async function ensurePendingOrdersAssignedToBlocks(): Promise<{
  assignedCount: number;
  createdBlocks: number;
}> {
  const pool = await getBlocksPool();
  const client = await pool.connect();
  const now = new Date().toISOString();

  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(91732541)`);

    const availableBlocksRes = await client.query<{
      id: string;
      name: string;
      status: BlockStatus;
      order_count: number;
    }>(
      `SELECT
         db.id,
         db.name,
         db.status,
         COUNT(dbo.order_id)::int AS order_count
       FROM delivery_blocks db
       LEFT JOIN delivery_block_orders dbo ON dbo.block_id = db.id
       WHERE db.status IN ('draft', 'ready')
       GROUP BY db.id, db.name, db.status, db.created_at
       ORDER BY db.created_at ASC`
    );

    const unassignedOrdersRes = await client.query<{ id: string }>(
      `SELECT o.id
       FROM orders o
       LEFT JOIN delivery_block_orders dbo ON dbo.order_id = o.id
       WHERE dbo.order_id IS NULL
         AND o.delivery_type = 'delivery'
         AND o.cancelled_at IS NULL
         AND COALESCE(o.admin_status, '') <> 'Pedido completado'
       ORDER BY o.created_at DESC`
    );

    if (unassignedOrdersRes.rows.length === 0) {
      await client.query("COMMIT");
      return { assignedCount: 0, createdBlocks: 0 };
    }

    const availableBlocks = availableBlocksRes.rows.map((row) => ({
      id: row.id,
      count: Number(row.order_count ?? 0),
    }));

    let assignedCount = 0;
    let createdBlocks = 0;

    for (const order of unassignedOrdersRes.rows) {
      let target = availableBlocks.find((b) => b.count < MAX_ORDERS_PER_BLOCK);

      if (!target) {
        const blockId = generateBlockId();
        createdBlocks += 1;
        await client.query(
          `INSERT INTO delivery_blocks (
             id, name, status, total_amount, total_delivery_fee, created_at, updated_at, created_by
           ) VALUES ($1, $2, 'draft', 0, 0, $3::timestamptz, $3::timestamptz, $4)`,
          [
            blockId,
            `Bloque auto ${String(createdBlocks).padStart(2, "0")}`,
            now,
            "system",
          ]
        );
        target = { id: blockId, count: 0 };
        availableBlocks.push(target);
      }

      await client.query(
        `INSERT INTO delivery_block_orders (block_id, order_id, position, created_at)
         VALUES ($1, $2, $3, $4::timestamptz)
         ON CONFLICT (order_id) DO NOTHING`,
        [target.id, order.id, target.count, now]
      );

      target.count += 1;
      assignedCount += 1;
    }

    for (const block of availableBlocks) {
      await recalculateBlockTotals(client, block.id, now);
    }

    await client.query("COMMIT");
    return { assignedCount, createdBlocks };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
