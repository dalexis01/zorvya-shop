"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { readStoredCart, writeStoredCart, type HydratedCartEntry } from "@/lib/shop/cart-storage";
import { buildCartKey, createStars } from "@/lib/shop/display-utils";
import {
  applyClientTheme,
  readStoredClientTheme,
  type ClientTheme,
} from "@/lib/shop/client-theme";
import {
  clampCartQuantityToStock,
  getProductAvailableStock,
} from "@/lib/shop/product-stock";
import {
  LOCALE_STORAGE_EVENT,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
} from "@/lib/shop/locale-storage";
import { formatCurrencySrd as formatCurrency, formatGroupedNumber } from "@/lib/shop/number-format";
import { localizeProduct } from "@/lib/shop/product-localization";
import type {
  Locale,
  ProductReview,
  SessionUser,
  StorefrontProduct,
} from "@/lib/shop/types";
import type { SupportMessage } from "@/lib/shop/admin-types";

const CartPanel = dynamic(() => import("@/components/CartPanel"));

const texts = {
  es: {
    back: "Volver atras",
    home: "Volver al inicio",
    comments: "Comentarios reales",
    leaveComment: "Dejar comentario",
    name: "Nombre",
    email: "Correo",
    rating: "Calificacion",
    comment: "Comentario",
    send: "Enviar comentario",
    sending: "Enviando...",
    reviewSaved: "Resena enviada correctamente.",
    recommended: "Productos recomendados",
    addToCart: "Agregar al carro",
    added: "Producto agregado al carrito",
    noComments: "Todavia no hay comentarios para este producto.",
    reviews: "resenas",
    cart: "Carrito",
    support: "Soporte",
    chooseColor: "Elige color",
    modelLabel: "Modelos disponibles",
    colorLabel: "Colores disponibles",
    currentModel: "Modelo principal",
    close: "Cerrar",
    previous: "Anterior",
    next: "Siguiente",
    fullscreen: "Pantalla completa",
    supportPhone: "Telefono Suriname",
    price: "Precio",
    themeAria: "Cambiar tema de la tienda",
    cartAddedToast: "Articulo Agregado",
    recommendedSearchPlaceholder: "Buscar entre recomendados...",
    recommendedEmpty: "No encontramos recomendados para esa busqueda.",
    loadingMoreRecommended: "Cargando mas productos...",
    buyNow: "Comprar ahora",
    quantity: "Cantidad",
    available: "Disponible",
    unavailable: "Sin stock",
    storeBrand: "Visita la tienda de ZorvyA Shop",
    soldRecently: "comprados recientemente",
    highlights: "Mas destacados",
    productDetailsTitle: "Detalles del producto",
    featureTitle: "Caracteristicas",
    securePayment: "Transaccion segura",
    seller: "Vendedor",
    payment: "Pago",
    returns: "Devoluciones",
    estimatedDelivery: "Envio estimado",
    estimatedDeliveryWindow: "Entrega estimada en 24 horas o el mismo dia si ya va en ruta.",
    supportChooserTitle: "Como quieres hablar con soporte",
    supportChooserSubtitle: "Elige la via mas comoda y seguimos desde ahi.",
    supportChatOption: "Chat",
    supportCallOption: "Llamada",
    supportWhatsappOption: "WhatsApp",
    supportWhatsappSoon: "Lo configuramos en breve.",
    supportChatTitle: "Chat de soporte",
    supportChatSubtitle: "Escribe y el mensaje llega directo a administracion.",
    supportMessagePlaceholder: "Escribe tu mensaje...",
    supportMessageRequired: "Necesito tu correo y un mensaje para abrir el chat.",
    supportSendSuccess: "Tu mensaje ya fue enviado a soporte.",
    contactEmail: "Correo de contacto",
  },
  nl: {
    back: "Terug",
    home: "Terug naar home",
    comments: "Echte reacties",
    leaveComment: "Reactie plaatsen",
    name: "Naam",
    email: "E-mail",
    rating: "Beoordeling",
    comment: "Reactie",
    send: "Reactie verzenden",
    sending: "Verzenden...",
    reviewSaved: "Review succesvol verzonden.",
    recommended: "Aanbevolen producten",
    addToCart: "Toevoegen aan winkelwagen",
    added: "Product toegevoegd aan winkelwagen",
    noComments: "Er zijn nog geen reacties voor dit product.",
    reviews: "reviews",
    cart: "Winkelwagen",
    support: "Support",
    chooseColor: "Kies kleur",
    modelLabel: "Beschikbare modellen",
    colorLabel: "Beschikbare kleuren",
    currentModel: "Hoofdmodel",
    close: "Sluiten",
    previous: "Vorige",
    next: "Volgende",
    fullscreen: "Volledig scherm",
    supportPhone: "Suriname telefoon",
    price: "Prijs",
    themeAria: "Winkelthema wijzigen",
    cartAddedToast: "Artikel Toegevoegd",
    recommendedSearchPlaceholder: "Zoek in aanbevolen producten...",
    recommendedEmpty: "Geen aanbevolen producten gevonden voor die zoekopdracht.",
    loadingMoreRecommended: "Meer producten laden...",
    buyNow: "Nu kopen",
    quantity: "Aantal",
    available: "Beschikbaar",
    unavailable: "Geen voorraad",
    storeBrand: "Bezoek de winkel van ZorvyA Shop",
    soldRecently: "recent gekocht",
    highlights: "Hoogtepunten",
    productDetailsTitle: "Productdetails",
    featureTitle: "Kenmerken",
    securePayment: "Veilige betaling",
    seller: "Verkoper",
    payment: "Betaling",
    returns: "Retouren",
    estimatedDelivery: "Geschatte levering",
    estimatedDeliveryWindow: "Geschatte levering binnen 24 uur of vandaag als het al onderweg is.",
    supportChooserTitle: "Hoe wil je support spreken",
    supportChooserSubtitle: "Kies de handigste optie en we gaan verder.",
    supportChatOption: "Chat",
    supportCallOption: "Bellen",
    supportWhatsappOption: "WhatsApp",
    supportWhatsappSoon: "We stellen dit binnenkort in.",
    supportChatTitle: "Support chat",
    supportChatSubtitle: "Schrijf en het bericht gaat direct naar het team.",
    supportMessagePlaceholder: "Schrijf je bericht...",
    supportMessageRequired: "Ik heb je e-mail en een bericht nodig om de chat te openen.",
    supportSendSuccess: "Je bericht is naar support verzonden.",
    contactEmail: "Contact e-mail",
  },
  en: {
    back: "Back",
    home: "Back to home",
    comments: "Real comments",
    leaveComment: "Leave a comment",
    name: "Name",
    email: "Email",
    rating: "Rating",
    comment: "Comment",
    send: "Send comment",
    sending: "Sending...",
    reviewSaved: "Review sent successfully.",
    recommended: "Recommended products",
    addToCart: "Add to cart",
    added: "Product added to cart",
    noComments: "There are no comments for this product yet.",
    reviews: "reviews",
    cart: "Cart",
    support: "Support",
    chooseColor: "Choose color",
    modelLabel: "Available models",
    colorLabel: "Available colors",
    currentModel: "Main model",
    close: "Close",
    previous: "Previous",
    next: "Next",
    fullscreen: "Fullscreen",
    supportPhone: "Suriname phone",
    price: "Price",
    themeAria: "Change store theme",
    cartAddedToast: "Item Added",
    recommendedSearchPlaceholder: "Search within recommended products...",
    recommendedEmpty: "We could not find recommended products for that search.",
    loadingMoreRecommended: "Loading more products...",
    buyNow: "Buy now",
    quantity: "Quantity",
    available: "Available",
    unavailable: "Out of stock",
    storeBrand: "Visit the ZorvyA Shop store",
    soldRecently: "bought recently",
    highlights: "Highlights",
    productDetailsTitle: "Product details",
    featureTitle: "Features",
    securePayment: "Secure transaction",
    seller: "Seller",
    payment: "Payment",
    returns: "Returns",
    estimatedDelivery: "Estimated delivery",
    estimatedDeliveryWindow: "Estimated delivery within 24 hours, or same day once it is already on route.",
    supportChooserTitle: "How do you want to contact support",
    supportChooserSubtitle: "Pick the option that fits you best.",
    supportChatOption: "Chat",
    supportCallOption: "Call",
    supportWhatsappOption: "WhatsApp",
    supportWhatsappSoon: "We will configure this shortly.",
    supportChatTitle: "Support chat",
    supportChatSubtitle: "Type here and the message goes straight to the team.",
    supportMessagePlaceholder: "Type your message...",
    supportMessageRequired: "I need your email and a message to open the chat.",
    supportSendSuccess: "Your message was sent to support.",
    contactEmail: "Contact email",
  },
  pt: {
    back: "Voltar",
    home: "Voltar ao inicio",
    comments: "Comentarios reais",
    leaveComment: "Deixar comentario",
    name: "Nome",
    email: "E-mail",
    rating: "Avaliacao",
    comment: "Comentario",
    send: "Enviar comentario",
    sending: "Enviando...",
    reviewSaved: "Avaliacao enviada com sucesso.",
    recommended: "Produtos recomendados",
    addToCart: "Adicionar ao carrinho",
    added: "Produto adicionado ao carrinho",
    noComments: "Ainda nao ha comentarios para este produto.",
    reviews: "avaliacoes",
    cart: "Carrinho",
    support: "Suporte",
    chooseColor: "Escolha a cor",
    modelLabel: "Modelos disponiveis",
    colorLabel: "Cores disponiveis",
    currentModel: "Modelo principal",
    close: "Fechar",
    previous: "Anterior",
    next: "Seguinte",
    fullscreen: "Tela cheia",
    supportPhone: "Telefone Suriname",
    price: "Preco",
    themeAria: "Alterar tema da loja",
    cartAddedToast: "Artigo Adicionado",
    recommendedSearchPlaceholder: "Buscar entre recomendados...",
    recommendedEmpty: "Nao encontramos recomendados para essa busca.",
    loadingMoreRecommended: "Carregando mais produtos...",
    buyNow: "Comprar agora",
    quantity: "Quantidade",
    available: "Disponivel",
    unavailable: "Sem estoque",
    storeBrand: "Visite a loja da ZorvyA Shop",
    soldRecently: "comprados recentemente",
    highlights: "Mais destacados",
    productDetailsTitle: "Detalhes do produto",
    featureTitle: "Caracteristicas",
    securePayment: "Transacao segura",
    seller: "Vendedor",
    payment: "Pagamento",
    returns: "Devolucoes",
    estimatedDelivery: "Entrega estimada",
    estimatedDeliveryWindow: "Entrega estimada em 24 horas ou no mesmo dia quando ja estiver em rota.",
    supportChooserTitle: "Como voce quer falar com o suporte",
    supportChooserSubtitle: "Escolha a opcao mais confortavel e seguimos por ai.",
    supportChatOption: "Chat",
    supportCallOption: "Ligacao",
    supportWhatsappOption: "WhatsApp",
    supportWhatsappSoon: "Vamos configurar isso em breve.",
    supportChatTitle: "Chat de suporte",
    supportChatSubtitle: "Escreva e a mensagem vai direto para a equipe.",
    supportMessagePlaceholder: "Escreva sua mensagem...",
    supportMessageRequired: "Preciso do seu e-mail e de uma mensagem para abrir o chat.",
    supportSendSuccess: "Sua mensagem foi enviada ao suporte.",
    contactEmail: "E-mail de contato",
  },
} as const;

