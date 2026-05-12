import { NextResponse } from "next/server";

import { getStorefrontProducts } from "@/lib/server/catalog";

export const revalidate = 60;

export async function GET() {
  try {
    const products = await getStorefrontProducts();

    return NextResponse.json({
      success: true,
      products,
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
