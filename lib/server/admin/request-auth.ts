import "server-only";

import { cookies } from "next/headers";

import { findAdminSession } from "@/lib/server/admin/auth";

export async function requireAdminRequestUser() {
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

  return {
    user: result.user,
    status: 200,
    error: null,
  };
}
