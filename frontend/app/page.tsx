"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge, Card } from "@tremor/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#f97316", "#f59e0b", "#eab308", "#ef4444", "#8b5cf6"];
const POLL_INTERVAL_MS = 1000;
const TRAFFIC_WINDOW_SIZE = 20;

const PROTOCOL_NAMES: Record<number, string> = {
  1: "ICMP",
  6: "TCP",
  17: "UDP",
};

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
    };
  };
  alerts?: any[];
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
    },
  },
  alerts: [
    {
      alert_id: "AST-TEST_Shellcode-1424242213692",
      timestamp: "2015-02-18T06:50:13Z",
      gnn_metadata: {
        label_multiclass: "Shellcode",
        label_binary: 1,
        confidence_score: 0.99,
      },
      network_data: {
        src_ip: "175.45.176.0",
        dst_ip: "149.171.126.11",
        src_port: 29231,
        dst_port: 62077,
      },
      narrative: {
        executive_summary: "Patrón compatible con shellcode detectado en el flujo de red.",
        technical_detail: "El tráfico muestra una secuencia corta con alto valor de anomalía y baja latencia.",
      },
      metadata: {
        tokens_used: { total: 0 },
      },
    },
  ],
};

const normalizeAlert = (alert: any) => ({
  ...alert,
  gnn_metadata: {
    label_multiclass: alert?.gnn_metadata?.label_multiclass ?? alert?.gnn_metadata?.label_multiclase ?? "Unknown",
    label_binary: alert?.gnn_metadata?.label_binary ?? alert?.gnn_metadata?.binary_attack ?? 0,
    confidence_score: alert?.gnn_metadata?.confidence_score ?? 0,
  },
  narrative: {
    executive_summary:
      alert?.narrative?.executive_summary ??
      alert?.narrative?.summary ??
      "Analizando comportamiento del flujo con inteligencia narrativa...",
    technical_detail:
      alert?.narrative?.technical_detail ??
      alert?.technical_details
        ? `Duración: ${alert?.technical_details?.duration_ms ?? 0}ms`
        : undefined,
  },
  metadata: alert?.metadata ?? {
    tokens_used: { total: 0 },
  },
});

const formatUtcTime = (value?: string) => {
  if (!value) return "Sin actualización";

  return new Date(value).toLocaleTimeString("es-ES", {
    hour12: false,
    timeZone: "UTC",
  });
};

const formatIncidentTime = (value?: string) => {
  if (!value) return "--:--:--";

  return new Date(value).toLocaleTimeString("es-ES", {
    hour12: false,
    timeZone: "UTC",
  });
};

const buildSeedTrafficHistory = (performance: any): TrafficPoint[] => {
  const windowsProcessed = Math.max(Number(performance?.windows_processed ?? 20), 1);
  const totalFlows = Math.max(Number(performance?.total_flows_analyzed ?? 0), 0);
  const totalAlerts = Math.max(Number(performance?.total_alerts_triggered ?? 0), 0);
  const averageFlows = Math.max(totalFlows / windowsProcessed, 1);
  const averageAlerts = Math.max(totalAlerts / windowsProcessed, 0);

  return Array.from({ length: 20 }, (_, index) => {
    const base = seedTraffic[index % seedTraffic.length];
    const phase = index / 19;

    return {
      tiempo: base.tiempo,
      "Tráfico Normal": Math.max(1, Math.round(averageFlows * (0.82 + phase * 0.3) + base["Tráfico Normal"] * 0.12)),
      "Tráfico Anómalo": Math.max(0, Math.round(averageAlerts * (1.05 + phase * 0.45) + base["Tráfico Anómalo"] * 0.08)),
    };
  });
};

const normalizeTrafficPoint = (point: any): TrafficPoint => ({
  tiempo: String(point?.tiempo ?? "Ventana"),
  "Tráfico Normal": Number(point?.["Tráfico Normal"] ?? point?.trafico_normal ?? 0),
  "Tráfico Anómalo": Number(point?.["Tráfico Anómalo"] ?? point?.trafico_anomalo ?? 0),
});

const getProtocolName = (protocol?: number) => PROTOCOL_NAMES[Number(protocol)] ?? `Protocolo ${protocol ?? "N/A"}`;

const getPriorityLabel = (confidenceScore: number, binaryLabel: number) => {
  if (binaryLabel !== 1) return "Baja";
  if (confidenceScore >= 0.97) return "Crítica";
  if (confidenceScore >= 0.95) return "Alta";
  return "Media";
};

