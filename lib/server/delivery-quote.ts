import "server-only";

import {
  assessDeliveryAddress,
  calculateDeliveryFee,
  extractDeliveryHouseNumber,
  injectHouseNumberIntoSuggestion,
  MAX_DELIVERY_DISTANCE_KM,
  normalizeDeliveryAddress,
  STORE_ADDRESS,
  STORE_COORDINATES,
} from "@/helpers/delivery";
import type { Locale } from "@/lib/shop/types";

type GoogleRouteResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    routeLabels?: string[];
  }>;
};

type GoogleGeocodeResponse = {
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
  }>;
  status?: string;
};

type GoogleAddressComponent = {
  long_name?: string;
  short_name?: string;
  types?: string[];
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

type OsrmRouteResponse = {
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
};

type ResolvedCoordinate = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  hasHouseNumber: boolean;
  source: "google" | "osm" | "fallback";
};

export type ResolvedDeliveryQuote = {
  distanceKm: number;
  durationMinutes: number | null;
  fee: number;
  isFree: boolean;
  allowsDelivery: boolean;
  isValidSurinameAddress: boolean;
  requiresAgentReview: boolean;
  freeDeliveryMinimum: number | null;
  source: "google" | "osm" | "estimate";
};

const MAP_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  es: "es-419",
  nl: "nl",
  en: "en",
  pt: "pt-BR",
};

const OSM_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  es: "es,en",
  nl: "nl,en",
  en: "en",
  pt: "pt,en",
};

const SURINAME_VIEWBOX = "-58.086,6.004,-53.977,1.831";
const SURINAME_HINTS = ["suriname", "surinam", "paramaribo", "wanica", "commewijne", "para"];

let cachedStoreCoordinatesPromise: Promise<ResolvedCoordinate> | null = null;

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseDurationMinutes(duration: string | undefined) {
  if (!duration) {
    return null;
  }

  const matchedSeconds = /^(\d+)s$/.exec(duration.trim());

  if (!matchedSeconds) {
    return null;
  }

  const seconds = Number(matchedSeconds[1]);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }

  return Math.max(1, Math.round(seconds / 60));
}

function parseOsrmDurationMinutes(durationSeconds: number | undefined) {
  if (!Number.isFinite(durationSeconds) || !durationSeconds || durationSeconds <= 0) {
    return null;
  }

  return Math.max(1, Math.round(durationSeconds / 60));
}

function buildQueryVariants(address: string) {
  const trimmedAddress = address.trim();
  const normalizedAddress = normalizeDeliveryAddress(trimmedAddress);
  const hasSurinameHint = SURINAME_HINTS.some((hint) => normalizedAddress.includes(hint));
  const variants = [trimmedAddress];

  if (!hasSurinameHint) {
    variants.push(`${trimmedAddress}, Suriname`);
    variants.push(`${trimmedAddress}, Paramaribo, Suriname`);
  } else if (!normalizedAddress.includes("suriname") && !normalizedAddress.includes("surinam")) {
    variants.push(`${trimmedAddress}, Suriname`);
  }

  return uniq(variants);
}

function getGeocodingApiKey() {
  return (
    process.env.GOOGLE_MAPS_GEOCODING_API_KEY ??
    process.env.GOOGLE_MAPS_ROUTES_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    ""
  );
}

function getRoutesApiKey() {
  return process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
}

function getPlacesApiKey() {
  return process.env.GOOGLE_MAPS_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
}

function hasCountryComponent(
  components: GoogleAddressComponent[] | undefined,
  expectedCountryCode: string
) {
  return (
    components?.some(
      (component) =>
        component.types?.includes("country") &&
        component.short_name?.toLowerCase() === expectedCountryCode.toLowerCase()
    ) ?? false
  );
}

function hasStreetNumberComponent(
  components: GoogleAddressComponent[] | undefined,
  requestedHouseNumber: string
) {
  if (!requestedHouseNumber) {
    return false;
  }

  return (
    components?.some(
      (component) =>
        component.types?.includes("street_number") &&
        normalizeDeliveryAddress(component.long_name ?? "") ===
          normalizeDeliveryAddress(requestedHouseNumber)
    ) ?? false
  );
}

