import "server-only";

export function buildOrderItemMediaProxyUrl(
  orderId: string,
  itemIndex: number,
  updatedAt?: string
) {
  const params = new URLSearchParams();

  if (updatedAt) {
    params.set("v", updatedAt);
  }

  const query = params.toString();
  return `/api/orders/${encodeURIComponent(orderId)}/items/${itemIndex}/image${
    query ? `?${query}` : ""
  }`;
}
