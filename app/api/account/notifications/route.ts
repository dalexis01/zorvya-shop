import { NextResponse } from "next/server";

import { logApiResponseMetrics } from "@/lib/server/api-response-metrics";
import {
  getCustomerNotificationsPanelData,
  markCustomerNotificationsRead,
} from "@/lib/server/customer-notifications";
import { getCurrentUser } from "@/lib/server/session";
import type { Locale } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        { status: 401 }
      );
    }

    const requestLocale = new URL(request.url).searchParams.get("locale");
    const locale = (
      requestLocale && ["es", "nl", "en", "pt"].includes(requestLocale) ? requestLocale : "es"
    ) as Locale;
    const payload = await getCustomerNotificationsPanelData(user.id, locale);
    const responsePayload = {
      success: true,
      ...payload,
    };
    logApiResponseMetrics({
      endpoint: "/api/account/notifications",
      payload: responsePayload,
      rowCount: payload.notifications.length + payload.pendingOrders.length,
    });

    return NextResponse.json(responsePayload, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("[account/notifications] failed to load notifications:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron cargar las notificaciones.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        { status: 401 }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as { ids?: string[] };
    await markCustomerNotificationsRead({
      userId: user.id,
      ids: Array.isArray(payload.ids) ? payload.ids : undefined,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[account/notifications] failed to mark notifications as read:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudieron actualizar las notificaciones.",
      },
      { status: 500 }
    );
  }
}
