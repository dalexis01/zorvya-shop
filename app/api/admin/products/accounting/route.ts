import { NextRequest, NextResponse } from "next/server";

import { getProductAccountingEntriesByIds } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export type ProductAccountingEntry = {
  productId: string;
  name: string;
  supplier: string;
  supplierPhone: string;
  costPrice: number;
  purchasePrice: number;
  shippingFee: number;
  internalCode: string;
  internalNotes: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminRequestUser();

  if (!auth.user) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productIds = (body as { productIds?: unknown }).productIds;

  if (!Array.isArray(productIds)) {
    return NextResponse.json({ error: "productIds array required" }, { status: 400 });
  }

  const ids = productIds
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .slice(0, 50);

  const entries = (await getProductAccountingEntriesByIds(ids)) satisfies ProductAccountingEntry[];

  return NextResponse.json({ success: true, entries });
}
