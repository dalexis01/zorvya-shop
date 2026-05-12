import { NextResponse } from "next/server";

import { getAdminOrderById } from "@/lib/server/admin/orders";
import { createStatusLog } from "@/lib/server/admin/logs";
import { sendOrderCancellationEmail } from "@/lib/server/order-email";
import {
  capturePayPalAuthorization,
  PayPalApiError,
  PayPalConfigurationError,
  voidPayPalAuthorization,
} from "@/lib/server/paypal";
import { requireAdminRequestUser } from "@/lib/server/admin/request-auth";
import { validateAdminOrderCancellationPayload } from "@/lib/server/validation";
import { ADMIN_ORDER_STATUS_OPTIONS } from "@/lib/shop/order-status";
import {
  cancelOrderFromAdmin,
  getOrderById,
  markOrderReviewed,
  setAdminOrderStatus,
} from "@/lib/server/orders";
import type { OrderPaymentInfo } from "@/lib/shop/types";

export const dynamic = "force-dynamic";

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
    const order = await getAdminOrderById(id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Failed to get admin order:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get order",
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
    const payload = (await request.json()) as
      | { action: "mark-reviewed" }
      | { action: "update-status"; status: string }
      | { action: "cancel-order"; reason?: unknown };

    if (payload.action === "mark-reviewed") {
      const order = await markOrderReviewed(id);
      const adminOrder = await getAdminOrderById(order.id);

      return NextResponse.json({
        success: true,
        order: adminOrder,
      });
    }

    if (payload.action === "cancel-order") {
      const validation = validateAdminOrderCancellationPayload(payload);

      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid cancellation reason",
            errors: validation.errors,
          },
          { status: 400 }
        );
      }

      const existingOrder = await getOrderById(id);

      if (!existingOrder) {
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        );
      }

      let paymentUpdate: Partial<OrderPaymentInfo> | undefined = undefined;

      if (
        existingOrder.payment.method === "paypal" &&
        existingOrder.payment.state === "authorized" &&
        existingOrder.payment.paypalAuthorizationId
      ) {
        await voidPayPalAuthorization(existingOrder.payment.paypalAuthorizationId);
        paymentUpdate = {
          state: "voided" as const,
          paypalAuthorizationStatus: "VOIDED",
          voidedAt: new Date().toISOString(),
          failureReason: validation.data.reason,
        };
      }

      const result = await cancelOrderFromAdmin({
        orderId: id,
        reason: validation.data.reason,
        changedBy: auth.user.id,
        changedByName: auth.user.name,
        paymentUpdate,
      });

      await createStatusLog({
        type: "order",
        targetId: id,
        action: "status_changed",
        changedBy: auth.user.id,
        changedByName: auth.user.name,
        changes: [
          {
            field: "status",
            oldValue: result.previousOrder.adminStatus ?? "automatic",
            newValue: "Pedido cancelado",
          },
          {
            field: "cancelledAt",
            oldValue: result.previousOrder.cancelledAt,
            newValue: result.updatedOrder.cancelledAt,
          },
          {
            field: "cancellationReason",
            oldValue: result.previousOrder.cancellationReason,
            newValue: result.updatedOrder.cancellationReason,
          },
        ],
      });

      const emailResult = await sendOrderCancellationEmail(
        result.updatedOrder,
        validation.data.reason
      );
      const adminOrder = await getAdminOrderById(id);

      return NextResponse.json({
        success: true,
        order: adminOrder,
        warnings: emailResult.warnings,
      });
    }

    if (
      payload.action === "update-status" &&
      typeof payload.status === "string" &&
      ADMIN_ORDER_STATUS_OPTIONS.includes(payload.status as (typeof ADMIN_ORDER_STATUS_OPTIONS)[number])
    ) {
      const existingOrder = await getOrderById(id);

      if (!existingOrder) {
        return NextResponse.json(
          { success: false, error: "Order not found" },
          { status: 404 }
        );
      }

      let paymentUpdate: Partial<OrderPaymentInfo> | undefined = undefined;

      if (
        payload.status === "Pagada / Preparando" &&
        existingOrder.payment.method === "paypal" &&
        existingOrder.payment.state === "authorized" &&
        existingOrder.payment.paypalAuthorizationId
      ) {
        try {
          const capture = await capturePayPalAuthorization({
            authorizationId: existingOrder.payment.paypalAuthorizationId,
            invoiceId: existingOrder.id,
            noteToPayer: "Pago confirmado por ZorvyA Shop.",
          });

          paymentUpdate = {
            state: "captured" as const,
            paypalCaptureId: capture.id,
            paypalCaptureStatus: capture.status,
            capturedAt: new Date().toISOString(),
            failureReason: null,
          };
        } catch (error) {
          const failureReason =
            error instanceof Error
              ? error.message
              : "El cobro PayPal no pudo completarse.";

          if (existingOrder.payment.paypalAuthorizationId) {
            await voidPayPalAuthorization(existingOrder.payment.paypalAuthorizationId).catch(
              () => undefined
            );
          }

          const cancelledOrder = await cancelOrderFromAdmin({
            orderId: id,
            reason:
              "El cobro PayPal no pudo completarse y la orden fue cancelada automaticamente.",
            changedBy: auth.user.id,
            changedByName: auth.user.name,
            paymentUpdate: {
              state: "failed",
              paypalAuthorizationStatus: "VOIDED",
              voidedAt: new Date().toISOString(),
              failureReason,
            },
          });

          await createStatusLog({
            type: "order",
            targetId: id,
            action: "status_changed",
            changedBy: auth.user.id,
            changedByName: auth.user.name,
            changes: [
              {
                field: "status",
                oldValue: existingOrder.adminStatus ?? "automatic",
                newValue: "Pedido cancelado",
              },
              {
                field: "payment",
                oldValue: existingOrder.payment.state,
                newValue: "failed",
              },
            ],
          });

          await sendOrderCancellationEmail(
            cancelledOrder.updatedOrder,
            "El cobro PayPal no pudo completarse y la orden fue cancelada automaticamente."
          );

          const adminOrder = await getAdminOrderById(id);

          return NextResponse.json(
            {
              success: false,
              error: failureReason,
              order: adminOrder,
            },
            { status: 409 }
          );
        }
      }

      const result = await setAdminOrderStatus({
        orderId: id,
        status: payload.status as (typeof ADMIN_ORDER_STATUS_OPTIONS)[number],
        changedBy: auth.user.id,
        changedByName: auth.user.name,
        paymentUpdate,
      });

      await createStatusLog({
        type: "order",
        targetId: id,
        action: "status_changed",
        changedBy: auth.user.id,
        changedByName: auth.user.name,
        changes: [
          {
            field: "status",
            oldValue: result.previousOrder.adminStatus,
            newValue: result.updatedOrder.adminStatus,
          },
        ],
      });

      const adminOrder = await getAdminOrderById(id);

      return NextResponse.json({
        success: true,
        order: adminOrder,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid order action",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "ORDER_ALREADY_CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Order already cancelled" },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "ORDER_PAYPAL_ALREADY_CAPTURED") {
      return NextResponse.json(
        {
          success: false,
          error: "La orden PayPal ya fue cobrada. Requiere manejo manual antes de cancelarla.",
        },
        { status: 409 }
      );
    }

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
          error: error.message || "No se pudo completar la operacion con PayPal.",
        },
        { status: 502 }
      );
    }

    console.error("Failed to update admin order:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update order",
      },
      { status: 500 }
    );
  }
}
