import "server-only";

import { Resend } from "resend";

import { formatPickupLabel, PICKUP_ADDRESS } from "@/lib/shop/checkout";
import { formatCurrencySrd as formatCurrency } from "@/lib/shop/number-format";
import type { OrderIssueReport, OrderLineItem, StoredOrder } from "@/lib/shop/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderItems(order: Pick<StoredOrder, "items">) {
  return order.items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      return `<li>${item.quantity} x ${escapeHtml(item.name)} - ${formatCurrency(lineTotal)}</li>`;
    })
    .join("");
}

function renderLineItems(items: OrderLineItem[]) {
  return items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      return `<li>${item.quantity} x ${escapeHtml(item.name)} - ${formatCurrency(lineTotal)}</li>`;
    })
    .join("");
}

function renderAgentCallBlock(order: StoredOrder) {
  if (!order.requestedAgentCall) {
    return "";
  }

  return `
    <p style="margin: 12px 0; color: #0f766e; font-weight: 700;">
      Un agente se pondra en contacto con usted para confirmar la orden.
    </p>
  `;
}

function renderPickupBlock(order: StoredOrder) {
  if (order.deliveryType !== "pickup" || !order.pickupDate || !order.pickupTime) {
    return "";
  }

  return `
    <p><strong>Fecha y hora de recogida:</strong> ${escapeHtml(
      formatPickupLabel(order.pickupDate, order.pickupTime)
    )}</p>
    <p><strong>Direccion de recogida:</strong> ${escapeHtml(PICKUP_ADDRESS)}</p>
  `;
}

function renderPayPalBlock(order: StoredOrder) {
  if (order.payment.method !== "paypal") {
    return "";
  }

  if (order.payment.state === "authorized") {
    return `
      <p style="margin: 12px 0; color: #1d4ed8; font-weight: 700;">
        Su pago PayPal fue autorizado y su pedido quedo pendiente de confirmacion de stock.
      </p>
    `;
  }

  if (order.payment.state === "captured") {
    return `
      <p style="margin: 12px 0; color: #166534; font-weight: 700;">
        Su pago PayPal ya fue capturado correctamente.
      </p>
    `;
  }

  return "";
}

function getEmailConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL ?? "",
    adminEmail:
      process.env.ORDER_RECEIVER_EMAIL || process.env.RESEND_FROM_EMAIL || "",
  };
}

async function sendAdminEmail(subject: string, html: string) {
  const warnings: string[] = [];
  const { apiKey, fromEmail, adminEmail } = getEmailConfig();

  if (!apiKey) {
    warnings.push("RESEND_API_KEY no esta configurada.");
    return { warnings, sent: false };
  }

  if (!fromEmail) {
    warnings.push("RESEND_FROM_EMAIL no esta configurada.");
    return { warnings, sent: false };
  }

  if (!adminEmail) {
    warnings.push("No hay correo configurado para el administrador.");
    return {
      warnings,
      sent: false,
    };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject,
      html,
    });

    return {
      warnings,
      sent: true,
    };
  } catch {
    warnings.push("No se pudo enviar el correo al administrador.");
    return {
      warnings,
      sent: false,
    };
  }
}

