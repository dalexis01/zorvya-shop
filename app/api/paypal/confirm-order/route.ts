import { NextResponse } from "next/server";

import { toOrderSummary } from "@/lib/shop/order-status";
import { prepareOrderPlacement } from "@/lib/server/order-placement";
import {
  authorizePayPalOrder,
  extractPayPalAuthorization,
  isPayPalConfigured,
  PayPalApiError,
  PayPalConfigurationError,
  voidPayPalAuthorization,
} from "@/lib/server/paypal";
import { sendOrderEmails } from "@/lib/server/order-email";
import { createOrder } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/server/session";
import { updateUserContact } from "@/lib/server/users";

function getPayPalOrderId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const body = payload as Record<string, unknown>;
  return typeof body.paypalOrderId === "string" ? body.paypalOrderId.trim() : "";
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const payload = (await request.json()) as unknown;
  const paypalOrderId = getPayPalOrderId(payload);

  if (!paypalOrderId) {
    return NextResponse.json(
      {
        success: false,
        error: "Falta la orden PayPal aprobada.",
      },
      { status: 400 }
    );
  }

  try {
    if (!(await isPayPalConfigured())) {
      return NextResponse.json(
        {
          success: false,
          error: "PayPal todavia no esta configurado en el servidor.",
        },
        { status: 503 }
      );
    }

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

    if (validation.data.paymentMethod !== "paypal" || !validation.data.paymentPayableUsd) {
      return NextResponse.json(
        {
          success: false,
          error: "La solicitud no corresponde a un pago PayPal valido.",
        },
        { status: 400 }
      );
    }

    if (
      validation.data.deliveryType === "delivery" &&
      validation.data.requestedAgentCall &&
      validation.data.deliveryDistanceKm === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PayPal solo esta disponible cuando el total del delivery ya pudo calcularse con exactitud.",
        },
        { status: 400 }
      );
    }

    const authorizationResponse = await authorizePayPalOrder(paypalOrderId);
    const authorization = extractPayPalAuthorization(authorizationResponse);

    if (!authorization.id) {
      throw new PayPalApiError(
        "PayPal no devolvio la autorizacion del pago.",
        502,
        authorizationResponse
      );
    }

    // Verify the amount PayPal actually authorized matches what we computed
    if (
      authorization.authorizedUsd !== null &&
      Math.abs(authorization.authorizedUsd - validation.data.paymentPayableUsd) > 0.01
    ) {
      await voidPayPalAuthorization(authorization.id).catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          error: "El monto autorizado por PayPal no coincide con el total de la orden.",
        },
        { status: 400 }
      );
    }

    try {
      const order = await createOrder({
        ...validation.data,
        userId: currentUser?.id ?? null,
        initialAdminStatus: "Pendiente de confirmacion",
        paymentUpdate: {
          method: "paypal",
          state: "authorized",
          paypalOrderId,
          paypalAuthorizationId: authorization.id,
          paypalAuthorizationStatus: authorization.status ?? "CREATED",
          authorizedAt: new Date().toISOString(),
        },
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
    } catch (error) {
      await voidPayPalAuthorization(authorization.id).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof PayPalConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          error: "PayPal todavia no esta configurado en el servidor.",
        },
        { status: 503 }
      );
    }

    if (error instanceof PayPalApiError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "No se pudo autorizar el pago PayPal.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo completar la orden PayPal.",
      },
      { status: 500 }
    );
  }
}
