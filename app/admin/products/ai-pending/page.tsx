"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { formatCurrencySrd, formatCurrencyUsd } from "@/lib/shop/number-format";
import type { AiProductPendingItem, SupplierChoice } from "@/lib/shop/admin-types";

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return parsed.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminAiPendingProductsPage() {
  const [items, setItems] = useState<AiProductPendingItem[]>([]);
  const [providers, setProviders] = useState<SupplierChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [supplierDrafts, setSupplierDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const providerNameById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider.name])),
    [providers]
  );

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [itemsResponse, providersResponse] = await Promise.all([
          fetch("/api/admin/ai-products/pending", { cache: "no-store" }),
          fetch("/api/admin/providers?lite=1", { cache: "no-store" }),
        ]);
        const [itemsData, providersData] = await Promise.all([
          itemsResponse.json(),
          providersResponse.json(),
        ]);

        if (!active) {
          return;
        }

        if (!itemsData.success) {
          setError(itemsData.error || "No se pudieron cargar los productos IA");
          return;
        }

        const nextItems = (itemsData.items ?? []) as AiProductPendingItem[];
        const nextProviders = (providersData.providers ?? []) as SupplierChoice[];
        setItems(nextItems);
        setProviders(nextProviders);
        setSupplierDrafts(
          Object.fromEntries(nextItems.map((item) => [item.id, item.supplierId ?? ""]))
        );
      } catch {
        if (active) {
          setError("No se pudieron cargar los productos IA");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  async function runAction(
    itemId: string,
    route: string,
    payload?: Record<string, unknown>,
    removeAfter = false
  ) {
    setPendingActionId(itemId);
    setError("");

    try {
      const response = await fetch(route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemId, ...payload }),
      });
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "No se pudo completar la accion");
        return;
      }

      if (removeAfter) {
        setItems((current) => current.filter((item) => item.id !== itemId));
        return;
      }

      const updatedProduct = data.product;
      setItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? {
                ...item,
                supplierId: updatedProduct?.supplierId ?? item.supplierId,
                supplierName:
                  providerNameById.get(updatedProduct?.supplierId ?? "") ?? item.supplierName,
                title: updatedProduct?.name ?? item.title,
                description: updatedProduct?.longDescription ?? item.description,
                category: updatedProduct?.category ?? item.category,
                tags: updatedProduct?.tags ?? item.tags,
                priceSrd: updatedProduct?.price ?? item.priceSrd,
                costUsd: updatedProduct?.costUsd ?? item.costUsd,
                stockCode: updatedProduct?.stockCode ?? item.stockCode,
                publicImageUrl: updatedProduct?.images?.[0]?.url ?? item.publicImageUrl,
                thumbnailUrl: updatedProduct?.images?.[1]?.url ?? item.thumbnailUrl,
                originalTelegramImageUrl:
                  updatedProduct?.originalTelegramImageUrl ?? item.originalTelegramImageUrl,
                originalSlackImageUrl:
                  updatedProduct?.originalSlackImageUrl ?? item.originalSlackImageUrl,
                originalImageUrl:
                  updatedProduct?.accountingOriginalImageUrl ?? item.originalImageUrl,
                aiConfidenceScore:
                  updatedProduct?.aiConfidenceScore ?? item.aiConfidenceScore,
                reviewStatus: updatedProduct?.reviewStatus ?? item.reviewStatus,
                generatedImages: updatedProduct?.generatedImages ?? item.generatedImages,
                seoTitle: updatedProduct?.seoTitle ?? item.seoTitle,
                seoDescription: updatedProduct?.seoDescription ?? item.seoDescription,
                specifications: updatedProduct?.specifications ?? item.specifications,
              }
            : item
        )
      );
    } finally {
      setPendingActionId(null);
    }
  }

  if (loading) {
    return <div className="min-h-[40vh] rounded-[1.2rem] border border-slate-800 bg-[#060b16]" />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.1rem] border border-slate-800 bg-[#060b16] p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Productos IA pendientes</h1>
            <p className="text-sm text-slate-400">
              Todo lo que entre desde n8n + Telegram queda en borrador hasta revision manual.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200">
            {items.length} pendiente(s)
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
      </section>

      {items.length === 0 ? (
        <section className="rounded-[1.2rem] border border-slate-800 bg-[#060b16] p-10 text-center text-slate-400">
          No hay productos IA pendientes ahora mismo.
        </section>
      ) : (
        <section className="space-y-4">
          {items.map((item) => {
            const busy = pendingActionId === item.id;
            const supplierDraft = supplierDrafts[item.id] ?? item.supplierId ?? "";
            const publicPreviewImages =
              item.generatedImages && item.generatedImages.length > 0
                ? item.generatedImages
                : item.publicImageUrl
                  ? [{ id: `${item.id}-public`, url: item.publicImageUrl, label: "Imagen publica" }]
                  : [];
            const hasMissingPublicImages = publicPreviewImages.length === 0;

            return (
              <article
                key={item.id}
                className="rounded-[1.3rem] border border-slate-800 bg-[#060b16] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]"
              >
                <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-[1rem] border border-slate-800 bg-[#09101d]">
                      <Link href={item.productId ? `/admin/products/${item.productId}` : "/admin/products"}>
                        {item.publicImageUrl ? (
                          <img
                            src={item.publicImageUrl}
                            alt={item.title}
                            className="h-56 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-56 items-center justify-center text-sm text-slate-500">
                            Sin imagen publica
                          </div>
                        )}
                      </Link>
                    </div>
                    {publicPreviewImages.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {publicPreviewImages.slice(0, 6).map((image) => (
                          <div
                            key={image.id}
                            className="overflow-hidden rounded-xl border border-slate-800 bg-[#09101d]"
                          >
                            <img
                              src={image.url}
                              alt={image.label}
                              className="h-20 w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => window.open(`/api/admin/ai-products/original/${item.id}`, "_blank")}
                        className="rounded-xl border border-slate-700 bg-[#0c1424] px-3 py-2 font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200"
                      >
                        Ver imagen original
                      </button>
                      <Link
                        href={item.productId ? `/admin/products/${item.productId}` : "/admin/products"}
                        className="rounded-xl border border-slate-700 bg-[#0c1424] px-3 py-2 text-center font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200"
                      >
                        Editar
                      </Link>
                      </div>
                      <div className="rounded-[1rem] border border-slate-800 bg-[#09101d] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Contabilidad privada
                        </p>
                        <div className="mt-3 space-y-2 text-xs text-slate-300">
                          <p>
                            Telegram original:
                            <span className="ml-2 break-all text-white">
                              {item.originalTelegramImageUrl || "Sin original"}
                            </span>
                          </p>
                          <p>
                            Referencia contable:
                            <span className="ml-2 break-all text-white">
                              {item.originalImageUrl || "Sin referencia"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200">
                            Draft IA
                          </span>
                          <span className="rounded-full border border-slate-700 bg-[#0c1424] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-200">
                            Revision {item.reviewStatus.replace("_", " ")}
                          </span>
                          {item.aiConfidenceScore !== null ? (
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                              IA {item.aiConfidenceScore}%
                            </span>
                          ) : null}
                          {hasMissingPublicImages ? (
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-200">
                              Faltan imagenes publicas generadas
                            </span>
                          ) : null}
                        </div>
                        <Link
                          href={item.productId ? `/admin/products/${item.productId}` : "/admin/products"}
                          className="inline-block"
                        >
                          <h2 className="text-2xl font-semibold text-white transition hover:text-cyan-200">
                            {item.title}
                          </h2>
                        </Link>
                        <p className="text-sm leading-6 text-slate-300">{item.description}</p>
                        {hasMissingPublicImages ? (
                          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                            Faltan imágenes públicas generadas.
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-[220px] rounded-[1rem] border border-slate-800 bg-[#09101d] p-3 text-sm text-slate-200">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Precio SRD</span>
                          <strong>{formatCurrencySrd(item.priceSrd)}</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-slate-400">Costo USD</span>
                          <strong>{formatCurrencyUsd(item.costUsd)}</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-slate-400">Almacen</span>
                          <strong>{item.stockCode || "Sin codigo"}</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-slate-400">Categoria</span>
                          <strong>{item.category || "Sin categoria"}</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-slate-400">Proveedor</span>
                          <strong>{item.supplierName || item.supplierNameDetected || "Sin detectar"}</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-slate-400">Creado</span>
                          <strong>{formatDateTime(item.createdAt)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="rounded-[1rem] border border-slate-800 bg-[#09101d] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Etiquetas
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.tags.length > 0 ? (
                            item.tags.map((tag) => (
                              <span
                                key={`${item.id}-${tag}`}
                                className="rounded-full border border-slate-700 bg-[#0c1424] px-2 py-1 text-xs text-slate-200"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">Sin etiquetas</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1rem] border border-slate-800 bg-[#09101d] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Proveedor
                        </p>
                        <div className="mt-3 space-y-2">
                          <select
                            value={supplierDraft}
                            onChange={(event) =>
                              setSupplierDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1424] px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                          >
                            <option value="">Sin proveedor</option>
                            {providers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy || !supplierDraft}
                            onClick={() =>
                              runAction(item.id, "/api/admin/ai-products/change-supplier", {
                                supplierId: supplierDraft,
                              })
                            }
                            className="w-full rounded-xl border border-slate-700 bg-[#0c1424] px-3 py-2 text-sm font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cambiar proveedor
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item.id, "/api/admin/ai-products/publish", {}, true)}
                        className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110a] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Publicar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item.id, "/api/admin/ai-products/reject", {}, true)}
                        className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item.id, "/api/admin/ai-products/regenerate-description")}
                        className="rounded-xl border border-slate-700 bg-[#0c1424] px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Regenerar descripcion
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item.id, "/api/admin/ai-products/regenerate-images")}
                        className="rounded-xl border border-slate-700 bg-[#0c1424] px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Regenerar imagenes
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(item.id, "/api/admin/ai-products/delete", {}, true)}
                        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
