import { NextResponse } from "next/server";

type AssistantRequestEntry = {
  sender?: "customer" | "support";
  senderName?: string;
  message?: string;
};

type AssistantRequestPayload = {
  locale?: "es" | "en" | "nl" | "pt";
  customerName?: string;
  transcript?: AssistantRequestEntry[];
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactAssistantReply(value: string, maxLength: number = 220) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) ?? [normalized];
  let result = "";

  for (const sentence of sentences) {
    const next = result ? `${result} ${sentence.trim()}` : sentence.trim();

    if (next.length > maxLength) {
      break;
    }

    result = next;
  }

  if (result) {
    return result.trim();
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function buildFallbackReply(message: string, locale: string, transcript: AssistantRequestEntry[]) {
  const normalized = message.toLowerCase();
  const customerTurns = transcript.filter((entry) => entry.sender === "customer");

  if (hasAny(normalized, ["gracias", "thanks", "thank you", "obrigado", "bedankt"])) {
    return locale === "en"
      ? "You are welcome. Good manners keep my sarcastic circuits calm. If you want, I can also help with products, cart, orders, language, or screen theme."
      : "De nada. Los modales me bajan el sarcasmo un poco. Si quieres, tambien puedo ayudarte con productos, carrito, pedidos, idioma o tema de pantalla.";
  }

  if (
    hasAny(normalized, [
      "como funciona",
      "how it works",
      "how does",
      "funciona la tienda",
      "como comprar",
      "hoe werkt",
    ])
  ) {
    return locale === "en"
      ? "The store is simple: browse products, open the product, choose model or color if needed, add to cart, and confirm the order from the cart. If you get stuck, I stay here with you."
      : "La tienda funciona asi: exploras productos, abres el articulo, eliges modelo o color si hace falta, lo agregas al carrito y confirmas el pedido desde el carrito. Si te trabas, yo me quedo aqui contigo.";
  }

  if (hasAny(normalized, ["cancelar", "cancel", "anular"])) {
    return locale === "en"
      ? "To cancel or report a problem with an order, open your account, go to Orders, review the order, and write to support from there or from this chat."
      : "Para cancelar o reportar un problema con una orden, entra en tu cuenta, abre Ordenes, revisa el pedido y escribe a soporte desde ahi o desde este chat.";
  }

  if (hasAny(normalized, ["idioma", "language", "taal", "lingua"])) {
    return locale === "en"
      ? "To change language, open your profile and use the languages option. If you want, I can stay here while you do it."
      : "Para cambiar el idioma, abre tu perfil y usa la opcion de idiomas. Si quieres, me quedo aqui mientras lo haces.";
  }

  if (
    hasAny(normalized, [
      "tema",
      "color de pantalla",
      "modo oscuro",
      "modo claro",
      "theme",
      "dark mode",
      "light mode",
      "screen color",
    ])
  ) {
    return locale === "en"
      ? "You can change the screen look with the light or dark mode control. If you want a cleaner setup, I can also guide you through the rest of the store."
      : "Puedes cambiar la apariencia de la pantalla con el control de modo claro u oscuro. Si quieres una configuracion mas comoda, tambien te guio con el resto de la tienda.";
  }

  if (hasAny(normalized, ["hola", "hello", "hi", "buenas", "ola"])) {
    return locale === "en"
      ? "Hi, I am ZorvYBOT. I help with orders, products, delivery, and the occasional unnecessary comment. Tell me what you need."
      : "Hola, soy ZorvYBOT. Ayudo con pedidos, productos, delivery y algun comentario innecesario. Dime que necesitas.";
  }

  if (hasAny(normalized, ["delivery", "envio", "entrega", "levering"])) {
    return locale === "en"
      ? "I can help you with delivery. Tell me the product and your zone and I will guide you."
      : "Puedo ayudarte con el delivery. Dime el producto y tu zona y te guio.";
  }

  if (hasAny(normalized, ["modelo", "variant", "variante", "color"])) {
    return locale === "en"
      ? "If you want, tell me the product name and I can help you choose model or color."
      : "Si quieres, dime el nombre del producto y te ayudo a elegir modelo o color.";
  }

  if (hasAny(normalized, ["pedido", "order", "compra", "bestelling"])) {
    return locale === "en"
      ? "I can guide you with your order. Tell me what happened and I will help step by step."
      : "Puedo orientarte con tu pedido. Cuentame que paso y te ayudo paso a paso.";
  }

  if (customerTurns.length >= 3 && normalized.length > 18) {
    return locale === "en"
      ? "I am not fully understanding what you need, and I do not want to waste your time. I will connect you with a human agent through support."
      : "No estoy entendiendo del todo lo que necesitas y no quiero hacerte perder tiempo. Voy a conectarte con un agente humano por soporte.";
  }

  return locale === "en"
    ? "I am here with you. Tell me which product or order you need help with and I will continue from there."
    : "Estoy aqui contigo. Dime con que producto o pedido necesitas ayuda y seguimos desde ahi.";
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AssistantRequestPayload;
    const locale = normalizeText(payload.locale) || "es";
    const customerName = normalizeText(payload.customerName) || "Cliente";
    const transcript = Array.isArray(payload.transcript) ? payload.transcript.slice(-14) : [];
    const apiKey = process.env.OPENAI_API_KEY;

    const latestCustomerMessage =
      [...transcript]
        .reverse()
        .find((entry) => entry.sender === "customer" && normalizeText(entry.message))?.message ?? "";

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        reply: compactAssistantReply(
          buildFallbackReply(normalizeText(latestCustomerMessage), locale, transcript)
        ),
      });
    }

    const input = [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              locale === "en"
                ? "You are ZorvYBOT, a concise ecommerce assistant with personality. Reply in the user's language. Be helpful, clear, direct, and conversational. Keep each answer short: one to three brief sentences, ideally under 220 characters when possible. Never quote or summarize long product descriptions. Refer to products by a short name only. Your tone can alternate between warm, lightly ironic, observant, playful, and gently gossipy, but never rude or cruel. Make short jokes or mini-stories only when they truly fit. Help with products, variants, cart, orders, shipping, account, language changes, theme changes, and support. If after a short clarification you still do not understand what the user wants, say clearly that you will connect them with a human agent."
                : "Eres ZorvYBOT, un asistente virtual de ecommerce con personalidad. Responde en el idioma del usuario. Se util, claro, directo y conversacional. Cada respuesta debe ser corta: de una a tres frases breves, idealmente por debajo de 220 caracteres cuando se pueda. Nunca cites ni resumes descripciones largas de productos. Cuando hables de un articulo, usa solo un nombre corto. Tu tono puede alternar entre amable, ironico con suavidad, observador, jugueton y un poco chismoso, pero nunca grosero ni cruel. Mete chistes cortos o mini historias solo cuando encajen de verdad. Ayuda con productos, variantes, carrito, pedidos, delivery, cuenta, cambios de idioma, cambios de tema y soporte. Si despues de una aclaracion corta sigues sin entender lo que quiere, dile claramente que lo conectaras con un agente humano.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              `Cliente actual: ${customerName}`,
              "Conversacion reciente:",
              ...transcript.map((entry) => {
                const sender =
                  entry.sender === "support" ? "ZorvYBOT" : entry.senderName || customerName;
                return `${sender}: ${normalizeText(entry.message)}`;
              }),
            ].join("\n"),
          },
        ],
      },
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUPPORT_MODEL || "gpt-4.1-mini",
        input,
        max_output_tokens: 220,
      }),
    });

    const data = (await response.json()) as {
      output_text?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            normalizeText(data.error?.message) || "No se pudo generar la respuesta del asistente.",
        },
        { status: response.status }
      );
    }

    const reply = compactAssistantReply(data.output_text || "");

    return NextResponse.json({
      success: true,
      reply:
        reply ||
        compactAssistantReply(
          buildFallbackReply(normalizeText(latestCustomerMessage), locale, transcript)
        ),
    });
  } catch (error) {
    console.error("Failed to generate support assistant response:", error);

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo responder desde el asistente virtual.",
      },
      { status: 500 }
    );
  }
}