function formatNominatimAddress(result: NominatimResult) {
  const road = result.address?.road?.trim() ?? "";
  const houseNumber = result.address?.house_number?.trim() ?? "";
  const locality =
    result.address?.suburb?.trim() ||
    result.address?.city?.trim() ||
    result.address?.town?.trim() ||
    result.address?.municipality?.trim() ||
    result.address?.state?.trim() ||
    "";
  const country = result.address?.country?.trim() || "Suriname";

  const primary = [road, houseNumber].filter(Boolean).join(" ").trim();

  return [primary || result.display_name?.trim() || "", locality, country]
    .filter(Boolean)
    .join(", ");
}

function scoreFormattedAddressMatch(formattedAddress: string, query: string, houseNumber: string) {
  const normalizedFormattedAddress = normalizeDeliveryAddress(formattedAddress);
  const normalizedQuery = normalizeDeliveryAddress(query);
  let score = 0;

  if (normalizedFormattedAddress === normalizedQuery) {
    score += 600;
  } else if (normalizedFormattedAddress.startsWith(normalizedQuery)) {
    score += 320;
  } else if (normalizedFormattedAddress.includes(normalizedQuery)) {
    score += 180;
  }

  const queryTokens = normalizedQuery.split(/[\s,.-]+/g).filter(Boolean);
  const addressTokens = normalizedFormattedAddress.split(/[\s,.-]+/g).filter(Boolean);

  score +=
    queryTokens.filter((queryToken) =>
      addressTokens.some(
        (addressToken) =>
          addressToken.startsWith(queryToken) || addressToken.includes(queryToken)
      )
    ).length * 40;

  if (houseNumber && normalizedFormattedAddress.includes(normalizeDeliveryAddress(houseNumber))) {
    score += 240;
  }

  return score;
}

async function geocodeWithGoogle(address: string, locale: Locale) {
  const apiKey = getGeocodingApiKey();

  if (!apiKey) {
    return null;
  }

  const requestedHouseNumber = extractDeliveryHouseNumber(address);

  try {
    const variants = buildQueryVariants(address);

    const responses = await Promise.all(
      variants.map((variant) =>
        fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            variant
          )}&region=sr&language=${encodeURIComponent(
            MAP_LANGUAGE_BY_LOCALE[locale] ?? MAP_LANGUAGE_BY_LOCALE.es
          )}&key=${encodeURIComponent(apiKey)}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
          }
        )
      )
    );

    const payloads = await Promise.all(
      responses.map(async (response) => {
        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as GoogleGeocodeResponse;

        if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
          console.warn(`[Geocode] Google status ${payload.status} for ${address}`);
        }

        return payload;
      })
    );

    const bestResult = payloads
      .flatMap((payload) => payload?.results ?? [])
      .filter((result) => hasCountryComponent(result.address_components, "SR"))
      .map((result) => {
        const latitude = result.geometry?.location?.lat;
        const longitude = result.geometry?.location?.lng;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        return {
          latitude: Number(latitude),
          longitude: Number(longitude),
          formattedAddress: result.formatted_address?.trim() || address.trim(),
          hasHouseNumber: hasStreetNumberComponent(result.address_components, requestedHouseNumber),
          score:
            scoreFormattedAddressMatch(
              result.formatted_address?.trim() || address.trim(),
              address,
              requestedHouseNumber
            ) +
            (hasStreetNumberComponent(result.address_components, requestedHouseNumber) ? 260 : 0),
        };
      })
      .filter(
        (
          result
        ): result is {
          latitude: number;
          longitude: number;
          formattedAddress: string;
          hasHouseNumber: boolean;
          score: number;
        } => Boolean(result)
      )
      .sort((left, right) => right.score - left.score)[0];

    if (!bestResult) {
      return null;
    }

    return {
      latitude: bestResult.latitude,
      longitude: bestResult.longitude,
      formattedAddress: bestResult.formattedAddress,
      hasHouseNumber: bestResult.hasHouseNumber,
      source: "google" as const,
    };
  } catch {
    return null;
  }
}

