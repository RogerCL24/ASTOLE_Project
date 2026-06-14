"use client";

import { useEffect, useRef, useState } from "react";
import { BarList } from "@tremor/react";
import { motion, useInView } from "framer-motion";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Database, Gauge, Layers, ShieldCheck, Zap } from "lucide-react";
import ShinyText from "@/components/ui/ShinyText";
import SpotlightCard from "@/components/ui/SpotlightCard";
import TiltedCard from "@/components/ui/TiltedCard";
import Magnetic from "@/components/ui/Magnetic";

const POLL_INTERVAL_MS = 2000;
const MAX_LATENCY_POINTS = 120;
const COST_PER_1K_TOKENS_USD = 0.002;
const PROTOCOL_COLORS = ["#f97316", "#f59e0b", "#eab308", "#94a3b8"];

const HISTORY_RANGE_OPTIONS = [MAX_LATENCY_POINTS, "all"] as const;
type HistoryRangeOption = (typeof HISTORY_RANGE_OPTIONS)[number];

const seedTraffic = [
  { tiempo: "T-20", "Tráfico Normal": 230, "Tráfico Anómalo": 10 },
  { tiempo: "T-19", "Tráfico Normal": 250, "Tráfico Anómalo": 15 },
  { tiempo: "T-18", "Tráfico Normal": 210, "Tráfico Anómalo": 25 },
  { tiempo: "T-17", "Tráfico Normal": 280, "Tráfico Anómalo": 180 },
  { tiempo: "T-16", "Tráfico Normal": 240, "Tráfico Anómalo": 320 },
  { tiempo: "T-15", "Tráfico Normal": 220, "Tráfico Anómalo": 150 },
  { tiempo: "T-14", "Tráfico Normal": 260, "Tráfico Anómalo": 40 },
  { tiempo: "T-13", "Tráfico Normal": 245, "Tráfico Anómalo": 30 },
  { tiempo: "T-12", "Tráfico Normal": 255, "Tráfico Anómalo": 22 },
  { tiempo: "T-11", "Tráfico Normal": 235, "Tráfico Anómalo": 18 },
  { tiempo: "T-10", "Tráfico Normal": 275, "Tráfico Anómalo": 60 },
  { tiempo: "T-9", "Tráfico Normal": 265, "Tráfico Anómalo": 35 },
  { tiempo: "T-8", "Tráfico Normal": 225, "Tráfico Anómalo": 28 },
  { tiempo: "T-7", "Tráfico Normal": 255, "Tráfico Anómalo": 24 },
  { tiempo: "T-6", "Tráfico Normal": 240, "Tráfico Anómalo": 40 },
  { tiempo: "T-5", "Tráfico Normal": 230, "Tráfico Anómalo": 55 },
  { tiempo: "T-4", "Tráfico Normal": 250, "Tráfico Anómalo": 42 },
  { tiempo: "T-3", "Tráfico Normal": 260, "Tráfico Anómalo": 36 },
  { tiempo: "T-2", "Tráfico Normal": 248, "Tráfico Anómalo": 50 },
  { tiempo: "T-1", "Tráfico Normal": 258, "Tráfico Anómalo": 30 },
];

type TrafficPoint = {
  tiempo: string;
  "Tráfico Normal": number;
  "Tráfico Anómalo": number;
  trafico_normal?: number;
  trafico_anomalo?: number;
};

type AlertEntry = {
  timestamp?: string;
  gnn_metadata?: {
    label_multiclass?: string;
    label_binary?: number;
    confidence_score?: number;
  };
  network_data?: {
    protocol?: number;
  };
  metadata?: {
    tokens_used?: {
      total?: number;
    };
  };
};

type StatsResponse = {
  metrics?: {
    last_update?: string;
    status?: string;
    performance?: {
      windows_processed?: number;
      total_flows_analyzed?: number;
      total_alerts_triggered?: number;
      avg_latency_ms?: number;
      compression_rate_percent?: number;
      traffic_history?: TrafficPoint[];
      latency_history_ms?: number[];
    };
  };
  alerts?: AlertEntry[];
};

