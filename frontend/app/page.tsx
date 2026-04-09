"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge, Card } from "@tremor/react";
import { IntelDrawer, type IntelDrawerContext, type IntelDrawerTopic } from "../components/IntelDrawer";
import { IPProfilePopover, type IPIntelPayload } from "../components/IPProfilePopover";
import {
  formatPortWithService,
  getIPMetadata,
  getPortServiceName,
  normalizePortNumber,
} from "../lib/netIntel";
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

const hashStringToHue = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
};

const buildUniqueColorsByLabel = (labels: string[]) => {
  const palette = [
    "#f97316", // orange-500 (hyper accent)
    "#f59e0b", // amber-500
    "#eab308", // yellow-500
    "#ef4444", // red-500
    "#3b82f6", // blue-500
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#a855f7", // purple-500
    "#d946ef", // fuchsia-500
    "#ec4899", // pink-500
    "#22c55e", // green-500
    "#10b981", // emerald-500
    "#14b8a6", // teal-500
    "#06b6d4", // cyan-500
    "#0ea5e9", // sky-500
    "#84cc16", // lime-500
  ];

  const used = new Set<string>();
  const byLabel: Record<string, string> = {};
  const goldenAngle = 137.508;

  for (const [index, label] of labels.entries()) {
    if (index < palette.length) {
      const color = palette[index];
      used.add(color);
      byLabel[label] = color;
      continue;
    }

    const baseHue = hashStringToHue(label);
    let hue = baseHue;
    let color = `hsl(${hue} 78% 55%)`;

    for (let attempts = 0; attempts < 24 && used.has(color); attempts += 1) {
      hue = Math.round((hue + goldenAngle) % 360);
      color = `hsl(${hue} 78% 55%)`;
    }

    used.add(color);
    byLabel[label] = color;
  }

  return byLabel;
};
const POLL_INTERVAL_MS = 1000;
const TRAFFIC_WINDOW_SIZE = 20;
const MAX_VISIBLE_INCIDENTS = 50;
const SPEED_STORAGE_KEY = "astole.simulation.speed";
const SPEED_EVENT_NAME = "astole:speed";

const PROTOCOL_NAMES: Record<number, string> = {
  1: "ICMP",
  6: "TCP",
  17: "UDP",
};

const MADRID_TIME_ZONE = "Europe/Madrid";

const InfoDot = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/30 text-xs font-semibold text-zinc-200 hover:border-white/20 hover:text-white"
  >
    i
  </button>
);

type InfrastructureSeverity = "critical" | "high" | "medium" | "low";

const PRIORITY_ORDER: Record<string, InfrastructureSeverity> = {
  "Crítica": "critical",
  "Alta": "high",
  "Media": "medium",
  "Baja": "low",
};

const getInfrastructureThreatPercent = (severity: InfrastructureSeverity) => {
  switch (severity) {
    case "critical":
      return 100;
    case "high":
      return 75;
    case "medium":
      return 50;
    default:
      return 25;
  }
};

const getInfrastructureSeverityUi = (severity: InfrastructureSeverity) => {
  if (severity === "critical") {
    return {
      label: "Crítica",
      cube: "bg-rose-600/22 border-rose-500/45",
      top: "bg-rose-600/18",
      side: "bg-rose-600/12",
      glow: "animate-pulse shadow-[0_0_18px_rgba(225,29,72,0.65)] ring-2 ring-rose-500/25",
    };
  }

  if (severity === "high") {
    return {
      label: "Alta",
      cube: "bg-orange-500/22 border-orange-400/45",
      top: "bg-orange-500/18",
      side: "bg-orange-500/12",
      glow: "",
    };
  }

  if (severity === "medium") {
    return {
      label: "Media",
      cube: "bg-yellow-400/18 border-yellow-300/35",
      top: "bg-yellow-400/14",
      side: "bg-yellow-400/10",
      glow: "",
    };
  }

  return {
    label: "Baja",
    cube: "bg-zinc-800/35 border-zinc-600/25",
    top: "bg-zinc-700/25",
    side: "bg-zinc-700/18",
    glow: "",
  };
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

const getAttackType = (alert: any) => {
  const raw =
    alert?.attack_type ??
    alert?.gnn_metadata?.attack_type ??
    alert?.gnn_metadata?.label_multiclass ??
    alert?.gnn_metadata?.label_multiclase;
  return String(raw ?? "").trim();
};

const getSmartNarrativeSummary = (alert: any) => {
  const attackType = getAttackType(alert);
  const normalized = attackType.toLowerCase();

  if (normalized === "exploits" || normalized.startsWith("exploit")) {
    return "Intento de ejecución de código remoto detectado. Patrón de desbordamiento de buffer.";
  }

  if (normalized === "dos" || normalized.includes("dos")) {
    return "Inundación de paquetes detectada. Saturación de recursos en el puerto destino.";
  }

  if (normalized === "reconnaissance" || normalized.includes("reconnaissance") || normalized.includes("recon")) {
    return "Escaneo de puertos activo. Múltiples intentos de conexión SYN.";
  }

  return "Comportamiento anómalo en el flujo de red. Desviación detectada respecto al baseline normal.";
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
      getSmartNarrativeSummary(alert),
    technical_detail:
      alert?.narrative?.technical_detail ??
      (alert?.technical_details ? `Duración: ${alert?.technical_details?.duration_ms ?? 0}ms` : undefined),
  },
  metadata: alert?.metadata ?? {
    tokens_used: { total: 0 },
  },
});

const formatUtcTime = (value?: string) => {
  if (!value) return "Sin actualización";

  try {
    return new Date(value).toLocaleTimeString("es-ES", { hour12: false, timeZone: MADRID_TIME_ZONE });
  } catch {
    return new Date(value).toLocaleTimeString("es-ES", { hour12: false });
  }
};

