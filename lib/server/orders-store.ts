import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  DeliveryType,
  StoredOrder,
} from "@/lib/shop/types";

const ORDERS_FILE = "orders.json";
const ORDERS_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "001_orders_postgres.sql"
);
const LEGACY_ORDERS_FILE_PATH = path.join(process.cwd(), "data", ORDERS_FILE);

const USER_ORDERS_DEFAULT_LIMIT = 20;
const USER_ORDERS_MAX_LIMIT = 50;
const ADMIN_ORDERS_DEFAULT_LIMIT = 24;
const ADMIN_ORDERS_MAX_LIMIT = 60;
const ORDERS_PAGE_CACHE_TTL_MS = 15_000;
const ORDER_RECORD_CACHE_TTL_MS = 30_000;

type OrderStatusFilter = "all" | "pending" | "completed" | "cancelled";
type OrdersCursorPayload = {
  createdAt: string;
  id: string;
};

type OrderRow = QueryResultRow & {
  id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  delivery_type: DeliveryType;
  pickup_date: string | null;
  pickup_time: string | null;
  requested_agent_call: boolean;
  items_json: StoredOrder["items"];
  subtotal: number | string;
  delivery_distance_km: number | string | null;
  delivery_fee: number | string;
  total: number | string;
  payment_json: StoredOrder["payment"];
  created_at: Date | string;
  updated_at: Date | string;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
  cancelled_by: StoredOrder["cancelledBy"];
  cancelled_by_name: string | null;
  admin_reviewed_at: Date | string | null;
  admin_status: StoredOrder["adminStatus"];
  status_history_json: StoredOrder["statusHistory"];
  issues_json: StoredOrder["issues"];
};

