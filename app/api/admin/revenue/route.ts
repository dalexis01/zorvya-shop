import { NextResponse } from "next/server";

import { getRevenueAnalytics } from "@/lib/server/admin/analytics";
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

    const analytics = await getRevenueAnalytics();

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Failed to get revenue analytics:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get revenue analytics",
      },
      { status: 500 }
    );
  }
}
