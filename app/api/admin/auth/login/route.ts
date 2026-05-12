import { NextResponse } from "next/server";
import { authenticateAdminUser, createAdminSession, toAdminSessionUser } from "@/lib/server/admin/auth";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("email" in payload) ||
      !("password" in payload)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid credentials format",
        },
        { status: 400 }
      );
    }

    const email = String((payload as Record<string, unknown>).email);
    const password = String((payload as Record<string, unknown>).password);

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Email and password are required",
        },
        { status: 400 }
      );
    }

    const user = await authenticateAdminUser(email, password);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const sessionId = await createAdminSession(user.id);
    const sessionUser = await toAdminSessionUser(user);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    response.cookies.set({
      name: "admin-session",
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to log in",
      },
      { status: 500 }
    );
  }
}