const buildNarrative = (alert: any) => {
  const protocolName = getProtocolName(alert?.network_data?.protocol);
  const sourceIp = alert?.network_data?.src_ip ?? "origen desconocido";
  const destinationIp = alert?.network_data?.dst_ip ?? "destino desconocido";
  const confidenceScore = Number(alert?.gnn_metadata?.confidence_score ?? 0);
  const binaryLabel = Number(alert?.gnn_metadata?.label_binary ?? 0);
  const priority = getPriorityLabel(confidenceScore, binaryLabel);

  return {
    summary:
      alert?.narrative?.executive_summary ??
      `Anomalía detectada en protocolo ${protocolName}, origen ${sourceIp} hacia destino ${destinationIp}. Prioridad basada en comportamiento GNN: ${priority}.`,
    detail:
      alert?.narrative?.technical_detail ??
      `Protocolo ${protocolName} | confianza ${Math.round(confidenceScore * 100)}% | clasificación binaria ${binaryLabel === 1 ? "maliciosa" : "benigna"}`,
    priority,
    protocolName,
  };
};

const mergeTrafficHistory = (previousHistory: TrafficPoint[], incomingHistory: TrafficPoint[]) => {
  if (!incomingHistory.length) {
    return previousHistory.slice(-TRAFFIC_WINDOW_SIZE);
  }

  if (!previousHistory.length) {
    return incomingHistory.slice(-TRAFFIC_WINDOW_SIZE);
  }

  const byLabel = new Map(previousHistory.map((point) => [point.tiempo, point]));
  const merged = incomingHistory.slice(-TRAFFIC_WINDOW_SIZE).map((point) => {
    const previousPoint = byLabel.get(point.tiempo);
    return previousPoint ? { ...previousPoint, ...point } : point;
  });

  return merged.slice(-TRAFFIC_WINDOW_SIZE);
};

