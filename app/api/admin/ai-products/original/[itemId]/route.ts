import { NextResponse } from "next/server";

import { getAiOriginalImageResponse } from "@/lib/server/admin/ai-products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { itemId } = await params;
    const blob = await getAiOriginalImageResponse(itemId);

    if (!blob?.stream) {
      return NextResponse.json({ success: false, error: "Imagen original no encontrada" }, { status: 404 });
    }

    return new NextResponse(blob.stream as ReadableStream, {
      headers: {
        "Content-Type": blob.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[admin/ai-products/original] failed:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo abrir la imagen original" },
      { status: 500 }
    );
  }
}
