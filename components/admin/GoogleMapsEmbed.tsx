"use client";

type Stop = {
  stopNumber: number;
  name: string;
  address: string;
};

type Props = {
  stops: Stop[];
  storeAddress: string;
  apiKey: string;
};

export default function GoogleMapsEmbed({ stops, storeAddress, apiKey }: Props) {
  if (!apiKey || stops.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[1.25rem] border border-dashed border-slate-700 text-xs uppercase tracking-[0.25em] text-slate-500">
        Sin paradas para mostrar
      </div>
    );
  }

  const last = stops[stops.length - 1];
  const middle = stops.slice(0, -1);

  // Build URL manually — URLSearchParams encodes "|" as "%7C" which breaks
  // the waypoints separator required by the Maps Embed API
  const enc = encodeURIComponent;
  const parts = [
    `key=${enc(apiKey)}`,
    `origin=${enc(storeAddress)}`,
    `destination=${enc(last.address)}`,
    `mode=driving`,
    `language=es`,
    `region=SR`,
  ];

  if (middle.length > 0) {
    // Each address is encoded individually; "|" separator is left as-is
    parts.push(`waypoints=${middle.map((s) => enc(s.address)).join("|")}`);
  }

  const src = `https://www.google.com/maps/embed/v1/directions?${parts.join("&")}`;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "380px" }}>
      <iframe
        key={src}
        src={src}
        title="Mapa de ruta"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
          borderRadius: "1.25rem",
          display: "block",
        }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
