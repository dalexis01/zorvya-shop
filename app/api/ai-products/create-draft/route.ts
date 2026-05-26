import { NextResponse } from "next/server";

import { createAiProductDraft } from "@/lib/server/admin/ai-products";
import { isValidAiAdminSecret } from "@/lib/server/admin/ai-secret";

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
    const result = await createAiProductDraft({
      batchId: typeof body.batchId === "string" ? body.batchId : undefined,
      batchName: typeof body.batchName === "string" ? body.batchName : undefined,
      batchSource: typeof body.batchSource === "string" ? body.batchSource : undefined,
      batchMetadata:
        body.batchMetadata && typeof body.batchMetadata === "object"
          ? (body.batchMetadata as Record<string, unknown>)
          : undefined,
      supplierId: typeof body.supplierId === "string" ? body.supplierId : undefined,
      title: String(body.title ?? ""),
      description: typeof body.description === "string" ? body.description : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((tag) => String(tag)) : undefined,
      priceSrd: Number(body.priceSrd ?? 0),
      costUsd: Number(body.costUsd ?? 0),
      stock: Number(body.stock ?? 0),
      stockCode: typeof body.stockCode === "string" ? body.stockCode : undefined,
      brand: typeof body.brand === "string" ? body.brand : undefined,
      sku: typeof body.sku === "string" ? body.sku : undefined,
      publicImageUrl:
        typeof body.publicImageUrl === "string" ? body.publicImageUrl : undefined,
      originalSlackImageUrl:
        typeof body.originalSlackImageUrl === "string"
          ? body.originalSlackImageUrl
          : undefined,
      confidenceScore:
        body.aiConfidenceScore === null || body.aiConfidenceScore === undefined
          ? null
          : Number(body.aiConfidenceScore),
      attributes:
        body.attributes && typeof body.attributes === "object"
          ? Object.fromEntries(
              Object.entries(body.attributes as Record<string, unknown>).map(([key, value]) => [
                key,
                String(value),
              ])
            )
          : undefined,
      inventoryLabel:
        typeof body.inventoryLabel === "string" ? body.inventoryLabel : undefined,
      deliveryLabel:
        typeof body.deliveryLabel === "string" ? body.deliveryLabel : undefined,
      longDescription:
        typeof body.longDescription === "string" ? body.longDescription : undefined,
      shortDescription:
        typeof body.shortDescription === "string" ? body.shortDescription : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[ai-products/create-draft] failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo crear draft IA" },
      { status: 500 }
    );
  }
}
