"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Sidebar() {
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
        if (!raw) {
          setSpeedLabel("1x");
          return;
        }
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
      if (event.key === SPEED_STORAGE_KEY) {
        syncSpeedFromStorage();
      }
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
        if (engineStatus === "STOPPED") {
          setStatus("INACTIVO");
          return;
        }
        if (engineStatus === "COMPLETED") {
          setStatus("FINALIZADO");
          return;
        }
        if (engineStatus === "RUNNING") {
          setStatus(isFresh ? "ACTIVO" : "INACTIVO");
          return;
        }

        setStatus(isFresh ? "ACTIVO" : "INACTIVO");
      } catch (e) {
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

  const getLinkClass = (path: string) =>
    `transition-colors flex items-center gap-3 text-lg ${pathname === path ? 'text-white font-bold' : 'text-zinc-400 hover:text-white'}`;

  const getDotClass = (path: string) =>
    `w-4 h-4 rounded-full transition-all ${pathname === path ? 'bg-hyper-accent shadow-[0_0_10px_#f97316]' : 'bg-zinc-700'}`;

  return (
    <nav className="w-72 border-r border-hyper-border bg-hyper-surface p-6 flex flex-col justify-between fixed top-0 left-0 h-screen z-20">
      <div>
        <div className="mb-10">
          <h1 className="text-xl font-bold tracking-widest text-white uppercase">Astole</h1>
          <p className="text-[10px] text-hyper-accent mt-1 font-mono uppercase tracking-tighter">Powered by Hypergraph</p>
        </div>
        
        <ul className="space-y-6">
          <li>
            <Link href="/" className={getLinkClass('/')}>
              <span className={getDotClass('/')}></span>
              Triaje en Vivo (Capa 1)
            </Link>
          </li>
          <li>
            <Link href="/investigacion" className={getLinkClass('/investigacion')}>
              <span className={getDotClass('/investigacion')}></span>
              Chat RAG (Capa 2)
            </Link>
          </li>
          <li className="pt-6 mt-6 border-t border-white/5">
            <Link href="/telemetria" className={getLinkClass('/telemetria')}>
              <svg className={`w-6 h-6 ${pathname === '/telemetria' ? 'text-hyper-accent' : 'text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Telemetría & KPIs
            </Link>
          </li>
        </ul>
      </div>
      
      <div className="bg-white/5 rounded-lg p-4 border border-white/5">
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-2">Engine Status</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'ACTIVO' ? 'bg-green-400' : status === 'FINALIZADO' ? 'bg-amber-400' : 'bg-red-400'}`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${status === 'ACTIVO' ? 'bg-green-500' : status === 'FINALIZADO' ? 'bg-amber-500' : 'bg-red-500'}`}
            ></span>
          </span>
          <span className="text-[11px] font-mono">{status}</span>
        </div>
          <span className="text-[10px] font-mono text-zinc-400">{speedLabel}</span>
        </div>
      </div>
    </nav>
  );
}