import "server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type QueryResultRow } from "pg";

import type {
  SupplierBlockSummary,
  SupplierListEntry,
  SupplierPaymentRecord,
  SupplierProfile,
} from "@/lib/shop/admin-types";

const SUPPLIERS_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "005_suppliers.sql"
);

type SupplierRow = QueryResultRow & {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  notes: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type SupplierPaymentRow = QueryResultRow & {
  id: string;
  supplier_id: string;
  amount: number | string;
  payment_date: Date | string;
  block_id: string | null;
  notes: string;
  created_at: Date | string;
  created_by: string;
};

type SupplierProductRow = QueryResultRow & {
  id: string;
  name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  cost_price: number | string | null;
};

type SupplierOrderRow = QueryResultRow & {
  id: string;
  items_json: Array<{
    productId?: string | number;
    quantity?: number;
  }> | null;
  created_at: Date | string;
  cancelled_at: Date | string | null;
};

type SupplierBlockOrderRow = QueryResultRow & {
  block_id: string;
  block_name: string;
  block_status: string;
  order_id: string;
};

let suppliersPoolInstance: Pool | null = null;
let suppliersSchemaReadyPromise: Promise<void> | null = null;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSL === "disable") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function normalizeNameKey(value: string | null | undefined) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSameDay(date: Date, now: Date) {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function startOfWeek(value: Date) {
  const next = new Date(value);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

async function getSuppliersPool() {
  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("SUPPLIERS_DB_NOT_CONFIGURED");
  }

  if (!suppliersPoolInstance) {
    suppliersPoolInstance = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!suppliersSchemaReadyPromise) {
    suppliersSchemaReadyPromise = readFile(SUPPLIERS_SCHEMA_FILE, "utf8")
      .then((sql) => suppliersPoolInstance!.query(sql))
      .then(() => undefined)
      .catch((error) => {
        suppliersSchemaReadyPromise = null;
        throw error;
      });
  }

  await suppliersSchemaReadyPromise;
  return suppliersPoolInstance;
}

function rowToSupplierBase(row: SupplierRow) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    isActive: Boolean(row.is_active),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function rowToPayment(row: SupplierPaymentRow): SupplierPaymentRecord {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    amount: Number(row.amount ?? 0),
    paymentDate: toIsoString(row.payment_date),
    blockId: row.block_id,
    notes: row.notes,
    createdAt: toIsoString(row.created_at),
    createdBy: row.created_by,
  };
}

async function querySupplierRows(search?: string) {
  const pool = await getSuppliersPool();
  const normalizedSearch = normalizeText(search);
  const params: string[] = [];
  let whereClause = "";

  if (normalizedSearch) {
    params.push(`%${normalizedSearch.toLowerCase()}%`);
    whereClause = `
      WHERE (
        LOWER(name) LIKE $1
        OR LOWER(contact_name) LIKE $1
        OR LOWER(email) LIKE $1
        OR phone LIKE $1
      )
    `;
  }

  const result = await pool.query<SupplierRow>(
    `
      SELECT id, name, contact_name, phone, email, notes, is_active, created_at, updated_at
      FROM suppliers
      ${whereClause}
      ORDER BY updated_at DESC, created_at DESC
    `,
    params
  );

  return result.rows;
}

async function queryPayments() {
  const pool = await getSuppliersPool();
  const result = await pool.query<SupplierPaymentRow>(
    `
      SELECT id, supplier_id, amount, payment_date, block_id, notes, created_at, created_by
      FROM supplier_payments
      ORDER BY payment_date DESC, created_at DESC
    `
  );

  return result.rows;
}

async function querySupplierAnalyticsSource() {
  const pool = await getSuppliersPool();
  const [productsResult, ordersResult, blockOrdersResult] = await Promise.all([
    pool.query<SupplierProductRow>(
      `
        SELECT
          id,
          name,
          internal_json ->> 'supplierId' AS supplier_id,
          internal_json ->> 'supplier' AS supplier_name,
          internal_json ->> 'supplierPhone' AS supplier_phone,
          internal_json ->> 'costPrice' AS cost_price
        FROM products
      `
    ),
    pool.query<SupplierOrderRow>(
      `
        SELECT id, items_json, created_at, cancelled_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 5000
      `
    ),
    pool.query<SupplierBlockOrderRow>(
      `
        SELECT
          dbo.block_id,
          db.name AS block_name,
          db.status AS block_status,
          dbo.order_id
        FROM delivery_block_orders dbo
        JOIN delivery_blocks db ON db.id = dbo.block_id
      `
    ),
  ]);

  return {
    products: productsResult.rows,
    orders: ordersResult.rows,
    blockOrders: blockOrdersResult.rows,
  };
}

