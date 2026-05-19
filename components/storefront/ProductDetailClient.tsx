"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const CartPanel = dynamic(() => import("@/components/CartPanel"));

const texts = {
  es: {
    back: "Volver a la tienda",
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
  },
  nl: {
    back: "Terug naar de shop",
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
  },
  en: {
    back: "Back to store",
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
  },
  pt: {
    back: "Voltar para a loja",
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
  },
} as const;

type CartEntry = HydratedCartEntry;

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
  const [recommended] = useState<StorefrontProduct[]>(initialRecommended);
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
  const [selectedModelId, setSelectedModelId] = useState("base");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedImage, setSelectedImage] = useState(initialProduct.images[0] ?? initialProduct.image);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [showSecondaryContent, setShowSecondaryContent] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement | null>(null);
  const handleClientThemeChange = useCallback(
    (nextTheme: ClientTheme) => {
      if (nextTheme === clientTheme) {
        return;
      }

      applyClientTheme(nextTheme);
      startTransition(() => {
        setClientTheme(nextTheme);
      });
    },
    [clientTheme]
  );

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

  const t = texts[locale];
  const product = useMemo(() => localizeProduct(initialProduct, locale), [initialProduct, locale]);
  const localizedRecommended = useMemo(
    () => recommended.map((item) => localizeProduct(item, locale)),
    [recommended, locale]
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
  const availableColors = useMemo(() => {
    const colors = new Set(product.colors.map((color) => normalizeOption(color)).filter(Boolean));

    for (const model of modelOptions) {
      if (model.color) {
        colors.add(normalizeOption(model.color));
      }
    }

    return Array.from(colors);
  }, [modelOptions, product.colors]);
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
  const gallery = useMemo(() => {
    const nextGallery = [selectedImage, colorImage, selectedModel?.imageUrl, ...product.images].filter(
      (image): image is string => Boolean(image)
    );

    return Array.from(new Set(nextGallery));
  }, [colorImage, product.images, selectedImage, selectedModel?.imageUrl]);
  const cartItemsCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);



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

  function addToCart(productToAdd: StorefrontProduct) {
    const cartKey = buildCartKey(
      productToAdd.id,
      selectedModel.isBase ? undefined : selectedModel.id,
      selectedColor || selectedModel.color
    );
    const existing = cart.find((entry) => entry.cartKey === cartKey);
    const maxQuantity = Math.max(1, getProductAvailableStock(productToAdd));

    const nextCart = existing
      ? cart.map((entry) =>
          entry.cartKey === cartKey
            ? { ...entry, quantity: Math.min(maxQuantity, entry.quantity + 1) }
            : entry
        )
      : [
          ...cart,
          {
            cartKey,
            product: productToAdd,
            quantity: clampCartQuantityToStock(productToAdd, 1),
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
          <Link
            href="/"
            className="rounded-full border border-slate-700 bg-[#0a1020] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:border-cyan-500 hover:text-white"
          >
            {t.back}
          </Link>

          <div className="flex items-center gap-2">
            <label className="theme-switch" aria-label={t.themeAria}>
              <span className="sun">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <g fill="#ffd43b">
                    <circle r="5" cy="12" cx="12" />
                    <path d="m21 13h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm-17 0h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm13.66-5.66a1 1 0 0 1 -.66-.29 1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1 -.75.29zm-12.02 12.02a1 1 0 0 1 -.71-.29 1 1 0 0 1 0-1.41l.71-.66a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1 -.7.24zm6.36-14.36a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm0 17a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm-5.66-14.66a1 1 0 0 1 -.7-.29l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.29zm12.02 12.02a1 1 0 0 1 -.7-.29l-.66-.71a1 1 0 0 1 1.36-1.36l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.24z" />
                  </g>
                </svg>
              </span>
              <span className="moon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
                  <path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1 89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z" />
                </svg>
              </span>
              <input
                type="checkbox"
                className="input"
                checked={clientTheme === "light"}
                onChange={(event) =>
                  handleClientThemeChange(event.target.checked ? "light" : "dark")
                }
              />
              <span className="slider" />
            </label>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={`store-cart-btn ${
                cartPulseActive ? `store-cart-btn--celebrate store-cart-btn--celebrate-${cartPulseVariant}` : ""
              }`}
              data-count={cartItemsCount}
              aria-label={`${t.cart} (${cartItemsCount})`}
            >
              {cartPulseActive ? (
                <span className="store-cart-btn__tooltip" role="status" aria-live="polite">
                  {t.cartAddedToast}
                </span>
              ) : null}
              <span className="store-cart-btn__wrapper">
                <span className="store-cart-btn__text">{t.cart}</span>
                <span className="store-cart-btn__icon" aria-hidden="true">
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    height="16"
                    width="16"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M0 2.5A.5.5 0 0 1 .5 2H2a.5.5 0 0 1 .485.379L2.89 4H14.5a.5.5 0 0 1 .485.621l-1.5 6A.5.5 0 0 1 13 11H4a.5.5 0 0 1-.485-.379L1.61 3H.5a.5.5 0 0 1-.5-.5zM3.14 5l1.25 5h8.22l1.25-5H3.14zM5 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm9-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0z" />
                  </svg>
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="rounded-full border border-rose-500/35 bg-[#0a1020] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:border-rose-400"
            >
              {t.support}
            </button>
          </div>
        </div>
      </header>

      <div className={`w-full px-4 lg:px-6 2xl:px-8 ${compact ? "py-5" : "py-8"}`}>
        {notice ? (
          <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        <section className={`grid items-start gap-6 lg:grid-cols-[0.35fr_1.18fr_0.82fr] ${compact ? "mt-2" : "mt-6"}`}>
          {/* Panel lateral izquierdo - Productos similares */}
          {localizedRecommended.length > 0 ? (
            <div className="rounded-[2.25rem] border border-slate-800 bg-[#050816] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] h-fit">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300 font-semibold">{t.recommended}</p>
              <div className="mt-4 flex flex-col gap-3">
                {localizedRecommended.map((item) => (
                  <button
                    key={String(item.id)}
                    onClick={() => {
                      if (item.variants.length > 0 || item.colors.length > 0) {
                        return;
                      }

                      const cartKey = buildCartKey(item.id);
                      const existing = cart.find((entry) => entry.cartKey === cartKey);
                      const nextCart = existing
                        ? cart.map((entry) =>
                            entry.cartKey === cartKey
                              ? { ...entry, quantity: entry.quantity + 1 }
                              : entry
                          )
                        : [
                            ...cart,
                            {
                              cartKey,
                              product: item,
                              quantity: 1,
                            },
                          ];

                      persistCart(nextCart);
                      setNotice(t.added);
                    }}
                    type="button"
                    className="text-left rounded-lg border border-slate-800 bg-[#0a1020] p-2 hover:border-cyan-500/40 transition group"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg mb-2">
                      <StorefrontImage
                        src={item.image}
                        alt={item.name}
                        sizes="120px"
                        className="product-media product-media--cover group-hover:scale-105 transition"
                      />
                    </div>
                    <p className="text-[10px] font-semibold text-white line-clamp-2 leading-tight">{item.name}</p>
                    <p className="text-xs text-cyan-300 font-bold mt-1">{formatCurrency(item.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Sección central - Imágenes del producto */}
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[2.25rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              {activeImage ? (
                <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full">
                    <div className="relative aspect-[5/4] min-h-[26rem] w-full sm:min-h-[31rem]">
                      <StorefrontImage
                        src={activeImage}
                        alt={product.name}
                        priority
                        sizes="(max-width: 1024px) 100vw, 58vw"
                        className="product-media product-media--contain"
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
          <div className="space-y-4 rounded-[2.25rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">{product.name}</h1>
              {selectedModel?.details ? (
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedModel.details}</p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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

            <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t.modelLabel}
                </p>
                <p className="text-xs text-slate-500">{modelOptions.length}</p>
              </div>

              <div className="mt-4 grid gap-3">
                {modelOptions.map((model) => (
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

            {availableColors.length > 0 ? (
              <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t.colorLabel}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {availableColors.map((color) => (
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

            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-300">
              {product.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-slate-700 bg-[#0a1020] px-3 py-1">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

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
        <div className="fixed inset-0 z-[60] flex items-center justify-end bg-black/55">
          <div className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-800 bg-[#050816] text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h2 className="text-base font-semibold text-white">{t.support}</h2>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="rounded-full border border-slate-700 bg-[#0a1020] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
              >
                {t.close}
              </button>
            </div>
            <div className="flex-1 space-y-4 px-5 py-5">
              <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {t.supportPhone}
                </p>
                <p className="mt-3 text-lg font-semibold text-white">+597 000 0000</p>
              </div>
            </div>
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
