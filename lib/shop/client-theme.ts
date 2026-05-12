export type ClientTheme = "dark" | "light";

export const CLIENT_THEME_STORAGE_KEY = "zorvya-client-theme";
export const CLIENT_THEME_COOKIE_KEY = "zorvya-client-theme";

export function normalizeClientTheme(
  value: string | null | undefined,
  fallback: ClientTheme = "dark"
): ClientTheme {
  return value === "light" || value === "dark" ? value : fallback;
}

export function readStoredClientTheme(fallback: ClientTheme = "dark"): ClientTheme {
  if (typeof window === "undefined") {
    return fallback;
  }

  const documentTheme = document.documentElement.dataset.clientTheme;
  if (documentTheme === "light" || documentTheme === "dark") {
    return documentTheme;
  }

  const value = normalizeClientTheme(window.localStorage.getItem(CLIENT_THEME_STORAGE_KEY));

  if (value === "light" || value === "dark") {
    return value;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : fallback;
}

export function writeStoredClientTheme(theme: ClientTheme) {
  if (typeof window === "undefined") {
    return;
  }

  if (window.localStorage.getItem(CLIENT_THEME_STORAGE_KEY) !== theme) {
    window.localStorage.setItem(CLIENT_THEME_STORAGE_KEY, theme);
  }

  if (!document.cookie.includes(`${CLIENT_THEME_COOKIE_KEY}=${theme}`)) {
    document.cookie = `${CLIENT_THEME_COOKIE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}

export function applyClientTheme(theme: ClientTheme) {
  if (typeof document !== "undefined") {
    if (document.documentElement.dataset.clientTheme !== theme) {
      document.documentElement.dataset.clientTheme = theme;
    }
  }

  writeStoredClientTheme(theme);
}
