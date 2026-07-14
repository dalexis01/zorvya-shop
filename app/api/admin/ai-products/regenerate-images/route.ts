import { NextResponse } from "next/server";

import { requestAiImageRegeneration } from "@/lib/server/admin/ai-products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAdminRequestUser({
    request,
    permission: "ai_products.manage",
  });
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as { itemId?: string };
    const itemId = String(body.itemId ?? "");
    if (!itemId.trim()) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    await requestAiImageRegeneration(itemId, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/ai-products/regenerate-images] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo solicitar regeneracion" },
      { status: 500 }
    );
  }
}
