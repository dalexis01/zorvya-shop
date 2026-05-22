"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type {
  AdminOrdersMeta,
  AdminSessionUser,
  AdminSupportMeta,
} from "@/lib/shop/admin-types";

function getPathLabel(pathname: string) {
  const cleanPath = pathname.replace("/admin", "") || "/dashboard";
  return cleanPath;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordersMeta, setOrdersMeta] = useState<AdminOrdersMeta | null>(null);
  const [supportMeta, setSupportMeta] = useState<AdminSupportMeta | null>(null);
  const [headerSearch, setHeaderSearch] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLoginPage = pathname === "/admin/login";
  const isProductsListPage = pathname === "/admin/products";
  const currentHeaderQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    if (headerSearch !== currentHeaderQuery) {
      setHeaderSearch(currentHeaderQuery);
    }
  }, [currentHeaderQuery, headerSearch]);

  useEffect(() => {
    if (!isProductsListPage) {
      return;
    }

    if (headerSearch === currentHeaderQuery) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (headerSearch.trim()) {
        nextParams.set("q", headerSearch.trim());
      } else {
        nextParams.delete("q");
      }

      const nextQueryString = nextParams.toString();
      router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, {
        scroll: false,
      });
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentHeaderQuery, headerSearch, isProductsListPage, pathname, router, searchParams]);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/admin/auth/session", { cache: "no-store" });
        const data = await response.json();

        if (data.success && data.user) {
          setUser(data.user);
        } else {
          router.push("/admin/login");
        }
      } catch {
        router.push("/admin/login");
      } finally {
        setLoading(false);
      }
    }

    if (isLoginPage) {
      setLoading(false);
      return;
    }

    void checkSession();
  }, [isLoginPage, router]);

  useEffect(() => {
    if (isLoginPage) {
      return;
    }

    const shouldLoadOrdersMeta =
      pathname === "/admin" || pathname.startsWith("/admin/orders");
    const shouldLoadSupportMeta =
      pathname === "/admin" || pathname.startsWith("/admin/support");

    if (!shouldLoadOrdersMeta && !shouldLoadSupportMeta) {
      return;
    }

    async function loadOrdersMeta() {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const requests: Promise<Response>[] = [];

        if (shouldLoadOrdersMeta) {
          requests.push(fetch("/api/admin/orders/meta", { cache: "no-store" }));
        }

        if (shouldLoadSupportMeta) {
          requests.push(fetch("/api/admin/support/meta", { cache: "no-store" }));
        }

        const responses = await Promise.all(requests);
        let responseIndex = 0;

        if (shouldLoadOrdersMeta) {
          const ordersData = await responses[responseIndex].json();
          responseIndex += 1;

          if (ordersData.success && ordersData.meta) {
            setOrdersMeta(ordersData.meta);
          }
        }

        if (shouldLoadSupportMeta) {
          const supportData = await responses[responseIndex].json();

          if (supportData.success && supportData.meta) {
            setSupportMeta(supportData.meta);
          }
        }
      } catch {
        return;
      }
    }

    void loadOrdersMeta();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadOrdersMeta();
      }
    };
    const handleOrdersUpdated = () => {
      if (shouldLoadOrdersMeta) {
        void loadOrdersMeta();
      }
    };
    const handleSupportUpdated = () => {
      if (shouldLoadSupportMeta) {
        void loadOrdersMeta();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("admin-orders-updated", handleOrdersUpdated);
    window.addEventListener("admin-support-updated", handleSupportUpdated);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("admin-orders-updated", handleOrdersUpdated);
      window.removeEventListener("admin-support-updated", handleSupportUpdated);
    };
  }, [isLoginPage, pathname]);

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (loading) {
    return <div className="min-h-screen bg-[#050816]" />;
  }

  if (isLoginPage) {
    return children;
  }

  if (!user) {
    return children;
  }

  const menuItems = [
    { href: "/admin", label: "Dashboard", badge: "DB" },
    { href: "/admin/products", label: "Productos", badge: "PR" },
    { href: "/admin/orders", label: "Ordenes", badge: "OR" },
    { href: "/admin/support", label: "Soporte", badge: "SP" },
    { href: "/admin/providers", label: "Proveedores", badge: "PV" },
    { href: "/admin/users", label: "Usuarios", badge: "US" },
    { href: "/admin/debug/egress", label: "Debug Egress", badge: "DE" },
    { href: "/admin/settings", label: "Ajustes", badge: "ST" },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return pathname.startsWith(href);
  };

  const headerSearchPlaceholder = isProductsListPage
    ? "Buscar productos por ID, nombre, categoria o SKU"
    : "Busqueda interna del panel";

  return (
    <div className="h-screen overflow-hidden bg-[linear-gradient(180deg,_#040816_0%,_#060b16_100%)] text-white">
      <div className="flex h-full">
        <aside className="hidden h-full w-[11rem] shrink-0 border-r border-slate-800 bg-[#040816] text-slate-100 xl:flex xl:flex-col">
          <div className="border-b border-slate-800 px-4 py-4">
            <h1 className="text-base font-semibold tracking-tight text-white">ZorvyA Admin</h1>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {menuItems.map((item) => {
              const showOrderBadge =
                item.href === "/admin/orders" && (ordersMeta?.newOrdersCount ?? 0) > 0;
              const showSupportBadge =
                item.href === "/admin/support" && (supportMeta?.unreadCount ?? 0) > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={`relative flex items-center rounded-xl px-3 py-2.5 transition ${
                    isActive(item.href)
                      ? "border border-cyan-500/40 bg-cyan-400/10 text-white"
                      : "border border-transparent text-slate-300 hover:border-slate-800 hover:bg-[#0a1020] hover:text-white"
                  }`}
                >
                  <span className="text-[15px] font-semibold text-white">{item.label}</span>
                  {showOrderBadge ? (
                    <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {Math.min(ordersMeta?.newOrdersCount ?? 0, 99)}
                    </span>
                  ) : null}
                  {showSupportBadge ? (
                    <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {Math.min(supportMeta?.unreadCount ?? 0, 99)}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-800 p-4">
            <div className="rounded-2xl border border-slate-800 bg-[#0a1020] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Sesion</p>
              <p className="mt-3 text-[13px] font-medium text-white">{user.name}</p>
              <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.25em] text-cyan-300">
                {user.role.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="mt-4 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Cerrar sesion
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-slate-800 bg-[#040816] px-5 py-3 xl:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="text-xs text-slate-300">{getPathLabel(pathname)}</div>
              <div className="flex flex-1 items-center justify-end gap-3">
                <div className="hidden max-w-xs flex-1 items-center rounded-full border border-slate-800 bg-[#0a1020] px-3 py-1.5 lg:flex">
                  <svg className="mr-2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={headerSearch}
                    onChange={(event) => setHeaderSearch(event.target.value)}
                    readOnly={!isProductsListPage}
                    aria-label="Busqueda interna"
                    placeholder={headerSearchPlaceholder}
                    className="w-full bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500"
                  />
                </div>
                <Link
                  href="/admin/revenue"
                  className="hidden rounded-xl border border-slate-800 bg-[#0a1020] px-3 py-2 text-xs font-medium text-white transition hover:border-cyan-500 lg:inline-flex"
                >
                  Ingresos
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-xl border border-slate-800 bg-[#0a1020] px-3 py-2 text-xs font-medium text-white transition hover:border-rose-500 xl:hidden"
                >
                  Salir
                </button>
                <div className="hidden items-center gap-3 rounded-full border border-slate-800 bg-[#0a1020] px-3 py-1.5 lg:flex">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-xs font-bold text-slate-950">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">{user.name}</p>
                    <p className="text-[11px] text-slate-500">{user.role.replace("_", " ")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 xl:p-4" style={{ WebkitOverflowScrolling: "touch" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
