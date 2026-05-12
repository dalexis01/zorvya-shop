import { NextResponse } from "next/server";

import {
  extractDeliveryHouseNumber,
  getDeliveryAddressSuggestions,
  injectHouseNumberIntoSuggestion,
  normalizeDeliveryAddress,
} from "@/helpers/delivery";
import { searchGoogleAddressSuggestions } from "@/lib/server/delivery-quote";
import type { Locale } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

const SURINAME_VIEWBOX = "-58.086,6.004,-53.977,1.831";
const SURINAME_HINTS = ["suriname", "surinam", "paramaribo", "wanica", "commewijne", "para"];
const ACCEPT_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  es: "es,en",
  nl: "nl,en",
  en: "en",
  pt: "pt,en",
};

function isLocale(value: string | null): value is Locale {
  return value === "es" || value === "nl" || value === "en" || value === "pt";
}

type NominatimResult = {
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    country?: string;
    country_code?: string;
  };
};

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildQueryVariants(query: string) {
  const normalized = query.trim().toLowerCase();
  const variants = [query.trim()];
  const hasSurinameHint = SURINAME_HINTS.some((hint) => normalized.includes(hint));

  if (!hasSurinameHint) {
    variants.push(`${query.trim()}, Suriname`);
    variants.push(`${query.trim()}, Paramaribo, Suriname`);
  } else if (!normalized.includes("suriname") && !normalized.includes("surinam")) {
    variants.push(`${query.trim()}, Suriname`);
  }

  return uniq(variants);
}

function formatNominatimAddress(result: NominatimResult) {
  const road = result.address?.road?.trim() ?? "";
  const houseNumber = result.address?.house_number?.trim() ?? "";
  const suburb =
    result.address?.suburb?.trim() ||
    result.address?.city?.trim() ||
    result.address?.town?.trim() ||
    result.address?.municipality?.trim() ||
    "";
  const country = result.address?.country?.trim() || "Suriname";

  const primary = [road, houseNumber].filter(Boolean).join(" ").trim();

  return [primary || result.display_name?.trim() || "", suburb, country]
    .filter(Boolean)
    .join(", ");
}

function scoreSuggestion(address: string, query: string, requestedHouseNumber: string) {
  const normalizedAddress = normalizeDeliveryAddress(address);
  const normalizedQuery = normalizeDeliveryAddress(query);
  const queryTokens = normalizedQuery.split(/[\s,.-]+/g).filter(Boolean);
  const addressTokens = normalizedAddress.split(/[\s,.-]+/g).filter(Boolean);
  let score = 0;

  if (normalizedAddress === normalizedQuery) {
    score += 520;
  } else if (normalizedAddress.startsWith(normalizedQuery)) {
    score += 300;
  } else if (normalizedAddress.includes(normalizedQuery)) {
    score += 180;
  }

  score +=
    queryTokens.filter((queryToken) =>
      addressTokens.some(
        (addressToken) =>
          addressToken.startsWith(queryToken) || addressToken.includes(queryToken)
      )
    ).length * 35;

  if (requestedHouseNumber && normalizedAddress.includes(normalizeDeliveryAddress(requestedHouseNumber))) {
    score += 240;
  }

  return score;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const localeParam = searchParams.get("locale");
  const locale: Locale = isLocale(localeParam) ? localeParam : "es";

  if (query.length < 2) {
    return NextResponse.json({
      success: true,
      suggestions: [],
    });
  }

  const fallbackSuggestions = getDeliveryAddressSuggestions(query, 8);
  const requestedHouseNumber = extractDeliveryHouseNumber(query);

  try {
    const googleSuggestions = await searchGoogleAddressSuggestions({
      query,
      locale,
      maxResults: 8,
    });
    const googleSuggestionsWithHouseNumber = uniq(
      googleSuggestions.flatMap((suggestion) => {
        if (
          !requestedHouseNumber ||
          normalizeDeliveryAddress(suggestion).includes(
            normalizeDeliveryAddress(requestedHouseNumber)
          )
        ) {
          return [suggestion];
        }

        return [injectHouseNumberIntoSuggestion(suggestion, requestedHouseNumber), suggestion];
      })
    );
    const queryVariants = buildQueryVariants(query);
    const responses = await Promise.all(
      queryVariants.map((variant) =>
        fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=sr&limit=8&dedupe=1&bounded=1&viewbox=${encodeURIComponent(
            SURINAME_VIEWBOX
          )}&q=${encodeURIComponent(variant)}`,
          {
            headers: {
              "Accept-Language": ACCEPT_LANGUAGE_BY_LOCALE[locale] ?? ACCEPT_LANGUAGE_BY_LOCALE.es,
              "User-Agent": "ZorvyaShop/1.0 (address-search)",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(3500),
          }
        )
      )
    );

    const resultsArrays = await Promise.all(
      responses.map(async (response) => {
        if (!response.ok) {
          return [] as NominatimResult[];
        }

        return (await response.json()) as NominatimResult[];
      })
    );

    const results = resultsArrays.flat();
    const remoteSuggestions = Array.from(
      results
        .filter((result) => result.address?.country_code?.toLowerCase() === "sr")
        .reduce((map, result) => {
          const formattedAddress = formatNominatimAddress(result);

          if (!formattedAddress) {
            return map;
          }

          const score = scoreSuggestion(formattedAddress, query, requestedHouseNumber);
          const currentScore = map.get(formattedAddress) ?? 0;

          if (score > currentScore) {
            map.set(formattedAddress, score);
          }

          if (requestedHouseNumber && !result.address?.house_number) {
            const suggestionWithHouseNumber = injectHouseNumberIntoSuggestion(
              formattedAddress,
              requestedHouseNumber
            );
            const boostedScore = scoreSuggestion(
              suggestionWithHouseNumber,
              query,
              requestedHouseNumber
            );
            const currentBoostedScore = map.get(suggestionWithHouseNumber) ?? 0;

            if (boostedScore > currentBoostedScore) {
              map.set(suggestionWithHouseNumber, boostedScore);
            }
          }

          return map;
        }, new Map<string, number>())
        .entries()
    )
      .sort((left, right) => {
        if (left[1] !== right[1]) {
          return right[1] - left[1];
        }

        return left[0].localeCompare(right[0]);
      })
      .map(([address]) => address);

    return NextResponse.json({
      success: true,
      suggestions: uniq([
        ...googleSuggestionsWithHouseNumber,
        ...remoteSuggestions,
        ...fallbackSuggestions,
      ]).slice(0, 8),
    });
  } catch {
    return NextResponse.json({
      success: true,
      suggestions: fallbackSuggestions,
    });
  }
}
