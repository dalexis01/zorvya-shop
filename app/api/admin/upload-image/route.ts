import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { success: false, error: "BLOB_READ_WRITE_TOKEN no configurado." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ success: false, error: "filename requerido" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "image/jpeg";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ success: false, error: "Tipo de imagen no permitido" }, { status: 400 });
  }

  try {
    if (!request.body) {
      return NextResponse.json({ success: false, error: "Body vacío" }, { status: 400 });
    }

    const blob = await put(`products/${filename}`, request.body, {
      access: "public",
      contentType,
    });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error("[upload-image] failed:", err);
    return NextResponse.json({ success: false, error: "Error al subir imagen" }, { status: 500 });
  }
}
