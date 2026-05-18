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
  const [dataSource, setDataSource] = useState<string>("runtime-storage");
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
          setDataSource(String(data.meta?.source ?? "runtime-storage"));
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

      <section className="overflow-x-auto rounded-[1.5rem] border border-slate-700 shadow-[0_16px_60px_rgba(0,0,0,0.4)]">
        {products.length === 0 ? (
          <div className="px-8 py-14 text-center">
            <p className="text-sm font-semibold text-white">No hay productos en el catalogo.</p>
            <p className="mt-2 text-xs text-slate-400">
              Fuente: {dataSource}. Crea productos desde admin para verlos aqui y en la tienda.
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Articulo", "Categoria", "Precio", "Stock", "Estado", "Contabilidad", "Acciones"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-r border-slate-700 bg-[#0a0f1e] px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300 whitespace-nowrap last:border-r-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product, i) => {
                const rowBg = i % 2 === 0 ? "bg-[#050816]" : "bg-[#070d1c]";
                const busy = pendingId === product.id;
                return (
                  <tr key={product.id} className={`${rowBg} transition-colors hover:bg-[#0c1530]`}>

                    {/* ── Articulo ── */}
                    <td className="border-b border-r border-slate-800 px-3 py-2.5 align-top">
                      <Link href={`/admin/products/${product.id}`} className="flex items-center gap-2.5">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-[#02040c]">
                          {product.images[0]?.url ? (
                            <img src={product.images[0].url} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-700">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 15 5-5 4 4 3-3 6 6" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white leading-snug max-w-[160px]">{product.name}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{product.publicId}</p>
                          <p className="font-mono text-[10px] text-slate-500">SKU: {product.sku}</p>
                        </div>
                      </Link>
                    </td>

                    {/* ── Categoria ── */}
                    <td className="border-b border-r border-slate-800 px-3 py-2.5 align-top">
                      <p className="text-xs font-semibold text-white">{product.category}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{product.brand}</p>
                    </td>

                    {/* ── Precio ── */}
                    <td className="border-b border-r border-slate-800 px-3 py-2.5 align-top whitespace-nowrap">
                      <p className="text-xs font-bold text-white">{formatCurrencyDollar(product.price)}</p>
                      {product.originalPrice ? (
                        <p className="mt-0.5 text-[10px] text-slate-500 line-through">{formatCurrencyDollar(product.originalPrice)}</p>
                      ) : null}
                    </td>

                    {/* ── Stock ── */}
                    <td className="border-b border-r border-slate-800 px-3 py-2.5 align-top">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={stockDrafts[product.id] ?? String(product.stock)}
                          onChange={(e) => setStockDrafts((d) => ({ ...d, [product.id]: e.target.value }))}
                          className="w-14 rounded-md border border-slate-700 bg-[#0a1020] px-1.5 py-1 text-[11px] text-white outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => void updateProduct(product.id, { stock: Math.max(0, Number(stockDrafts[product.id] ?? product.stock)), showStock: true })}
                          disabled={busy}
                          className="rounded-md border border-slate-700 bg-[#0a1020] px-2 py-1 text-[10px] font-semibold text-white hover:border-cyan-500 disabled:opacity-50"
                        >
                          OK
                        </button>
                      </div>
                      <p className={`mt-1 text-[10px] font-semibold ${product.stock > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {product.stock > 0 ? "En stock" : "Sin stock"}
                      </p>
                    </td>

                    {/* ── Estado ── */}
                    <td className="border-b border-r border-slate-800 px-3 py-2.5 align-top">
                      <div className="flex flex-wrap gap-1 mb-2">
                        <StatusChip label={product.isVisible ? "Visible" : "Oculto"} tone={product.isVisible ? "cyan" : "slate"} />
                        <StatusChip label={product.isActive ? "Publicado" : "Borrador"} tone={product.isActive ? "emerald" : "slate"} />
                        {product.isFeatured ? <StatusChip label="Destacado" tone="amber" /> : null}
                      </div>
                      <div className="space-y-1.5 text-[11px] text-slate-300">
                        {(
                          [
                            { key: "isVisible", label: "Visible", val: product.isVisible },
                            { key: "isActive", label: "Publicado", val: product.isActive },
                            { key: "isFeatured", label: "Destacado", val: product.isFeatured },
                          ] as const
                        ).map(({ key, label, val }) => (
                          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={val}
                              onChange={() => void updateProduct(product.id, { [key]: !val })}
                              disabled={busy}
                              className="h-3.5 w-3.5 rounded border-slate-600 bg-[#0a1020]"
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-500">
                        {formatDateTime(product.publishedAt)}
                      </p>
                    </td>

                    {/* ── Contabilidad ── */}
                    <td className="border-b border-r border-slate-800 px-3 py-2.5 align-top whitespace-nowrap">
                      <p className="text-xs font-bold text-white">{formatCurrencyDollar(product.internal.costPrice)}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{product.internal.supplier || "Sin proveedor"}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{formatDateTime(product.lastSoldAt)}</p>
                    </td>

                    {/* ── Acciones ── */}
                    <td className="border-b border-slate-800 px-3 py-2.5 align-top">
                      <div className="flex flex-col gap-1 min-w-[80px]">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="rounded-md border border-slate-700 bg-[#0a1020] px-2 py-1 text-center text-[10px] font-semibold text-white hover:border-cyan-500"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => void updateProduct(product.id, { isVisible: !product.isVisible })}
                          disabled={busy}
                          className="rounded-md border border-slate-700 bg-[#0a1020] px-2 py-1 text-[10px] font-semibold text-white hover:border-cyan-500 disabled:opacity-50"
                        >
                          {product.isVisible ? "Ocultar" : "Mostrar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateProduct(product.id, { isActive: !product.isActive })}
                          disabled={busy}
                          className="rounded-md border border-slate-700 bg-[#0a1020] px-2 py-1 text-[10px] font-semibold text-white hover:border-emerald-500 disabled:opacity-50"
                        >
                          {product.isActive ? "Despublicar" : "Publicar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateProduct(product.id, { isFeatured: !product.isFeatured })}
                          disabled={busy}
                          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-200 hover:border-amber-400 disabled:opacity-50"
                        >
                          {product.isFeatured ? "Quitar" : "Destacar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-200 hover:border-rose-400"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
