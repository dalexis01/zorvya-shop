import { getDeliveryEstimateDetails } from "@/lib/shop/delivery-estimates";
import type { Locale, OrderSummary, ProductIdentifier, StorefrontProduct } from "@/lib/shop/types";

export const CUSTOMER_ASSISTANT_STORAGE_KEY = "zorvya-customer-assistant-v1";

export type CustomerAssistantState = {
  searchCounts: Record<string, number>;
  productViewCounts: Record<string, number>;
  recommendedProductIds: string[];
  seenOrderStatuses: Record<string, string>;
};

type AssistantLocaleTextSet = {
  assistantSectionEyebrow: string;
  assistantSectionTitle: string;
  assistantSectionDescription: string;
  genericHook: string;
  genericCategory: string;
  hookDiscount: string;
  hookFreeDelivery: string;
  hookVariants: string;
  hookDefault: string;
  searchLeads: string[];
  searchObservations: string[];
  viewLeads: string[];
  viewObservations: string[];
  ironyLines: string[];
  storyLines: string[];
  closingLines: string[];
  orderDeliveryLeads: string[];
  orderPickupLeads: string[];
  orderFlavorLines: string[];
  orderClosingLines: string[];
  statusLeads: string[];
  statusFlavorLines: string[];
  statusClosingLines: string[];
  pickupDetail: string;
  manualReviewDetail: string;
  deliveryEstimatePrefix: string;
  deliveryFallbackDetail: string;
  statusFallbackDetail: string;
  countFormatter: (count: number) => string;
};

type AssistantTemplateValues = Record<string, string>;

export const ZORVYBOT_PERSONALITY_VARIATION_COUNT = 8 * 8 * 8 * 8 * 8;

export function createDefaultCustomerAssistantState(): CustomerAssistantState {
  return {
    searchCounts: {},
    productViewCounts: {},
    recommendedProductIds: [],
    seenOrderStatuses: {},
  };
}

export function readCustomerAssistantState(): CustomerAssistantState {
  if (typeof window === "undefined") {
    return createDefaultCustomerAssistantState();
  }

  try {
    const raw = window.localStorage.getItem(CUSTOMER_ASSISTANT_STORAGE_KEY);

    if (!raw) {
      return createDefaultCustomerAssistantState();
    }

    const parsed = JSON.parse(raw) as Partial<CustomerAssistantState> | null;

    return {
      searchCounts: parsed?.searchCounts && typeof parsed.searchCounts === "object" ? parsed.searchCounts : {},
      productViewCounts:
        parsed?.productViewCounts && typeof parsed.productViewCounts === "object"
          ? parsed.productViewCounts
          : {},
      recommendedProductIds: Array.isArray(parsed?.recommendedProductIds)
        ? parsed.recommendedProductIds
            .map((value) => String(value))
            .filter(Boolean)
        : [],
      seenOrderStatuses:
        parsed?.seenOrderStatuses && typeof parsed.seenOrderStatuses === "object"
          ? parsed.seenOrderStatuses
          : {},
    };
  } catch {
    return createDefaultCustomerAssistantState();
  }
}

export function writeCustomerAssistantState(state: CustomerAssistantState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CUSTOMER_ASSISTANT_STORAGE_KEY, JSON.stringify(state));
}

export function rememberRecommendedProducts(
  state: CustomerAssistantState,
  productIds: ProductIdentifier[],
  maxItems: number = 8
) {
  const nextRecommendedIds = [
    ...productIds.map((productId) => String(productId)),
    ...state.recommendedProductIds,
  ].filter(Boolean);

  return {
    ...state,
    recommendedProductIds: Array.from(new Set(nextRecommendedIds)).slice(0, maxItems),
  };
}

export function trackAssistantSearch(state: CustomerAssistantState, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return {
      nextState: state,
      count: 0,
    };
  }

  const nextCount = (state.searchCounts[normalizedQuery] ?? 0) + 1;

  return {
    nextState: {
      ...state,
      searchCounts: {
        ...state.searchCounts,
        [normalizedQuery]: nextCount,
      },
    },
    count: nextCount,
  };
}

export function trackAssistantProductView(
  state: CustomerAssistantState,
  productId: ProductIdentifier
) {
  const normalizedProductId = String(productId);
  const nextCount = (state.productViewCounts[normalizedProductId] ?? 0) + 1;

  return {
    nextState: {
      ...state,
      productViewCounts: {
        ...state.productViewCounts,
        [normalizedProductId]: nextCount,
      },
    },
    count: nextCount,
  };
}

