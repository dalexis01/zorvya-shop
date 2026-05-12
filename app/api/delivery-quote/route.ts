import { NextRequest, NextResponse } from "next/server";

import { resolveDeliveryQuote } from "@/lib/server/delivery-quote";
import type { Locale } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

function isLocale(value: string | null): value is Locale {
  return value === "es" || value === "nl" || value === "en" || value === "pt";
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
  const localeParam = request.nextUrl.searchParams.get("locale");
  const subtotal = Number(request.nextUrl.searchParams.get("subtotal") ?? "0");
  const locale: Locale = isLocale(localeParam) ? localeParam : "es";

  if (address.length < 5) {
    return NextResponse.json(
      {
        distanceKm: 0,
        durationMinutes: null,
        fee: 0,
        isFree: false,
        allowsDelivery: false,
        isValidSurinameAddress: false,
        requiresAgentReview: false,
        freeDeliveryMinimum: null,
        source: "estimate",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const quote = await resolveDeliveryQuote({
    address,
    subtotal: Number.isFinite(subtotal) ? subtotal : 0,
    locale,
  });

  return NextResponse.json(quote, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
