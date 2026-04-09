"use client";

import { useEffect, useState } from "react";
import { Badge, BarList, Card, Metric, Text } from "@tremor/react";
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
    {
      gnn_metadata: {
        label_multiclass: "Shellcode",
        label_binary: 1,
        confidence_score: 0.99,
      },
      network_data: { protocol: 6 },
    },
    {
      gnn_metadata: {
        label_multiclass: "Fuzzers",
        label_binary: 1,
        confidence_score: 0.95,
      },
      network_data: { protocol: 6 },
    },
    {
      gnn_metadata: {
        label_multiclass: "Analysis",
        label_binary: 1,
        confidence_score: 0.93,
      },
      network_data: { protocol: 17 },
    },
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

const MADRID_TIME_ZONE = "Europe/Madrid";

const formatMadridTime = (value?: string) => {
  if (!value) return "--:--:--";
  try {
    return new Date(value).toLocaleTimeString("es-ES", { hour12: false, timeZone: MADRID_TIME_ZONE });
  } catch {
    return new Date(value).toLocaleTimeString("es-ES", { hour12: false });
  }
};

const normalizeTrafficPoint = (point: any): TrafficPoint => ({
  tiempo: String(point?.tiempo ?? "Ventana"),
  "Tráfico Normal": Number(point?.["Tráfico Normal"] ?? point?.trafico_normal ?? 0),
  "Tráfico Anómalo": Number(point?.["Tráfico Anómalo"] ?? point?.trafico_anomalo ?? 0),
});

const calculateLatencyAverage = (latencies: number[]) => {
  if (!latencies.length) {
    return 0;
  }

  return latencies.reduce((sum, value) => sum + Number(value || 0), 0) / latencies.length;
};

