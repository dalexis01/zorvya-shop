import { NextRequest, NextResponse } from "next/server";

import { reverseGeocodeCoordinates } from "@/lib/server/delivery-quote";
import type { Locale } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

function isLocale(value: string | null): value is Locale {
  return value === "es" || value === "nl" || value === "en" || value === "pt";
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get("latitude") ?? "0");
  const longitude = Number(request.nextUrl.searchParams.get("longitude") ?? "0");
  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale: Locale = isLocale(localeParam) ? localeParam : "es";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Coordenadas invalidas.",
      },
      { status: 400 }
    );
  }

  const resolved = await reverseGeocodeCoordinates({
    latitude,
    longitude,
    locale,
  });

  if (!resolved?.address) {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo resolver la direccion.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    address: resolved.address,
    source: resolved.source,
  });
}