async function geocodeWithOsm(address: string, locale: Locale) {
  const requestedHouseNumber = extractDeliveryHouseNumber(address);

  try {
    const responses = await Promise.all(
      buildQueryVariants(address).map((variant) =>
        fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=sr&limit=6&dedupe=1&bounded=1&viewbox=${encodeURIComponent(
            SURINAME_VIEWBOX
          )}&q=${encodeURIComponent(variant)}`,
          {
            headers: {
              "Accept-Language": OSM_LANGUAGE_BY_LOCALE[locale] ?? OSM_LANGUAGE_BY_LOCALE.es,
              "User-Agent": "ZorvyaShop/1.0 (delivery-quote)",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
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

    const bestResult = resultsArrays
      .flat()
      .filter((result) => result.address?.country_code?.toLowerCase() === "sr")
      .map((result) => {
        const latitude = Number(result.lat);
        const longitude = Number(result.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const formattedAddress = formatNominatimAddress(result);

        return {
          latitude,
          longitude,
          formattedAddress,
          hasHouseNumber:
            Boolean(result.address?.house_number) &&
            normalizeDeliveryAddress(result.address?.house_number ?? "") ===
              normalizeDeliveryAddress(requestedHouseNumber),
          score:
            scoreFormattedAddressMatch(formattedAddress, address, requestedHouseNumber) +
            (result.address?.house_number ? 120 : 0),
        };
      })
      .filter(
        (
          result
        ): result is {
          latitude: number;
          longitude: number;
          formattedAddress: string;
          hasHouseNumber: boolean;
          score: number;
        } => Boolean(result)
      )
      .sort((left, right) => right.score - left.score)[0];

    if (!bestResult) {
      return null;
    }

    return {
      latitude: bestResult.latitude,
      longitude: bestResult.longitude,
      formattedAddress: bestResult.formattedAddress,
      hasHouseNumber: bestResult.hasHouseNumber,
      source: "osm" as const,
    };
  } catch {
    return null;
  }
}

async function resolveDestinationCoordinates(address: string, locale: Locale) {
  return (await geocodeWithGoogle(address, locale)) ?? (await geocodeWithOsm(address, locale));
}

async function resolveStoreCoordinates(locale: Locale): Promise<ResolvedCoordinate> {
  if (!cachedStoreCoordinatesPromise) {
    cachedStoreCoordinatesPromise = (async () => {
      const geocodedStore = await resolveDestinationCoordinates(STORE_ADDRESS, locale);

      if (geocodedStore) {
        return geocodedStore;
      }

      return {
        ...STORE_COORDINATES,
        formattedAddress: STORE_ADDRESS,
        hasHouseNumber: false,
        source: "fallback" as const,
      };
    })();
  }

  return cachedStoreCoordinatesPromise;
}

async function resolveGoogleRoute(
  origin: ResolvedCoordinate,
  destination: ResolvedCoordinate,
  locale: Locale
) {
  const apiKey = getRoutesApiKey();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.routeLabels",
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        travelMode: "DRIVE",
        // Use the same fastest-route style that Google Maps uses for near-term driving.
        routingPreference: "TRAFFIC_AWARE_OPTIMAL",
        computeAlternativeRoutes: true,
        languageCode: MAP_LANGUAGE_BY_LOCALE[locale] ?? MAP_LANGUAGE_BY_LOCALE.es,
        regionCode: "sr",
        units: "METRIC",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Routes] Google responded ${response.status}: ${errorText}`);
      throw new Error(`Routes API responded with ${response.status}`);
    }

    const payload = (await response.json()) as GoogleRouteResponse;
    const selectedRoute = [...(payload.routes ?? [])]
      .filter(
        (route): route is { distanceMeters: number; duration?: string; routeLabels?: string[] } =>
          typeof route.distanceMeters === "number" && route.distanceMeters > 0
      )
      .sort((left, right) => right.distanceMeters - left.distanceMeters)[0];

    if (!selectedRoute?.distanceMeters || selectedRoute.distanceMeters <= 0) {
      throw new Error("Missing Google route distance.");
    }

    return {
      distanceKm: Number((selectedRoute.distanceMeters / 1000).toFixed(1)),
      durationMinutes: parseDurationMinutes(selectedRoute.duration),
      source: "google" as const,
    };
  } catch {
    return null;
  }
}

async function resolveOsmRoute(origin: ResolvedCoordinate, destination: ResolvedCoordinate) {
  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`OSRM responded with ${response.status}`);
    }

    const payload = (await response.json()) as OsrmRouteResponse;
    const firstRoute = payload.routes?.[0];

    if (!firstRoute?.distance || firstRoute.distance <= 0) {
      throw new Error("Missing OSRM route distance.");
    }

    return {
      distanceKm: Number((firstRoute.distance / 1000).toFixed(1)),
      durationMinutes: parseOsrmDurationMinutes(firstRoute.duration),
      source: "osm" as const,
    };
  } catch {
    return null;
  }
}

