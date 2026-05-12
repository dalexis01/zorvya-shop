import { NextResponse } from "next/server";

import {
  appendCustomerSupportMessage,
  createSupportMessage,
  getLatestSupportConversation,
  markSupportConversationSeenByCustomer,
} from "@/lib/server/admin/support";
import { getCurrentUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

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

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    const customerToken = normalizeText(searchParams.get("customerToken"));

    if (!currentUser && !customerToken) {
      return NextResponse.json({
        success: true,
        conversation: null,
      });
    }

    const conversation = await getLatestSupportConversation({
      customerId: currentUser?.id,
      customerToken: customerToken || undefined,
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Failed to load support conversation:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo cargar el chat de soporte.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const payload = (await request.json()) as Record<string, unknown>;

    const message = normalizeText(payload.message);
    const subject = normalizeText(payload.subject) || "Mensaje desde soporte web";
    const customerEmail = normalizeText(payload.email) || currentUser?.email || "";
    const customerPhone = normalizeText(payload.phone) || currentUser?.phone || "";
    const customerName = normalizeText(payload.name) || currentUser?.name || "Cliente";
    const orderId = normalizeText(payload.orderId) || undefined;
    const priority = normalizeText(payload.priority) as "low" | "medium" | "high";
    const category = normalizeText(payload.category) as "product" | "delivery" | "payment" | "other";
    const source = normalizeText(payload.source) as "chatbot" | "email";
    const conversationId = normalizeText(payload.conversationId);
    const customerToken = normalizeText(payload.customerToken);
    const attachments = normalizeAttachments(payload.attachments);

    if (message.length < 2 && attachments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Debes escribir un mensaje o adjuntar una imagen.",
        },
        { status: 400 }
      );
    }

    if (!customerEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Debe indicar un correo de contacto.",
        },
        { status: 400 }
      );
    }

    const normalizedCustomerId = currentUser?.id ?? customerToken;

    if (!normalizedCustomerId) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo identificar la conversacion.",
        },
        { status: 400 }
      );
    }

    const conversation =
      conversationId ||
      (await getLatestSupportConversation({
        customerId: currentUser?.id,
        customerToken: customerToken || undefined,
      }))?.id;

    const supportMessage = conversation
      ? await appendCustomerSupportMessage(conversation, {
          customerId: currentUser?.id,
          customerToken: customerToken || undefined,
          customerName,
          customerEmail,
          customerPhone,
          message,
          attachments,
          source: ["chatbot", "email"].includes(source) ? source : "chatbot",
        })
      : await createSupportMessage({
          customerId: normalizedCustomerId,
          customerToken: customerToken || undefined,
          customerName,
          customerEmail,
          customerPhone,
          orderId,
          subject,
          message,
          attachments,
          category: ["product", "delivery", "payment", "other"].includes(category)
            ? category
            : "other",
          priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
          source: ["chatbot", "email"].includes(source) ? source : "chatbot",
        });

    return NextResponse.json({
      success: true,
      conversation: supportMessage,
    });
  } catch (error) {
    console.error("Failed to create support message:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo enviar el mensaje de soporte.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const payload = (await request.json()) as Record<string, unknown>;
    const conversationId = normalizeText(payload.conversationId);
    const customerToken = normalizeText(payload.customerToken);

    if (!conversationId) {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo identificar la conversacion.",
        },
        { status: 400 }
      );
    }

    if (!currentUser && !customerToken) {
      return NextResponse.json(
        {
          success: false,
          error: "No autorizado.",
        },
        { status: 401 }
      );
    }

    const conversation = await markSupportConversationSeenByCustomer({
      conversationId,
      customerId: currentUser?.id,
      customerToken: customerToken || undefined,
    });

    return NextResponse.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Failed to mark support conversation as seen:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo actualizar el estado del chat.",
      },
      { status: 500 }
    );
  }
}
