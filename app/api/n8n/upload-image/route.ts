import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

function sanitizeFilename(filename: string): string {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getExtensionFromContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/jpg":
    case "image/jpeg":
    default:
      return ".jpg";
  }
}

function ensureExtension(filename: string, contentType: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) {
    return filename;
  }

  return `${filename}${getExtensionFromContentType(contentType)}`;
}

function buildUploadPath(filename: string): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `n8n/originals/${year}/${month}/${unique}-${filename}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = request.headers.get("x-zorvya-ai-secret")?.trim() ?? "";
  const expectedSecret = process.env.N8N_SECRET?.trim() || process.env.ZORVYA_ADMIN_API_SECRET?.trim() || "";

  if (!expectedSecret) {
    return jsonError("N8N_SECRET no configurado.", 503);
  }

  if (!secret || secret !== expectedSecret) {
    return jsonError("No autorizado.", 401);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return jsonError("BLOB_READ_WRITE_TOKEN no configurado.", 503);
  }

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return jsonError("Tipo de imagen no permitido. Usa jpg, png o webp.", 400);
  }

  const url = new URL(request.url);
  const requestedFilename =
    url.searchParams.get("filename") ??
    request.headers.get("x-file-name") ??
    request.headers.get("x-filename") ??
    "upload";

  const sanitizedFilename = ensureExtension(sanitizeFilename(requestedFilename) || "upload", contentType);

  const arrayBuffer = await request.arrayBuffer();
  if (!arrayBuffer.byteLength) {
    return jsonError("Body vacio.", 400);
  }

  if (arrayBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return jsonError("Imagen demasiado grande. Maximo 20 MB.", 413);
  }

  try {
    const pathname = buildUploadPath(sanitizedFilename);
    const blob = await put(pathname, Buffer.from(arrayBuffer), {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
    });
  } catch (error) {
    console.error("[n8n-upload-image] failed:", error);
    return jsonError("Error al subir imagen.", 500);
  }
}
