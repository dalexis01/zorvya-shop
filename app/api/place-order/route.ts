import { NextResponse } from "next/server";

import { toOrderSummary } from "@/lib/shop/order-status";
import { prepareOrderPlacement } from "@/lib/server/order-placement";
import { sendOrderEmails } from "@/lib/server/order-email";
import { createOrder } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/server/session";
import { updateUserContact } from "@/lib/server/users";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    const payload = (await request.json()) as unknown;
    const validation = await prepareOrderPlacement(payload, {
      fallbackEmail: currentUser?.email,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    if (validation.data.paymentMethod === "paypal") {
      return NextResponse.json(
        {
          success: false,
          error: "El pago PayPal debe completarse desde el boton de PayPal.",
        },
        { status: 400 }
      );
    }

    const order = await createOrder({
      ...validation.data,
      userId: currentUser?.id ?? null,
    });

    if (currentUser) {
      await updateUserContact(currentUser.id, {
        name: validation.data.customerName,
        phone: validation.data.customerPhone,
        address: validation.data.customerAddress,
      });
    }

    const emailResult = await sendOrderEmails(order);

    return NextResponse.json({
      success: true,
      order: toOrderSummary(order, true),
      warnings: emailResult.warnings,
      emailSentToCustomer: emailResult.clientEmailSent,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "No se pudo confirmar la orden.",
      },
      { status: 500 }
    );
  }
}
