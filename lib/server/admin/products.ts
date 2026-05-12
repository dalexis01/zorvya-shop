import "server-only";

import { randomUUID } from "node:crypto";

import { readDataFile, writeDataFile } from "../storage";

import type {
  Product,
  ProductAiImageCandidate,
  ProductImage,
  ProductInternalDetails,
  ProductMetrics,
} from "@/lib/shop/admin-types";
import type { ProductLocaleContent } from "@/lib/shop/types";

const PRODUCTS_FILE = "products.json";
const PUBLIC_ID_PREFIX = "PRD-";

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

async function readProducts() {
  const products = await readDataFile<Product[]>(PRODUCTS_FILE, []);
  let nextPublicIdValue = products.reduce((highest, product) => {
    const parsed = parsePublicIdNumber(product.publicId);
    return parsed ? Math.max(highest, parsed) : highest;
  }, 0);

  return products.map((product) => {
    const normalized = normalizeProduct(product);

    if (normalized.publicId) {
      return normalized;
    }

    nextPublicIdValue += 1;
    return {
      ...normalized,
      publicId: formatPublicId(nextPublicIdValue),
    };
  });
}

async function writeProducts(products: Product[]) {
  await writeDataFile(PRODUCTS_FILE, products.map(normalizeProduct));
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

  return products.sort((left, right) => {
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
    metrics: createProductMetrics(input.price, input.stock, normalizedInternal.costPrice),
    createdAt: now,
    publishedAt: isActive ? now : null,
    stockAddedAt: stock > 0 ? now : null,
    lastSoldAt: null,
    saleDates: [],
    updatedAt: now,
    updatedBy: createdBy,
    ai: input.ai,
  });

  products.push(product);
  await writeProducts(products);

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
          : nextIsActive
            ? product.publishedAt
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

  await writeProducts(products.map((item) => (item.id === id ? updated : item)));

  return updated;
}

export async function deleteProduct(id: string) {
  const products = await readProducts();
  await writeProducts(products.filter((product) => product.id !== id));
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
  const products = await readProducts();
  let hasChanges = false;
  const soldAt = trimText(input.soldAt);

  const nextProducts = products.map((product) => {
    const matchedItem = input.items.find(
      (item) => String(item.productId ?? "") === String(product.id)
    );

    if (!matchedItem) {
      return product;
    }

    hasChanges = true;

    return normalizeProduct({
      ...product,
      lastSoldAt: soldAt,
      saleDates: [...product.saleDates, soldAt],
      updatedAt: soldAt,
    });
  });

  if (hasChanges) {
    await writeProducts(nextProducts);
  }
}
