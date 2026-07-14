import "server-only";

import { cookies } from "next/headers";

import type { AdminPermission } from "@/lib/shop/admin-types";
import {
  findAdminSession,
  hasAdminPermission,
  toAdminSessionUser,
} from "@/lib/server/admin/auth";

type RequireAdminRequestOptions = {
  request?: Request;
  permission?: AdminPermission;
  requireFreshOrigin?: boolean;
};

function isReadOnlyMethod(method: string | undefined) {
  const normalized = (method ?? "GET").toUpperCase();
  return normalized === "GET" || normalized === "HEAD" || normalized === "OPTIONS";
}

function isAllowedSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";

  if (!host) {
    return false;
  }

  const expectedOrigin = `${proto}://${host}`.toLowerCase();

  const matches = (value: string | null) => {
    if (!value) {
      return false;
    }

    try {
      const parsed = new URL(value);
      return `${parsed.protocol}//${parsed.host}`.toLowerCase() === expectedOrigin;
    } catch {
      return false;
    }
  };

  return matches(origin) || matches(referer);
}

export async function requireAdminRequestUser(options: RequireAdminRequestOptions = {}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin-session")?.value;

  if (!sessionId) {
    return {
      user: null,
      status: 401,
      error: "Unauthorized",
    };
  }

  const result = await findAdminSession(sessionId);

  if (!result) {
    return {
      user: null,
      status: 401,
      error: "Session expired",
    };
  }

  if (
    options.request &&
    (options.requireFreshOrigin || !isReadOnlyMethod(options.request.method)) &&
    !isAllowedSameOriginRequest(options.request)
  ) {
    return {
      user: null,
      status: 403,
      error: "Invalid request origin",
    };
  }

  const sessionUser = await toAdminSessionUser(result.user);

  if (options.permission && !hasAdminPermission(sessionUser, options.permission)) {
    return {
      user: null,
      status: 403,
      error: "Forbidden",
    };
  }

  return {
    user: sessionUser,
    status: 200,
    error: null,
  };
}
