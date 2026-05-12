import { NextResponse } from "next/server";

import { prepareOrderPlacement } from "@/lib/server/order-placement";
import {
  createPayPalCheckoutOrder,
  isPayPalConfigured,
  PayPalApiError,
  PayPalConfigurationError,
} from "@/lib/server/paypal";
import { getCurrentUser } from "@/lib/server/session";

export async function POST(request: Request) {
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

    const order = await createPayPalCheckoutOrder({
      amountUsd: validation.data.paymentPayableUsd,
      description: `Pedido ZorvyA Shop - ${validation.data.items.length} articulo(s)`,
    });

    return NextResponse.json({
      success: true,
      paypalOrderId: order.id,
      amountUsd: validation.data.paymentPayableUsd,
      totalSrd: validation.data.paymentGrandTotalSrd,
      displayCurrency: validation.data.paypalDisplayCurrency,
    });
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
          error: error.message || "No se pudo crear la orden PayPal.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo iniciar el pago PayPal.",
      },
      { status: 500 }
    );
  }
}
