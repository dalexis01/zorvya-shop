/**
 * ZorvyA Shop — branded email HTML templates
 * All CSS inlined for maximum email client compatibility.
 */

import { PICKUP_ADDRESS } from "@/lib/shop/checkout";
import { SRD_PER_USD } from "@/lib/shop/payments";

const STORE_URL = "https://zorvyashop.com";
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PICKUP_ADDRESS + " Paramaribo Suriname")}`;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EmailProduct {
  id: string | number;
  name: string;
  price: number;
  image: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtSrd(value: number) {
  return value.toLocaleString("nl-SR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " SRD";
}

function fmtUsd(srd: number) {
  return "≈ $" + (srd / SRD_PER_USD).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " USD";
}

function fmtPrice(srd: number) {
  return `${fmtSrd(srd)} <span style="color:#888;font-size:11px">${fmtUsd(srd)}</span>`;
}

// ── Shared blocks ─────────────────────────────────────────────────────────────

function emailHeader(subtitle: string) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e">
  <tr>
    <td align="center" style="padding:20px 28px 14px">
      <a href="${STORE_URL}" style="text-decoration:none">
        <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px">
          <tr>
            <td style="background:#1e2d40;border:1px solid rgba(0,196,160,0.25);border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-weight:700;color:#00c4a0;font-size:20px">Z</td>
            <td style="padding-left:10px;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#ffffff"><span style="color:#00c4a0">ZorvyA</span> Shop</td>
          </tr>
        </table>
      </a>
      <p style="margin:0;font-size:11px;color:#4a7090;font-family:sans-serif;letter-spacing:.5px;text-transform:uppercase">${escapeHtml(subtitle)}</p>
    </td>
  </tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:3px;background:linear-gradient(90deg,#00c4a0,#00a8d4)"></td></tr></table>`;
}

function emailFooter(unsubToken?: string) {
  const unsub = unsubToken
    ? `<a href="${STORE_URL}/account/unsubscribe?token=${escapeHtml(unsubToken)}" style="color:#aaa;text-decoration:underline">Cancelar suscripción</a> · `
    : "";
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border-top:1px solid #e0e8f0">
  <tr>
    <td align="center" style="padding:16px 28px">
      <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;line-height:1.8">
        <strong style="color:#555">ZorvyA Shop</strong> · ${escapeHtml(PICKUP_ADDRESS)}, Paramaribo, Suriname<br>
        ${unsub}
        <a href="${STORE_URL}" style="color:#0F6E56;text-decoration:none">Ver tienda</a> ·
        <a href="${STORE_URL}/?openChat=1" style="color:#0F6E56;text-decoration:none">Soporte en vivo</a>
      </p>
    </td>
  </tr>
</table>`;
}

function wrap(body: string, subtitle: string, unsubToken?: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZorvyA Shop</title></head>
<body style="margin:0;padding:0;background:#f1efea;font-family:Georgia,serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1efea">
    <tr>
      <td align="center" style="padding:20px 0">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:540px;width:100%">
          <tr><td>${emailHeader(subtitle)}</td></tr>
          <tr><td style="padding:28px">${body}</td></tr>
          <tr><td>${emailFooter(unsubToken)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;
}

function cta(text: string, href: string, bg = "#0F6E56", fg = "#E1F5EE") {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:14px 0 4px">
    <a href="${href}" style="display:inline-block;background:${bg};color:${fg};border-radius:24px;padding:12px 32px;font-family:sans-serif;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.3px">${escapeHtml(text)}</a>
  </td></tr></table>`;
}

function badge(text: string, bg: string, fg: string) {
  return `<div style="display:inline-block;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;font-family:sans-serif;background:${bg};color:${fg};margin-bottom:14px">${escapeHtml(text)}</div>`;
}

function divider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="height:1px;background:#e0e8f0"></td></tr></table>`;
}

function orderBox(orderId: string) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e0e8f0;border-radius:8px;margin:14px 0">
    <tr><td style="padding:14px 16px">
      <p style="margin:0 0 2px;font-size:11px;font-family:sans-serif;color:#888;text-transform:uppercase;letter-spacing:.5px">Número de pedido</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0a0f1e;font-family:Georgia,serif">#${escapeHtml(orderId.slice(-8).toUpperCase())}</p>
    </td></tr>
  </table>`;
}

