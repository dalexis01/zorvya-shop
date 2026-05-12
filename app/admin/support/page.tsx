"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { SUPPORT_PHONE } from "@/lib/shop/config";
import type { SupportMessage } from "@/lib/shop/admin-types";
import { ACCEPTED_IMAGE_TYPES, imageFileToDataUrl } from "@/lib/shop/image-upload";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function statusTone(status: SupportMessage["status"]) {
  if (status === "resolved") {
    return "bg-emerald-500/15 text-emerald-200";
  }

  if (status === "in_progress") {
    return "bg-blue-500/15 text-blue-200";
  }

  return "bg-rose-500/15 text-rose-200";
}

function priorityTone(priority: SupportMessage["priority"]) {
  if (priority === "high") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  }

  if (priority === "medium") {
    return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  }

  return "border-slate-700 bg-[#0a1020] text-slate-300";
}

export default function AdminSupportPage() {
  const searchParams = useSearchParams();
  const selectedFromUrl = searchParams.get("message");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [statusFilter, setStatusFilter] = useState<"all" | SupportMessage["status"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | SupportMessage["priority"]>("all");
  const [responseMessage, setResponseMessage] = useState("");
  const [responseAttachments, setResponseAttachments] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<"status" | "priority" | "reply" | "view" | null>(null);
  const [error, setError] = useState("");
  const responseAttachmentInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadMessages() {
      try {
        const response = await fetch("/api/admin/support", { cache: "no-store" });
        const data = await response.json();

        if (!isActive || !data.success) {
          return;
        }

        const nextMessages = data.messages ?? [];
        setMessages(nextMessages);
        setSelectedId((currentId) => {
          if (selectedFromUrl && nextMessages.some((message: SupportMessage) => message.id === selectedFromUrl)) {
            return selectedFromUrl;
          }

          if (currentId && nextMessages.some((message: SupportMessage) => message.id === currentId)) {
            return currentId;
          }

          return nextMessages[0]?.id ?? null;
        });
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadMessages();
    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [selectedFromUrl]);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      const matchesStatus = statusFilter === "all" || message.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || message.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [messages, priorityFilter, statusFilter]);

  const selectedMessage =
    filteredMessages.find((message) => message.id === selectedId) ??
    messages.find((message) => message.id === selectedId) ??
    null;

  useEffect(() => {
    setResponseMessage("");
    setResponseAttachments([]);
    setError("");
  }, [selectedId]);

  useEffect(() => {
    if (!selectedMessage || selectedMessage.adminSeenAt) {
      return;
    }

    const messageId = selectedMessage.id;
    let cancelled = false;

    async function markViewed() {
      setPendingAction("view");

      try {
        const response = await fetch(`/api/admin/support/${messageId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "mark-viewed",
          }),
        });
        const data = await response.json();

        if (!cancelled && data.success && data.message) {
          setMessages((currentMessages) =>
            currentMessages.map((message) =>
              message.id === messageId ? data.message : message
            )
          );
          window.dispatchEvent(new Event("admin-support-updated"));
        }
      } finally {
        if (!cancelled) {
          setPendingAction(null);
        }
      }
    }

    void markViewed();

    return () => {
      cancelled = true;
    };
  }, [selectedMessage]);

  async function updateMessage(
    messageId: string,
    payload: {
      status?: string;
      priority?: string;
      response?: string;
      attachments?: string[];
    }
  ) {
    setError("");

    const actionType =
      "response" in payload ? "reply" : "priority" in payload ? "priority" : "status";
    setPendingAction(actionType);

    try {
      const response = await fetch(`/api/admin/support/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!data.success || !data.message) {
        setError(data.error || "No se pudo actualizar el mensaje.");
        return;
      }

      setMessages((currentMessages) =>
        currentMessages.map((message) => (message.id === messageId ? data.message : message))
      );

      if ("response" in payload || "attachments" in payload) {
        setResponseMessage("");
        setResponseAttachments([]);
      }

      window.dispatchEvent(new Event("admin-support-updated"));
    } catch {
      setError("No se pudo actualizar el mensaje.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResponseAttachmentSelection(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    try {
      const availableSlots = Math.max(0, 4 - responseAttachments.length);

      if (availableSlots <= 0) {
        setError("Puedes adjuntar hasta 4 imagenes por respuesta.");
        return;
      }

      const nextAttachments = await Promise.all(
        Array.from(files)
          .slice(0, availableSlots)
          .map((file) => imageFileToDataUrl(file))
      );

      setResponseAttachments((currentAttachments) => [
        ...currentAttachments,
        ...nextAttachments,
      ]);
    } catch {
      setError("No se pudo cargar una de las imagenes.");
    } finally {
      if (responseAttachmentInputRef.current) {
        responseAttachmentInputRef.current.value = "";
      }
    }
  }

  const openCount = messages.filter((message) => message.status === "open").length;
  const inProgressCount = messages.filter((message) => message.status === "in_progress").length;
  const resolvedCount = messages.filter((message) => message.status === "resolved").length;

  return (
    <div className="space-y-6">
      <section className="rounded-[2.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_38%),linear-gradient(180deg,_#050816_0%,_#03050f_100%)] p-8 shadow-[0_24px_90px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Soporte</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Conversaciones reales de clientes
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Bandeja operativa para mensajes web y seguimiento en tiempo real desde el panel.
            </p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-[#0a1020] px-5 py-4 text-sm text-slate-300">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Telefono Suriname</p>
            <p className="mt-2 font-semibold text-white">{SUPPORT_PHONE}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-rose-500/20 bg-[#13070b] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-sm text-rose-200">Abiertos</p>
          <p className="mt-3 text-4xl font-semibold text-white">{openCount}</p>
        </div>
        <div className="rounded-[2rem] border border-blue-500/20 bg-[#06101b] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-sm text-blue-200">En progreso</p>
          <p className="mt-3 text-4xl font-semibold text-white">{inProgressCount}</p>
        </div>
        <div className="rounded-[2rem] border border-emerald-500/20 bg-[#05110d] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <p className="text-sm text-emerald-200">Resueltos</p>
          <p className="mt-3 text-4xl font-semibold text-white">{resolvedCount}</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-800 bg-[#050816] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="grid gap-3 lg:grid-cols-2">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | SupportMessage["status"])
                }
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="all">Todos los estados</option>
                <option value="open">Abiertos</option>
                <option value="in_progress">En progreso</option>
                <option value="resolved">Resueltos</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as "all" | SupportMessage["priority"])
                }
                className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="all">Todas las prioridades</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="px-8 py-16 text-center text-sm uppercase tracking-[0.3em] text-slate-500">
              Cargando soporte
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <p className="text-lg font-medium text-white">No hay mensajes para mostrar.</p>
            </div>
          ) : (
            <div className="max-h-[72vh] divide-y divide-slate-800 overflow-y-auto">
              {filteredMessages.map((message) => {
                const unread =
                  !message.adminSeenAt &&
                  message.chatEntries[message.chatEntries.length - 1]?.sender === "customer";

                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => setSelectedId(message.id)}
                    className={`w-full px-6 py-5 text-left transition ${
                      selectedMessage?.id === message.id ? "bg-[#0a1020]" : "hover:bg-[#090e1b]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {unread ? (
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                          ) : null}
                          <p className="truncate text-base font-semibold text-white">
                            {message.subject}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {message.customerName} | {message.customerEmail}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${statusTone(
                          message.status
                        )}`}
                      >
                        {message.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                      <span className={`rounded-full border px-2 py-1 ${priorityTone(message.priority)}`}>
                        {message.priority}
                      </span>
                      <span>{message.source}</span>
                      {message.orderId ? <span>{message.orderId}</span> : null}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                      {message.chatEntries[message.chatEntries.length - 1]?.message || message.message}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <section className="rounded-[2rem] border border-slate-800 bg-[#050816] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          {selectedMessage ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Detalle</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                    {selectedMessage.subject}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">{selectedMessage.id}</p>
                </div>
                {selectedMessage.orderId ? (
                  <Link
                    href={`/admin/orders/${selectedMessage.orderId}`}
                    className="rounded-2xl border border-slate-700 bg-[#0a1020] px-4 py-3 text-sm font-semibold text-white transition hover:border-cyan-500"
                  >
                    Abrir orden
                  </Link>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Cliente</p>
                  <p className="mt-3 text-base font-semibold text-white">
                    {selectedMessage.customerName}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">{selectedMessage.customerEmail}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedMessage.customerPhone || "Sin telefono"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Origen</p>
                  <p className="mt-3 text-base font-semibold capitalize text-white">
                    {selectedMessage.source}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Creado: {formatDate(selectedMessage.createdAt)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Actualizado: {formatDate(selectedMessage.updatedAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Conversacion</p>
                  {pendingAction === "view" ? (
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Actualizando lectura...
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {selectedMessage.chatEntries.map((entry) => {
                    const isSupport = entry.sender === "support";

                    return (
                      <div
                        key={entry.id}
                        className={`flex ${isSupport ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-[1.5rem] px-4 py-3 text-sm leading-6 ${
                            isSupport
                              ? "border border-slate-800 bg-[#050816] text-slate-200"
                              : "bg-cyan-500 text-slate-950"
                          }`}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">
                            {entry.senderName}
                          </p>
                          <p className="mt-1 whitespace-pre-line">{entry.message}</p>
                          {entry.attachments?.length ? (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {entry.attachments.map((attachment) => (
                                <a
                                  key={attachment}
                                  href={attachment}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="relative block overflow-hidden rounded-xl border border-white/10"
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
                          <p className="mt-2 text-[11px] opacity-75">
                            {formatDate(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Estado</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["open", "in_progress", "resolved"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => void updateMessage(selectedMessage.id, { status })}
                        disabled={pendingAction !== null}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                          selectedMessage.status === status
                            ? "bg-cyan-500 text-slate-950"
                            : "border border-slate-700 bg-[#050816] text-white hover:border-cyan-500"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Prioridad</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["high", "medium", "low"] as const).map((priority) => (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => void updateMessage(selectedMessage.id, { priority })}
                        disabled={pendingAction !== null}
                        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                          selectedMessage.priority === priority
                            ? "bg-emerald-500 text-slate-950"
                            : "border border-slate-700 bg-[#050816] text-white hover:border-emerald-500"
                        }`}
                      >
                        {priority}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-800 bg-[#0a1020] p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Responder</p>
                <div className="mt-4 space-y-3">
                  {responseAttachments.length ? (
                    <div className="grid grid-cols-4 gap-2">
                      {responseAttachments.map((attachment, index) => (
                        <div
                          key={`${attachment}-${index}`}
                          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#050816]"
                        >
                          <div className="relative h-20 w-full">
                            <Image
                              src={attachment}
                              alt="Vista previa"
                              fill
                              sizes="96px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setResponseAttachments((currentAttachments) =>
                                currentAttachments.filter((_, attachmentIndex) => attachmentIndex !== index)
                              )
                            }
                            className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition after:text-[11px] after:font-bold after:leading-none after:content-['x'] hover:bg-black/75"
                            aria-label="Quitar adjunto"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    value={responseMessage}
                    onChange={(event) => setResponseMessage(event.target.value)}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-700 bg-[#050816] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="Escribe la respuesta que vera el cliente en el chat"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      ref={responseAttachmentInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      multiple
                      className="hidden"
                      onChange={(event) => void handleResponseAttachmentSelection(event.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => responseAttachmentInputRef.current?.click()}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-[#050816] text-white transition hover:border-cyan-400 hover:text-cyan-200"
                      aria-label="Adjuntar imagen"
                      title="Adjuntar imagen"
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
                      onClick={() =>
                        void updateMessage(selectedMessage.id, {
                          response: responseMessage,
                          attachments: responseAttachments,
                        })
                      }
                      disabled={
                        pendingAction !== null ||
                        (responseMessage.trim().length < 2 && responseAttachments.length === 0)
                      }
                      className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {pendingAction === "reply" ? "Enviando..." : "Enviar respuesta"}
                    </button>
                  </div>
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-medium text-white">Selecciona un mensaje para revisarlo.</p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
