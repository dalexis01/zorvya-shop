import { NextResponse } from "next/server";

import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getAdminUsers } from "@/lib/server/admin/users";

export async function GET(request: Request) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const users = await getAdminUsers({ search });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Failed to get users:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get users",
      },
      { status: 500 }
    );
  }
}
