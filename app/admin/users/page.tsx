"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AdminUserRecord } from "@/lib/shop/admin-types";
import { formatCurrencyDollar, formatGroupedNumber } from "@/lib/shop/number-format";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (data.success) {
          setUsers(data.users ?? []);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadUsers();
  }, [search]);

  async function toggleBlocked(user: AdminUserRecord) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isBlocked: !user.isBlocked,
      }),
    });
    const data = await response.json();

    if (data.success && data.user) {
      setUsers((currentUsers) =>
        currentUsers.map((item) => (item.id === user.id ? { ...item, ...data.user } : item))
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Clientes</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">Usuarios registrados</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Consulta actividad basica, compras, gasto acumulado y estado de cada cuenta.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
          placeholder="Buscar por nombre, correo, telefono o direccion"
        />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        {loading ? (
          <div className="px-8 py-16 text-center text-sm uppercase tracking-[0.3em] text-slate-500">
            Cargando usuarios
          </div>
        ) : users.length === 0 ? (
          <div className="px-8 py-16 text-center">
            <p className="text-lg font-medium text-white">No hay usuarios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-slate-800 bg-[#090e1b]">
                <tr className="text-left text-xs uppercase tracking-[0.3em] text-slate-500">
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Contacto</th>
                  <th className="px-6 py-4">Compras</th>
                  <th className="px-6 py-4">Total gastado</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-5 text-sm text-slate-300">
                      <Link href={`/admin/users/${user.id}`} className="font-semibold text-white hover:text-cyan-300">
                        {user.name}
                      </Link>
                      <p className="mt-1 text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-300">
                      <p>{user.phone || "Sin telefono"}</p>
                      <p className="mt-1 text-slate-500">{user.address || "Sin direccion"}</p>
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-white">{formatGroupedNumber(user.orderCount)}</td>
                    <td className="px-6 py-5 text-sm font-semibold text-white">{formatCurrencyDollar(user.totalSpent)}</td>
                    <td className="px-6 py-5 text-sm">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          user.isBlocked
                            ? "bg-rose-500/15 text-rose-200"
                            : "bg-emerald-500/15 text-emerald-200"
                        }`}
                      >
                        {user.isBlocked ? "Bloqueado" : "Activo"}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleBlocked(user)}
                        className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          user.isBlocked
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400"
                            : "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400"
                        }`}
                      >
                        {user.isBlocked ? "Desbloquear" : "Bloquear"}
                      </button>
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
