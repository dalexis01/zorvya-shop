import type { ProductIdentifier, StorefrontProduct } from "@/lib/shop/types";

export const CART_STORAGE_KEY = "zorvya-cart-v4";
export const CART_SELECTION_STORAGE_KEY = "zorvya-cart-selection-v1";

export interface StoredCartEntry {
  cartKey: string;
  productId: ProductIdentifier;
  quantity: number;
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedColor?: string;
  unitPrice?: number;
  selectedImage?: string;
}

export interface HydratedCartEntry {
  cartKey: string;
  product: StorefrontProduct;
  quantity: number;
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedColor?: string;
  unitPrice?: number;
  selectedImage?: string;
}

function isValidStoredEntry(value: unknown): value is StoredCartEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  const hasProductId =
    (typeof entry.productId === "string" && entry.productId.trim().length > 0) ||
    typeof entry.productId === "number";

  return (
    hasProductId &&
    Number.isInteger(entry.quantity) &&
    Number(entry.quantity) > 0 &&
    typeof entry.cartKey === "string" &&
    entry.cartKey.trim().length > 0
  );
}

function isLegacyEntry(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    entry.product &&
    typeof entry.product === "object" &&
    Number.isInteger(entry.quantity) &&
    Number(entry.quantity) > 0
  );
}

export function readStoredCart(): StoredCartEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY) ?? window.localStorage.getItem("zorvya-cart-v3");

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedEntries: StoredCartEntry[] = [];

    for (const entry of parsed) {
      if (isValidStoredEntry(entry)) {
        normalizedEntries.push({
          cartKey: entry.cartKey,
          productId: entry.productId,
          quantity: Number(entry.quantity),
          selectedVariantId:
            typeof entry.selectedVariantId === "string" ? entry.selectedVariantId : undefined,
          selectedVariantName:
            typeof entry.selectedVariantName === "string"
              ? entry.selectedVariantName
              : undefined,
          selectedColor:
            typeof entry.selectedColor === "string" ? entry.selectedColor : undefined,
          unitPrice: Number.isFinite(entry.unitPrice) ? Number(entry.unitPrice) : undefined,
          selectedImage:
            typeof entry.selectedImage === "string" ? entry.selectedImage : undefined,
        });
        continue;
      }

      if (isLegacyEntry(entry)) {
        const legacyProduct = (entry as { product: { id?: ProductIdentifier } }).product;

        if (legacyProduct?.id !== undefined) {
          normalizedEntries.push({
            cartKey: String(legacyProduct.id),
            productId: legacyProduct.id,
            quantity: Number((entry as { quantity: number }).quantity),
          });
        }
      }
    }

    return normalizedEntries;
  } catch {
    return [];
  }
}

export function readStoredCartSelection(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CART_SELECTION_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  } catch {
    return null;
  }
}

export function writeStoredCart(entries: StoredCartEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(
    entries
      .filter((entry) => entry.quantity > 0)
      .map((entry) => ({
        cartKey: entry.cartKey,
        productId: entry.productId,
        quantity: entry.quantity,
        selectedVariantId: entry.selectedVariantId,
        selectedVariantName: entry.selectedVariantName,
        selectedColor: entry.selectedColor,
        unitPrice: entry.unitPrice,
        selectedImage: entry.selectedImage,
      }))
  );

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, payload);
    window.localStorage.removeItem("zorvya-cart-v3");
  } catch {
    try {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      window.localStorage.removeItem("zorvya-cart-v3");
      window.localStorage.setItem(CART_STORAGE_KEY, payload);
    } catch {
      return;
    }
  }
}

export function writeStoredCartSelection(keys: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(
    keys.filter((key) => typeof key === "string" && key.trim().length > 0)
  );

  try {
    window.localStorage.setItem(CART_SELECTION_STORAGE_KEY, payload);
  } catch {
    try {
      window.localStorage.removeItem(CART_SELECTION_STORAGE_KEY);
      window.localStorage.setItem(CART_SELECTION_STORAGE_KEY, payload);
    } catch {
      return;
    }
  }
}

export function hydrateStoredCart(
  entries: StoredCartEntry[],
  products: StorefrontProduct[]
): HydratedCartEntry[] {
  const hydratedEntries: HydratedCartEntry[] = [];

  for (const entry of entries) {
    const product = products.find((item) => String(item.id) === String(entry.productId));

    if (!product) {
      continue;
    }

    hydratedEntries.push({
      cartKey: entry.cartKey,
      product,
      quantity: entry.quantity,
      selectedVariantId: entry.selectedVariantId,
      selectedVariantName: entry.selectedVariantName,
      selectedColor: entry.selectedColor,
      unitPrice: entry.unitPrice,
      selectedImage: entry.selectedImage,
    });
  }

  return hydratedEntries;
}

export function toStoredCart(entries: HydratedCartEntry[]): StoredCartEntry[] {
  return entries
    .filter((entry) => entry.quantity > 0)
    .map((entry) => ({
      cartKey: entry.cartKey,
      productId: entry.product.id,
      quantity: entry.quantity,
      selectedVariantId: entry.selectedVariantId,
      selectedVariantName: entry.selectedVariantName,
      selectedColor: entry.selectedColor,
      unitPrice: entry.unitPrice,
      selectedImage: entry.selectedImage,
    }));
}
