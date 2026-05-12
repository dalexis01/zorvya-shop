import type { StorefrontProduct } from "@/lib/shop/types";

type ProductWithStock = Pick<StorefrontProduct, "stock">;

export function getProductAvailableStock(product: ProductWithStock | null | undefined) {
  const rawStock = Number(product?.stock ?? 0);

  if (!Number.isFinite(rawStock)) {
    return 0;
  }

  return Math.max(0, Math.floor(rawStock));
}

export function isProductOutOfStock(product: ProductWithStock | null | undefined) {
  return getProductAvailableStock(product) <= 0;
}

export function clampCartQuantityToStock(
  product: ProductWithStock | null | undefined,
  quantity: number
) {
  const normalizedQuantity = Math.max(1, Math.round(quantity));
  const availableStock = getProductAvailableStock(product);

  if (availableStock <= 0) {
    return 1;
  }

  return Math.min(availableStock, normalizedQuantity);
}

export function isCartEntryPayable(product: ProductWithStock | null | undefined) {
  return getProductAvailableStock(product) > 0;
}
