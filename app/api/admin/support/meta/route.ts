import { NextResponse } from "next/server";

import {
  getPendingSupportMessages,
  getUnreadSupportMessagesForAdmin,
} from "@/lib/server/admin/support";
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

    const [unreadMessages, openMessages] = await Promise.all([
      getUnreadSupportMessagesForAdmin(),
      getPendingSupportMessages(),
    ]);

    return NextResponse.json({
      success: true,
      meta: {
        unreadCount: unreadMessages.length,
        openCount: openMessages.length,
      },
    });
  } catch (error) {
    console.error("Failed to get support meta:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get support meta",
      },
      { status: 500 }
    );
  }
}
