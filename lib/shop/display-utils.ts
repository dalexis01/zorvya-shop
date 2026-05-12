export function createStars(rating: number): string {
  const full = Math.max(1, Math.min(5, Math.round(rating || 0)));
  return "★".repeat(full).padEnd(5, "☆");
}

export function buildCartKey(
  productId: string | number,
  variantId?: string,
  color?: string
): string {
  return [
    String(productId),
    variantId?.trim() || "base",
    color?.trim().toLowerCase() || "default",
  ].join("::");
}
