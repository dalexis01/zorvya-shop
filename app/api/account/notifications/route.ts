import { NextResponse } from "next/server";

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

    return NextResponse.json({
      success: true,
      ...payload,
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