function buildClientHtml(order: StoredOrder) {
  const deliveryLabel =
    order.deliveryType === "delivery" ? "Delivery a domicilio" : "Recogida programada";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>${order.payment.method === "paypal" ? "Pedido recibido" : "Orden confirmada"}</h2>
      <p>Hola ${escapeHtml(order.customerName)},</p>
      <p>Su pedido ${escapeHtml(order.id)} fue registrado correctamente.</p>
      <p>Gracias por confiar en nosotros.</p>
      ${renderPayPalBlock(order)}
      ${renderAgentCallBlock(order)}
      <p><strong>Tipo de entrega:</strong> ${deliveryLabel}</p>
      ${renderPickupBlock(order)}
      <p><strong>Direccion del cliente:</strong> ${escapeHtml(order.customerAddress)}</p>
      <ul>${renderItems(order)}</ul>
      <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
      ${
        order.deliveryType === "delivery"
          ? `<p><strong>Costo delivery:</strong> ${formatCurrency(order.deliveryFee)}</p>`
          : ""
      }
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
      <p>Los detalles de tu pedido fueron enviados a tu correo electronico.</p>
    </div>
  `;
}

function buildAdminOrderHtml(order: StoredOrder) {
  const deliveryLabel =
    order.deliveryType === "delivery" ? "Delivery a domicilio" : "Recogida programada";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>Nuevo pedido recibido</h2>
      <p><strong>ID:</strong> ${escapeHtml(order.id)}</p>
      <p><strong>Fecha:</strong> ${escapeHtml(new Date(order.createdAt).toLocaleString())}</p>
      <p><strong>Cliente:</strong> ${escapeHtml(order.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(order.customerPhone)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(order.customerEmail || "No indicado")}</p>
      <p><strong>Direccion del cliente:</strong> ${escapeHtml(order.customerAddress)}</p>
      <p><strong>Tipo de entrega:</strong> ${deliveryLabel}</p>
      ${renderPayPalBlock(order)}
      ${renderPickupBlock(order)}
      <p><strong>Solicito hablar con un agente:</strong> ${
        order.requestedAgentCall ? "Si" : "No"
      }</p>
      ${
        order.requestedAgentCall
          ? `<p style="color: #0f766e; font-weight: 700;">Llamada de confirmacion requerida.</p>`
          : ""
      }
      <ul>${renderItems(order)}</ul>
      <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
      ${
        order.deliveryType === "delivery"
          ? `<p><strong>Costo delivery:</strong> ${formatCurrency(order.deliveryFee)}</p>`
          : ""
      }
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    </div>
  `;
}

