import { NextResponse } from "next/server";

import {
  getStorefrontProducts,
  getStorefrontProductsDebugInfo,
} from "@/lib/server/catalog";
import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";

export const revalidate = 300;

export async function GET() {
  try {
    console.log("[api-metrics] products route called");
    const products = await getStorefrontProducts();
    const info = await getStorefrontProductsDebugInfo();
    const payload = {
      success: true,
      products,
      meta: info,
    };

    console.info(
      `[api/products] returning ${info.count} product(s) from ${info.source}`
    );
    console.log("[api-metrics] products payload", {
      count: products?.length ?? 0,
      kb: Math.round(JSON.stringify(products).length / 1024),
    });
    logApiResponseMetrics({
      endpoint: "/api/products",
      payload,
      rowCount: products.length,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
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