type GoogleReverseGeocodeResponse = {
  results?: Array<{
    formatted_address?: string;
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
    types?: string[];
  }>;
  status?: string;
};

async function reverseGeocodeWithGoogle(
  latitude: number,
  longitude: number,
  locale: Locale
) {
  const apiKey = getGeocodingApiKey();

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
        `${latitude},${longitude}`
      )}&language=${encodeURIComponent(
        MAP_LANGUAGE_BY_LOCALE[locale] ?? MAP_LANGUAGE_BY_LOCALE.es
      )}&region=sr&key=${encodeURIComponent(apiKey)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as GoogleReverseGeocodeResponse;

    if (payload.status && payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
      console.warn(
        `[ReverseGeocode] Google status ${payload.status} for ${latitude},${longitude}`
      );
    }

    const preferredTypes = ["street_address", "premise", "subpremise", "route", "plus_code"];
    const bestResult = payload.results?.find(
      (result) =>
        hasCountryComponent(result.address_components, "SR") &&
        preferredTypes.some((type) => result.types?.includes(type))
    ) ?? payload.results?.find((result) => hasCountryComponent(result.address_components, "SR"));

    if (!bestResult?.formatted_address) {
      return null;
    }

    return {
      address: bestResult.formatted_address.trim(),
      source: "google" as const,
    };
  } catch {
    return null;
  }
}