function buildAdminChangeHtml(input: {
  title: string;
  order: StoredOrder;
  changes: string[];
  extraHtml?: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>${escapeHtml(input.title)}</h2>
      <p><strong>Pedido:</strong> ${escapeHtml(input.order.id)}</p>
      <p><strong>Cliente:</strong> ${escapeHtml(input.order.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(input.order.customerPhone)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(input.order.customerEmail || "No indicado")}</p>
      <p><strong>Fecha de actualizacion:</strong> ${escapeHtml(
        new Date(input.order.updatedAt).toLocaleString()
      )}</p>
      <ul>${input.changes.map((change) => `<li>${escapeHtml(change)}</li>`).join("")}</ul>
      ${input.extraHtml ?? ""}
      <p><strong>Direccion actual:</strong> ${escapeHtml(input.order.customerAddress)}</p>
      ${renderPickupBlock(input.order)}
      <ul>${renderItems(input.order)}</ul>
      <p><strong>Total actual:</strong> ${formatCurrency(input.order.total)}</p>
    </div>
  `;
}

function buildAdminIssueHtml(order: StoredOrder, issue: OrderIssueReport) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>Problema reportado en el pedido</h2>
      <p><strong>Pedido:</strong> ${escapeHtml(order.id)}</p>
      <p><strong>Cliente:</strong> ${escapeHtml(order.customerName)}</p>
      <p><strong>Telefono:</strong> ${escapeHtml(order.customerPhone)}</p>
      <p><strong>Correo:</strong> ${escapeHtml(order.customerEmail || "No indicado")}</p>
      <p><strong>Fecha del reporte:</strong> ${escapeHtml(
        new Date(issue.createdAt).toLocaleString()
      )}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${escapeHtml(issue.message)}</p>
      <p><strong>Direccion del pedido:</strong> ${escapeHtml(order.customerAddress)}</p>
      ${renderPickupBlock(order)}
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    </div>
  `;
}

function buildOrderCancellationClientHtml(order: StoredOrder, reason: string) {
  const deliveryLabel =
    order.deliveryType === "delivery" ? "Delivery a domicilio" : "Recogida programada";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <h2>Pedido cancelado</h2>
      <p>Hola ${escapeHtml(order.customerName)},</p>
      <p>Su pedido ${escapeHtml(order.id)} fue cancelado.</p>
      <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
      <p><strong>Tipo de entrega:</strong> ${escapeHtml(deliveryLabel)}</p>
      ${renderPickupBlock(order)}
      <p><strong>Direccion del pedido:</strong> ${escapeHtml(order.customerAddress)}</p>
      <ul>${renderItems(order)}</ul>
      <p><strong>Subtotal:</strong> ${formatCurrency(order.subtotal)}</p>
      ${
        order.deliveryType === "delivery"
          ? `<p><strong>Costo delivery:</strong> ${formatCurrency(order.deliveryFee)}</p>`
          : ""
      }
      <p><strong>Total:</strong> ${formatCurrency(order.total)}</p>
    </div>
  `;
}

export async function sendOrderEmails(order: StoredOrder) {
  const warnings: string[] = [];
  const { apiKey, fromEmail, adminEmail } = getEmailConfig();

  if (!apiKey) {
    warnings.push("RESEND_API_KEY no esta configurada.");
    return {
      warnings,
      clientEmailSent: false,
      adminEmailSent: false,
    };
  }

  const resend = new Resend(apiKey);
  let clientEmailSent = false;
  let adminEmailSent = false;

  if (order.customerEmail) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: order.customerEmail,
        subject: `Orden confirmada ${order.id}`,
        html: buildClientHtml(order),
      });
      clientEmailSent = true;
    } catch {
      warnings.push("No se pudo enviar el correo al cliente.");
    }
  }

  if (adminEmail) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: adminEmail,
        subject: `Nuevo pedido ${order.id}`,
        html: buildAdminOrderHtml(order),
      });
      adminEmailSent = true;
    } catch {
      warnings.push("No se pudo enviar el correo al administrador.");
    }
  } else {
    warnings.push("No hay correo configurado para el administrador.");
  }

  return {
    warnings,
    clientEmailSent,
    adminEmailSent,
  };
}

export async function sendAdminOrderChangeEmail(input: {
  order: StoredOrder;
  title: string;
  changes: string[];
  addedItems?: OrderLineItem[];
}) {
  const extraHtml =
    input.addedItems && input.addedItems.length > 0
      ? `<p><strong>Articulos agregados:</strong></p><ul>${renderLineItems(input.addedItems)}</ul>`
      : "";

  return sendAdminEmail(
    `${input.title} - ${input.order.id}`,
    buildAdminChangeHtml({
      title: input.title,
      order: input.order,
      changes: input.changes,
      extraHtml,
    })
  );
}

export async function sendAdminOrderIssueEmail(order: StoredOrder, issue: OrderIssueReport) {
  return sendAdminEmail(
    `Problema reportado en ${order.id}`,
    buildAdminIssueHtml(order, issue)
  );
}

export async function sendOrderCancellationEmail(order: StoredOrder, reason: string) {
  const warnings: string[] = [];
  const { apiKey, fromEmail } = getEmailConfig();

  if (!apiKey) {
    warnings.push("RESEND_API_KEY no esta configurada.");
    return {
      warnings,
      clientEmailSent: false,
    };
  }

  if (!order.customerEmail) {
    warnings.push("El pedido no tiene correo de cliente.");
    return {
      warnings,
      clientEmailSent: false,
    };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: order.customerEmail,
      subject: `Pedido cancelado ${order.id}`,
      html: buildOrderCancellationClientHtml(order, reason),
    });

    return {
      warnings,
      clientEmailSent: true,
    };
  } catch {
    warnings.push("No se pudo enviar el correo de cancelacion al cliente.");
    return {
      warnings,
      clientEmailSent: false,
    };
  }
}
