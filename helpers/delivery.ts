const STORE_ADDRESS = "Anton Drachtenweg 146, Paramaribo, Suriname";
const STORE_COORDINATES = {
  latitude: 5.8339999,
  longitude: -55.1319794,
} as const;
const MAX_DELIVERY_DISTANCE_KM = 30;
const DELIVERY_FEE_PER_8KM_SRD = 150;
const DELIVERY_DISTANCE_STEP_KM = 8;
const HEAVY_DELIVERY_FEE_PER_KM_SRD = 100;

const SURINAME_DISTRICTS = [
  "paramaribo",
  "wanica",
  "commewijne",
  "para",
  "saramacca",
  "coronie",
  "nickerie",
  "marowijne",
  "brokopondo",
  "sipaliwini",
] as const;

const FOREIGN_LOCATION_HINTS = [
  "guyana",
  "georgetown",
  "france",
  "french guiana",
  "guyane",
  "cayenne",
  "brazil",
  "brasil",
  "belem",
  "netherlands",
  "holland",
  "usa",
  "united states",
  "new york",
  "miami",
  "curacao",
  "aruba",
  "trinidad",
  "jamaica",
  "venezuela",
  "colombia",
];

const AREA_DISTANCE_MAP: Array<[string, number]> = [
  ["centrum", 4],
  ["paramaribo", 6],
  ["rainville", 5],
  ["munder", 7],
  ["maretraite", 5],
  ["blauwgrond", 6],
  ["tourtonne", 6],
  ["zorg en hoop", 7],
  ["weg naar zee", 15],
  ["flora", 8],
  ["welgelegen", 7],
  ["kasabaholo", 6],
  ["beekhuizen", 8],
  ["latour", 7],
  ["uitvlugt", 8],
  ["leonsberg", 10],
  ["livorno", 10],
  ["kwatta", 9],
  ["hannaslust", 7],
  ["tamenga", 13],
  ["nieuwe grond", 14],
  ["meerzorg", 16],
  ["pontbuiten", 18],
  ["lelydorp", 24],
  ["domburg", 27],
  ["boxel", 29],
  ["wanica", 18],
  ["commewijne", 24],
  ["para", 29],
];

const STREET_DISTANCE_MAP: Array<[string, number]> = [
  ["anton dragtenweg", 5],
  ["keizerstraat", 4],
  ["verlengde keizerstraat", 5],
  ["steenbakkerijstraat", 4],
  ["henck arronstraat", 4],
  ["gravenstraat", 4],
  ["waterkant", 4],
  ["onafhankelijkheidsplein", 4],
  ["zwartenhovenbrugstraat", 5],
  ["domineestraat", 4],
  ["dr sophie redmondstraat", 6],
  ["gemenelandsweg", 6],
  ["verl. gemenelandsweg", 8],
  ["verl gemenelandsweg", 8],
  ["verlengde gemenelandsweg", 8],
  ["jaggernath lachmonstraat", 7],
  ["johannes mungrastraat", 7],
  ["kwattaweg", 9],
  ["tourtonnelaan", 6],
  ["van t hogerhuysstraat", 8],
  ["kasabaholoweg", 6],
  ["commissaris weythingweg", 10],
  ["indira gandhiweg", 24],
  ["sir winston churchillweg", 18],
  ["anamoestraat", 7],
  ["wilhelminastraat", 5],
  ["saramaccastraat", 5],
  ["avobakaweg", 29],
  ["weg naar zee", 15],
];

const REAL_SURINAME_ADDRESS_SUGGESTIONS = [
  "Anton Drachtenweg 146, Rainville, Paramaribo, Suriname",
  "Keizerstraat 88, Centrum, Paramaribo, Suriname",
  "Keizerstraat, Centrum, Paramaribo, Suriname",
  "Verlengde Keizerstraat, Centrum, Paramaribo, Suriname",
  "Steenbakkerijstraat 21, Centrum, Paramaribo, Suriname",
  "Steenbakkerijstraat, Centrum, Paramaribo, Suriname",
  "Henck Arronstraat, Centrum, Paramaribo, Suriname",
  "Onafhankelijkheidsplein, Centrum, Paramaribo, Suriname",
  "Waterkant 10, Centrum, Paramaribo, Suriname",
  "Zwartenhovenbrugstraat, Centrum, Paramaribo, Suriname",
  "Domineestraat, Centrum, Paramaribo, Suriname",
  "Dr. Sophie Redmondstraat, Rainville, Paramaribo, Suriname",
  "Gemenelandsweg, Rainville, Paramaribo, Suriname",
  "Jaggernath Lachmonstraat, Flora, Paramaribo, Suriname",
  "Johannes Mungrastraat, Rainville, Paramaribo, Suriname",
  "Kwattaweg, Kwatta, Paramaribo, Suriname",
  "Tourtonnelaan, Tourtonne, Paramaribo, Suriname",
  "Van't Hogerhuysstraat, Zorg en Hoop, Paramaribo, Suriname",
  "Kasabaholoweg, Kasabaholo, Paramaribo, Suriname",
  "Commissaris Weythingweg, Livorno, Paramaribo, Suriname",
  "Sir Winston Churchillweg, Boxel, Wanica, Suriname",
  "Indira Gandhiweg, Lelydorp, Wanica, Suriname",
  "Weg naar Zee, Paramaribo, Suriname",
  "Meerzorg, Commewijne, Suriname",
  "Avobakaweg, Para, Suriname",
] as const;

