import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { loadOrderByIdFromStore } from "@/lib/server/orders-store";
import { getCurrentUser } from "@/lib/server/session";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);

function decodeDataUrl(value: string) {
  const normalized = value.trim();

  if (!normalized.startsWith("data:")) {
    return null;
  }

  const separatorIndex = normalized.indexOf(",");

  if (separatorIndex === -1) {
    return null;
  }

  const header = normalized.slice(5, separatorIndex);
  const payload = normalized.slice(separatorIndex + 1);
  const mimeType = header.split(";")[0] || "application/octet-stream";

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    return null;
  }

  const isBase64 = header.includes(";base64");

  try {
    const body = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");

    return { body, mimeType };
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: RouteContext<"/api/orders/[orderId]/items/[itemIndex]/image">
) {
  const [{ orderId, itemIndex }, currentUser, adminAuth] = await Promise.all([
    context.params,
    getCurrentUser(),
    requireAdminRequestUser(),
  ]);

  if (!currentUser && !adminAuth.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const order = await loadOrderByIdFromStore(orderId);

  if (!order) {
    return new Response("Not found", { status: 404 });
  }

  if (!adminAuth.user && order.userId !== currentUser?.id) {
    return new Response("Forbidden", { status: 403 });
  }

  const normalizedIndex = Number(itemIndex);

  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
    return new Response("Invalid image", { status: 400 });
  }

  const source = order.items[normalizedIndex]?.image?.trim();

  if (!source) {
    return new Response("Not found", { status: 404 });
  }

  if (!source.startsWith("data:")) {
    return Response.redirect(new URL(source, request.url), 307);
  }

  const decoded = decodeDataUrl(source);

  if (!decoded) {
    return new Response("Invalid image", { status: 400 });
  }

  return new Response(decoded.body, {
    status: 200,
    headers: {
      "Content-Type": decoded.mimeType,
      "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