function buildSupplierAnalytics(rows: SupplierRow[], paymentsRows: SupplierPaymentRow[], source: Awaited<ReturnType<typeof querySupplierAnalyticsSource>>) {
  const now = new Date();
  const weekStart = startOfWeek(now);

  const suppliers = rows.map(rowToSupplierBase);
  const supplierIdByName = new Map(
    suppliers
      .map((supplier) => [normalizeNameKey(supplier.name), supplier.id] as const)
      .filter(([key]) => Boolean(key))
  );

  const productsById = new Map(
    source.products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        supplierId:
          normalizeText(product.supplier_id) ||
          supplierIdByName.get(normalizeNameKey(product.supplier_name)) ||
          "",
        supplierName: normalizeText(product.supplier_name),
        supplierPhone: normalizeText(product.supplier_phone),
        costPrice: Number(product.cost_price ?? 0),
      },
    ])
  );

  const blockByOrderId = new Map(
    source.blockOrders.map((row) => [
      row.order_id,
      {
        id: row.block_id,
        name: row.block_name,
        status: row.block_status,
      },
    ])
  );

  const summaryBySupplierId = new Map(
    suppliers.map((supplier) => [
      supplier.id,
      {
        dayAmount: 0,
        weekAmount: 0,
        totalAccrued: 0,
        totalPaid: 0,
        blockBalances: new Map<string, SupplierBlockSummary & { orderIds: Set<string> }>(),
      },
    ])
  );

  for (const payment of paymentsRows) {
    const current = summaryBySupplierId.get(payment.supplier_id);

    if (!current) {
      continue;
    }

    current.totalPaid += Number(payment.amount ?? 0);
  }

  for (const order of source.orders) {
    if (order.cancelled_at) {
      continue;
    }

    const createdAt = new Date(order.created_at);
    const sameDay = isSameDay(createdAt, now);
    const sameWeek = createdAt >= weekStart;
    const assignedBlock = blockByOrderId.get(order.id);
    const items = Array.isArray(order.items_json) ? order.items_json : [];

    for (const item of items) {
      const productId = normalizeText(String(item.productId ?? ""));
      const quantity = Math.max(1, Math.trunc(Number(item.quantity ?? 1)));

      if (!productId) {
        continue;
      }

      const product = productsById.get(productId);

      if (!product || !product.supplierId || product.costPrice <= 0) {
        continue;
      }

      const summary = summaryBySupplierId.get(product.supplierId);

      if (!summary) {
        continue;
      }

      const amount = toMoney(product.costPrice * quantity);
      summary.totalAccrued += amount;

      if (sameDay) {
        summary.dayAmount += amount;
      }

      if (sameWeek) {
        summary.weekAmount += amount;
      }

      if (assignedBlock) {
        const blockSummary =
          summary.blockBalances.get(assignedBlock.id) ??
          {
            blockId: assignedBlock.id,
            blockName: assignedBlock.name,
            blockStatus: assignedBlock.status,
            amount: 0,
            ordersCount: 0,
            orderIds: new Set<string>(),
          };

        blockSummary.amount += amount;
        blockSummary.orderIds.add(order.id);
        blockSummary.ordersCount = blockSummary.orderIds.size;
        summary.blockBalances.set(assignedBlock.id, blockSummary);
      }
    }
  }

  const paymentsBySupplierId = new Map<string, SupplierPaymentRecord[]>();

  for (const payment of paymentsRows.map(rowToPayment)) {
    const current = paymentsBySupplierId.get(payment.supplierId) ?? [];
    current.push(payment);
    paymentsBySupplierId.set(payment.supplierId, current);
  }

  const listEntries: SupplierListEntry[] = suppliers.map((supplier) => {
    const summary = summaryBySupplierId.get(supplier.id);
    const blockBalances = [...(summary?.blockBalances.values() ?? [])]
      .map((block) => ({
        blockId: block.blockId,
        blockName: block.blockName,
        blockStatus: block.blockStatus,
        amount: toMoney(block.amount),
        ordersCount: block.ordersCount,
      }))
      .sort((left, right) => right.amount - left.amount);
    const totalAccrued = toMoney(summary?.totalAccrued ?? 0);
    const totalPaid = toMoney(summary?.totalPaid ?? 0);
    const totalPending = toMoney(Math.max(0, totalAccrued - totalPaid));
    const totalByBlocks = toMoney(
      blockBalances.reduce((sum, block) => sum + block.amount, 0)
    );

    return {
      ...supplier,
      summary: {
        dayAmount: toMoney(summary?.dayAmount ?? 0),
        weekAmount: toMoney(summary?.weekAmount ?? 0),
        totalByBlocks,
        totalPending,
        totalPaid,
        totalAccrued,
        blockCount: blockBalances.length,
      },
    };
  });

  const profilesById = new Map(
    listEntries.map((entry) => [
      entry.id,
      {
        ...entry,
        payments: paymentsBySupplierId.get(entry.id) ?? [],
        blockBalances:
          [...(summaryBySupplierId.get(entry.id)?.blockBalances.values() ?? [])]
            .map((block) => ({
              blockId: block.blockId,
              blockName: block.blockName,
              blockStatus: block.blockStatus,
              amount: toMoney(block.amount),
              ordersCount: block.ordersCount,
            }))
            .sort((left, right) => right.amount - left.amount),
      } satisfies SupplierProfile,
    ])
  );

  return {
    listEntries,
    profilesById,
  };
}

