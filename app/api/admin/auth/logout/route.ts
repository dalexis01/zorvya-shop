import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAdminSession } from "@/lib/server/admin/auth";

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";

  if (!origin || !host) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase() === `${proto}://${host}`.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request origin",
        },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    const sessionId = cookieStore.get("admin-session")?.value;

    if (sessionId) {
      await deleteAdminSession(sessionId);
    }

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set({
      name: "admin-session",
      value: "",
      httpOnly: true,
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin logout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to log out",
      },
      { status: 500 }
    );
  }
}
