import "server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type {
  Product,
  ProductAiImageCandidate,
  ProductImage,
  ProductInternalDetails,
  ProductMetrics,
} from "@/lib/shop/admin-types";
import type { ProductLocaleContent } from "@/lib/shop/types";

const PUBLIC_ID_PREFIX = "PRD-";
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

type ProductRow = QueryResultRow & {
  id: string;
  public_id: string;
  display_order: number;
  sku: string;
  name: string;
  short_description: string;
  long_description: string;
  brand: string;
  category: string;
  tags_json: string[] | null;
  price: number | string;
  original_price: number | string | null;
  stock: number;
  rating: number | string;
  review_count: number;
  inventory_label: string;
  delivery_label: string;
  show_stock: boolean;
  images_json: ProductImage[] | null;
  is_active: boolean;
  is_visible: boolean;
  is_featured: boolean;
  is_top: boolean;
  attributes_json: Record<string, string> | null;
  internal_json: Partial<ProductInternalDetails> | null;
  metrics_json: Partial<ProductMetrics> | null;
  created_at: Date | string;
  published_at: Date | string | null;
  stock_added_at: Date | string | null;
  last_sold_at: Date | string | null;
  sale_dates_json: string[] | null;
  updated_at: Date | string;
  updated_by: string;
  translations_json: Product["translations"] | null;
  ai_json: Product["ai"] | null;
};

export type ProductsDataSource = "postgres" | "postgres-required";

let productsPoolInstance: Pool | null = null;
let productsSchemaReadyPromise: Promise<void> | null = null;
const LEGACY_PRODUCTS_FILE_PATH = path.join(process.cwd(), "data", "products.json");

const PRODUCTS_LIST_CACHE_TTL_MS = 60_000;
let productsListCache: { expiresAt: number; value: Product[] } | null = null;

function clearProductsListCache() {
  productsListCache = null;
}