function itemRows(items: Array<{ name: string; quantity: number; price: number }>) {
  return items.map(i => `
<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e8f0f8">
  <tr>
    <td style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#333">${escapeHtml(i.name)} × ${i.quantity}</td>
    <td align="right" style="padding:6px 0;font-size:12px;font-family:sans-serif;font-weight:500;color:#0a0f1e;white-space:nowrap">${fmtSrd(i.price * i.quantity)}</td>
  </tr>
</table>`).join("");
}

function totalLine(label: string, amount: number) {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="padding:10px 0 0;font-size:13px;font-family:sans-serif;color:#666">${escapeHtml(label)}</td>
    <td align="right" style="padding:10px 0 0;font-family:sans-serif">
      <span style="font-size:18px;font-weight:700;color:#0F6E56;font-family:Georgia,serif">${fmtSrd(amount)}</span>
      <br><span style="font-size:11px;color:#888">${fmtUsd(amount)}</span>
    </td>
  </tr></table>`;
}

function recoSection(products: EmailProduct[]) {
  if (!products.length) return "";

  // Split into rows of 3
  const rows: EmailProduct[][] = [];
  for (let i = 0; i < products.length; i += 3) {
    rows.push(products.slice(i, i + 3));
  }

  const card = (p: EmailProduct) => `
<td width="33%" style="padding:4px;vertical-align:top">
  <a href="${STORE_URL}/products/${encodeURIComponent(String(p.id))}" style="text-decoration:none;display:block;border:1px solid #e0e8f0;border-radius:8px;overflow:hidden;text-align:center">
    <div style="height:70px;background:#f0f4f8;overflow:hidden">
      ${p.image
        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" width="100%" height="70" style="object-fit:cover;display:block">`
        : `<p style="margin:0;line-height:70px;font-size:28px">📦</p>`}
    </div>
    <div style="padding:6px 4px">
      <p style="margin:0 0 3px;font-size:10px;color:#444;font-family:sans-serif;line-height:1.3">${escapeHtml(p.name)}</p>
      <p style="margin:0;font-size:11px;font-weight:700;color:#0F6E56;font-family:Georgia,serif">${fmtSrd(p.price)}</p>
    </div>
  </a>
</td>`;

  const tableRows = rows.map(row => `<tr>${row.map(card).join("")}</tr>`).join("");

  return `
${divider()}
<p style="font-size:11px;font-family:sans-serif;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin:0 0 12px;text-align:center">También te puede interesar</p>
<table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — Welcome (new account)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildWelcomeEmail(input: {
  name: string;
  recommendations?: EmailProduct[];
}) {
  const body = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;margin:-28px -28px 0;width:calc(100% + 56px)">
  <tr><td align="center" style="padding:24px 28px 20px">
    <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#ffffff;font-family:Georgia,serif">¡Bienvenido, <span style="color:#00c4a0">${escapeHtml(input.name)}</span>!</p>
    <p style="margin:0;font-size:13px;color:#9FE1CB;font-family:sans-serif">Tu cuenta ha sido creada correctamente.</p>
  </td></tr>
</table>
${divider()}
<p style="text-align:center;font-size:13px;font-family:sans-serif;line-height:1.7;color:#444;margin-bottom:14px">
  Estamos muy contentos de tenerte en ZorvyA Shop, tu tienda premium de tecnología y electrodomésticos en Paramaribo. Todo lo que necesitas, en un solo lugar.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0">
  <tr>
    <td width="31%" align="center" style="border:1px solid #e0e8f0;border-radius:8px;padding:12px 6px">
      <p style="margin:0 0 6px;font-size:22px">🚚</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0a0f1e;font-family:sans-serif">Delivery rápido</p>
      <p style="margin:0;font-size:11px;color:#888;font-family:sans-serif">Estimado 48 horas</p>
    </td>
    <td width="4%"></td>
    <td width="31%" align="center" style="border:1px solid #e0e8f0;border-radius:8px;padding:12px 6px">
      <p style="margin:0 0 6px;font-size:22px">💬</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0a0f1e;font-family:sans-serif">Soporte en vivo</p>
      <p style="margin:0;font-size:11px;color:#888;font-family:sans-serif">Chat en tiempo real</p>
    </td>
    <td width="4%"></td>
    <td width="31%" align="center" style="border:1px solid #e0e8f0;border-radius:8px;padding:12px 6px">
      <p style="margin:0 0 6px;font-size:22px">📦</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0a0f1e;font-family:sans-serif">Seguimiento</p>
      <p style="margin:0;font-size:11px;color:#888;font-family:sans-serif">Estado en tiempo real</p>
    </td>
  </tr>
</table>
${cta("Explorar el catálogo", `${STORE_URL}/`)}
${recoSection(input.recommendations ?? [])}`;

  return wrap(body, "Bienvenida");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — Auth code (verification / password reset / change email)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildAuthCodeEmail(input: {
  heading: string;
  body: string;
  code: string;
  name: string;
  expiry: string;
}) {
  const body = `
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 10px;line-height:1.3">${escapeHtml(input.heading)}</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:6px">Hola <strong>${escapeHtml(input.name)}</strong>,</p>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:20px">${escapeHtml(input.body)}</p>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:8px 0 16px">
    <div style="display:inline-block;background:#f7f9fb;border:1px solid #e0e8f0;border-radius:12px;padding:18px 36px;font-size:34px;font-weight:800;letter-spacing:0.25em;color:#0a0f1e;font-family:Georgia,serif">${escapeHtml(input.code)}</div>
  </td></tr>
</table>
<p style="font-size:12px;font-family:sans-serif;color:#888;text-align:center;margin-top:6px">${escapeHtml(input.expiry)}</p>`;

  return wrap(body, "Verificación de cuenta");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — Security notice (password changed, new device, etc.)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildSecurityNoticeEmail(input: {
  heading: string;
  body: string;
  name: string;
  extra?: string;
}) {
  const body = `
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 10px">${escapeHtml(input.heading)}</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:10px">Hola <strong>${escapeHtml(input.name)}</strong>,</p>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">${escapeHtml(input.body)}</p>
${input.extra ? `<p style="font-size:13px;font-family:sans-serif;color:#666;line-height:1.7">${escapeHtml(input.extra)}</p>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f6;border:1px solid #9FE1CB;border-radius:8px;padding:12px 16px;margin-top:16px">
  <tr><td><p style="margin:0;font-size:12px;color:#085041;font-family:sans-serif;text-align:center">¿No reconoces este cambio? <a href="${STORE_URL}/soporte" style="color:#0F6E56;font-weight:700">Contacta soporte de inmediato</a></p></td></tr>
</table>`;

  return wrap(body, "Aviso de seguridad");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 4 — Order confirmation (delivery)
// ═══════════════════════════════════════════════════════════════════════════════

export function buildOrderConfirmationEmail(input: {
  name: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string;
  paymentMethod: string;
  recommendations?: EmailProduct[];
}) {
  const body = `
${badge("✓ Pedido confirmado", "#EAF3DE", "#27500A")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 8px">¡Gracias por tu compra, ${escapeHtml(input.name)}!</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Hemos recibido tu pedido y ya estamos procesándolo. Te notificaremos cuando esté en camino.</p>
${orderBox(input.orderId)}
${itemRows(input.items)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
  <tr>
    <td style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#888">Subtotal</td>
    <td align="right" style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#555">${fmtSrd(input.subtotal)}</td>
  </tr>
  <tr>
    <td style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#888">Delivery</td>
    <td align="right" style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#555">${input.deliveryFee === 0 ? "Gratis" : fmtSrd(input.deliveryFee)}</td>
  </tr>
  <tr>
    <td style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#888">Método de pago</td>
    <td align="right" style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#555">${input.paymentMethod === "cash" ? "Contra entrega" : "PayPal"}</td>
  </tr>
  <tr>
    <td style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#888">Dirección de entrega</td>
    <td align="right" style="padding:5px 0;font-size:12px;font-family:sans-serif;color:#555;max-width:220px">${escapeHtml(input.address)}</td>
  </tr>
</table>
${totalLine("Total pagado", input.total)}
${recoSection(input.recommendations ?? [])}`;

  return wrap(body, "Confirmación de pedido");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 5 — Pickup confirmation
// ═══════════════════════════════════════════════════════════════════════════════

export function buildPickupConfirmationEmail(input: {
  name: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  pickupDate: string;
  pickupTime: string;
  recommendations?: EmailProduct[];
}) {
  const body = `
${badge("📍 Recogida confirmada", "#FAEEDA", "#633806")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 8px">Tu pedido está listo para recoger, ${escapeHtml(input.name)}</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Estará preparado en nuestra tienda en la fecha y hora seleccionada. ¡Te esperamos!</p>
${orderBox(input.orderId)}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#EAF3DE;border:1px solid #C0DD97;border-radius:8px;padding:14px 16px;margin:14px 0">
  <tr>
    <td width="33%" align="center">
      <p style="margin:0 0 4px;font-size:10px;color:#3B6D11;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">Fecha</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#173404;font-family:Georgia,serif">${escapeHtml(input.pickupDate)}</p>
    </td>
    <td width="33%" align="center">
      <p style="margin:0 0 4px;font-size:10px;color:#3B6D11;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">Hora</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#173404;font-family:Georgia,serif">${escapeHtml(input.pickupTime)}</p>
    </td>
    <td width="33%" align="center">
      <p style="margin:0 0 4px;font-size:10px;color:#3B6D11;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">Pedido</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#173404;font-family:Georgia,serif">#${escapeHtml(input.orderId.slice(-4).toUpperCase())}</p>
    </td>
  </tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;border-radius:10px;margin:16px 0">
  <tr><td align="center" style="padding:20px">
    <p style="margin:0 0 8px;font-size:11px;color:#4a7090;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">📍 Dirección de recogida</p>
    <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;font-family:Georgia,serif">${escapeHtml(PICKUP_ADDRESS)}</p>
    <p style="margin:0;font-size:13px;color:#00c4a0;font-family:sans-serif">Paramaribo, Suriname</p>
  </td></tr>
</table>
${cta("Abrir en Google Maps", MAPS_URL, "#185FA5", "#E6F1FB")}
${divider()}
${itemRows(input.items)}
${totalLine("Total", input.total)}
${recoSection(input.recommendations ?? [])}`;

  return wrap(body, "Recogida programada");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 6 — Order cancellation
// ═══════════════════════════════════════════════════════════════════════════════

export function buildCancellationEmail(input: {
  name: string;
  orderId: string;
  reason?: string;
  recommendations?: EmailProduct[];
}) {
  const body = `
${badge("✕ Pedido cancelado", "#FCEBEB", "#791F1F")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 8px">Tu pedido ha sido cancelado</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">
  Hola ${escapeHtml(input.name)}, confirmamos que tu pedido <strong>#${escapeHtml(input.orderId.slice(-8).toUpperCase())}</strong> fue cancelado${input.reason ? " por el siguiente motivo:" : " conforme a tu solicitud."}</p>
${input.reason ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCEBEB;border:1px solid #F7C1C1;border-radius:8px;margin:12px 0"><tr><td style="padding:14px 16px;text-align:center"><p style="color:#791F1F;font-size:13px;font-family:sans-serif;margin:0;line-height:1.6">${escapeHtml(input.reason)}</p></td></tr></table>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCEBEB;border:1px solid #F7C1C1;border-radius:8px;margin:12px 0">
  <tr><td style="padding:14px 16px;text-align:center"><p style="color:#791F1F;font-size:13px;font-family:sans-serif;margin:0;line-height:1.6">Si realizaste un pago, el reembolso se procesará en un plazo de 3 a 5 días hábiles.</p></td></tr>
</table>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">¿La cancelación fue un error? Nuestro equipo de soporte puede ayudarte ahora mismo.</p>
${cta("Contactar soporte", `${STORE_URL}/?openChat=1`, "#A32D2D", "#FCEBEB")}
${cta("Hacer un nuevo pedido", `${STORE_URL}/`, "#0a0f1e", "#00c4a0")}
${recoSection(input.recommendations ?? [])}`;

  return wrap(body, "Actualización de pedido");
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE 7 — Order in delivery / shipped
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDeliveryEmail(input: {
  name: string;
  orderId: string;
  address: string;
  estimatedTime?: string;
  recommendations?: EmailProduct[];
}) {
  const body = `
${badge("🚚 Tu pedido está en camino", "#E6F1FB", "#0C447C")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 8px">¡Tu pedido salió, ${escapeHtml(input.name)}!</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Tu pedido <strong>#${escapeHtml(input.orderId.slice(-8).toUpperCase())}</strong> está en ruta hacia tu dirección.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
  <tr>
    <td align="center" width="23%"><div style="width:28px;height:28px;border-radius:50%;background:#0F6E56;border:2px solid #0F6E56;margin:0 auto 6px;text-align:center;line-height:24px;color:#E1F5EE;font-size:12px;font-family:sans-serif;font-weight:700">✓</div><p style="margin:0;font-size:10px;font-family:sans-serif;color:#0F6E56;font-weight:700;text-align:center">Confirmado</p></td>
    <td style="height:2px;background:#0F6E56;vertical-align:middle"></td>
    <td align="center" width="23%"><div style="width:28px;height:28px;border-radius:50%;background:#0F6E56;border:2px solid #0F6E56;margin:0 auto 6px;text-align:center;line-height:24px;color:#E1F5EE;font-size:12px;font-family:sans-serif;font-weight:700">✓</div><p style="margin:0;font-size:10px;font-family:sans-serif;color:#0F6E56;font-weight:700;text-align:center">Procesado</p></td>
    <td style="height:2px;background:#185FA5;vertical-align:middle"></td>
    <td align="center" width="23%"><div style="width:28px;height:28px;border-radius:50%;background:#185FA5;border:2px solid #185FA5;margin:0 auto 6px;text-align:center;line-height:24px;color:#E6F1FB;font-size:13px">🚚</div><p style="margin:0;font-size:10px;font-family:sans-serif;color:#185FA5;font-weight:700;text-align:center">En camino</p></td>
    <td style="height:2px;background:#e0e8f0;vertical-align:middle"></td>
    <td align="center" width="23%"><div style="width:28px;height:28px;border-radius:50%;background:#f0f4f8;border:2px solid #e0e8f0;margin:0 auto 6px;text-align:center;line-height:24px;color:#aaa;font-size:13px">🏠</div><p style="margin:0;font-size:10px;font-family:sans-serif;color:#aaa;text-align:center">Entregado</p></td>
  </tr>
</table>

${input.estimatedTime ? `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#E6F1FB;border:1px solid #B5D4F4;border-radius:8px;padding:12px 16px;margin:14px 0">
  <tr><td>
    <p style="margin:0 0 2px;font-size:11px;color:#185FA5;font-family:sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.5px">⏱ Hora estimada de entrega</p>
    <p style="margin:0;font-size:18px;font-weight:700;color:#0C447C;font-family:Georgia,serif">${escapeHtml(input.estimatedTime)}</p>
  </td></tr>
</table>` : ""}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e0e8f0;border-radius:8px;margin:14px 0">
  <tr><td style="padding:14px 16px">
    <p style="margin:0 0 2px;font-size:11px;font-family:sans-serif;color:#888;text-transform:uppercase;letter-spacing:.5px">Dirección de entrega</p>
    <p style="margin:0;font-size:14px;font-family:sans-serif;font-weight:500;color:#333">${escapeHtml(input.address)}</p>
  </td></tr>
</table>

${cta("Rastrear pedido en tiempo real", `${STORE_URL}/account/orders/${encodeURIComponent(input.orderId)}`)}
${recoSection(input.recommendations ?? [])}`;

  return wrap(body, "Seguimiento de pedido");
}
