import { NextResponse } from "next/server";

import { createStatusLog } from "@/lib/server/admin/logs";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { getAdminUserProfile, setAdminUserBlockedState } from "@/lib/server/admin/users";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const profile = await getAdminUserProfile(id);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Failed to get user profile:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get user profile",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminRequestUser();

    if (!auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const payload = await request.json();
    const isBlocked = Boolean(payload.isBlocked);
    const user = await setAdminUserBlockedState(id, isBlocked);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    await createStatusLog({
      type: "user",
      targetId: id,
      action: "status_changed",
      changedBy: auth.user.id,
      changedByName: auth.user.name,
      changes: [
        {
          field: "isBlocked",
          oldValue: !isBlocked,
          newValue: isBlocked,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Failed to update user:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update user",
      },
      { status: 500 }
    );
  }
}
