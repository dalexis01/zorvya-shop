/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { formatCurrencyDollar } from "@/lib/shop/number-format";
import type { Product } from "@/lib/shop/admin-types";

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Sin registro";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin registro";
  }

  return parsed.toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "amber" | "slate" | "cyan" | "rose";
}) {
  const tones = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    slate: "border-slate-700 bg-[#0a1020] text-slate-300",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  } as const;

  return (
    <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tones[tone]}`}>
      {label}
    </span>
  );
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";

  useEffect(() => {
    let isActive = true;

    async function loadProducts() {
      setLoading(true);

      try {
        const response = await fetch(`/api/admin/products?search=${encodeURIComponent(search)}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (isActive && data.success) {
          const nextProducts = data.products ?? [];
          setProducts(nextProducts);
          setStockDrafts(
            Object.fromEntries(
              nextProducts.map((product: Product) => [product.id, String(product.stock)])
            )
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isActive = false;
    };
  }, [search]);

  async function handleDelete(id: string) {
    const response = await fetch(`/api/admin/products/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setProducts((currentProducts) => currentProducts.filter((product) => product.id !== id));
    }
  }

  async function updateProduct(productId: string, payload: Record<string, unknown>) {
    setPendingId(productId);

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (data.success && data.product) {
        setProducts((currentProducts) =>
          currentProducts.map((item) => (item.id === productId ? data.product : item))
        );
        setStockDrafts((currentDrafts) => ({
          ...currentDrafts,
          [productId]: String(data.product.stock),
        }));
      }
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return <div className="min-h-[40vh] rounded-[1.2rem] border border-slate-800 bg-[#060b16]" style={{ fontFamily: "var(--font-manrope)" }} />;
  }

  return (
    <div className="space-y-3" style={{ fontFamily: "var(--font-manrope)" }}>
      <section className="rounded-[1.1rem] border border-slate-800 bg-[#060b16] p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/products/create"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Crear producto
            </Link>
          </div>
          <div className="flex items-center gap-3 xl:justify-end">
            <div className="min-w-0 text-right">
              <h1
                className="text-lg font-semibold tracking-tight text-white"
                style={{ fontFamily: "var(--font-sora)" }}
              >
                Catalogo de productos
              </h1>
            </div>
            <div className="rounded-xl border border-slate-700 bg-[#0a1020] px-3 py-2 text-xs font-medium text-slate-100">
              {products.length} producto(s)
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.1rem] border border-slate-800 bg-[#060b16]">
        {products.length === 0 ? (
          <div className="px-8 py-14 text-center">
            <p className="text-base font-semibold text-white" style={{ fontFamily: "var(--font-sora)" }}>
              No hay productos para mostrar.
            </p>
            <p className="mt-2 text-xs text-slate-300">Crea el primer producto publicado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-800 bg-[#0a1020]">
                <tr className="text-[10px] uppercase tracking-[0.22em] text-slate-200">
                  <th className="px-4 py-3 font-semibold">Articulo</th>
                  <th className="px-4 py-3 font-semibold">Categoria</th>
                  <th className="px-4 py-3 font-semibold">Precios</th>
                  <th className="px-4 py-3 font-semibold">Stock disponible</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Contabilidad</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {products.map((product) => (
                  <tr key={product.id} className="align-middle hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-800 bg-[#02040c]">
                          {product.images[0]?.url ? (
                            <img
                              src={product.images[0].url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="truncate text-[13px] font-semibold text-white"
                            style={{ fontFamily: "var(--font-sora)" }}
                          >
                            {product.name}
                          </p>
                          <div className="mt-1 space-y-1 text-[11px] font-medium text-slate-300">
                            <p className="truncate">ID: {product.publicId}</p>
                            <p className="truncate">SKU: {product.sku}</p>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-[12px] font-semibold text-white">{product.category}</p>
                        <p className="text-[11px] font-medium text-slate-300">{product.brand}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                  <p className="text-[12px] font-semibold text-white">{formatCurrencyDollar(product.price)}</p>
                        <p className="text-[11px] font-medium text-slate-300">
                    {product.originalPrice ? formatCurrencyDollar(product.originalPrice) : "Sin anterior"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={stockDrafts[product.id] ?? String(product.stock)}
                            onChange={(event) =>
                              setStockDrafts((currentDrafts) => ({
                                ...currentDrafts,
                                [product.id]: event.target.value,
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-700 bg-[#0a1020] px-2 py-1.5 text-xs text-white outline-none transition focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void updateProduct(product.id, {
                                stock: Math.max(0, Number(stockDrafts[product.id] ?? product.stock)),
                                showStock: true,
                              })
                            }
                            disabled={pendingId === product.id}
                            className="rounded-lg border border-slate-700 bg-[#0a1020] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Guardar
                          </button>
                        </div>
                        <p className="text-[11px] font-medium text-slate-300">
                          {product.stock > 0 ? "En stock" : "Sin stock"}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusChip label={product.isVisible ? "Visible" : "Oculto"} tone={product.isVisible ? "cyan" : "slate"} />
                        <StatusChip label={product.isActive ? "Publicado" : "Borrador"} tone={product.isActive ? "emerald" : "slate"} />
                        {product.isFeatured ? <StatusChip label="Destacado" tone="amber" /> : null}
                      </div>
                      <div className="mt-3 space-y-2 text-[11px] text-slate-300">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={product.isVisible}
                            onChange={() => void updateProduct(product.id, { isVisible: !product.isVisible })}
                            disabled={pendingId === product.id}
                            className="h-4 w-4 rounded border-slate-600 bg-[#0a1020]"
                          />
                          Visible
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={product.isActive}
                            onChange={() => void updateProduct(product.id, { isActive: !product.isActive })}
                            disabled={pendingId === product.id}
                            className="h-4 w-4 rounded border-slate-600 bg-[#0a1020]"
                          />
                          Publicado
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={product.isFeatured}
                            onChange={() => void updateProduct(product.id, { isFeatured: !product.isFeatured })}
                            disabled={pendingId === product.id}
                            className="h-4 w-4 rounded border-slate-600 bg-[#0a1020]"
                          />
                          Destacado
                        </label>
                      </div>
                      <p className="mt-2 text-[11px] font-medium text-slate-300">
                        Publicado: {formatDateTime(product.publishedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="text-[12px] font-semibold text-white">
                    {formatCurrencyDollar(product.internal.costPrice)}
                        </p>
                        <p className="text-[11px] font-medium text-slate-300">
                          {product.internal.supplier || "Sin proveedor"}
                        </p>
                        <p className="text-[11px] font-medium text-slate-300">
                          Ultima venta: {formatDateTime(product.lastSoldAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="rounded-lg border border-slate-700 bg-[#0a1020] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-cyan-500"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            void updateProduct(product.id, { isVisible: !product.isVisible })
                          }
                          disabled={pendingId === product.id}
                          className="rounded-lg border border-slate-700 bg-[#0a1020] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {product.isVisible ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void updateProduct(product.id, { isActive: !product.isActive })
                          }
                          disabled={pendingId === product.id}
                          className="rounded-lg border border-slate-700 bg-[#0a1020] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {product.isActive ? "Despublicar" : "Publicar"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void updateProduct(product.id, { isFeatured: !product.isFeatured })
                          }
                          disabled={pendingId === product.id}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {product.isFeatured ? "Quitar" : "Destacar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:border-rose-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