type NominatimReverseResult = {
  display_name?: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

async function reverseGeocodeWithOsm(latitude: number, longitude: number, locale: Locale) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(
        String(latitude)
      )}&lon=${encodeURIComponent(String(longitude))}&zoom=18`,
      {
        headers: {
          "Accept-Language": OSM_LANGUAGE_BY_LOCALE[locale] ?? OSM_LANGUAGE_BY_LOCALE.es,
          "User-Agent": "ZorvyaShop/1.0 (reverse-geocode)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as NominatimReverseResult;

    if (payload.address?.country_code?.toLowerCase() !== "sr") {
      return null;
    }

    const formattedAddress = formatNominatimAddress({
      address: payload.address,
      display_name: payload.display_name,
    });

    if (!formattedAddress) {
      return null;
    }

    return {
      address: formattedAddress,
      source: "osm" as const,
    };
  } catch {
    return null;
  }
}

export async function reverseGeocodeCoordinates(input: {
  latitude: number;
  longitude: number;
  locale?: Locale;
}) {
  const locale = input.locale ?? "es";

  return (
    (await reverseGeocodeWithGoogle(input.latitude, input.longitude, locale)) ??
    (await reverseGeocodeWithOsm(input.latitude, input.longitude, locale))
  );
}

type GooglePlacesAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      text?: {
        text?: string;
      };
    };
    queryPrediction?: {
      text?: {
        text?: string;
      };
    };
  }>;
};

export async function searchGoogleAddressSuggestions(input: {
  query: string;
  locale?: Locale;
  maxResults?: number;
}) {
  const apiKey = getPlacesApiKey();

  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.text.text,suggestions.queryPrediction.text.text",
      },
      body: JSON.stringify({
        input: input.query,
        locationRestriction: {
          rectangle: {
            low: {
              latitude: 1.831,
              longitude: -58.086,
            },
            high: {
              latitude: 6.004,
              longitude: -53.977,
            },
          },
        },
        includedRegionCodes: ["sr"],
        languageCode: MAP_LANGUAGE_BY_LOCALE[input.locale ?? "es"] ?? MAP_LANGUAGE_BY_LOCALE.es,
        regionCode: "SR",
        includeQueryPredictions: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Places] Google responded ${response.status}: ${errorText}`);
    } else {
      const payload = (await response.json()) as GooglePlacesAutocompleteResponse;

      const placeSuggestions = uniq(
        (payload.suggestions ?? [])
          .map(
            (suggestion) =>
              suggestion.placePrediction?.text?.text?.trim() ??
              suggestion.queryPrediction?.text?.text?.trim() ??
              ""
          )
          .filter(Boolean)
      ).slice(0, input.maxResults ?? 8);

      if (placeSuggestions.length > 0) {
        return placeSuggestions;
      }
    }
  } catch {
    // Keep going with geocoding fallback below.
  }

  const geocodingApiKey = getGeocodingApiKey();

  if (!geocodingApiKey) {
    return [];
  }

  const requestedHouseNumber = extractDeliveryHouseNumber(input.query);

  try {
    const responses = await Promise.all(
      buildQueryVariants(input.query).map((variant) =>
        fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            variant
          )}&region=sr&language=${encodeURIComponent(
            MAP_LANGUAGE_BY_LOCALE[input.locale ?? "es"] ?? MAP_LANGUAGE_BY_LOCALE.es
          )}&key=${encodeURIComponent(geocodingApiKey)}`,
          {
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
          }
        )
      )
    );

    const payloads = await Promise.all(
      responses.map(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as GoogleGeocodeResponse;
      })
    );

    return uniq(
      payloads
        .flatMap((payload) => payload?.results ?? [])
        .filter((result) => hasCountryComponent(result.address_components, "SR"))
        .map((result) => {
          const formattedAddress = result.formatted_address?.trim() ?? "";

          if (!formattedAddress) {
            return null;
          }

          const hasRequestedHouseNumber = hasStreetNumberComponent(
            result.address_components,
            requestedHouseNumber
          );

          return {
            address:
              requestedHouseNumber && !hasRequestedHouseNumber
                ? injectHouseNumberIntoSuggestion(formattedAddress, requestedHouseNumber)
                : formattedAddress,
            score:
              scoreFormattedAddressMatch(
                formattedAddress,
                input.query,
                requestedHouseNumber
              ) + (hasRequestedHouseNumber ? 240 : 0),
          };
        })
        .filter(
          (
            suggestion
          ): suggestion is {
            address: string;
            score: number;
          } => Boolean(suggestion?.address)
        )
        .sort((left, right) => right.score - left.score)
        .map((suggestion) => suggestion.address)
    ).slice(0, input.maxResults ?? 8);
  } catch {
    return [];
  }
}

export async function resolveDeliveryQuote(input: {
  address: string;
  subtotal?: number;
  locale?: Locale;
}): Promise<ResolvedDeliveryQuote> {
  const locale = input.locale ?? "es";
  const assessment = assessDeliveryAddress(input.address);

  if (!assessment.isValidSurinameAddress) {
    return {
      distanceKm: 0,
      durationMinutes: null,
      fee: 0,
      isFree: false,
      allowsDelivery: false,
      isValidSurinameAddress: false,
      requiresAgentReview: false,
      freeDeliveryMinimum: null,
      source: "estimate",
    };
  }

  const [origin, destination] = await Promise.all([
    resolveStoreCoordinates(locale),
    resolveDestinationCoordinates(input.address, locale),
  ]);

  if (!destination) {
    return {
      distanceKm: 0,
      durationMinutes: null,
      fee: 0,
      isFree: false,
      allowsDelivery: true,
      isValidSurinameAddress: true,
      requiresAgentReview: true,
      freeDeliveryMinimum: null,
      source: "estimate",
    };
  }

  const realRoute =
    (await resolveGoogleRoute(origin, destination, locale)) ??
    (await resolveOsmRoute(origin, destination));

  if (!realRoute) {
    return {
      distanceKm: 0,
      durationMinutes: null,
      fee: 0,
      isFree: false,
      allowsDelivery: true,
      isValidSurinameAddress: true,
      requiresAgentReview: true,
      freeDeliveryMinimum: null,
      source: "estimate",
    };
  }

  const allowsDelivery =
    realRoute.distanceKm > 0 && realRoute.distanceKm <= MAX_DELIVERY_DISTANCE_KM;
  const feeDetails = allowsDelivery
    ? calculateDeliveryFee(realRoute.distanceKm, input.subtotal)
    : {
        fee: 0,
        isFree: false,
        isAvailable: false,
        freeDeliveryMinimum: null,
      };

  return {
    distanceKm: realRoute.distanceKm,
    durationMinutes: realRoute.durationMinutes,
    fee: feeDetails.fee,
    isFree: feeDetails.isFree,
    allowsDelivery,
    isValidSurinameAddress: true,
    requiresAgentReview: false,
    freeDeliveryMinimum: feeDetails.freeDeliveryMinimum,
    source: realRoute.source,
  };
}
