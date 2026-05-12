import type { StorefrontProduct } from "@/lib/shop/types";

export const NEW_PRODUCT_WINDOW_DAYS = 3;

const NEW_PRODUCT_WINDOW_MS = NEW_PRODUCT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function getTimestamp(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getStableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function isNewStorefrontProduct(
  product: Pick<StorefrontProduct, "createdAt">,
  now: number = Date.now()
) {
  const createdAt = getTimestamp(product.createdAt);

  if (!createdAt) {
    return false;
  }

  return Math.max(0, now - createdAt) <= NEW_PRODUCT_WINDOW_MS;
}

export function orderStorefrontProducts(
  products: StorefrontProduct[],
  shuffleSeed: string,
  now: number = Date.now()
) {
  const freshProducts = products
    .filter((product) => isNewStorefrontProduct(product, now))
    .sort((left, right) => {
      const timestampDiff = getTimestamp(right.createdAt) - getTimestamp(left.createdAt);

      if (timestampDiff !== 0) {
        return timestampDiff;
      }

      return String(left.id).localeCompare(String(right.id));
    });

  const regularProducts = products
    .filter((product) => !isNewStorefrontProduct(product, now))
    .sort((left, right) => {
      const leftScore = getStableHash(
        `${shuffleSeed}:${String(left.id)}:${left.updatedAt ?? left.createdAt ?? ""}`
      );
      const rightScore = getStableHash(
        `${shuffleSeed}:${String(right.id)}:${right.updatedAt ?? right.createdAt ?? ""}`
      );

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return String(left.id).localeCompare(String(right.id));
    });

  return [...freshProducts, ...regularProducts];
}
