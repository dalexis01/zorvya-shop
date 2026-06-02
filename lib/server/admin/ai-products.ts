import "server-only";

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { get, put } from "@vercel/blob";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type { AiProductPendingItem, Product } from "@/lib/shop/admin-types";
import { createProduct, getProductById, getProductStats, updateProduct } from "@/lib/server/admin/products";
import { getSupplierChoices } from "@/lib/server/admin/suppliers";

const SUPPLIERS_SCHEMA_FILE = path.join(process.cwd(), "db", "migrations", "005_suppliers.sql");
const AI_PRODUCTS_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "009_ai_product_automation.sql"
);
const AI_PRODUCTS_TELEGRAM_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "010_ai_product_telegram_upgrade.sql"
);
const AI_PRODUCTS_TELEGRAM_FIXES_SCHEMA_FILE = path.join(
  process.cwd(),
  "db",
  "migrations",
  "011_ai_products_nullable_supplier_name.sql"
);

type AiBatchItemRow = QueryResultRow & {
  id: string;
  batch_id: string;
  product_id: string | null;
  generated_product_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_name_detected: string | null;
  title: string;
  description: string;
  category: string;
  tags_json: string[] | null;
  price_srd: number | string;
  cost_usd: number | string;
  stock_code: string;
  public_image_url: string;
  original_image_url: string;
  original_telegram_image_url: string;
  original_slack_image_url: string;
  review_status: string;
  status: string;
  created_by_ai: boolean;
  ai_confidence_score: number | string | null;
  generated_images: Product["generatedImages"] | null;
  seo_title: string | null;
  seo_description: string | null;
  specifications: Record<string, string> | null;
  payload_json: Record<string, unknown> | null;
  error_message: string | null;
  processing_time_ms: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type CreateAiDraftInput = {
  batchId?: string;
  batchName?: string;
  batchSource?: string;
  batchMetadata?: Record<string, unknown>;
  supplierId?: string | null;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  priceSrd?: number;
  costUsd?: number;
  stock?: number;
  stockCode?: string;
  brand?: string;
  sku?: string;
  publicImageUrl?: string;
  originalTelegramImageUrl?: string;
  originalSlackImageUrl?: string;
  originalSource?: Product["originalSource"];
  confidenceScore?: number | null;
  attributes?: Record<string, string>;
  inventoryLabel?: string;
  deliveryLabel?: string;
  longDescription?: string;
  shortDescription?: string;
  supplierName?: string;
  supplierNameDetected?: string;
  telegramMessageId?: string;
  telegramChatId?: string;
  generatedImages?: Product["generatedImages"];
  seoTitle?: string;
  seoDescription?: string;
  specifications?: Record<string, string>;
  processingTimeMs?: number;
};

type UpdateAiDraftInput = Partial<{
  supplierId: string | null;
  title: string;
  description: string;
  category: string;
  tags: string[];
  priceSrd: number;
  costUsd: number;
  stock: number;
  stockCode: string;
  publicImageUrl: string;
  originalTelegramImageUrl: string;
  originalSlackImageUrl: string;
  confidenceScore: number | null;
  brand: string;
  sku: string;
  inventoryLabel: string;
  deliveryLabel: string;
  attributes: Record<string, string>;
  generatedImages: Product["generatedImages"];
  seoTitle: string;
  seoDescription: string;
  specifications: Record<string, string>;
}>;

let aiProductsPoolInstance: Pool | null = null;
let aiProductsSchemaReadyPromise: Promise<void> | null = null;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DB_URL ||
    ""
  ).trim();
}

function isConfigured() {
  const value = getConnectionString();
  return Boolean(value) && !value.includes("[YOUR-PASSWORD]");
}