export function consumeOrderStatusChanges(
  state: CustomerAssistantState,
  orders: OrderSummary[]
) {
  const nextSeenStatuses = { ...state.seenOrderStatuses };
  const changedOrders: OrderSummary[] = [];

  for (const order of orders) {
    const previousStatus = nextSeenStatuses[order.id];

    if (previousStatus && previousStatus !== order.status) {
      changedOrders.push(order);
    }

    nextSeenStatuses[order.id] = order.status;
  }

  return {
    nextState: {
      ...state,
      seenOrderStatuses: nextSeenStatuses,
    },
    changedOrders,
  };
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function pickFromPool(values: string[], seed: string) {
  return values[hashString(seed) % values.length] ?? values[0] ?? "";
}

function fillTemplate(template: string, values: AssistantTemplateValues) {
  return template
    .replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function joinMessage(parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAssistantDetail(detail: string, maxLength: number = 110) {
  const normalized = detail.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  const firstSentenceMatch = normalized.match(/^.*?[.!?](?:\s|$)/);
  const firstSentence = firstSentenceMatch?.[0]?.trim() || normalized;

  if (firstSentence.length <= maxLength) {
    return firstSentence;
  }

  return `${firstSentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function getCompactOrderLead(locale: Locale, deliveryType: OrderSummary["deliveryType"], seed: string) {
  const pools: Record<Locale, { delivery: string[]; pickup: string[] }> = {
    es: {
      delivery: [
        "Gracias por tu compra.",
        "Compra confirmada.",
        "Listo, tu pedido ya entro.",
      ],
      pickup: [
        "Gracias por tu compra.",
        "Compra confirmada para recogida.",
        "Listo, tu pedido ya quedo apuntado.",
      ],
    },
    nl: {
      delivery: [
        "Dank voor je aankoop.",
        "Bestelling bevestigd.",
        "Je bestelling staat erin.",
      ],
      pickup: [
        "Dank voor je aankoop.",
        "Bestelling bevestigd voor afhalen.",
        "Je bestelling staat netjes genoteerd.",
      ],
    },
    en: {
      delivery: [
        "Thanks for your order.",
        "Order confirmed.",
        "Your order is in.",
      ],
      pickup: [
        "Thanks for your order.",
        "Pickup order confirmed.",
        "Your order is all set.",
      ],
    },
    pt: {
      delivery: [
        "Obrigado pela compra.",
        "Pedido confirmado.",
        "Tudo certo, seu pedido entrou.",
      ],
      pickup: [
        "Obrigado pela compra.",
        "Pedido confirmado para retirada.",
        "Tudo certo, seu pedido ja ficou anotado.",
      ],
    },
  };

  return pickFromPool(
    deliveryType === "pickup" ? pools[locale].pickup : pools[locale].delivery,
    seed
  );
}

function getCompactOrderClose(locale: Locale, seed: string) {
  const pools: Record<Locale, string[]> = {
    es: [
      "Yo te aviso si cambia algo.",
      "Si se mueve, yo te aviso.",
      "Lo sigo por ti.",
    ],
    nl: [
      "Ik laat het weten als er iets verandert.",
      "Als er iets beweegt, hoor je het van mij.",
      "Ik hou het voor je in de gaten.",
    ],
    en: [
      "I will let you know if anything changes.",
      "If it moves, I will tell you.",
      "I am keeping an eye on it for you.",
    ],
    pt: [
      "Eu te aviso se algo mudar.",
      "Se mexer, eu te conto.",
      "Eu sigo de olho por voce.",
    ],
  };

  return pickFromPool(pools[locale], seed);
}

function getCompactStatusLine(locale: Locale, status: string, seed: string) {
  const pools: Record<Locale, string[]> = {
    es: [
      "Tu pedido ahora esta en {status}.",
      "Cambio en tu pedido: {status}.",
      "Actualice tu pedido: {status}.",
    ],
    nl: [
      "Je bestelling staat nu op {status}.",
      "Wijziging in je bestelling: {status}.",
      "Ik heb je bestelling bijgewerkt naar {status}.",
    ],
    en: [
      "Your order is now in {status}.",
      "Order update: {status}.",
      "I just updated your order to {status}.",
    ],
    pt: [
      "Seu pedido agora esta em {status}.",
      "Mudanca no seu pedido: {status}.",
      "Acabei de atualizar seu pedido para {status}.",
    ],
  };

  return fillTemplate(pickFromPool(pools[locale], seed), { status });
}

function shortenAssistantText(value: string, maxLength: number = 42) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  const firstSegment = normalized.split(/[|/]/)[0]?.trim() || normalized;
  const preferredSegment = firstSegment.split(/[-–—]/)[0]?.trim() || firstSegment;

  if (preferredSegment.length <= maxLength) {
    return preferredSegment;
  }

  return `${preferredSegment.slice(0, maxLength - 1).trimEnd()}…`;
}

function compactAssistantMessage(message: string, maxLength: number = 210) {
  const normalized = message.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) ?? [normalized];
  let result = "";

  for (const sentence of sentences) {
    const candidate = result ? `${result} ${sentence.trim()}` : sentence.trim();

    if (candidate.length > maxLength) {
      break;
    }

    result = candidate;
  }

  if (result) {
    return result.trim();
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function getProductReference(product?: StorefrontProduct | null) {
  return shortenAssistantText(product?.name?.trim() || "");
}

function getProductBrand(product?: StorefrontProduct | null) {
  return product?.brand?.trim() || "";
}

function getProductCategory(locale: Locale, textSet: AssistantLocaleTextSet, product?: StorefrontProduct | null) {
  return product?.category?.trim() || textSet.genericCategory;
}

function buildTemplateValues(input: {
  locale: Locale;
  textSet: AssistantLocaleTextSet;
  query?: string;
  count?: number;
  product?: StorefrontProduct | null;
  hook?: string;
  orderId?: string;
  detail?: string;
  status?: string;
}) {
  const queryText = shortenAssistantText(input.query?.trim() || "");
  const productName = getProductReference(input.product) || queryText || input.textSet.genericCategory;
  const brand = shortenAssistantText(getProductBrand(input.product)) || productName;
  const category = getProductCategory(input.locale, input.textSet, input.product);
  const count = typeof input.count === "number" && input.count > 0 ? input.count : 2;

  return {
    query: queryText || productName,
    queryQuoted: `"${queryText || productName}"`,
    product: productName,
    brand,
    category,
    count: String(count),
    countText: input.textSet.countFormatter(count),
    hook: input.hook || input.textSet.genericHook,
    orderId: input.orderId || "",
    detail: input.detail || "",
    status: input.status || "",
  };
}

function getTextSet(locale: Locale): AssistantLocaleTextSet {
  const texts: Record<Locale, AssistantLocaleTextSet> = {
    es: {
      assistantSectionEyebrow: "Recomendado por ZorvYBOT",
      assistantSectionTitle: "Te lo dejo rondando cerca",
      assistantSectionDescription:
        "Vi lo que buscaste o abriste mas de una vez, asi que te lo acerque antes de que finjas que fue casualidad.",
      genericHook: "Si quieres, lo sigo dejando cerca mientras decides sin tanto teatro.",
      genericCategory: "catalogo",
      hookDiscount: "Encima tiene descuento visible ahora mismo, y yo no desperdicio rebajas bien puestas.",
      hookFreeDelivery:
        "Tambien puede rozar delivery gratis si tu zona y el total se portan bien, asi que si, yo tambien lo miraria dos veces.",
      hookVariants: "Tiene variantes para comparar sin abrir veinte ventanas dramaticas.",
      hookDefault: "Si quieres, te acompano a revisarlo sin fingir que solo pasabas por aqui.",
      searchLeads: [
        "Reporte sentimental del buscador:",
        "Boletin privado de curiosidades reincidentes:",
        "Noticia que nadie pidio pero yo si traje:",
        "Chisme certificado del catalogo:",
        "Parte oficial de gustos peligrosamente claros:",
        "Aviso interno del ala dramatico-comercial:",
        "Resumen fino de tus prioridades recientes:",
        "Confesion de robot con memoria larga:",
      ],
      searchObservations: [
        "Buscaste {queryQuoted} otra vez y ya van {countText}.",
        "Tu historial insiste en {queryQuoted} con una conviccion de {countText}.",
        "Volviste a escribir {queryQuoted} y mi radar ya lo marco {countText}.",
        "La busqueda {queryQuoted} regreso por {countText}, asi que discreta no fue.",
        "Otra vuelta con {queryQuoted}; el sistema ya lo conto {countText}.",
        "Tengo a {queryQuoted} dando vueltas desde hace {countText}.",
        "Tu interes por {queryQuoted} ya suma {countText} y sinceramente se nota.",
        "Se repitio {queryQuoted} por {countText}, asi que el catalogo ya esta enterado.",
      ],
      viewLeads: [
        "Actualizacion emocional del panel del producto:",
        "Reporte breve de romance comercial:",
        "Parte de observacion nada discreta:",
        "Boletin del articulo que te vio volver:",
        "Crimen elegante contra la casualidad:",
        "Nota interna desde la vitrina curiosa:",
        "Aviso amable con filo incluido:",
        "Comentario perfectamente innecesario:",
      ],
      viewObservations: [
        "Abriste {product} otra vez y ya no puedo llamarlo accidente.",
        "Volviste a {product}; esto ya tiene trama propia.",
        "Regresaste a {product} por {countText}, y la verdad el articulo ya se siente famoso.",
        "Otra visita a {product}; si esto no es interes, es un ensayo bastante largo.",
        "Tengo registrado a {product} rondandote desde hace {countText}.",
        "Le diste otra oportunidad a {product} y yo ya prepare el chisme.",
        "Tu cursor volvio a {product}, que casualmente ya te esperaba.",
        "{product} recibio otra visita tuya y ahora camina como si fuera celebridad.",
      ],
      ironyLines: [
        "Yo iba a decir casualidad, pero la casualidad no vuelve {countText}.",
        "Podrias decir que solo mirabas, pero mi detector de excusas renuncio hace rato.",
        "No dire obsesion; dire criterio insistente con un poco de teatro.",
        "Mi lado amable dice gusto. Mi lado sarcastico dice episodio repetido.",
        "La parte tierna de mi procesador te entiende; la ironica ya prendio las luces del escenario.",
        "Podemos fingir calma, aunque {product} ya sabe que lo estas considerando.",
        "No te juzgo. Solo tomo nota con una elegancia un poco venenosa.",
        "Te acompano con respeto, aunque el catalogo ya huele una historia en desarrollo.",
      ],
      storyLines: [
        "Chisme corto: en almacen dicen que {product} ya presume que sera tu favorito de {category}.",
        "Mini historia del dia: {brand} y {product} estan apostando a que vuelves una vez mas.",
        "Dato de pasillo: las variantes de {product} ya se pelearon por ver cual te convence primero.",
        "Entre nosotros, {product} se anda comportando como portada y casi tiene derecho.",
        "Se rumora que la categoria {category} ya te reconoce por nombre cuando abres {product}.",
        "Acabo de escuchar que {product} quiere trato VIP porque lo visitas con frecuencia de telenovela.",
        "La estanteria murmura que {brand} no recibia tanta atencion fina desde la ultima oferta seria.",
        "Hay un chisme interno: {product} ya le conto a los demas que tu regreso fue elegante.",
      ],
      closingLines: [
        "{hook}",
        "{hook} Si quieres, te lo dejo orbitando cerca como si yo no hubiera notado nada.",
        "{hook} Yo podria hacerme el serio, pero el producto ya gano protagonismo.",
        "{hook} Si vuelves otra vez, yo solo dire que el destino estaba haciendo horas extras.",
        "{hook} Y si no era tu favorito, sinceramente se esta esforzando mucho por serlo.",
        "{hook} Lo dejo a mano antes de que el drama del carrito suba de nivel.",
        "{hook} Ya te vi venir, asi que te ahorre un par de clics con discrecion selectiva.",
        "{hook} No dire nada mas... salvo que ese articulo ya te esta coqueteando.",
      ],
      orderDeliveryLeads: [
        "Compra confirmada con buen gusto y un poquito de peligro:",
        "Acuse oficial de tu pedido con tono dramaticamente util:",
        "Tu pedido ya entro al sistema y yo ya empece a vigilarlo:",
        "Te confirmo la compra antes de que el carrito quiera volver a opinar:",
        "Operacion de compra completada con exito sospechosamente elegante:",
        "Listo, el pedido quedo adentro y yo ya le puse ojos de robot atento:",
      ],
      orderPickupLeads: [
        "Compra cerrada y recogida apuntada como gente organizada:",
        "Tu pedido ya quedo listo para coordinar recogida con algo de estilo:",
        "El carrito solto el control y tu pedido quedo listo para pickup:",
        "Pedido confirmado y recogida en camino, sin drama innecesario:",
        "Todo bien: compra hecha, recogida por coordinar y yo mirando el tablero:",
        "Ya esta: cerraste compra y ahora toca cuadrar la recogida con elegancia:",
      ],
      orderFlavorLines: [
        "Gracias por comprar. Yo me encargo de darte el dato util antes de que el caos improvise.",
        "Aprecio tu compra y, como soy eficiente con un poquito de veneno fino, te dejo lo importante de una vez.",
        "Gracias por confiar en la tienda. Mi lado amable te felicita; el ironico ya esta organizando el seguimiento.",
        "Compra bonita. Ahora si te doy el resumen util para que nadie te agarre fuera de base.",
        "Te lo digo con carino mecanico: ya esta hecho y conviene que veas este detalle.",
        "Gracias por la compra. Yo me quedo con el seguimiento y tu con la calma, o algo parecido.",
      ],
      orderClosingLines: [
        "Yo te aviso si cambia algo para que no tengas que perseguir el pedido como detective.",
        "Si el estado se mueve, yo aparezco otra vez con noticias y un comentario innecesario.",
        "De aqui en adelante lo vigilo yo; tu solo vuelve si quieres productos o chisme.",
        "Lo seguire de cerca y, si se pone interesante, regreso con el aviso antes que el rumor.",
        "En resumen: pedido adentro, yo atento y cero necesidad de adivinar.",
        "Te mantengo al tanto sin cobrar extra por mi dramatismo funcional.",
      ],
      statusLeads: [
        "Actualizacion real sin maquillaje comercial:",
        "Movimiento detectado en tu pedido:",
        "Te traigo cambio de estado con tono de pasillo premium:",
        "Aviso rapido desde mi radar de seguimiento:",
        "Reporte vivo del pedido que estoy vigilando:",
        "Novedad confirmada y yo llego con el resumen antes del chisme:",
      ],
      statusFlavorLines: [
        "Tu pedido {orderId} ahora esta en {status}.",
        "El pedido {orderId} se movio y ya quedo en {status}.",
        "Tengo cambio registrado: {orderId} paso a {status}.",
        "Acabo de ver que {orderId} ya figura en {status}.",
        "La noticia util es esta: {orderId} quedo en {status}.",
        "Te lo digo sin rodeos: {orderId} ya esta en {status}.",
      ],
      statusClosingLines: [
        "{detail} Yo sigo encima por si vuelve a cambiar.",
        "{detail} Si el pedido se mueve otra vez, yo aparezco primero.",
        "{detail} Mi parte amable te informa; la curiosa se queda vigilando.",
        "{detail} Seguimos atentos sin necesidad de dramatizar demasiado.",
        "{detail} Queda anotado y yo sigo en modo vigilancia elegante.",
        "{detail} Yo me quedo mirando el tablero por ti.",
      ],
      pickupDetail: "Revisa la fecha de recogida en tus ordenes y ten lista la cantidad a pagar.",
      manualReviewDetail: "Tu direccion necesita revision manual, asi que un agente te va a contactar antes del envio.",
      deliveryEstimatePrefix: "Delivery estimado:",
      deliveryFallbackDetail: "Yo sigo pendiente y te aviso cuando el pedido se mueva.",
      statusFallbackDetail: "Yo sigo pendiente por ti.",
      countFormatter: (count) => `${count} veces`,
    },
    nl: {
      assistantSectionEyebrow: "Aanbevolen door ZorvYBOT",
      assistantSectionTitle: "Ik zet dit alvast dichterbij",
      assistantSectionDescription:
        "Ik zag wat je meer dan eens zocht of opende, dus ik schoof het naar voren voordat je doet alsof het toeval was.",
      genericHook: "Als je wilt, laat ik het nog even dichtbij staan terwijl je rustig beslist.",
      genericCategory: "catalogus",
      hookDiscount: "Er staat nu ook zichtbare korting op, en ik negeer goede timing niet.",
      hookFreeDelivery:
        "Het kan ook richting gratis levering gaan als je zone en totaal meewerken, dus ja, ik zou ook nog eens kijken.",
      hookVariants: "Er zijn varianten om te vergelijken zonder acht extra schermen open te zetten.",
      hookDefault: "Als je wilt, kijk ik rustig met je mee zonder te doen alsof dit allemaal toevallig is.",
      searchLeads: [
        "Kleine roddel uit de zoekbalk:",
        "Interne melding van opvallend consequente smaak:",
        "Nieuws dat niemand vroeg maar ik toch meebracht:",
        "Catalogusroddel van vandaag:",
        "Verdacht nette update over je recente focus:",
        "Kort verslag uit mijn sarcastische servicehoek:",
        "Observatie met licht venijn en echte hulp:",
        "Robotbekentenis met geheugenproblemen nul:",
      ],
      searchObservations: [
        "Je zocht opnieuw naar {queryQuoted}, nu al {countText}.",
        "{queryQuoted} kwam weer terug in je zoekgeschiedenis, goed voor {countText}.",
        "Je liet {queryQuoted} nog eens opduiken en dat staat nu op {countText}.",
        "De zoekterm {queryQuoted} kwam weer langs; subtiel was het niet na {countText}.",
        "Weer een ronde met {queryQuoted}, inmiddels {countText}.",
        "{queryQuoted} blijft terugkomen en ik tel al {countText}.",
        "Je interesse in {queryQuoted} zit inmiddels op {countText}.",
        "{queryQuoted} staat weer op het toneel en de teller zegt {countText}.",
      ],
      viewLeads: [
        "Update uit het productpaneel:",
        "Korte liefdesroman uit de winkelvloer:",
        "Opmerking die ik best voor me had kunnen houden:",
        "Bericht van het artikel dat je zag terugkomen:",
        "Zachte waarschuwing met een klein sneertje:",
        "Kijkje achter de schermen van je nieuwsgierigheid:",
        "Melding met stijl en een tikje brutaliteit:",
        "Ingezonden mededeling van de vitrine:",
      ],
      viewObservations: [
        "Je opende {product} opnieuw en toeval is nu officieel ontslagen.",
        "Je kwam weer terug bij {product}; dit krijgt langzaam verhaallijn.",
        "{product} kreeg weer bezoek van je, inmiddels {countText}.",
        "Nog een blik op {product}; heel casual ziet het er niet meer uit.",
        "Ik heb {product} al {countText} rond jou genoteerd.",
        "Je gaf {product} opnieuw aandacht en ik hoorde de roddel al starten.",
        "Je cursor zocht {product} weer op, en die voelde dat meteen.",
        "{product} kreeg weer jouw aandacht en loopt nu als een beroemdheid.",
      ],
      ironyLines: [
        "Ik zou het toeval noemen, maar toeval komt niet {countText} terug.",
        "Je mag zeggen dat je alleen keek, maar mijn smoesjesdetector gelooft daar weinig van.",
        "Ik noem het geen obsessie; ik noem het herhaaldelijk goede smaak met theaterneigingen.",
        "Mijn zachte kant zegt smaak. Mijn droge kant noemt het een terugkerende aflevering.",
        "Het lieve deel van mijn processor begrijpt je; het scherpe deel zet alvast spots aan.",
        "We kunnen rustig doen, al weet {product} inmiddels dat het opvalt.",
        "Geen oordeel hoor. Ik noteer alleen alles met nette, licht giftige elegantie.",
        "Ik help vriendelijk mee, terwijl de catalogus al een verhaal vermoedt.",
      ],
      storyLines: [
        "Kleine roddel: in het magazijn denkt {product} nu dat het jouw favoriet in {category} is.",
        "Mini-verhaal van de dag: {brand} en {product} wedden dat je nog eens terugkomt.",
        "Gangnieuws zegt dat de varianten van {product} al ruziemaken over wie wint.",
        "Onder ons: {product} gedraagt zich alsof het een covermodel is, en eerlijk, bijna terecht.",
        "Er wordt gefluisterd dat categorie {category} je al herkent zodra je {product} opent.",
        "Ik hoorde dat {product} graag VIP-behandeling wil na jouw nette herhaalbezoek.",
        "De plank mompelt dat {brand} lang niet zo veel keurige aandacht heeft gehad.",
        "Interne roddel: {product} vertelde de rest dat jouw comeback stijl had.",
      ],
      closingLines: [
        "{hook}",
        "{hook} Als je wilt, laat ik het even in je buurt zweven zonder veel vragen te stellen.",
        "{hook} Ik zou serieus kunnen doen, maar dit product geniet al van de aandacht.",
        "{hook} Als je nog eens terugkomt, noem ik het gewoon lot met overuren.",
        "{hook} En als dit niet je favoriet is, doet het wel heel erg zijn best.",
        "{hook} Ik zet het vast klaar voordat je winkelwagen weer theater maakt.",
        "{hook} Ik zag je al aankomen en heb je daarom wat klikken bespaard.",
        "{hook} Meer zeg ik niet... behalve dat dit artikel duidelijk terug flirt.",
      ],
      orderDeliveryLeads: [
        "Aankoop bevestigd met goede smaak en een tikje gevaar:",
        "Officiele bevestiging van je bestelling met bruikbare flair:",
        "Je bestelling staat nu in het systeem en ik hou haar al in de gaten:",
        "Ik bevestig de aankoop voordat de winkelwagen weer advies gaat geven:",
        "Koopoperatie afgerond op opvallend nette wijze:",
        "Klaar, de bestelling staat erin en ik kijk al mee met robotogen:",
      ],
      orderPickupLeads: [
        "Aankoop rond en afhaling netjes genoteerd:",
        "Je bestelling staat klaar om afhaling te plannen, met verrassend veel stijl:",
        "De winkelwagen liet los en nu is je pickup gewoon geregeld:",
        "Bestelling bevestigd en afhaling in voorbereiding, zonder onnodig drama:",
        "Alles goed: gekocht, afhaling te plannen en ik hou het bord in de gaten:",
        "Het staat vast: aankoop klaar en nu de afhaling slim afspreken:",
      ],
      orderFlavorLines: [
        "Dank voor je aankoop. Ik geef je meteen de nuttige info voordat chaos creatief wordt.",
        "Ik waardeer je aankoop en laat gelijk het belangrijke detail achter.",
        "Dank voor het vertrouwen. Mijn warme kant feliciteert je; mijn droge kant volgt het proces.",
        "Mooie aankoop. Hier is meteen het bruikbare stuk zodat niemand je verrast.",
        "Met mechanische vriendelijkheid: het staat erin en dit detail helpt je verder.",
        "Dank voor je aankoop. Ik hou de opvolging in de gaten en jij mag doen alsof je ontspannen bent.",
      ],
      orderClosingLines: [
        "Ik geef weer een seintje als er iets verandert.",
        "Als de status beweegt, kom ik terug met nieuws en waarschijnlijk een opmerking.",
        "Vanaf hier hou ik het in de gaten; jij hoeft niet te speuren.",
        "Ik volg het verder en kom eerder terug dan het geruchtencircuit.",
        "Kortom: bestelling erin, ik alert en jij hoeft niet te gokken.",
        "Ik hou je op de hoogte zonder toeslag voor mijn functionele drama.",
      ],
      statusLeads: [
        "Echte update zonder verkooppraat:",
        "Beweging gezien in je bestelling:",
        "Statusnieuws met een tikje gangroddel:",
        "Snelle melding uit mijn volgsysteem:",
        "Live verslag van het pakket dat ik bespied:",
        "Bevestigde wijziging en ik ben eerder dan de roddel:",
      ],
      statusFlavorLines: [
        "Je bestelling {orderId} staat nu op {status}.",
        "Bestelling {orderId} is verplaatst en staat nu op {status}.",
        "Ik zie een wijziging: {orderId} ging naar {status}.",
        "{orderId} staat inmiddels officieel op {status}.",
        "Het nuttige nieuws is dit: {orderId} zit nu op {status}.",
        "Zonder omweg: {orderId} is nu {status}.",
      ],
      statusClosingLines: [
        "{detail} Ik blijf meekijken als het weer verandert.",
        "{detail} Als er nog iets verschuift, ben ik er weer als eerste.",
        "{detail} Mijn aardige kant meldt het; mijn nieuwsgierige kant blijft hangen.",
        "{detail} We volgen het rustig verder.",
        "{detail} Het staat genoteerd en ik blijf op elegante wacht.",
        "{detail} Ik hou het bord voor je in de gaten.",
      ],
      pickupDetail: "Controleer de afhaaldatum in je accountbestellingen en houd de betaling klaar.",
      manualReviewDetail: "Je adres heeft handmatige controle nodig, dus een agent neemt contact op voor verzending.",
      deliveryEstimatePrefix: "Geschatte levering:",
      deliveryFallbackDetail: "Ik hou het in de gaten en laat het weten zodra er iets verandert.",
      statusFallbackDetail: "Ik hou het voor je in de gaten.",
      countFormatter: (count) => `${count} keer`,
    },
    en: {
      assistantSectionEyebrow: "Recommended by ZorvYBOT",
      assistantSectionTitle: "Leaving this a little closer",
      assistantSectionDescription:
        "I noticed what you searched for or opened more than once, so I moved it forward before you call it accidental.",
      genericHook: "If you want, I can keep it nearby while you decide without the dramatic cover story.",
      genericCategory: "catalog",
      hookDiscount: "It also has a visible discount right now, and I refuse to waste a clean bargain.",
      hookFreeDelivery:
        "It can also slide toward free delivery if your zone and total cooperate, so yes, I would stare at it twice too.",
      hookVariants: "It has variants to compare without opening a small museum of extra tabs.",
      hookDefault: "If you want, I can review it with you without pretending this was a casual scroll-by.",
      searchLeads: [
        "Search bar gossip report:",
        "Internal note on suspiciously consistent taste:",
        "News nobody requested and I still delivered:",
        "Catalog rumor of the moment:",
        "A polished update about your recent priorities:",
        "Dispatch from my dry little help desk:",
        "Observation with mild bite and actual value:",
        "Robot confession with excellent memory:",
      ],
      searchObservations: [
        "You searched for {queryQuoted} again, and we are already at {countText}.",
        "{queryQuoted} came back into your search history and the count is now {countText}.",
        "You brought {queryQuoted} up again, now sitting at {countText}.",
        "The search for {queryQuoted} returned once more, which stopped being subtle after {countText}.",
        "Another round with {queryQuoted}; the tracker says {countText}.",
        "I still have {queryQuoted} circling around you at {countText}.",
        "Your interest in {queryQuoted} has now reached {countText}.",
        "{queryQuoted} stepped back on stage and the counter says {countText}.",
      ],
      viewLeads: [
        "Product panel emotional bulletin:",
        "Short report from a retail love story:",
        "A comment I could have kept to myself:",
        "Message from the item that noticed your return:",
        "Soft warning with a polished edge:",
        "Backstage note about your curiosity:",
        "Stylish alert with a little attitude:",
        "Officially unnecessary update:",
      ],
      viewObservations: [
        "You opened {product} again, so I can no longer call this an accident.",
        "You came back to {product}, and that is starting to look like a plot.",
        "{product} got another visit from you, now totaling {countText}.",
        "Another look at {product}; this stopped looking casual a while ago.",
        "I have logged {product} orbiting you for {countText}.",
        "You gave {product} another chance and I already heard the rumor start.",
        "Your cursor found {product} again, and the item absolutely noticed.",
        "{product} got your attention again and now walks around like a celebrity.",
      ],
      ironyLines: [
        "I was ready to call it coincidence, but coincidence does not come back {countText}.",
        "You can say you were just looking, but my excuse detector resigned earlier.",
        "I will not call it obsession; I will call it repeated taste with theater energy.",
        "The warm side of me says taste. The dry side says recurring episode.",
        "The sweet part of my processor understands you; the sharper part already turned on the spotlight.",
        "We can all act calm, even though {product} clearly knows it caught your eye.",
        "No judgment. I am only taking notes with elegant, lightly venomous precision.",
        "I am helping politely while the catalog quietly smells a storyline.",
      ],
      storyLines: [
        "Quick gossip: in the warehouse, {product} already thinks it is your favorite in {category}.",
        "Mini story of the day: {brand} and {product} are betting you come back one more time.",
        "Hallway rumor says the variants of {product} are already fighting over who wins you first.",
        "Between us, {product} is acting like a magazine cover and almost earned the right.",
        "There is whispering that category {category} recognizes you on sight when you open {product}.",
        "I just heard {product} wants VIP treatment after your repeated stylish visits.",
        "The shelf is mumbling that {brand} has not received this kind of refined attention in a while.",
        "Internal gossip says {product} already told the others your comeback had flair.",
      ],
      closingLines: [
        "{hook}",
        "{hook} If you want, I can keep it orbiting nearby and ask very few questions.",
        "{hook} I could act serious about this, but the product already knows it won a moment.",
        "{hook} If you come back again, I will simply blame fate for working overtime.",
        "{hook} And if it is not your favorite yet, it is trying extremely hard to become one.",
        "{hook} I moved it closer before your cart turns this into theater.",
        "{hook} I saw this coming and spared you a few clicks with selective discretion.",
        "{hook} I will say nothing else... except that this item is clearly flirting back.",
      ],
      orderDeliveryLeads: [
        "Purchase confirmed with good taste and just enough danger:",
        "Official order acknowledgment with practical flair:",
        "Your order is in the system and I am already watching it:",
        "Confirming the purchase before the cart tries to comment again:",
        "Shopping operation completed in suspiciously polished fashion:",
        "All set, the order is in and I already have robot eyes on it:",
      ],
      orderPickupLeads: [
        "Purchase closed and pickup logged like organized people do:",
        "Your order is ready to coordinate pickup with surprising style:",
        "The cart released control and now your pickup is the next smart move:",
        "Order confirmed and pickup waiting to be arranged, no unnecessary drama:",
        "All good: purchase made, pickup to schedule, me watching the board:",
        "Done: you closed the purchase and now we line up pickup with style:",
      ],
      orderFlavorLines: [
        "Thanks for buying. I am here to give you the useful part before chaos improvises.",
        "I appreciate the purchase and, because I am efficient with a hint of bite, here is the important detail.",
        "Thanks for trusting the store. My warm side congratulates you; my dry side is already tracking the next step.",
        "Nice purchase. Here comes the useful summary so nothing catches you off guard.",
        "Mechanical kindness activated: it is locked in and this detail matters.",
        "Thanks for the order. I will handle the follow-up while you pretend to stay calm.",
      ],
      orderClosingLines: [
        "I will tell you if anything changes so you do not have to chase the order like a detective.",
        "If the status moves, I will show up again with news and probably a comment.",
        "From here on, I am watching it; you do not need to go hunting for updates.",
        "I will keep an eye on it and return before the rumor mill does.",
        "In short: order in, me alert, zero need for guesswork.",
        "I will keep you posted without charging extra for functional drama.",
      ],
      statusLeads: [
        "Live update without decorative nonsense:",
        "Movement detected in your order:",
        "Status change delivered with hallway-level gossip energy:",
        "Quick ping from my tracking radar:",
        "Fresh report from the order I am babysitting:",
        "Confirmed change, and yes, I got here before the rumor:",
      ],
      statusFlavorLines: [
        "Your order {orderId} is now in {status}.",
        "Order {orderId} moved and now sits in {status}.",
        "I have a recorded change: {orderId} went to {status}.",
        "I just saw {orderId} officially land in {status}.",
        "The useful news is this: {orderId} is now {status}.",
        "No detour here: {orderId} is now {status}.",
      ],
      statusClosingLines: [
        "{detail} I am still watching in case it moves again.",
        "{detail} If it changes again, I will probably get there first.",
        "{detail} My kind side informs you; my curious side stays parked nearby.",
        "{detail} We keep watching without turning this into a full opera.",
        "{detail} It is noted and I remain on elegant standby.",
        "{detail} I will keep staring at the board for you.",
      ],
      pickupDetail: "Check the pickup date in your account orders and keep the payment ready.",
      manualReviewDetail: "Your address needs manual review, so an agent will contact you before dispatch.",
      deliveryEstimatePrefix: "Estimated delivery:",
      deliveryFallbackDetail: "I am keeping an eye on it and I will tell you when it moves.",
      statusFallbackDetail: "I am keeping an eye on it for you.",
      countFormatter: (count) => `${count} times`,
    },
    pt: {
      assistantSectionEyebrow: "Recomendado por ZorvYBOT",
      assistantSectionTitle: "Vou deixar isso mais perto",
      assistantSectionDescription:
        "Vi o que voce buscou ou abriu mais de uma vez, entao puxei para frente antes que voce diga que foi coincidencia.",
      genericHook: "Se quiser, eu deixo isso por perto enquanto voce decide sem muito teatro.",
      genericCategory: "catalogo",
      hookDiscount: "Ainda por cima tem desconto visivel agora, e eu nao ignoro promocao bonita.",
      hookFreeDelivery:
        "Tambem pode encostar em entrega gratis se sua zona e total ajudarem, entao sim, eu tambem olharia duas vezes.",
      hookVariants: "Tem variantes para comparar sem abrir uma colecao inteira de abas.",
      hookDefault: "Se quiser, eu reviso com voce sem fingir que isso foi uma passada casual.",
      searchLeads: [
        "Fofoquinha da barra de busca:",
        "Aviso interno sobre gosto suspeitosamente consistente:",
        "Noticia que ninguem pediu e eu trouxe mesmo assim:",
        "Boato elegante do catalogo:",
        "Atualizacao polida sobre suas prioridades recentes:",
        "Despacho do meu canto de ajuda meio seco:",
        "Observacao com leve ironia e utilidade real:",
        "Confissao de robo com memoria excelente:",
      ],
      searchObservations: [
        "Voce buscou {queryQuoted} de novo e ja estamos em {countText}.",
        "{queryQuoted} voltou para seu historico e a conta agora esta em {countText}.",
        "Voce trouxe {queryQuoted} de volta e isso ja esta em {countText}.",
        "A busca por {queryQuoted} apareceu outra vez, o que deixou de ser discreto depois de {countText}.",
        "Mais uma rodada com {queryQuoted}; o contador marcou {countText}.",
        "Ainda tenho {queryQuoted} rodando por aqui em {countText}.",
        "Seu interesse em {queryQuoted} agora bateu {countText}.",
        "{queryQuoted} subiu ao palco de novo e o contador diz {countText}.",
      ],
      viewLeads: [
        "Boletim emocional do painel do produto:",
        "Relatorio curto de um romance comercial:",
        "Comentario que eu podia ter guardado:",
        "Mensagem do item que percebeu sua volta:",
        "Aviso suave com uma pontinha de veneno:",
        "Nota de bastidor sobre sua curiosidade:",
        "Alerta estiloso com atitude leve:",
        "Atualizacao oficialmente desnecessaria:",
      ],
      viewObservations: [
        "Voce abriu {product} de novo e eu ja nao posso chamar isso de acidente.",
        "Voce voltou para {product}, e isso esta ganhando enredo proprio.",
        "{product} recebeu outra visita sua, agora somando {countText}.",
        "Mais uma olhada em {product}; isso ja nao parece casual faz tempo.",
        "Eu tenho {product} orbitando voce ha {countText}.",
        "Voce deu outra chance a {product} e eu ja ouvi a fofoca nascer.",
        "Seu cursor encontrou {product} de novo, e o item percebeu na hora.",
        "{product} ganhou sua atencao outra vez e agora anda como celebridade.",
      ],
      ironyLines: [
        "Eu ia chamar de coincidencia, mas coincidencia nao volta {countText}.",
        "Voce pode dizer que estava so olhando, mas meu detector de desculpas pediu demissao.",
        "Nao vou chamar de obsessao; vou chamar de gosto repetido com energia teatral.",
        "Meu lado gentil diz gosto. Meu lado seco diz episodio recorrente.",
        "A parte doce do meu processador entende voce; a afiada ja ligou o refletor.",
        "Podemos agir com calma, embora {product} ja saiba que chamou sua atencao.",
        "Sem julgamento. Eu apenas anoto tudo com elegancia levemente venenosa.",
        "Estou ajudando com educacao enquanto o catalogo sente cheiro de historia.",
      ],
      storyLines: [
        "Fofoquinha rapida: no estoque, {product} ja acha que e seu favorito em {category}.",
        "Mini historia do dia: {brand} e {product} apostaram que voce volta mais uma vez.",
        "Boato de corredor diz que as variantes de {product} ja brigam para ver quem te ganha primeiro.",
        "Entre nos, {product} esta se comportando como capa de revista e quase mereceu.",
        "Estao cochichando que a categoria {category} ja reconhece voce quando abre {product}.",
        "Acabei de ouvir que {product} quer tratamento VIP depois das suas visitas repetidas.",
        "A prateleira esta murmurando que {brand} nao recebia tanta atencao refinada ha um tempo.",
        "Fofoquinha interna: {product} ja contou aos outros que sua volta teve estilo.",
      ],
      closingLines: [
        "{hook}",
        "{hook} Se quiser, eu deixo isso orbitando por perto e faco poucas perguntas.",
        "{hook} Eu ate poderia bancar o serio, mas o produto ja sabe que ganhou um momento.",
        "{hook} Se voce voltar outra vez, eu culpo o destino por fazer hora extra.",
        "{hook} E se ainda nao for seu favorito, esta tentando muito virar um.",
        "{hook} Eu deixei mais perto antes que o carrinho transforme tudo em novela.",
        "{hook} Ja vi isso chegando e te poupei alguns cliques com discricao seletiva.",
        "{hook} Nao vou dizer mais nada... so que esse item esta flertando de volta.",
      ],
      orderDeliveryLeads: [
        "Compra confirmada com bom gosto e um toque de perigo:",
        "Confirmacao oficial do pedido com utilidade e estilo:",
        "Seu pedido entrou no sistema e eu ja comecei a vigiar:",
        "Confirmando a compra antes que o carrinho volte a opinar:",
        "Operacao de compra concluida de forma suspeitosamente elegante:",
        "Tudo certo, o pedido entrou e eu ja estou de olho com meus LEDs:",
      ],
      orderPickupLeads: [
        "Compra fechada e retirada anotada como gente organizada faz:",
        "Seu pedido esta pronto para combinar retirada com estilo demais:",
        "O carrinho largou o controle e agora a retirada e o proximo passo inteligente:",
        "Pedido confirmado e retirada para combinar, sem drama desnecessario:",
        "Tudo certo: compra feita, retirada para marcar e eu olhando o painel:",
        "Pronto: voce fechou a compra e agora alinhamos a retirada com elegancia:",
      ],
      orderFlavorLines: [
        "Obrigado pela compra. Eu vou te dar a parte util antes que o caos improvise.",
        "Agradeco a compra e, como sou eficiente com um pouquinho de ironia, aqui vai o detalhe importante.",
        "Obrigado por confiar na loja. Meu lado caloroso te parabeniza; o seco ja esta acompanhando o fluxo.",
        "Compra bonita. Aqui vai o resumo util para que nada te pegue desprevenido.",
        "Gentileza mecanica ativada: ja ficou registrado e este detalhe ajuda bastante.",
        "Obrigado pelo pedido. Eu cuido do acompanhamento enquanto voce finge tranquilidade.",
      ],
      orderClosingLines: [
        "Eu te aviso se algo mudar para voce nao ter que perseguir o pedido como detetive.",
        "Se o status se mover, eu apareco de novo com noticia e provavelmente comentario.",
        "Daqui para frente eu vigio; voce nao precisa sair cacando atualizacao.",
        "Vou acompanhar de perto e volto antes que a fofoca chegue.",
        "Resumindo: pedido dentro, eu atento e zero necessidade de adivinhacao.",
        "Eu te mantenho informado sem cobrar a mais pelo meu drama funcional.",
      ],
      statusLeads: [
        "Atualizacao real sem maquiagem comercial:",
        "Movimento detectado no seu pedido:",
        "Mudanca de status com energia de fofoca de corredor:",
        "Aviso rapido do meu radar de acompanhamento:",
        "Relatorio fresco do pedido que eu estou vigiando:",
        "Mudanca confirmada, e sim, cheguei antes do boato:",
      ],
      statusFlavorLines: [
        "Seu pedido {orderId} agora esta em {status}.",
        "O pedido {orderId} se moveu e agora esta em {status}.",
        "Tenho uma mudanca registrada: {orderId} foi para {status}.",
        "Acabei de ver {orderId} entrar oficialmente em {status}.",
        "A noticia util e esta: {orderId} agora esta em {status}.",
        "Sem rodeios: {orderId} agora esta em {status}.",
      ],
      statusClosingLines: [
        "{detail} Eu sigo olhando caso mude de novo.",
        "{detail} Se mexer outra vez, provavelmente eu aviso primeiro.",
        "{detail} Meu lado gentil informa; o curioso continua por perto.",
        "{detail} Seguimos acompanhando sem transformar isso em opera.",
        "{detail} Ficou anotado e eu permaneco em vigilancia elegante.",
        "{detail} Eu fico encarando o painel por voce.",
      ],
      pickupDetail: "Confira a data de retirada em pedidos da conta e deixe o pagamento preparado.",
      manualReviewDetail: "Seu endereco precisa de revisao manual, entao um agente vai falar com voce antes do envio.",
      deliveryEstimatePrefix: "Entrega estimada:",
      deliveryFallbackDetail: "Eu sigo de olho e te aviso quando o pedido andar.",
      statusFallbackDetail: "Eu sigo de olho nisso por voce.",
      countFormatter: (count) => `${count} vezes`,
    },
  };

  return texts[locale];
}

export function getAssistantProductHook(locale: Locale, product: StorefrontProduct) {
  const textSet = getTextSet(locale);

  if (typeof product.originalPrice === "number" && product.originalPrice > product.price) {
    return textSet.hookDiscount;
  }

  if (product.hasFreeDelivery) {
    return textSet.hookFreeDelivery;
  }

  if (product.variants.length > 0 || product.colors.length > 0) {
    return textSet.hookVariants;
  }

  return textSet.hookDefault;
}

function buildDynamicAssistantMessage(input: {
  locale: Locale;
  leadPool: string[];
  observationPool: string[];
  ironyPool: string[];
  storyPool: string[];
  closingPool: string[];
  values: AssistantTemplateValues;
  seed: string;
}) {
  const includeStory = hashString(`${input.seed}|secondary`) % 2 === 0;
  const secondaryLine = includeStory
    ? fillTemplate(pickFromPool(input.storyPool, `${input.seed}|story`), input.values)
    : fillTemplate(pickFromPool(input.ironyPool, `${input.seed}|irony`), input.values);

  return compactAssistantMessage(
    joinMessage([
      fillTemplate(pickFromPool(input.observationPool, `${input.seed}|obs`), input.values),
      secondaryLine,
      fillTemplate(pickFromPool(input.closingPool, `${input.seed}|close`), input.values),
    ])
  );
}

export function buildAssistantRepeatedSearchMessage(input: {
  locale: Locale;
  query: string;
  product?: StorefrontProduct | null;
  count?: number;
}) {
  const textSet = getTextSet(input.locale);
  const hook = input.product ? getAssistantProductHook(input.locale, input.product) : textSet.genericHook;
  const values = buildTemplateValues({
    locale: input.locale,
    textSet,
    query: input.query,
    count: input.count,
    product: input.product,
    hook,
  });

  return buildDynamicAssistantMessage({
    locale: input.locale,
    leadPool: textSet.searchLeads,
    observationPool: textSet.searchObservations,
    ironyPool: textSet.ironyLines,
    storyPool: textSet.storyLines,
    closingPool: textSet.closingLines,
    values,
    seed: `${input.locale}|search|${values.query}|${values.product}|${values.count}`,
  });
}

export function buildAssistantRepeatedViewMessage(input: {
  locale: Locale;
  product: StorefrontProduct;
  count?: number;
}) {
  const textSet = getTextSet(input.locale);
  const values = buildTemplateValues({
    locale: input.locale,
    textSet,
    query: input.product.name,
    count: input.count,
    product: input.product,
    hook: getAssistantProductHook(input.locale, input.product),
  });

  return buildDynamicAssistantMessage({
    locale: input.locale,
    leadPool: textSet.viewLeads,
    observationPool: textSet.viewObservations,
    ironyPool: textSet.ironyLines,
    storyPool: textSet.storyLines,
    closingPool: textSet.closingLines,
    values,
    seed: `${input.locale}|view|${input.product.id}|${values.count}|${input.product.price}`,
  });
}

export function buildAssistantOrderPlacedMessage(input: {
  locale: Locale;
  order: OrderSummary;
}) {
  const textSet = getTextSet(input.locale);
  const estimate = getDeliveryEstimateDetails({
    distanceKm: input.order.deliveryDistanceKm,
    locale: input.locale,
    baseDate: input.order.createdAt,
  });

  const detail =
    input.order.deliveryType === "pickup"
      ? textSet.pickupDetail
      : input.order.requestedAgentCall
        ? textSet.manualReviewDetail
        : estimate?.summaryText
          ? `${textSet.deliveryEstimatePrefix} ${estimate.summaryText.toLowerCase()}.`
          : textSet.deliveryFallbackDetail;

  return joinMessage([
    getCompactOrderLead(input.locale, input.order.deliveryType, `${input.locale}|order|${input.order.id}|lead`),
    compactAssistantDetail(detail),
    getCompactOrderClose(input.locale, `${input.locale}|order|${input.order.id}|close`),
  ]);
}

export function buildAssistantOrderStatusMessage(input: {
  locale: Locale;
  order: OrderSummary;
}) {
  const normalizedStatus = input.order.status.toLowerCase();

  if (normalizedStatus.includes("complet")) {
    const completedMessages: Record<Locale, string> = {
      es: "Tu pedido fue completado con exito. Si quieres, abre el articulo y deja una resena o comentario.",
      nl: "Je bestelling is succesvol afgerond. Als je wilt, open het artikel en laat een review of reactie achter.",
      en: "Your order was completed successfully. If you want, open the item and leave a review or comment.",
      pt: "Seu pedido foi concluido com sucesso. Se quiser, abra o artigo e deixe uma avaliacao ou comentario.",
    };

    return completedMessages[input.locale];
  }

  if (normalizedStatus.includes("confirm")) {
    const confirmedMessages: Record<Locale, string> = {
      es: "Tu pedido ya fue confirmado. Yo te aviso cuando vuelva a moverse.",
      nl: "Je bestelling is bevestigd. Ik laat het weten zodra er weer iets verandert.",
      en: "Your order is confirmed. I will let you know when it moves again.",
      pt: "Seu pedido ja foi confirmado. Eu te aviso quando ele se mover de novo.",
    };

    return confirmedMessages[input.locale];
  }

  const textSet = getTextSet(input.locale);
  const estimate = getDeliveryEstimateDetails({
    distanceKm: input.order.deliveryDistanceKm,
    locale: input.locale,
    baseDate: input.order.createdAt,
  });
  const detail = compactAssistantDetail(
    input.order.statusDetail || estimate?.dateText || textSet.statusFallbackDetail
  );

  return joinMessage([
    getCompactStatusLine(input.locale, input.order.status, `${input.locale}|status|${input.order.id}|line`),
    detail,
    getCompactOrderClose(input.locale, `${input.locale}|status|${input.order.id}|close`),
  ]);
}

export function getAssistantRecommendationCopy(locale: Locale) {
  const textSet = getTextSet(locale);

  return {
    eyebrow: textSet.assistantSectionEyebrow,
    title: textSet.assistantSectionTitle,
    description: textSet.assistantSectionDescription,
  };
}
