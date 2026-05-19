import "server-only";

import { unstable_cache } from "next/cache";

import {
  getProductById,
  getProductGalleryImageSource,
  getProductSummaries,
  getProductsDataSourceInfo,
  type ProductsDataSource,
} from "@/lib/server/admin/products";
import type { Product } from "@/lib/shop/admin-types";
import type {
  StorefrontProduct,
  StorefrontProductColorOption,
  StorefrontProductVariant,
} from "@/lib/shop/types";

const STOREFRONT_PRODUCTS_TAG = "storefront-products";
type StorefrontProductsResult = {
  products: StorefrontProduct[];
  source: ProductsDataSource;
};

function buildMediaProxyUrl(
  productId: string | number,
  kind: "gallery" | "variant" | "color",
  key: string,
  updatedAt?: string
) {
  const params = new URLSearchParams({
    kind,
    key,
  });

  if (updatedAt) {
    params.set("v", updatedAt);
  }

  return `/api/products/${String(productId)}/media?${params.toString()}`;
}

function toStorefrontMediaUrl(
  productId: string | number,
  rawUrl: string | undefined,
  kind: "gallery" | "variant" | "color",
  key: string,
  updatedAt?: string
) {
  const trimmed = String(rawUrl ?? "").trim();

  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("data:")) {
    return trimmed;
  }

  return buildMediaProxyUrl(productId, kind, key, updatedAt);
}

function toBadge(input: {
  isFeatured: boolean;
  isTop: boolean;
  brand: string;
}) {
  if (input.isFeatured) {
    return "Destacado";
  }

  if (input.isTop) {
    return "Top";
  }

  return input.brand || "Producto";
}

function parseStoredList<T>(value: string | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeVariants(productId: string | number, updatedAt: string | undefined, value: string | undefined) {
  const rawVariants = parseStoredList<Array<Partial<StorefrontProductVariant>>>(value, []);

  return rawVariants
    .map((variant, index) => ({
      id: String(variant.id ?? `variant-${index + 1}`),
      name: String(variant.name ?? "").trim(),
      price: Number(variant.price ?? 0),
      color: String(variant.color ?? "").trim(),
      details: String(variant.details ?? "").trim(),
      imageUrl: toStorefrontMediaUrl(
        productId,
        String(variant.imageUrl ?? "").trim(),
        "variant",
        String(variant.id ?? `variant-${index + 1}`),
        updatedAt
      ),
    }))
    .filter(
      (variant) =>
        variant.name ||
        variant.price > 0 ||
        variant.color ||
        variant.details ||
        variant.imageUrl
    );
}

function normalizeColorOptions(
  productId: string | number,
  updatedAt: string | undefined,
  value: string | undefined
) {
  return parseStoredList<Array<Partial<StorefrontProductColorOption>>>(value, [])
    .map((colorOption, index) => ({
      id: String(colorOption.id ?? `color-${index + 1}`),
      name: String(colorOption.name ?? "").trim(),
      imageUrl: toStorefrontMediaUrl(
        productId,
        String(colorOption.imageUrl ?? "").trim(),
        "color",
        `color-${String(colorOption.id ?? `color-${index + 1}`)}`,
        updatedAt
      ),
    }))
    .filter((color) => color.name || color.imageUrl);
}

function normalizeColors(
  productId: string | number,
  updatedAt: string | undefined,
  value: string | undefined,
  colorOptionsValue: string | undefined
) {
  const colorOptions = normalizeColorOptions(productId, updatedAt, colorOptionsValue);

  if (colorOptions.length > 0) {
    return {
      colors: colorOptions.map((color) => color.name).filter(Boolean),
      colorOptions,
      colorImageMap: Object.fromEntries(
        colorOptions
          .filter((color) => color.name && color.imageUrl)
          .map((color) => [color.name, color.imageUrl])
      ),
    };
  }

  return {
    colors: parseStoredList<string[]>(value, [])
      .map((color) => String(color).trim())
      .filter(Boolean),
    colorOptions: [],
    colorImageMap: {},
  };
}

function hasFreeDelivery(product: Product) {
  if (product.internal?.isHeavy) {
    return false;
  }

  const rawFlag = product.attributes?.freeDelivery;

  if (rawFlag === "true") {
    return true;
  }

  return /(gratis|gratis delivery|free delivery|entrega gratis|gratis levering)/i.test(
    product.deliveryLabel
  );
}

export function toStorefrontProduct(product: Product): StorefrontProduct {
  const images = product.images
    .map((image, index) =>
      toStorefrontMediaUrl(product.id, image.url, "gallery", String(index), product.updatedAt)
    )
    .filter(Boolean);
  const variants = normalizeVariants(product.id, product.updatedAt, product.attributes?.variants);
  const { colors, colorOptions, colorImageMap } = normalizeColors(
    product.id,
    product.updatedAt,
    product.attributes?.colors,
    product.attributes?.colorOptions
  );

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    brand: product.brand,
    category: product.category,
    tags: product.tags,
    price: product.price,
    originalPrice: product.originalPrice,
    image: images[0] ?? "",
    images,
    rating: product.rating,
    reviewCount: product.reviewCount,
    badge: toBadge(product),
    inventoryLabel: product.inventoryLabel,
    deliveryLabel: product.deliveryLabel,
    hasFreeDelivery: hasFreeDelivery(product),
    isHeavy: Boolean(product.internal?.isHeavy),
    stock: product.stock,
    showStock: product.showStock,
    displayOrder: product.displayOrder,
    isFeatured: product.isFeatured,
    isTop: product.isTop,
    colors,
    colorOptions,
    colorImageMap,
    variants,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    translations: product.translations,
  };
}

