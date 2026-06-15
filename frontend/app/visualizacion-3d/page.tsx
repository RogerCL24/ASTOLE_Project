"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@tremor/react";

const AttackScene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-hyper-muted">
        Cargando escena 3D…
      </p>
    </div>
  ),
});

/* Suscripción a la clase .dark del <html> (la pone/quita el layout
   con el toggle día/noche). Usamos MutationObserver para que la
   escena 3D se reconstruya y el Legend cambie de hex sin recargar. */
function useIsDark() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const html = document.documentElement;
    setIsDark(html.classList.contains("dark"));
    const obs = new MutationObserver(() =>
      setIsDark(html.classList.contains("dark"))
    );
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

export default function Visualizacion3DPage() {
  const isDark = useIsDark();
  /* Hex de marca por tema — coinciden con --color-hyper-accent / -alert
     del globals.css. Hardcoded aquí porque el Legend necesita el valor
     literal (style inline + boxShadow), no acepta var() en boxShadow. */
  const accentHex = isDark ? "#D18400" : "#92400e";
  const alertHex = isDark ? "#ff4108" : "#7f1d1d";

  return (
    <div className="min-h-screen bg-hyper-bg px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge color="orange" size="xs">
              Escena en vivo · WebGL
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-hyper-text lg:text-4xl">
                Activo bajo ataque
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-hyper-muted">
                Visualización 3D del servidor protegido recibiendo vectores de ataque desde múltiples
                orígenes. Arrastra para orbitar, scroll para zoom.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-hyper-border bg-hyper-surface px-4 py-4 text-right">
            <p className="text-[11px] uppercase tracking-[0.25em] text-hyper-muted">Vectores activos</p>
            <p className="mt-1 font-mono text-sm text-hyper-text">8 fuentes hostiles</p>
          </div>
        </header>

        <div className="relative overflow-hidden rounded-3xl border border-hyper-border bg-hyper-bg/60">
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-hyper-accent">
              ASTOLE · Core
            </span>
            <span className="font-mono text-[11px] text-hyper-muted">
              shield_status=ACTIVE · lat=1.47ms
            </span>
          </div>
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-hyper-text">
              Live attack
            </span>
          </div>

          <div className="h-[70vh] min-h-[480px] w-full">
            <AttackScene isDark={isDark} />
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hyper-border bg-hyper-surface/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-4">
              <Legend color={accentHex} label="Asset / Shield" />
              <Legend color={alertHex} label="Vector hostil" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-hyper-muted">
              Drag · Zoom · Auto-orbit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-hyper-text">{label}</span>
    </div>
  );
}
