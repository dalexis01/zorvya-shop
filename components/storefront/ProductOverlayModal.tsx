"use client";

import { useRouter } from "next/navigation";

export default function ProductOverlayModal({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Cerrar producto"
        onClick={() => router.back()}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      <div className="absolute inset-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-slate-800 bg-[#02030a] shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
          {children}
        </div>
      </div>
    </div>
  );
}
