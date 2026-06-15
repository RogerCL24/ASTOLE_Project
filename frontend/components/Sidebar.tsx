"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Recibimos isDark del layout para poder reaccionar al tema en clases dinámicas
interface SidebarProps {
  isDark?: boolean;
}

export default function Sidebar({ isDark = true }: SidebarProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState("Cargando...");
  const [speedLabel, setSpeedLabel] = useState("1x");

  const SPEED_STORAGE_KEY = "astole.simulation.speed";
  const SPEED_EVENT_NAME = "astole:speed";

  const formatSpeedLabel = (value: unknown) => {
    if (value === "MAX") return "MAX";
    const numeric = typeof value === "number" ? value : Number(value);
    if ([1, 2, 4].includes(numeric)) return `${numeric}x`;
    return "1x";
  };

  useEffect(() => {
    const syncSpeedFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(SPEED_STORAGE_KEY);
        if (!raw) { setSpeedLabel("1x"); return; }
        setSpeedLabel(formatSpeedLabel(JSON.parse(raw)));
      } catch {
        setSpeedLabel("1x");
      }
    };

    syncSpeedFromStorage();

    const onSpeedEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setSpeedLabel(formatSpeedLabel(detail));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === SPEED_STORAGE_KEY) syncSpeedFromStorage();
    };

    window.addEventListener(SPEED_EVENT_NAME, onSpeedEvent as EventListener);
    window.addEventListener("storage", onStorage);

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        const data = await res.json();
        const lastUpdateRaw = data?.metrics?.last_update;
        const lastUpdateMs = typeof lastUpdateRaw === 'string' ? Date.parse(lastUpdateRaw) : NaN;
        const ageMs = Number.isFinite(lastUpdateMs) ? Date.now() - lastUpdateMs : Number.POSITIVE_INFINITY;
        const isFresh = ageMs >= 0 && ageMs <= 30_000;

        const engineStatus = String(data?.metrics?.status ?? "UNKNOWN").toUpperCase();
        if (engineStatus === "STOPPED")   { setStatus("INACTIVO");  return; }
        if (engineStatus === "COMPLETED") { setStatus("FINALIZADO"); return; }
        if (engineStatus === "RUNNING")   { setStatus(isFresh ? "ACTIVO" : "INACTIVO"); return; }
        setStatus(isFresh ? "ACTIVO" : "INACTIVO");
      } catch {
        setStatus("OFFLINE");
      }
    };

    checkStatus();
    const interval = window.setInterval(checkStatus, 5000);

    return () => {
      window.removeEventListener(SPEED_EVENT_NAME, onSpeedEvent as EventListener);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, []);

  // ── Clases de enlace: activo vs inactivo, adaptadas al tema ──────────────
  // text-xl + whitespace-nowrap evita que los textos rompan en 2 líneas
  // durante la animación de expansión del sidebar.
  const getLinkClass = (path: string) =>
    `transition-colors flex items-center gap-4 text-2xl whitespace-nowrap ${
      pathname === path
        ? 'text-hyper-text font-bold'
        : 'text-hyper-muted hover:text-hyper-text'
    }`;

  // ── Dot indicador de sección activa ──────────────────────────────────────
  const getDotClass = (path: string) =>
    `w-5 h-5 rounded-full transition-all ${
      pathname === path
        ? 'bg-hyper-accent shadow-[0_0_10px_#D18400]'
        : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
    }`;

  // ── Clase del ícono SVG ───────────────────────────────────────────────────
  const getIconClass = (path: string) =>
    `w-7 h-7 ${pathname === path ? 'text-hyper-accent' : 'text-hyper-muted'}`;

  /* Sidebar colapsado a w-20 por defecto, expandido a w-72 con hover.
     - `group` permite que los textos hijos reaccionen a group-hover.
     - `overflow-hidden` recorta los textos que sobresalen durante la animación.
     - Los textos usan `opacity-0 group-hover:opacity-100` para fade-in suave;
       el `whitespace-nowrap` en getLinkClass evita que se rompan en 2 líneas
       mientras el ancho crece. */
  const textFade =
    "opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap";

  return (
    <nav
      className="group w-20 hover:w-72 transition-[width] duration-300 ease-out
                 border-r border-hyper-border bg-hyper-surface p-6 flex flex-col
                 justify-between fixed top-0 left-0 h-screen z-20 overflow-hidden"
    >
      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <div>
        <div className="mb-10">
          <h1 className={`text-3xl font-bold tracking-widest text-hyper-text uppercase ${textFade}`}>
            Astole
          </h1>
          <p className={`text-xs text-hyper-accent mt-1 font-mono uppercase tracking-tighter ${textFade}`}>
            Powered by Hypergraph
          </p>
        </div>

        {/* ── Navegación ───────────────────────────────────────────────── */}
        <ul className="space-y-6">
          <li>
            <Link href="/" className={getLinkClass('/')}>
              <span className={getDotClass('/')}></span>
              <span className={textFade}>Triaje en Vivo </span>
            </Link>
          </li>
          <li>
            <Link href="/investigacion" className={getLinkClass('/investigacion')}>
              <span className={getDotClass('/investigacion')}></span>
              <span className={textFade}>Chat RAG </span>
            </Link>
          </li>
          <li className="pt-6 mt-6 border-t border-hyper-border">
            <Link href="/telemetria" className={getLinkClass('/telemetria')}>
              <svg className={getIconClass('/telemetria')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className={textFade}>Telemetría &amp; KPIs</span>
            </Link>
          </li>
          <li>
            <Link href="/visualizacion-3d" className={getLinkClass('/visualizacion-3d')}>
              <svg className={getIconClass('/visualizacion-3d')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" />
              </svg>
              <span className={textFade}>Activo bajo ataque (3D)</span>
            </Link>
          </li>
        </ul>
      </div>

      {/* ── Panel de estado del motor ─────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="rounded-lg p-4 border border-hyper-border bg-hyper-bg/40">
          <p className={`text-[10px] text-hyper-muted uppercase tracking-widest mb-2 ${textFade}`}>
            Engine Status
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* El dot de estado queda visible siempre — único feedback cuando el menú está colapsado */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    status === 'ACTIVO'    ? 'bg-green-400' :
                    status === 'FINALIZADO' ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    status === 'ACTIVO'    ? 'bg-green-500' :
                    status === 'FINALIZADO' ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                />
              </span>
              <span className={`text-[11px] font-mono text-hyper-text ${textFade}`}>{status}</span>
            </div>
            <span className={`text-[10px] font-mono text-hyper-muted ${textFade}`}>{speedLabel}</span>
          </div>
        </div>
      </div>
    </nav>
  );
}
