"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Grid, Metric, ProgressBar, Text } from "@tremor/react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SLICER_OPTIONS = [20, 100, 1000, "all"] as const;
const PROTOCOL_COLORS = ["#f97316", "#f59e0b", "#eab308", "#94a3b8"];
const POLL_INTERVAL_MS = 5000;

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
  gnn_metadata?: {
    label_multiclass?: string;
    label_binary?: number;
    confidence_score?: number;
  };
  network_data?: {
    protocol?: number;
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

const normalizeTrafficPoint = (point: any): TrafficPoint => ({
  tiempo: String(point?.tiempo ?? "Ventana"),
  "Tráfico Normal": Number(point?.["Tráfico Normal"] ?? point?.trafico_normal ?? 0),
  "Tráfico Anómalo": Number(point?.["Tráfico Anómalo"] ?? point?.trafico_anomalo ?? 0),
});

const getSliceLimit = (range: (typeof SLICER_OPTIONS)[number]) => (range === "all" ? null : range);

const sliceFromEnd = <T,>(items: T[], limit: number | null) => {
  if (limit === null) {
    return items;
  }

  return items.slice(-limit);
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

  return ordered
    .filter((protocolName) => (counts[protocolName] ?? 0) > 0)
    .map((protocolName, index) => ({
      name: protocolName,
      value: counts[protocolName],
      color: PROTOCOL_COLORS[index % PROTOCOL_COLORS.length],
    }));
};

const calculateLatencyAverage = (latencies: number[]) => {
  if (!latencies.length) {
    return 0;
  }

  return latencies.reduce((sum, value) => sum + Number(value || 0), 0) / latencies.length;
};

const calculateCompressionRate = (traffic: TrafficPoint[]) => {
  const totalNormal = traffic.reduce((sum, point) => sum + Number(point["Tráfico Normal"] ?? 0), 0);
  const totalAnomalous = traffic.reduce((sum, point) => sum + Number(point["Tráfico Anómalo"] ?? 0), 0);
  const totalTraffic = totalNormal + totalAnomalous;

  if (totalTraffic <= 0) {
    return 0;
  }

  return (1 - totalAnomalous / totalTraffic) * 100;
};

export default function TelemetriaPage() {
  const [data, setData] = useState<StatsResponse>(fallbackData);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<(typeof SLICER_OPTIONS)[number]>(20);

  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats");
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
  const alerts = Array.isArray(data.alerts) ? data.alerts : fallbackData.alerts ?? [];

  const limit = getSliceLimit(selectedRange);
  const selectedTraffic = sliceFromEnd(trafficHistory, limit);
  const selectedLatencies = sliceFromEnd(latencyHistory, limit);
  const selectedAlerts = sliceFromEnd(alerts, limit);

  const selectedTrafficVolume = selectedTraffic.reduce(
    (sum, point) => sum + Number(point["Tráfico Normal"] ?? 0) + Number(point["Tráfico Anómalo"] ?? 0),
    0
  );
  const selectedAnomalyVolume = selectedTraffic.reduce((sum, point) => sum + Number(point["Tráfico Anómalo"] ?? 0), 0);
  const selectedCompressionRate = calculateCompressionRate(selectedTraffic);
  const selectedAvgLatency = calculateLatencyAverage(selectedLatencies);
  const selectedProcessTime = selectedLatencies.reduce((sum, value) => sum + Number(value || 0), 0);
  const selectedWindows = selectedTraffic.length;
  const protocolDistribution = buildProtocolDistribution(selectedAlerts);
  const protocolChartData = protocolDistribution.length
    ? protocolDistribution
    : [{ name: "Sin datos", value: 1, color: "#334155" }];

  const totalAlerts = performance.total_alerts_triggered ?? 0;
  const totalFlows = performance.total_flows_analyzed ?? 0;
  const engineStatus = data.metrics?.status ?? "UNKNOWN";
  const lastUpdate = data.metrics?.last_update
    ? new Date(data.metrics.last_update).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : "Sin actualización";
  const sliceLabel = selectedRange === "all" ? "Todo el Histórico" : `Últimas ${selectedRange}`;
  const normalShare = selectedTrafficVolume > 0 ? ((selectedTrafficVolume - selectedAnomalyVolume) / selectedTrafficVolume) * 100 : 0;
  const anomalyShare = selectedTrafficVolume > 0 ? (selectedAnomalyVolume / selectedTrafficVolume) * 100 : 0;

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
                Central analítica para revisar el historial operativo, la salud del sistema y la distribución de protocolos en rangos seleccionados.
              </Text>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-4 lg:min-w-[420px]">
            <div className="flex flex-wrap gap-2">
              {SLICER_OPTIONS.map((option) => {
                const active = selectedRange === option;
                const label = option === "all" ? "Todo el Histórico" : `Últimas ${option}`;

                return (
                  <button
                    key={String(option)}
                    type="button"
                    onClick={() => setSelectedRange(option)}
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

            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
              <div>
                <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Rango activo</Text>
                <p className="mt-1 text-sm text-white">{sliceLabel}</p>
              </div>
              <div className="text-right">
                <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Última actualización</Text>
                <p className="mt-1 font-mono text-sm text-white">{lastUpdate}</p>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <Card className="border border-red-500/20 bg-red-500/5 ring-0">
            <Text className="text-red-300">{error}</Text>
          </Card>
        ) : null}

        <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Latencia Media</Text>
            <Metric className="mt-3 text-white">{selectedAvgLatency.toFixed(2)} ms</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Promedio del rango {sliceLabel}</Text>
          </Card>

          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Tiempo de Proceso</Text>
            <Metric className="mt-3 text-white">{selectedProcessTime.toFixed(2)} ms</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Suma acumulada de las ventanas filtradas</Text>
          </Card>

          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Ventanas Totales</Text>
            <Metric className="mt-3 text-white">{formatNumber(selectedWindows)}</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Elementos visibles en el slicer actual</Text>
          </Card>

          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Tasa de Compresión</Text>
            <Metric className="mt-3 text-white">{selectedCompressionRate.toFixed(2)}%</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Ruido eliminado en el rango filtrado</Text>
          </Card>
        </Grid>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <Card className="border border-hyper-border bg-hyper-surface ring-0">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Salud histórica</Text>
                <h2 className="mt-2 text-2xl font-semibold text-white">Resumen operativo del rango</h2>
                <Text className="mt-2 text-sm text-zinc-400">
                  El slicer limita la muestra para inspeccionar ventanas recientes o la totalidad del histórico disponible.
                </Text>
              </div>

              <Badge color="orange" size="xs">
                {selectedTraffic.length} ventanas
              </Badge>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
                <div className="flex items-center justify-between gap-4">
                  <Text className="text-zinc-300">Tráfico Normal</Text>
                  <Metric className="text-white">{normalShare.toFixed(1)}%</Metric>
                </div>
                <ProgressBar value={Math.max(normalShare, 1)} color="amber" className="mt-3 h-3" />
                <Text className="mt-2 text-xs text-zinc-500">Proporción de tráfico sin anomalía dentro del rango seleccionado.</Text>
              </div>

              <div className="rounded-2xl border border-white/5 bg-black/40 p-5">
                <div className="flex items-center justify-between gap-4">
                  <Text className="text-zinc-300">Tráfico Anómalo</Text>
                  <Metric className="text-red-300">{anomalyShare.toFixed(1)}%</Metric>
                </div>
                <ProgressBar value={Math.max(anomalyShare, 1)} color="red" className="mt-3 h-3" />
                <Text className="mt-2 text-xs text-zinc-500">Ruido operacional visto por el motor de ingestión.</Text>
              </div>
            </div>
          </Card>

          <Card className="border border-hyper-border bg-hyper-surface ring-0">
            <div className="flex flex-col gap-2 border-b border-white/5 pb-5">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">Distribución de protocolos</Text>
              <h2 className="text-2xl font-semibold text-white">TCP, UDP e ICMP</h2>
              <Text className="text-sm text-zinc-400">
                Conteo de protocolos en las alertas consideradas por {sliceLabel}.
              </Text>
            </div>

            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={protocolChartData} barSize={42}>
                  <XAxis dataKey="name" stroke="#71717a" tickLine={false} axisLine={false} />
                  <YAxis stroke="#71717a" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px" }}
                    itemStyle={{ color: "#fff" }}
                  />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {protocolChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
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
        </div>

        <Card className="border border-white/5 bg-zinc-950/80 ring-0">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Estado del conjunto</Text>
              <h2 className="mt-2 text-2xl font-semibold text-white">Volumen total y alertas acumuladas</h2>
              <Text className="mt-2 text-sm text-zinc-400">
                Vista general del motor de ingestión sobre el histórico completo cargado por el backend.
              </Text>
            </div>
            <Badge color="green" size="xs">
              {formatNumber(totalAlerts)} alertas / {formatNumber(totalFlows)} flujos
            </Badge>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Flujos Analizados</Text>
              <Metric className="mt-2 text-white">{formatNumber(totalFlows)}</Metric>
              <Text className="mt-1 text-sm text-zinc-400">Acumulado completo de la simulación.</Text>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Alertas Generadas</Text>
              <Metric className="mt-2 text-white">{formatNumber(totalAlerts)}</Metric>
              <Text className="mt-1 text-sm text-zinc-400">Eventos accionables elevados al SOC.</Text>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Tasa de Compresión Global</Text>
              <Metric className="mt-2 text-white">{Number(performance.compression_rate_percent ?? 0).toFixed(2)}%</Metric>
              <Text className="mt-1 text-sm text-zinc-400">Valor acumulado reportado por el motor.</Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