const normalizeProtocol = (protocol?: number) => {
  switch (Number(protocol)) {
    case 1:
      return "ICMP";
    case 6:
      return "TCP";
    case 17:
      return "UDP";
    default:
      return "OTHER";
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

  if (timestamps.length < 2) {
    return 0;
  }

  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const minutes = (max - min) / 60_000;
  if (minutes <= 0) {
    return 0;
  }

  return alerts.length / minutes;
};

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
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as StatsResponse;
        if (active) {
          setData(json);
          setError(null);
        }
      } catch (fetchError) {
        if (active) {
          setError("No se pudieron cargar las métricas de telemetría.");
        }
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
  const protocolPieData = protocolTotal > 0 ? protocolChartData.filter((entry) => entry.value > 0) : [{ name: "Sin datos", value: 1, color: "#334155" }];

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
  const lastUpdate = data.metrics?.last_update ? formatMadridTime(data.metrics.last_update) : "Sin actualización";
  const tokenUnitLabel = `${formatCurrency(COST_PER_1K_TOKENS_USD)} / 1k tokens`;

  return (
    <div className="min-h-screen bg-black px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge color={engineStatus === "COMPLETED" ? "green" : "orange"} size="xs">
              Motor {engineStatus === "COMPLETED" ? "Operativo" : engineStatus}
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">Telemetría SOC</h1>
              <Text className="mt-2 max-w-2xl text-sm text-zinc-400">
                Monitor de latencia operativa y costes estimados de tokens.
              </Text>
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-4 text-right">
            <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Última actualización</Text>
            <p className="mt-1 font-mono text-sm text-white">{lastUpdate}</p>
          </div>
        </header>

        {error ? (
          <Card className="border border-red-500/20 bg-red-500/5 ring-0">
            <Text className="text-red-300">{error}</Text>
          </Card>
        ) : null}

        <Card className="border border-white/5 bg-white/5 ring-0">
          <Text className="text-sm text-zinc-400">
            Métricas analíticas basadas en el histórico acumulado del motor.
          </Text>
        </Card>

        <Card className="border border-hyper-border bg-hyper-surface ring-0">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-5">
            <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Rendimiento Histórico</Text>
            <h2 className="text-2xl font-semibold text-white">KPIs operativos</h2>
            <Text className="text-sm text-zinc-400">Ventana de Observación: {formatNumber(observationCycles)} ciclos.</Text>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
              <Text className="text-zinc-400">Total Alertas</Text>
              <Metric className="mt-3 text-white">{formatNumber(totalAlerts)}</Metric>
              <Text className="mt-2 text-xs text-zinc-500">Acumuladas por el motor.</Text>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
              <Text className="text-zinc-400">Alertas/Minuto</Text>
              <Metric className="mt-3 text-white">{alertsPerMinute > 0 ? alertsPerMinute.toFixed(2) : "--"}</Metric>
              <Text className="mt-2 text-xs text-zinc-500">Estimado desde timestamps.</Text>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
              <Text className="text-zinc-400">Reducción de Ruido</Text>
              <Metric className="mt-3 text-white">{compressionRate.toFixed(2)}%</Metric>
              <Text className="mt-2 text-xs text-zinc-500">Compresión reportada por el motor.</Text>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
              <Text className="text-zinc-400">Latencia Media</Text>
              <Metric className="mt-3 text-white">{avgLatency.toFixed(2)} ms</Metric>
              <Text className="mt-2 text-xs text-zinc-500">Promedio en la ventana visible.</Text>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
              <Text className="text-zinc-400">Volumen Procesado</Text>
              <Metric className="mt-3 text-white">{formatNumber(dataVolume)}</Metric>
              <Text className="mt-2 text-xs text-zinc-500">Suma de tráfico normal + anómalo.</Text>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-hyper-border bg-hyper-surface ring-0">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-5">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Latencia vs Tiempo</Text>
              <h2 className="text-2xl font-semibold text-white">Histórico reciente</h2>
              <Text className="text-sm text-zinc-400">Ventana de Observación: {formatNumber(observationCycles)} ciclos.</Text>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {HISTORY_RANGE_OPTIONS.map((option) => {
                const active = historyRange === option;
                const label = option === "all" ? "Todo el histórico" : `Últimas ${option}`;

                return (
                  <button
                    key={String(option)}
                    type="button"
                    onClick={() => setHistoryRange(option)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
                      active
                        ? "border-hyper-accent bg-hyper-accent/20 text-white shadow-[0_0_18px_rgba(249,115,22,0.25)]"
                        : "border-white/10 bg-black/40 text-zinc-400 hover:border-hyper-accent/40 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
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
                        cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                        contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px" }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any) => [`${Number(value).toFixed(2)} ms`, "Latencia"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="latencia_ms"
                        stroke="#f97316"
                        strokeWidth={2}
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
          </Card>

          <Card className="border border-hyper-border bg-hyper-surface ring-0">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-5">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Distribución de Protocolos</Text>
              <h2 className="text-2xl font-semibold text-white">Donut de Protocolos</h2>
              <Text className="text-sm text-zinc-400">Conteo sobre alertas recibidas.</Text>
            </div>

            <div className="mt-6 h-80 w-full min-w-0 relative">
              {isClient ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={protocolPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={96}
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
                      contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-xl border border-white/5 bg-black/30" />
              )}

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-mono text-white">{formatNumber(protocolTotal)}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Eventos</span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {protocolChartData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-zinc-300">{entry.name}</span>
                  </div>
                  <span className="font-mono text-white">{entry.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-hyper-border bg-hyper-surface ring-0">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-5">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Costes de Tokens</Text>
              <h2 className="text-2xl font-semibold text-white">Estimación operativa</h2>
              <Text className="text-sm text-zinc-400">Modelo mock: {tokenUnitLabel}.</Text>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
                <Text className="text-zinc-400">Tokens totales</Text>
                <Metric className="mt-3 text-white">{formatNumber(totalTokens)}</Metric>
              </div>
              <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
                <Text className="text-zinc-400">Coste estimado</Text>
                <Metric className="mt-3 text-white">{formatCurrency(totalTokenCost)}</Metric>
              </div>
            </div>

            <div className="mt-6">
              <Text className="text-xs uppercase tracking-[0.25em] text-zinc-500">Top costes por tipo</Text>
              <BarList
                data={tokenCostItems}
                className="mt-3"
                valueFormatter={(value) => formatCurrency(Number(value))}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
