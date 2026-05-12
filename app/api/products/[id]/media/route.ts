import { getStorefrontProductMediaSource } from "@/lib/server/catalog";

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

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const key = searchParams.get("key");

  const source = await getStorefrontProductMediaSource(id, kind, key);

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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
