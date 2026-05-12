import { NextResponse } from "next/server";

import { getAllSupportMessages } from "@/lib/server/admin/support";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

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
    const status = searchParams.get("status") as "open" | "in_progress" | "resolved" | null;
    const priority = searchParams.get("priority") as "low" | "medium" | "high" | null;
    const messages = await getAllSupportMessages({
      status: status ?? undefined,
      priority: priority ?? undefined,
    });

    return NextResponse.json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Failed to get support messages:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get support messages",
      },
      { status: 500 }
    );
  }
}
