import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const ALLOWED_MIME = new Set(Object.keys(MIME_TO_EXT));
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { success: false, error: "BLOB_READ_WRITE_TOKEN no configurado. Crea un Blob store en Vercel y agrega la variable." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { dataUrl?: string; filename?: string };
    const { dataUrl, filename } = body;

    if (!dataUrl?.startsWith("data:")) {
      return NextResponse.json({ success: false, error: "Se esperaba un data URL" }, { status: 400 });
    }

    const separatorIndex = dataUrl.indexOf(",");
    if (separatorIndex === -1) {
      return NextResponse.json({ success: false, error: "Data URL malformado" }, { status: 400 });
    }

    const header = dataUrl.slice(5, separatorIndex);
    const mimeType = header.split(";")[0] ?? "image/jpeg";

    if (!ALLOWED_MIME.has(mimeType)) {
      return NextResponse.json({ success: false, error: "Tipo de imagen no permitido" }, { status: 400 });
    }

    const base64 = dataUrl.slice(separatorIndex + 1);
    const buffer = Buffer.from(base64, "base64");

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `Imagen demasiado grande (max 8 MB)` },
        { status: 413 }
      );
    }

    const ext = MIME_TO_EXT[mimeType] ?? "jpg";
    const name = filename ?? `img-${Date.now()}.${ext}`;

    const blob = await put(`products/${name}`, buffer, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: true,
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error("[upload-image] failed:", err);
    return NextResponse.json({ success: false, error: "Error al subir imagen" }, { status: 500 });
  }
}