const buildTopAttackers = (alerts: any[]): Array<{ srcIp: string; count: number }> => {
  const attackerCounts = alerts.reduce((acc: Record<string, number>, alert: any) => {
    const sourceIp = alert?.network_data?.src_ip ?? "Desconocida";
    acc[sourceIp] = (acc[sourceIp] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(attackerCounts)
    .map(([srcIp, count]) => ({ srcIp, count: Number(count) }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
};

export default function Capa1Triaje() {
  const [data, setData] = useState<StatsResponse>(fallbackData);
  const [speed, setSpeed] = useState<number | string>(1);
  const [currentTime, setCurrentTime] = useState("");
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>(() =>
    buildSeedTrafficHistory(fallbackData.metrics?.performance)
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/stats");
        const json = (await res.json()) as StatsResponse;
        const performance = json.metrics?.performance ?? fallbackData.metrics?.performance;
        const apiTrafficHistory = performance?.traffic_history;

        setData({
          metrics: json.metrics ?? fallbackData.metrics,
          alerts: Array.isArray(json.alerts)
            ? json.alerts.map(normalizeAlert)
            : [normalizeAlert(json.alerts ?? fallbackData.alerts?.[0])],
        });

        if (Array.isArray(apiTrafficHistory) && apiTrafficHistory.length > 0) {
          const normalizedTrafficHistory = apiTrafficHistory.map(normalizeTrafficPoint);
          setTrafficHistory((previousHistory) => mergeTrafficHistory(previousHistory, normalizedTrafficHistory));
        } else {
          setTrafficHistory(buildSeedTrafficHistory(performance));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = window.setInterval(fetchData, POLL_INTERVAL_MS);
    const clock = window.setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString("es-ES", { hour12: false }));
    }, 1000);

    setCurrentTime(new Date().toLocaleTimeString("es-ES", { hour12: false }));

    return () => {
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, []);

  const handleSpeedChange = async (newSpeed: number | string) => {
    setSpeed(newSpeed);

    const label = newSpeed === "MAX" ? "MAX" : `${newSpeed}x`;
    console.log("[ASTOLE] Simulation speed selected", { speed: newSpeed, label });

    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ speed: newSpeed }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("[ASTOLE] Simulation speed synchronized with backend", result);
    } catch (error) {
      console.error("[ASTOLE] Failed to sync simulation speed", error);
    }
  };

  const handleStopSimulation = async () => {
    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "stop" }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log("[ASTOLE] Simulation stop requested", result);
    } catch (error) {
      console.error("[ASTOLE] Failed to stop simulation", error);
    }
  };

  const speedOptions: Array<number | "MAX"> = [1, 2, 4, "MAX"];
  const speedLabel = speed === "MAX" ? "MAX" : `${speed}x`;

  const metrics = data.metrics?.performance || {};
  const alerts = Array.isArray(data.alerts) ? data.alerts : [data.alerts];

  const alertCounts = alerts.reduce((acc: Record<string, number>, alert: any) => {
    const label = alert?.gnn_metadata?.label_multiclass || "Unknown";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const dynamicDistribution = Object.keys(alertCounts).map((key, index) => ({
    name: key,
    value: alertCounts[key],
    color: COLORS[index % COLORS.length],
  }));

  const totalAlertEvents = dynamicDistribution.reduce((acc, item) => acc + item.value, 0);
  const topAttackers = buildTopAttackers(alerts);
  const recentAlerts = alerts.slice(0, 4);

  const displayTrafficHistory = trafficHistory.map((point, index, array) => ({
    ...point,
    tiempo: index === array.length - 1 ? "Ahora" : `-${array.length - 1 - index}m`,
  }));

  return (
    <div className="min-h-screen p-8 lg:p-12 font-sans relative z-10 flex flex-col gap-8 bg-black">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Triaje en Vivo</h1>
          <div className="flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:gap-4">
            <p className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Última actualización: {formatUtcTime(data.metrics?.last_update)}
            </p>
            <p className="text-zinc-500 font-mono">
              Flujo en Tiempo Real: <span className="text-white">{currentTime || "--:--:--"}</span> ·
              <span className="text-hyper-accent"> {speedLabel}</span>
            </p>
          </div>
        </div>

        <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 xl:min-w-[360px]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm uppercase tracking-[0.2em] text-zinc-300">
            <span>Admin Settings</span>
            <span className="text-[10px] text-hyper-accent transition-transform group-open:rotate-180">▾</span>
          </summary>

          <div className="mt-4 flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              {speedOptions.map((value) => {
                const isActive = speed === value;
                const label = value === "MAX" ? "MAX" : `${value}x`;

                return (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => handleSpeedChange(value)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
                      isActive
                        ? "border-hyper-accent bg-hyper-accent/20 text-white shadow-[0_0_18px_rgba(249,115,22,0.55)] ring-1 ring-hyper-accent/70 -translate-y-0.5"
                        : "border-white/10 bg-white/5 text-zinc-400 hover:border-hyper-accent/40 hover:text-white hover:-translate-y-0.5 hover:shadow-[0_0_10px_rgba(249,115,22,0.15)]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleStopSimulation}
              className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-red-200 transition-all hover:bg-red-500/20 hover:text-white hover:shadow-[0_0_16px_rgba(239,68,68,0.3)]"
            >
              STOP
            </button>
          </div>
        </details>
      </motion.header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6">
        <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Alertas</p>
          <p className="text-xl font-mono text-white">{metrics.total_alerts_triggered?.toLocaleString?.() ?? metrics.total_alerts_triggered ?? totalAlertEvents}</p>
          <p className="text-[10px] text-zinc-500">Eventos detectados por el motor de respuesta</p>
        </Card>

        <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reducción de Ruido</p>
          <p className="text-xl font-mono text-white">{Number(metrics.compression_rate_percent ?? 0).toFixed(2)}%</p>
          <p className="text-[10px] text-zinc-500">Ruido eliminado frente al tráfico bruto</p>
        </Card>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <Card className="bg-hyper-surface border-hyper-border ring-0 lg:col-span-2 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-medium mb-1">Firma de Tráfico (Motor Ingestión)</h3>
              <p className="text-xs text-zinc-500">Ventana operativa de los últimos 20 minutos</p>
            </div>
            <Badge color="orange" size="xs">
              Real-Time Flow
            </Badge>
          </div>

          <div className="h-80 mt-6 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={displayTrafficHistory}>
                <defs>
                  <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAnomalo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="tiempo" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: "#e4e4e7", fontSize: 10 }} />
                <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} tick={{ fill: "#f59e0b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "8px", fontSize: "12px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="Tráfico Normal"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNormal)"
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="Tráfico Anómalo"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAnomalo)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 min-w-0 self-start xl:grid-cols-2 xl:items-start">
          <Card className="bg-hyper-surface border-hyper-border ring-0 flex flex-col justify-between min-w-0 h-full">
            <div>
              <h3 className="text-white font-medium text-center mb-1">Composición de Amenazas</h3>
              <p className="text-xs text-zinc-500 text-center mb-2">Basado en alertas actuales</p>
            </div>

            <div className="h-36 w-full relative mt-2 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie data={dynamicDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={6} dataKey="value" stroke="none" cornerRadius={4}>
                    {dynamicDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0a0a0a", borderColor: "#1f1f22", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-mono text-white">{totalAlertEvents}</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Eventos</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-4 w-full px-2">
              {dynamicDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-zinc-400">{item.name}</span>
                  </div>
                  <span className="text-white font-mono">{item.value} eventos</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0 h-full">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white font-medium">Top Atacantes</h3>
                <p className="text-xs text-zinc-500">IPs de origen con más alertas en la ventana actual</p>
              </div>
              <Badge color="red" size="xs">Top 5</Badge>
            </div>

            <div className="flex flex-col gap-2">
              {topAttackers.length > 0 ? (
                topAttackers.map((attacker, index) => (
                  <div key={attacker.srcIp} className="rounded-xl border border-white/5 bg-black/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-hyper-accent/10 text-[10px] font-semibold text-hyper-accent">
                          {index + 1}
                        </span>
                        <span className="truncate font-mono text-zinc-200">{attacker.srcIp}</span>
                      </div>
                      <span className="font-mono text-white">{attacker.count}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-hyper-accent to-amber-300"
                        style={{ width: `${Math.max((attacker.count / Math.max(topAttackers[0]?.count ?? 1, 1)) * 100, 8)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Sin alertas suficientes para construir un ranking.</p>
              )}
            </div>
          </Card>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6 pb-12">
        <div className="lg:col-span-2 flex min-h-0 flex-col gap-4 self-start">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">Narrativa de Incidentes (Real-Time)</h2>
            <Badge color="orange" size="xs">
              {recentAlerts.length} visibles / {alerts.length} totales
            </Badge>
          </div>

          <p className="text-xs text-zinc-500">
            Se muestran solo las últimas 4 alertas para que el analista mantenga el foco. El resto queda dentro del scroll interno.
          </p>

          <div className="grid max-h-[calc(100vh-18rem)] grid-cols-1 gap-6 overflow-y-auto pr-2">
            {recentAlerts.map((alerta: any, index: number) => (
              <motion.div key={alerta.alert_id ?? index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: index * 0.1 }}>
                <Card className="bg-hyper-surface border-hyper-border ring-0 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Badge color={alerta.gnn_metadata?.label_binary === 1 ? "red" : "green"}>
                        {alerta.gnn_metadata?.label_binary === 1 ? "ATAQUE" : "BENIGNO"}
                      </Badge>
                      <h3 className="text-md font-medium text-white">{alerta.gnn_metadata?.label_multiclass}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">{formatIncidentTime(alerta.timestamp)}</p>
                      <p className="text-[10px] text-hyper-accent font-mono">{alerta.alert_id}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="bg-black/60 rounded-t-md p-3 font-mono text-xs text-zinc-400 border border-white/5 border-b-0">
                      <span className="text-hyper-accent mr-2">ORIGEN:</span> {alerta.network_data?.src_ip}:{alerta.network_data?.src_port}
                      <span className="mx-2 text-zinc-600">→</span>
                      <span className="text-blue-400 mr-2">DESTINO:</span> {alerta.network_data?.dst_ip}:{alerta.network_data?.dst_port}
                    </div>
                    <div className="bg-hyper-accent/5 border border-hyper-accent/10 rounded-b-md p-4 flex gap-3 items-start">
                      <span className="text-hyper-accent text-sm mt-0.5">✨</span>
                      <div className="flex flex-col gap-2">
                        <p className="text-zinc-300 text-sm leading-relaxed">
                          {buildNarrative(alerta).summary}
                        </p>
                        <p className="text-zinc-500 text-xs italic border-l border-white/10 pl-3">{buildNarrative(alerta).detail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>Confianza GNN: {(alerta.gnn_metadata?.confidence_score * 100).toFixed(1)}%</span>
                      <span className="text-zinc-700">•</span>
                      <span>{buildNarrative(alerta).protocolName}</span>
                    </div>
                    <Badge color={buildNarrative(alerta).priority === "Crítica" ? "red" : "orange"} size="xs">
                      Prioridad {buildNarrative(alerta).priority}
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 self-start">
          <div className="sticky top-6">
            <Card className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 ring-0 flex flex-col shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                <div className="w-2 h-2 rounded-full bg-hyper-accent animate-pulse" />
                <h3 className="text-white font-medium">SOC Assistant</h3>
              </div>
              <div className="py-4 space-y-4 text-sm text-zinc-400">
                <p>Bienvenido al asistente de investigación. Selecciona una alerta para profundizar en el contexto del RAG.</p>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                  <p className="text-xs font-bold text-hyper-accent uppercase mb-1">Sugerencia:</p>
                  "¿Qué otros destinos ha visitado la IP {alerts[0]?.network_data?.src_ip} en la última hora?"
                </div>
              </div>
              <div className="pt-4 border-t border-white/10 mt-auto">
                <input type="text" placeholder="Consultar memoria técnica..." className="w-full bg-black/50 border border-white/10 rounded-md py-2.5 px-3 text-sm text-white outline-none focus:border-hyper-accent" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
