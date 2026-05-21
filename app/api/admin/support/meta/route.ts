import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import {
  getPendingSupportMessages,
  getUnreadSupportMessagesForAdmin,
} from "@/lib/server/admin/support";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

export const dynamic = "force-dynamic";

const SUPPORT_META_TTL_MS = 60_000;

let supportMetaCache:
  | {
      expiresAt: number;
      value: {
        unreadCount: number;
        openCount: number;
      };
    }
  | null = null;

export async function GET() {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const meta =
      supportMetaCache && supportMetaCache.expiresAt > Date.now()
        ? supportMetaCache.value
        : await (async () => {
            const [unreadMessages, openMessages] = await Promise.all([
              getUnreadSupportMessagesForAdmin(),
              getPendingSupportMessages(),
            ]);

            return {
              unreadCount: unreadMessages.length,
              openCount: openMessages.length,
            };
          })();

    if (!supportMetaCache || supportMetaCache.value !== meta) {
      supportMetaCache = {
        expiresAt: Date.now() + SUPPORT_META_TTL_MS,
        value: meta,
      };
    }

    const payload = {
      success: true,
      meta,
    };
    logApiResponseMetrics({
      endpoint: "/api/admin/support/meta",
      payload,
      rowCount: 1,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
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
