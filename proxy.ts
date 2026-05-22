import { NextRequest, NextResponse } from "next/server";

const BLOCKED_PREFIXES = [
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/wordpress",
  "/wp",
  "/.env",
  "/phpmyadmin",
  "/cgi-bin",
];

const RATE_LIMIT_WINDOWS = {
  api: { max: 90, windowMs: 60_000 },
  admin: { max: 120, windowMs: 60_000 },
  products: { max: 180, windowMs: 60_000 },
} as const;

const rateLimitState = globalThis as typeof globalThis & {
  __zorvyaProxyRateLimitStore?: Map<string, { count: number; resetAt: number }>;
};

function getRateLimitStore() {
  if (!rateLimitState.__zorvyaProxyRateLimitStore) {
    rateLimitState.__zorvyaProxyRateLimitStore = new Map();
  }

  return rateLimitState.__zorvyaProxyRateLimitStore;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function buildBlockedResponse(status: 403 | 429, retryAfterSeconds?: number) {
  const headers = new Headers({
    "x-bot-blocked": "true",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  });

  if (retryAfterSeconds) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }

  return new NextResponse(null, {
    status,
    headers,
  });
}

function isBlockedPath(pathname: string) {
  if (pathname === "/install.php" || pathname.endsWith("/install.php")) {
    return true;
  }

  return BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getRateLimitBucket(pathname: string) {
  if (pathname.startsWith("/api/")) {
    return { key: "api", ...RATE_LIMIT_WINDOWS.api };
  }

  if (pathname.startsWith("/admin")) {
    return { key: "admin", ...RATE_LIMIT_WINDOWS.admin };
  }

  if (pathname.startsWith("/products/")) {
    return { key: "products", ...RATE_LIMIT_WINDOWS.products };
  }

  return null;
}

function enforceRateLimit(request: NextRequest, pathname: string) {
  const bucket = getRateLimitBucket(pathname);

  if (!bucket) {
    return null;
  }

  const store = getRateLimitStore();
  const ip = getClientIp(request);
  const key = `${bucket.key}:${ip}`;
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + bucket.windowMs,
    });
    return null;
  }

  if (current.count >= bucket.max) {
    console.warn("[blocked-bot]", pathname, request.headers.get("user-agent") || "");
    return buildBlockedResponse(429, Math.ceil((current.resetAt - now) / 1000));
  }

  current.count += 1;
  store.set(key, current);
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBlockedPath(pathname)) {
    console.warn("[blocked-bot]", pathname, request.headers.get("user-agent") || "");
    return buildBlockedResponse(403);
  }

  const limited = enforceRateLimit(request, pathname);

  if (limited) {
    return limited;
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get("admin-session")?.value;

  if (!sessionId) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
