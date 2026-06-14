"use client";

import dynamic from "next/dynamic";
import { Badge } from "@tremor/react";

const AttackScene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
        Cargando escena 3D…
      </p>
    </div>
  ),
});

export default function Visualizacion3DPage() {
  return (
    <div className="min-h-screen bg-black px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge color="orange" size="xs">
              Escena en vivo · WebGL
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                Activo bajo ataque
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                Visualización 3D del servidor protegido recibiendo vectores de ataque desde múltiples
                orígenes. Arrastra para orbitar, scroll para zoom.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-4 text-right">
            <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Vectores activos</p>
            <p className="mt-1 font-mono text-sm text-white">8 fuentes hostiles</p>
          </div>
        </header>

        <div className="relative overflow-hidden rounded-3xl border border-hyper-border bg-black/60">
          <div className="absolute left-4 top-4 z-10 flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-hyper-accent">
              ASTOLE · Core
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              shield_status=ACTIVE · lat=1.47ms
            </span>
          </div>
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-white">
              Live attack
            </span>
          </div>

          <div className="h-[70vh] min-h-[480px] w-full">
            <AttackScene />
          </div>

          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/50 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-4">
              <Legend color="#D18400" label="Asset / Shield" />
              <Legend color="#ff4108" label="Vector hostil" />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
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
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white">{label}</span>
    </div>
  );
}
