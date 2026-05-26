import { NextResponse } from "next/server";

import { isValidAiAdminSecret } from "@/lib/server/admin/ai-secret";
import { publishAiProduct } from "@/lib/server/admin/ai-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const auth = isValidAiAdminSecret(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const itemId = String(body.itemId ?? "");

    if (!itemId.trim()) {
      return NextResponse.json({ success: false, error: "itemId requerido" }, { status: 400 });
    }

    const product = await publishAiProduct(itemId, "ai:publish");
    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("[ai-products/publish] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo publicar producto IA" },
      { status: 500 }
    );
  }
}
