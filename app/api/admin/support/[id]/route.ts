import { NextResponse } from "next/server";

import {
  addSupportResponse,
  getSupportMessageById,
  markSupportMessageSeenByAdmin,
  updateSupportMessagePriority,
  updateSupportMessageStatus,
} from "@/lib/server/admin/support";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 MB per attachment

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.startsWith("data:image/"))
    .filter((item) => Buffer.byteLength(item, "utf8") <= MAX_ATTACHMENT_BYTES)
    .slice(0, 4);
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

    if (typeof payload.status === "string") {
      const message = await updateSupportMessageStatus(id, payload.status);

      return NextResponse.json({
        success: true,
        message,
      });
    }

    if (typeof payload.priority === "string") {
      const message = await updateSupportMessagePriority(id, payload.priority);

      return NextResponse.json({
        success: true,
        message,
      });
    }

    if (payload.action === "mark-viewed") {
      const message = await markSupportMessageSeenByAdmin(id);

      return NextResponse.json({
        success: true,
        message,
      });
    }

    const responseMessage = typeof payload.response === "string" ? payload.response.trim() : "";
    const attachments = normalizeAttachments(payload.attachments);

    if (responseMessage || attachments.length) {
      const message = await addSupportResponse(id, {
        respondedBy: auth.user.id,
        respondedByName: auth.user.name,
        message: responseMessage,
        attachments,
      });

      return NextResponse.json({
        success: true,
        message,
      });
    }

    const message = await getSupportMessageById(id);

    return NextResponse.json({
      success: Boolean(message),
      message,
    });
  } catch (error) {
    console.error("Failed to update support message:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update support message",
      },
      { status: 500 }
    );
  }
}
