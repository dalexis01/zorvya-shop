import type { Locale } from "@/lib/shop/types";

export const LOCALE_STORAGE_KEY = "zorvya-locale-v1";
export const LOCALE_STORAGE_EVENT = "zorvya-locale-change";

export function readStoredLocale(fallback: Locale = "es"): Locale {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (value === "es" || value === "nl" || value === "en" || value === "pt") {
    return value;
  }

  return fallback;
}

export function writeStoredLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.dispatchEvent(new CustomEvent<Locale>(LOCALE_STORAGE_EVENT, { detail: locale }));
}
