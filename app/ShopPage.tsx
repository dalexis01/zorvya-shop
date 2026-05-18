"use client";

import Image from "next/image";
import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AccountModal from "@/components/account/AccountModal";
import CartPanel from "@/components/CartPanel";
import CheckoutModal from "@/components/CheckoutModal";
import OrderConfirmationModal from "@/components/OrderConfirmationModal";
import ProductCard from "@/components/storefront/ProductCard";
import ProductQuickViewPanel from "@/components/storefront/ProductQuickViewPanel";
import {
  hydrateStoredCart,
  readStoredCart,
  readStoredCartSelection,
  toStoredCart,
  writeStoredCart,
  writeStoredCartSelection,
  type HydratedCartEntry,
} from "@/lib/shop/cart-storage";
import {
  applyClientTheme,
  readStoredClientTheme,
  type ClientTheme,
} from "@/lib/shop/client-theme";
import { toPickupDateKey } from "@/lib/shop/checkout";
import { STORE_BRAND } from "@/lib/shop/config";
import {
  buildAssistantOrderPlacedMessage,
  buildAssistantRepeatedSearchMessage,
  buildAssistantRepeatedViewMessage,
  createDefaultCustomerAssistantState,
  readCustomerAssistantState,
  rememberRecommendedProducts,
  trackAssistantProductView,
  trackAssistantSearch,
  writeCustomerAssistantState,
  type CustomerAssistantState,
} from "@/lib/shop/customer-assistant";
import { autoTranslateText } from "@/lib/shop/auto-localization";
import { buildCartKey } from "@/lib/shop/display-utils";
import { getDeliveryEstimate } from "@/lib/shop/delivery-estimates";
import { LOCALE_STORAGE_EVENT, readStoredLocale, writeStoredLocale } from "@/lib/shop/locale-storage";
import { formatCurrencySrd as formatCurrency } from "@/lib/shop/number-format";
import { orderStorefrontProducts } from "@/lib/shop/product-ordering";
import {
  clampCartQuantityToStock,
  getProductAvailableStock,
  isCartEntryPayable,
} from "@/lib/shop/product-stock";
import { ACCEPTED_IMAGE_TYPES, imageFileToDataUrl } from "@/lib/shop/image-upload";
import { localizeProduct } from "@/lib/shop/product-localization";
import type { HomepageSettings, SupportMessage } from "@/lib/shop/admin-types";
import type {
  CatalogProductOption,
  CheckoutCustomerData,
  Locale,
  OrderSummary,
  SessionUser,
  StorefrontProduct,
} from "@/lib/shop/types";

const SUPPORT_TOKEN_STORAGE_KEY = "zorvya-support-token";

type SearchSuggestion = {
  id: string;
  kind: "product" | "category" | "tag";
  label: string;
  value: string;
};

type SupportResponse = {
  success?: boolean;
  conversation?: SupportMessage | null;
  error?: string;
};

type SessionResponse = {
  authenticated?: boolean;
  user?: SessionUser | null;
};

type OrderMutationResponse = {
  success?: boolean;
  order?: OrderSummary;
  error?: string;
  errors?: Record<string, string[]>;
};

type PayPalCreateOrderResponse = {
  success?: boolean;
  paypalOrderId?: string;
  error?: string;
  errors?: Record<string, string[]>;
};

type DeliveryQuote = {
  distanceKm: number;
  fee: number;
  allowsDelivery: boolean;
  isValidSurinameAddress: boolean;
  requiresAgentReview: boolean;
  isFree: boolean;
  freeDeliveryMinimum: number | null;
};

type RelatedProductEntry = {
  product: StorefrontProduct;
  kind: "recommended" | "similar";
};

type QuickViewSelection = {
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedColor?: string;
  unitPrice?: number;
  selectedImage?: string;
};

type AssistantEntry = {
  id: string;
  sender: "bot" | "customer" | "support";
  senderName: string;
  message: string;
  attachments?: string[];
  createdAt: string;
};

type AssistantBubble = {
  id: string;
  message: string;
};

const PROMO_BADGES = ["40% OFF", "HOT DEAL", "SOLO HOY", "TOP OFFER"] as const;

function shouldUseDirectStorefrontImage(src: string) {
  return src.startsWith("data:") || src.startsWith("/api/products/");
}

function CatalogPromoBanner({
  products,
  onOpen,
  initialIndex = 0,
}: {
  products: StorefrontProduct[];
  onOpen: (product: StorefrontProduct) => void;
  initialIndex?: number;
}) {
  const [activeIndex, setActiveIndex] = useState(
    products.length > 0 ? initialIndex % products.length : 0
  );

  useEffect(() => {
    if (products.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % products.length);
    }, 3400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [products.length]);

  const activeProduct = products[activeIndex] ?? products[0] ?? null;

  if (!activeProduct) {
    return null;
  }

  return (
    <article className="relative col-span-2 row-span-2 overflow-hidden rounded-[1.15rem] border border-rose-400/40 bg-[#050816] shadow-[0_18px_50px_rgba(2,6,23,0.46)] sm:rounded-[1.35rem] md:col-span-2 lg:col-span-2 xl:col-span-2">
      <button
        type="button"
        onClick={() => onOpen(activeProduct)}
        className="relative block h-full min-h-[16.5rem] w-full overflow-hidden text-left sm:min-h-[19rem] lg:min-h-[20rem]"
      >
        {products.map((product, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={`promo-${product.id}`}
              className={`absolute inset-0 transition-all duration-700 ${
                isActive ? "opacity-100 scale-100" : "pointer-events-none opacity-0 scale-[1.035]"
              }`}
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                quality={96}
                unoptimized={shouldUseDirectStorefrontImage(product.image)}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
                className="object-cover"
              />
            </div>
          );
        })}

        <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-black/10" />

        <span className="absolute left-3 top-3 rounded-full border border-rose-300/35 bg-rose-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white shadow-[0_8px_24px_rgba(225,29,72,0.45)] sm:left-4 sm:top-4">
          {PROMO_BADGES[activeIndex % PROMO_BADGES.length]}
        </span>

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 backdrop-blur-sm">
          {products.map((product, index) => (
            <span
              key={`promo-dot-${product.id}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/45"
              }`}
            />
          ))}
        </div>
      </button>
    </article>
  );
}

function getMobilePromoInsertionIndexes(productCount: number) {
  const indexes = new Set<number>();
  const intervals = [8, 12, 6] as const;

  if (productCount <= 1) {
    return indexes;
  }

  let nextIndex = 1;
  let intervalIndex = 0;

  while (nextIndex < productCount - 1) {
    indexes.add(nextIndex);
    nextIndex += intervals[intervalIndex % intervals.length];
    intervalIndex += 1;
  }

  return indexes;
}

type QuickViewState = {
  productId: string;
  initialSelection?: QuickViewSelection;
};

type ShopPageProps = {
  initialProducts: StorefrontProduct[];
  initialSettings: HomepageSettings;
  initialRenderAt: number;
  initialClientTheme: ClientTheme;
  paypalClientId: string | null;
};

type ProductDetailResponse = {
  success?: boolean;
  product?: StorefrontProduct;
};