type CartEntry = HydratedCartEntry;
type SupportPanelMode = "menu" | "chat";
type SupportResponse = {
  success?: boolean;
  conversation?: SupportMessage | null;
  error?: string;
};

type ModelOption = {
  id: string;
  name: string;
  price: number;
  color: string;
  details: string;
  imageUrl: string;
  isBase: boolean;
};


function normalizeOption(value: string | undefined) {
  return value?.trim() || "";
}

function normalizeSearchText(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function buildRecommendedSearchBlob(product: StorefrontProduct) {
  return normalizeSearchText(
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

function scoreRecommendedProduct(base: StorefrontProduct, candidate: StorefrontProduct) {
  let score = 0;

  if (base.category && candidate.category && base.category === candidate.category) {
    score += 6;
  }

  if (base.brand && candidate.brand && base.brand === candidate.brand) {
    score += 4;
  }

  const tagSet = new Set(base.tags.map((tag) => normalizeSearchText(tag)));
  for (const tag of candidate.tags) {
    if (tagSet.has(normalizeSearchText(tag))) {
      score += 2;
    }
  }

  if (candidate.isFeatured) score += 1.5;
  if (candidate.isTop) score += 1.5;
  if ((candidate.rating ?? 0) >= 4) score += 1;

  return score;
}

function shouldUseDirectStorefrontImage(src: string) {
  return src.startsWith("data:") || src.startsWith("/api/products/");
}

function StorefrontImage({
  src,
  alt,
  className,
  sizes,
  priority = false,
}: {
  src: string;
  alt: string;
  className: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_25%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_72%_72%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,#08111d_0%,#0f172a_100%)] text-cyan-100">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 15.5 3-3 2.5 2.5 2.5-3 1.5 2" />
          <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        </svg>
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">ZorvyA Shop</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      quality={100}
      unoptimized={shouldUseDirectStorefrontImage(src)}
      sizes={sizes}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

function ProductDetailClient({
  initialProduct,
  initialReviews,
  initialRecommended,
  sessionUser,
  initialClientTheme,
  compact = false,
}: {
  initialProduct: StorefrontProduct;
  initialReviews: ProductReview[];
  initialRecommended: StorefrontProduct[];
  sessionUser: SessionUser | null;
  initialClientTheme: ClientTheme;
  compact?: boolean;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("es");
  const [clientTheme, setClientTheme] = useState<ClientTheme>(initialClientTheme);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [recommended, setRecommended] = useState<StorefrontProduct[]>(initialRecommended);
  const [recommendedSearch, setRecommendedSearch] = useState("");
  const [visibleRecommendedCount, setVisibleRecommendedCount] = useState(8);
  const [name, setName] = useState(sessionUser?.name ?? "");
  const [email, setEmail] = useState(sessionUser?.email ?? "");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartPulseActive, setCartPulseActive] = useState(false);
  const [cartPulseVariant, setCartPulseVariant] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMode, setSupportMode] = useState<SupportPanelMode>("menu");
  const [supportConversation, setSupportConversation] = useState<SupportMessage | null>(null);
  const [supportToken, setSupportToken] = useState("");
  const [supportContactEmail, setSupportContactEmail] = useState(sessionUser?.email ?? "");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("base");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImage, setSelectedImage] = useState(initialProduct.images[0] ?? initialProduct.image);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [showSecondaryContent, setShowSecondaryContent] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const supportMessagesRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const storedLocale = readStoredLocale("es");
    const storedTheme = readStoredClientTheme(initialClientTheme);

    setLocale(storedLocale);
    setClientTheme(storedTheme);
    applyClientTheme(storedTheme);
    setPreferencesHydrated(true);
  }, [initialClientTheme]);

  useEffect(() => {
    if (!preferencesHydrated) {
      return;
    }

    applyClientTheme(clientTheme);
  }, [clientTheme, preferencesHydrated]);

  useEffect(() => {
    const syncLocale = () => {
      setLocale(readStoredLocale("es"));
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== LOCALE_STORAGE_KEY) {
        return;
      }

      syncLocale();
    };

    const handleLocaleEvent = () => {
      syncLocale();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(LOCALE_STORAGE_EVENT, handleLocaleEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LOCALE_STORAGE_EVENT, handleLocaleEvent);
    };
  }, []);

  const readSupportToken = useCallback(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem("zorvya-support-token") ?? "";
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
    window.localStorage.setItem("zorvya-support-token", nextToken);
    setSupportToken(nextToken);
    return nextToken;
  }, [readSupportToken]);

  const loadSupportConversation = useCallback(
    async (showLoading: boolean = false) => {
      const customerToken = sessionUser ? "" : supportToken.trim();

      if (!sessionUser && !customerToken) {
        setSupportConversation(null);
        if (showLoading) {
          setSupportLoading(false);
        }
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
    if (!notice) return;
    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 3200);
    return () => window.clearTimeout(timeout);
    }, [notice]);

  useEffect(() => {
    let cancelled = false;

    const hydrateCart = () => {
      if (cancelled) {
        return;
      }

      const storedEntries = readStoredCart();
      const hydratedCart: CartEntry[] = [];

      for (const entry of storedEntries) {
        const product =
          String(initialProduct.id) === String(entry.productId) ? initialProduct : null;

        if (!product) {
          continue;
        }

        const localizedCartProduct = localizeProduct(product, locale);
        const liveVariant = entry.selectedVariantId
          ? localizedCartProduct.variants.find((variant) => variant.id === entry.selectedVariantId)
          : null;

        hydratedCart.push({
          cartKey: entry.cartKey,
          product: localizedCartProduct,
          quantity: clampCartQuantityToStock(localizedCartProduct, entry.quantity),
          selectedVariantId: entry.selectedVariantId,
          selectedVariantName: liveVariant?.name || (entry.selectedVariantId ? entry.selectedVariantName : undefined),
          selectedColor: entry.selectedColor,
          unitPrice: entry.unitPrice,
          selectedImage: entry.selectedImage,
        });
      }

      if (!cancelled) {
        setCart(hydratedCart);
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(() => {
        hydrateCart();
        setShowSecondaryContent(true);
      });

      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => {
      hydrateCart();
      setShowSecondaryContent(true);
    }, 16);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [initialProduct, locale]);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    if (initialRecommended.length > 0) {
      return;
    }

    const loadRecommended = async () => {
      try {
        const response = await fetch("/api/products", {
          next: { revalidate: 300 },
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          success?: boolean;
          products?: StorefrontProduct[];
        };

        if (!cancelled && payload.success && Array.isArray(payload.products)) {
          setRecommended(
            payload.products.filter((item) => String(item.id) !== String(initialProduct.id))
          );
        }
      } catch {
        return;
      }
    };

    void loadRecommended();

    return () => {
      cancelled = true;
    };
  }, [initialProduct.id, initialRecommended.length]);

  useEffect(() => {
    let cancelled = false;

    const loadReviews = async () => {
      try {
        const response = await fetch(`/api/products/${initialProduct.id}/reviews`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          success?: boolean;
          reviews?: ProductReview[];
        };

        if (!cancelled && data.success && Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        }
      } catch {
        return;
      }
    };

    void loadReviews();

    return () => {
      cancelled = true;
    };
  }, [initialProduct.id]);

  useEffect(() => {
    setSupportToken(readSupportToken());
  }, [readSupportToken]);

  const t = texts[locale];
  const product = useMemo(() => localizeProduct(initialProduct, locale), [initialProduct, locale]);
  const localizedRecommended = useMemo(
    () => recommended.map((item) => localizeProduct(item, locale)),
    [recommended, locale]
  );
  const filteredRecommended = useMemo(() => {
    const sorted = [...localizedRecommended]
      .filter((item) => String(item.id) !== String(product.id))
      .sort((left, right) => scoreRecommendedProduct(product, right) - scoreRecommendedProduct(product, left));
    const normalizedQuery = normalizeSearchText(recommendedSearch);

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((item) => buildRecommendedSearchBlob(item).includes(normalizedQuery));
  }, [localizedRecommended, product, recommendedSearch]);
  const visibleRecommended = useMemo(
    () => filteredRecommended.slice(0, visibleRecommendedCount),
    [filteredRecommended, visibleRecommendedCount]
  );
  const modelOptions = useMemo<ModelOption[]>(() => {
    const fullProductDescription = product.longDescription || product.shortDescription;
    const baseModel: ModelOption = {
      id: "base",
      name: t.currentModel,
      price: product.price,
      color: "",
      details: fullProductDescription,
      imageUrl: product.image,
      isBase: true,
    };

    return [
      baseModel,
      ...product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name || t.currentModel,
        price: variant.price > 0 ? variant.price : product.price,
        color: variant.color,
        details: [variant.details, fullProductDescription].filter(Boolean).join("\n\n"),
        imageUrl: variant.imageUrl || product.image,
        isBase: false,
      })),
    ];
  }, [
    product.image,
    product.longDescription,
    product.price,
    product.shortDescription,
    product.variants,
    t.currentModel,
  ]);
  const selectedModel =
    modelOptions.find((model) => model.id === selectedModelId) ?? modelOptions[0];
  const displayModelOptions = useMemo(
    () => modelOptions.filter((model) => !model.isBase),
    [modelOptions]
  );
  const availableColors = useMemo(() => {
    const colors = new Set(product.colors.map((color) => normalizeOption(color)).filter(Boolean));

    for (const model of modelOptions) {
      if (model.color) {
        colors.add(normalizeOption(model.color));
      }
    }

    return Array.from(colors);
  }, [modelOptions, product.colors]);
  const displayColors = useMemo(
    () => availableColors.filter(Boolean),
    [availableColors]
  );
  const colorImage = useMemo(() => {
    if (!selectedColor) {
      return "";
    }

    return product.colorImageMap?.[selectedColor] ?? "";
  }, [product.colorImageMap, selectedColor]);
  const reviewCount = reviews.length > 0 ? reviews.length : product.reviewCount;
  const averageRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
      : product.rating;
  const activePrice = selectedModel?.price ?? product.price;
  const activeImage = selectedImage || colorImage || selectedModel?.imageUrl || product.image;
  const availableStock = getProductAvailableStock(product);
  const hasStock = availableStock > 0;
  const purchaseOptions = useMemo(
    () => Array.from({ length: Math.max(1, Math.min(availableStock || 1, 10)) }, (_, index) => index + 1),
    [availableStock]
  );
  const boughtRecentlyCount = Math.max(12, reviewCount * 3);
  const highlightBadges = [product.deliveryLabel, product.inventoryLabel, ...product.tags]
    .map((item) => item?.trim())
    .filter(Boolean)
    .slice(0, 4);
  const productDetailsSummary = [
    product.brand ? `Brand: ${product.brand}` : "",
    product.category ? `Category: ${product.category}` : "",
    selectedModel?.name && !selectedModel.isBase ? `Model: ${selectedModel.name}` : "",
    selectedColor ? `Color: ${selectedColor}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const gallery = useMemo(() => {
    const nextGallery = [selectedImage, colorImage, selectedModel?.imageUrl, ...product.images].filter(
      (image): image is string => Boolean(image)
    );

    return Array.from(new Set(nextGallery));
  }, [colorImage, product.images, selectedImage, selectedModel?.imageUrl]);
  const cartItemsCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  useEffect(() => {
    setVisibleRecommendedCount(8);
  }, [product.id, recommendedSearch]);

  useEffect(() => {
    setPurchaseQuantity((current) =>
      Math.max(1, Math.min(current, purchaseOptions[purchaseOptions.length - 1] || 1))
    );
  }, [purchaseOptions]);

  useEffect(() => {
    if (!loadMoreRef.current || visibleRecommendedCount >= filteredRecommended.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleRecommendedCount((current) => Math.min(current + 8, filteredRecommended.length));
      },
      {
        rootMargin: "320px 0px",
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [filteredRecommended.length, visibleRecommendedCount]);

  useEffect(() => {
    if (!supportOpen || supportMode !== "chat") {
      return;
    }

    if (!sessionUser && !supportToken) {
      return;
    }

    let active = true;

    const refreshConversation = async (showLoading: boolean = false) => {
      if (!active) {
        return;
      }

      await loadSupportConversation(showLoading);
    };

    void refreshConversation(true);

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
  }, [loadSupportConversation, sessionUser, supportMode, supportOpen, supportToken]);

  useEffect(() => {
    if (!supportMessagesRef.current || !supportOpen || supportMode !== "chat") {
      return;
    }

    supportMessagesRef.current.scrollTop = supportMessagesRef.current.scrollHeight;
  }, [supportConversation?.chatEntries.length, supportMode, supportOpen]);



  function persistCart(nextCart: CartEntry[]) {
    const normalizedCart = nextCart.map((entry) => ({
      ...entry,
      quantity: clampCartQuantityToStock(entry.product, entry.quantity),
    }));

    setCart(normalizedCart);
    writeStoredCart(
      normalizedCart.map((entry) => ({
        cartKey: entry.cartKey,
        productId: entry.product.id,
        quantity: entry.quantity,
        selectedVariantId: entry.selectedVariantId,
        selectedVariantName: entry.selectedVariantName,
        selectedColor: entry.selectedColor,
        unitPrice: entry.unitPrice,
        selectedImage: entry.selectedImage,
      }))
    );
  }

  function addToCart(productToAdd: StorefrontProduct, quantityToAdd: number = 1) {
    const cartKey = buildCartKey(
      productToAdd.id,
      selectedModel.isBase ? undefined : selectedModel.id,
      selectedColor || selectedModel.color
    );
    const existing = cart.find((entry) => entry.cartKey === cartKey);
    const maxQuantity = Math.max(1, getProductAvailableStock(productToAdd));
    const safeQuantityToAdd = Math.max(1, Math.min(maxQuantity, Math.trunc(quantityToAdd) || 1));

    const nextCart = existing
      ? cart.map((entry) =>
          entry.cartKey === cartKey
            ? { ...entry, quantity: Math.min(maxQuantity, entry.quantity + safeQuantityToAdd) }
            : entry
        )
      : [
          ...cart,
          {
            cartKey,
            product: productToAdd,
            quantity: clampCartQuantityToStock(productToAdd, safeQuantityToAdd),
            selectedVariantId: selectedModel.isBase ? undefined : selectedModel.id,
            selectedVariantName: selectedModel.isBase ? undefined : selectedModel.name,
            selectedColor: selectedColor || selectedModel.color,
            unitPrice: activePrice,
            selectedImage: activeImage,
          },
        ];

    persistCart(nextCart);
    setNotice(t.added);
    setCartPulseVariant((current) => (current + 1) % 2);
    setCartPulseActive(true);
    setCartOpen(true);
  }

  function removeFromCart(cartKey: string) {
    persistCart(cart.filter((entry) => entry.cartKey !== cartKey));
  }

  function changeQuantity(cartKey: string, quantity: number) {
    persistCart(
      cart.map((entry) =>
        entry.cartKey === cartKey
          ? { ...entry, quantity: clampCartQuantityToStock(entry.product, quantity) }
          : entry
      )
    );
  }

  useEffect(() => {
    if (!cartPulseActive) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCartPulseActive(false);
    }, 760);

    return () => window.clearTimeout(timeout);
  }, [cartPulseActive, cartPulseVariant]);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/products/${initialProduct.id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          rating,
          comment,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.review) {
        return;
      }

      setReviews((currentReviews) => [data.review, ...currentReviews]);
      setComment("");
      setRating(5);
      setNotice(t.reviewSaved);
    } finally {
      setSubmitting(false);
    }
  }

  function openReviewSection() {
    setShowSecondaryContent(true);

    window.setTimeout(() => {
      reviewSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function moveLightbox(direction: -1 | 1) {
    const currentIndex = gallery.findIndex((image) => image === selectedImage);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + direction + gallery.length) % gallery.length;

    setSelectedImage(gallery[nextIndex] ?? gallery[0] ?? product.image);
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  function handleBuyNow() {
    addToCart(product, purchaseQuantity);
    setCartOpen(true);
  }

  async function submitSupportMessage() {
    const message = supportMessage.trim();
    const email = supportContactEmail.trim() || sessionUser?.email || "";

    if (!message || !email) {
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
          subject: `${t.supportChatTitle} - ${new Date().toLocaleDateString()}`,
          message,
          attachments: [],
          name: sessionUser?.name ?? "Cliente",
          email,
          phone: sessionUser?.phone ?? "",
          source: "chatbot",
        }),
      });
      const payload = (await response.json()) as SupportResponse;

      if (!payload.success) {
        throw new Error(payload.error || t.supportMessageRequired);
      }

      setSupportConversation(payload.conversation ?? null);
      setSupportMessage("");
      setNotice(t.supportSendSuccess);
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : t.supportMessageRequired);
    } finally {
      setSupportSending(false);
    }
  }

  return (
    <div
      className={`client-page-shell bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.16),_transparent_28%),linear-gradient(180deg,_#02030a_0%,_#050816_100%)] text-white ${compact ? "min-h-0" : "min-h-screen"}`}
    >
      <div className="uiverse-midnight-sky" aria-hidden="true">
        <div className="sky-canvas">
          <div className="stars stars-1" />
          <div className="stars stars-2" />
          <div className="stars stars-3" />
          <div className="meteor m1" />
          <div className="meteor m2" />
          <div className="meteor m3" />
        </div>
      </div>
      <header
        className={`client-sticky-header z-50 border-b border-slate-800/80 bg-[#030611]/85 backdrop-blur-xl ${compact ? "sticky top-0" : "sticky top-0"}`}
      >
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 lg:px-6 2xl:px-8">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-slate-700 bg-[#0a1020] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:border-cyan-500 hover:text-white"
          >
            {t.back}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.assign("/")}
              className="storefront-cosmic-button relative inline-flex h-[2.55rem] min-w-[3.25rem] items-center justify-center overflow-hidden rounded-[12px] px-2 text-center text-[10px] font-semibold leading-none sm:h-[2.7rem] sm:text-[11px]"
              aria-label={t.home}
              title={t.home}
            >
              <span className="storefront-cosmic-button__text whitespace-nowrap">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 9.5V20h13V9.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20v-5.5h5V20" />
                </svg>
              </span>
              <span className="storefront-cosmic-button__stars-container" aria-hidden="true">
                <span className="storefront-cosmic-button__stars" />
              </span>
              <span className="storefront-cosmic-button__glow" aria-hidden="true">
                <span className="storefront-cosmic-button__circle" />
                <span className="storefront-cosmic-button__circle" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="storefront-cosmic-button relative inline-flex h-[2.55rem] min-w-[7.25rem] items-center justify-center overflow-hidden rounded-[12px] px-2 text-center text-[10px] font-semibold leading-none sm:h-[2.7rem] sm:text-[11px]"
            >
              <span className="storefront-cosmic-button__text whitespace-nowrap">
                <strong>{t.cart}</strong>
              </span>
              <span className="storefront-cosmic-button__stars-container" aria-hidden="true">
                <span className="storefront-cosmic-button__stars" />
              </span>
              <span className="storefront-cosmic-button__glow" aria-hidden="true">
                <span className="storefront-cosmic-button__circle" />
                <span className="storefront-cosmic-button__circle" />
              </span>
              {cart.length > 0 ? (
                <span className="storefront-cosmic-button__badge storefront-cosmic-button__badge--cart">
                  {cartItemsCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                setSupportMode("menu");
                setSupportOpen(true);
              }}
              className="storefront-cosmic-button relative inline-flex h-[2.55rem] min-w-[7.25rem] items-center justify-center overflow-hidden rounded-[12px] px-2 text-center text-[10px] font-semibold leading-none sm:h-[2.7rem] sm:text-[11px]"
            >
              <span className="storefront-cosmic-button__text whitespace-nowrap">
                <strong>{t.support}</strong>
              </span>
              <span className="storefront-cosmic-button__stars-container" aria-hidden="true">
                <span className="storefront-cosmic-button__stars" />
              </span>
              <span className="storefront-cosmic-button__glow" aria-hidden="true">
                <span className="storefront-cosmic-button__circle" />
                <span className="storefront-cosmic-button__circle" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className={`w-full overflow-x-hidden px-4 lg:px-6 2xl:px-8 ${compact ? "py-5" : "py-8"}`}>
        {notice ? (
          <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        <div className="min-w-0 space-y-2 lg:hidden">
          <h1 className="break-words text-[1.7rem] font-semibold tracking-tight text-white">{product.name}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-amber-300">{createStars(averageRating)}</span>
            <span>
              {formatGroupedNumber(averageRating, 1)} · {reviewCount} {t.reviews}
            </span>
          </div>
        </div>

        <section
          className={`hidden min-w-0 gap-6 lg:grid lg:grid-cols-[5.5rem_minmax(0,1.05fr)_minmax(0,0.95fr)_18rem] xl:grid-cols-[6rem_minmax(0,1.1fr)_minmax(0,1fr)_19rem] ${compact ? "mt-3" : "mt-5 lg:mt-6"}`}
        >
          <div className="space-y-3">
            {gallery.map((image) => (
              <button
                key={`desktop-thumb-${image}`}
                type="button"
                onClick={() => setSelectedImage(image)}
                className={`relative block overflow-hidden rounded-[1.1rem] border bg-[#08101e] transition ${
                  selectedImage === image
                    ? "border-cyan-400 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]"
                    : "border-slate-800 hover:border-cyan-500/40"
                }`}
              >
                <div className="relative aspect-square w-full">
                  <StorefrontImage
                    src={image}
                    alt={product.name}
                    sizes="96px"
                    className="product-media product-media--cover"
                  />
                </div>
              </button>
            ))}
          </div>

          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              {product.badge ? (
                <span className="absolute left-4 top-4 z-10 rounded-full bg-rose-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                  {product.badge}
                </span>
              ) : null}
              {activeImage ? (
                <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full">
                  <div className="relative aspect-square min-h-[34rem] w-full xl:min-h-[38rem]">
                    <StorefrontImage
                      src={activeImage}
                      alt={product.name}
                      priority
                      sizes="(max-width: 1536px) 42vw, 36vw"
                      className="product-media product-media--detail"
                    />
                  </div>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute bottom-4 right-4 rounded-full border border-slate-700 bg-black/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur"
              >
                {t.fullscreen}
              </button>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <p className="text-sm font-medium text-cyan-300">{t.storeBrand}</p>
              <h1 className="mt-2 break-words text-[2rem] font-semibold leading-tight text-white xl:text-[2.25rem]">
                {product.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-300">
                <span className="text-amber-300">{createStars(averageRating)}</span>
                <span>
                  {formatGroupedNumber(averageRating, 1)} Â· {reviewCount} {t.reviews}
                </span>
                <span className="text-slate-500">|</span>
                <span>
                  {formatGroupedNumber(boughtRecentlyCount)} {t.soldRecently}
                </span>
              </div>
              {product.badge ? (
                <span className="mt-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  {product.badge}
                </span>
              ) : null}
            </div>

            <div className="border-t border-slate-800 pt-5">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="text-[2.4rem] font-semibold leading-none text-white">{formatCurrency(activePrice)}</p>
                {product.originalPrice ? (
                  <p className="text-base text-slate-500 line-through">
                    {formatCurrency(product.originalPrice)}
                  </p>
                ) : null}
              </div>
              {product.originalPrice && product.originalPrice > activePrice ? (
                <p className="mt-2 text-sm font-medium text-rose-300">
                  -
                  {Math.max(
                    1,
                    Math.round(((product.originalPrice - activePrice) / product.originalPrice) * 100)
                  )}
                  %
                </p>
              ) : null}
              <div className="mt-4 rounded-[1.25rem] border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm leading-6 text-cyan-100">
                <span className="font-semibold">{product.deliveryLabel}</span>
                {hasStock ? ` · ${t.available}` : ` · ${t.unavailable}`}
              </div>
            </div>

            {displayModelOptions.length > 0 ? (
              <div>
                <p className="mb-3 text-sm text-slate-400">
                  {t.modelLabel}: <span className="font-semibold text-white">{selectedModel?.name}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {displayModelOptions.map((model) => (
                    <button
                      key={`desktop-model-${model.id}`}
                      type="button"
                      onClick={() => setSelectedModelId(model.id)}
                      className={`min-w-[8rem] rounded-[1rem] border px-4 py-3 text-left transition ${
                        selectedModelId === model.id
                          ? "border-cyan-400 bg-cyan-500/10"
                          : "border-slate-800 bg-[#08101e] hover:border-cyan-500/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{model.name}</p>
                      <p className="mt-1 text-xs text-cyan-300">{formatCurrency(model.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {displayColors.length > 0 ? (
              <div>
                <p className="mb-3 text-sm text-slate-400">
                  {t.colorLabel}: <span className="font-semibold text-white">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {displayColors.map((color) => (
                    <button
                      key={`desktop-color-${color}`}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        setSelectedImage(
                          product.colorImageMap?.[color] || selectedModel?.imageUrl || product.image
                        );
                      }}
                      className={`rounded-full border px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                        selectedColor === color
                          ? "border-cyan-400 bg-cyan-500 text-slate-950"
                          : "border-slate-700 bg-[#08101e] text-slate-300 hover:border-cyan-500/50"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {highlightBadges.length > 0 ? (
              <div>
                <p className="mb-3 text-sm font-medium text-white">{t.highlights}</p>
                <div className="flex flex-wrap gap-2">
                  {highlightBadges.map((badge) => (
                    <span
                      key={`desktop-highlight-${badge}`}
                      className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <details open className="rounded-[1.35rem] border border-slate-800 bg-[#08101e] px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                  {t.featureTitle}
                </summary>
                <p className="mt-3 break-words text-sm leading-7 text-slate-300">
                  {selectedModel?.details || product.shortDescription}
                </p>
              </details>
              <details className="rounded-[1.35rem] border border-slate-800 bg-[#08101e] px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-white">
                  {t.productDetailsTitle}
                </summary>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-300">
                  {product.longDescription ? <p className="break-words">{product.longDescription}</p> : null}
                  {productDetailsSummary ? <p className="text-slate-400">{productDetailsSummary}</p> : null}
                </div>
              </details>
            </div>
          </div>

          <aside className="sticky top-24 space-y-4">
            <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <p className="text-[2rem] font-semibold leading-none text-white">{formatCurrency(activePrice)}</p>
              <p className="mt-2 text-xs text-slate-400">
                {product.hasFreeDelivery ? product.deliveryLabel : product.inventoryLabel}
              </p>

              <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
                <p>{product.deliveryLabel}</p>
                <p>{hasStock ? `${t.available} · ${availableStock}` : t.unavailable}</p>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <label htmlFor="desktop-product-quantity" className="text-sm text-slate-400">
                  {t.quantity}
                </label>
                <select
                  id="desktop-product-quantity"
                  value={purchaseQuantity}
                  onChange={(event) => setPurchaseQuantity(Number(event.target.value) || 1)}
                  className="rounded-full border border-slate-700 bg-[#0a1020] px-3 py-2 text-sm text-white outline-none"
                >
                  {purchaseOptions.map((value) => (
                    <option key={`purchase-qty-${value}`} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => addToCart(product, purchaseQuantity)}
                  className="w-full rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  {t.addToCart}
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full rounded-full border border-cyan-400/40 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white"
                >
                  {t.buyNow}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
                <span>{t.seller}</span>
                <span className="text-white">ZorvyA Shop</span>
                <span>{t.returns}</span>
                <span className="text-white">{product.hasFreeDelivery ? product.deliveryLabel : t.available}</span>
                <span>{t.payment}</span>
                <span className="text-white">{t.securePayment}</span>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-800 bg-[#08101e] p-4 text-sm leading-6 text-slate-300">
              <p className="font-semibold text-cyan-200">{t.estimatedDelivery}</p>
              <p className="mt-2">{t.estimatedDeliveryWindow}</p>
              <p className="mt-2 text-cyan-100">{product.deliveryLabel}</p>
            </div>
          </aside>
        </section>

        <section className={`grid min-w-0 items-start gap-5 lg:hidden ${compact ? "mt-3" : "mt-5 lg:mt-6"}`}>
          {/* Panel lateral izquierdo - Productos similares */}
          {filteredRecommended.length > 0 || recommendedSearch ? (
            <div className="order-3 min-w-0 h-fit rounded-[2.25rem] border border-slate-800 bg-[#050816] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:order-3 lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-semibold">{t.recommended}</p>
              <div className="mt-4 rounded-full border border-slate-800 bg-[#0a1020] px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    value={recommendedSearch}
                    onChange={(event) => setRecommendedSearch(event.target.value)}
                    placeholder={t.recommendedSearchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-4">
                {visibleRecommended.map((item) => (
                  <button
                    key={String(item.id)}
                    onClick={() => router.push(`/products/${item.id}`)}
                    type="button"
                    className="text-left rounded-[1.2rem] border border-slate-800 bg-[#0a1020] p-2.5 transition hover:border-cyan-500/40 group"
                  >
                    <div className="relative mb-3 aspect-[5/4] overflow-hidden rounded-[1rem]">
                      <StorefrontImage
                        src={item.image}
                        alt={item.name}
                        sizes="240px"
                        className="product-media product-media--cover group-hover:scale-105 transition"
                      />
                    </div>
                    <p className="line-clamp-2 text-xs font-semibold leading-5 text-white sm:text-[13px]">{item.name}</p>
                    <p className="mt-1.5 text-sm font-bold text-cyan-300">{formatCurrency(item.price)}</p>
                  </button>
                ))}
                {visibleRecommended.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-[#0a1020] px-4 py-5 text-sm text-slate-400">
                    {t.recommendedEmpty}
                  </div>
                ) : null}
                {visibleRecommendedCount < filteredRecommended.length ? (
                  <div
                    ref={loadMoreRef}
                    className="px-1 py-2 text-center text-xs uppercase tracking-[0.16em] text-slate-500"
                  >
                    {t.loadingMoreRecommended}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Sección central - Imágenes del producto */}
          <div className="order-1 min-w-0 space-y-4 lg:order-2">
            <div className="relative overflow-hidden rounded-[2.25rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              {activeImage ? (
                <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full">
                    <div className="relative aspect-[5/4] min-h-[16.5rem] w-full sm:min-h-[24rem] lg:min-h-[34rem] xl:min-h-[38rem]">
                      <StorefrontImage
                        src={activeImage}
                        alt={product.name}
                        priority
                        sizes="(max-width: 1024px) 100vw, 64vw"
                        className="product-media product-media--detail"
                      />
                    </div>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute bottom-4 right-4 hidden rounded-full border border-slate-700 bg-black/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur sm:inline-flex"
              >
                {t.fullscreen}
              </button>
            </div>

            {gallery.length > 1 ? (
              <div className="flex flex-wrap gap-2.5">
                {gallery.map((image) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImage(image)}
                    className={`overflow-hidden rounded-[1.25rem] border ${
                      selectedImage === image ? "border-cyan-500" : "border-slate-800"
                    } w-[4.5rem] bg-[#0a1020] sm:w-[5rem]`}
                  >
                    <div className="relative aspect-square w-full">
                      <StorefrontImage
                        src={image}
                        alt={product.name}
                        sizes="80px"
                        className="product-media product-media--cover"
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Sección derecha - Información del producto */}
          <div className="order-2 min-w-0 space-y-4 rounded-[2.25rem] border border-transparent bg-transparent p-0 shadow-none lg:order-3 lg:border-slate-800 lg:bg-[#050816] lg:p-5 lg:shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="min-w-0">
              <h1 className="hidden text-3xl font-semibold tracking-tight text-white lg:block">{product.name}</h1>
              <div className="mt-2 hidden items-center gap-2 text-sm text-slate-300 lg:flex">
                <span className="text-amber-300">{createStars(averageRating)}</span>
                <span>
                  {formatGroupedNumber(averageRating, 1)} · {reviewCount} {t.reviews}
                </span>
              </div>
            </div>

            <div className="space-y-3 lg:hidden">
              <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t.price}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(activePrice)}</p>
                {product.originalPrice ? (
                  <p className="mt-1 text-sm text-slate-500 line-through">
                    {formatCurrency(product.originalPrice)}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {product.hasFreeDelivery ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      {product.deliveryLabel}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4">
                  <div className="product-action-shell w-full">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="product-action-button w-full"
                    >
                      {t.addToCart}
                    </button>
                  </div>
                </div>
              </div>

              {selectedModel?.details ? (
                <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-4">
                  <p className="break-words text-sm leading-6 text-slate-300">{selectedModel.details}</p>
                </div>
              ) : null}
            </div>

            <div className="hidden gap-3 lg:grid sm:grid-cols-[1fr_auto]">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openReviewSection}
                  className="rounded-[1.35rem] border border-slate-800 bg-[#0a1020] p-4 text-left transition hover:border-cyan-500/45"
                  aria-label={t.leaveComment}
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    {createStars(averageRating)}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatGroupedNumber(averageRating, 1)}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {reviewCount} {t.reviews}
                  </p>
                </button>
                <div className="rounded-[1.35rem] border border-slate-800 bg-[#0a1020] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t.price}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(activePrice)}</p>
                  {product.originalPrice ? (
                    <p className="mt-1 text-sm text-slate-500 line-through">
                      {formatCurrency(product.originalPrice)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-start gap-2 sm:justify-end">
                {product.hasFreeDelivery ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                    {product.deliveryLabel}
                  </span>
                ) : null}
                <div className="product-action-shell">
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="product-action-button"
                  >
                    {t.addToCart}
                  </button>
                </div>
              </div>
            </div>

            {displayModelOptions.length > 0 ? (
            <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t.modelLabel}
                </p>
                <p className="text-xs text-slate-500">{displayModelOptions.length}</p>
              </div>

              <div className="mt-4 grid gap-3">
                {displayModelOptions.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setSelectedModelId(model.id)}
                    className={`grid items-center gap-3 rounded-[1.25rem] border px-4 py-3 text-left transition sm:grid-cols-[72px_1fr_auto] ${
                      selectedModelId === model.id
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-800 bg-[#050816] hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="h-[72px] overflow-hidden rounded-[1rem] border border-slate-800 bg-[#02040c]">
                      {model.imageUrl ? (
                        <div className="relative h-full w-full">
                          <StorefrontImage
                            src={model.imageUrl}
                            alt={model.name}
                            sizes="72px"
                            className="product-media product-media--cover"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{model.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-cyan-300">{formatCurrency(model.price)}</p>
                      {model.color ? (
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          {model.color}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            ) : null}

            {displayColors.length > 0 ? (
              <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t.colorLabel}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {displayColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        setSelectedImage(
                          product.colorImageMap?.[color] || selectedModel?.imageUrl || product.image
                        );
                      }}
                      className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                        selectedColor === color
                          ? "border-cyan-400 bg-cyan-500 text-slate-950"
                          : "border-slate-700 bg-[#050816] text-slate-300 hover:border-cyan-500"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {filteredRecommended.length > 0 || recommendedSearch ? (
          <section className={`hidden rounded-[2rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] lg:block ${compact ? "mt-6" : "mt-8"}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  {t.recommended}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{t.recommended}</h2>
              </div>
              <div className="w-full max-w-sm rounded-full border border-slate-800 bg-[#0a1020] px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    value={recommendedSearch}
                    onChange={(event) => setRecommendedSearch(event.target.value)}
                    placeholder={t.recommendedSearchPlaceholder}
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-4 lg:grid-cols-3">
              {visibleRecommended.map((item) => (
                <button
                  key={`desktop-rec-${item.id}`}
                  onClick={() => router.push(`/products/${item.id}`)}
                  type="button"
                  className="rounded-[1.4rem] border border-slate-800 bg-[#08101e] p-3 text-left transition hover:border-cyan-500/40"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1rem]">
                    <StorefrontImage
                      src={item.image}
                      alt={item.name}
                      sizes="320px"
                      className="product-media product-media--cover"
                    />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-white">{item.name}</p>
                  <p className="mt-2 text-base font-bold text-cyan-300">{formatCurrency(item.price)}</p>
                </button>
              ))}
              {visibleRecommended.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-[#0a1020] px-4 py-5 text-sm text-slate-400">
                  {t.recommendedEmpty}
                </div>
              ) : null}
            </div>

            {visibleRecommendedCount < filteredRecommended.length ? (
              <div
                ref={loadMoreRef}
                className="px-1 py-4 text-center text-xs uppercase tracking-[0.16em] text-slate-500"
              >
                {t.loadingMoreRecommended}
              </div>
            ) : null}
          </section>
        ) : null}

        {showSecondaryContent ? (
          <section className={`grid gap-6 xl:grid-cols-[1fr_0.95fr] ${compact ? "mt-6" : "mt-8"}`}>
            <div
              ref={reviewSectionRef}
              className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{t.comments}</p>
                  <h2 className="mt-3 text-2xl font-semibold text-white">{t.leaveComment}</h2>
                </div>
              </div>

              <form onSubmit={submitReview} className="mt-6 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t.name}
                    className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.email}
                    className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {t.rating}
                    </p>
                    <div className="rating inline-block">
                      {[5, 4, 3, 2, 1].map((value) => (
                        <span key={value}>
                          <input
                            id={`rating-${value}`}
                            type="radio"
                            name="rating"
                            value={value}
                            checked={rating === value}
                            onChange={() => setRating(value)}
                          />
                          <label htmlFor={`rating-${value}`} aria-label={`${t.rating} ${value}`} />
                        </span>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={t.comment}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {submitting ? t.sending : t.send}
                </button>
              </form>

              <div className="mt-8 space-y-4">
                {reviews.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-[#0a1020] px-5 py-6 text-sm text-slate-400">
                    {t.noComments}
                  </div>
                ) : (
                  reviews.map((review) => (
                    <article
                      key={review.id}
                      className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{review.customerName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-amber-300">
                            {createStars(review.rating)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {review.comment ? (
                        <p className="mt-3 text-sm leading-7 text-slate-300">{review.comment}</p>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {cartOpen ? (
        <CartPanel
          cart={cart}
          locale={locale}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onChangeQuantity={changeQuantity}
          onProceed={() => setCartOpen(false)}
        />
      ) : null}

      {supportOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          onClick={() => {
            setSupportOpen(false);
            setSupportMode("menu");
            setSupportError("");
          }}
        >
          <div
            className="client-panel flex w-full max-w-lg flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816] text-white shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {supportMode === "chat" ? t.supportChatTitle : t.supportChooserTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {supportMode === "chat" ? t.supportChatSubtitle : t.supportChooserSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (supportMode === "chat") {
                    setSupportMode("menu");
                    return;
                  }

                  setSupportOpen(false);
                  setSupportError("");
                }}
                className="rounded-full border border-slate-700 bg-[#0a1020] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
              >
                {supportMode === "chat" ? t.back : t.close}
              </button>
            </div>

            {supportMode === "menu" ? (
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!sessionUser && !supportToken) {
                      ensureSupportToken();
                    }
                    setSupportMode("chat");
                  }}
                  className="rounded-[1.5rem] border border-slate-800 bg-[#08101e] px-4 py-5 text-left transition hover:border-cyan-500/40"
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 14h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4 4v-4H7.5A2.5 2.5 0 0 1 5 12.5z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">{t.supportChatOption}</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "tel:+5970000000";
                  }}
                  className="rounded-[1.5rem] border border-slate-800 bg-[#08101e] px-4 py-5 text-left transition hover:border-cyan-500/40"
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.34 2.71a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 1.73-.57l2.71.34A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">{t.supportCallOption}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNotice(t.supportWhatsappSoon)}
                  className="rounded-[1.5rem] border border-slate-800 bg-[#08101e] px-4 py-5 text-left transition hover:border-cyan-500/40"
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <path d="M16.75 13.96c.25.13 1.47.72 1.7.8.23.08.4.13.57-.13.17-.25.65-.8.8-.96.15-.17.3-.18.55-.06.25.13 1.07.39 2.04 1.23.75.67 1.26 1.5 1.4 1.75.15.25.02.39-.11.52-.12.12-.25.3-.37.44-.12.15-.25.25-.37.42-.12.17-.06.32.03.45.1.13.44.72.6.98.16.27.31.22.43.13.12-.08.5-.58.7-.78.2-.2.4-.17.67-.1.28.06 1.76.83 2.07.98.31.15.52.22.6.35.08.13.08.77-.18 1.5-.26.73-1.5 1.44-2.06 1.5-.53.06-1.2.09-1.94-.15-.45-.15-1.03-.34-1.77-.66-3.12-1.34-5.16-4.47-5.32-4.69-.16-.22-1.27-1.69-1.27-3.22 0-1.53.8-2.28 1.08-2.6.28-.32.61-.4.8-.4.2 0 .4 0 .57.01.18 0 .42-.06.65.5.25.6.86 2.08.93 2.23.08.15.13.32.03.52-.1.2-.15.32-.3.49-.15.17-.32.37-.45.5-.15.15-.3.31-.13.6.17.29.76 1.25 1.62 2.02 1.11 1 2.05 1.31 2.34 1.46.29.15.46.13.63-.08.17-.2.74-.86.94-1.15.2-.29.4-.24.67-.14z" />
                      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.48 0 .12 5.36.12 11.95c0 2.1.55 4.16 1.59 5.97L0 24l6.24-1.64a11.9 11.9 0 0 0 5.7 1.45h.01c6.58 0 11.94-5.36 11.94-11.95 0-3.19-1.24-6.19-3.37-8.38zM12.08 21.8h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.7.97.99-3.61-.23-.37a9.87 9.87 0 0 1-1.51-5.25c0-5.46 4.44-9.9 9.9-9.9 2.64 0 5.12 1.03 6.98 2.9a9.83 9.83 0 0 1 2.9 6.99c0 5.46-4.45 9.9-9.91 9.9z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white">{t.supportWhatsappOption}</p>
                </button>
              </div>
            ) : (
              <div className="flex h-[32rem] flex-col">
                <div ref={supportMessagesRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                  {supportLoading ? (
                    <div className="rounded-[1.25rem] border border-slate-800 bg-[#08101e] px-4 py-3 text-sm text-slate-400">
                      {t.sending}
                    </div>
                  ) : null}

                  {supportConversation?.chatEntries?.length ? (
                    supportConversation.chatEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm leading-6 ${
                          entry.sender === "support"
                            ? "mr-auto border border-cyan-500/25 bg-cyan-500/10 text-cyan-50"
                            : "ml-auto border border-slate-700 bg-[#0a1020] text-white"
                        }`}
                      >
                        <p>{entry.message}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.25rem] border border-slate-800 bg-[#08101e] px-4 py-3 text-sm text-slate-400">
                      {t.supportChatSubtitle}
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-slate-800 px-5 py-4">
                  <input
                    type="email"
                    value={supportContactEmail}
                    onChange={(event) => setSupportContactEmail(event.target.value)}
                    placeholder={t.contactEmail}
                    className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                  <textarea
                    value={supportMessage}
                    onChange={(event) => setSupportMessage(event.target.value)}
                    placeholder={t.supportMessagePlaceholder}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                  {supportError ? <p className="text-sm text-rose-300">{supportError}</p> : null}
                  <button
                    type="button"
                    onClick={() => {
                      void submitSupportMessage();
                    }}
                    disabled={supportSending}
                    className="w-full rounded-full bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {supportSending ? t.sending : t.send}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {lightboxOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 px-4">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-black/65 text-sm font-semibold text-white sm:right-4 sm:top-4"
          >
            X
          </button>

          {gallery.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => moveLightbox(-1)}
                className="absolute left-4 z-20 rounded-full border border-slate-700 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
              >
                {t.previous}
              </button>
              <button
                type="button"
                onClick={() => moveLightbox(1)}
                className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-700 bg-black/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white"
              >
                {t.next}
              </button>
            </>
          ) : null}

          <div className="relative h-[88vh] w-[92vw] max-w-[92vw]">
            <StorefrontImage
              src={selectedImage || activeImage}
              alt={product.name}
              priority
              sizes="92vw"
              className="product-media product-media--contain rounded-[2rem] shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default memo(ProductDetailClient);