export type PaginatedOrdersResult = {
  orders: StoredOrder[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type PaginatedUserOrdersSummaryResult = PaginatedOrdersResult & {
  latestOrder: StoredOrder | null;
};

export type PaginatedAdminOrdersResult = PaginatedOrdersResult;

export type AdminOrdersMetaResult = {
  newOrdersCount: number;
  totalOrdersCount: number;
  pendingOrdersCount: number;
  completedOrdersCount: number;
  cancelledOrdersCount: number;
};

export type AdminOrdersQueryInput = {
  status?: OrderStatusFilter;
  deliveryType?: DeliveryType | "all";
  search?: string;
  last4?: string;
  cursor?: string | null;
  limit?: number;
  autoMode?: boolean;
};

let poolInstance: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;
let adminOrdersMetaCache: CacheEntry<AdminOrdersMetaResult> | null = null;
const orderByIdCache = new Map<string, CacheEntry<StoredOrder>>();
const paginatedUserOrdersCache = new Map<string, CacheEntry<PaginatedUserOrdersSummaryResult>>();
const paginatedAdminOrdersCache = new Map<string, CacheEntry<PaginatedAdminOrdersResult>>();

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

function getPostgresConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

export function isOrdersDatabaseConfigured() {
  return Boolean(getPostgresConnectionString());
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSL === "disable" || process.env.ORDERS_DB_SSL_DISABLE === "true") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

async function getOrdersPool() {
  const connectionString = getPostgresConnectionString();

  if (!connectionString) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!schemaReadyPromise) {
    schemaReadyPromise = ensureOrdersSchema(poolInstance).catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }

  await schemaReadyPromise;
  return poolInstance;
}

async function ensureOrdersSchema(pool: Pool) {
  const sql = await readFile(ORDERS_SCHEMA_FILE, "utf8");
  await pool.query(sql);
  const result = await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM orders");

  if (Number(result.rows[0]?.count ?? "0") === 0) {
    await bootstrapLegacyOrders(pool);
  }
}

async function readLegacyOrdersFile() {
  try {
    const raw = await readFile(LEGACY_ORDERS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoredOrder[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOENT" || error.code === "ENOTDIR")
    ) {
      return [];
    }

    console.error("[orders] no se pudo leer data/orders.json para bootstrap:", error);
    return [];
  }
}

async function bootstrapLegacyOrders(pool: Pool) {
  const orders = await readLegacyOrdersFile();

  if (orders.length === 0) {
    console.info("[orders] bootstrap omitido: no hay ordenes legacy para migrar.");
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const order of orders) {
      await upsertOrderWithClient(client, order);
    }

    await client.query("COMMIT");
    console.info(
      `[orders] bootstrap completado: ${orders.length} orden(es) migradas desde data/orders.json`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[orders] fallo el bootstrap de ordenes legacy:", error);
    throw error;
  } finally {
    client.release();
  }
}

function orderRowToStoredOrder(row: OrderRow): StoredOrder {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    customerAddress: row.customer_address,
    deliveryType: row.delivery_type,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time,
    requestedAgentCall: Boolean(row.requested_agent_call),
    items: Array.isArray(row.items_json) ? row.items_json : [],
    subtotal: toNumber(row.subtotal),
    deliveryDistanceKm:
      row.delivery_distance_km === null ? null : toNumber(row.delivery_distance_km),
    deliveryFee: toNumber(row.delivery_fee),
    total: toNumber(row.total),
    payment: row.payment_json,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    cancelledAt: row.cancelled_at ? toIsoString(row.cancelled_at) : null,
    cancellationReason: row.cancellation_reason,
    cancelledBy: row.cancelled_by ?? null,
    cancelledByName: row.cancelled_by_name,
    adminReviewedAt: row.admin_reviewed_at ? toIsoString(row.admin_reviewed_at) : null,
    adminStatus: row.admin_status ?? null,
    statusHistory: Array.isArray(row.status_history_json) ? row.status_history_json : [],
    issues: Array.isArray(row.issues_json) ? row.issues_json : [],
  };
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function encodeOrdersCursor(input: OrdersCursorPayload) {
  return Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
}

function decodeOrdersCursor(cursor?: string | null): OrdersCursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as OrdersCursorPayload;

    if (!parsed?.createdAt || !parsed?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function clampLimit(limit: number | undefined, fallback: number, max: number) {
  if (!limit || !Number.isFinite(limit)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.trunc(limit)));
}

function getCacheValue<T>(entry: CacheEntry<T> | null | undefined) {
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    return null;
  }

  return entry.value;
}

function getMapCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setMapCacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

function clearOrdersStoreCaches(orderId?: string) {
  paginatedUserOrdersCache.clear();
  paginatedAdminOrdersCache.clear();
  adminOrdersMetaCache = null;

  if (orderId) {
    orderByIdCache.delete(orderId);
    return;
  }

  orderByIdCache.clear();
}

function buildUserOrdersCacheKey(input: {
  userId: string;
  cursor?: string | null;
  limit: number;
}) {
  return JSON.stringify([input.userId, input.cursor ?? "", input.limit]);
}

function buildAdminOrdersCacheKey(input: AdminOrdersQueryInput & { limit: number }) {
  return JSON.stringify([
    input.status ?? "all",
    input.deliveryType ?? "all",
    input.search?.trim() ?? "",
    input.last4?.trim().toUpperCase() ?? "",
    input.cursor ?? "",
    input.limit,
    input.autoMode ? "1" : "0",
  ]);
}

function getCompletedStatusSql(autoMode = false) {
  if (autoMode) {
    return `(
      cancelled_at IS NULL AND (
        admin_status = 'Pedido completado'
        OR (
          admin_status IS NULL
          AND delivery_type = 'delivery'
          AND created_at <= NOW() - INTERVAL '24 hours'
        )
      )
    )`;
  }
  return `(cancelled_at IS NULL AND admin_status = 'Pedido completado')`;
}

function applyAdminFilters(
  baseClauses: string[],
  params: Array<string | number | Date>,
  input: AdminOrdersQueryInput
) {
  const status = input.status ?? "all";
  const deliveryType = input.deliveryType ?? "all";
  const autoMode = input.autoMode ?? false;
  const search = input.search?.trim();
  const last4 = input.last4?.trim().toUpperCase();

  if (deliveryType !== "all") {
    params.push(deliveryType);
    baseClauses.push(`delivery_type = $${params.length}`);
  }

  if (status === "cancelled") {
    baseClauses.push("cancelled_at IS NOT NULL");
  } else if (status === "completed") {
    baseClauses.push(getCompletedStatusSql(autoMode));
  } else if (status === "pending") {
    baseClauses.push(`cancelled_at IS NULL AND NOT ${getCompletedStatusSql(autoMode)}`);
  }

  if (search) {
    params.push(`%${search}%`);
    baseClauses.push(`(
      id ILIKE $${params.length}
      OR customer_name ILIKE $${params.length}
      OR customer_email ILIKE $${params.length}
      OR customer_phone ILIKE $${params.length}
      OR customer_address ILIKE $${params.length}
      OR COALESCE(admin_status, '') ILIKE $${params.length}
    )`);
  }

  if (last4) {
    params.push(`%${last4}`);
    baseClauses.push(`right(id, 4) ILIKE $${params.length}`);
  }
}

async function queryOrdersPageFromDatabase(input: {
  whereClauses: string[];
  params: Array<string | number | Date>;
  cursor?: string | null;
  limit: number;
}) {
  const pool = await getOrdersPool();
  const whereClauses = [...input.whereClauses];
  const params = [...input.params];
  const cursor = decodeOrdersCursor(input.cursor);

  if (cursor) {
    params.push(cursor.createdAt);
    const createdAtPosition = params.length;
    params.push(cursor.id);
    const idPosition = params.length;
    whereClauses.push(
      `(created_at < $${createdAtPosition}::timestamptz OR (created_at = $${createdAtPosition}::timestamptz AND id < $${idPosition}))`
    );
  }

  params.push(input.limit + 1);
  const rows = await pool.query<OrderRow>(
    `
      SELECT
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
      FROM orders
      ${whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length}
    `,
    params
  );

  const hasMore = rows.rows.length > input.limit;
  const visibleRows = hasMore ? rows.rows.slice(0, input.limit) : rows.rows;
  const orders = visibleRows.map(orderRowToStoredOrder);
  const tailOrder = visibleRows.at(-1);

  return {
    orders,
    hasMore,
    nextCursor:
      hasMore && tailOrder
        ? encodeOrdersCursor({
            createdAt: toIsoString(tailOrder.created_at),
            id: tailOrder.id,
          })
        : null,
  };
}

export async function loadAllOrdersFromStore(options?: { windowDays?: number }) {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const pool = await getOrdersPool();

  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (options?.windowDays && options.windowDays > 0) {
    params.push(options.windowDays);
    whereParts.push(`created_at >= NOW() - ($${params.length} || ' days')::INTERVAL`);
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const result = await pool.query<OrderRow>(
    `
      SELECT
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
      FROM orders
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT 5000
    `,
    params
  );

  if (result.rows.length === 5000) {
    console.warn("[orders] loadAllOrdersFromStore hit 5000-row safety LIMIT — consider narrowing the window.");
  }

  return result.rows.map(orderRowToStoredOrder);
}

// Single aggregated SQL query — replaces 3 separate full-table scans on the dashboard.
export async function getDashboardOrderStats() {
  if (!isOrdersDatabaseConfigured()) {
    return null;
  }

  const pool = await getOrdersPool();

  const [statsResult, recentResult] = await Promise.all([
    pool.query<{
      total_orders: string;
      pending_orders: string;
      completed_orders: string;
      cancelled_orders: string;
      total_revenue: string;
      revenue_today: string;
      revenue_this_week: string;
      revenue_this_month: string;
      orders_today: string;
      orders_this_week: string;
      orders_this_month: string;
      cancelled_value: string;
    }>(`
      SELECT
        COUNT(*)::text                                                                        AS total_orders,
        COUNT(*) FILTER (WHERE cancelled_at IS NULL
          AND (admin_status IS NULL OR admin_status != 'Pedido completado'))::text            AS pending_orders,
        COUNT(*) FILTER (WHERE admin_status = 'Pedido completado')::text                     AS completed_orders,
        COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL)::text                               AS cancelled_orders,
        COALESCE(SUM(total) FILTER (WHERE cancelled_at IS NULL), 0)::text                    AS total_revenue,
        COALESCE(SUM(total) FILTER (WHERE cancelled_at IS NULL
          AND created_at >= DATE_TRUNC('day', NOW())), 0)::text                              AS revenue_today,
        COALESCE(SUM(total) FILTER (WHERE cancelled_at IS NULL
          AND created_at >= DATE_TRUNC('week', NOW())), 0)::text                             AS revenue_this_week,
        COALESCE(SUM(total) FILTER (WHERE cancelled_at IS NULL
          AND created_at >= DATE_TRUNC('month', NOW())), 0)::text                            AS revenue_this_month,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('day', NOW()))::text                 AS orders_today,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', NOW()))::text                AS orders_this_week,
        COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW()))::text               AS orders_this_month,
        COALESCE(SUM(total) FILTER (WHERE cancelled_at IS NOT NULL), 0)::text                AS cancelled_value
      FROM orders
    `),
    pool.query<{
      id: string; customer_name: string; total: string;
      admin_status: string | null; cancelled_at: string | null; created_at: string;
    }>(
      `SELECT id, customer_name, total, admin_status, cancelled_at, created_at
       FROM orders ORDER BY created_at DESC LIMIT 6`
    ),
  ]);

  const row = statsResult.rows[0];
  return {
    totalOrders:       Number(row.total_orders),
    pendingOrders:     Number(row.pending_orders),
    completedOrders:   Number(row.completed_orders),
    cancelledOrders:   Number(row.cancelled_orders),
    totalRevenue:      Number(row.total_revenue),
    revenueToday:      Number(row.revenue_today),
    revenueThisWeek:   Number(row.revenue_this_week),
    revenueThisMonth:  Number(row.revenue_this_month),
    ordersToday:       Number(row.orders_today),
    ordersThisWeek:    Number(row.orders_this_week),
    ordersThisMonth:   Number(row.orders_this_month),
    cancelledValue:    Number(row.cancelled_value),
    recentOrders:      recentResult.rows.map((r) => ({
      id: r.id,
      customerName: r.customer_name,
      total: Number(r.total),
      adminStatus: r.admin_status,
      cancelledAt: r.cancelled_at,
      createdAt: r.created_at,
    })),
  };
}

export async function loadOrderByIdFromStore(orderId: string) {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const cachedOrder = getMapCacheValue(orderByIdCache, orderId);

  if (cachedOrder) {
    return cachedOrder;
  }

  const pool = await getOrdersPool();
  const result = await pool.query<OrderRow>(
    `
      SELECT
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
      FROM orders
      WHERE id = $1
      LIMIT 1
    `,
    [orderId]
  );

  const order = result.rows[0] ? orderRowToStoredOrder(result.rows[0]) : null;

  if (order) {
    setMapCacheValue(orderByIdCache, orderId, order, ORDER_RECORD_CACHE_TTL_MS);
  }

  return order;
}

export async function insertOrderIntoStore(order: StoredOrder) {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const pool = await getOrdersPool();
  await pool.query(
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
      ON CONFLICT (id) DO NOTHING
    `,
    [
      order.id,
      order.userId,
      order.customerName,
      order.customerPhone,
      order.customerEmail,
      order.customerAddress,
      order.deliveryType,
      order.pickupDate,
      order.pickupTime,
      order.requestedAgentCall,
      JSON.stringify(order.items),
      order.subtotal,
      order.deliveryDistanceKm,
      order.deliveryFee,
      order.total,
      JSON.stringify(order.payment),
      order.createdAt,
      order.updatedAt,
      order.cancelledAt,
      order.cancellationReason,
      order.cancelledBy,
      order.cancelledByName,
      order.adminReviewedAt,
      order.adminStatus,
      JSON.stringify(order.statusHistory),
      JSON.stringify(order.issues),
    ]
  );

  clearOrdersStoreCaches(order.id);
  setMapCacheValue(orderByIdCache, order.id, order, ORDER_RECORD_CACHE_TTL_MS);
}

export async function updateOrderInStore(order: StoredOrder) {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const pool = await getOrdersPool();
  await pool.query(
    `
      UPDATE orders
      SET
        user_id = $2,
        customer_name = $3,
        customer_phone = $4,
        customer_email = $5,
        customer_address = $6,
        delivery_type = $7,
        pickup_date = $8,
        pickup_time = $9,
        requested_agent_call = $10,
        items_json = $11::jsonb,
        subtotal = $12,
        delivery_distance_km = $13,
        delivery_fee = $14,
        total = $15,
        payment_json = $16::jsonb,
        created_at = $17::timestamptz,
        updated_at = $18::timestamptz,
        cancelled_at = $19::timestamptz,
        cancellation_reason = $20,
        cancelled_by = $21,
        cancelled_by_name = $22,
        admin_reviewed_at = $23::timestamptz,
        admin_status = $24,
        status_history_json = $25::jsonb,
        issues_json = $26::jsonb
      WHERE id = $1
    `,
    [
      order.id,
      order.userId,
      order.customerName,
      order.customerPhone,
      order.customerEmail,
      order.customerAddress,
      order.deliveryType,
      order.pickupDate,
      order.pickupTime,
      order.requestedAgentCall,
      JSON.stringify(order.items),
      order.subtotal,
      order.deliveryDistanceKm,
      order.deliveryFee,
      order.total,
      JSON.stringify(order.payment),
      order.createdAt,
      order.updatedAt,
      order.cancelledAt,
      order.cancellationReason,
      order.cancelledBy,
      order.cancelledByName,
      order.adminReviewedAt,
      order.adminStatus,
      JSON.stringify(order.statusHistory),
      JSON.stringify(order.issues),
    ]
  );

  clearOrdersStoreCaches(order.id);
  setMapCacheValue(orderByIdCache, order.id, order, ORDER_RECORD_CACHE_TTL_MS);
}

export async function loadOrdersByUserIdFromStore(userId: string) {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const result = await queryOrdersPageFromDatabase({
    whereClauses: ["user_id = $1"],
    params: [userId],
    limit: 200,
  });

  return result.orders;
}

export async function loadPaginatedUserOrdersSummaryFromStore(input: {
  userId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<PaginatedUserOrdersSummaryResult> {
  const limit = clampLimit(input.limit, USER_ORDERS_DEFAULT_LIMIT, USER_ORDERS_MAX_LIMIT);
  const cacheKey = buildUserOrdersCacheKey({
    userId: input.userId,
    cursor: input.cursor,
    limit,
  });

  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const cachedPage = getMapCacheValue(paginatedUserOrdersCache, cacheKey);

  if (cachedPage) {
    return cachedPage;
  }

  const page = await queryOrdersPageFromDatabase({
    whereClauses: ["user_id = $1"],
    params: [input.userId],
    cursor: input.cursor,
    limit,
  });

  const result = {
    latestOrder: !input.cursor ? page.orders[0] ?? null : null,
    ...page,
  };
  setMapCacheValue(paginatedUserOrdersCache, cacheKey, result, ORDERS_PAGE_CACHE_TTL_MS);
  return result;
}

export async function loadPaginatedAdminOrdersFromStore(
  input: AdminOrdersQueryInput
): Promise<PaginatedAdminOrdersResult> {
  const limit = clampLimit(input.limit, ADMIN_ORDERS_DEFAULT_LIMIT, ADMIN_ORDERS_MAX_LIMIT);
  const cacheKey = buildAdminOrdersCacheKey({
    ...input,
    limit,
  });

  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const cachedPage = getMapCacheValue(paginatedAdminOrdersCache, cacheKey);

  if (cachedPage) {
    return cachedPage;
  }

  const whereClauses: string[] = [];
  const params: Array<string | number | Date> = [];
  applyAdminFilters(whereClauses, params, input);
  const page = await queryOrdersPageFromDatabase({
    whereClauses,
    params,
    cursor: input.cursor,
    limit,
  });
  setMapCacheValue(paginatedAdminOrdersCache, cacheKey, page, ORDERS_PAGE_CACHE_TTL_MS);
  return page;
}

export async function loadAdminOrdersMetaFromStore(): Promise<AdminOrdersMetaResult> {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const cachedMeta = getCacheValue(adminOrdersMetaCache);

  if (cachedMeta) {
    return cachedMeta;
  }

  const pool = await getOrdersPool();
  const result = await pool.query<{
    new_orders_count: number | string;
    total_orders_count: number | string;
    pending_orders_count: number | string;
    completed_orders_count: number | string;
    cancelled_orders_count: number | string;
  }>(
    `
      SELECT
        COUNT(*)::int AS total_orders_count,
        COUNT(*) FILTER (WHERE admin_reviewed_at IS NULL)::int AS new_orders_count,
        COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL)::int AS cancelled_orders_count,
        COUNT(*) FILTER (WHERE ${getCompletedStatusSql()})::int AS completed_orders_count,
        COUNT(*) FILTER (
          WHERE cancelled_at IS NULL AND NOT ${getCompletedStatusSql()}
        )::int AS pending_orders_count
      FROM orders
    `
  );

  const row = result.rows[0];

  const meta = {
    newOrdersCount: toNumber(row.new_orders_count),
    totalOrdersCount: toNumber(row.total_orders_count),
    pendingOrdersCount: toNumber(row.pending_orders_count),
    completedOrdersCount: toNumber(row.completed_orders_count),
    cancelledOrdersCount: toNumber(row.cancelled_orders_count),
  };
  adminOrdersMetaCache = {
    expiresAt: Date.now() + ORDERS_PAGE_CACHE_TTL_MS,
    value: meta,
  };
  return meta;
}

export async function migrateOrdersJsonToStore() {
  if (!isOrdersDatabaseConfigured()) {
    throw new Error("ORDERS_DB_NOT_CONFIGURED");
  }

  const orders = await readLegacyOrdersFile();
  const pool = await getOrdersPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const order of orders) {
      await upsertOrderWithClient(client, order);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  clearOrdersStoreCaches();
}

async function upsertOrderWithClient(client: PoolClient, order: StoredOrder) {
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
      order.userId,
      order.customerName,
      order.customerPhone,
      order.customerEmail,
      order.customerAddress,
      order.deliveryType,
      order.pickupDate,
      order.pickupTime,
      order.requestedAgentCall,
      JSON.stringify(order.items),
      order.subtotal,
      order.deliveryDistanceKm,
      order.deliveryFee,
      order.total,
      JSON.stringify(order.payment),
      order.createdAt,
      order.updatedAt,
      order.cancelledAt,
      order.cancellationReason,
      order.cancelledBy,
      order.cancelledByName,
      order.adminReviewedAt,
      order.adminStatus,
      JSON.stringify(order.statusHistory),
      JSON.stringify(order.issues),
    ]
  );
}
