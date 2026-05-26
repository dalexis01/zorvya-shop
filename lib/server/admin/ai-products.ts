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

type AiBatchItemRow = QueryResultRow & {
  id: string;
  batch_id: string;
  product_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  title: string;
  description: string;
  category: string;
  tags_json: string[] | null;
  price_srd: number | string;
  cost_usd: number | string;
  stock_code: string;
  public_image_url: string;
  original_image_url: string;
  original_slack_image_url: string;
  review_status: string;
  created_by_ai: boolean;
  ai_confidence_score: number | string | null;
  payload_json: Record<string, unknown> | null;
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
  originalSlackImageUrl?: string;
  confidenceScore?: number | null;
  attributes?: Record<string, string>;
  inventoryLabel?: string;
  deliveryLabel?: string;
  longDescription?: string;
  shortDescription?: string;
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
  originalSlackImageUrl: string;
  confidenceScore: number | null;
  brand: string;
  sku: string;
  inventoryLabel: string;
  deliveryLabel: string;
  attributes: Record<string, string>;
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
    productId: row.product_id,
    supplierId: row.supplier_id,
    supplierName: normalizeText(row.supplier_name),
    publicImageUrl: normalizeText(row.public_image_url),
    originalImageUrl: normalizeText(row.original_image_url),
    originalSlackImageUrl: normalizeText(row.original_slack_image_url),
    costUsd: Number(row.cost_usd ?? 0),
    stockCode: normalizeText(row.stock_code),
    priceSrd: Number(row.price_srd ?? 0),
    title: row.title,
    description: row.description,
    category: row.category,
    tags: Array.isArray(row.tags_json) ? row.tags_json : [],
    reviewStatus:
      row.review_status === "rejected" ||
      row.review_status === "pending_review" ||
      row.review_status === "approved"
        ? row.review_status
        : "draft",
    aiConfidenceScore:
      row.ai_confidence_score === null ? null : Number(row.ai_confidence_score),
    createdByAi: Boolean(row.created_by_ai),
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
  const [suppliersSql, aiSql] = await Promise.all([
    readFile(SUPPLIERS_SCHEMA_FILE, "utf8"),
    readFile(AI_PRODUCTS_SCHEMA_FILE, "utf8"),
  ]);

  await pool.query(suppliersSql);
  await pool.query(aiSql);
}

async function getSupplierById(supplierId: string | null | undefined) {
  const normalizedId = normalizeText(supplierId);
  if (!normalizedId) {
    return null;
  }

  const choices = await getSupplierChoices();
  return choices.find((supplier) => supplier.id === normalizedId) ?? null;
}

async function upsertBatch(
  client: PoolClient,
  input: {
    id: string;
    source: string;
    supplierId: string | null;
    batchName: string;
    metadata: Record<string, unknown>;
  }
) {
  await client.query(
    `
      INSERT INTO ai_product_batches (
        id,
        source,
        supplier_id,
        batch_name,
        status,
        metadata_json,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, 'open', $5::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        source = EXCLUDED.source,
        supplier_id = EXCLUDED.supplier_id,
        batch_name = EXCLUDED.batch_name,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = NOW()
    `,
    [input.id, input.source, input.supplierId, input.batchName, JSON.stringify(input.metadata)]
  );
}

