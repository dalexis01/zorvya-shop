import { NextRequest, NextResponse } from "next/server";

import { getProductById } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { formatCurrencySrd } from "@/lib/shop/number-format";

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

  const results = await Promise.allSettled(ids.map((id) => getProductById(id)));

  const entries: ProductAccountingEntry[] = results
    .map((result, i) => {
      if (result.status === "rejected" || !result.value) return null;
      const product = result.value;
      return {
        productId: ids[i],
        name: product.name,
        supplier: product.internal.supplier ?? "",
        supplierPhone: product.internal.supplierPhone ?? "",
        costPrice: product.internal.costPrice ?? 0,
        purchasePrice: product.internal.purchasePrice ?? 0,
        shippingFee: product.internal.shippingFee ?? 0,
        internalCode: product.internal.internalCode ?? "",
        internalNotes: product.internal.internalNotes ?? "",
      } satisfies ProductAccountingEntry;
    })
    .filter((e): e is ProductAccountingEntry => e !== null);

  return NextResponse.json({ success: true, entries });
}
