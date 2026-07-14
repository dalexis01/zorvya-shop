import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type {
  AdminUser,
  FeaturedContent,
  ProductAiDraft,
  StatusLog,
  SupportMessage,
} from "@/lib/shop/admin-types";
import type { ProductReview } from "@/lib/shop/types";
import { getCustomerPool } from "@/lib/server/customer-db";

const RUNTIME_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "012_admin_runtime_postgres.sql"
);

const DATA_DIRECTORY = path.join(process.cwd(), "data");

const RUNTIME_SETTING_KEYS = {
  homepage: "homepage-settings",
  paypal: "paypal-settings",
  orders: "orders-settings",
  aiDrafts: "content-ai-drafts",
} as const;

let runtimeSchemaReadyPromise: Promise<void> | null = null;

function getLegacyFilePath(fileName: string) {
  return path.join(DATA_DIRECTORY, fileName);
}

async function readLegacyJsonFile<T>(fileName: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(getLegacyFilePath(fileName), "utf8");

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

async function bootstrapAdminUsers() {
  const pool = await getCustomerPool();
  const existing = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM admin_users"
  );

  if (Number(existing.rows[0]?.count ?? "0") > 0) {
    return;
  }

  const legacyUsers = await readLegacyJsonFile<AdminUser[]>("admin-users.json", []);

  for (const user of legacyUsers) {
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
          $1, LOWER($2), $3, $4, $5, $6::jsonb, $7, $8::timestamptz, $9::timestamptz,
          $10::timestamptz, $11
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        user.id,
        user.email,
        user.passwordHash,
        user.name,
        user.role,
        toJson(user.permissions ?? []),
        Boolean(user.isActive),
        user.createdAt,
        user.updatedAt,
        user.lastLoginAt ?? null,
        user.createdBy ?? "system",
      ]
    );
  }
}

async function bootstrapRuntimeSetting(key: string, fileName: string) {
  const pool = await getCustomerPool();
  const existing = await pool.query("SELECT 1 FROM admin_runtime_settings WHERE key = $1", [key]);

  if (existing.rowCount) {
    return;
  }

  const value = await readLegacyJsonFile<unknown>(fileName, null);

  if (value === null) {
    return;
  }

  await pool.query(
    `
      INSERT INTO admin_runtime_settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO NOTHING
    `,
    [key, toJson(value)]
  );
}

async function bootstrapProductReviews() {
  const pool = await getCustomerPool();
  const existing = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM admin_product_reviews"
  );

  if (Number(existing.rows[0]?.count ?? "0") > 0) {
    return;
  }

  const reviews = await readLegacyJsonFile<ProductReview[]>("product-reviews.json", []);

  for (const review of reviews) {
    await pool.query(
      `
        INSERT INTO admin_product_reviews (
          id,
          product_id,
          user_id,
          customer_name,
          customer_email,
          rating,
          comment,
          created_at
        ) VALUES (
          $1, $2, $3, $4, LOWER($5), $6, $7, $8::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        review.id,
        review.productId,
        review.userId,
        review.customerName,
        review.customerEmail,
        review.rating,
        review.comment,
        review.createdAt,
      ]
    );
  }
}

async function bootstrapSupportMessages() {
  const pool = await getCustomerPool();
  const existing = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM admin_support_messages"
  );

  if (Number(existing.rows[0]?.count ?? "0") > 0) {
    return;
  }

  const messages = await readLegacyJsonFile<SupportMessage[]>("support-messages.json", []);

  for (const message of messages) {
    await pool.query(
      `
        INSERT INTO admin_support_messages (
          id,
          order_id,
          customer_id,
          customer_name,
          customer_email,
          customer_phone,
          subject,
          message,
          priority,
          status,
          category,
          source,
          customer_token,
          chat_entries_json,
          responses_json,
          admin_seen_at,
          customer_seen_at,
          created_at,
          updated_at,
          resolved_at
        ) VALUES (
          $1, $2, $3, $4, LOWER($5), $6, $7, $8, $9, $10, $11, $12, $13,
          $14::jsonb, $15::jsonb, $16::timestamptz, $17::timestamptz, $18::timestamptz,
          $19::timestamptz, $20::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        message.id,
        message.orderId ?? null,
        message.customerId,
        message.customerName,
        message.customerEmail,
        message.customerPhone ?? null,
        message.subject,
        message.message,
        message.priority,
        message.status,
        message.category,
        message.source,
        message.customerToken ?? null,
        toJson(message.chatEntries ?? []),
        toJson(message.responses ?? []),
        message.adminSeenAt ?? null,
        message.customerSeenAt ?? null,
        message.createdAt,
        message.updatedAt,
        message.resolvedAt ?? null,
      ]
    );
  }
}

