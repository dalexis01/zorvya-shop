import { NextResponse } from "next/server";

import {
  getCustomerNotificationsPanelData,
  markCustomerNotificationsRead,
} from "@/lib/server/customer-notifications";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const payload = await getCustomerNotificationsPanelData(user.id);

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
