import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

import { createStatusLog } from "@/lib/server/admin/logs";
import { createProduct } from "@/lib/server/admin/products";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getProductSummaries, getProductsDataSourceInfo } from "@/lib/server/admin/products";
import { STOREFRONT_PRODUCTS_TAG } from "@/lib/server/catalog";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to create product";
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const products = await getProductSummaries({ search });
    const info = await getProductsDataSourceInfo({ search });

    console.info(
      `[admin/products] loaded ${info.count} product(s) from ${info.source}`
    );

    return NextResponse.json({
      success: true,
      products,
      meta: info,
    });
  } catch (error) {
    console.error("Failed to get products:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get products",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const payload = await request.json();
    const product = await createProduct(payload, auth.user.id);

    await createStatusLog({
      type: "product",
      targetId: product.id,
      action: "created",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: [
        {
          field: "product_created",
          oldValue: null,
          newValue: product.name,
        },
      ],
    });
    revalidateTag(STOREFRONT_PRODUCTS_TAG, { expire: 0 });

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error: unknown) {
    console.error("Failed to create product:", error);

    const message = getErrorMessage(error);

    if (message === "SKU_ALREADY_EXISTS") {
      return NextResponse.json(
        {
          success: false,
          error: "SKU already exists",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
