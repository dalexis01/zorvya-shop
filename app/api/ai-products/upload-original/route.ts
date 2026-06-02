import { NextResponse } from "next/server";

import { isValidAiAdminSecret } from "@/lib/server/admin/ai-secret";
import { uploadAiOriginalImage } from "@/lib/server/admin/ai-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = isValidAiAdminSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let itemId = "";
    let sourceUrl = "";
    let originalTelegramImageUrl = "";
    let originalSlackImageUrl = "";
    let filename = "";
    let body: ArrayBuffer | undefined;

    if (contentType.includes("application/json")) {
      const payload = (await request.json()) as Record<string, unknown>;
      itemId = String(payload.itemId ?? "");
      sourceUrl = typeof payload.sourceUrl === "string" ? payload.sourceUrl : "";
      originalTelegramImageUrl =
        typeof payload.originalTelegramImageUrl === "string"
          ? payload.originalTelegramImageUrl
          : "";
      originalSlackImageUrl =
        typeof payload.originalSlackImageUrl === "string" ? payload.originalSlackImageUrl : "";
      filename = typeof payload.filename === "string" ? payload.filename : "";
    } else {
      const url = new URL(request.url);
      itemId = url.searchParams.get("itemId") ?? "";
      sourceUrl = url.searchParams.get("sourceUrl") ?? "";
      originalTelegramImageUrl = url.searchParams.get("originalTelegramImageUrl") ?? "";
      originalSlackImageUrl = url.searchParams.get("originalSlackImageUrl") ?? "";
      filename = url.searchParams.get("filename") ?? "";
      body = await request.arrayBuffer();
    }

    if (!itemId.trim()) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    const result = await uploadAiOriginalImage({
      itemId,
      sourceUrl: sourceUrl || undefined,
      contentType: contentType && !contentType.includes("application/json") ? contentType : undefined,
      filename: filename || undefined,
      body,
      originalTelegramImageUrl: originalTelegramImageUrl || undefined,
      originalSlackImageUrl: originalSlackImageUrl || undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[ai-products/upload-original] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "No se pudo subir imagen original",
      },
      { status: 500 }
    );
  }
}