const fallbackData: StatsResponse = {
  metrics: {
    last_update: "2026-03-19T17:29:25Z",
    status: "COMPLETED",
    performance: {
      windows_processed: 100,
      total_flows_analyzed: 48387,
      total_alerts_triggered: 83,
      avg_latency_ms: 1.47,
      compression_rate_percent: 99.8285,
      traffic_history: seedTraffic,
      latency_history_ms: Array.from({ length: 20 }, (_, index) => 1.1 + index * 0.03),
    },
  },
  alerts: [
    { gnn_metadata: { label_multiclass: "Shellcode", label_binary: 1, confidence_score: 0.99 }, network_data: { protocol: 6 } },
    { gnn_metadata: { label_multiclass: "Fuzzers", label_binary: 1, confidence_score: 0.95 }, network_data: { protocol: 6 } },
    { gnn_metadata: { label_multiclass: "Analysis", label_binary: 1, confidence_score: 0.93 }, network_data: { protocol: 17 } },
  ],
};

const formatNumber = (value: number) => new Intl.NumberFormat("es-ES").format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);

const formatRelativeTime = (value?: string): string => {
  if (!value) return "--";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "--";
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 1) return "ahora";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `hace ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  return `hace ${Math.floor(hr / 24)}d`;
};

const formatRelativeWindow = (label: string): string => {
  const match = /^T-(\d+)$/.exec(label);
  if (!match) return label;
  const n = Number(match[1]);
  if (n === 0) return "ahora";
  return `hace ${n}s`;
};

const normalizeTrafficPoint = (point: any): TrafficPoint => ({
  tiempo: String(point?.tiempo ?? "Ventana"),
  "Tráfico Normal": Number(point?.["Tráfico Normal"] ?? point?.trafico_normal ?? 0),
  "Tráfico Anómalo": Number(point?.["Tráfico Anómalo"] ?? point?.trafico_anomalo ?? 0),
});

const calculateLatencyAverage = (latencies: number[]) => {
  if (!latencies.length) return 0;
  return latencies.reduce((sum, value) => sum + Number(value || 0), 0) / latencies.length;
};

const normalizeProtocol = (protocol?: number) => {
  switch (Number(protocol)) {
    case 1: return "ICMP";
    case 6: return "TCP";
    case 17: return "UDP";
    default: return "OTHER";
  }
};

const buildProtocolDistribution = (alerts: AlertEntry[]) => {
  const counts = alerts.reduce((acc: Record<string, number>, alert) => {
    const protocolName = normalizeProtocol(alert?.network_data?.protocol);
    acc[protocolName] = (acc[protocolName] || 0) + 1;
    return acc;
  }, {});

  const ordered = ["TCP", "UDP", "ICMP", "OTHER"];

  return ordered.map((name, index) => ({
    name,
    value: counts[name] ?? 0,
    color: PROTOCOL_COLORS[index % PROTOCOL_COLORS.length],
  }));
};

const calculateAlertsPerMinute = (alerts: AlertEntry[]) => {
  const timestamps = alerts
    .map((alert) => (typeof alert?.timestamp === "string" ? Date.parse(alert.timestamp) : NaN))
    .filter((value) => Number.isFinite(value)) as number[];

  if (timestamps.length < 2) return 0;

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const minutes = (max - min) / 60_000;
  if (minutes <= 0) return 0;

  return alerts.length / minutes;
};

/* ============================================================
   Animated number — smoothly transitions on each value change.
   ============================================================ */
function useAnimatedNumber(target: number, durationMs = 1200, startWhen = true) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (!startWhen) return;
    let raf = 0;
    const start = performance.now();
    const from = fromRef.current;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      fromRef.current = target;
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, startWhen]);
  return value;
}

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  target: number;
  suffix?: string;
  format?: "comma" | "decimal2";
  caption: string;
  index: number;
};

function KpiCard({ icon, label, target, suffix, format = "comma", caption, index }: KpiCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: false, amount: 0.3 });
  const animated = useAnimatedNumber(target, 1200, inView);
  const display =
    format === "decimal2"
      ? animated.toFixed(2)
      : new Intl.NumberFormat("es-ES").format(Math.round(animated));

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08 }}
    >
      <SpotlightCard className="h-full rounded-2xl border border-white/5 bg-black/40 p-5 transition-colors hover:border-hyper-accent/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">{label}</span>
          <span className="text-hyper-accent">{icon}</span>
        </div>
        <div className="mt-4 font-mono text-4xl font-black text-white tabular-nums leading-none drop-shadow-[0_0_18px_rgba(209,132,0,0.35)]">
          {display}
          {suffix ? <span className="text-hyper-accent">{suffix}</span> : null}
        </div>
        <p className="mt-3 text-xs text-zinc-400">{caption}</p>
      </SpotlightCard>
    </motion.div>
  );
}

const dotMeshOverlayClass =
  "pointer-events-none absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:18px_18px]";

export default function TelemetriaPage() {
  const [data, setData] = useState<StatsResponse>(fallbackData);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [historyRange, setHistoryRange] = useState<HistoryRangeOption>(MAX_LATENCY_POINTS);

  useEffect(() => {
    setIsClient(true);
    let active = true;

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = (await response.json()) as StatsResponse;
        if (active) {
          setData(json);
          setError(null);
        }
      } catch {
        if (active) setError("No se pudieron cargar las métricas de telemetría.");
      }
    };

    fetchStats();
    const interval = window.setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const performance = data.metrics?.performance ?? fallbackData.metrics?.performance ?? {};
  const trafficHistory = (performance.traffic_history ?? seedTraffic).map(normalizeTrafficPoint);
  const latencyHistory = performance.latency_history_ms ?? fallbackData.metrics?.performance?.latency_history_ms ?? [];
  const alerts = (Array.isArray(data.alerts) ? data.alerts : fallbackData.alerts ?? []) as AlertEntry[];

  const alignedPoints =
    historyRange === "all"
      ? Math.min(trafficHistory.length, latencyHistory.length)
      : Math.min(trafficHistory.length, latencyHistory.length, MAX_LATENCY_POINTS);

  const trafficSlice = alignedPoints > 0 ? trafficHistory.slice(-alignedPoints) : [];
  const latencySlice = alignedPoints > 0 ? latencyHistory.slice(-alignedPoints) : [];
  const latencyChartData = latencySlice.map((value, index) => ({
    tiempo: trafficSlice[index]?.tiempo ?? `T-${alignedPoints - 1 - index}`,
    latencia_ms: Number(value ?? 0),
  }));

  const observationCycles = Number(performance.windows_processed ?? alignedPoints);
  const avgLatency = calculateLatencyAverage(latencySlice);
  const dataVolume = trafficSlice.reduce(
    (sum, point) => sum + Number(point["Tráfico Normal"] ?? 0) + Number(point["Tráfico Anómalo"] ?? 0),
    0
  );

  const protocolChartData = buildProtocolDistribution(alerts);
  const protocolTotal = protocolChartData.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
  const protocolPieData =
    protocolTotal > 0
      ? protocolChartData.filter((entry) => entry.value > 0)
      : [{ name: "Sin datos", value: 1, color: "#334155" }];

  const totalAlerts = Number(performance.total_alerts_triggered ?? alerts.length);
  const alertsPerMinute = calculateAlertsPerMinute(alerts);
  const compressionRate = Number(performance.compression_rate_percent ?? 0);

  const tokenTotalsByLabel = alerts.reduce((acc: Record<string, number>, alert) => {
    const label = alert?.gnn_metadata?.label_multiclass ?? "Unknown";
    const tokens = Number(alert?.metadata?.tokens_used?.total ?? 0);
    acc[label] = (acc[label] || 0) + tokens;
    return acc;
  }, {});

  const tokenCostItems = Object.entries(tokenTotalsByLabel)
    .map(([label, tokens]) => {
      const cost = (Number(tokens) / 1000) * COST_PER_1K_TOKENS_USD;
      return { name: label, value: cost };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const totalTokens = Object.values(tokenTotalsByLabel).reduce((sum, tokens) => sum + Number(tokens || 0), 0);
  const totalTokenCost = (totalTokens / 1000) * COST_PER_1K_TOKENS_USD;
  const engineStatus = data.metrics?.status ?? "UNKNOWN";
  const isOperative = engineStatus === "COMPLETED" || engineStatus === "RUNNING";
  const lastUpdate = data.metrics?.last_update ? formatRelativeTime(data.metrics.last_update) : "Sin actualización";
  const tokenUnitLabel = `${formatCurrency(COST_PER_1K_TOKENS_USD)} / 1k tokens`;

  return (
    <div className="min-h-screen bg-black px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        {/* ===== HERO ===== */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isOperative ? "animate-ping bg-green-400" : "bg-red-400"
                  }`}
                />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${isOperative ? "bg-green-500" : "bg-red-500"}`} />
              </span>
              <ShinyText className="text-[11px] font-bold uppercase tracking-[0.3em]">
                {isOperative ? "Motor operativo" : `Motor ${engineStatus}`}
              </ShinyText>
            </div>

            <h1 className="text-5xl font-black tracking-tighter text-white lg:text-7xl">
              TELEMETRÍA SOC
            </h1>
            <p className="max-w-2xl text-base text-zinc-400">
              Monitor en tiempo real de latencia, tráfico y coste de inferencia. Polling cada {(POLL_INTERVAL_MS / 1000).toFixed(0)}s ·
              ventana de {formatNumber(observationCycles)} ciclos.
            </p>
          </div>

          <Magnetic strength={0.18}>
            <div className="rounded-2xl border border-hyper-accent/30 bg-hyper-accent/5 px-5 py-4 text-right shadow-[0_0_30px_rgba(209,132,0,0.15)]">
              <p className="text-[11px] uppercase tracking-[0.3em] text-hyper-accent">Última actualización</p>
              <p className="mt-2 font-mono text-2xl font-bold text-white">{lastUpdate}</p>
            </div>
          </Magnetic>
        </motion.header>

        {error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 backdrop-blur-sm"
          >
            <p className="text-sm text-red-300">{error}</p>
          </motion.div>
        ) : null}

        {/* ===== SECTION 01 · KPIs ===== */}
        <section className="space-y-6">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.4em] text-hyper-accent">· 01 ·</span>
            <h2 className="text-2xl font-bold text-white">KPIs operativos</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Total Alertas"
              target={totalAlerts}
              caption="Acumuladas por el motor."
              index={0}
            />
            <KpiCard
              icon={<Activity className="h-5 w-5" />}
              label="Alertas/Minuto"
              target={alertsPerMinute}
              format="decimal2"
              caption="Estimado desde timestamps."
              index={1}
            />
            <KpiCard
              icon={<Layers className="h-5 w-5" />}
              label="Reducción de Ruido"
              target={compressionRate}
              suffix="%"
              format="decimal2"
              caption="Compresión reportada."
              index={2}
            />
            <KpiCard
              icon={<Gauge className="h-5 w-5" />}
              label="Latencia Media"
              target={avgLatency}
              suffix=" ms"
              format="decimal2"
              caption="Promedio en ventana visible."
              index={3}
            />
            <KpiCard
              icon={<Database className="h-5 w-5" />}
              label="Volumen Procesado"
              target={dataVolume}
              caption="Tráfico normal + anómalo."
              index={4}
            />
          </div>
        </section>

        {/* ===== SECTION 02 · Latencia + Protocolos ===== */}
        <section className="space-y-6">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.4em] text-hyper-accent">· 02 ·</span>
            <h2 className="text-2xl font-bold text-white">Comportamiento del motor</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TiltedCard
              maxTilt={4}
              perspective={1400}
              scale={1.01}
              className="relative overflow-hidden rounded-2xl border border-hyper-border bg-hyper-surface p-6"
            >
              <div className={dotMeshOverlayClass} />
              <div className="relative">
                <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
                  <span className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Latencia vs Tiempo</span>
                  <h3 className="text-xl font-bold text-white">Histórico reciente</h3>
                  <p className="text-sm text-zinc-400">{formatNumber(observationCycles)} ciclos analizados.</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {HISTORY_RANGE_OPTIONS.map((option) => {
                    const active = historyRange === option;
                    const label = option === "all" ? "Todo el histórico" : `Últimas ${option}`;
                    return (
                      <Magnetic key={String(option)} strength={0.22}>
                        <button
                          type="button"
                          onClick={() => setHistoryRange(option)}
                          className={`rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                            active
                              ? "border-hyper-accent bg-hyper-accent/20 text-white shadow-[0_0_18px_rgba(209,132,0,0.35)]"
                              : "border-white/10 bg-black/40 text-zinc-300 hover:border-hyper-accent/40 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      </Magnetic>
                    );
                  })}
                </div>

                <div className="mt-6 overflow-x-auto">
                  <div className={`h-80 w-full ${historyRange === "all" ? "min-w-[2000px]" : ""}`}>
                    {isClient ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <LineChart data={latencyChartData}>
                          <XAxis dataKey="tiempo" hide />
                          <YAxis hide />
                          <Tooltip
                            cursor={{ stroke: "rgba(209,132,0,0.4)", strokeDasharray: "3 3" }}
                            contentStyle={{
                              backgroundColor: "#09090b",
                              borderColor: "#D18400",
                              borderRadius: "10px",
                              boxShadow: "0 0 24px rgba(209,132,0,0.25)",
                            }}
                            itemStyle={{ color: "#fff", fontWeight: 600 }}
                            labelStyle={{ color: "#D18400", fontWeight: 700 }}
                            labelFormatter={(label: any) => formatRelativeWindow(String(label))}
                            formatter={(value: any) => [`${Number(value).toFixed(2)} ms`, "Latencia"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="latencia_ms"
                            stroke="#D18400"
                            strokeWidth={2.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full rounded-xl border border-white/5 bg-black/30" />
                    )}
                  </div>
                </div>
              </div>
            </TiltedCard>

            <TiltedCard
              maxTilt={4}
              perspective={1400}
              scale={1.01}
              className="relative overflow-hidden rounded-2xl border border-hyper-border bg-hyper-surface p-6"
            >
              <div className={dotMeshOverlayClass} />
              <div className="relative">
                <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
                  <span className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Distribución</span>
                  <h3 className="text-xl font-bold text-white">Protocolos de alerta</h3>
                  <p className="text-sm text-zinc-400">Conteo sobre alertas recibidas.</p>
                </div>

                <div className="relative mt-6 h-80 w-full">
                  {isClient ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={protocolPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={104}
                          paddingAngle={6}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={6}
                          isAnimationActive={false}
                        >
                          {protocolPieData.map((entry) => (
                            <Cell key={entry.name} fill={(entry as any).color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#09090b",
                            borderColor: "#D18400",
                            borderRadius: "10px",
                            boxShadow: "0 0 24px rgba(209,132,0,0.25)",
                          }}
                          itemStyle={{ color: "#fff", fontWeight: 600 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full w-full rounded-xl border border-white/5 bg-black/30" />
                  )}

                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-4xl font-black text-white tabular-nums drop-shadow-[0_0_18px_rgba(209,132,0,0.4)]">
                      {formatNumber(protocolTotal)}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-widest text-zinc-400">Eventos</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {protocolChartData.map((entry) => (
                    <div
                      key={entry.name}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-sm transition-colors hover:border-hyper-accent/40"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}` }}
                        />
                        <span className="font-bold text-white">{entry.name}</span>
                      </div>
                      <span className="font-mono tabular-nums text-white">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </TiltedCard>
          </div>
        </section>

        {/* ===== SECTION 03 · Tokens ===== */}
        <section className="space-y-6">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.4em] text-hyper-accent">· 03 ·</span>
            <h2 className="text-2xl font-bold text-white">Coste de inferencia</h2>
          </div>

          <TiltedCard
            maxTilt={3}
            perspective={1600}
            scale={1.005}
            className="relative overflow-hidden rounded-2xl border border-hyper-border bg-hyper-surface p-6"
          >
            <div className={dotMeshOverlayClass} />
            <div className="relative">
              <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
                <span className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Tokens · Estimación</span>
                <h3 className="text-xl font-bold text-white">Coste por tipo de alerta</h3>
                <p className="text-sm text-zinc-400">Modelo mock · {tokenUnitLabel}.</p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <SpotlightCard className="rounded-2xl border border-white/5 bg-black/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Tokens totales</span>
                    <Zap className="h-5 w-5 text-hyper-accent" />
                  </div>
                  <p className="mt-4 font-mono text-4xl font-black text-white tabular-nums drop-shadow-[0_0_18px_rgba(209,132,0,0.35)]">
                    {formatNumber(totalTokens)}
                  </p>
                </SpotlightCard>
                <SpotlightCard className="rounded-2xl border border-white/5 bg-black/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Coste estimado</span>
                    <Zap className="h-5 w-5 text-hyper-accent" />
                  </div>
                  <p className="mt-4 font-mono text-4xl font-black text-white tabular-nums drop-shadow-[0_0_18px_rgba(209,132,0,0.35)]">
                    {formatCurrency(totalTokenCost)}
                  </p>
                </SpotlightCard>
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Top costes por tipo</p>
                <BarList
                  data={tokenCostItems}
                  className="mt-3"
                  valueFormatter={(value) => formatCurrency(Number(value))}
                />
              </div>
            </div>
          </TiltedCard>
        </section>
      </div>
    </div>
  );
}