export async function getSuppliers(input?: { search?: string }) {
  const [rows, paymentRows, source] = await Promise.all([
    querySupplierRows(input?.search),
    queryPayments(),
    querySupplierAnalyticsSource(),
  ]);

  return buildSupplierAnalytics(rows, paymentRows, source).listEntries;
}

export async function getSupplierChoices(input?: { search?: string; limit?: number }) {
  const pool = await getSuppliersPool();
  const normalizedSearch = normalizeText(input?.search);
  const params: Array<string | number> = [];
  let whereClause = "";

  if (normalizedSearch) {
    params.push(`%${normalizedSearch.toLowerCase()}%`);
    whereClause = `
      WHERE (
        LOWER(name) LIKE $1
        OR LOWER(contact_name) LIKE $1
        OR LOWER(email) LIKE $1
        OR phone LIKE $1
      )
    `;
  }

  params.push(Math.max(1, Math.min(input?.limit ?? 10, 25)));

  const result = await pool.query<SupplierRow>(
    `
      SELECT id, name, contact_name, phone, email, notes, is_active, created_at, updated_at
      FROM suppliers
      ${whereClause}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    isActive: Boolean(row.is_active),
  }));
}

export async function getSupplierProfile(id: string) {
  const [rows, paymentRows, source] = await Promise.all([
    querySupplierRows(),
    queryPayments(),
    querySupplierAnalyticsSource(),
  ]);

  const analytics = buildSupplierAnalytics(rows, paymentRows, source);
  return analytics.profilesById.get(id) ?? null;
}

export async function createSupplier(input: {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive?: boolean;
}) {
  const pool = await getSuppliersPool();
  const now = new Date().toISOString();
  const id = randomUUID();

  await pool.query(
    `
      INSERT INTO suppliers (
        id, name, contact_name, phone, email, notes, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $8::timestamptz
      )
    `,
    [
      id,
      normalizeText(input.name),
      normalizeText(input.contactName),
      normalizeText(input.phone),
      normalizeText(input.email),
      normalizeText(input.notes),
      input.isActive ?? true,
      now,
    ]
  );

  return getSupplierProfile(id);
}

export async function updateSupplier(
  id: string,
  updates: {
    name?: string;
    contactName?: string;
    phone?: string;
    email?: string;
    notes?: string;
    isActive?: boolean;
  }
) {
  const pool = await getSuppliersPool();
  const fields: string[] = ["updated_at = $1::timestamptz"];
  const params: Array<string | boolean> = [new Date().toISOString()];

  if (updates.name !== undefined) {
    params.push(normalizeText(updates.name));
    fields.push(`name = $${params.length}`);
  }

  if (updates.contactName !== undefined) {
    params.push(normalizeText(updates.contactName));
    fields.push(`contact_name = $${params.length}`);
  }

  if (updates.phone !== undefined) {
    params.push(normalizeText(updates.phone));
    fields.push(`phone = $${params.length}`);
  }

  if (updates.email !== undefined) {
    params.push(normalizeText(updates.email));
    fields.push(`email = $${params.length}`);
  }

  if (updates.notes !== undefined) {
    params.push(normalizeText(updates.notes));
    fields.push(`notes = $${params.length}`);
  }

  if (updates.isActive !== undefined) {
    params.push(Boolean(updates.isActive));
    fields.push(`is_active = $${params.length}`);
  }

  params.push(id);

  await pool.query(
    `UPDATE suppliers SET ${fields.join(", ")} WHERE id = $${params.length}`,
    params
  );

  return getSupplierProfile(id);
}

export async function addSupplierPayment(
  supplierId: string,
  input: {
    amount: number;
    paymentDate?: string;
    blockId?: string | null;
    notes?: string;
  },
  createdBy: string
) {
  const pool = await getSuppliersPool();
  const now = new Date().toISOString();

  await pool.query(
    `
      INSERT INTO supplier_payments (
        id, supplier_id, amount, payment_date, block_id, notes, created_at, created_by
      ) VALUES (
        $1, $2, $3, $4::timestamptz, $5, $6, $7::timestamptz, $8
      )
    `,
    [
      randomUUID(),
      supplierId,
      toMoney(input.amount),
      input.paymentDate || now,
      normalizeText(input.blockId ?? "") || null,
      normalizeText(input.notes),
      now,
      createdBy,
    ]
  );

  return getSupplierProfile(supplierId);
}
