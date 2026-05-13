import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { Pool } from "pg";

const projectRoot = process.cwd();
const productsFilePath = path.join(projectRoot, "data", "products.json");

const PRODUCTS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  original_price NUMERIC(12, 2) NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(6, 2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  inventory_label TEXT NOT NULL DEFAULT 'Almacen local',
  delivery_label TEXT NOT NULL DEFAULT 'Delivery disponible',
  show_stock BOOLEAN NOT NULL DEFAULT TRUE,
  images_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_top BOOLEAN NOT NULL DEFAULT FALSE,
  attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  internal_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NULL,
  stock_added_at TIMESTAMPTZ NULL,
  last_sold_at TIMESTAMPTZ NULL,
  sale_dates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NOT NULL DEFAULT '',
  translations_json JSONB NULL,
  ai_json JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_products_active_visible
  ON products (is_active, is_visible, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category
  ON products (category);

CREATE INDEX IF NOT EXISTS idx_products_updated_at
  ON products (updated_at DESC);
`;

function getConnectionString() {
  return (
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function shouldUseSsl(connectionString) {
  if (process.env.PGSSL === "disable" || process.env.PRODUCTS_DB_SSL_DISABLE === "true") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

function trimText(value) {
  return String(value ?? "").trim();
}

function toMoney(value) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function buildFallbackPublicId(index) {
  return `PRD-${String(index + 1).padStart(6, "0")}`;
}

function buildFallbackSku(name, index) {
  const slug = trimText(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 12);

  return slug ? `${slug}-${String(index + 1).padStart(2, "0")}` : `PRODUCT-${String(index + 1).padStart(2, "0")}`;
}

function normalizeProduct(product, index) {
  const createdAt = trimText(product.createdAt) || new Date().toISOString();
  const updatedAt = trimText(product.updatedAt) || createdAt;
  const id = trimText(product.id) || crypto.randomUUID();
  const sku = trimText(product.sku) || buildFallbackSku(product.name, index);
  const publicId = trimText(product.publicId) || buildFallbackPublicId(index);
  const stock = Number(product.stock ?? 0);
  const price = toMoney(product.price ?? 0);
  const costPrice = Number(product?.internal?.costPrice ?? 0);
  const unitMargin = toMoney(price - costPrice);
  const marginRate = price > 0 ? toMoney((unitMargin / price) * 100) : 0;

  return {
    id,
    publicId,
    displayOrder: Number(product.displayOrder ?? index + 1),
    sku,
    name: trimText(product.name) || `Producto ${index + 1}`,
    shortDescription: trimText(product.shortDescription),
    longDescription: trimText(product.longDescription) || trimText(product.shortDescription),
    brand: trimText(product.brand) || "ZorvyA",
    category: trimText(product.category) || "Catalogo General",
    tags: Array.isArray(product.tags) ? product.tags.map((tag) => trimText(tag)).filter(Boolean) : [],
    price,
    originalPrice: product.originalPrice == null ? null : toMoney(product.originalPrice),
    stock,
    rating: Number(product.rating ?? 0),
    reviewCount: Number(product.reviewCount ?? 0),
    inventoryLabel: trimText(product.inventoryLabel) || "Almacen local",
    deliveryLabel: trimText(product.deliveryLabel) || "Delivery disponible",
    showStock: product.showStock ?? true,
    images: Array.isArray(product.images) ? product.images : [],
    isActive: product.isActive ?? true,
    isVisible: product.isVisible ?? true,
    isFeatured: product.isFeatured ?? false,
    isTop: product.isTop ?? false,
    attributes: product.attributes ?? {},
    internal: product.internal ?? {},
    metrics:
      product.metrics ?? {
        inventoryCost: toMoney(costPrice * stock),
        projectedRevenue: toMoney(price * stock),
        unitMargin,
        marginRate,
        expectedProfit: toMoney(unitMargin * stock),
      },
    createdAt,
    publishedAt: product.publishedAt ?? createdAt,
    stockAddedAt: product.stockAddedAt ?? (stock > 0 ? createdAt : null),
    lastSoldAt: product.lastSoldAt ?? null,
    saleDates: Array.isArray(product.saleDates) ? product.saleDates : [],
    updatedAt,
    updatedBy: trimText(product.updatedBy) || "migration",
    translations: product.translations ?? null,
    ai: product.ai ?? null,
  };
}

async function readProductsFile() {
  const raw = await fs.readFile(productsFilePath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function upsertProduct(client, product) {
  await client.query(
    `INSERT INTO products (
      id, public_id, display_order, sku, name, short_description, long_description, brand,
      category, tags_json, price, original_price, stock, rating, review_count,
      inventory_label, delivery_label, show_stock, images_json, is_active, is_visible,
      is_featured, is_top, attributes_json, internal_json, metrics_json, created_at,
      published_at, stock_added_at, last_sold_at, sale_dates_json, updated_at, updated_by,
      translations_json, ai_json
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10::jsonb, $11, $12, $13, $14, $15,
      $16, $17, $18, $19::jsonb, $20, $21,
      $22, $23, $24::jsonb, $25::jsonb, $26::jsonb, $27::timestamptz,
      $28::timestamptz, $29::timestamptz, $30::timestamptz, $31::jsonb, $32::timestamptz, $33,
      $34::jsonb, $35::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
      public_id = EXCLUDED.public_id,
      display_order = EXCLUDED.display_order,
      sku = EXCLUDED.sku,
      name = EXCLUDED.name,
      short_description = EXCLUDED.short_description,
      long_description = EXCLUDED.long_description,
      brand = EXCLUDED.brand,
      category = EXCLUDED.category,
      tags_json = EXCLUDED.tags_json,
      price = EXCLUDED.price,
      original_price = EXCLUDED.original_price,
      stock = EXCLUDED.stock,
      rating = EXCLUDED.rating,
      review_count = EXCLUDED.review_count,
      inventory_label = EXCLUDED.inventory_label,
      delivery_label = EXCLUDED.delivery_label,
      show_stock = EXCLUDED.show_stock,
      images_json = EXCLUDED.images_json,
      is_active = EXCLUDED.is_active,
      is_visible = EXCLUDED.is_visible,
      is_featured = EXCLUDED.is_featured,
      is_top = EXCLUDED.is_top,
      attributes_json = EXCLUDED.attributes_json,
      internal_json = EXCLUDED.internal_json,
      metrics_json = EXCLUDED.metrics_json,
      created_at = EXCLUDED.created_at,
      published_at = EXCLUDED.published_at,
      stock_added_at = EXCLUDED.stock_added_at,
      last_sold_at = EXCLUDED.last_sold_at,
      sale_dates_json = EXCLUDED.sale_dates_json,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by,
      translations_json = EXCLUDED.translations_json,
      ai_json = EXCLUDED.ai_json`,
    [
      product.id,
      product.publicId,
      product.displayOrder,
      product.sku,
      product.name,
      product.shortDescription,
      product.longDescription,
      product.brand,
      product.category,
      JSON.stringify(product.tags),
      product.price,
      product.originalPrice,
      product.stock,
      product.rating,
      product.reviewCount,
      product.inventoryLabel,
      product.deliveryLabel,
      product.showStock,
      JSON.stringify(product.images),
      product.isActive,
      product.isVisible,
      product.isFeatured,
      product.isTop,
      JSON.stringify(product.attributes),
      JSON.stringify(product.internal),
      JSON.stringify(product.metrics),
      product.createdAt,
      product.publishedAt,
      product.stockAddedAt,
      product.lastSoldAt,
      JSON.stringify(product.saleDates),
      product.updatedAt,
      product.updatedBy,
      product.translations ? JSON.stringify(product.translations) : null,
      product.ai ? JSON.stringify(product.ai) : null,
    ]
  );
}

async function main() {
  const connectionString = getConnectionString();

  if (!connectionString || connectionString.includes("[YOUR-PASSWORD]")) {
    throw new Error(
      "Configura DIRECT_URL o DATABASE_URL con la clave real de Supabase antes de migrar productos."
    );
  }

  const rawProducts = await readProductsFile();
  const products = rawProducts.map(normalizeProduct);

  const pool = new Pool({
    connectionString,
    max: 4,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();

  try {
    console.log(`Migrando ${products.length} producto(s) a PostgreSQL...`);
    await client.query(PRODUCTS_SCHEMA_SQL);
    await client.query("BEGIN");

    for (const product of products) {
      await upsertProduct(client, product);
    }

    await client.query("COMMIT");
    console.log("Migracion de productos completada correctamente.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("No se pudo migrar products.json a PostgreSQL:", error);
  process.exitCode = 1;
});
