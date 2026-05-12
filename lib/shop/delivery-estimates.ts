import type { Locale } from "@/lib/shop/types";

type DeliveryEstimateCopy = {
  within24Hours: string;
  within48Hours: string;
  within2To4Days: string;
  within3To6Days: string;
};

type DeliveryEstimateResult = {
  summaryText: string;
  dateText: string;
  isRange: boolean;
  earliestDate: string;
  latestDate: string;
};

const DELIVERY_ESTIMATE_TEXTS: Record<Locale, DeliveryEstimateCopy> = {
  es: {
    within24Hours: "Envio en 24 HR",
    within48Hours: "Envio en 48 HR",
    within2To4Days: "Envio en 2 a 4 dias",
    within3To6Days: "Envio en 3 a 6 dias",
  },
  nl: {
    within24Hours: "Levering in 24 uur",
    within48Hours: "Levering in 48 uur",
    within2To4Days: "Levering in 2 tot 4 dagen",
    within3To6Days: "Levering in 3 tot 6 dagen",
  },
  en: {
    within24Hours: "Delivery in 24 HR",
    within48Hours: "Delivery in 48 HR",
    within2To4Days: "Delivery in 2 to 4 days",
    within3To6Days: "Delivery in 3 to 6 days",
  },
  pt: {
    within24Hours: "Entrega em 24 HR",
    within48Hours: "Entrega em 48 HR",
    within2To4Days: "Entrega em 2 a 4 dias",
    within3To6Days: "Entrega em 3 a 6 dias",
  },
};

const INTL_LOCALE_BY_APP_LOCALE: Record<Locale, string> = {
  es: "es-SR",
  nl: "nl-SR",
  en: "en-US",
  pt: "pt-BR",
};

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function toDate(value: Date | string | number) {
  const nextDate = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(nextDate.getTime()) ? null : nextDate;
}

function formatDate(locale: Locale, value: Date) {
  return new Intl.DateTimeFormat(INTL_LOCALE_BY_APP_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function getDeliveryEstimate(distanceKm: number | null | undefined, locale: Locale) {
  if (!Number.isFinite(distanceKm) || !distanceKm || distanceKm <= 0) {
    return null;
  }

  const copy = DELIVERY_ESTIMATE_TEXTS[locale];

  if (distanceKm > 30) {
    return {
      summaryText: copy.within3To6Days,
      earliestDays: 3,
      latestDays: 6,
    };
  }

  if (distanceKm > 20) {
    return {
      summaryText: copy.within2To4Days,
      earliestDays: 2,
      latestDays: 4,
    };
  }

  if (distanceKm > 10) {
    return {
      summaryText: copy.within48Hours,
      earliestDays: 2,
      latestDays: 2,
    };
  }

  return {
    summaryText: copy.within24Hours,
    earliestDays: 1,
    latestDays: 1,
  };
}

export function getDeliveryEstimateDetails(input: {
  distanceKm: number | null | undefined;
  locale: Locale;
  baseDate: Date | string | number;
}): DeliveryEstimateResult | null {
  const estimate = getDeliveryEstimate(input.distanceKm, input.locale);
  const baseDate = toDate(input.baseDate);

  if (!estimate || !baseDate) {
    return null;
  }

  const earliestDate = addDays(baseDate, estimate.earliestDays);
  const latestDate = addDays(baseDate, estimate.latestDays);
  const isRange = estimate.earliestDays !== estimate.latestDays;
  const dateText = isRange
    ? `${formatDate(input.locale, earliestDate)} - ${formatDate(input.locale, latestDate)}`
    : formatDate(input.locale, earliestDate);

  return {
    summaryText: estimate.summaryText,
    dateText,
    isRange,
    earliestDate: earliestDate.toISOString(),
    latestDate: latestDate.toISOString(),
  };
}
