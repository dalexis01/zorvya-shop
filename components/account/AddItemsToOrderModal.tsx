"use client";

import { useMemo, useState } from "react";

import { calculateDeliveryFee, estimateDeliveryDistance } from "@/helpers/delivery";
import { formatCurrencySrd as formatCurrency, formatKilometers } from "@/lib/shop/number-format";
import type {
  CatalogProductOption,
  Locale,
  OrderLineItem,
  OrderSummary,
  ProductIdentifier,
} from "@/lib/shop/types";

const texts = {
  es: {
    title: "Agregar articulos al pedido",
    search: "Buscar productos",
    products: "Productos disponibles",
    quantity: "Cantidad",
    noResults: "No hay productos disponibles con esa busqueda.",
    currentSubtotal: "Subtotal actual",
    addedSubtotal: "Articulos nuevos",
    updatedSubtotal: "Subtotal actualizado",
    updatedDeliveryFee: "Delivery actualizado",
    updatedTotal: "Total actualizado",
    close: "Cerrar",
    submit: "Agregar articulos",
    pending: "Actualizando...",
  },
  nl: {
    title: "Artikelen aan bestelling toevoegen",
    search: "Zoek producten",
    products: "Beschikbare producten",
    quantity: "Aantal",
    noResults: "Er zijn geen producten beschikbaar voor deze zoekopdracht.",
    currentSubtotal: "Huidig subtotaal",
    addedSubtotal: "Nieuwe artikelen",
    updatedSubtotal: "Bijgewerkt subtotaal",
    updatedDeliveryFee: "Bijgewerkte levering",
    updatedTotal: "Bijgewerkt totaal",
    close: "Sluiten",
    submit: "Artikelen toevoegen",
    pending: "Bijwerken...",
  },
  en: {
    title: "Add items to order",
    search: "Search products",
    products: "Available products",
    quantity: "Quantity",
    noResults: "No products are available for that search.",
    currentSubtotal: "Current subtotal",
    addedSubtotal: "New items",
    updatedSubtotal: "Updated subtotal",
    updatedDeliveryFee: "Updated delivery",
    updatedTotal: "Updated total",
    close: "Close",
    submit: "Add items",
    pending: "Updating...",
  },
  pt: {
    title: "Adicionar artigos ao pedido",
    search: "Buscar produtos",
    products: "Produtos disponiveis",
    quantity: "Quantidade",
    noResults: "Nao ha produtos disponiveis para essa busca.",
    currentSubtotal: "Subtotal atual",
    addedSubtotal: "Novos artigos",
    updatedSubtotal: "Subtotal atualizado",
    updatedDeliveryFee: "Entrega atualizada",
    updatedTotal: "Total atualizado",
    close: "Fechar",
    submit: "Adicionar artigos",
    pending: "Atualizando...",
  },
} as const;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

interface AddItemsToOrderModalProps {
  locale: Locale;
  order: OrderSummary;
  products: CatalogProductOption[];
  pending: boolean;
  errorMessage: string;
  onClose: () => void;
  onSubmit: (items: OrderLineItem[]) => Promise<void>;
}

export default function AddItemsToOrderModal({
  locale,
  order,
  products,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: AddItemsToOrderModalProps) {
  const t = texts[locale];
  const [search, setSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalize(search.trim());

    return products.filter((product) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = normalize(`${product.name} ${product.category}`);
      return haystack.includes(normalizedSearch);
    });
  }, [products, search]);

  const selectedItems = useMemo<OrderLineItem[]>(() => {
    return products
      .filter((product) => (quantities[String(product.id)] ?? 0) > 0)
      .map((product) => ({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantities[String(product.id)],
        image: product.image,
      }));
  }, [products, quantities]);

  const addedSubtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [selectedItems]);

  const updatedSubtotal = order.subtotal + addedSubtotal;
  const updatedDeliveryFee =
    order.deliveryType === "delivery"
      ? calculateDeliveryFee(
          order.deliveryDistanceKm ?? estimateDeliveryDistance(order.customerAddress),
          updatedSubtotal
        ).fee
      : 0;
  const updatedTotal = updatedSubtotal + updatedDeliveryFee;

  const changeQuantity = (productId: ProductIdentifier, nextQuantity: number) => {
    setQuantities((current) => ({
      ...current,
      [String(productId)]: Math.max(0, nextQuantity),
    }));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-800 bg-[#050816] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">{t.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{order.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#0a1020] px-3 py-2 text-sm font-semibold text-slate-300"
          >
            {t.close}
          </button>
        </div>

        <div className="space-y-5">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.search}
            className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
          />

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t.products}
            </h4>

            {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0a1020] p-6 text-sm text-slate-400">
                  {t.noResults}
                </div>
              ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredProducts.map((product) => {
                  const quantity = quantities[String(product.id)] ?? 0;

                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl border border-slate-800 bg-[#0a1020] p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-white">{product.name}</p>
                        <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                          {product.category}
                        </p>
                        <p className="text-sm font-medium text-slate-300">
                          {formatCurrency(product.price)}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-400">{t.quantity}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, quantity - 1)}
                            className="h-9 w-9 rounded-full bg-[#050816] text-lg font-semibold text-slate-200"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={quantity}
                            onChange={(event) => {
                              const nextValue = Number.parseInt(event.target.value, 10);
                              changeQuantity(product.id, Number.isNaN(nextValue) ? 0 : nextValue);
                            }}
                            className="w-16 rounded-xl border border-slate-700 bg-[#050816] px-3 py-2 text-center text-sm text-white outline-none transition focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, quantity + 1)}
                            className="h-9 w-9 rounded-full bg-[#050816] text-lg font-semibold text-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-800 bg-[#0a1020] p-4">
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.currentSubtotal}</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.addedSubtotal}</span>
              <span>{formatCurrency(addedSubtotal)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.updatedSubtotal}</span>
              <span>{formatCurrency(updatedSubtotal)}</span>
            </div>
            <div className="flex justify-between gap-4 text-sm text-slate-300">
              <span>{t.updatedDeliveryFee}</span>
              <span>
                {formatCurrency(updatedDeliveryFee)}
                {order.deliveryType === "delivery" ? (
                  <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {formatKilometers(order.deliveryDistanceKm ?? estimateDeliveryDistance(order.customerAddress))}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-base font-semibold text-white">
              <span>{t.updatedTotal}</span>
              <span>{formatCurrency(updatedTotal)}</span>
            </div>
          </section>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void onSubmit(selectedItems)}
            disabled={pending || selectedItems.length === 0}
            className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-semibold text-slate-950 disabled:bg-slate-700 disabled:text-slate-300"
          >
            {pending ? t.pending : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