async function bootstrapStatusLogs() {
  const pool = await getCustomerPool();
  const existing = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM admin_status_logs"
  );

  if (Number(existing.rows[0]?.count ?? "0") > 0) {
    return;
  }

  const logs = await readLegacyJsonFile<StatusLog[]>("admin-logs.json", []);

  for (const log of logs) {
    await pool.query(
      `
        INSERT INTO admin_status_logs (
          id,
          type,
          target_id,
          action,
          changed_by,
          changed_by_name,
          changes_json,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        log.id,
        log.type,
        log.targetId,
        log.action,
        log.changedBy,
        log.changedByName,
        toJson(log.changes ?? []),
        log.createdAt,
      ]
    );
  }
}

async function bootstrapFeaturedContent() {
  const pool = await getCustomerPool();
  const existing = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM admin_featured_content"
  );

  if (Number(existing.rows[0]?.count ?? "0") > 0) {
    return;
  }

  const content = await readLegacyJsonFile<FeaturedContent[]>("content-featured.json", []);

  for (const item of content) {
    await pool.query(
      `
        INSERT INTO admin_featured_content (
          id,
          type,
          product_ids_json,
          position,
          is_active,
          start_date,
          end_date,
          created_at,
          updated_at,
          updated_by
        ) VALUES (
          $1, $2, $3::jsonb, $4, $5, $6::timestamptz, $7::timestamptz,
          $8::timestamptz, $9::timestamptz, $10
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [
        item.id,
        item.type,
        toJson(item.productIds ?? []),
        item.position,
        Boolean(item.isActive),
        item.startDate,
        item.endDate ?? null,
        item.createdAt,
        item.updatedAt,
        item.updatedBy,
      ]
    );
  }
}

async function bootstrapAiDrafts() {
  const pool = await getCustomerPool();
  const existing = await pool.query("SELECT 1 FROM admin_runtime_settings WHERE key = $1", [
    RUNTIME_SETTING_KEYS.aiDrafts,
  ]);

  if (existing.rowCount) {
    return;
  }

  const drafts = await readLegacyJsonFile<ProductAiDraft[]>("content-ai-drafts.json", []);

  if (drafts.length === 0) {
    return;
  }

  await pool.query(
    `
      INSERT INTO admin_runtime_settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO NOTHING
    `,
    [RUNTIME_SETTING_KEYS.aiDrafts, toJson(drafts)]
  );
}

async function ensureRuntimeSchema() {
  const pool = await getCustomerPool();
  const sql = await readFile(RUNTIME_SCHEMA_FILE, "utf8");
  await pool.query(sql);

  await bootstrapAdminUsers();
  await bootstrapRuntimeSetting(RUNTIME_SETTING_KEYS.homepage, "homepage-settings.json");
  await bootstrapRuntimeSetting(RUNTIME_SETTING_KEYS.paypal, "paypal-settings.json");
  await bootstrapRuntimeSetting(RUNTIME_SETTING_KEYS.orders, "orders-settings.json");
  await bootstrapAiDrafts();
  await bootstrapProductReviews();
  await bootstrapSupportMessages();
  await bootstrapStatusLogs();
  await bootstrapFeaturedContent();
}

export async function getAdminRuntimePool() {
  const pool = await getCustomerPool();

  if (!runtimeSchemaReadyPromise) {
    runtimeSchemaReadyPromise = ensureRuntimeSchema();
  }

  await runtimeSchemaReadyPromise;
  return pool;
}

export async function getAdminRuntimeSetting<T>(key: string, fallback: T): Promise<T> {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<{ value: T }>(
    "SELECT value FROM admin_runtime_settings WHERE key = $1",
    [key]
  );

  return result.rows[0]?.value ?? fallback;
}

export async function setAdminRuntimeSetting<T>(key: string, value: T) {
  const pool = await getAdminRuntimePool();
  await pool.query(
    `
      INSERT INTO admin_runtime_settings (key, value, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `,
    [key, toJson(value)]
  );
}

export { RUNTIME_SETTING_KEYS };