async function insertBatchItem(
  client: PoolClient,
  input: {
    id: string;
    batchId: string;
    productId: string;
    supplierId: string | null;
    title: string;
    description: string;
    category: string;
    tags: string[];
    priceSrd: number;
    costUsd: number;
    stockCode: string;
    publicImageUrl: string;
    originalImageUrl: string;
    originalSlackImageUrl: string;
    reviewStatus: "draft" | "pending_review" | "approved" | "rejected";
    createdByAi: boolean;
    aiConfidenceScore: number | null;
    payload: Record<string, unknown>;
  }
) {
  await client.query(
    `
      INSERT INTO ai_product_batch_items (
        id,
        batch_id,
        product_id,
        supplier_id,
        title,
        description,
        category,
        tags_json,
        price_srd,
        cost_usd,
        stock_code,
        public_image_url,
        original_image_url,
        original_slack_image_url,
        review_status,
        created_by_ai,
        ai_confidence_score,
        payload_json,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18::jsonb, NOW(), NOW()
      )
    `,
    [
      input.id,
      input.batchId,
      input.productId,
      input.supplierId,
      input.title,
      input.description,
      input.category,
      JSON.stringify(input.tags),
      input.priceSrd,
      input.costUsd,
      input.stockCode,
      input.publicImageUrl,
      input.originalImageUrl,
      input.originalSlackImageUrl,
      input.reviewStatus,
      input.createdByAi,
      input.aiConfidenceScore,
      JSON.stringify(input.payload),
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
        item.supplier_id,
        suppliers.name AS supplier_name,
        item.title,
        item.description,
        item.category,
        item.tags_json,
        item.price_srd,
        item.cost_usd,
        item.stock_code,
        item.public_image_url,
        item.original_image_url,
        item.original_slack_image_url,
        item.review_status,
        item.created_by_ai,
        item.ai_confidence_score,
        item.payload_json,
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
  const statusResult = await client.query<{ pending_count: string; rejected_count: string }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE review_status IN ('draft', 'pending_review'))::text AS pending_count,
        COUNT(*) FILTER (WHERE review_status = 'rejected')::text AS rejected_count
      FROM ai_product_batch_items
      WHERE batch_id = $1
    `,
    [batchId]
  );

  const pendingCount = Number(statusResult.rows[0]?.pending_count ?? 0);
  const rejectedCount = Number(statusResult.rows[0]?.rejected_count ?? 0);
  const nextStatus = pendingCount > 0 ? "open" : rejectedCount > 0 ? "reviewed_with_rejections" : "reviewed";

  await client.query(
    `UPDATE ai_product_batches SET status = $2, updated_at = NOW() WHERE id = $1`,
    [batchId, nextStatus]
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
        item.supplier_id,
        suppliers.name AS supplier_name,
        item.title,
        item.description,
        item.category,
        item.tags_json,
        item.price_srd,
        item.cost_usd,
        item.stock_code,
        item.public_image_url,
        item.original_image_url,
        item.original_slack_image_url,
        item.review_status,
        item.created_by_ai,
        item.ai_confidence_score,
        item.payload_json,
        item.created_at,
        item.updated_at
      FROM ai_product_batch_items item
      LEFT JOIN suppliers ON suppliers.id = item.supplier_id
      WHERE item.review_status IN ('draft', 'pending_review')
      ORDER BY item.updated_at DESC, item.created_at DESC
    `
  );

  return result.rows.map(mapPendingRow);
}

