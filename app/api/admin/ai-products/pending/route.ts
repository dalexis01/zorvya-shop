import { NextResponse } from "next/server";

import { listAiPendingProducts } from "@/lib/server/admin/ai-products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireAdminRequestUser();
  if (!auth.user) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const items = await listAiPendingProducts();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[admin/ai-products/pending] failed:", error);
    return NextResponse.json(
      { success: false, error: "No se pudieron cargar los productos IA pendientes" },
      { status: 500 }
    );
  }
}
