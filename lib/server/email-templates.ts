/**
 * ZorvyA Shop — email HTML templates
 * All styles are inlined for maximum email client compatibility.
 */

// ── Shared helpers ────────────────────────────────────────────────────────────

export function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function header(subtitle: string) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e">
  <tr>
    <td align="center" style="padding:20px 28px 16px">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#1e2d40;border:1px solid #00c4a040;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;font-family:Georgia,serif;font-weight:700;color:#00c4a0;font-size:20px">Z</td>
          <td style="padding-left:10px;font-family:Georgia,serif;font-size:18px;font-weight:700;color:#ffffff"><span style="color:#00c4a0">ZorvyA</span> Shop</td>
        </tr>
      </table>
      <p style="margin:8px 0 0;font-size:11px;color:#4a7090;font-family:sans-serif;letter-spacing:.5px">${subtitle}</p>
    </td>
  </tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="height:3px;background:linear-gradient(90deg,#00c4a0,#00a8d4)"></td></tr>
</table>`;
}

function footer(extra = "") {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border-top:1px solid #e0e8f0">
  <tr>
    <td align="center" style="padding:16px 28px">
      <p style="margin:0;font-size:11px;color:#aaa;font-family:sans-serif;line-height:1.6">
        ZorvyA Shop · Anton Dragtenweg 145, Paramaribo, Suriname<br>
        ${extra}
        <a href="https://zorvya.com" style="color:#0F6E56;text-decoration:none">Ver tienda</a> ·
        <a href="https://zorvya.com/soporte" style="color:#0F6E56;text-decoration:none">Soporte en vivo</a>
      </p>
    </td>
  </tr>
</table>`;
}

