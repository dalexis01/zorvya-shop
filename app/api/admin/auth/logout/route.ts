import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAdminSession } from "@/lib/server/admin/auth";

export async function POST() {
  try {
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
