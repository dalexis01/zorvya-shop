import { NextResponse } from "next/server";

import { toOrderSummary } from "@/lib/shop/order-status";
import { prepareOrderPlacement } from "@/lib/server/order-placement";
import { sendOrderEmails } from "@/lib/server/order-email";
import { createOrder } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/server/session";
import { findOrCreateGuestUser, updateUserContact } from "@/lib/server/users";

export async function POST(request: Request) {
  let rawPayload: unknown;

  try {
    rawPayload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "La solicitud no contiene datos validos." },
      { status: 400 }
    );
  }

  try {
    const currentUser = await getCurrentUser();
    const validation = await prepareOrderPlacement(rawPayload, {
      fallbackEmail: currentUser?.email,
    });

    if (!validation.success) {
      console.warn("[place-order] validation failed:", JSON.stringify(validation.errors));
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    if (validation.data.paymentMethod === "paypal") {
      return NextResponse.json(
        { success: false, error: "El pago PayPal debe completarse desde el boton de PayPal." },
        { status: 400 }
      );
    }

    // ── Resolve userId ──────────────────────────────────────────────────────
    let userId = currentUser?.id ?? null;

    if (!userId && validation.data.customerEmail) {
      // Auto-associate or create guest account from order data (non-blocking)
      const guestUser = await findOrCreateGuestUser({
        name: validation.data.customerName,
        email: validation.data.customerEmail,
        phone: validation.data.customerPhone,
        address: validation.data.customerAddress,
      }).catch((err) => {
        console.warn("[place-order] findOrCreateGuestUser failed (non-critical):", err);
        return null;
      });
      userId = guestUser?.id ?? null;
    }

    // ── Create order (always proceeds, even if user creation failed) ────────
    const order = await createOrder({
      ...validation.data,
      userId,
    });

    console.info(`[place-order] order created: ${order.id} | customer: ${order.customerName} | userId: ${userId ?? "guest"}`);

    // Update existing user's contact info
    if (currentUser) {
      await updateUserContact(currentUser.id, {
        name: validation.data.customerName,
        phone: validation.data.customerPhone,
        address: validation.data.customerAddress,
      }).catch((err) => console.warn("[place-order] updateUserContact failed:", err));
    }

    const emailResult = await sendOrderEmails(order).catch((err) => {
      console.warn("[place-order] sendOrderEmails failed:", err);
      return { warnings: ["No se pudo enviar el correo de confirmacion."], clientEmailSent: false };
    });

    return NextResponse.json({
      success: true,
      order: toOrderSummary(order, true),
      warnings: emailResult.warnings,
      emailSentToCustomer: emailResult.clientEmailSent,
    });
  } catch (err) {
    console.error("[place-order] unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "No se pudo confirmar la orden." },
      { status: 500 }
    );
  }
}