function wrap(bodyContent: string, subtitle: string, footerExtra = "") {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1efea">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1efea">
    <tr>
      <td align="center" style="padding:20px 0">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;font-family:Georgia,serif;color:#1a1a1a;max-width:520px">
          <tr><td>${header(subtitle)}</td></tr>
          <tr><td style="padding:28px">${bodyContent}</td></tr>
          <tr><td>${footer(footerExtra)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function orderNumberBox(orderId: string) {
  const tail = orderId.slice(-8).toUpperCase();
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e0e8f0;border-radius:8px;margin:14px 0">
  <tr>
    <td style="padding:14px 16px">
      <p style="margin:0 0 2px;font-size:11px;font-family:sans-serif;color:#888;text-transform:uppercase;letter-spacing:.5px">Número de pedido</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0a0f1e;font-family:Georgia,serif">#${escapeHtml(tail)}</p>
    </td>
  </tr>
</table>`;
}

function itemRows(items: Array<{ name: string; quantity: number; price: number }>) {
  return items.map(i => `
<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e8f0f8">
  <tr>
    <td style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#333">${escapeHtml(i.name)} × ${i.quantity}</td>
    <td align="right" style="padding:6px 0;font-size:12px;font-family:sans-serif;font-weight:500;color:#0a0f1e">${formatSrd(i.price * i.quantity)}</td>
  </tr>
</table>`).join("");
}

function totalRow(label: string, amount: number) {
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding:10px 0 0;font-size:13px;font-family:sans-serif;color:#666">${escapeHtml(label)}</td>
    <td align="right" style="padding:10px 0 0;font-size:18px;font-weight:700;color:#0F6E56;font-family:Georgia,serif">${formatSrd(amount)}</td>
  </tr>
</table>`;
}

function ctaButton(text: string, href: string, color = "#0F6E56", textColor = "#E1F5EE") {
  return `
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:18px 0 0">
      <a href="${href}" style="display:inline-block;background:${color};color:${textColor};border-radius:24px;padding:12px 28px;font-family:sans-serif;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.3px">${escapeHtml(text)}</a>
    </td>
  </tr>
</table>`;
}

function statusBadge(text: string, bg: string, color: string) {
  return `<span style="display:inline-block;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;font-family:sans-serif;background:${bg};color:${color};margin-bottom:14px">${escapeHtml(text)}</span>`;
}

function divider() {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0"><tr><td style="height:1px;background:#e8f0f8"></td></tr></table>`;
}

function formatSrd(value: number) {
  return value.toLocaleString("nl-SR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " SRD";
}

// ── 1. Welcome ─────────────────────────────────────────────────────────────────

export function buildWelcomeEmail(input: { name: string }) {
  const body = `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;margin:-28px -28px 0;padding:24px 28px 20px" align="center">
  <tr>
    <td align="center">
      <p style="margin:0 0 6px;font-size:28px;font-weight:700;color:#ffffff;font-family:Georgia,serif">¡Bienvenido, <span style="color:#00c4a0">${escapeHtml(input.name)}</span>!</p>
      <p style="margin:0;font-size:13px;color:#9FE1CB;font-family:sans-serif">Tu cuenta ha sido creada correctamente.</p>
    </td>
  </tr>
</table>
${divider()}
<p style="text-align:center;font-size:13px;font-family:sans-serif;line-height:1.7;color:#444;margin-bottom:14px">
  Estamos muy contentos de tenerte en ZorvyA Shop, tu tienda premium de tecnología y electrodomésticos en Paramaribo. Todo lo que necesitas, en un solo lugar.
</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0">
  <tr>
    <td width="33%" align="center" style="border:1px solid #e0e8f0;border-radius:8px;padding:12px 8px">
      <p style="margin:0 0 6px;font-size:22px">🚚</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0a0f1e;font-family:sans-serif">Delivery rápido</p>
      <p style="margin:0;font-size:11px;color:#888;font-family:sans-serif">Estimado 48 horas</p>
    </td>
    <td width="4%"></td>
    <td width="33%" align="center" style="border:1px solid #e0e8f0;border-radius:8px;padding:12px 8px">
      <p style="margin:0 0 6px;font-size:22px">💬</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0a0f1e;font-family:sans-serif">Soporte en vivo</p>
      <p style="margin:0;font-size:11px;color:#888;font-family:sans-serif">Chat en tiempo real</p>
    </td>
    <td width="4%"></td>
    <td width="33%" align="center" style="border:1px solid #e0e8f0;border-radius:8px;padding:12px 8px">
      <p style="margin:0 0 6px;font-size:22px">📦</p>
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#0a0f1e;font-family:sans-serif">Seguimiento</p>
      <p style="margin:0;font-size:11px;color:#888;font-family:sans-serif">Estado en tiempo real</p>
    </td>
  </tr>
</table>

${ctaButton("Explorar el catálogo", "https://zorvya.com")}

${divider()}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f6;border:1px solid #9FE1CB;border-radius:8px;padding:12px 16px">
  <tr><td align="center"><p style="margin:0;font-size:12px;color:#085041;font-family:sans-serif">¿Tienes dudas? Nuestro chat de soporte está disponible en la tienda, sin espera.</p></td></tr>
</table>`;

  return wrap(body, "BIENVENIDA");
}

// ── 2. Auth code (verification / password reset / change email) ───────────────

export function buildAuthCodeEmail(input: {
  heading: string;
  body: string;
  code: string;
  name: string;
  expiry: string;
}) {
  const bodyHtml = `
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 6px;line-height:1.3">${escapeHtml(input.heading)}</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Hola ${escapeHtml(input.name)},</p>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:18px">${escapeHtml(input.body)}</p>

<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:10px 0">
      <div style="display:inline-block;background:#f7f9fb;border:1px solid #e0e8f0;border-radius:12px;padding:18px 32px;font-size:32px;font-weight:800;letter-spacing:0.22em;color:#0a0f1e;font-family:Georgia,serif">${escapeHtml(input.code)}</div>
    </td>
  </tr>
</table>

<p style="font-size:12px;font-family:sans-serif;color:#888;text-align:center;margin-top:10px">${escapeHtml(input.expiry)}</p>`;

  return wrap(bodyHtml, "VERIFICACIÓN DE CUENTA");
}

// ── 3. Order confirmation (delivery) ─────────────────────────────────────────

export function buildOrderConfirmationEmail(input: {
  name: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string;
  paymentMethod: string;
}) {
  const body = `
${statusBadge("✓ Pedido confirmado", "#EAF3DE", "#27500A")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 6px;line-height:1.3">¡Gracias por tu compra, ${escapeHtml(input.name)}!</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Hemos recibido tu pedido y ya estamos procesándolo. Te notificaremos cuando esté en camino.</p>

${orderNumberBox(input.orderId)}

${itemRows(input.items)}

<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">
  <tr>
    <td style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#888">Subtotal</td>
    <td align="right" style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#555">${formatSrd(input.subtotal)}</td>
  </tr>
  <tr>
    <td style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#888">Delivery</td>
    <td align="right" style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#555">${input.deliveryFee === 0 ? "Gratis" : formatSrd(input.deliveryFee)}</td>
  </tr>
  <tr>
    <td style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#888">Método de pago</td>
    <td align="right" style="padding:6px 0;font-size:12px;font-family:sans-serif;color:#555">${escapeHtml(input.paymentMethod === "cash" ? "Contra entrega" : "PayPal")}</td>
  </tr>
</table>

${totalRow("Total pagado", input.total)}

${ctaButton("Ver estado del pedido", "https://zorvya.com/cuenta")}`;

  return wrap(body, "CONFIRMACIÓN DE PEDIDO");
}

// ── 4. Order confirmation (pickup) ────────────────────────────────────────────

export function buildPickupConfirmationEmail(input: {
  name: string;
  orderId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  pickupDate: string;
  pickupTime: string;
}) {
  const body = `
${statusBadge("📍 Recogida confirmada", "#FAEEDA", "#633806")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 6px;line-height:1.3">Tu pedido está listo, ${escapeHtml(input.name)}</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Tu pedido estará preparado en nuestra tienda en la fecha y hora que seleccionaste. Te esperamos.</p>

${orderNumberBox(input.orderId)}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#EAF3DE;border:1px solid #C0DD97;border-radius:8px;padding:14px 16px;margin:14px 0">
  <tr>
    <td width="33%" align="center">
      <p style="margin:0 0 4px;font-size:10px;color:#3B6D11;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">Fecha</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#173404;font-family:Georgia,serif">${escapeHtml(input.pickupDate)}</p>
    </td>
    <td width="33%" align="center">
      <p style="margin:0 0 4px;font-size:10px;color:#3B6D11;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">Hora</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#173404;font-family:Georgia,serif">${escapeHtml(input.pickupTime)}</p>
    </td>
    <td width="33%" align="center">
      <p style="margin:0 0 4px;font-size:10px;color:#3B6D11;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">Pedido</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#173404;font-family:Georgia,serif">#${escapeHtml(input.orderId.slice(-4).toUpperCase())}</p>
    </td>
  </tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;border-radius:10px;padding:20px;margin:16px 0">
  <tr>
    <td align="center">
      <p style="margin:0 0 8px;font-size:11px;color:#4a7090;font-family:sans-serif;text-transform:uppercase;letter-spacing:.5px">📍 Dirección de recogida</p>
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;line-height:1.2">Anton Dragtenweg 145</p>
      <p style="margin:0;font-size:13px;color:#00c4a0;font-family:sans-serif">Paramaribo, Suriname</p>
    </td>
  </tr>
</table>

${ctaButton("Abrir en Google Maps", "https://www.google.com/maps/search/?api=1&query=Anton+Dragtenweg+145+Paramaribo", "#185FA5", "#E6F1FB")}

${divider()}
${itemRows(input.items)}
${totalRow("Total", input.total)}`;

  return wrap(body, "RECOGIDA PROGRAMADA");
}

// ── 5. Order cancellation ─────────────────────────────────────────────────────

export function buildCancellationEmail(input: {
  name: string;
  orderId: string;
  reason?: string;
}) {
  const body = `
${statusBadge("✕ Pedido cancelado", "#FCEBEB", "#791F1F")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 6px;line-height:1.3">Tu pedido ha sido cancelado</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Hola ${escapeHtml(input.name)}, confirmamos que tu pedido <strong>#${escapeHtml(input.orderId.slice(-8).toUpperCase())}</strong> ha sido cancelado${input.reason ? " por el siguiente motivo:" : " correctamente conforme a tu solicitud."}</p>

${input.reason ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCEBEB;border:1px solid #F7C1C1;border-radius:8px;padding:14px 16px;margin:14px 0"><tr><td align="center"><p style="color:#791F1F;font-size:13px;font-family:sans-serif;margin:0;line-height:1.6">${escapeHtml(input.reason)}</p></td></tr></table>` : ""}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#FCEBEB;border:1px solid #F7C1C1;border-radius:8px;padding:14px 16px;margin:14px 0">
  <tr><td align="center"><p style="color:#791F1F;font-size:13px;font-family:sans-serif;margin:0;line-height:1.6">Si realizaste un pago, el reembolso se procesará en un plazo de 3 a 5 días hábiles al método de pago original.</p></td></tr>
</table>

<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Si no solicitaste esta cancelación o tienes alguna duda, nuestro equipo de soporte está disponible ahora mismo.</p>

${ctaButton("Hablar con soporte", "https://zorvya.com/soporte", "#A32D2D", "#FCEBEB")}
${ctaButton("Realizar un nuevo pedido", "https://zorvya.com", "#0a0f1e", "#00c4a0")}`;

  return wrap(body, "ACTUALIZACIÓN DE PEDIDO");
}

// ── Security notice (password changed, new device, etc.) ─────────────────────

export function buildSecurityNoticeEmail(input: {
  heading: string;
  body: string;
  name: string;
  extra?: string;
}) {
  const body = `
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 6px;line-height:1.3">${escapeHtml(input.heading)}</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Hola ${escapeHtml(input.name)},</p>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">${escapeHtml(input.body)}</p>
${input.extra ? `<p style="font-size:13px;font-family:sans-serif;color:#666;line-height:1.7">${escapeHtml(input.extra)}</p>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9f6;border:1px solid #9FE1CB;border-radius:8px;padding:12px 16px;margin-top:16px">
  <tr><td align="center"><p style="margin:0;font-size:12px;color:#085041;font-family:sans-serif">¿No reconoces este cambio? Contacta a soporte de inmediato: <a href="https://zorvya.com/soporte" style="color:#0F6E56">zorvya.com/soporte</a></p></td></tr>
</table>`;

  return wrap(body, "AVISO DE SEGURIDAD");
}

// ── 6. Order in delivery ──────────────────────────────────────────────────────

export function buildDeliveryEmail(input: {
  name: string;
  orderId: string;
  address: string;
  estimatedTime?: string;
}) {
  const body = `
${statusBadge("🚚 Tu pedido está en camino", "#E6F1FB", "#0C447C")}
<h2 style="font-size:20px;font-weight:700;color:#0a0f1e;margin:0 0 6px;line-height:1.3">¡Tu pedido salió, ${escapeHtml(input.name)}!</h2>
<p style="font-size:13px;font-family:sans-serif;color:#444;line-height:1.7;margin-bottom:12px">Tu pedido <strong>#${escapeHtml(input.orderId.slice(-8).toUpperCase())}</strong> está en ruta hacia tu dirección. El repartidor está de camino.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
  <tr>
    <td align="center">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="width:80px">
            <div style="width:28px;height:28px;border-radius:50%;background:#0F6E56;border:2px solid #0F6E56;display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#E1F5EE;margin:0 auto">✓</div>
            <p style="margin:6px 0 0;font-size:10px;font-family:sans-serif;color:#0F6E56;font-weight:700;text-align:center">Confirmado</p>
          </td>
          <td style="width:40px;height:2px;background:#0F6E56"></td>
          <td align="center" style="width:80px">
            <div style="width:28px;height:28px;border-radius:50%;background:#0F6E56;border:2px solid #0F6E56;display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#E1F5EE;margin:0 auto">✓</div>
            <p style="margin:6px 0 0;font-size:10px;font-family:sans-serif;color:#0F6E56;font-weight:700;text-align:center">Procesado</p>
          </td>
          <td style="width:40px;height:2px;background:#185FA5"></td>
          <td align="center" style="width:80px">
            <div style="width:28px;height:28px;border-radius:50%;background:#185FA5;border:2px solid #185FA5;display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#E6F1FB;margin:0 auto">🚚</div>
            <p style="margin:6px 0 0;font-size:10px;font-family:sans-serif;color:#185FA5;font-weight:700;text-align:center">En camino</p>
          </td>
          <td style="width:40px;height:2px;background:#e0e8f0"></td>
          <td align="center" style="width:80px">
            <div style="width:28px;height:28px;border-radius:50%;background:#f0f4f8;border:2px solid #e0e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#aaa;margin:0 auto">🏠</div>
            <p style="margin:6px 0 0;font-size:10px;font-family:sans-serif;color:#888;text-align:center">Entregado</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

${input.estimatedTime ? `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#E6F1FB;border:1px solid #B5D4F4;border-radius:8px;padding:12px 16px;margin:14px 0">
  <tr>
    <td>
      <p style="margin:0 0 2px;font-size:11px;color:#185FA5;font-family:sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.5px">⏱ Hora estimada de entrega</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0C447C;font-family:Georgia,serif">${escapeHtml(input.estimatedTime)}</p>
    </td>
  </tr>
</table>` : ""}

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e0e8f0;border-radius:8px;padding:14px 16px;margin:14px 0">
  <tr>
    <td>
      <p style="margin:0 0 2px;font-size:11px;font-family:sans-serif;color:#888;text-transform:uppercase;letter-spacing:.5px">Dirección de entrega</p>
      <p style="margin:0;font-size:14px;font-family:sans-serif;font-weight:500;color:#333">${escapeHtml(input.address)}</p>
    </td>
  </tr>
</table>

${ctaButton("Ver estado del pedido", "https://zorvya.com/cuenta")}`;

  return wrap(body, "SEGUIMIENTO DE PEDIDO");
}