export async function createAiProductDraft(input: CreateAiDraftInput) {
  const pool = await getAiProductsPool();
  const client = await pool.connect();
  const supplier = await getSupplierById(input.supplierId);
  const batchId = normalizeText(input.batchId) || randomUUID();
  const itemId = randomUUID();
  const tags = buildProductTags(input.tags);
  const title = normalizeText(input.title);
  const category = normalizeText(input.category) || "Sin categoria";
  const description = buildDescription(
    title,
    category,
    tags,
    supplier?.name ?? "",
    input.description ?? input.longDescription
  );
  const publicImageUrl = normalizeText(input.publicImageUrl || input.originalSlackImageUrl);

  try {
    await client.query("BEGIN");

    await upsertBatch(client, {
      id: batchId,
      source: normalizeText(input.batchSource) || "n8n",
      supplierId: supplier?.id ?? null,
      batchName: normalizeText(input.batchName) || `Batch ${new Date().toISOString().slice(0, 10)}`,
      metadata: input.batchMetadata ?? {},
    });

    const product = await createProduct(
      {
        name: title,
        category,
        tags,
        price: toMoney(Number(input.priceSrd ?? 0)),
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
          costPrice: Number(input.costUsd ?? 0),
          costUsd: Number(input.costUsd ?? 0),
          purchasePrice: Number(input.costUsd ?? 0),
          shippingFee: 0,
          isHeavy: false,
          supplierId: supplier?.id ?? "",
          supplier: supplier?.name ?? "",
          supplierPhone: supplier?.phone ?? "",
          internalCode: normalizeText(input.sku) || normalizeText(input.stockCode),
          stockCode: normalizeText(input.stockCode),
          internalNotes: "Creado automaticamente desde n8n + Slack + IA",
          accountingImageUrl: publicImageUrl,
          accountingOriginalImageUrl: "",
          originalSlackImageUrl: normalizeText(input.originalSlackImageUrl),
        },
        supplierId: supplier?.id ?? undefined,
        costUsd: Number(input.costUsd ?? 0),
        stockCode: normalizeText(input.stockCode),
        accountingOriginalImageUrl: "",
        originalSlackImageUrl: normalizeText(input.originalSlackImageUrl),
        aiBatchId: batchId,
        reviewStatus: "draft",
        createdByAi: true,
        aiConfidenceScore:
          input.confidenceScore === null || input.confidenceScore === undefined
            ? null
            : Number(input.confidenceScore),
        ai: {
          draftId: itemId,
          sourceImageUrl: normalizeText(input.originalSlackImageUrl || publicImageUrl),
          generatedImages: publicImageUrl
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
      },
      "ai:n8n"
    );

    await insertBatchItem(client, {
      id: itemId,
      batchId,
      productId: product.id,
      supplierId: supplier?.id ?? null,
      title,
      description,
      category,
      tags,
      priceSrd: toMoney(Number(input.priceSrd ?? 0)),
      costUsd: toMoney(Number(input.costUsd ?? 0)),
      stockCode: normalizeText(input.stockCode),
      publicImageUrl,
      originalImageUrl: "",
      originalSlackImageUrl: normalizeText(input.originalSlackImageUrl),
      reviewStatus: "draft",
      createdByAi: true,
      aiConfidenceScore:
        input.confidenceScore === null || input.confidenceScore === undefined
          ? null
          : Number(input.confidenceScore),
      payload: {
        source: "n8n",
        attributes: input.attributes ?? {},
      },
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
          original_slack_image_url = COALESCE(NULLIF($3, ''), original_slack_image_url),
          updated_at = NOW()
      WHERE id = $1
    `,
    [item.id, blob.url, normalizeText(input.originalSlackImageUrl ?? input.sourceUrl)]
  );

  if (item.product_id) {
    const currentProduct = await getProductById(item.product_id);
    await updateProduct(
      item.product_id,
      {
        accountingOriginalImageUrl: blob.url,
        originalSlackImageUrl: normalizeText(input.originalSlackImageUrl ?? input.sourceUrl),
        internal: currentProduct
          ? {
              ...currentProduct.internal,
              accountingOriginalImageUrl: blob.url,
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
    costUsd:
      input.costUsd === undefined
        ? currentProduct.costUsd ?? Number(item.cost_usd ?? 0)
        : toMoney(Number(input.costUsd)),
    stockCode: normalizeText(input.stockCode) || currentProduct.stockCode || item.stock_code,
    originalSlackImageUrl:
      normalizeText(input.originalSlackImageUrl) ||
      currentProduct.originalSlackImageUrl ||
      item.original_slack_image_url,
    aiConfidenceScore:
      input.confidenceScore === undefined
        ? currentProduct.aiConfidenceScore ??
          (item.ai_confidence_score === null ? null : Number(item.ai_confidence_score))
        : input.confidenceScore,
    internal: {
      ...currentProduct.internal,
      supplierId: supplier?.id ?? currentProduct.internal.supplierId,
      supplier: supplier?.name ?? currentProduct.internal.supplier,
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
        normalizeText(input.originalSlackImageUrl) ||
        currentProduct.ai?.sourceImageUrl ||
        item.original_slack_image_url ||
        publicImageUrl,
      suggestedName: nextTitle,
      suggestedCategory: nextCategory,
      suggestedShortDescription: buildShortDescription(nextDescription, nextTitle),
      suggestedLongDescription: nextDescription,
      suggestedTags: nextTags,
      generatedImages: publicImageUrl
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
          title = $3,
          description = $4,
          category = $5,
          tags_json = $6::jsonb,
          price_srd = $7,
          cost_usd = $8,
          stock_code = $9,
          public_image_url = $10,
          original_slack_image_url = COALESCE(NULLIF($11, ''), original_slack_image_url),
          ai_confidence_score = $12,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      item.id,
      supplier?.id ?? item.supplier_id,
      nextTitle,
      nextDescription,
      nextCategory,
      JSON.stringify(nextTags),
      updatedProduct.price,
      updatedProduct.costUsd ?? Number(item.cost_usd ?? 0),
      updatedProduct.stockCode ?? item.stock_code,
      publicImageUrl,
      normalizeText(input.originalSlackImageUrl),
      updatedProduct.aiConfidenceScore,
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
    `UPDATE ai_product_batch_items SET supplier_id = $2, updated_at = NOW() WHERE id = $1`,
    [item.id, supplier.id]
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
    normalizeText(item.supplier_name),
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
