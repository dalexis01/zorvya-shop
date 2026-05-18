import { NextResponse } from "next/server";

import {
  getStorefrontProducts,
  getStorefrontProductsDebugInfo,
} from "@/lib/server/catalog";

export const revalidate = 60;

export async function GET() {
  try {
    const products = await getStorefrontProducts();
    const info = await getStorefrontProductsDebugInfo();

    console.info(
      `[api/products] returning ${info.count} product(s) from ${info.source}`
    );

    return NextResponse.json({
      success: true,
      products,
      meta: info,
    });
  } catch (error) {
    console.error("Failed to load storefront products:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron cargar los productos.",
      },
      { status: 500 }
    );
  }
}