function shouldUseSsl(connectionString: string) {
  if (process.env.PGSSL === "disable") {
    return false;
  }

  return connectionString.includes("supabase") || process.env.NODE_ENV === "production";
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function buildDescription(
  title: string,
  category: string,
  tags: string[],
  supplierName: string,
  sourceDescription?: string
) {
  const normalizedSource = normalizeText(sourceDescription);

  if (normalizedSource) {
    return normalizedSource;
  }

  const intro = normalizeText(title) || "Producto nuevo";
  const categoryLine = normalizeText(category) ? `Categoria: ${normalizeText(category)}.` : "";
  const tagsLine = tags.length ? `Etiquetas: ${tags.join(", ")}.` : "";
  const supplierLine = supplierName ? `Proveedor asignado: ${supplierName}.` : "";

  return [intro, categoryLine, tagsLine, supplierLine]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function buildShortDescription(description: string, title: string) {
  const normalized = normalizeText(description) || normalizeText(title);
  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}

function buildProductTags(tags: string[] | undefined) {
  return (tags ?? []).map((tag) => normalizeText(tag)).filter(Boolean);
}

function mapPendingRow(row: AiBatchItemRow): AiProductPendingItem {
  return {
    id: row.id,
    batchId: row.batch_id,
    productId: row.generated_product_id ?? row.product_id,
    supplierId: row.supplier_id,
    supplierName: normalizeText(row.supplier_name),
    supplierNameDetected: normalizeText(row.supplier_name_detected),
    publicImageUrl: normalizeText(row.public_image_url),
    originalImageUrl: normalizeText(row.original_image_url),
    originalTelegramImageUrl: normalizeText(row.original_telegram_image_url),
    originalSlackImageUrl: normalizeText(row.original_slack_image_url),
    costUsd: Number(row.cost_usd ?? 0),
    stockCode: normalizeText(row.stock_code),
    priceSrd: Number(row.price_srd ?? 0),
    title: row.title,
    description: row.description,
    category: row.category,
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    reviewStatus:
      row.review_status === "needs_review" ||
      row.review_status === "pending" ||
      row.review_status === "rejected" ||
      row.review_status === "approved"
        ? row.review_status
        : "pending",
    status: normalizeText(row.status) || "draft",
    aiConfidenceScore:
      row.ai_confidence_score === null ? null : Number(row.ai_confidence_score),
    createdByAi: Boolean(row.created_by_ai),
    generatedImages: Array.isArray(row.generated_images) ? row.generated_images : [],
    seoTitle: normalizeText(row.seo_title),
    seoDescription: normalizeText(row.seo_description),
    specifications: row.specifications ?? {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function getAiProductsPool() {
  if (!isConfigured()) {
    throw new Error("AI_PRODUCTS_DB_NOT_CONFIGURED");
  }

  if (!aiProductsPoolInstance) {
    const connectionString = getConnectionString();
    aiProductsPoolInstance = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
  }

  if (!aiProductsSchemaReadyPromise) {
    aiProductsSchemaReadyPromise = ensureAiProductsSchema(aiProductsPoolInstance).catch((error) => {
      aiProductsSchemaReadyPromise = null;
      throw error;
    });
  }

  await aiProductsSchemaReadyPromise;
  return aiProductsPoolInstance;
}

async function ensureAiProductsSchema(pool: Pool) {
  await getProductStats();
  const [suppliersSql, aiSql, aiTelegramSql, aiTelegramFixesSql] = await Promise.all([
    readFile(SUPPLIERS_SCHEMA_FILE, "utf8"),
    readFile(AI_PRODUCTS_SCHEMA_FILE, "utf8"),
    readFile(AI_PRODUCTS_TELEGRAM_SCHEMA_FILE, "utf8"),
    readFile(AI_PRODUCTS_TELEGRAM_FIXES_SCHEMA_FILE, "utf8"),
  ]);

  await pool.query(suppliersSql);
  await pool.query(aiSql);
  await pool.query(aiTelegramSql);
  await pool.query(aiTelegramFixesSql);
}

async function getSupplierById(supplierId: string | null | undefined) {
  const normalizedId = normalizeText(supplierId);
  if (!normalizedId) {
    return null;
  }

  const choices = await getSupplierChoices();
  return choices.find((supplier) => supplier.id === normalizedId) ?? null;
}

async function getSupplierByName(supplierName: string | null | undefined) {
  const normalizedName = normalizeText(supplierName).toLowerCase();
  if (!normalizedName) {
    return null;
  }

  const choices = await getSupplierChoices();
  return (
    choices.find((supplier) => normalizeText(supplier.name).toLowerCase() === normalizedName) ??
    null
  );
}

async function upsertBatch(
  client: PoolClient,
  input: {
    id: string;
    source: string;
    supplierId: string | null;
    supplierNameDetected: string;
    batchName: string;
    telegramMessageId: string;
    telegramChatId: string;
    totalItems: number;
    completedItems: number;
    failedItems: number;
    metadata: Record<string, unknown>;
  }
) {
  await client.query(
    `
      INSERT INTO ai_product_batches (
        id,
        source,
        supplier_id,
        supplier_name_detected,
        batch_name,
        telegram_message_id,
        telegram_chat_id,
        total_items,
        completed_items,
        failed_items,
        status,
        metadata_json,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        source = EXCLUDED.source,
        supplier_id = EXCLUDED.supplier_id,
        supplier_name_detected = EXCLUDED.supplier_name_detected,
        batch_name = EXCLUDED.batch_name,
        telegram_message_id = EXCLUDED.telegram_message_id,
        telegram_chat_id = EXCLUDED.telegram_chat_id,
        total_items = GREATEST(ai_product_batches.total_items + 1, EXCLUDED.total_items),
        completed_items = ai_product_batches.completed_items,
        failed_items = ai_product_batches.failed_items,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = NOW()
    `,
    [
      input.id,
      input.source,
      input.supplierId,
      input.supplierNameDetected,
      input.batchName,
      input.telegramMessageId,
      input.telegramChatId,
      input.totalItems,
      input.completedItems,
      input.failedItems,
      JSON.stringify(input.metadata),
    ]
  );
}

async function insertBatchItem(
  client: PoolClient,
  input: {
    id: string;
    batchId: string;
    productId: string;
    supplierId: string | null;
    supplierNameDetected: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    priceSrd: number;
    costUsd: number;
    stockCode: string;
    publicImageUrl: string;
    originalImageUrl: string;
    originalTelegramImageUrl: string;
    originalSlackImageUrl: string;
    reviewStatus: "pending" | "needs_review" | "approved" | "rejected";
    status: string;
    createdByAi: boolean;
    aiConfidenceScore: number | null;
    generatedImages: Product["generatedImages"];
    seoTitle: string;
    seoDescription: string;
    specifications: Record<string, string>;
    payload: Record<string, unknown>;
    processingTimeMs: number;
  }
) {
  await client.query(
    `
      INSERT INTO ai_product_batch_items (
        id,
        batch_id,
        product_id,
        generated_product_id,
        supplier_id,
        supplier_name_detected,
        title,
        description,
        category,
        tags_json,
        price_srd,
        cost_usd,
        stock_code,
        public_image_url,
        original_image_url,
        original_telegram_image_url,
        original_slack_image_url,
        review_status,
        status,
        created_by_ai,
        ai_confidence_score,
        generated_images,
        seo_title,
        seo_description,
        specifications,
        payload_json,
        processing_time_ms,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20::jsonb, $21, $22, $23::jsonb, $24::jsonb, $25, NOW(), NOW()
      )
    `,
    [
      input.id,
      input.batchId,
      input.productId,
      input.productId,
      input.supplierId,
      input.supplierNameDetected,
      input.title,
      input.description,
      input.category,
      JSON.stringify(input.tags),
      input.priceSrd,
      input.costUsd,
      input.stockCode,
      input.publicImageUrl,
      input.originalImageUrl,
      input.originalTelegramImageUrl,
      input.originalSlackImageUrl,
      input.reviewStatus,
      input.status,
      input.createdByAi,
      input.aiConfidenceScore,
      JSON.stringify(input.generatedImages ?? []),
      input.seoTitle,
      input.seoDescription,
      JSON.stringify(input.specifications ?? {}),
      JSON.stringify(input.payload),
      input.processingTimeMs,
    ]
  );
}

async function getPendingItemRow(itemId: string) {
  const pool = await getAiProductsPool();
  const result = await pool.query<AiBatchItemRow>(
    `
      SELECT
        item.id,
        item.batch_id,
        item.product_id,
        item.generated_product_id,
        item.supplier_id,
        suppliers.name AS supplier_name,
        item.supplier_name_detected,
        item.title,
        item.description,
        item.category,
        item.tags_json,
        item.price_srd,
        item.cost_usd,
        item.stock_code,
        item.public_image_url,
        item.original_image_url,
        item.original_telegram_image_url,
        item.original_slack_image_url,
        item.review_status,
        item.status,
        item.created_by_ai,
        item.ai_confidence_score,
        item.generated_images,
        item.seo_title,
        item.seo_description,
        item.specifications,
        item.payload_json,
        item.error_message,
        item.processing_time_ms,
        item.created_at,
        item.updated_at
      FROM ai_product_batch_items item
      LEFT JOIN suppliers ON suppliers.id = item.supplier_id
      WHERE item.id = $1
      LIMIT 1
    `,
    [itemId]
  );

  return result.rows[0] ?? null;
}

async function updateBatchStatusForProduct(client: PoolClient, batchId: string) {
  const statusResult = await client.query<{
    pending_count: string;
    rejected_count: string;
    total_count: string;
    published_count: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE review_status IN ('pending', 'needs_review'))::text AS pending_count,
        COUNT(*) FILTER (WHERE review_status = 'rejected')::text AS rejected_count,
        COUNT(*)::text AS total_count,
        COUNT(*) FILTER (WHERE status = 'published')::text AS published_count
      FROM ai_product_batch_items
      WHERE batch_id = $1
    `,
    [batchId]
  );

  const pendingCount = Number(statusResult.rows[0]?.pending_count ?? 0);
  const rejectedCount = Number(statusResult.rows[0]?.rejected_count ?? 0);
  const totalCount = Number(statusResult.rows[0]?.total_count ?? 0);
  const publishedCount = Number(statusResult.rows[0]?.published_count ?? 0);
  const nextStatus = pendingCount > 0 ? "open" : rejectedCount > 0 ? "reviewed_with_rejections" : "reviewed";

  await client.query(
    `UPDATE ai_product_batches
     SET status = $2,
         total_items = $3,
         completed_items = $4,
         failed_items = $5,
         updated_at = NOW()
     WHERE id = $1`,
    [batchId, nextStatus, totalCount, publishedCount, rejectedCount]
  );
}

async function fetchRemoteImage(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "ZorvyaShop-AI/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen original (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const extension = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
  const buffer = await response.arrayBuffer();

  return {
    body: buffer,
    contentType,
    extension,
  };
}

function toPrivateBlobFilename(itemId: string, extension: string) {
  return `products/ai-originals/${itemId}-${Date.now()}.${extension}`;
}

export async function listAiPendingProducts() {
  const pool = await getAiProductsPool();
  const result = await pool.query<AiBatchItemRow>(
    `
      SELECT
        item.id,
        item.batch_id,
        item.product_id,
        item.generated_product_id,
        item.supplier_id,
        suppliers.name AS supplier_name,
        item.supplier_name_detected,
        item.title,
        item.description,
        item.category,
        item.tags_json,
        item.price_srd,
        item.cost_usd,
        item.stock_code,
        item.public_image_url,
        item.original_image_url,
        item.original_telegram_image_url,
        item.original_slack_image_url,
        item.review_status,
        item.status,
        item.created_by_ai,
        item.ai_confidence_score,
        item.generated_images,
        item.seo_title,
        item.seo_description,
        item.specifications,
        item.payload_json,
        item.error_message,
        item.processing_time_ms,
        item.created_at,
        item.updated_at
      FROM ai_product_batch_items item
      LEFT JOIN suppliers ON suppliers.id = item.supplier_id
      WHERE item.review_status IN ('pending', 'needs_review')
      ORDER BY item.updated_at DESC, item.created_at DESC
    `
  );

  return result.rows.map(mapPendingRow);
}

export async function createAiProductDraft(input: CreateAiDraftInput) {
  const startedAt = Date.now();
  const pool = await getAiProductsPool();
  const client = await pool.connect();
  const supplierById = await getSupplierById(input.supplierId);
  const supplierByName = supplierById ? null : await getSupplierByName(input.supplierName);
  const supplier = supplierById ?? supplierByName;
  const supplierNameDetected =
    normalizeText(input.supplierName) || normalizeText(input.supplierNameDetected);
  const batchId = normalizeText(input.batchId) || randomUUID();
  const itemId = randomUUID();
  const tags = buildProductTags(input.tags);
  const title = normalizeText(input.title);
  const category = normalizeText(input.category) || "Sin categoria";
  const description = buildDescription(
    title,
    category,
    tags,
    supplier?.name ?? supplierNameDetected,
    input.description ?? input.longDescription
  );
  const publicImageUrl = normalizeText(
    input.publicImageUrl || input.originalTelegramImageUrl || input.originalSlackImageUrl
  );
  const generatedImages = Array.isArray(input.generatedImages) ? input.generatedImages : [];
  const reviewStatus: Product["reviewStatus"] = supplier ? "pending" : "needs_review";
  const sanitizedCostUsd =
    input.costUsd === null || input.costUsd === undefined || Number.isNaN(Number(input.costUsd))
      ? 0
      : Number(input.costUsd);
  const sanitizedPriceSrd =
    input.priceSrd === null || input.priceSrd === undefined || Number.isNaN(Number(input.priceSrd))
      ? 0
      : Number(input.priceSrd);
  const sanitizedSpecifications =
    input.specifications && typeof input.specifications === "object"
      ? input.specifications
      : {};
  const sanitizedGeneratedImages = generatedImages.length > 0 ? generatedImages : [];
  const productDraftInput = {
    name: title,
    category,
    tags,
    price: toMoney(sanitizedPriceSrd),
    stock: Math.max(0, Math.trunc(Number(input.stock ?? 0))),
    shortDescription: buildShortDescription(description, title),
    longDescription: description,
    brand: normalizeText(input.brand) || "ZorvyA",
    sku: normalizeText(input.sku) || undefined,
    images: publicImageUrl
      ? [
          {
            url: publicImageUrl,
            alt: title || "Imagen IA",
            isPrimary: true,
          },
        ]
      : [],
    isActive: false,
    isVisible: false,
    showStock: false,
    inventoryLabel: normalizeText(input.inventoryLabel) || "Pendiente de revision IA",
    deliveryLabel: normalizeText(input.deliveryLabel) || "Delivery disponible",
    attributes: input.attributes ?? {},
    internal: {
      costPrice: sanitizedCostUsd,
      costUsd: sanitizedCostUsd,
      purchasePrice: sanitizedCostUsd,
      shippingFee: 0,
      isHeavy: false,
      supplierId: supplier?.id ?? "",
      supplier: supplier?.name ?? supplierNameDetected,
      supplierPhone: supplier?.phone ?? "",
      internalCode: normalizeText(input.sku) || normalizeText(input.stockCode),
      stockCode: normalizeText(input.stockCode),
      internalNotes: "Creado automaticamente desde n8n + Telegram + IA",
      accountingImageUrl: publicImageUrl,
      accountingOriginalImageUrl: "",
      originalTelegramImageUrl: normalizeText(input.originalTelegramImageUrl),
      originalSlackImageUrl: normalizeText(input.originalSlackImageUrl),
    },
    supplierId: supplier?.id ?? undefined,
    supplierName: supplier?.name ?? undefined,
    costUsd: sanitizedCostUsd,
    priceSrd: sanitizedPriceSrd,
    stockCode: normalizeText(input.stockCode),
    accountingOriginalImageUrl: "",
    originalTelegramImageUrl: normalizeText(input.originalTelegramImageUrl),
    originalSlackImageUrl: normalizeText(input.originalSlackImageUrl),
    originalSource: "telegram" as const,
    aiBatchId: batchId,
    reviewStatus,
    createdByAi: true,
    aiConfidenceScore:
      input.confidenceScore === null || input.confidenceScore === undefined
        ? null
        : Number(input.confidenceScore),
    generatedImages: sanitizedGeneratedImages,
    seoTitle: normalizeText(input.seoTitle) || title,
    seoDescription:
      normalizeText(input.seoDescription) || buildShortDescription(description, title),
    specifications: sanitizedSpecifications,
    ai: {
      draftId: itemId,
      sourceImageUrl: normalizeText(
        input.originalTelegramImageUrl || input.originalSlackImageUrl || publicImageUrl
      ),
      generatedImages:
        sanitizedGeneratedImages.length > 0
          ? sanitizedGeneratedImages
          : publicImageUrl
            ? [{ id: `${itemId}-public`, url: publicImageUrl, label: "Imagen publica" }]
            : [],
      suggestedName: title,
      suggestedSku: normalizeText(input.sku),
      suggestedInternalCode: normalizeText(input.stockCode),
      suggestedShortDescription: buildShortDescription(description, title),
      suggestedLongDescription: description,
      suggestedCategory: category,
      suggestedTags: tags,
    },
  };

  try {
    await client.query("BEGIN");

    await upsertBatch(client, {
      id: batchId,
      source: normalizeText(input.batchSource) || "telegram",
      supplierId: supplier?.id ?? null,
      supplierNameDetected,
      batchName: normalizeText(input.batchName) || `Batch ${new Date().toISOString().slice(0, 10)}`,
      telegramMessageId: normalizeText(input.telegramMessageId),
      telegramChatId: normalizeText(input.telegramChatId),
      totalItems: 1,
      completedItems: 0,
      failedItems: 0,
      metadata: input.batchMetadata ?? {},
    });

    console.log("[ai-products/create-draft] objeto final a insertar", productDraftInput);

    const product = await createProduct(productDraftInput, "ai:n8n");

    await insertBatchItem(client, {
      id: itemId,
      batchId,
      productId: product.id,
      supplierId: supplier?.id ?? null,
      supplierNameDetected,
      title,
      description,
      category,
      tags,
      priceSrd: toMoney(Number(input.priceSrd ?? 0)),
      costUsd: toMoney(sanitizedCostUsd),
      stockCode: normalizeText(input.stockCode),
      publicImageUrl,
      originalImageUrl: "",
      originalTelegramImageUrl: normalizeText(input.originalTelegramImageUrl),
      originalSlackImageUrl: normalizeText(input.originalSlackImageUrl),
      reviewStatus,
      status: "draft",
      createdByAi: true,
      aiConfidenceScore:
        input.confidenceScore === null || input.confidenceScore === undefined
          ? null
          : Number(input.confidenceScore),
      generatedImages:
        sanitizedGeneratedImages.length > 0
          ? sanitizedGeneratedImages
          : publicImageUrl
            ? [{ id: `${itemId}-public`, url: publicImageUrl, label: "Imagen publica" }]
            : [],
      seoTitle: normalizeText(input.seoTitle) || title,
      seoDescription:
        normalizeText(input.seoDescription) || buildShortDescription(description, title),
      specifications: sanitizedSpecifications,
      payload: {
        source: "telegram",
        attributes: input.attributes ?? {},
        telegramMessageId: normalizeText(input.telegramMessageId),
        telegramChatId: normalizeText(input.telegramChatId),
      },
      processingTimeMs: Math.max(0, Date.now() - startedAt),
    });

    await client.query("COMMIT");

    return {
      batchId,
      itemId,
      productId: product.id,
      product,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[ai-products/create-draft] postgres error completo", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function uploadAiOriginalImage(input: {
  itemId: string;
  sourceUrl?: string;
  contentType?: string;
  filename?: string;
  body?: ArrayBuffer;
  originalTelegramImageUrl?: string;
  originalSlackImageUrl?: string;
}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN no configurado.");
  }

  const item = await getPendingItemRow(input.itemId);
  if (!item) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  let payload: { body: ArrayBuffer; contentType: string; extension: string };
  if (input.body) {
    const contentType = input.contentType ?? "image/jpeg";
    payload = {
      body: input.body,
      contentType,
      extension: contentType.split("/")[1]?.split(";")[0] ?? "jpg",
    };
  } else if (input.sourceUrl) {
    payload = await fetchRemoteImage(input.sourceUrl);
  } else {
    throw new Error("ORIGINAL_IMAGE_SOURCE_REQUIRED");
  }

  const pathname = toPrivateBlobFilename(item.id, payload.extension);
  const blob = await put(pathname, payload.body, {
    access: "private",
    contentType: payload.contentType,
    addRandomSuffix: false,
  });

  const pool = await getAiProductsPool();
  await pool.query(
    `
      UPDATE ai_product_batch_items
      SET original_image_url = $2,
          original_telegram_image_url = COALESCE(NULLIF($3, ''), original_telegram_image_url),
          original_slack_image_url = COALESCE(NULLIF($4, ''), original_slack_image_url),
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      item.id,
      blob.url,
      normalizeText(input.originalTelegramImageUrl ?? input.sourceUrl),
      normalizeText(input.originalSlackImageUrl),
    ]
  );

  if (item.product_id) {
    const currentProduct = await getProductById(item.product_id);
    await updateProduct(
      item.product_id,
      {
        accountingOriginalImageUrl: blob.url,
        originalTelegramImageUrl: normalizeText(input.originalTelegramImageUrl ?? input.sourceUrl),
        originalSlackImageUrl: normalizeText(input.originalSlackImageUrl ?? input.sourceUrl),
        originalSource: "telegram",
        internal: currentProduct
          ? {
              ...currentProduct.internal,
              accountingOriginalImageUrl: blob.url,
              originalTelegramImageUrl: normalizeText(
                input.originalTelegramImageUrl ?? input.sourceUrl
              ),
              originalSlackImageUrl: normalizeText(input.originalSlackImageUrl ?? input.sourceUrl),
            }
          : undefined,
      },
      "ai:n8n"
    );
  }

  return {
    itemId: item.id,
    originalImageUrl: blob.url,
  };
}

export async function updateAiProductDraft(itemId: string, input: UpdateAiDraftInput) {
  const item = await getPendingItemRow(itemId);
  if (!item || !item.product_id) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const supplier = await getSupplierById(input.supplierId ?? item.supplier_id);
  const nextTags = input.tags ? buildProductTags(input.tags) : item.tags;
  const nextTitle = normalizeText(input.title) || item.title;
  const nextCategory = normalizeText(input.category) || item.category;
  const nextDescription = buildDescription(
    nextTitle,
    nextCategory,
    nextTags,
    supplier?.name ?? item.supplier_name ?? "",
    input.description ?? item.description
  );
  const currentProduct = await getProductById(item.product_id);

  if (!currentProduct) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const publicImageUrl = normalizeText(input.publicImageUrl ?? item.public_image_url);
  const generatedImages = input.generatedImages ?? item.generated_images ?? currentProduct.generatedImages ?? [];
  const updatePayload: Partial<Product> = {
    name: nextTitle,
    shortDescription: buildShortDescription(nextDescription, nextTitle),
    longDescription: nextDescription,
    category: nextCategory,
    tags: nextTags,
    price: input.priceSrd === undefined ? currentProduct.price : toMoney(Number(input.priceSrd)),
    stock:
      input.stock === undefined
        ? currentProduct.stock
        : Math.max(0, Math.trunc(Number(input.stock))),
    supplierId: supplier?.id ?? currentProduct.supplierId ?? undefined,
    supplierName:
      supplier?.name ?? item.supplier_name_detected ?? currentProduct.supplierName ?? undefined,
    costUsd:
      input.costUsd === undefined
        ? currentProduct.costUsd ?? Number(item.cost_usd ?? 0)
        : toMoney(Number(input.costUsd)),
    priceSrd:
      input.priceSrd === undefined
        ? currentProduct.priceSrd ?? currentProduct.price
        : toMoney(Number(input.priceSrd)),
    stockCode: normalizeText(input.stockCode) || currentProduct.stockCode || item.stock_code,
    originalTelegramImageUrl:
      normalizeText(input.originalTelegramImageUrl) ||
      currentProduct.originalTelegramImageUrl ||
      item.original_telegram_image_url,
    originalSlackImageUrl:
      normalizeText(input.originalSlackImageUrl) ||
      currentProduct.originalSlackImageUrl ||
      item.original_slack_image_url,
    originalSource: "telegram",
    aiConfidenceScore:
      input.confidenceScore === undefined
        ? currentProduct.aiConfidenceScore ??
          (item.ai_confidence_score === null ? null : Number(item.ai_confidence_score))
        : input.confidenceScore,
    reviewStatus: supplier?.id ? "pending" : "needs_review",
    generatedImages,
    seoTitle:
      normalizeText(input.seoTitle) || currentProduct.seoTitle || item.seo_title || nextTitle,
    seoDescription:
      normalizeText(input.seoDescription) ||
      currentProduct.seoDescription ||
      item.seo_description ||
      buildShortDescription(nextDescription, nextTitle),
    specifications:
      input.specifications ?? currentProduct.specifications ?? item.specifications ?? {},
    internal: {
      ...currentProduct.internal,
      supplierId: supplier?.id ?? currentProduct.internal.supplierId,
      supplier:
        supplier?.name ??
        item.supplier_name_detected ??
        currentProduct.internal.supplier,
      supplierPhone: supplier?.phone ?? currentProduct.internal.supplierPhone,
      costUsd:
        input.costUsd === undefined
          ? currentProduct.internal.costUsd ?? Number(item.cost_usd ?? 0)
          : Number(input.costUsd),
      costPrice:
        input.costUsd === undefined
          ? currentProduct.internal.costPrice
          : Number(input.costUsd),
      purchasePrice:
        input.costUsd === undefined
          ? currentProduct.internal.purchasePrice
          : Number(input.costUsd),
      stockCode:
        normalizeText(input.stockCode) || currentProduct.internal.stockCode || item.stock_code,
      accountingImageUrl:
        publicImageUrl || currentProduct.internal.accountingImageUrl,
      accountingOriginalImageUrl:
        currentProduct.internal.accountingOriginalImageUrl || item.original_image_url,
      originalTelegramImageUrl:
        normalizeText(input.originalTelegramImageUrl) ||
        currentProduct.internal.originalTelegramImageUrl ||
        item.original_telegram_image_url,
      originalSlackImageUrl:
        normalizeText(input.originalSlackImageUrl) ||
        currentProduct.internal.originalSlackImageUrl ||
        item.original_slack_image_url,
    },
    ai: {
      ...(currentProduct.ai ?? {
        draftId: item.id,
        generatedImages: [],
      }),
      draftId: item.id,
      sourceImageUrl:
        normalizeText(input.originalTelegramImageUrl) ||
        normalizeText(input.originalSlackImageUrl) ||
        currentProduct.ai?.sourceImageUrl ||
        item.original_telegram_image_url ||
        item.original_slack_image_url ||
        publicImageUrl,
      suggestedName: nextTitle,
      suggestedCategory: nextCategory,
      suggestedShortDescription: buildShortDescription(nextDescription, nextTitle),
      suggestedLongDescription: nextDescription,
      suggestedTags: nextTags,
      generatedImages:
        generatedImages.length > 0
          ? generatedImages
          : publicImageUrl
            ? [{ id: `${item.id}-public`, url: publicImageUrl, label: "Imagen publica" }]
            : currentProduct.ai?.generatedImages ?? [],
      suggestedSku: normalizeText(input.sku) || currentProduct.ai?.suggestedSku,
      suggestedInternalCode:
        normalizeText(input.stockCode) || currentProduct.ai?.suggestedInternalCode,
    },
  };

  if (publicImageUrl) {
    updatePayload.images = [
      {
        id: currentProduct.images[0]?.id ?? randomUUID(),
        url: publicImageUrl,
        alt: nextTitle || "Imagen principal",
        isPrimary: true,
      },
      ...currentProduct.images.slice(1),
    ];
  }

  const updatedProduct = await updateProduct(item.product_id, updatePayload, "ai:n8n");
  const pool = await getAiProductsPool();
  await pool.query(
    `
      UPDATE ai_product_batch_items
      SET supplier_id = $2,
          supplier_name_detected = $3,
          title = $4,
          description = $5,
          category = $6,
          tags_json = $7::jsonb,
          price_srd = $8,
          cost_usd = $9,
          stock_code = $10,
          public_image_url = $11,
          original_telegram_image_url = COALESCE(NULLIF($12, ''), original_telegram_image_url),
          original_slack_image_url = COALESCE(NULLIF($13, ''), original_slack_image_url),
          ai_confidence_score = $14,
          generated_images = $15::jsonb,
          seo_title = $16,
          seo_description = $17,
          specifications = $18::jsonb,
          review_status = $19,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      item.id,
      supplier?.id ?? item.supplier_id,
      supplier?.name ?? item.supplier_name_detected ?? "",
      nextTitle,
      nextDescription,
      nextCategory,
      JSON.stringify(nextTags),
      updatedProduct.priceSrd ?? updatedProduct.price,
      updatedProduct.costUsd ?? Number(item.cost_usd ?? 0),
      updatedProduct.stockCode ?? item.stock_code,
      publicImageUrl,
      normalizeText(input.originalTelegramImageUrl),
      normalizeText(input.originalSlackImageUrl),
      updatedProduct.aiConfidenceScore,
      JSON.stringify(updatedProduct.generatedImages ?? []),
      updatedProduct.seoTitle ?? "",
      updatedProduct.seoDescription ?? "",
      JSON.stringify(updatedProduct.specifications ?? {}),
      updatedProduct.reviewStatus ?? (supplier?.id ? "pending" : "needs_review"),
    ]
  );

  return updatedProduct;
}

export async function publishAiProduct(itemId: string, updatedBy: string) {
  const item = await getPendingItemRow(itemId);
  if (!item || !item.product_id) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const product = await updateProduct(
    item.product_id,
    {
      isActive: true,
      isVisible: true,
      reviewStatus: "approved",
      createdByAi: true,
    },
    updatedBy
  );

  const pool = await getAiProductsPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE ai_product_batch_items
        SET review_status = 'approved',
            status = 'published',
            published_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [item.id]
    );
    await updateBatchStatusForProduct(client, item.batch_id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return product;
}

export async function rejectAiProduct(itemId: string, updatedBy: string, reason?: string) {
  const item = await getPendingItemRow(itemId);
  if (!item || !item.product_id) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const product = await updateProduct(
    item.product_id,
    {
      isActive: false,
      isVisible: false,
      reviewStatus: "rejected",
      createdByAi: true,
    },
    updatedBy
  );

  const pool = await getAiProductsPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        UPDATE ai_product_batch_items
        SET review_status = 'rejected',
            status = 'rejected',
            error_message = COALESCE(NULLIF($3, ''), error_message),
            rejected_at = NOW(),
            payload_json = payload_json || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        item.id,
        JSON.stringify({
          rejectionReason: normalizeText(reason),
          rejectedBy: updatedBy,
        }),
        normalizeText(reason),
      ]
    );
    await updateBatchStatusForProduct(client, item.batch_id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return product;
}

export async function changeAiProductSupplier(itemId: string, supplierId: string, updatedBy: string) {
  const item = await getPendingItemRow(itemId);
  if (!item || !item.product_id) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const supplier = await getSupplierById(supplierId);
  if (!supplier) {
    throw new Error("SUPPLIER_NOT_FOUND");
  }

  const product = await getProductById(item.product_id);
  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const updatedProduct = await updateProduct(
    item.product_id,
    {
      supplierId: supplier.id,
      supplierName: supplier.name,
      reviewStatus: "pending",
      internal: {
        ...product.internal,
        supplierId: supplier.id,
        supplier: supplier.name,
        supplierPhone: supplier.phone,
      },
    },
    updatedBy
  );

  const pool = await getAiProductsPool();
  await pool.query(
    `UPDATE ai_product_batch_items
     SET supplier_id = $2,
         supplier_name_detected = $3,
         review_status = 'pending',
         updated_at = NOW()
     WHERE id = $1`,
    [item.id, supplier.id, supplier.name]
  );

  return updatedProduct;
}

export async function regenerateAiProductDescription(itemId: string, updatedBy: string) {
  const item = await getPendingItemRow(itemId);
  if (!item || !item.product_id) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const nextDescription = buildDescription(
    item.title,
    item.category,
    Array.isArray(item.tags_json) ? item.tags_json : [],
    normalizeText(item.supplier_name) || normalizeText(item.supplier_name_detected),
    ""
  );

  const product = await updateProduct(
    item.product_id,
    {
      shortDescription: buildShortDescription(nextDescription, item.title),
      longDescription: nextDescription,
      ai: {
        draftId: item.id,
        generatedImages: [],
        suggestedName: item.title,
        suggestedCategory: item.category,
        suggestedShortDescription: buildShortDescription(nextDescription, item.title),
        suggestedLongDescription: nextDescription,
        suggestedTags: Array.isArray(item.tags_json) ? item.tags_json : [],
      },
    },
    updatedBy
  );

  const pool = await getAiProductsPool();
  await pool.query(
    `UPDATE ai_product_batch_items SET description = $2, updated_at = NOW() WHERE id = $1`,
    [item.id, nextDescription]
  );

  return product;
}

export async function requestAiImageRegeneration(itemId: string, updatedBy: string) {
  const item = await getPendingItemRow(itemId);
  if (!item || !(item.generated_product_id ?? item.product_id)) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const productId = item.generated_product_id ?? item.product_id!;
  const product = await getProductById(productId);
  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  await updateProduct(
    productId,
    {
      reviewStatus: product.reviewStatus === "approved" ? "approved" : "pending",
      ai: {
        ...(product.ai ?? { draftId: item.id, generatedImages: [] }),
        draftId: item.id,
        generatedImages: product.generatedImages ?? product.ai?.generatedImages ?? [],
      },
    },
    updatedBy
  );

  const pool = await getAiProductsPool();
  await pool.query(
    `
      UPDATE ai_product_batch_items
      SET payload_json = payload_json || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      item.id,
      JSON.stringify({
        regenerateImagesRequestedAt: new Date().toISOString(),
        regenerateImagesRequestedBy: updatedBy,
      }),
    ]
  );

  return { success: true };
}

export async function getAiOriginalImageResponse(itemId: string) {
  const item = await getPendingItemRow(itemId);
  if (!item || !normalizeText(item.original_image_url)) {
    return null;
  }

  const blob = await get(item.original_image_url, { access: "private" });
  if (!blob?.stream) {
    return null;
  }

  return blob;
}