type DeliveryAddressAssessment = {
  isValidSurinameAddress: boolean;
  allowsDelivery: boolean;
  distanceKm: number;
  reason:
    | "ok"
    | "needs_quote"
    | "missing"
    | "outside_suriname"
    | "unknown_suriname_address"
    | "outside_delivery_zone";
};

export function normalizeDeliveryAddress(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createAddressTokens(value: string) {
  return normalizeDeliveryAddress(value)
    .split(/[\s,.-]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function extractDeliveryHouseNumber(value: string) {
  return normalizeDeliveryAddress(value).match(/\b\d+[a-z]?\b/)?.[0] ?? "";
}

export function injectHouseNumberIntoSuggestion(address: string, houseNumber: string) {
  const trimmedHouseNumber = houseNumber.trim();

  if (!trimmedHouseNumber) {
    return address.trim();
  }

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return address.trim();
  }

  const primary = parts[0]
    .replace(/\b\d+[a-z]?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!primary) {
    return address.trim();
  }

  parts[0] = `${primary} ${trimmedHouseNumber}`.replace(/\s+/g, " ").trim();
  return parts.join(", ");
}

function hasStreetLikeDetail(value: string) {
  return /\d/.test(value) || /(weg|straat|laan|road|street|drive|plein|wijk|pad|project)/.test(value);
}

function hasDeliveryHouseNumber(value: string) {
  return /\b\d+[a-z]?\b/.test(normalizeDeliveryAddress(value));
}

function isStructurallyValidDeliveryAddress(value: string) {
  const normalized = normalizeDeliveryAddress(value);

  if (!normalized || normalized.length < 5) {
    return false;
  }

  if (FOREIGN_LOCATION_HINTS.some((hint) => normalized.includes(hint))) {
    return false;
  }

  return hasStreetLikeDetail(normalized) && hasDeliveryHouseNumber(normalized);
}

function looksLikeShortStreetAddress(value: string) {
  const tokens = createAddressTokens(value);
  return hasDeliveryHouseNumber(value) && tokens.length >= 2;
}

function hasMultiPartAddress(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean).length >= 2;
}

export function getDeliveryAddressSuggestions(query: string, limit: number = 6) {
  const normalizedQuery = normalizeDeliveryAddress(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const queryTokens = createAddressTokens(normalizedQuery);
  const requestedHouseNumber = extractDeliveryHouseNumber(query);
  const scoredSuggestions = new Map<string, number>();

  REAL_SURINAME_ADDRESS_SUGGESTIONS.forEach((address) => {
    const normalizedAddress = normalizeDeliveryAddress(address);
    const addressTokens = createAddressTokens(address);
    let score = 0;

    if (normalizedAddress === normalizedQuery) {
      return;
    }

    if (normalizedAddress.startsWith(normalizedQuery)) {
      score += 220;
    } else if (normalizedAddress.includes(normalizedQuery)) {
      score += 140;
    }

    const matchedTokens = queryTokens.filter((queryToken) =>
      addressTokens.some(
        (addressToken) =>
          addressToken.startsWith(queryToken) || addressToken.includes(queryToken)
      )
    ).length;

    if (matchedTokens === 0) {
      return;
    }

    score += matchedTokens * 40;

    if (addressTokens[0]?.startsWith(queryTokens[0] ?? "")) {
      score += 25;
    }

    if (requestedHouseNumber) {
      if (normalizedAddress.includes(requestedHouseNumber)) {
        score += 120;
      }

      const suggestionWithHouseNumber = injectHouseNumberIntoSuggestion(address, requestedHouseNumber);

      if (
        suggestionWithHouseNumber &&
        normalizeDeliveryAddress(suggestionWithHouseNumber) !== normalizedAddress
      ) {
        const boostedScore = score + 85;
        const previousScore = scoredSuggestions.get(suggestionWithHouseNumber) ?? 0;

        if (boostedScore > previousScore) {
          scoredSuggestions.set(suggestionWithHouseNumber, boostedScore);
        }
      }
    }

    const previousScore = scoredSuggestions.get(address) ?? 0;

    if (score > previousScore) {
      scoredSuggestions.set(address, score);
    }
  });

  return Array.from(scoredSuggestions.entries())
    .sort((left, right) => {
      if (left[1] !== right[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([address]) => address);
}

export function assessDeliveryAddress(customerAddress: string): DeliveryAddressAssessment {
  const normalized = normalizeDeliveryAddress(customerAddress);

  if (!normalized || normalized.length < 5) {
    return {
      isValidSurinameAddress: false,
      allowsDelivery: false,
      distanceKm: 0,
      reason: "missing",
    };
  }

  if (FOREIGN_LOCATION_HINTS.some((hint) => normalized.includes(hint))) {
    return {
      isValidSurinameAddress: false,
      allowsDelivery: false,
      distanceKm: 0,
      reason: "outside_suriname",
    };
  }

  const mentionsDistrict = SURINAME_DISTRICTS.some((district) => normalized.includes(district));
  const mentionsCountry = normalized.includes("suriname") || normalized.includes("surinam");
  const mentionsKnownArea = AREA_DISTANCE_MAP.some(([area]) => normalized.includes(area));
  const mentionsKnownStreet = STREET_DISTANCE_MAP.some(([street]) => normalized.includes(street));
  const looksStructured = hasMultiPartAddress(customerAddress);
  const looksLikeStreetAddress = looksLikeShortStreetAddress(normalized);
  const hasValidStreetAndNumber = isStructurallyValidDeliveryAddress(customerAddress);

  if (
    !hasValidStreetAndNumber &&
    !(
      mentionsDistrict ||
      mentionsCountry ||
      mentionsKnownArea ||
      mentionsKnownStreet ||
      looksStructured ||
      looksLikeStreetAddress
    )
  ) {
    return {
      isValidSurinameAddress: false,
      allowsDelivery: false,
      distanceKm: 0,
      reason: "unknown_suriname_address",
    };
  }

  const matchedStreet = STREET_DISTANCE_MAP.find(([street]) => normalized.includes(street));
  const matchedArea = AREA_DISTANCE_MAP.find(([area]) => normalized.includes(area));
  const distanceKm = matchedStreet ? matchedStreet[1] : matchedArea ? matchedArea[1] : 0;

  if (distanceKm > MAX_DELIVERY_DISTANCE_KM) {
    return {
      isValidSurinameAddress: true,
      allowsDelivery: false,
      distanceKm,
      reason: "outside_delivery_zone",
    };
  }

  if (distanceKm <= 0) {
    return {
      isValidSurinameAddress: true,
      allowsDelivery: true,
      distanceKm: 0,
      reason: "needs_quote",
    };
  }

  return {
    isValidSurinameAddress: true,
    allowsDelivery: true,
    distanceKm,
    reason: "ok",
  };
}

export function estimateDeliveryDistance(customerAddress: string) {
  // This is now ONLY used as a fallback hint for validation
  // Real distance is always calculated by Google Maps in delivery-quote.ts
  return assessDeliveryAddress(customerAddress).distanceKm;
}

export function getFreeDeliveryProgress(distance: number | null | undefined, subtotal: number) {
  void distance;
  void subtotal;
  return {
    available: false,
    minimum: null,
    progress: 0,
    remaining: null,
    isUnlocked: false,
  };
}

export function calculateDeliveryFee(
  distance: number,
  options?: number | { subtotal?: number; hasHeavy?: boolean }
): {
  fee: number;
  isFree: boolean;
  isAvailable: boolean;
  freeDeliveryMinimum: number | null;
} {
  if (distance <= 0 || distance > MAX_DELIVERY_DISTANCE_KM) {
    return {
      fee: 0,
      isFree: false,
      isAvailable: false,
      freeDeliveryMinimum: null,
    };
  }

  const normalizedOptions =
    typeof options === "number" ? { subtotal: options, hasHeavy: false } : options ?? {};
  const hasHeavy = Boolean(normalizedOptions.hasHeavy);
  const _subtotal = normalizedOptions.subtotal;
  void _subtotal;
  const fee = hasHeavy
    ? Math.max(HEAVY_DELIVERY_FEE_PER_KM_SRD, Math.ceil(distance) * HEAVY_DELIVERY_FEE_PER_KM_SRD)
    : Math.max(
        DELIVERY_FEE_PER_8KM_SRD,
        Math.ceil(distance / DELIVERY_DISTANCE_STEP_KM) * DELIVERY_FEE_PER_8KM_SRD
      );
  return {
    fee,
    isFree: false,
    isAvailable: true,
    freeDeliveryMinimum: null,
  };
}

export {
  DELIVERY_DISTANCE_STEP_KM,
  DELIVERY_FEE_PER_8KM_SRD,
  HEAVY_DELIVERY_FEE_PER_KM_SRD,
  MAX_DELIVERY_DISTANCE_KM,
  REAL_SURINAME_ADDRESS_SUGGESTIONS,
  STORE_ADDRESS,
  STORE_COORDINATES,
};
