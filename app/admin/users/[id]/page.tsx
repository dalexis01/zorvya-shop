"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { AdminUserProfile } from "@/lib/shop/admin-types";
import { formatCurrencyDollar, formatGroupedNumber } from "@/lib/shop/number-format";

export default function AdminUserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    async function loadProfile() {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
        const data = await response.json();

        if (data.success && data.profile) {
          setProfile(data.profile);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500"></div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Cargando perfil</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="text-lg font-medium text-white">No se encontro el usuario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Perfil cliente</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">{profile.name}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Historial completo de compras, datos de contacto y gasto acumulado.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-sm text-slate-500">Correo</p>
          <p className="mt-3 text-base font-semibold text-white">{profile.email}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-sm text-slate-500">Telefono</p>
          <p className="mt-3 text-base font-semibold text-white">{profile.phone || "Sin telefono"}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-sm text-slate-500">Total ordenes</p>
          <p className="mt-3 text-4xl font-semibold text-white">{formatGroupedNumber(profile.orderCount)}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-800 bg-[#050816] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-sm text-slate-500">Total gastado</p>
          <p className="mt-3 text-4xl font-semibold text-white">{formatCurrencyDollar(profile.totalSpent)}</p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Historial de compras</p>
        <div className="mt-5 space-y-4">
          {profile.orders.length === 0 ? (
            <p className="text-sm text-slate-500">Este usuario no tiene ordenes registradas.</p>
          ) : (
            profile.orders.map((order) => (
              <div key={order.id} className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Link href={`/admin/orders/${order.id}`} className="text-lg font-semibold text-white hover:text-cyan-300">
                      {order.id}
                    </Link>
                    <p className="mt-2 text-sm text-slate-500">
                      {new Date(order.createdAt).toLocaleString()} • {order.deliveryType}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-300">{order.status}</p>
                  </div>
                  <p className="text-xl font-semibold text-white">{formatCurrencyDollar(order.total)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