function trimText(value: string | undefined) {
  return (value ?? "").trim();
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function slugifySegment(value: string, fallback: string) {
  const normalized = trimText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  return normalized || fallback;
}

function buildShortDescription(value: string) {
  const normalized = trimText(value);

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function buildSku(name: string, category: string, existingSkus: Set<string>) {
  const categorySegment = slugifySegment(category, "CAT").slice(0, 4);
  const nameSegment = slugifySegment(name, "PROD").slice(0, 8);
  const baseSku = `${categorySegment}-${nameSegment}`;
  let nextSku = baseSku;
  let counter = 1;

  while (existingSkus.has(nextSku)) {
    nextSku = `${baseSku}-${String(counter).padStart(2, "0")}`;
    counter += 1;
  }

  return nextSku;
}

function parsePublicIdNumber(value: string | undefined) {
  const normalized = trimText(value);

  if (!normalized.startsWith(PUBLIC_ID_PREFIX)) {
    return null;
  }

  const numericPart = normalized.slice(PUBLIC_ID_PREFIX.length);
  const parsed = Number(numericPart);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatPublicId(value: number) {
  return `${PUBLIC_ID_PREFIX}${String(value).padStart(6, "0")}`;
}

function buildNextPublicId(products: Product[]) {
  const highestValue = products.reduce((highest, product) => {
    const parsed = parsePublicIdNumber(product.publicId);
    return parsed ? Math.max(highest, parsed) : highest;
  }, 0);

  return formatPublicId(highestValue + 1);
}

async function readLegacyProductsFile() {
  try {
    const raw = await readFile(LEGACY_PRODUCTS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch (error) {
    console.warn("[products] no se pudo leer data/products.json para bootstrap:", error);
    return [];
  }
}

function createProductMetrics(price: number, stock: number, costPrice: number): ProductMetrics {
  const unitMargin = toMoney(price - costPrice);
  const marginRate = price > 0 ? toMoney((unitMargin / price) * 100) : 0;

  return {
    inventoryCost: toMoney(costPrice * stock),
    projectedRevenue: toMoney(price * stock),
    unitMargin,
    marginRate,
    expectedProfit: toMoney(unitMargin * stock),
  };
}

function normalizeImages(images: Array<Omit<ProductImage, "id"> | ProductImage> | undefined) {
  return (images ?? [])
    .filter((image) => Boolean(trimText(image.url)))
    .map((image, index) => ({
      id: "id" in image && image.id ? image.id : randomUUID(),
      url: trimText(image.url),
      alt: trimText(image.alt) || `Imagen ${index + 1}`,
      isPrimary: Boolean(image.isPrimary) || index === 0,
    }));
}

function normalizeGeneratedImages(images: ProductAiImageCandidate[] | undefined) {
  return (images ?? []).map((image) => ({
    id: image.id || randomUUID(),
    url: trimText(image.url),
    label: trimText(image.label) || "Imagen sugerida",
  }));
}

function normalizeLocaleContent(content: ProductLocaleContent | undefined) {
  if (!content) {
    return undefined;
  }

  const tags = (content.tags ?? []).map((tag) => trimText(tag)).filter(Boolean);

  return {
    name: trimText(content.name),
    shortDescription: trimText(content.shortDescription),
    longDescription: trimText(content.longDescription),
    category: trimText(content.category),
    tags,
    inventoryLabel: trimText(content.inventoryLabel),
    deliveryLabel: trimText(content.deliveryLabel),
    badge: trimText(content.badge),
  };
}

function normalizeTranslations(translations: Product["translations"] | undefined) {
  if (!translations) {
    return undefined;
  }

  const nextTranslations = {
    es: normalizeLocaleContent(translations.es),
    nl: normalizeLocaleContent(translations.nl),
    en: normalizeLocaleContent(translations.en),
    pt: normalizeLocaleContent(translations.pt),
  };

  return Object.values(nextTranslations).some(Boolean) ? nextTranslations : undefined;
}

function normalizeInternalDetails(
  internal: Partial<ProductInternalDetails> | undefined
): ProductInternalDetails {
  return {
    costPrice: Number(internal?.costPrice ?? 0),
    purchasePrice: Number(internal?.purchasePrice ?? 0),
    shippingFee: Number(internal?.shippingFee ?? 0),
    supplier: trimText(internal?.supplier),
    supplierPhone: trimText(internal?.supplierPhone),
    internalCode: trimText(internal?.internalCode),
    internalNotes: trimText(internal?.internalNotes),
    accountingImageUrl: trimText(internal?.accountingImageUrl),
  };
}

function normalizeProduct(product: Product): Product {
  const internal = normalizeInternalDetails(product.internal);
  const price = Number(product.price ?? 0);
  const stock = Number(product.stock ?? 0);

  return {
    ...product,
    publicId: trimText(product.publicId),
    displayOrder: Number(product.displayOrder ?? 0),
    sku: trimText(product.sku),
    name: trimText(product.name),
    shortDescription: trimText(product.shortDescription),
    longDescription: trimText(product.longDescription),
    brand: trimText(product.brand),
    category: trimText(product.category),
    tags: (product.tags ?? []).map((tag) => trimText(tag)).filter(Boolean),
    price,
    originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
    stock,
    rating: Number(product.rating ?? 0),
    reviewCount: Number(product.reviewCount ?? 0),
    inventoryLabel: trimText(product.inventoryLabel) || "Almacen local",
    deliveryLabel: trimText(product.deliveryLabel) || "Delivery disponible",
    showStock: product.showStock ?? true,
    images: normalizeImages(product.images),
    isActive: product.isActive ?? true,
    isVisible: product.isVisible ?? true,
    isFeatured: product.isFeatured ?? false,
    isTop: product.isTop ?? false,
    attributes: product.attributes ?? {},
    internal,
    metrics: createProductMetrics(price, stock, internal.costPrice),
    publishedAt: product.publishedAt ?? null,
    stockAddedAt: product.stockAddedAt ?? null,
    lastSoldAt: product.lastSoldAt ?? null,
    saleDates: Array.isArray(product.saleDates)
      ? product.saleDates.map((saleDate) => trimText(saleDate)).filter(Boolean)
      : [],
    translations: normalizeTranslations(product.translations),
    ai: product.ai
      ? {
          draftId: product.ai.draftId ?? null,
          sourceImageUrl: trimText(product.ai.sourceImageUrl),
          generatedImages: normalizeGeneratedImages(product.ai.generatedImages),
          suggestedName: trimText(product.ai.suggestedName),
          suggestedSku: trimText(product.ai.suggestedSku),
          suggestedInternalCode: trimText(product.ai.suggestedInternalCode),
          suggestedShortDescription: trimText(product.ai.suggestedShortDescription),
          suggestedLongDescription: trimText(product.ai.suggestedLongDescription),
          suggestedCategory: trimText(product.ai.suggestedCategory),
          suggestedTags: (product.ai.suggestedTags ?? [])
            .map((tag) => trimText(tag))
            .filter(Boolean),
        }
      : undefined,
  };
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function getPostgresConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function isPlaceholderConnectionString(value: string) {
  return !value || value.includes("[YOUR-PASSWORD]");
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSL === "disable") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

function isProductsDatabaseConfigured() {
  const connectionString = getPostgresConnectionString();
  return Boolean(connectionString) && !isPlaceholderConnectionString(connectionString);
}

async function getProductsPool() {
  const connectionString = getPostgresConnectionString();

  if (!isProductsDatabaseConfigured()) {
    throw new Error("PRODUCTS_DB_NOT_CONFIGURED");
  }

  if (!productsPoolInstance) {
    productsPoolInstance = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!productsSchemaReadyPromise) {
    productsSchemaReadyPromise = ensureProductsSchema(productsPoolInstance).catch((err) => {
      productsSchemaReadyPromise = null;
      throw err;
    });
  }

  await productsSchemaReadyPromise;
  return productsPoolInstance;
}

async function ensureProductsSchema(pool: Pool) {
  await pool.query(PRODUCTS_SCHEMA_SQL);

  const countResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM products"
  );

  if (Number(countResult.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const legacyProducts = (await readLegacyProductsFile()).map(normalizeProduct);

  if (legacyProducts.length === 0) {
    console.warn("[products] la tabla products esta vacia y no hay catalogo legacy para migrar.");
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const product of legacyProducts) {
      await upsertProductRecord(client, product);
    }

    await client.query("COMMIT");
    console.info(
      `[products] bootstrap completado: ${legacyProducts.length} producto(s) migrados desde data/products.json`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function productRowToProduct(row: ProductRow): Product {
  return normalizeProduct({
    id: row.id,
    publicId: row.public_id,
    displayOrder: Number(row.display_order ?? 0),
    sku: row.sku,
    name: row.name,
    shortDescription: row.short_description,
    longDescription: row.long_description,
    brand: row.brand,
    category: row.category,
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    price: Number(row.price ?? 0),
    originalPrice: row.original_price === null ? undefined : Number(row.original_price),
    stock: Number(row.stock ?? 0),
    rating: Number(row.rating ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    inventoryLabel: row.inventory_label,
    deliveryLabel: row.delivery_label,
    showStock: Boolean(row.show_stock),
    images: Array.isArray(row.images_json) ? row.images_json : [],
    isActive: Boolean(row.is_active),
    isVisible: Boolean(row.is_visible),
    isFeatured: Boolean(row.is_featured),
    isTop: Boolean(row.is_top),
    attributes: row.attributes_json ?? {},
    internal: normalizeInternalDetails(row.internal_json ?? {}),
    metrics: createProductMetrics(
      Number(row.price ?? 0),
      Number(row.stock ?? 0),
      Number((row.internal_json?.costPrice ?? 0) as number)
    ),
    createdAt: toIsoString(row.created_at) ?? new Date().toISOString(),
    publishedAt: toIsoString(row.published_at),
    stockAddedAt: toIsoString(row.stock_added_at),
    lastSoldAt: toIsoString(row.last_sold_at),
    saleDates: Array.isArray(row.sale_dates_json) ? row.sale_dates_json : [],
    updatedAt: toIsoString(row.updated_at) ?? new Date().toISOString(),
    updatedBy: row.updated_by,
    translations: row.translations_json ?? undefined,
    ai: row.ai_json ?? undefined,
  });
}

async function readProductsFromDatabase() {
  const pool = await getProductsPool();
  const result = await pool.query<ProductRow>(
    `SELECT *
     FROM products
     ORDER BY published_at DESC NULLS LAST, created_at DESC, display_order ASC, updated_at DESC`
  );

  return result.rows.map(productRowToProduct);
}

function sortProducts(products: Product[]) {
  return [...products].sort((left, right) => {
    const rightPublishedAt = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    const leftPublishedAt = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;

    if (rightPublishedAt !== leftPublishedAt) {
      return rightPublishedAt - leftPublishedAt;
    }

    const rightCreatedAt = new Date(right.createdAt).getTime();
    const leftCreatedAt = new Date(left.createdAt).getTime();

    if (rightCreatedAt !== leftCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

async function readProductsWithSource() {
  if (!isProductsDatabaseConfigured()) {
    console.error(
      "[products] DATABASE_URL no esta configurado correctamente. Se requiere PostgreSQL/Supabase para cargar productos."
    );

    return {
      products: [],
      source: "postgres-required" as const,
    };
  }

  if (productsListCache && productsListCache.expiresAt > Date.now()) {
    return { products: productsListCache.value, source: "postgres" as const };
  }

  try {
    const products = sortProducts(await readProductsFromDatabase());
    productsListCache = { expiresAt: Date.now() + PRODUCTS_LIST_CACHE_TTL_MS, value: products };
    return { products, source: "postgres" as const };
  } catch (error) {
    console.error("[products] postgres read failed:", error);
    return {
      products: [],
      source: "postgres-required" as const,
    };
  }
}

async function readProducts() {
  const { products } = await readProductsWithSource();
  return products;
}

async function upsertProductRecord(client: PoolClient, product: Product) {
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
      JSON.stringify(product.tags ?? []),
      product.price,
      product.originalPrice ?? null,
      product.stock,
      product.rating,
      product.reviewCount,
      product.inventoryLabel,
      product.deliveryLabel,
      product.showStock,
      JSON.stringify(product.images ?? []),
      product.isActive,
      product.isVisible,
      product.isFeatured,
      product.isTop,
      JSON.stringify(product.attributes ?? {}),
      JSON.stringify(product.internal ?? {}),
      JSON.stringify(product.metrics ?? {}),
      product.createdAt,
      product.publishedAt,
      product.stockAddedAt,
      product.lastSoldAt,
      JSON.stringify(product.saleDates ?? []),
      product.updatedAt,
      product.updatedBy,
      product.translations ? JSON.stringify(product.translations) : null,
      product.ai ? JSON.stringify(product.ai) : null,
    ]
  );
}

async function writeProduct(product: Product) {
  if (!isProductsDatabaseConfigured()) {
    throw new Error("PRODUCTS_DB_NOT_CONFIGURED");
  }

  const pool = await getProductsPool();
  const client = await pool.connect();

  try {
    await upsertProductRecord(client, normalizeProduct(product));
    clearProductsListCache();
  } finally {
    client.release();
  }
}

async function deleteProductRecord(id: string) {
  if (!isProductsDatabaseConfigured()) {
    throw new Error("PRODUCTS_DB_NOT_CONFIGURED");
  }

  const pool = await getProductsPool();
  await pool.query("DELETE FROM products WHERE id = $1", [id]);
  clearProductsListCache();
}

export async function getAllProducts(options?: {
  onlyActive?: boolean;
  category?: string;
  search?: string;
}) {
  let products = await readProducts();

  if (options?.onlyActive) {
    products = products.filter((product) => product.isActive && product.isVisible);
  }

  if (options?.category) {
    products = products.filter((product) => product.category === options.category);
  }

  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    products = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchLower) ||
        product.publicId.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.brand.toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower) ||
        product.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }

  return sortProducts(products);
}

export async function getProductsDataSourceInfo(options?: {
  onlyActive?: boolean;
  category?: string;
  search?: string;
}) {
  const { source } = await readProductsWithSource();
  const products = await getAllProducts(options);

  return {
    source,
    count: products.length,
  };
}

export async function getProductById(id: string) {
  const products = await readProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function getProductBySku(sku: string) {
  const products = await readProducts();
  return products.find((product) => product.sku === sku) ?? null;
}

export async function createProduct(
  input: {
    sku?: string;
    name: string;
    shortDescription: string;
    longDescription: string;
    brand?: string;
    category: string;
    tags?: string[];
    price: number;
    originalPrice?: number;
    stock: number;
    rating?: number;
    reviewCount?: number;
    inventoryLabel?: string;
    deliveryLabel?: string;
    displayOrder?: number;
    showStock?: boolean;
    images: Omit<ProductImage, "id">[];
    isActive?: boolean;
    isVisible?: boolean;
    isFeatured?: boolean;
    isTop?: boolean;
    attributes?: Record<string, string>;
    translations?: Product["translations"];
    internal?: Partial<ProductInternalDetails>;
    ai?: Product["ai"];
  },
  createdBy: string
) {
  const now = new Date().toISOString();
  const products = await readProducts();
  const existingSkus = new Set(products.map((product) => product.sku));
  const requestedSku = trimText(input.sku);
  const resolvedSku = requestedSku || buildSku(input.name, input.category, existingSkus);

  if (existingSkus.has(resolvedSku)) {
    throw new Error("SKU_ALREADY_EXISTS");
  }

  const maxDisplayOrder = products.reduce(
    (highestOrder, product) => Math.max(highestOrder, product.displayOrder),
    0
  );
  const longDescription = trimText(input.longDescription) || trimText(input.shortDescription);
  const shortDescription =
    trimText(input.shortDescription) || buildShortDescription(longDescription || input.name);
  const brand = trimText(input.brand) || "ZorvyA";
  const tags = (input.tags ?? []).map((tag) => trimText(tag)).filter(Boolean);
  const normalizedInternal = normalizeInternalDetails(input.internal);
  const isActive = input.isActive ?? true;
  const stock = Number(input.stock ?? 0);

  const product = normalizeProduct({
    id: randomUUID(),
    publicId: buildNextPublicId(products),
    displayOrder:
      typeof input.displayOrder === "number" && Number.isFinite(input.displayOrder)
        ? input.displayOrder
        : maxDisplayOrder + 1,
    sku: resolvedSku,
    name: input.name,
    shortDescription,
    longDescription: longDescription || shortDescription || input.name,
    brand,
    category: input.category,
    tags,
    price: input.price,
    originalPrice: input.originalPrice,
    stock,
    rating: input.rating ?? 0,
    reviewCount: input.reviewCount ?? 0,
    inventoryLabel: input.inventoryLabel ?? "Almacen local",
    deliveryLabel: input.deliveryLabel ?? "Delivery disponible",
    showStock: input.showStock ?? true,
    images: input.images.map((image, index) => ({
      ...image,
      id: randomUUID(),
      isPrimary: image.isPrimary ?? index === 0,
    })),
    isActive,
    isVisible: input.isVisible ?? true,
    isFeatured: input.isFeatured ?? false,
    isTop: input.isTop ?? false,
    attributes: input.attributes ?? {},
    internal: {
      ...normalizedInternal,
      purchasePrice: normalizedInternal.purchasePrice || normalizedInternal.costPrice,
      internalCode: normalizedInternal.internalCode || resolvedSku,
    },
    metrics: createProductMetrics(input.price, stock, normalizedInternal.costPrice),
    createdAt: now,
    publishedAt: isActive ? now : null,
    stockAddedAt: stock > 0 ? now : null,
    lastSoldAt: null,
    saleDates: [],
    updatedAt: now,
    updatedBy: createdBy,
    ai: input.ai,
  });

  await writeProduct(product);

  return product;
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, "id" | "createdAt" | "updatedAt" | "updatedBy" | "metrics">>,
  updatedBy: string
) {
  const products = await readProducts();
  const product = products.find((item) => item.id === id);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  if (updates.sku && trimText(updates.sku) !== product.sku) {
    const existing = await getProductBySku(trimText(updates.sku));

    if (existing) {
      throw new Error("SKU_ALREADY_EXISTS");
    }
  }

  const previousStock = Number(product.stock ?? 0);
  const nextStock =
    typeof updates.stock === "number" && Number.isFinite(updates.stock)
      ? updates.stock
      : previousStock;
  const nextIsActive =
    typeof updates.isActive === "boolean" ? updates.isActive : product.isActive;
  const now = new Date().toISOString();
  const updated = normalizeProduct({
    ...product,
    ...updates,
    shortDescription:
      trimText(updates.shortDescription) ||
      (updates.longDescription ? buildShortDescription(updates.longDescription) : product.shortDescription),
    longDescription:
      trimText(updates.longDescription) || trimText(updates.shortDescription) || product.longDescription,
    internal: {
      ...product.internal,
      ...updates.internal,
    },
    ai: updates.ai
      ? {
          ...product.ai,
          ...updates.ai,
          generatedImages: updates.ai.generatedImages ?? product.ai?.generatedImages ?? [],
        }
      : product.ai,
    publishedAt:
      nextIsActive && !product.publishedAt
        ? now
        : nextIsActive && !product.isActive
          ? now
          : product.publishedAt,
    stockAddedAt:
      nextStock > 0 && previousStock <= 0
        ? now
        : nextStock > 0
          ? product.stockAddedAt ?? now
          : product.stockAddedAt,
    updatedAt: now,
    updatedBy,
    metrics: product.metrics,
  });

  await writeProduct(updated);

  return updated;
}

export async function deleteProduct(id: string) {
  await deleteProductRecord(id);
}

export async function deactivateProduct(id: string, deactivatedBy: string) {
  return updateProduct(id, { isActive: false }, deactivatedBy);
}

export async function updateProductStock(id: string, newStock: number, updatedBy: string) {
  return updateProduct(id, { stock: newStock }, updatedBy);
}

export async function updateProductPrice(
  id: string,
  newPrice: number,
  originalPrice: number | undefined,
  updatedBy?: string
) {
  return updateProduct(id, { price: newPrice, originalPrice }, updatedBy ?? "system");
}

export async function toggleProductFeatured(id: string, updatedBy: string) {
  const product = await getProductById(id);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return updateProduct(id, { isFeatured: !product.isFeatured }, updatedBy);
}

export async function toggleProductTop(id: string, updatedBy: string) {
  const product = await getProductById(id);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return updateProduct(id, { isTop: !product.isTop }, updatedBy);
}

export async function addProductImage(
  productId: string,
  image: Omit<ProductImage, "id">,
  updatedBy: string
) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return updateProduct(
    productId,
    {
      images: [...product.images, { ...image, id: randomUUID() }],
    },
    updatedBy
  );
}

export async function removeProductImage(productId: string, imageId: string, updatedBy: string) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const remainingImages = product.images.filter((image) => image.id !== imageId);

  if (remainingImages.length === 0) {
    throw new Error("CANNOT_REMOVE_LAST_IMAGE");
  }

  return updateProduct(productId, { images: remainingImages }, updatedBy);
}

export async function setPrimaryImage(productId: string, imageId: string, updatedBy: string) {
  const product = await getProductById(productId);

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return updateProduct(
    productId,
    {
      images: product.images.map((image) => ({
        ...image,
        isPrimary: image.id === imageId,
      })),
    },
    updatedBy
  );
}

export async function getLowStockProducts(threshold: number = 5) {
  const products = await readProducts();
  return products.filter((product) => product.stock <= threshold && product.isActive);
}

export async function registerProductSalesFromOrder(input: {
  soldAt: string;
  items: Array<{
    productId?: string | number;
  }>;
}) {
  const soldAt = trimText(input.soldAt);
  const products = await readProducts();

  await Promise.all(
    products.map(async (product) => {
      const matchedItem = input.items.find(
        (item) => String(item.productId ?? "") === String(product.id)
      );

      if (!matchedItem) {
        return;
      }

      await writeProduct(
        normalizeProduct({
          ...product,
          lastSoldAt: soldAt,
          saleDates: [...product.saleDates, soldAt],
          updatedAt: soldAt,
        })
      );
    })
  );
}