const truncateAlertId = (value: unknown) => {
  const raw = String(value ?? "");
  if (!raw) return "";
  if (raw.length <= 14) return raw;
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`;
};

const formatIncidentTime = (value?: string) => {
  if (!value) return "--:--:--";

  try {
    return new Date(value).toLocaleTimeString("es-ES", { hour12: false, timeZone: MADRID_TIME_ZONE });
  } catch {
    return new Date(value).toLocaleTimeString("es-ES", { hour12: false });
  }
};
const isValidSpeed = (value: unknown): value is number | "MAX" => {
  if (value === "MAX") return true;
  if (typeof value === "number") return [1, 2, 4].includes(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && [1, 2, 4].includes(parsed);
  }
  return false;
};

const readStoredSpeed = (): number | "MAX" | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SPEED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidSpeed(parsed) ? (typeof parsed === "string" ? (parsed === "MAX" ? "MAX" : Number(parsed)) : parsed) : null;
  } catch {
    return null;
  }
};

const persistSpeed = (speed: number | "MAX") => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SPEED_STORAGE_KEY, JSON.stringify(speed));
};

const broadcastSpeed = (speed: number | "MAX") => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SPEED_EVENT_NAME, { detail: speed }));
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

const severityRank: Record<InfrastructureSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const getAlertSeverity = (alert: any): InfrastructureSeverity => {
  const confidenceScore = Number(alert?.gnn_metadata?.confidence_score ?? 0);
  const binaryLabel = Number(alert?.gnn_metadata?.label_binary ?? alert?.gnn_metadata?.binary_attack ?? 0);
  const priorityLabel = getPriorityLabel(confidenceScore, binaryLabel);
  return PRIORITY_ORDER[priorityLabel] ?? "low";
};

const getPortPillUi = (severity: InfrastructureSeverity) => {
  if (severity === "critical") return "bg-rose-500/20 text-rose-200 border-rose-500/30";
  if (severity === "high") return "bg-orange-500/20 text-orange-200 border-orange-500/30";
  if (severity === "medium") return "bg-yellow-400/20 text-yellow-100 border-yellow-300/25";
  return "bg-zinc-700/30 text-zinc-200 border-white/10";
};

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

const buildTopDestinations = (alerts: any[]): Array<{ dstIp: string; count: number }> => {
  const destinationCounts = alerts.reduce((acc: Record<string, number>, alert: any) => {
    const destinationIp = alert?.network_data?.dst_ip ?? "Desconocida";
    acc[destinationIp] = (acc[destinationIp] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(destinationCounts)
    .map(([dstIp, count]) => ({ dstIp, count: Number(count) }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);
};

const computeInfrastructureSeverity = (alerts: any[]): InfrastructureSeverity => {
  const rank: Record<InfrastructureSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  let worst: InfrastructureSeverity = "low";
  for (const alert of alerts) {
    const confidenceScore = Number(alert?.gnn_metadata?.confidence_score ?? 0);
    const binaryLabel = Number(alert?.gnn_metadata?.label_binary ?? 0);
    const priorityLabel = getPriorityLabel(confidenceScore, binaryLabel);
    const mapped = PRIORITY_ORDER[priorityLabel] ?? "low";

    if (rank[mapped] > rank[worst]) {
      worst = mapped;
      if (worst === "critical") break;
    }
  }
  return worst;
};

const buildInfrastructureAssets = (allAlerts: any[], visibleAlerts: any[]) => {
  const byDstIp = new Map<string, any[]>();
  for (const alert of allAlerts) {
    const dstIp = alert?.network_data?.dst_ip ?? "Desconocida";
    const list = byDstIp.get(dstIp) ?? [];
    list.push(alert);
    byDstIp.set(dstIp, list);
  }

  const visibleDstIps = Array.from(
    new Set(visibleAlerts.map((alert) => String(alert?.network_data?.dst_ip ?? "Desconocida")))
  );

  return visibleDstIps
    .map((dstIp) => {
      const entries = byDstIp.get(dstIp) ?? [];
      return {
        dstIp,
        count: entries.length,
        severity: computeInfrastructureSeverity(entries),
      };
    })
    .sort((a, b) => {
      const severityOrder: Record<InfrastructureSeverity, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };
      const left = severityOrder[a.severity];
      const right = severityOrder[b.severity];
      if (right !== left) return right - left;
      return b.count - a.count;
    });
};

export default function Capa1Triaje() {
  const [data, setData] = useState<StatsResponse>(fallbackData);
  const [speed, setSpeed] = useState<number | "MAX">(1);
  const [currentTime, setCurrentTime] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [incidentFeedLimit, setIncidentFeedLimit] = useState<20 | 50 | 100>(50);
  const [isIntelOpen, setIsIntelOpen] = useState(false);
  const [intelContext, setIntelContext] = useState<IntelDrawerContext | null>(null);
  const [intelTopic, setIntelTopic] = useState<IntelDrawerTopic>(null);
  const [isTacticalOpen, setIsTacticalOpen] = useState(false);
  const [selectedAssetIp, setSelectedAssetIp] = useState<string | null>(null);
  const [flashCriticalBorder, setFlashCriticalBorder] = useState(false);
  const previousCriticalAssets = useRef<Set<string>>(new Set());
  const hasInitializedCriticalAssets = useRef(false);
  const [trafficHistory, setTrafficHistory] = useState<TrafficPoint[]>(() =>
    buildSeedTrafficHistory(fallbackData.metrics?.performance)
  );

  const openIntel = (context: IntelDrawerContext, topic: IntelDrawerTopic = null) => {
    setIntelContext(context);
    setIntelTopic(topic);
    setIsIntelOpen(true);
  };

  const closeIntel = () => {
    setIsIntelOpen(false);
    setIntelContext(null);
    setIntelTopic(null);
  };

  useEffect(() => {
    setIsClient(true);

    const storedSpeed = readStoredSpeed();
    if (storedSpeed) {
      setSpeed(storedSpeed);
      broadcastSpeed(storedSpeed);
    } else {
      persistSpeed(1);
      broadcastSpeed(1);
    }

    const fetchData = async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
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
      } catch {
        // Network hiccups are expected in long-running demos; keep UI running on last known data.
      }
    };

    fetchData();
    const interval = window.setInterval(fetchData, POLL_INTERVAL_MS);
    const clock = window.setInterval(() => {
      try {
        setCurrentTime(new Date().toLocaleTimeString("es-ES", { hour12: false, timeZone: MADRID_TIME_ZONE }));
      } catch {
        setCurrentTime(new Date().toLocaleTimeString("es-ES", { hour12: false }));
      }
    }, 1000);

    try {
      setCurrentTime(new Date().toLocaleTimeString("es-ES", { hour12: false, timeZone: MADRID_TIME_ZONE }));
    } catch {
      setCurrentTime(new Date().toLocaleTimeString("es-ES", { hour12: false }));
    }

    return () => {
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, []);

  const handleSpeedChange = async (newSpeed: number | string) => {
    const normalizedSpeed = newSpeed === "MAX" ? "MAX" : Number(newSpeed);
    const nextSpeed = isValidSpeed(normalizedSpeed) ? (normalizedSpeed === "MAX" ? "MAX" : Number(normalizedSpeed)) : 1;

    setSpeed(nextSpeed);
    persistSpeed(nextSpeed);
    broadcastSpeed(nextSpeed);

    const label = nextSpeed === "MAX" ? "MAX" : `${nextSpeed}x`;
    console.log("[ASTOLE] Simulation speed selected", { speed: nextSpeed, label });

    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ speed: nextSpeed }),
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

  const HeaderTag = (isClient ? motion.header : "header") as any;
  const MotionGridTag = (isClient ? motion.div : "div") as any;
  const MotionAlertTag = (isClient ? motion.div : "div") as any;

  const metrics = data.metrics?.performance || {};
  const alerts = Array.isArray(data.alerts) ? data.alerts : [data.alerts];

  const visibleAlerts = alerts.slice(-MAX_VISIBLE_INCIDENTS).reverse();
  const incidentFeedAlerts = alerts.slice(-incidentFeedLimit).reverse();

  const alertCounts = visibleAlerts.reduce((acc: Record<string, number>, alert: any) => {
    const label = String(alert?.gnn_metadata?.label_multiclass || "Unknown");
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const sortedLabels = Object.entries(alertCounts)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([label]) => label);

  const colorsByLabel = buildUniqueColorsByLabel(sortedLabels);
  const dynamicDistribution = sortedLabels.map((label) => ({
    name: label,
    value: alertCounts[label] ?? 0,
    color: colorsByLabel[label],
  }));

  const totalAlertEvents = dynamicDistribution.reduce((acc, item) => acc + item.value, 0);
  const topAttackers = buildTopAttackers(visibleAlerts);

  const toFlagEmoji = (countryCode: string) => {
    const code = String(countryCode ?? "").trim().toUpperCase();
    if (code === "ZZ") return "🌐";
    if (code.length !== 2) return "🌐";
    const A = 0x1f1e6;
    const first = code.charCodeAt(0) - 65;
    const second = code.charCodeAt(1) - 65;
    if (first < 0 || first > 25 || second < 0 || second > 25) return "🌐";
    return String.fromCodePoint(A + first, A + second);
  };

  const srcIntelByIp = useMemo(() => {
    const map = new Map<string, IPIntelPayload>();
    for (const alert of visibleAlerts) {
      const srcIp = String(alert?.network_data?.src_ip ?? "").trim();
      if (!srcIp) continue;
      const intel = alert?.ip_intel?.src as IPIntelPayload | undefined;
      if (intel && typeof intel === "object") {
        map.set(srcIp, intel);
      }
    }
    return map;
  }, [visibleAlerts]);

  const dstIntelByIp = useMemo(() => {
    const map = new Map<string, IPIntelPayload>();
    for (const alert of visibleAlerts) {
      const dstIp = String(alert?.network_data?.dst_ip ?? "").trim();
      if (!dstIp) continue;
      const intel = alert?.ip_intel?.dst as IPIntelPayload | undefined;
      if (intel && typeof intel === "object") {
        map.set(dstIp, intel);
      }
    }
    return map;
  }, [visibleAlerts]);

  const originCountryBreakdown = useMemo(() => {
    const total = visibleAlerts.length;
    if (!total) return [] as Array<{ country: string; flag: string; percent: number }>;

    const byCountry = new Map<string, { country: string; flag: string; count: number }>();
    for (const alert of visibleAlerts) {
      const srcIp = String(alert?.network_data?.src_ip ?? "").trim();
      const intel = (alert?.ip_intel?.src as IPIntelPayload | undefined) ?? undefined;
      const fallbackMeta = !intel && srcIp ? getIPMetadata(srcIp) : null;
      const codeRaw = String(intel?.country ?? fallbackMeta?.country ?? "zz").trim().toLowerCase();
      const code = codeRaw && codeRaw !== "zz" && codeRaw.length === 2 ? codeRaw.toUpperCase() : "ZZ";
      const current = byCountry.get(code) ?? { country: code, flag: toFlagEmoji(code), count: 0 };
      current.count += 1;
      byCountry.set(code, current);
    }

    const sorted = Array.from(byCountry.values()).sort((a, b) => b.count - a.count);
    const top = sorted.slice(0, 3).map((entry) => ({
      country: entry.country,
      flag: entry.flag,
      percent: Math.round((entry.count / total) * 100),
    }));

    const restCount = sorted.slice(3).reduce((acc, entry) => acc + entry.count, 0);
    if (restCount > 0) {
      top.push({ country: "OT", flag: "🌐", percent: Math.round((restCount / total) * 100) });
    }

    return top;
  }, [visibleAlerts]);

  const topAttackerCountries = useMemo(() => {
    const total = visibleAlerts.length;
    if (!total) return [] as Array<{ code: string; name: string; percent: number }>;

    const byCode = new Map<string, { code: string; name: string; count: number }>();
    for (const alert of visibleAlerts) {
      const srcIp = String(alert?.network_data?.src_ip ?? "").trim();
      const intel = alert?.ip_intel?.src as IPIntelPayload | undefined;
      const fallbackMeta = !intel && srcIp ? getIPMetadata(srcIp) : null;
      const codeRaw = String(intel?.country ?? fallbackMeta?.country ?? "zz").trim().toLowerCase();
      const code = codeRaw && codeRaw !== "zz" && codeRaw.length === 2 ? codeRaw : "zz";
      const name = String(intel?.country_name ?? fallbackMeta?.countryName ?? "Unknown").trim() || "Unknown";
      const current = byCode.get(code) ?? { code, name, count: 0 };
      current.count += 1;
      // Keep the first non-empty name we see.
      if (current.name === "Unknown" && name !== "Unknown") current.name = name;
      byCode.set(code, current);
    }

    return Array.from(byCode.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((entry) => ({
        code: entry.code,
        name: entry.name,
        percent: Math.round((entry.count / total) * 100),
      }));
  }, [visibleAlerts]);
  const attackerPrimaryTypeByIp = useMemo(() => {
    const bySrc = new Map<string, Record<string, number>>();

    for (const alert of visibleAlerts) {
      const srcIp = String(alert?.network_data?.src_ip ?? "Desconocida");
      const isAttack = Number(alert?.gnn_metadata?.label_binary ?? 0) === 1;
      if (!isAttack) continue;

      const label = String(alert?.gnn_metadata?.label_multiclass ?? "Desconocido");
      const counts = bySrc.get(srcIp) ?? {};
      counts[label] = (counts[label] || 0) + 1;
      bySrc.set(srcIp, counts);
    }

    const primary = new Map<string, string>();
    for (const [srcIp, counts] of bySrc.entries()) {
      let bestLabel = "";
      let bestCount = -1;
      for (const [label, count] of Object.entries(counts)) {
        const countNumber = Number(count);
        if (countNumber > bestCount) {
          bestCount = countNumber;
          bestLabel = label;
        }
      }
      if (bestLabel) primary.set(srcIp, bestLabel);
    }

    return primary;
  }, [visibleAlerts]);

  const attackerTopDstPortByIp = useMemo(() => {
    const bySrc = new Map<string, { counts: Record<number, number>; lastSeen: Record<number, number> }>();

    for (const alert of visibleAlerts) {
      const srcIp = String(alert?.network_data?.src_ip ?? "Desconocida");
      const isAttack = Number(alert?.gnn_metadata?.label_binary ?? 0) === 1;
      if (!isAttack) continue;

      const dstPort = normalizePortNumber(alert?.network_data?.dst_port);
      if (dstPort == null) continue;

      const tsMs = new Date(alert?.timestamp ?? 0).getTime();
      const current = bySrc.get(srcIp) ?? { counts: {}, lastSeen: {} };
      current.counts[dstPort] = (current.counts[dstPort] || 0) + 1;
      if (Number.isFinite(tsMs)) {
        const prevTs = current.lastSeen[dstPort] ?? 0;
        current.lastSeen[dstPort] = Math.max(prevTs, tsMs);
      }
      bySrc.set(srcIp, current);
    }

    const primary = new Map<string, { port: number; count: number; lastSeenMs: number | null }>();
    for (const [srcIp, meta] of bySrc.entries()) {
      let bestPort: number | null = null;
      let bestCount = -1;
      for (const [portRaw, count] of Object.entries(meta.counts)) {
        const port = Number(portRaw);
        const countNumber = Number(count);
        if (countNumber > bestCount) {
          bestCount = countNumber;
          bestPort = port;
        }
      }

      if (bestPort != null) {
        const lastSeenMsRaw = meta.lastSeen[bestPort];
        primary.set(srcIp, {
          port: bestPort,
          count: bestCount,
          lastSeenMs: Number.isFinite(lastSeenMsRaw) ? lastSeenMsRaw : null,
        });
      }
    }

    return primary;
  }, [visibleAlerts]);
  const recentAlerts = incidentFeedAlerts;
  const infrastructureAssets = buildInfrastructureAssets(alerts, visibleAlerts);

  const alertsByDstIp = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const alert of alerts) {
      const dstIp = String(alert?.network_data?.dst_ip ?? "Desconocida");
      const list = map.get(dstIp) ?? [];
      list.push(alert);
      map.set(dstIp, list);
    }

    for (const [dstIp, list] of map.entries()) {
      list.sort((a, b) => {
        const left = new Date(a?.timestamp ?? 0).getTime();
        const right = new Date(b?.timestamp ?? 0).getTime();
        return right - left;
      });
      map.set(dstIp, list);
    }

    return map;
  }, [alerts]);

  const hasRecentMaxSeverityRingByDstIp = useMemo(() => {
    if (!isClient) return new Map<string, boolean>();

    const nowMs = Date.now();
    const windowMs = 2 * 60 * 1000;
    const map = new Map<string, boolean>();

    for (const [dstIp, list] of alertsByDstIp.entries()) {
      let hasRecentCritical = false;
      for (const alert of list) {
        const tsMs = new Date(alert?.timestamp ?? 0).getTime();
        if (!Number.isFinite(tsMs)) continue;

        if (nowMs - tsMs > windowMs) {
          break;
        }

        const severity = getAlertSeverity(alert);
        if (severity === "critical") {
          hasRecentCritical = true;
          break;
        }
      }
      map.set(String(dstIp), hasRecentCritical);
    }

    return map;
  }, [alertsByDstIp, isClient]);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetIp) return null;
    const asset = infrastructureAssets.find((entry) => String(entry.dstIp) === String(selectedAssetIp));
    if (!asset) return null;

    const allForIp = alertsByDstIp.get(String(selectedAssetIp)) ?? [];
    const attackCounts = allForIp.reduce((acc: Record<string, number>, alert: any) => {
      const isAttack = Number(alert?.gnn_metadata?.label_binary ?? 0) === 1;
      if (!isAttack) return acc;
      const label = String(alert?.gnn_metadata?.label_multiclass ?? "Desconocido");
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});

    const attackSkills = Object.entries(attackCounts)
      .map(([label, count]) => ({ label, count: Number(count) }))
      .sort((a, b) => b.count - a.count);

    const recentLogs = allForIp.slice(0, 3);

    const portInsightsByPort = new Map<number, { severity: InfrastructureSeverity; hasExploit: boolean }>();
    for (const alert of allForIp) {
      const dstPort = normalizePortNumber(alert?.network_data?.dst_port);
      if (dstPort == null) continue;

      const severity = getAlertSeverity(alert);
      const label = String(alert?.gnn_metadata?.label_multiclass ?? "");
      const hasExploit = label.toLowerCase().startsWith("exploit");

      const current = portInsightsByPort.get(dstPort);
      if (!current) {
        portInsightsByPort.set(dstPort, { severity, hasExploit });
        continue;
      }

      const nextSeverity = severityRank[severity] > severityRank[current.severity] ? severity : current.severity;
      portInsightsByPort.set(dstPort, { severity: nextSeverity, hasExploit: current.hasExploit || hasExploit });
    }

    const attackPorts = Array.from(portInsightsByPort.entries())
      .map(([port, insight]) => ({ port, ...insight }))
      .sort((a, b) => {
        const severityDiff = severityRank[b.severity] - severityRank[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.port - b.port;
      });
    const threatPercent = getInfrastructureThreatPercent(asset.severity);
    const ui = getInfrastructureSeverityUi(asset.severity);

    return {
      ...asset,
      ui,
      threatPercent,
      attackSkills,
      attackPorts,
      recentLogs,
    };
  }, [alertsByDstIp, infrastructureAssets, selectedAssetIp]);

  useEffect(() => {
    if (!selectedAssetIp) return;
    const isStillVisible = infrastructureAssets.some((entry) => String(entry.dstIp) === String(selectedAssetIp));
    if (!isStillVisible) setSelectedAssetIp(null);
  }, [infrastructureAssets, selectedAssetIp]);
  const criticalAssetsKey = infrastructureAssets
    .filter((asset) => asset.severity === "critical")
    .map((asset) => String(asset.dstIp))
    .sort()
    .join("|");

  useEffect(() => {
    if (!isClient) return;

    const nextSet = new Set(
      infrastructureAssets.filter((asset) => asset.severity === "critical").map((asset) => String(asset.dstIp))
    );
    const prevSet = previousCriticalAssets.current;

    if (!hasInitializedCriticalAssets.current) {
      previousCriticalAssets.current = nextSet;
      hasInitializedCriticalAssets.current = true;
      return;
    }

    const hasNewCritical = Array.from(nextSet).some((dstIp) => !prevSet.has(dstIp));
    if (hasNewCritical) {
      setFlashCriticalBorder(true);
      window.setTimeout(() => setFlashCriticalBorder(false), 500);
    }

    previousCriticalAssets.current = nextSet;
  }, [isClient, criticalAssetsKey]);

  const displayTrafficHistory = trafficHistory.map((point, index, array) => ({
    ...point,
    tiempo: index === array.length - 1 ? "Ahora" : `-${array.length - 1 - index}m`,
  }));

  const totalAlertsValueRaw = metrics.total_alerts_triggered;
  const totalAlertsValue = Number.isFinite(Number(totalAlertsValueRaw))
    ? Number(totalAlertsValueRaw)
    : Number.isFinite(Number(totalAlertEvents))
      ? Number(totalAlertEvents)
      : 0;

  const analysisCycles = Number(metrics.windows_processed ?? 0);
  const totalThreats = alerts.filter(Boolean).length;

  return (
    <div className="min-h-screen p-8 lg:p-12 font-sans relative z-10 flex flex-col gap-8 bg-black">
      <div
        className={`pointer-events-none fixed inset-0 z-[60] border-2 border-red-500/40 transition-opacity duration-500 ${
          flashCriticalBorder ? "opacity-100" : "opacity-0"
        }`}
      />
      <HeaderTag
        {...(isClient
          ? {
              initial: { opacity: 0, y: -20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.5 },
            }
          : {})}
        className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"
      >
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">Triaje en Vivo</h1>
          <div className="flex flex-col gap-2 text-lg text-zinc-400 sm:flex-row sm:items-center sm:gap-4">
            <p className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Última actualización: {isClient ? formatUtcTime(data.metrics?.last_update) : "--:--:--"}
            </p>
            <p className="text-zinc-500 font-mono">
              Flujo en Tiempo Real: <span className="text-white">{currentTime || "--:--:--"}</span> ·
              <span className="text-hyper-accent"> {speedLabel}</span>
            </p>
            <p className="text-zinc-500 font-mono">
              Ciclos de Análisis: <span className="text-white">{analysisCycles.toLocaleString("es-ES")}</span> ·
              <span className="text-hyper-accent"> Amenazas Totales: {totalThreats.toLocaleString("es-ES")}</span>
            </p>
          </div>
        </div>

        <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 xl:min-w-[360px]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg uppercase tracking-[0.2em] text-zinc-300">
            <span>Admin Settings</span>
            <span className="text-base text-hyper-accent transition-transform group-open:rotate-180">▾</span>
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
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
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
              className="rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-red-200 transition-all hover:bg-red-500/20 hover:text-white hover:shadow-[0_0_16px_rgba(239,68,68,0.3)]"
            >
              STOP
            </button>
          </div>
        </details>
      </HeaderTag>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6">
        <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0">
          <p className="text-base text-zinc-500 uppercase tracking-wider mb-1">Alertas</p>
          <p className="text-3xl font-mono text-white">{totalAlertsValue.toLocaleString("es-ES")}</p>
          <p className="text-sm text-zinc-500">Eventos detectados por el motor de respuesta</p>
        </Card>

        <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0">
          <p className="text-base text-zinc-500 uppercase tracking-wider mb-1">Reducción de Ruido</p>
          <p className="text-3xl font-mono text-white">{Number(metrics.compression_rate_percent ?? 0).toFixed(2)}%</p>
          <p className="text-sm text-zinc-500">Ruido eliminado frente al tráfico bruto</p>
        </Card>
      </div>

      <MotionGridTag
        {...(isClient
          ? {
              initial: { opacity: 0, scale: 0.95 },
              animate: { opacity: 1, scale: 1 },
              transition: { duration: 0.6, delay: 0.2 },
            }
          : {})}
        className="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        <Card className="bg-hyper-surface border-hyper-border ring-0 lg:col-span-3 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-medium mb-1">Firma de Tráfico (Motor Ingestión)</h3>
              <p className="text-base text-zinc-500">Ventana operativa de los últimos 20 minutos</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="orange" size="xs">
                Real-Time Flow
              </Badge>
            </div>
          </div>

          <div className="h-80 mt-6 w-full min-w-0">
            {isClient ? (
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
                  <XAxis
                    dataKey="tiempo"
                    stroke="#3f3f46"
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#e4e4e7", fontSize: 13 }}
                  />
                  <YAxis
                    stroke="#3f3f46"
                    fontSize={13}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}`}
                    tick={{ fill: "#f59e0b", fontSize: 13 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#09090b",
                      borderColor: "#27272a",
                      borderRadius: "8px",
                      fontSize: "15px",
                    }}
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
            ) : (
              <div className="h-full w-full rounded-xl border border-white/5 bg-black/30" />
            )}
          </div>
        </Card>

        <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0 h-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-white font-medium">Composición de Amenazas</h3>
              <p className="text-base text-zinc-500">Basado en el intervalo actual</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="orange" size="xs">Donut</Badge>
              <button
                type="button"
                onClick={() => openIntel("composition", "distribution")}
                aria-label="Ayuda contextual"
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-xs font-semibold text-zinc-200 hover:border-white/20 hover:text-white"
              >
                i
              </button>
            </div>
          </div>

          <div className="mt-4 h-44 w-full min-w-0 relative">
            {isClient ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={dynamicDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                    isAnimationActive={false}
                  >
                    {dynamicDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0a0a0a",
                      borderColor: "#1f1f22",
                      borderRadius: "8px",
                      fontSize: "15px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-xl border border-white/5 bg-black/30" />
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-mono text-white">{totalAlertEvents}</span>
              <span className="text-sm text-zinc-500 uppercase tracking-widest mt-1">Eventos</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 px-2">
            {dynamicDistribution.slice(0, 6).map((item) => (
              <div key={item.name} className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-zinc-400 truncate">{item.name}</span>
                </div>
                <span className="text-white font-mono">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-white/5">
            <p className="text-base text-zinc-500 uppercase tracking-wider mb-3">Top 5 Países Atacantes</p>
            <div className="space-y-2">
              {isClient ? (
                topAttackerCountries.length ? (
                  topAttackerCountries.map((entry) => {
                    const code = entry.code;
                    const src = code !== "zz" ? `/flags/${code}_32.png` : "/globe.svg";
                    const alt = code !== "zz" ? code.toUpperCase() : "Unknown";

                    return (
                      <div
                        key={code}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <img src={src} alt={alt} width={32} height={32} className="h-8 w-8 rounded-sm" />
                          <span className="min-w-0 truncate text-[15px] text-zinc-100">{entry.name}</span>
                        </div>
                        <span className="font-mono text-[15px] text-white">{entry.percent}%</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-base text-zinc-500">Sin datos suficientes en la ventana actual.</p>
                )
              ) : (
                <div className="h-20 w-full rounded-xl border border-white/5 bg-black/30" />
              )}
            </div>
          </div>
        </Card>

        <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0 h-full">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-white font-medium">Top Atacantes</h3>
              <p className="text-base text-zinc-500">IPs de origen con más alertas en la ventana actual</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="red" size="xs">Top 5</Badge>
              <button
                type="button"
                onClick={() => openIntel("top-attackers")}
                aria-label="Ayuda contextual"
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-xs font-semibold text-zinc-200 hover:border-white/20 hover:text-white"
              >
                i
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isClient ? (
              topAttackers.length > 0 ? (
                topAttackers.map((attacker, index) => (
                  <div key={attacker.srcIp} className="rounded-xl border border-white/5 bg-black/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-base">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-hyper-accent/10 text-sm font-semibold text-hyper-accent">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex items-center gap-2">
                          <IPProfilePopover
                            ip={attacker.srcIp}
                            intel={srcIntelByIp.get(attacker.srcIp) ?? null}
                            className="min-w-0 inline-flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
                            textClassName="min-w-0 truncate font-mono text-[15px] text-zinc-100 hover:text-white"
                          />
                          <span className="shrink-0 text-zinc-600">|</span>
                          {(() => {
                            const primaryType = attackerPrimaryTypeByIp.get(String(attacker.srcIp));
                            const portMeta = attackerTopDstPortByIp.get(String(attacker.srcIp));
                            const topPort = portMeta?.port ?? null;
                            const portService = topPort != null ? getPortServiceName(topPort) : null;
                            const portLabel =
                              topPort != null
                                ? portService
                                  ? `Port: ${topPort} (${portService})`
                                  : `Port: ${topPort}`
                                : "Port: --";
                            const isIntrusionRiskPort = topPort != null && [21, 22, 23, 445].includes(topPort);
                            const lastSeenLabel =
                              portMeta?.lastSeenMs != null
                                ? `Último visto: ${new Date(portMeta.lastSeenMs).toLocaleTimeString("es-ES", { hour12: false, timeZone: MADRID_TIME_ZONE })}`
                                : "Último visto: --:--:--";
                            const frequencyLabel = portMeta?.count != null ? `Frecuencia: ${portMeta.count}` : "Frecuencia: --";
                            if (!primaryType) {
                              return (
                                <span className="shrink-0 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openIntel("top-attackers", "attack-label")}
                                    className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:border-white/20"
                                  >
                                    [Benigno]
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openIntel("top-attackers", "ports")}
                                    className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:border-white/20"
                                  >
                                    {portLabel}
                                  </button>
                                  {isIntrusionRiskPort ? (
                                    <button
                                      type="button"
                                      onClick={() => openIntel("top-attackers", "intrusion-risk")}
                                      className="inline-flex items-center rounded-full border border-red-500/40 bg-red-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:border-red-400/60"
                                    >
                                      [Riesgo de Intrusión]
                                    </button>
                                  ) : null}
                                </span>
                              );
                            }

                            const color = colorsByLabel[primaryType] ?? "#f97316";
                            return (
                              <span className="shrink-0 flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openIntel("top-attackers", "attack-label")}
                                  className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-semibold hover:border-white/20"
                                  style={{ color }}
                                >
                                  [{primaryType}]
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openIntel("top-attackers", "ports")}
                                  className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:border-white/20"
                                >
                                  {portLabel}
                                </button>
                                {isIntrusionRiskPort ? (
                                  <button
                                    type="button"
                                    onClick={() => openIntel("top-attackers", "intrusion-risk")}
                                    className="inline-flex items-center rounded-full border border-red-500/40 bg-red-600/80 px-2.5 py-1 text-xs font-semibold text-white hover:border-red-400/60"
                                  >
                                    [Riesgo de Intrusión]
                                  </button>
                                ) : null}
                              </span>
                            );
                          })()}
                        </div>
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
                <p className="text-lg text-zinc-500">Sin alertas suficientes para construir un ranking.</p>
              )
            ) : (
              <p className="text-lg text-zinc-500">Cargando ranking...</p>
            )}
          </div>
        </Card>

        
      </MotionGridTag>

      {isTacticalOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mx-auto h-full w-full max-w-7xl rounded-2xl border border-white/10 bg-hyper-surface p-6 overflow-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-4xl font-semibold text-white">Vista Táctica — Estado de Activos Críticos</h2>
                <p className="mt-1 text-lg text-zinc-400">Grid ampliada para demo (colores y ataques potenciados).</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTacticalOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.25em] text-zinc-200 transition-all hover:border-white/20 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-8">
              <div className="flex flex-col gap-6 xl:flex-row">
                <div className="flex-1">
                  <div className="grid grid-cols-8 gap-4 place-items-center">
                    {infrastructureAssets.map((asset) => {
                      const ui = getInfrastructureSeverityUi(asset.severity);
                      const isSelected = String(selectedAssetIp) === String(asset.dstIp);
                      const hasRecentRing = hasRecentMaxSeverityRingByDstIp.get(String(asset.dstIp)) ?? false;

                      return (
                        <button
                          key={asset.dstIp}
                          type="button"
                          onClick={() => setSelectedAssetIp(String(asset.dstIp))}
                          className={`group cursor-pointer outline-none ${isSelected ? "ring-2 ring-white/20 rounded-xl" : ""}`}
                        >
                          <div className="mb-2 flex items-center justify-center">
                            <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-sm font-mono text-white">
                              {Number(asset.count ?? 0).toLocaleString("es-ES")}
                            </span>
                          </div>
                          <div className="relative grid place-items-center">
                            <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-xs font-mono text-zinc-100 opacity-0 group-hover:opacity-100 transition-none">
                              {String(asset.dstIp)}
                            </div>

                            <div
                              className={`relative h-16 w-16 ${ui.glow} [transform:skewX(-12deg)_skewY(6deg)] ${
                                hasRecentRing ? "ring-2 ring-red-500/80 shadow-[0_0_16px_rgba(239,68,68,0.4)] rounded-lg" : ""
                              }`}
                            >
                              <div className={`absolute inset-0 rounded-lg border ${ui.cube} bg-black/30`} />
                              <div
                                className={`absolute -top-3 left-2 right-2 h-3 rounded-t-lg border border-white/10 ${ui.top} [transform:skewX(-35deg)]`}
                              />
                              <div
                                className={`absolute top-2 -right-3 bottom-2 w-3 rounded-r-lg border border-white/10 ${ui.side} [transform:skewY(-35deg)]`}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-base font-mono text-zinc-100 select-none">
                                  {String(asset.dstIp).split(".").slice(-1)[0] ?? "--"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-5">
                  {selectedAsset ? (
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">Ficha del Activo</p>
                          <div className="mt-2">
                            <IPProfilePopover
                              ip={selectedAsset.dstIp}
                              intel={dstIntelByIp.get(String(selectedAsset.dstIp)) ?? null}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:border-white/20"
                              textClassName="text-3xl font-semibold text-white font-mono break-all"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => openIntel("assets", "ioc")}
                            className="mt-1 text-left text-base text-zinc-400 hover:text-zinc-200"
                          >
                            Índice de Compromiso (IoC): {selectedAsset.ui.label}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedAssetIp(null)}
                          className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-200 hover:border-white/20 hover:text-white"
                        >
                          Cerrar
                        </button>
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between text-base text-zinc-400">
                          <span>IoC máximo</span>
                          <span className="font-mono text-white">{selectedAsset.threatPercent}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              selectedAsset.severity === "critical"
                                ? "bg-rose-500"
                                : selectedAsset.severity === "high"
                                  ? "bg-orange-400"
                                  : selectedAsset.severity === "medium"
                                    ? "bg-yellow-300"
                                    : "bg-zinc-500"
                            }`}
                            style={{ width: `${selectedAsset.threatPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-6">
                        <h4 className="text-base font-semibold text-white">Vectores de Intrusión Detectados</h4>
                        {selectedAsset.attackSkills.length ? (
                          <div className="mt-3 grid grid-cols-1 gap-2">
                            {selectedAsset.attackSkills.map((skill) => (
                              <div
                                key={skill.label}
                                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                              >
                                <span className="text-base text-zinc-200">{skill.label}</span>
                                <span className="font-mono text-white">{Number(skill.count).toLocaleString("es-ES")}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-base text-zinc-500">Sin ataques (solo tráfico benigno registrado).</p>
                        )}
                      </div>

                      <div className="mt-6">
                        <h4 className="text-base font-semibold text-white">Puertos Bajo Ataque</h4>
                        {selectedAsset.attackPorts.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedAsset.attackPorts.map((entry: { port: number; severity: InfrastructureSeverity; hasExploit: boolean }) => (
                              <button
                                key={entry.port}
                                type="button"
                                onClick={() => openIntel("assets", "ports")}
                                className={`rounded-full border px-3 py-1 text-sm font-semibold ${getPortPillUi(entry.severity)} ${
                                  entry.hasExploit ? "ring-2 ring-red-500" : ""
                                }`}
                              >
                                {formatPortWithService(entry.port)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-base text-zinc-500">Sin puertos detectados en las alertas de este activo.</p>
                        )}
                      </div>

                      <div className="mt-6">
                        <h4 className="text-base font-semibold text-white">Logs Recientes</h4>
                        {selectedAsset.recentLogs.length ? (
                          <div className="mt-3 space-y-2">
                            {selectedAsset.recentLogs.map((log: any) => {
                              const confidenceScore = Number(log?.gnn_metadata?.confidence_score ?? 0);
                              const binaryLabel = Number(log?.gnn_metadata?.label_binary ?? 0);
                              const priority = getPriorityLabel(confidenceScore, binaryLabel);
                              return (
                                <div
                                  key={String(log?.alert_id ?? log?.timestamp ?? Math.random())}
                                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-base text-zinc-300">
                                      Log Time: {isClient ? formatIncidentTime(log?.timestamp) : "--:--:--"} · {String(
                                        log?.gnn_metadata?.label_multiclass ?? "Evento"
                                      )}
                                    </span>
                                    <span className="text-sm font-semibold text-zinc-200">{priority}</span>
                                  </div>
                                  <div className="mt-1 text-sm font-mono text-zinc-500">{String(log?.alert_id ?? "")}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 text-base text-zinc-500">Sin logs disponibles.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-base text-zinc-400">Selecciona un cubo para ver la ficha del activo.</p>
                      <p className="mt-2 text-sm text-zinc-600">Panel fijo (sin tooltip).</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      <IntelDrawer
        open={isIntelOpen}
        context={intelContext}
        topic={intelTopic}
        originCountryBreakdown={originCountryBreakdown}
        onClose={closeIntel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-6 pb-12">
        <div className="lg:col-span-2 flex min-h-0 flex-col gap-4 self-start">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-medium text-white flex items-center gap-2">Narrativa de Incidentes (Real-Time)</h2>
            <InfoDot onClick={() => openIntel("incidents")} label="Ayuda contextual: Narrativa de Incidentes" />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-base text-zinc-500">
            <span>Mostrando últimos {incidentFeedLimit} incidentes.</span>
            <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-black/30">
              {([20, 50, 100] as const).map((limit) => {
                const isActive = incidentFeedLimit === limit;
                return (
                  <button
                    key={limit}
                    type="button"
                    onClick={() => setIncidentFeedLimit(limit)}
                    className={`px-3 py-1 text-xs font-semibold transition-colors ${
                      isActive ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                    }`}
                    aria-pressed={isActive}
                    aria-label={`Mostrar últimos ${limit} incidentes`}
                  >
                    {limit}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid max-h-[calc(100vh-18rem)] grid-cols-1 gap-6 overflow-y-auto pr-2 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
            {recentAlerts.map((alerta: any, index: number) => {
              const narrative = buildNarrative(alerta);
              const stripeClass =
                narrative.priority === "Crítica"
                  ? "bg-rose-500"
                  : narrative.priority === "Alta"
                    ? "bg-orange-400"
                    : narrative.priority === "Media"
                      ? "bg-zinc-500"
                      : "bg-zinc-700";
              const fullId = String(alerta.alert_id ?? "");
              const shortId = truncateAlertId(fullId);

              const investigationHref = `/investigacion?${new URLSearchParams({
                id: fullId,
                src_ip: String(alerta.network_data?.src_ip ?? ""),
                attack_type: String(getAttackType(alerta) ?? ""),
                dst_port: String(alerta.network_data?.dst_port ?? ""),
                timestamp: String(alerta.timestamp ?? ""),
              }).toString()}`;

              return (
              <MotionAlertTag
                key={alerta.alert_id ?? index}
                {...(isClient
                  ? {
                      initial: { opacity: 0, x: -20 },
                      animate: { opacity: 1, x: 0 },
                      transition: { duration: 0.4, delay: Math.min(index * 0.03, 0.6) },
                    }
                  : {})}
              >
                <Card className="relative bg-hyper-surface border-hyper-border ring-0 h-full flex flex-col overflow-hidden">
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${stripeClass}`} />
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-medium text-white">
                      {String(alerta.gnn_metadata?.label_multiclass ?? alerta.gnn_metadata?.label_multiclase ?? "")}
                    </h3>
                    <div className="text-right">
                      <p className="text-base font-medium text-zinc-300">Data Time: {isClient ? formatIncidentTime(alerta.timestamp) : "--:--:--"}</p>
                      <p className="text-base font-semibold text-hyper-accent font-mono" title={fullId}>
                        {shortId}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="bg-black/60 rounded-t-md p-3 font-mono text-lg text-zinc-400 border border-white/5 border-b-0">
                      <span className="text-hyper-accent mr-2">ORIGEN:</span> {alerta.network_data?.src_ip}:
                      {(() => {
                        const port = normalizePortNumber(alerta.network_data?.src_port);
                        return port != null ? formatPortWithService(port) : String(alerta.network_data?.src_port ?? "--");
                      })()}
                      <span className="mx-2 text-zinc-600">→</span>
                      <span className="text-blue-400 mr-2">DESTINO:</span> {alerta.network_data?.dst_ip}:
                      {(() => {
                        const port = normalizePortNumber(alerta.network_data?.dst_port);
                        return port != null ? formatPortWithService(port) : String(alerta.network_data?.dst_port ?? "--");
                      })()}
                    </div>
                    <div className="bg-hyper-accent/5 border border-hyper-accent/10 rounded-b-md p-4 flex gap-3 items-start">
                      <span className="text-hyper-accent text-lg mt-0.5">✨</span>
                      <div className="flex flex-col gap-2">
                        <p className="text-zinc-100 text-xl leading-relaxed">
                          {narrative.summary}
                        </p>
                        <p className="text-zinc-300 text-lg italic border-l border-white/10 pl-3">{narrative.detail}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-base text-zinc-500">
                      <span>Confianza GNN: {(alerta.gnn_metadata?.confidence_score * 100).toFixed(1)}%</span>
                      <span className="text-zinc-700">•</span>
                      <span>{narrative.protocolName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={investigationHref}
                        className="rounded-xl border border-hyper-accent/25 bg-hyper-accent/10 px-4 py-2 text-sm font-semibold text-white transition-all ring-1 ring-hyper-accent/20 hover:border-hyper-accent/40 hover:bg-hyper-accent/15 hover:ring-hyper-accent/40"
                        aria-label="Investigar incidente con IA"
                      >
                        Investigar con IA 🤖
                      </Link>
                    </div>
                  </div>
                </Card>
              </MotionAlertTag>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-1 self-start">
          <div className="sticky top-6">
            <div className="flex flex-col gap-6">
              <Card className="bg-hyper-surface border-hyper-border ring-0 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-white font-medium">Estado de Activos Críticos</h3>
                    <p className="text-base text-zinc-500">Destinos dst_ip con vista 3D</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsTacticalOpen(true)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-200 transition-all hover:border-hyper-accent/40 hover:text-white hover:shadow-[0_0_12px_rgba(249,115,22,0.18)]"
                    >
                      Expandir Vista Táctica
                    </button>
                    <button
                      type="button"
                      onClick={() => openIntel("assets")}
                      aria-label="Ayuda contextual"
                      className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/30 text-xs font-semibold text-zinc-200 hover:border-white/20 hover:text-white"
                    >
                      i
                    </button>
                  </div>
                </div>

                <div className="mt-4 px-2">
                  <div className="mx-auto w-full max-w-[520px] overflow-visible py-6">
                    <div className="grid grid-cols-6 gap-3 place-items-center">
                      {infrastructureAssets.map((asset) => {
                        const ui = getInfrastructureSeverityUi(asset.severity);
                        const hasRecentRing = hasRecentMaxSeverityRingByDstIp.get(String(asset.dstIp)) ?? false;

                        return (
                          <div key={asset.dstIp} className="group">
                            <div className="mb-1 flex items-center justify-center">
                              <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-sm font-mono text-white">
                                {Number(asset.count ?? 0).toLocaleString("es-ES")}
                              </span>
                            </div>

                            <div className="relative grid place-items-center">
                              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-1 text-xs font-mono text-zinc-100 opacity-0 group-hover:opacity-100 transition-none">
                                {String(asset.dstIp)}
                              </div>

                              <div
                                className={`relative h-10 w-10 ${ui.glow} [transform:skewX(-12deg)_skewY(6deg)] ${
                                  hasRecentRing ? "ring-2 ring-red-500/80 shadow-[0_0_14px_rgba(239,68,68,0.35)] rounded-md" : ""
                                }`}
                              >
                                <div className={`absolute inset-0 rounded-md border ${ui.cube} bg-black/40`} />
                                <div
                                  className={`absolute -top-2 left-1 right-1 h-2 rounded-t-md border border-white/10 ${ui.top} [transform:skewX(-35deg)]`}
                                />
                                <div
                                  className={`absolute top-1 -right-2 bottom-1 w-2 rounded-r-md border border-white/10 ${ui.side} [transform:skewY(-35deg)]`}
                                />

                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-sm font-mono text-zinc-200 select-none">
                                    {String(asset.dstIp).split(".").slice(-1)[0] ?? "--"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-base text-zinc-500">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500/80" />Crítica</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400/80" />Alta</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-300/80" />Media</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-500/50" />Baja</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="bg-zinc-900/80 backdrop-blur-md border border-white/10 ring-0 flex flex-col shadow-2xl overflow-hidden">
                <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                  <div className="w-2 h-2 rounded-full bg-hyper-accent animate-pulse" />
                  <h3 className="text-white font-medium">SOC Assistant</h3>
                </div>
                <div className="py-4 space-y-4 text-lg text-zinc-400">
                  <p>Bienvenido al asistente de investigación. Selecciona una alerta para profundizar en el contexto del RAG.</p>
                  <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <p className="text-base font-bold text-hyper-accent uppercase mb-1">Sugerencia:</p>
                    "¿Qué otros destinos ha visitado la IP {alerts[0]?.network_data?.src_ip} en la última hora?"
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10 mt-auto">
                  <input type="text" placeholder="Consultar memoria técnica..." className="w-full bg-black/50 border border-white/10 rounded-md py-2.5 px-3 text-lg text-white outline-none focus:border-hyper-accent" />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