const texts = {
  es: {
    searchHint: "Sugerencias en tiempo real",
    noSearchResults: "No encontramos resultados para esa busqueda.",
    results: "Resultados",
    loadingProducts: "Cargando catalogo real...",
    emptyCatalog: "Todavia no hay productos publicados.",
    support: "Soporte",
    account: "Cuenta",
    cart: "Carrito",
    supportTitle: "Chat de soporte",
    supportSubtitle: "Escribe y el mensaje llega directo a administracion.",
    supportPlaceholder: "Escribe tu mensaje...",
    supportEmail: "Correo de contacto",
    supportSend: "Enviar mensaje",
    supportSending: "Enviando...",
    supportEmpty: "Empieza la conversacion y sigue respondiendo desde aqui.",
    supportPhoneLabel: "Telefono Suriname",
    supportLoading: "Cargando chat...",
    supportUnread: "Tienes un mensaje de soporte.",
    supportAttach: "Adjuntar imagen",
    supportAttachmentLimit: "Puedes enviar hasta 4 imagenes.",
    supportAttachmentError: "No se pudo cargar una de las imagenes.",
    supportMessageRequired: "Completa el correo y escribe un mensaje o adjunta una imagen.",
    cartAdded: "Articulo Agregado",
    cartAddedDetail: "Ya esta guardado en tu carrito.",
    cartOutOfStock: "Ese articulo no tiene stock por ahora.",
    emptyAssistant: "Estoy listo para ayudarte con productos, pedidos y soporte.",
    assistantTitle: "ZorvYBOT",
    assistantSubtitle: "Avisos y ayuda rapida",
    assistantPlaceholder: "Escribe aqui...",
    assistantSupportLocked: "Aqui te muestro la respuesta real de soporte.",
    assistantOpenSupport: "Abrir soporte",
    assistantSend: "Enviar",
    assistantSending: "Enviando...",
    assistantUnreadJoke: "Tienes un mensaje de soporte. Si, llegue antes que el chisme.",
    categoryAll: "Todo",
    productsActive: "productos activos",
    supportStatus: "Soporte activo",
    explore: "Catalogo activo",
    close: "Cerrar",
    arriveCatalog: "Ir al catalogo",
    supportReplyEyebrow: "Respuesta de soporte",
  },
  nl: {
    searchHint: "Realtime suggesties",
    noSearchResults: "Geen resultaten voor deze zoekopdracht.",
    results: "Resultaten",
    loadingProducts: "Echte catalogus laden...",
    emptyCatalog: "Er zijn nog geen gepubliceerde producten.",
    support: "Support",
    account: "Account",
    cart: "Winkelwagen",
    supportTitle: "Support chat",
    supportSubtitle: "Schrijf en je bericht gaat direct naar administratie.",
    supportPlaceholder: "Schrijf je bericht...",
    supportEmail: "Contact e-mail",
    supportSend: "Bericht verzenden",
    supportSending: "Verzenden...",
    supportEmpty: "Start het gesprek en blijf hier verder praten.",
    supportPhoneLabel: "Suriname telefoon",
    supportLoading: "Chat laden...",
    supportUnread: "Je hebt een supportbericht.",
    supportAttach: "Afbeelding toevoegen",
    supportAttachmentLimit: "Je kunt tot 4 afbeeldingen sturen.",
    supportAttachmentError: "Een van de afbeeldingen kon niet worden geladen.",
    supportMessageRequired: "Vul je e-mail in en schrijf een bericht of voeg een afbeelding toe.",
    cartAdded: "Artikel Toegevoegd",
    cartAddedDetail: "Het staat al veilig in je winkelwagen.",
    cartOutOfStock: "Dit artikel heeft nu geen voorraad.",
    emptyAssistant: "Ik help je met producten, bestellingen en support.",
    assistantTitle: "ZorvYBOT",
    assistantSubtitle: "Snelle hulp en meldingen",
    assistantPlaceholder: "Schrijf hier...",
    assistantSupportLocked: "Hier zie je de echte reactie van support.",
    assistantOpenSupport: "Support openen",
    assistantSend: "Verzenden",
    assistantSending: "Verzenden...",
    assistantUnreadJoke: "Je hebt een supportbericht. Ja, ik was er voor de roddel.",
    categoryAll: "Alles",
    productsActive: "actieve producten",
    supportStatus: "Support actief",
    explore: "Actieve catalogus",
    close: "Sluiten",
    arriveCatalog: "Ga naar catalogus",
    supportReplyEyebrow: "Supportreactie",
  },
  en: {
    searchHint: "Real-time suggestions",
    noSearchResults: "We could not find results for that search.",
    results: "Results",
    loadingProducts: "Loading real catalog...",
    emptyCatalog: "There are no published products yet.",
    support: "Support",
    account: "Account",
    cart: "Cart",
    supportTitle: "Support chat",
    supportSubtitle: "Write and your message goes straight to administration.",
    supportPlaceholder: "Write your message...",
    supportEmail: "Contact email",
    supportSend: "Send message",
    supportSending: "Sending...",
    supportEmpty: "Start the conversation and keep replying from here.",
    supportPhoneLabel: "Suriname phone",
    supportLoading: "Loading chat...",
    supportUnread: "You have a support message.",
    supportAttach: "Attach image",
    supportAttachmentLimit: "You can send up to 4 images.",
    supportAttachmentError: "One of the images could not be loaded.",
    supportMessageRequired: "Add your email and write a message or attach an image.",
    cartAdded: "Item Added",
    cartAddedDetail: "It is already saved in your cart.",
    cartOutOfStock: "That item is out of stock for now.",
    emptyAssistant: "I am ready to help with products, orders, and support.",
    assistantTitle: "ZorvYBOT",
    assistantSubtitle: "Quick help and alerts",
    assistantPlaceholder: "Type here...",
    assistantSupportLocked: "Here I am showing you the real support reply.",
    assistantOpenSupport: "Open support",
    assistantSend: "Send",
    assistantSending: "Sending...",
    assistantUnreadJoke: "You have a support message. Yes, I arrived before the gossip.",
    categoryAll: "All",
    productsActive: "active products",
    supportStatus: "Support active",
    explore: "Active catalog",
    close: "Close",
    arriveCatalog: "Go to catalog",
    supportReplyEyebrow: "Support reply",
  },
  pt: {
    searchHint: "Sugestoes em tempo real",
    noSearchResults: "Nao encontramos resultados para essa busca.",
    results: "Resultados",
    loadingProducts: "Carregando catalogo real...",
    emptyCatalog: "Ainda nao ha produtos publicados.",
    support: "Suporte",
    account: "Conta",
    cart: "Carrinho",
    supportTitle: "Chat de suporte",
    supportSubtitle: "Escreva e sua mensagem chega direto a administracao.",
    supportPlaceholder: "Escreva sua mensagem...",
    supportEmail: "E-mail de contato",
    supportSend: "Enviar mensagem",
    supportSending: "Enviando...",
    supportEmpty: "Comece a conversa e continue respondendo por aqui.",
    supportPhoneLabel: "Telefone Suriname",
    supportLoading: "Carregando chat...",
    supportUnread: "Voce tem uma mensagem do suporte.",
    supportAttach: "Anexar imagem",
    supportAttachmentLimit: "Voce pode enviar ate 4 imagens.",
    supportAttachmentError: "Nao foi possivel carregar uma das imagens.",
    supportMessageRequired: "Complete o e-mail e escreva uma mensagem ou anexe uma imagem.",
    cartAdded: "Artigo Adicionado",
    cartAddedDetail: "Ele ja esta salvo no seu carrinho.",
    cartOutOfStock: "Esse artigo esta sem estoque por agora.",
    emptyAssistant: "Estou pronto para ajudar com produtos, pedidos e suporte.",
    assistantTitle: "ZorvYBOT",
    assistantSubtitle: "Ajuda rapida e avisos",
    assistantPlaceholder: "Escreva aqui...",
    assistantSupportLocked: "Aqui eu te mostro a resposta real do suporte.",
    assistantOpenSupport: "Abrir suporte",
    assistantSend: "Enviar",
    assistantSending: "Enviando...",
    assistantUnreadJoke: "Voce tem uma mensagem do suporte. Sim, eu cheguei antes da fofoca.",
    categoryAll: "Tudo",
    productsActive: "produtos ativos",
    supportStatus: "Suporte ativo",
    explore: "Catalogo ativo",
    close: "Fechar",
    arriveCatalog: "Ir ao catalogo",
    supportReplyEyebrow: "Resposta do suporte",
  },
} as const;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function sanitizeCategoryLabel(value: string) {
  return value.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

function getPrimaryCategory(value: string) {
  const normalizedValue = sanitizeCategoryLabel(value);
  const segments = normalizedValue.split(/\s*(?:→|->|â†’|â’)\s*/g).filter(Boolean);
  return segments[0] || normalizedValue;
}

function getCategoryKey(value: string) {
  const primaryCategory = normalizeText(getPrimaryCategory(value));

  if (primaryCategory.includes("electronics") || primaryCategory.includes("electronica")) {
    return "electronics";
  }

  if (primaryCategory.includes("electrodomesticos")) {
    return "electrodomesticos";
  }

  if (primaryCategory.includes("home appliances")) {
    return "home appliances";
  }

  if (primaryCategory.includes("catalogo general")) {
    return "catalogo general";
  }

  if (
    primaryCategory.includes("office furniture") ||
    primaryCategory.includes("muebles de oficina") ||
    primaryCategory.includes("mobiliario")
  ) {
    return "office furniture";
  }

  return primaryCategory;
}

function isRecentStorefrontProduct(
  product: Pick<StorefrontProduct, "createdAt">,
  referenceTimestamp: number
) {
  if (!product.createdAt) {
    return false;
  }

  const createdAt = new Date(product.createdAt).getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  const newWindowMs = 3 * 24 * 60 * 60 * 1000;
  return Math.max(0, referenceTimestamp - createdAt) <= newWindowMs;
}

function translateStaticText(value: string, locale: Locale) {
  return locale === "es" ? value : autoTranslateText(value, locale) || value;
}

function buildProductSearchBlob(product: StorefrontProduct) {
  return normalizeText(
    [
      product.name,
      product.shortDescription,
      product.longDescription,
      product.brand,
      product.category,
      product.inventoryLabel,
      product.deliveryLabel,
      product.badge,
      ...product.tags,
      ...product.colors,
      ...product.variants.flatMap((variant) => [variant.name, variant.details, variant.color]),
    ].join(" ")
  );
}

function getSuggestionIcon(kind: SearchSuggestion["kind"]) {
  if (kind === "category") {
    return "[]";
  }

  if (kind === "tag") {
    return "#";
  }

  return "o";
}

function createAssistantEntry(
  sender: AssistantEntry["sender"],
  senderName: string,
  message: string
): AssistantEntry {
  return {
    id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sender,
    senderName,
    message,
    createdAt: new Date().toISOString(),
  };
}

function buildOrderPayload(
  cart: HydratedCartEntry[],
  customerData: CheckoutCustomerData
) {
  const subtotal = cart.reduce(
    (sum, entry) => sum + (entry.unitPrice ?? entry.product.price) * entry.quantity,
    0
  );
  const deliveryFee = customerData.deliveryType === "delivery" ? customerData.deliveryFee ?? 0 : 0;
  const total = subtotal + deliveryFee;

  return {
    name: customerData.name,
    phone: customerData.phone,
    email: customerData.email,
    address: customerData.address,
    deliveryType: customerData.deliveryType,
    pickupDate:
      customerData.deliveryType === "pickup" && customerData.pickupDate
        ? toPickupDateKey(customerData.pickupDate)
        : undefined,
    pickupTime: customerData.deliveryType === "pickup" ? customerData.pickupTime : undefined,
    requestedAgentCall: customerData.requestedAgentCall,
    paymentMethod: customerData.paymentMethod,
    paypalDisplayCurrency:
      customerData.paymentMethod === "paypal" ? customerData.paypalDisplayCurrency : null,
    paymentFeeRate: customerData.paymentFeeRate,
    paymentFeeAmountSrd: customerData.paymentFeeAmountSrd,
    paymentGrandTotalSrd: customerData.paymentGrandTotalSrd,
    paymentPayableUsd: customerData.paymentPayableUsd,
    exchangeRateSrdPerUsd: customerData.exchangeRateSrdPerUsd,
    products: cart.map((entry) => ({
      productId: entry.product.id,
      name: entry.product.name,
      price: entry.unitPrice ?? entry.product.price,
      quantity: entry.quantity,
      image: entry.selectedImage || entry.product.image,
      selectedVariantId: entry.selectedVariantId,
      selectedVariantName: entry.selectedVariantName,
      selectedColor: entry.selectedColor,
    })),
    subtotal,
    deliveryDistanceKm: customerData.deliveryDistanceKm,
    deliveryFee,
    total,
  };
}

function buildSearchSuggestions(products: StorefrontProduct[], query: string): SearchSuggestion[] {
  const normalizedSearch = normalizeText(query);

  if (!normalizedSearch) {
    return [];
  }

  const productSuggestions = products
    .filter((product) => buildProductSearchBlob(product).includes(normalizedSearch))
    .slice(0, 4)
    .map((product) => ({
      id: `product-${String(product.id)}`,
      kind: "product" as const,
      label: product.name,
      value: product.name,
    }));

  const categorySuggestions = Array.from(
    new Set(
      products
        .map((product) => product.category)
        .filter((category) => normalizeText(category).includes(normalizedSearch))
    )
  )
    .slice(0, 3)
    .map((category) => ({
      id: `category-${category}`,
      kind: "category" as const,
      label: category,
      value: getCategoryKey(category),
    }));

  const tagSuggestions = Array.from(
    new Set(
      products
        .flatMap((product) => product.tags)
        .filter((tag) => normalizeText(tag).includes(normalizedSearch))
    )
  )
    .slice(0, 3)
    .map((tag) => ({
      id: `tag-${tag}`,
      kind: "tag" as const,
      label: tag,
      value: tag,
    }));

  return [...productSuggestions, ...categorySuggestions, ...tagSuggestions].slice(0, 8);
}

export default function ShopPage({
  initialProducts,
  initialSettings,
  initialRenderAt,
  initialClientTheme,
  paypalClientId,
}: ShopPageProps) {
  const [locale, setLocale] = useState<Locale>("es");
  const [clientTheme, setClientTheme] = useState<ClientTheme>(initialClientTheme);
  const [products, setProducts] = useState<StorefrontProduct[]>(() =>
    orderStorefrontProducts(initialProducts, String(initialRenderAt), initialRenderAt)
  );
  const [settings] = useState<HomepageSettings>(initialSettings);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchFocused, setSearchFocused] = useState(false);
  const [cart, setCart] = useState<HydratedCartEntry[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [selectedCartKeys, setSelectedCartKeys] = useState<string[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [lastOverlayOpened, setLastOverlayOpened] = useState<"cart" | "chat" | null>(null);
  const [chatPanelMode, setChatPanelMode] = useState<"assistant" | "support">("assistant");
  const [quickViewState, setQuickViewState] = useState<QuickViewState | null>(null);
  const [productDetailCache, setProductDetailCache] = useState<Record<string, StorefrontProduct>>({});
  const [relatedSearchQuery, setRelatedSearchQuery] = useState("");
  const [relatedRefreshIndex, setRelatedRefreshIndex] = useState(0);
  const [checkoutData, setCheckoutData] = useState<CheckoutCustomerData | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [supportConversation, setSupportConversation] = useState<SupportMessage | null>(null);
  const [supportToken, setSupportToken] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportAttachments, setSupportAttachments] = useState<string[]>([]);
  const [supportContactEmail, setSupportContactEmail] = useState("");
  const [supportError, setSupportError] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [assistantEntries, setAssistantEntries] = useState<AssistantEntry[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantSending, setAssistantSending] = useState(false);
  const [assistantBubble, setAssistantBubble] = useState<AssistantBubble | null>(null);
  const [assistantState, setAssistantState] = useState<CustomerAssistantState>(
    createDefaultCustomerAssistantState
  );
  const [cartPulseActive, setCartPulseActive] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const supportMessagesRef = useRef<HTMLDivElement | null>(null);
  const assistantMessagesRef = useRef<HTMLDivElement | null>(null);
  const supportAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const assistantStateRef = useRef<CustomerAssistantState>(assistantState);
  const bubbleTimeoutRef = useRef<number | null>(null);
  const cartSelectionInitializedRef = useRef(false);
  const previousCartKeysRef = useRef<string[]>([]);
  const lastTrackedSearchRef = useRef("");
  const lastNotifiedSupportEntryRef = useRef("");

  const t = texts[locale];
  const localizedSettings = settings.localizedContent[locale] ?? settings.localizedContent.es;
  const theme = settings.theme;
  const cartPanelWidth = isCompactViewport ? "calc(100vw - 1rem)" : "min(92vw, 24rem)";
  const chatPanelWidth = isCompactViewport ? "calc(100vw - 1rem)" : "min(92vw, 22rem)";
  const dockGap = isCompactViewport ? "0.5rem" : "1rem";
  const dockEdge = isCompactViewport ? "0.5rem" : "1rem";
  const shouldLockBackgroundScroll =
    cartOpen ||
    accountOpen ||
    checkoutOpen ||
    confirmationOpen ||
    assistantOpen ||
    quickViewState !== null;

  const localizedProducts = useMemo(
    () => products.map((product) => localizeProduct(product, locale)),
    [locale, products]
  );

  const accountProducts = useMemo<CatalogProductOption[]>(
    () =>
      localizedProducts.map((product) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
        tags: product.tags,
        brand: product.brand,
        rating: product.rating,
        reviewCount: product.reviewCount,
      })),
    [localizedProducts]
  );

  const selectedCart = useMemo(
    () => cart.filter((entry) => selectedCartKeys.includes(entry.cartKey)),
    [cart, selectedCartKeys]
  );
  const selectedCartCount = selectedCart.length;
  const selectedSubtotal = useMemo(
    () =>
      selectedCart.reduce(
        (sum, entry) => sum + (entry.unitPrice ?? entry.product.price) * entry.quantity,
        0
      ),
    [selectedCart]
  );
  const activeAddress = checkoutData?.address?.trim() || sessionUser?.address?.trim() || "";

  const searchSuggestions = useMemo(
    () => buildSearchSuggestions(localizedProducts, deferredSearch),
    [deferredSearch, localizedProducts]
  );

  const normalizedSearch = normalizeText(deferredSearch);
  const isFiltering = normalizedSearch.length > 0 || selectedCategory !== "all";

  const filteredProducts = useMemo(() => {
    return localizedProducts.filter((product) => {
      if (
        selectedCategory !== "all" &&
        getCategoryKey(product.category) !== selectedCategory
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return buildProductSearchBlob(product).includes(normalizedSearch);
    });
  }, [localizedProducts, normalizedSearch, selectedCategory]);

  const sectionSourceMap = useMemo(() => {
    const promotions = localizedProducts.filter(
      (product) => typeof product.originalPrice === "number" && product.originalPrice > product.price
    );
    const featured = localizedProducts.filter((product) => product.isFeatured);
    const top = localizedProducts.filter((product) => product.isTop);
    const newest = localizedProducts.filter((product) =>
      isRecentStorefrontProduct(product, initialRenderAt)
    );

    return {
      featured,
      top,
      promotions,
      newProducts: newest,
      allProducts: localizedProducts,
    };
  }, [initialRenderAt, localizedProducts]);

  const homepageSections = useMemo(() => {
    return [...settings.sectionOrder]
      .filter((section) => section.isEnabled)
      .sort((left, right) => left.order - right.order)
      .map((section) => {
        const customSelection =
          section.productIds.length > 0
            ? localizedProducts.filter((product) =>
                section.productIds.includes(String(product.id))
              )
            : [];

        const fallbackSelection =
          section.id === "featured"
            ? sectionSourceMap.featured
            : section.id === "top"
              ? sectionSourceMap.top
              : section.id === "promotions"
                ? sectionSourceMap.promotions
                : section.id === "newProducts"
                  ? sectionSourceMap.newProducts
                  : section.id === "allProducts"
                    ? sectionSourceMap.allProducts
                    : [];

        const productsForSection =
          customSelection.length > 0 ? customSelection : fallbackSelection;

        return {
          ...section,
          label: translateStaticText(section.label, locale),
          subtitle: translateStaticText(section.subtitle, locale),
          description: translateStaticText(section.description, locale),
          products:
            section.id === "allProducts" ? productsForSection : productsForSection.slice(0, 10),
        };
      })
      .filter((section) => section.id === "allProducts" || section.products.length > 0);
  }, [locale, localizedProducts, sectionSourceMap, settings.sectionOrder]);

  const visibleHomepageSections = useMemo(() => {
    const catalogSection = homepageSections.find((section) => section.id === "allProducts");

    if (catalogSection) {
      return [catalogSection];
    }

    if (homepageSections.length > 0) {
      return [homepageSections[0]];
    }

    return [
      {
        id: "allProducts",
        label: "",
        subtitle: "",
        description: "",
        products: localizedProducts,
      },
    ];
  }, [homepageSections, localizedProducts]);

  const catalogProducts = useMemo(
    () =>
      isFiltering
        ? filteredProducts
        : visibleHomepageSections.flatMap((section) => section.products),
    [filteredProducts, isFiltering, visibleHomepageSections]
  );
  const catalogPromoProducts = useMemo(() => {
    const source = catalogProducts.length > 5 ? catalogProducts.slice(1, 9) : catalogProducts;
    return source.filter((product) => Boolean(product.image)).slice(0, 4);
  }, [catalogProducts]);

  const marqueeItems = useMemo(() => {
    const source = localizedSettings.promoBarText || "";
    return source
      .split(/[\u2022|]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }, [localizedSettings.promoBarText]);

  const headerButtons = useMemo(
    () =>
      [...settings.buttonOrder]
        .filter((button) => button.isEnabled)
        .sort((left, right) => left.order - right.order),
    [settings.buttonOrder]
  );
  const mobileHeaderButtons = useMemo(() => {
    const targetOrder = ["account", "cart", "support"] as const;
    return targetOrder
      .map((target) => headerButtons.find((button) => button.target === target))
      .filter((button): button is (typeof headerButtons)[number] => Boolean(button));
  }, [headerButtons]);
  const mobilePromoInsertionIndexes = useMemo(
    () => getMobilePromoInsertionIndexes(catalogProducts.length),
    [catalogProducts.length]
  );

  const defaultDeliveryEstimateText =
    getDeliveryEstimate(6, locale)?.summaryText || localizedProducts[0]?.deliveryLabel || "";
  const deliveryEstimateText =
    getDeliveryEstimate(deliveryQuote?.distanceKm ?? null, locale)?.summaryText ||
    defaultDeliveryEstimateText;

  const selectedProduct = useMemo(() => {
    if (!quickViewState) {
      return null;
    }

    const cachedProduct = productDetailCache[quickViewState.productId];

    if (cachedProduct) {
      return localizeProduct(cachedProduct, locale);
    }

    return (
      localizedProducts.find((product) => String(product.id) === quickViewState.productId) ?? null
    );
  }, [localizedProducts, locale, productDetailCache, quickViewState]);

  useEffect(() => {
    if (!quickViewState || productDetailCache[quickViewState.productId]) {
      return;
    }

    const controller = new AbortController();
    const productId = quickViewState.productId;
    void fetch(`/api/products/${encodeURIComponent(productId)}?includeExtras=false`, {
      cache: "force-cache",
      signal: controller.signal,
    })
      .then((response) => response.json() as Promise<ProductDetailResponse>)
      .then((payload) => {
        if (!payload.success || !payload.product) {
          return;
        }

        setProductDetailCache((currentCache) => ({
          ...currentCache,
          [productId]: payload.product!,
        }));
      })
      .catch(() => undefined)
      .finally(() => undefined);

    return () => {
      controller.abort();
    };
  }, [productDetailCache, quickViewState]);

  const relatedProducts = useMemo<RelatedProductEntry[]>(() => {
    if (!selectedProduct) {
      return [];
    }

    const selectedId = String(selectedProduct.id);
    const entries = new Map<string, RelatedProductEntry>();

    const pushEntry = (product: StorefrontProduct, kind: RelatedProductEntry["kind"]) => {
      const productId = String(product.id);

      if (productId === selectedId || entries.has(productId)) {
        return;
      }

      entries.set(productId, { product, kind });
    };

    for (const recommendedId of assistantState.recommendedProductIds) {
      const recommended = localizedProducts.find(
        (product) => String(product.id) === String(recommendedId)
      );

      if (recommended) {
        pushEntry(recommended, "recommended");
      }
    }

    localizedProducts
      .filter(
        (product) =>
          String(product.id) !== selectedId &&
          (product.category === selectedProduct.category || product.brand === selectedProduct.brand)
      )
      .forEach((product) => pushEntry(product, "similar"));

    localizedProducts
      .filter((product) => String(product.id) !== selectedId)
      .forEach((product) => pushEntry(product, "similar"));

    return Array.from(entries.values()).slice(0, 14);
  }, [assistantState.recommendedProductIds, localizedProducts, selectedProduct]);

  const relatedSearchProducts = useMemo(() => {
    if (!selectedProduct) {
      return [];
    }

    return localizedProducts.filter((product) => String(product.id) !== String(selectedProduct.id));
  }, [localizedProducts, selectedProduct]);

  const hasUnreadSupportReply = useMemo(() => {
    if (!supportConversation) {
      return false;
    }

    const lastSupportEntry = [...supportConversation.chatEntries]
      .reverse()
      .find((entry) => entry.sender === "support");

    if (!lastSupportEntry) {
      return false;
    }

    const seenAt = supportConversation.customerSeenAt
      ? new Date(supportConversation.customerSeenAt).getTime()
      : 0;

    return new Date(lastSupportEntry.createdAt).getTime() > seenAt;
  }, [supportConversation]);

  const assistantHasHumanSupportReply = useMemo(
    () => Boolean(supportConversation?.chatEntries.some((entry) => entry.sender === "support")),
    [supportConversation]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncViewportLayout = () => {
      setIsCompactViewport(window.innerWidth < 768);
    };

    syncViewportLayout();
    window.addEventListener("resize", syncViewportLayout);

    return () => {
      window.removeEventListener("resize", syncViewportLayout);
    };
  }, []);

  const showingSupportChat = chatPanelMode === "support";
  const cartShouldShiftLeft =
    !isCompactViewport && cartOpen && assistantOpen && lastOverlayOpened === "cart";
  const chatShouldShiftLeft =
    !isCompactViewport && cartOpen && assistantOpen && lastOverlayOpened === "chat";
  const cartDockRight = cartShouldShiftLeft
    ? `calc(${dockEdge} + ${chatPanelWidth} + ${dockGap})`
    : dockEdge;
  const chatDockRight = chatShouldShiftLeft
    ? `calc(${dockEdge} + ${cartPanelWidth} + ${dockGap})`
    : dockEdge;
  const zorvyBotDockRight = isCompactViewport
    ? cartOpen || assistantOpen
      ? "-120px"
      : "1rem"
    : cartOpen && assistantOpen
      ? `calc(${dockEdge} + ${cartPanelWidth} + ${chatPanelWidth} + 2rem)`
      : cartOpen
        ? `calc(${dockEdge} + ${cartPanelWidth} + ${dockGap})`
        : assistantOpen
          ? `calc(${dockEdge} + ${chatPanelWidth} + ${dockGap})`
          : "74px";

  const assistantDisplayEntries = useMemo<AssistantEntry[]>(() => {
    if (showingSupportChat && supportConversation) {
      return supportConversation.chatEntries.map((entry) => ({
        id: entry.id,
        sender: entry.sender === "support" ? "support" : "customer",
        senderName: entry.senderName,
        message: entry.message,
        attachments: entry.attachments,
        createdAt: entry.createdAt,
      }));
    }

    return assistantEntries;
  }, [assistantEntries, showingSupportChat, supportConversation]);

  const readSupportToken = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(SUPPORT_TOKEN_STORAGE_KEY) ?? "";
  }, []);

  const ensureSupportToken = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const existingToken = readSupportToken();
    if (existingToken) {
      setSupportToken(existingToken);
      return existingToken;
    }

    const nextToken = window.crypto?.randomUUID?.() ?? `support-${Date.now()}`;
    window.localStorage.setItem(SUPPORT_TOKEN_STORAGE_KEY, nextToken);
    setSupportToken(nextToken);
    return nextToken;
  }, [readSupportToken]);

  const enqueueAssistantBubbleMessage = useCallback((message: string) => {
    if (bubbleTimeoutRef.current) {
      window.clearTimeout(bubbleTimeoutRef.current);
    }

    setAssistantBubble({
      id: `bubble-${Date.now()}`,
      message,
    });

    bubbleTimeoutRef.current = window.setTimeout(() => {
      setAssistantBubble(null);
    }, 5200);
  }, []);

  const appendAssistantMessage = useCallback(
    (entry: AssistantEntry) => {
      setAssistantEntries((currentEntries) => [...currentEntries, entry].slice(-24));
    },
    []
  );

  useEffect(() => {
    assistantStateRef.current = assistantState;
    writeCustomerAssistantState(assistantState);
  }, [assistantState]);

  useEffect(() => {
    setLocale(readStoredLocale("es"));
    setAssistantState(readCustomerAssistantState());
    setSupportToken(readSupportToken());
  }, [readSupportToken]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    applyClientTheme(initialClientTheme);
    setClientTheme(readStoredClientTheme(initialClientTheme));

    const observer = new MutationObserver(() => {
      setClientTheme(readStoredClientTheme(initialClientTheme));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-client-theme"],
    });

    return () => {
      observer.disconnect();
    };
  }, [initialClientTheme]);

  useEffect(() => {
    const handleLocaleChange = (event: Event) => {
      const detail = (event as CustomEvent<Locale>).detail;

      if (detail) {
        setLocale(detail);
      } else {
        setLocale(readStoredLocale("es"));
      }
    };

    const handleStorage = () => {
      setLocale(readStoredLocale("es"));
    };

    window.addEventListener(LOCALE_STORAGE_EVENT, handleLocaleChange as EventListener);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LOCALE_STORAGE_EVENT, handleLocaleChange as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    writeStoredLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!shouldLockBackgroundScroll) {
      return;
    }

    const body = document.body;
    const html = document.documentElement;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    // Capture current scroll position before locking
    const scrollY = window.scrollY;

    // iOS-safe scroll lock: position:fixed avoids the "scroll jumps to top / broken after close" bug.
    // overflow:hidden alone doesn't prevent rubber-band scrolling on iOS Safari.
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    // Keep desktop scrollbar to prevent layout shift
    if (scrollbarWidth > 0) {
      body.style.overflowY = "scroll";
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.width = "";
      body.style.overflowY = "";
      body.style.paddingRight = "";
      // Restore exact scroll position — critical on iOS
      window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });
    };
  }, [shouldLockBackgroundScroll]);

  useEffect(() => {
    if (assistantEntries.length > 0) {
      return;
    }

    setAssistantEntries([
      createAssistantEntry("bot", "ZorvYBOT", t.emptyAssistant),
    ]);
  }, [assistantEntries.length, t.emptyAssistant]);

  useEffect(() => {
    if (!searchContainerRef.current) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as SessionResponse;

        if (!isActive) {
          return;
        }

        setSessionUser(payload.user ?? null);
        if (payload.user?.email) {
          setSupportContactEmail(payload.user.email);
        }
      } finally {
        if (isActive) {
          setSessionReady(true);
        }
      }
    }

    void loadSession();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const storedCart = readStoredCart();
    const hydratedCart = hydrateStoredCart(storedCart, products);
    const payableKeys = hydratedCart
      .filter((entry) => isCartEntryPayable(entry.product))
      .map((entry) => entry.cartKey);
    const storedSelection = readStoredCartSelection();

    setCart(hydratedCart);
    setSelectedCartKeys(
      storedSelection === null
        ? payableKeys
        : storedSelection.filter((key) => payableKeys.includes(key))
    );
    cartSelectionInitializedRef.current = true;
    previousCartKeysRef.current = hydratedCart.map((entry) => entry.cartKey);
    setCartHydrated(true);
  }, [products]);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    setCart((currentCart) =>
      currentCart
        .map((entry) => {
          const liveProduct = localizedProducts.find(
            (product) => String(product.id) === String(entry.product.id)
          );

          return liveProduct
            ? {
                ...entry,
                product: liveProduct,
              }
            : null;
        })
        .filter((entry): entry is HydratedCartEntry => Boolean(entry))
    );
  }, [cartHydrated, localizedProducts]);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    writeStoredCart(toStoredCart(cart));
  }, [cart, cartHydrated]);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    writeStoredCartSelection(selectedCartKeys);
  }, [cartHydrated, selectedCartKeys]);

  useEffect(() => {
    if (!cartHydrated) {
      return;
    }

    const payableKeys = cart
      .filter((entry) => isCartEntryPayable(entry.product))
      .map((entry) => entry.cartKey);

    setSelectedCartKeys((currentKeys) => {
      const currentSet = new Set(currentKeys.filter((key) => payableKeys.includes(key)));

      const previousSet = new Set(previousCartKeysRef.current);
      const newPayableKeys = payableKeys.filter((key) => !previousSet.has(key));

      newPayableKeys.forEach((key) => currentSet.add(key));
      previousCartKeysRef.current = cart.map((entry) => entry.cartKey);
      return Array.from(currentSet);
    });
  }, [cart, cartHydrated]);

  useEffect(() => {
    if (normalizedSearch.length < 2 || normalizedSearch === lastTrackedSearchRef.current) {
      return;
    }

    lastTrackedSearchRef.current = normalizedSearch;

    const matchedProduct =
      localizedProducts.find((product) =>
        normalizeText(
          [
            product.name,
            product.shortDescription,
            product.longDescription,
            product.brand,
            product.category,
            ...product.tags,
          ].join(" ")
        ).includes(normalizedSearch)
      ) ?? null;

    const tracked = trackAssistantSearch(assistantStateRef.current, normalizedSearch);
    const nextState = matchedProduct
      ? rememberRecommendedProducts(tracked.nextState, [matchedProduct.id])
      : tracked.nextState;

    setAssistantState(nextState);

    if (tracked.count > 1) {
      enqueueAssistantBubbleMessage(
        buildAssistantRepeatedSearchMessage({
          locale,
          query: search.trim(),
          product: matchedProduct,
          count: tracked.count,
        })
      );
    }
  }, [enqueueAssistantBubbleMessage, locale, localizedProducts, normalizedSearch, search]);

  useEffect(() => {
    if (!activeAddress || selectedCart.length === 0) {
      setDeliveryQuote(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/delivery-quote?address=${encodeURIComponent(activeAddress)}&subtotal=${selectedSubtotal}&locale=${locale}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const payload = (await response.json()) as DeliveryQuote;
        setDeliveryQuote(payload);
      } catch {
        if (!controller.signal.aborted) {
          setDeliveryQuote(null);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeAddress, locale, selectedCart.length, selectedSubtotal]);

  const markSupportConversationSeen = useCallback(
    async (conversation: SupportMessage | null) => {
      if (!conversation?.id) {
        return;
      }

      const customerToken = sessionUser ? "" : supportToken;

      try {
        const response = await fetch("/api/support", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId: conversation.id,
            customerToken: customerToken || undefined,
          }),
        });
        const payload = (await response.json()) as SupportResponse;

        if (payload.success && payload.conversation) {
          setSupportConversation(payload.conversation);
        }
      } catch {
        return;
      }
    },
    [sessionUser, supportToken]
  );

  const loadSupportConversation = useCallback(
    async (showLoading: boolean = false) => {
      const customerToken = sessionUser ? "" : supportToken.trim();

      if (!sessionUser && !customerToken) {
        if (showLoading) {
          setSupportLoading(false);
        }
        setSupportConversation(null);
        return;
      }

      if (showLoading) {
        setSupportLoading(true);
      }

      try {
        const query = customerToken ? `?customerToken=${encodeURIComponent(customerToken)}` : "";
        const response = await fetch(`/api/support${query}`, { cache: "no-store" });
        const payload = (await response.json()) as SupportResponse;

        if (payload.success) {
          setSupportConversation(payload.conversation ?? null);

          if (payload.conversation?.customerEmail) {
            setSupportContactEmail(payload.conversation.customerEmail);
          }
        }
      } finally {
        if (showLoading) {
          setSupportLoading(false);
        }
      }
    },
    [sessionUser, supportToken]
  );

  useEffect(() => {
    if (!sessionReady || !assistantOpen || !showingSupportChat) {
      return;
    }

    const hasSupportIdentity = Boolean(sessionUser || supportToken);

    if (!hasSupportIdentity) {
      return;
    }

    let active = true;

    const refreshConversation = async (showLoading: boolean = false) => {
      if (!active) {
        return;
      }

      await loadSupportConversation(showLoading);
    };

    void refreshConversation(assistantOpen && showingSupportChat);

    const intervalId = window.setInterval(() => {
      void refreshConversation(false);
    }, 90000);

    const handleFocus = () => {
      void refreshConversation(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshConversation(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [assistantOpen, loadSupportConversation, sessionReady, sessionUser, showingSupportChat, supportToken]);

  useEffect(() => {
    if (!assistantOpen || !showingSupportChat || !hasUnreadSupportReply) {
      return;
    }

    void markSupportConversationSeen(supportConversation);
  }, [assistantOpen, hasUnreadSupportReply, markSupportConversationSeen, showingSupportChat, supportConversation]);

  useEffect(() => {
    const lastSupportEntry = supportConversation?.chatEntries
      ?.slice()
      .reverse()
      .find((entry) => entry.sender === "support");

    if (!lastSupportEntry || !hasUnreadSupportReply) {
      return;
    }

    if (lastNotifiedSupportEntryRef.current === lastSupportEntry.id) {
      return;
    }

    lastNotifiedSupportEntryRef.current = lastSupportEntry.id;
    enqueueAssistantBubbleMessage(t.assistantUnreadJoke);
  }, [enqueueAssistantBubbleMessage, hasUnreadSupportReply, supportConversation, t.assistantUnreadJoke]);

  useEffect(() => {
    if (!supportMessagesRef.current || !assistantOpen || !showingSupportChat) {
      return;
    }

    supportMessagesRef.current.scrollTop = supportMessagesRef.current.scrollHeight;
  }, [assistantOpen, showingSupportChat, supportConversation?.chatEntries.length]);

  useEffect(() => {
    if (!assistantMessagesRef.current) {
      return;
    }

    assistantMessagesRef.current.scrollTop = assistantMessagesRef.current.scrollHeight;
  }, [assistantDisplayEntries.length, assistantOpen]);

  useEffect(() => {
    if (!cartPulseActive) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCartPulseActive(false);
    }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [cartPulseActive]);

  const openProduct = useCallback(
    (
      product: StorefrontProduct,
      options?: {
        preserveRelatedSearch?: boolean;
        initialSelection?: QuickViewSelection;
      }
    ) => {
      const tracked = trackAssistantProductView(assistantStateRef.current, product.id);
      const nextState = rememberRecommendedProducts(tracked.nextState, [product.id]);
      setAssistantState(nextState);

      if (tracked.count > 1) {
        enqueueAssistantBubbleMessage(
          buildAssistantRepeatedViewMessage({
            locale,
            product,
            count: tracked.count,
          })
        );
      }

      if (!options?.preserveRelatedSearch) {
        setRelatedSearchQuery("");
        setRelatedRefreshIndex(0);
      }

      setQuickViewState({
        productId: String(product.id),
        initialSelection: options?.initialSelection,
      });
    },
    [enqueueAssistantBubbleMessage, locale]
  );

  const closeProduct = useCallback(() => {
    setQuickViewState(null);
    setRelatedSearchQuery("");
    setRelatedRefreshIndex(0);
  }, []);

  const addToCart = useCallback(
    (product: StorefrontProduct, selection?: QuickViewSelection) => {
      const availableStock = getProductAvailableStock(product);

      if (availableStock <= 0) {
        enqueueAssistantBubbleMessage(t.cartOutOfStock);
        return;
      }

      const cartKey = buildCartKey(
        product.id,
        selection?.selectedVariantId,
        selection?.selectedColor
      );

      setCart((currentCart) => {
        const existingIndex = currentCart.findIndex((entry) => entry.cartKey === cartKey);

        if (existingIndex >= 0) {
          const nextCart = [...currentCart];
          const currentEntry = nextCart[existingIndex];
          nextCart[existingIndex] = {
            ...currentEntry,
            product,
            quantity: clampCartQuantityToStock(product, currentEntry.quantity + 1),
            selectedVariantId: selection?.selectedVariantId,
            selectedVariantName: selection?.selectedVariantName,
            selectedColor: selection?.selectedColor,
            unitPrice: selection?.unitPrice ?? product.price,
            selectedImage: selection?.selectedImage ?? currentEntry.selectedImage ?? product.image,
          };
          return nextCart;
        }

        return [
          ...currentCart,
          {
            cartKey,
            product,
            quantity: 1,
            selectedVariantId: selection?.selectedVariantId,
            selectedVariantName: selection?.selectedVariantName,
            selectedColor: selection?.selectedColor,
            unitPrice: selection?.unitPrice ?? product.price,
            selectedImage: selection?.selectedImage ?? product.image,
          },
        ];
      });
      setSelectedCartKeys((currentKeys) =>
        currentKeys.includes(cartKey) ? currentKeys : [...currentKeys, cartKey]
      );

      setLastOverlayOpened("cart");
      setCartOpen(true);
      setCartPulseActive(true);
      enqueueAssistantBubbleMessage(`${t.cartAdded}. ${t.cartAddedDetail}`);
    },
    [enqueueAssistantBubbleMessage, t.cartAdded, t.cartAddedDetail, t.cartOutOfStock]
  );

  const removeFromCart = useCallback((cartKey: string) => {
    setCart((currentCart) => currentCart.filter((entry) => entry.cartKey !== cartKey));
    setSelectedCartKeys((currentKeys) => currentKeys.filter((key) => key !== cartKey));
  }, []);

  const changeQuantity = useCallback((cartKey: string, nextQuantity: number) => {
    setCart((currentCart) =>
      currentCart.map((entry) => {
        if (entry.cartKey !== cartKey) {
          return entry;
        }

        return {
          ...entry,
          quantity: clampCartQuantityToStock(entry.product, nextQuantity),
        };
      })
    );
  }, []);

  const toggleCartSelection = useCallback((cartKey: string) => {
    setSelectedCartKeys((currentKeys) =>
      currentKeys.includes(cartKey)
        ? currentKeys.filter((key) => key !== cartKey)
        : [...currentKeys, cartKey]
    );
  }, []);

  const shareSelectedCart = useCallback(async () => {
    if (selectedCart.length === 0) {
      enqueueAssistantBubbleMessage(t.cartAddedDetail);
      return;
    }

    const message = [
      `${STORE_BRAND} - carrito compartido`,
      "",
      ...selectedCart.map((entry) => {
        const parts = [
          `${entry.quantity}x ${entry.product.name}`,
          entry.selectedVariantName ? `Modelo: ${entry.selectedVariantName}` : "",
          entry.selectedColor ? `Color: ${entry.selectedColor}` : "",
          formatCurrency((entry.unitPrice ?? entry.product.price) * entry.quantity),
        ].filter(Boolean);

        return `- ${parts.join(" | ")}`;
      }),
      "",
      `Total seleccionado: ${formatCurrency(selectedSubtotal)}`,
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: STORE_BRAND,
          text: message,
        });
        return;
      } catch {
        // Fallback to clipboard below.
      }
    }

    try {
      await navigator.clipboard.writeText(message);
      enqueueAssistantBubbleMessage("Carrito copiado para compartir.");
    } catch {
      enqueueAssistantBubbleMessage("No pude copiar el carrito, pero sigo intentandolo.");
    }
  }, [enqueueAssistantBubbleMessage, selectedCart, selectedSubtotal, t.cartAddedDetail]);

  const applySuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.kind === "category") {
      setSelectedCategory(suggestion.value);
      setSearch("");
    } else {
      setSearch(suggestion.value);
      setSelectedCategory("all");
    }

    setSearchFocused(false);
  }, []);

  const scrollToCatalog = useCallback(() => {
    document.getElementById("catalogo")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const openUnifiedChat = useCallback((mode: "assistant" | "support") => {
    if (isCompactViewport) {
      setCartOpen(false);
      setAccountOpen(false);
    }
    setChatPanelMode(mode);
    setLastOverlayOpened("chat");
    setAssistantOpen(true);
  }, [isCompactViewport]);

  const closeUnifiedChat = useCallback(() => {
    setAssistantOpen(false);
  }, []);

  const openAccountPanel = useCallback(() => {
    if (isCompactViewport) {
      setCartOpen(false);
      setAssistantOpen(false);
    }

    setAccountOpen(true);
  }, [isCompactViewport]);

  const openCartPanel = useCallback(() => {
    if (isCompactViewport) {
      setAssistantOpen(false);
      setAccountOpen(false);
    }

    setLastOverlayOpened("cart");
    setCartOpen(true);
  }, [isCompactViewport]);

  const handleSupportAttachmentSelection = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) {
        return;
      }

      const availableSlots = Math.max(0, 4 - supportAttachments.length);

      if (availableSlots <= 0) {
        setSupportError(t.supportAttachmentLimit);
        return;
      }

      setSupportError("");

      try {
        const nextAttachments = await Promise.all(
          Array.from(files)
            .slice(0, availableSlots)
            .map((file) => imageFileToDataUrl(file))
        );

        setSupportAttachments((currentAttachments) => [
          ...currentAttachments,
          ...nextAttachments,
        ]);
      } catch {
        setSupportError(t.supportAttachmentError);
      } finally {
        if (supportAttachmentInputRef.current) {
          supportAttachmentInputRef.current.value = "";
        }
      }
    },
    [supportAttachments.length, t.supportAttachmentError, t.supportAttachmentLimit]
  );

  const submitSupportMessage = useCallback(async () => {
    const message = supportMessage.trim();
    const email = supportContactEmail.trim() || sessionUser?.email || checkoutData?.email || "";

    if ((message.length < 2 && supportAttachments.length === 0) || !email) {
      setSupportError(t.supportMessageRequired);
      return;
    }

    setSupportSending(true);
    setSupportError("");

    try {
      const customerToken = sessionUser ? "" : ensureSupportToken();
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: supportConversation?.id,
          customerToken: customerToken || undefined,
          subject: `${t.supportTitle} - ${new Date().toLocaleDateString()}`,
          message,
          attachments: supportAttachments,
          name: checkoutData?.name ?? sessionUser?.name ?? "Cliente",
          email,
          phone: checkoutData?.phone ?? sessionUser?.phone ?? "",
          source: "chatbot",
        }),
      });
      const payload = (await response.json()) as SupportResponse;

      if (!payload.success) {
        throw new Error(payload.error || "No se pudo enviar el mensaje.");
      }

      setSupportConversation(payload.conversation ?? null);
      setSupportMessage("");
      setSupportAttachments([]);
      appendAssistantMessage(
        createAssistantEntry("bot", "ZorvYBOT", "Tu mensaje ya llego al soporte.")
      );
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setSupportSending(false);
    }
  }, [
    appendAssistantMessage,
    checkoutData?.email,
    checkoutData?.name,
    checkoutData?.phone,
    ensureSupportToken,
    sessionUser,
    supportAttachments,
    supportContactEmail,
    supportConversation?.id,
    supportMessage,
    t.supportMessageRequired,
    t.supportTitle,
  ]);

  const submitAssistantMessage = useCallback(async () => {
    const message = assistantInput.trim();

    if (message.length < 2) {
      return;
    }

    if (assistantHasHumanSupportReply || supportConversation) {
      setChatPanelMode("support");
      setAssistantOpen(true);
      return;
    }

    const nextCustomerEntry = createAssistantEntry(
      "customer",
      sessionUser?.name || "Cliente",
      message
    );

    setAssistantInput("");
    appendAssistantMessage(nextCustomerEntry);
    setAssistantSending(true);

    try {
      const response = await fetch("/api/support-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale,
          customerName: sessionUser?.name ?? checkoutData?.name ?? "Cliente",
          transcript: [...assistantEntries, nextCustomerEntry].slice(-12).map((entry) => ({
            sender: entry.sender === "bot" ? "support" : entry.sender,
            senderName: entry.senderName,
            message: entry.message,
          })),
        }),
      });
      const payload = (await response.json()) as { success?: boolean; reply?: string; error?: string };

      if (!payload.success || !payload.reply) {
        throw new Error(payload.error || "No se pudo responder desde el asistente.");
      }

      appendAssistantMessage(createAssistantEntry("bot", "ZorvYBOT", payload.reply));
    } catch (error) {
      appendAssistantMessage(
        createAssistantEntry(
          "bot",
          "ZorvYBOT",
          error instanceof Error ? error.message : "No pude responder ahora mismo."
        )
      );
    } finally {
      setAssistantSending(false);
    }
  }, [
    appendAssistantMessage,
    assistantEntries,
    assistantHasHumanSupportReply,
    assistantInput,
    checkoutData?.name,
    locale,
    sessionUser?.name,
    supportConversation,
  ]);

  const submitOrder = useCallback(async () => {
    if (!checkoutData || selectedCart.length === 0) {
      return false;
    }

    const response = await fetch("/api/place-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOrderPayload(selectedCart, checkoutData)),
    });
    const payload = (await response.json()) as OrderMutationResponse;

    if (!payload.success || !payload.order) {
      enqueueAssistantBubbleMessage(payload.error || "No se pudo confirmar tu pedido.");
      return false;
    }

    setCart((currentCart) =>
      currentCart.filter((entry) => !selectedCart.some((selected) => selected.cartKey === entry.cartKey))
    );
    setSelectedCartKeys((currentKeys) =>
      currentKeys.filter((key) => !selectedCart.some((entry) => entry.cartKey === key))
    );
    setCheckoutData(null);
    setConfirmationOpen(false);
    setCheckoutOpen(false);
    enqueueAssistantBubbleMessage(buildAssistantOrderPlacedMessage({ locale, order: payload.order }));
    appendAssistantMessage(
      createAssistantEntry(
        "bot",
        "ZorvYBOT",
        buildAssistantOrderPlacedMessage({ locale, order: payload.order })
      )
    );
    return true;
  }, [appendAssistantMessage, checkoutData, enqueueAssistantBubbleMessage, locale, selectedCart]);

  const createPayPalOrder = useCallback(async () => {
    if (!checkoutData || selectedCart.length === 0) {
      throw new Error("Faltan datos para iniciar PayPal.");
    }

    const response = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildOrderPayload(selectedCart, checkoutData)),
    });
    const payload = (await response.json()) as PayPalCreateOrderResponse;

    if (!payload.success || !payload.paypalOrderId) {
      throw new Error(payload.error || "No se pudo crear la orden PayPal.");
    }

    return payload.paypalOrderId;
  }, [checkoutData, selectedCart]);

  const approvePayPalOrder = useCallback(
    async (paypalOrderId: string) => {
      if (!checkoutData || selectedCart.length === 0) {
        return false;
      }

      const response = await fetch("/api/paypal/confirm-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...buildOrderPayload(selectedCart, checkoutData),
          paypalOrderId,
        }),
      });
      const payload = (await response.json()) as OrderMutationResponse;

      if (!payload.success || !payload.order) {
        enqueueAssistantBubbleMessage(payload.error || "No se pudo completar el pago PayPal.");
        return false;
      }

      setCart((currentCart) =>
        currentCart.filter((entry) => !selectedCart.some((selected) => selected.cartKey === entry.cartKey))
      );
      setSelectedCartKeys((currentKeys) =>
        currentKeys.filter((key) => !selectedCart.some((entry) => entry.cartKey === key))
      );
      setCheckoutData(null);
      setConfirmationOpen(false);
      setCheckoutOpen(false);
      enqueueAssistantBubbleMessage(buildAssistantOrderPlacedMessage({ locale, order: payload.order }));
      appendAssistantMessage(
        createAssistantEntry(
          "bot",
          "ZorvYBOT",
          buildAssistantOrderPlacedMessage({ locale, order: payload.order })
        )
      );
      return true;
    },
    [appendAssistantMessage, checkoutData, enqueueAssistantBubbleMessage, locale, selectedCart]
  );

  const handlePayPalError = useCallback(
    (message: string) => {
      enqueueAssistantBubbleMessage(message);
    },
    [enqueueAssistantBubbleMessage]
  );

  const renderHeaderButton = useCallback(
    (target: "languages" | "support" | "account" | "cart") => {
      if (target === "languages") {
        return null;
      }

      const baseClass =
        "storefront-header-pill-button relative inline-flex h-[2.45rem] w-full min-w-0 items-center justify-center overflow-hidden rounded-[10px] px-1.5 text-center text-[10px] font-semibold leading-none sm:h-[2.65rem] sm:px-2.5 sm:text-[11px] md:h-[2.9rem] md:w-[8.5rem] md:px-4 md:text-[11px]";
      const buttonText =
        target === "support"
          ? locale === "es"
            ? "Ayuda"
            : t.support
          : target === "account"
            ? locale === "es"
              ? "Cuenta"
              : t.account
            : locale === "es"
              ? "Carrito"
              : t.cart;

      if (target === "account") {
        return (
          <button
            type="button"
            onClick={openAccountPanel}
            className={baseClass}
            aria-label={buttonText}
            title={buttonText}
          >
            <span className="storefront-header-pill-button__text whitespace-nowrap">{buttonText}</span>
          </button>
        );
      }

      if (target === "support") {
        return (
          <button
            type="button"
            onClick={() => openUnifiedChat("support")}
            className={baseClass}
            aria-label={buttonText}
            title={buttonText}
          >
            <span className="storefront-header-pill-button__text whitespace-nowrap">{buttonText}</span>
            {hasUnreadSupportReply ? (
              <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-[0_6px_16px_rgba(244,63,94,0.38)]">
                1
              </span>
            ) : null}
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={openCartPanel}
          className={`${baseClass} ${
            cartPulseActive
              ? "scale-[1.03] border-cyan-300 shadow-[0_0_0_1px_rgba(103,232,249,0.28),0_0_24px_rgba(34,211,238,0.2)]"
              : ""
          }`}
          aria-label={buttonText}
          title={buttonText}
        >
          <span className="storefront-header-pill-button__text whitespace-nowrap">{buttonText}</span>
          {cart.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-slate-950 shadow-[0_6px_16px_rgba(34,211,238,0.34)]">
              {cart.length}
            </span>
          ) : null}
        </button>
      );
    },
    [
      cart.length,
      cartPulseActive,
      hasUnreadSupportReply,
      locale,
      openAccountPanel,
      openCartPanel,
      openUnifiedChat,
      t.account,
      t.cart,
      t.support,
    ]
  );

  return (
    <div
      className="client-page-shell min-h-screen text-white"
      style={{
        background:
          clientTheme === "light"
            ? undefined
            : `radial-gradient(circle at top, ${theme.backgroundGlow}22 0%, transparent 26%), linear-gradient(180deg, ${theme.backgroundStart} 0%, ${theme.backgroundEnd} 100%)`,
      }}
    >
      <div className="uiverse-midnight-sky" aria-hidden="true">
        <div className="sky-canvas" />
        <div className="stars stars-1" />
        <div className="stars stars-2" />
        <div className="stars stars-3" />
        <span className="meteor m1" />
        <span className="meteor m2" />
        <span className="meteor m3" />
      </div>

      {marqueeItems.length > 0 ? (
        <div
          className="header-promo-marquee overflow-hidden"
          style={{
            background:
              clientTheme === "light"
                ? undefined
                : `linear-gradient(90deg, ${theme.marqueeStart} 0%, ${theme.marqueeCenter} 50%, ${theme.marqueeEnd} 100%)`,
          }}
        >
          <div className="header-promo-marquee__track">
            {[0, 1, 2, 3].map((groupIndex) => (
              <div key={groupIndex} className="header-promo-marquee__group">
                {marqueeItems.map((item, itemIndex) => (
                  <span
                    key={`${groupIndex}-${itemIndex}`}
                    className={`header-promo-marquee__text${itemIndex === 0 ? " header-promo-marquee__text--active" : ""}`}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <header
        className="client-sticky-header sticky top-0 z-40 border-b border-slate-800/80 backdrop-blur-xl"
        style={{
          background:
            clientTheme === "light"
              ? undefined
              : `color-mix(in srgb, ${theme.headerSurface} 92%, transparent)`,
        }}
      >
        <div className="w-full px-2.5 py-2 sm:px-4 lg:px-5 xl:px-6">
          <div className="flex flex-col gap-2.5 md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-4">
            <div className="min-w-0 shrink-0 self-start md:justify-self-start">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="zorvya-shop-button"
                aria-label={t.arriveCatalog}
              >
                <h1 className="zorvya-shop-title">
                  <span className="zorvya-shop-brand">ZorvyA</span>
                  <span className="zorvya-shop-inline">Shop</span>
                </h1>
              </button>
            </div>

            <div className="flex min-w-0 justify-stretch md:justify-center md:px-2">
              <div
                ref={searchContainerRef}
                className="relative w-full min-w-0 max-w-none sm:max-w-[24rem] md:max-w-[22rem] lg:max-w-[26rem] xl:max-w-[29rem]"
              >
                <div
                  className="header-search-shell"
                  style={{
                    background:
                      clientTheme === "light"
                        ? undefined
                        : `linear-gradient(90deg, ${theme.searchStart} 0%, ${theme.searchCenter} 50%, ${theme.searchEnd} 100%)`,
                  }}
                >
                  <svg
                    className="header-search-icon h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    placeholder={localizedSettings.searchPlaceholder}
                    className="header-search-input"
                  />
                </div>

                {searchFocused && searchSuggestions.length > 0 ? (
                  <div className="absolute inset-x-0 top-[calc(100%+0.55rem)] z-50 overflow-hidden rounded-[1.15rem] border border-slate-800 bg-[#050816] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                    <div className="border-b border-slate-800 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:px-4 sm:py-2.5">
                      {t.searchHint}
                    </div>
                    <div className="divide-y divide-slate-800">
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => applySuggestion(suggestion)}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-slate-200 transition hover:bg-[#0a1020] sm:gap-3 sm:px-4 sm:py-3 sm:text-sm"
                        >
                          <span className="text-xs text-cyan-300">{getSuggestionIcon(suggestion.kind)}</span>
                          <span>{suggestion.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 md:flex md:flex-wrap md:items-center md:justify-self-end md:justify-end md:gap-2">
                {mobileHeaderButtons.map((button) => (
                  <div key={button.id} className="min-w-0 md:hidden">
                    {renderHeaderButton(button.target)}
                  </div>
                ))}
                {headerButtons.map((button) => (
                  <div key={`desktop-${button.id}`} className="hidden min-w-0 md:block">
                    {renderHeaderButton(button.target)}
                  </div>
                ))}
              </div>
            </div>
        </div>
      </header>

      <main className="relative z-10 w-full px-2.5 py-3 sm:px-4 sm:py-4 lg:px-5 xl:px-6 2xl:px-8">
        {localizedProducts.length === 0 ? (
          <div className="client-panel rounded-[2rem] border border-dashed border-slate-700 bg-[#0a1020] px-5 py-10 text-center text-sm text-slate-400">
            {t.emptyCatalog}
          </div>
        ) : (
          <section id="catalogo">
            {catalogProducts.length === 0 ? (
              <div className="client-panel rounded-[2rem] border border-dashed border-slate-700 bg-[#0a1020] px-5 py-10 text-center text-sm text-slate-400">
                {isFiltering ? t.noSearchResults : t.loadingProducts}
              </div>
            ) : (
              <div className="grid auto-rows-fr grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-5 lg:gap-3.5 xl:grid-cols-6 2xl:grid-cols-7">
                {catalogProducts.map((product, index) => (
                  <Fragment key={`catalog-item-${product.id}`}>
                    <ProductCard
                      locale={locale}
                      product={product}
                      deliveryEstimateText={deliveryEstimateText}
                      onAdd={addToCart}
                      onOpen={openProduct}
                    />
                    {mobilePromoInsertionIndexes.has(index) && catalogPromoProducts.length > 0 ? (
                      <div className="col-span-2 md:hidden">
                        <CatalogPromoBanner
                          products={catalogPromoProducts}
                          onOpen={openProduct}
                          initialIndex={index}
                        />
                      </div>
                    ) : null}
                    {index === 4 && catalogPromoProducts.length > 0 ? (
                      <div className="hidden md:block md:col-span-2 lg:col-span-2 xl:col-span-2">
                        <CatalogPromoBanner
                          products={catalogPromoProducts}
                          onOpen={openProduct}
                          initialIndex={0}
                        />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {selectedProduct && quickViewState ? (
        <ProductQuickViewPanel
          key={String(selectedProduct.id)}
          product={selectedProduct}
          locale={locale}
          deliveryEstimateText={deliveryEstimateText}
          relatedProducts={relatedProducts}
          searchProducts={relatedSearchProducts}
          relatedSearchQuery={relatedSearchQuery}
          relatedRefreshIndex={relatedRefreshIndex}
          reviewAuthorName={sessionUser?.name}
          reviewAuthorEmail={sessionUser?.email}
          onClose={closeProduct}
          onAdd={addToCart}
          onOpenRelated={(product) =>
            openProduct(product, {
              preserveRelatedSearch: true,
            })
          }
          onRelatedSearchQueryChange={setRelatedSearchQuery}
          onRefreshRelated={() => setRelatedRefreshIndex((value) => value + 1)}
          onReviewSubmitted={(productId, nextRating, nextReviewCount) => {
            setProducts((currentProducts) =>
              currentProducts.map((product) =>
                String(product.id) === String(productId)
                  ? {
                      ...product,
                      rating: nextRating,
                      reviewCount: nextReviewCount,
                    }
                  : product
              )
            );
          }}
          initialSelection={quickViewState.initialSelection}
        />
      ) : null}

      {cartOpen ? (
        <CartPanel
          cart={cart}
          locale={locale}
          selectedCartKeys={selectedCartKeys}
          selectedEntryCount={selectedCartCount}
          dockRight={cartDockRight}
          dockWidth={cartPanelWidth}
          onToggleSelection={toggleCartSelection}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onChangeQuantity={changeQuantity}
          onProceed={() => {
            if (selectedCart.length === 0) {
              enqueueAssistantBubbleMessage("Selecciona al menos un articulo para pagar.");
              return;
            }

            setCartOpen(false);
            setCheckoutOpen(true);
          }}
          onOpenItem={(entry) =>
            openProduct(entry.product, {
              initialSelection: {
                selectedVariantId: entry.selectedVariantId,
                selectedVariantName: entry.selectedVariantName,
                selectedColor: entry.selectedColor,
                unitPrice: entry.unitPrice,
                selectedImage: entry.selectedImage,
              },
            })
          }
          onShare={() => void shareSelectedCart()}
          customerAddress={activeAddress}
          deliveryQuote={deliveryQuote}
        />
      ) : null}

      {accountOpen ? (
        <AccountModal
          locale={locale}
          sessionReady={sessionReady}
          user={sessionUser}
          products={accountProducts}
          onOpenProduct={(input) => {
            const product =
              localizedProducts.find(
                (entry) => String(entry.id) === String(input.productId)
              ) ?? null;

            if (!product) {
              return;
            }

            openProduct(product, {
              initialSelection: {
                selectedVariantId: input.selectedVariantId,
                selectedVariantName: input.selectedVariantName,
                selectedColor: input.selectedColor,
                selectedImage: input.selectedImage,
              },
            });
          }}
          onClose={() => setAccountOpen(false)}
          onSessionChange={(user) => {
            setSessionUser(user);
            if (user?.email) {
              setSupportContactEmail(user.email);
            }
          }}
        />
      ) : null}

      {checkoutOpen ? (
        <CheckoutModal
          locale={locale}
          subtotal={selectedSubtotal}
          initialData={
            checkoutData ?? {
              name: sessionUser?.name ?? "",
              phone: sessionUser?.phone ?? "",
              email: sessionUser?.email ?? supportContactEmail,
              address: sessionUser?.address ?? "",
              deliveryType: "delivery",
              requestedAgentCall: false,
              paymentMethod: "cash",
              paypalDisplayCurrency: "SRD",
            }
          }
          onClose={() => setCheckoutOpen(false)}
          onSubmit={(data) => {
            setCheckoutData(data);
            setCheckoutOpen(false);
            setConfirmationOpen(true);
          }}
        />
      ) : null}

      {confirmationOpen && checkoutData ? (
        <OrderConfirmationModal
          locale={locale}
          cart={selectedCart}
          customerData={checkoutData}
          subtotal={selectedSubtotal}
          deliveryFee={checkoutData.deliveryType === "delivery" ? checkoutData.deliveryFee ?? 0 : 0}
          deliveryDistanceKm={checkoutData.deliveryDistanceKm}
          total={selectedSubtotal + (checkoutData.deliveryType === "delivery" ? checkoutData.deliveryFee ?? 0 : 0)}
          paypalClientId={paypalClientId}
          onClose={() => setConfirmationOpen(false)}
          onBack={() => {
            setConfirmationOpen(false);
            setCheckoutOpen(true);
          }}
          onConfirm={async () => {
            await submitOrder();
          }}
          onCreatePayPalOrder={createPayPalOrder}
          onApprovePayPalOrder={approvePayPalOrder}
          onPayPalError={handlePayPalError}
        />
      ) : null}

      <div className="zorvyabot-dock zorvyabot-dock--right" style={{ right: zorvyBotDockRight }}>
        <div
          className={`zorvyabot-bubble ${
            assistantBubble ? "zorvyabot-bubble--open" : "zorvyabot-bubble--hidden"
          }`}
        >
          <p className="text-sm font-semibold text-cyan-100">ZorvYBOT</p>
          <p className="mt-1 text-sm leading-6 text-slate-200">
            {assistantBubble?.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (assistantOpen) {
              closeUnifiedChat();
              return;
            }

            openUnifiedChat(supportConversation ? "support" : "assistant");
          }}
          className="zorvyabot-orb"
          aria-label={t.assistantTitle}
        >
          <span className="zorvyabot-orb__halo" aria-hidden="true" />
          <span className="zorvyabot-orb__face" aria-hidden="true">
            <span className="zorvyabot-orb__eye" />
            <span className="zorvyabot-orb__eye" />
            <span className="zorvyabot-orb__mouth" />
          </span>
          <span className="zorvyabot-orb__label">
            {hasUnreadSupportReply ? "1" : "Z"}
          </span>
        </button>
      </div>

      {assistantOpen ? (
        <div
          className={`fixed z-[85] overflow-hidden border text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${
            isCompactViewport
              ? "inset-x-1 bottom-1 max-h-[calc(100dvh-0.5rem)] rounded-[1.3rem]"
              : "bottom-2 right-2 w-[min(96vw,22rem)] rounded-[1.6rem] sm:bottom-4 sm:right-4 sm:w-[min(92vw,22rem)] sm:rounded-[2rem]"
          } ${
            showingSupportChat
              ? "border-emerald-950/80 bg-[#0b141a]"
              : "border-slate-800 bg-[#050816]"
          }`}
          style={isCompactViewport ? undefined : { right: chatDockRight, width: chatPanelWidth }}
        >
          {showingSupportChat ? (
            <div className="pointer-events-none absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={closeUnifiedChat}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#1f2c34]/90 text-white shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition hover:bg-[#27353e]"
                aria-label={t.close}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#03050f] px-4 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  {t.assistantSubtitle}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{t.assistantTitle}</p>
              </div>
              <button
                type="button"
                onClick={closeUnifiedChat}
                className="rounded-full border border-slate-700 bg-[#0a1020] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
              >
                {t.close}
              </button>
            </div>
          )}

          <div
            ref={showingSupportChat ? supportMessagesRef : assistantMessagesRef}
            className={`scrollbar-hidden max-h-[calc(100dvh-12.5rem)] overflow-y-auto px-3 py-3 sm:max-h-[24rem] sm:px-4 sm:py-4 ${
              showingSupportChat
                ? "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.08),_transparent_24%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.06),_transparent_24%),linear-gradient(180deg,_#0b141a_0%,_#0f171d_100%)] pt-14"
                : ""
            }`}
          >
            <div className="space-y-3">
              {showingSupportChat && supportLoading && assistantDisplayEntries.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#111b21] px-4 py-4 text-sm text-slate-400">
                  {t.supportLoading}
                </div>
              ) : null}

              {showingSupportChat && !supportLoading && assistantDisplayEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-[#111b21] px-4 py-8 text-center text-sm text-slate-400">
                  {t.supportEmpty}
                </div>
              ) : null}

              {assistantDisplayEntries.map((entry) => {
                const isCustomer = entry.sender === "customer";
                const isSupport = entry.sender === "support";

                return (
                  <div
                    key={entry.id}
                    className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 ${
                        isCustomer
                          ? showingSupportChat
                            ? "rounded-br-[0.45rem] bg-[#005c4b] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                            : "rounded-tr-[0.35rem] bg-cyan-500 text-slate-950"
                          : isSupport
                            ? showingSupportChat
                              ? "rounded-bl-[0.45rem] bg-[#202c33] text-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.18)]"
                              : "rounded-tl-[0.35rem] border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                            : "rounded-tl-[0.35rem] border border-slate-800 bg-[#0a1020] text-slate-200"
                      }`}
                    >
                      {!showingSupportChat ? (
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-65">
                          {entry.senderName}
                        </p>
                      ) : null}
                      {entry.message ? (
                        <p className={showingSupportChat ? "whitespace-pre-line" : "mt-1 whitespace-pre-line"}>
                          {entry.message}
                        </p>
                      ) : null}
                      {entry.attachments?.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {entry.attachments.map((attachment) => (
                            <a
                              key={`${entry.id}-${attachment}`}
                              href={attachment}
                              target="_blank"
                              rel="noreferrer"
                              className="relative block overflow-hidden rounded-2xl border border-white/10 bg-black/10"
                            >
                              <div className="relative h-28 w-full">
                                <Image
                                  src={attachment}
                                  alt="Adjunto"
                                  fill
                                  sizes="160px"
                                  className="object-cover"
                                  unoptimized={attachment.startsWith("data:")}
                                />
                              </div>
                            </a>
                          ))}
                        </div>
                      ) : null}
                      {showingSupportChat ? (
                        <p className="mt-2 text-right text-[11px] opacity-70">
                          {new Date(entry.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`border-t px-4 py-4 ${
              showingSupportChat
                ? "border-slate-800 bg-[#111b21]"
                : "border-slate-800 bg-[#03050f]"
            }`}
          >
            {showingSupportChat ? (
              <div className="space-y-3">
                {!sessionUser ? (
                  <input
                    type="email"
                    value={supportContactEmail}
                    onChange={(event) => setSupportContactEmail(event.target.value)}
                    placeholder={t.supportEmail}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b141a] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500"
                  />
                ) : null}
                <div className="rounded-[1.7rem] border border-white/10 bg-[#0b141a] p-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
                {supportAttachments.length ? (
                  <div className="mb-3 grid grid-cols-4 gap-2">
                    {supportAttachments.map((attachment, index) => (
                      <div
                        key={`${attachment}-${index}`}
                        className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/10"
                      >
                        <div className="relative h-16 w-full">
                          <Image
                            src={attachment}
                            alt="Vista previa"
                            fill
                            sizes="64px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSupportAttachments((currentAttachments) =>
                              currentAttachments.filter((_, attachmentIndex) => attachmentIndex !== index)
                            )
                          }
                          className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[0] text-white transition after:text-[11px] after:font-bold after:leading-none after:content-['x'] hover:bg-black/70"
                          aria-label={t.close}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                <textarea
                  value={supportMessage}
                  onChange={(event) => setSupportMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitSupportMessage();
                    }
                  }}
                  placeholder={t.supportPlaceholder}
                  rows={3}
                  className="min-h-[4.25rem] flex-1 resize-none rounded-[1.35rem] border border-white/8 bg-[#111b21] px-4 py-3 text-[15px] text-white outline-none transition focus:border-emerald-500 sm:min-h-[4.8rem]"
                />
                <div className="flex items-center gap-2 pb-1">
                  <input
                    ref={supportAttachmentInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    multiple
                    className="hidden"
                    onChange={(event) => void handleSupportAttachmentSelection(event.target.files)}
                  />
                  <button
                    type="button"
                    onClick={() => supportAttachmentInputRef.current?.click()}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#111b21] text-white transition hover:bg-[#1b2a33]"
                    aria-label={t.supportAttach}
                    title={t.supportAttach}
                  >
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828L18 9.828a4 4 0 10-5.657-5.657L5.757 10.757a6 6 0 108.486 8.486L20 13"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitSupportMessage()}
                    disabled={supportSending}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-[0_10px_24px_rgba(16,185,129,0.24)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    aria-label={supportSending ? t.supportSending : t.supportSend}
                    title={supportSending ? t.supportSending : t.supportSend}
                  >
                    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 12l15-7-4 7 4 7-15-7z"
                      />
                    </svg>
                  </button>
                </div>
                </div>
                </div>
                {supportError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {supportError}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={assistantInput}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitAssistantMessage();
                    }
                  }}
                  rows={2}
                  placeholder={t.assistantPlaceholder}
                  className="min-h-[4rem] flex-1 resize-none rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500 sm:min-h-[4.25rem]"
                />
                <button
                  type="button"
                  onClick={() => void submitAssistantMessage()}
                  disabled={assistantSending}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950 transition hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-300"
                  aria-label={t.assistantSend}
                >
                  {assistantSending ? "..." : ">"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

    </div>
  );
}