async function readStorefrontProductsUncached(): Promise<StorefrontProductsResult> {
  const products = await getProductSummaries({ onlyActive: true });
  const info = await getProductsDataSourceInfo({ onlyActive: true });

  console.info(
    `[catalog] storefront loaded ${products.length} product(s) from ${info.source}`
  );

  if (products.length === 0) {
    console.warn("[catalog] storefront has no visible products after filtering.");
  }

  return {
    products: products.map(toStorefrontProduct),
    source: info.source,
  };
}

const getCachedStorefrontProducts = unstable_cache(
  async () => readStorefrontProductsUncached(),
  ["storefront-products"],
  {
    revalidate: 60,
    tags: [STOREFRONT_PRODUCTS_TAG],
  }
);

export async function getStorefrontProducts() {
  const result = await getCachedStorefrontProducts();
  return result.products;
}

export async function getStorefrontProductsDebugInfo() {
  const result = await getCachedStorefrontProducts();

  return {
    source: result.source,
    count: result.products.length,
  };
}

export function getStorefrontSnapshotTimestamp() {
  return Date.now();
}

export async function getStorefrontProductById(productId: string) {
  const product = await getProductById(productId);

  if (!product || !product.isActive || !product.isVisible) {
    return null;
  }

  return toStorefrontProduct(product);
}

export async function getStorefrontRecommendedProducts(
  product: Pick<StorefrontProduct, "id" | "category" | "brand">,
  limit: number = 4
) {
  const products = await getStorefrontProducts();

  return products
    .filter((item) => String(item.id) !== String(product.id))
    .filter((item) => item.category === product.category || item.brand === product.brand)
    .slice(0, limit);
}

export async function getStorefrontProductMediaSource(
  productId: string,
  kind: string | null,
  key: string | null
) {
  const product = await getProductById(productId);

  if (!product || !product.isActive || !product.isVisible) {
    return null;
  }

  if (kind === "gallery") {
    const imageIndex = Number(key);

    if (!Number.isInteger(imageIndex) || imageIndex < 0) {
      return null;
    }

    return getProductGalleryImageSource(productId, imageIndex);
  }

  if (kind === "variant") {
    const variants = parseStoredList<Array<Partial<StorefrontProductVariant>>>(product.attributes?.variants, []);
    const variant = variants.find((entry, index) => String(entry.id ?? `variant-${index + 1}`) === String(key));
    const imageUrl = typeof variant?.imageUrl === "string" ? variant.imageUrl.trim() : "";
    return imageUrl || null;
  }

  if (kind === "color") {
    const colorOptions = parseStoredList<Array<Partial<StorefrontProductColorOption>>>(
      product.attributes?.colorOptions,
      []
    );
    const colorOption = colorOptions.find(
      (entry, index) => String(entry.id ?? `color-${index + 1}`) === String(key).replace(/^color-/, "")
        || `color-${String(entry.id ?? `color-${index + 1}`)}` === String(key)
    );
    const imageUrl = typeof colorOption?.imageUrl === "string" ? colorOption.imageUrl.trim() : "";
    return imageUrl || null;
  }

  return null;
}

export { STOREFRONT_PRODUCTS_TAG };
