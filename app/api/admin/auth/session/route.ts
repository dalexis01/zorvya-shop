import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findAdminSession, toAdminSessionUser } from "@/lib/server/admin/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("admin-session")?.value;

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          user: null,
        },
        { status: 401 }
      );
    }

    const result = await findAdminSession(sessionId);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          user: null,
        },
        { status: 401 }
      );
    }

    const sessionUser = await toAdminSessionUser(result.user);

    return NextResponse.json({
      success: true,
      user: sessionUser,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      {
        success: false,
        user: null,
      },
      { status: 500 }
    );
  }
}
