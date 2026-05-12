import { NextResponse } from "next/server";

import { formatCurrencySrd } from "@/lib/shop/number-format";
import { toOrderSummary } from "@/lib/shop/order-status";
import { createSupportMessage } from "@/lib/server/admin/support";
import {
  addItemsToOrderForUser,
  cancelOrderForUser,
  getOrderById,
  reportOrderIssueForUser,
  toClientSafeStoredOrder,
  updateOrderContactForUser,
} from "@/lib/server/orders";
import {
  sendAdminOrderChangeEmail,
  sendAdminOrderIssueEmail,
} from "@/lib/server/order-email";
import {
  PayPalApiError,
  PayPalConfigurationError,
  voidPayPalAuthorization,
} from "@/lib/server/paypal";
import { getCurrentUser } from "@/lib/server/session";
import { updateUserContact } from "@/lib/server/users";
import {
  validateAdditionalItemsPayload,
  validateOrderContactUpdatePayload,
  validateOrderIssuePayload,
} from "@/lib/server/validation";

type OrderUpdateBody =
  | {
      action: "cancel";
    }
  | {
      action: "add-items";
      products: unknown;
    }
  | {
      action: "update-contact";
      phone?: unknown;
      address?: unknown;
    }
  | {
      action: "report-issue";
      message?: unknown;
    };

