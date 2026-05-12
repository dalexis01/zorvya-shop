import { NextResponse } from "next/server";

import { getAdminOrdersMeta } from "@/lib/server/admin/orders";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const meta = await getAdminOrdersMeta();

    return NextResponse.json({
      success: true,
      meta,
    });
  } catch (error) {
    console.error("Failed to get admin orders meta:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get orders meta",
      },
      { status: 500 }
    );
  }
}