function errorResponse(status: number, error: string, errors?: Record<string, string[]>) {
  return NextResponse.json(
    {
      success: false,
      error,
      errors,
    },
    { status }
  );
}

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/account/orders/[orderId]">
) {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse(401, "No autorizado.");
  }

  const { orderId } = await context.params;

  try {
    const body = (await request.json()) as OrderUpdateBody;

    if (body.action === "cancel") {
      const currentOrder = await getOrderById(orderId);

      if (!currentOrder || currentOrder.userId !== user.id) {
        return errorResponse(404, "Pedido no encontrado.");
      }

      if (
        currentOrder.payment.method === "paypal" &&
        currentOrder.payment.state === "authorized" &&
        currentOrder.payment.paypalAuthorizationId
      ) {
        await voidPayPalAuthorization(currentOrder.payment.paypalAuthorizationId);
      }

      const result = await cancelOrderForUser(orderId, user.id);

      await sendAdminOrderChangeEmail({
        order: result.updatedOrder,
        title: "Pedido cancelado por el cliente",
        changes: [
          "Estado anterior: Activo.",
          "Estado actual: Pedido cancelado.",
        ],
      });

      return NextResponse.json({
        success: true,
        order: toOrderSummary(toClientSafeStoredOrder(result.updatedOrder), false),
      });
    }

    if (body.action === "add-items") {
      const validation = validateAdditionalItemsPayload(body.products);

      if (!validation.success) {
        return errorResponse(
          400,
          "No se pudieron validar los articulos seleccionados.",
          validation.errors
        );
      }

      const result = await addItemsToOrderForUser(orderId, user.id, validation.data);

      await sendAdminOrderChangeEmail({
        order: result.updatedOrder,
        title: "Articulos agregados al pedido",
        changes: [
          `Subtotal anterior: ${formatCurrencySrd(result.previousOrder.subtotal)}.`,
          `Subtotal actual: ${formatCurrencySrd(result.updatedOrder.subtotal)}.`,
          `Delivery anterior: ${formatCurrencySrd(result.previousOrder.deliveryFee)}.`,
          `Delivery actual: ${formatCurrencySrd(result.updatedOrder.deliveryFee)}.`,
          `Total anterior: ${formatCurrencySrd(result.previousOrder.total)}.`,
          `Total actual: ${formatCurrencySrd(result.updatedOrder.total)}.`,
        ],
        addedItems: result.addedItems,
      });

      return NextResponse.json({
        success: true,
        order: toOrderSummary(toClientSafeStoredOrder(result.updatedOrder), false),
      });
    }

    if (body.action === "update-contact") {
      const validation = validateOrderContactUpdatePayload(body);

      if (!validation.success) {
        return errorResponse(
          400,
          "No se pudieron validar los cambios del pedido.",
          validation.errors
        );
      }

      const result = await updateOrderContactForUser(orderId, user.id, validation.data);

      await updateUserContact(user.id, {
        phone: result.updatedOrder.customerPhone,
        address: result.updatedOrder.customerAddress,
      });

      const changes: string[] = [];

      if (result.previousOrder.customerPhone !== result.updatedOrder.customerPhone) {
        changes.push(
          `Telefono anterior: ${result.previousOrder.customerPhone}. Telefono actual: ${result.updatedOrder.customerPhone}.`
        );
      }

      if (result.previousOrder.customerAddress !== result.updatedOrder.customerAddress) {
        changes.push(
          `Direccion anterior: ${result.previousOrder.customerAddress}. Direccion actual: ${result.updatedOrder.customerAddress}.`
        );
      }

      if (result.previousOrder.deliveryFee !== result.updatedOrder.deliveryFee) {
        changes.push(
          `Delivery anterior: ${formatCurrencySrd(result.previousOrder.deliveryFee)}. Delivery actual: ${formatCurrencySrd(result.updatedOrder.deliveryFee)}.`
        );
      }

      if (result.previousOrder.total !== result.updatedOrder.total) {
        changes.push(
          `Total anterior: ${formatCurrencySrd(result.previousOrder.total)}. Total actual: ${formatCurrencySrd(result.updatedOrder.total)}.`
        );
      }

      await sendAdminOrderChangeEmail({
        order: result.updatedOrder,
        title: "Datos del pedido modificados por el cliente",
        changes,
      });

      return NextResponse.json({
        success: true,
        order: toOrderSummary(toClientSafeStoredOrder(result.updatedOrder), false),
      });
    }

    if (body.action === "report-issue") {
      const validation = validateOrderIssuePayload(body);

      if (!validation.success) {
        return errorResponse(
          400,
          "No se pudo registrar el problema del pedido.",
          validation.errors
        );
      }

      const result = await reportOrderIssueForUser(orderId, user.id, validation.data.message);
      const supportContext = [
        `Problema reportado con el pedido ${result.updatedOrder.id}`,
        `Pedido: ${result.updatedOrder.id}`,
        `Cliente: ${result.updatedOrder.customerName}`,
        `Telefono: ${result.updatedOrder.customerPhone || "-"}`,
        `Correo: ${result.updatedOrder.customerEmail || "-"}`,
        `Direccion: ${result.updatedOrder.customerAddress || "-"}`,
        `Entrega: ${result.updatedOrder.deliveryType}`,
        `Estado: ${result.updatedOrder.statusHistory.at(-1)?.status ?? result.updatedOrder.adminStatus ?? "Activo"}`,
        "Articulos:",
        ...result.updatedOrder.items.map((item) => {
          const details = [item.selectedVariantName, item.selectedColor].filter(Boolean).join(" / ");
          return `- ${item.quantity}x ${item.name}${details ? ` [${details}]` : ""}`;
        }),
        "",
        "Mensaje del cliente:",
        validation.data.message,
      ].join("\n");

      await sendAdminOrderIssueEmail(result.updatedOrder, result.issue);
      await createSupportMessage({
        customerId: user.id,
        customerName: result.updatedOrder.customerName || user.name,
        customerEmail: result.updatedOrder.customerEmail || user.email,
        customerPhone: result.updatedOrder.customerPhone || user.phone,
        orderId: result.updatedOrder.id,
        subject: `Problema reportado con el pedido ${result.updatedOrder.id}`,
        message: supportContext,
        category: "other",
        priority: "high",
        source: "chatbot",
      });

      return NextResponse.json({
        success: true,
        order: toOrderSummary(toClientSafeStoredOrder(result.updatedOrder), false),
      });
    }

    return errorResponse(400, "Accion de pedido no valida.");
  } catch (error) {
    if (!(error instanceof Error)) {
      return errorResponse(500, "No se pudo actualizar el pedido.");
    }

    if (error.message === "ORDER_NOT_FOUND") {
      return errorResponse(404, "Pedido no encontrado.");
    }

    if (error.message === "ORDER_ALREADY_CANCELLED") {
      return errorResponse(409, "El pedido ya fue cancelado.");
    }

    if (error.message === "ORDER_PAYPAL_ALREADY_CAPTURED") {
      return errorResponse(
        409,
        "Este pedido PayPal ya fue cobrado y ya no puede cancelarse desde aqui."
      );
    }

    if (error.message === "ORDER_EDIT_WINDOW_EXPIRED") {
      return errorResponse(409, "Este pedido ya no puede modificarse.");
    }

    if (error.message === "ORDER_NO_CHANGES") {
      return errorResponse(400, "No se detectaron cambios validos en el pedido.");
    }

    if (error.message === "ORDER_PAYPAL_LOCKED") {
      return errorResponse(
        409,
        "Este pedido PayPal ya no puede modificarse porque el pago esta en proceso."
      );
    }

    if (error instanceof PayPalConfigurationError) {
      return errorResponse(503, "PayPal todavia no esta configurado en el servidor.");
    }

    if (error instanceof PayPalApiError) {
      return errorResponse(502, error.message || "No se pudo completar la operacion con PayPal.");
    }

    if (error.message === "ORDER_DELIVERY_UNAVAILABLE") {
      return errorResponse(
        400,
        "Todavia no tenemos delivery disponible en tu zona."
      );
    }

    return errorResponse(500, "No se pudo actualizar el pedido.");
  }
}
