"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, Badge } from "@tremor/react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// --- CONFIGURACIÓN ESTATICA ---
const tremorSafelist = "bg-amber-500 fill-amber-500 stroke-amber-500 text-amber-500 bg-orange-500 fill-orange-500 stroke-orange-500 text-orange-500 bg-yellow-500 fill-yellow-500 stroke-yellow-500 text-yellow-500";

// Colores para los gráficos dinámicos
const COLORS = ["#f97316", "#f59e0b", "#eab308", "#ef4444", "#8b5cf6"];

// Mock de tráfico (se mantiene para la estética visual del gráfico de área)
const trafico60s_mock = [
  { tiempo: "00s", "Tráfico Normal": 230, "Tráfico Anómalo": 10 },
  { tiempo: "10s", "Tráfico Normal": 250, "Tráfico Anómalo": 15 },
  { tiempo: "20s", "Tráfico Normal": 210, "Tráfico Anómalo": 25 },
  { tiempo: "30s", "Tráfico Normal": 280, "Tráfico Anómalo": 180 }, 
  { tiempo: "40s", "Tráfico Normal": 240, "Tráfico Anómalo": 320 },
  { tiempo: "50s", "Tráfico Normal": 220, "Tráfico Anómalo": 150 },
  { tiempo: "60s", "Tráfico Normal": 260, "Tráfico Anómalo": 40 },
];

const fallbackData = {
  metrics: {
    last_update: "2026-03-19T17:29:25Z",
    performance: {
      windows_processed: 100,
      total_flows_analyzed: 48387,
      total_alerts_triggered: 83,
      avg_latency_ms: 1.47,
      compression_rate_percent: 99.8285,
    },
    status: "COMPLETED",
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
        tokens_used: {
          total: 0,
        },
      },
    },
  ],
};

const normalizeAlert = (alert: any) => ({
  ...alert,
  gnn_metadata: {
    label_multiclass: alert.gnn_metadata?.label_multiclass ?? alert.gnn_metadata?.label_multiclase ?? "Unknown",
    label_binary: alert.gnn_metadata?.label_binary ?? alert.gnn_metadata?.binary_attack ?? 0,
    confidence_score: alert.gnn_metadata?.confidence_score ?? 0,
  },
  narrative: {
    executive_summary: alert.narrative?.executive_summary ?? alert.narrative?.summary ?? "Analizando comportamiento del flujo con inteligencia narrativa...",
    technical_detail: alert.narrative?.technical_detail ?? alert.technical_details ? `Duración: ${alert.technical_details.duration_ms}ms` : undefined,
  },
  metadata: alert.metadata ?? {
    tokens_used: {
      total: 0,
    },
  },
});

export default function Capa1Triaje() {
  const [data, setData] = useState<any>(fallbackData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/stats');
        const json = await res.json();
        setData({
          metrics: json.metrics ?? fallbackData.metrics,
          alerts: Array.isArray(json.alerts) ? json.alerts.map(normalizeAlert) : [normalizeAlert(json.alerts ?? fallbackData.alerts[0])],
        });
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const metrics = data.metrics?.performance || {};
  const alerts = Array.isArray(data.alerts) ? data.alerts : [data.alerts];
  const latencyValue = Number(metrics.avg_latency_ms ?? 0);
  const flowValue = Number(metrics.total_flows_analyzed ?? 0);
  const alertValue = Number(metrics.total_alerts_triggered ?? 0);
  const trafico60s = trafico60s_mock.map((point, index) => {
    const progression = index / Math.max(trafico60s_mock.length - 1, 1);
    const normalMultiplier = 0.9 + ((flowValue % 8) * 0.04) + (progression * 0.12);
    const anomalousMultiplier = 0.8 + ((latencyValue % 6) * 0.05) + ((alertValue % 5) * 0.03) + (progression * 0.18);

    return {
      ...point,
      "Tráfico Normal": Math.round(point["Tráfico Normal"] * normalMultiplier),
      "Tráfico Anómalo": Math.round(point["Tráfico Anómalo"] * anomalousMultiplier),
    };
  });
  
  // Calcular distribución de amenazas dinámicamente desde los logs reales
  const alertCounts = alerts.reduce((acc: any, alert: any) => {
    const label = alert.gnn_metadata?.label_multiclass || "Unknown";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const dynamicDistribution = Object.keys(alertCounts).map((key, i) => ({
    name: key,
    value: alertCounts[key],
    color: COLORS[i % COLORS.length]
  }));

  // Calcular total de tokens acumulados de las alertas
  const totalTokens = alerts.reduce((acc: number, curr: any) => acc + (curr.metadata?.tokens_used?.total || 0), 0);

  return (
    <div className="min-h-screen p-8 lg:p-12 font-sans relative z-10 flex flex-col gap-8 bg-black">
      
      {/* HEADER TÁCTICO - DATOS REALES */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex justify-between items-end"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Triaje en Vivo</h1>
          <p className="text-zinc-400 text-sm flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Última actualización: {new Date(data.metrics.last_update).toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex gap-10 text-right">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reducción (GNN)</p>
            <p className="text-xl font-mono text-white">
              {metrics.total_flows_analyzed?.toLocaleString()} 
              <span className="text-zinc-500 text-sm mx-2">→</span> 
              {metrics.total_alerts_triggered}
            </p>
            <p className="text-[10px] text-hyper-accent font-bold">-{metrics.compression_rate_percent?.toFixed(2)}% ruido</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Inversión AI</p>
            <p className="text-xl font-mono text-green-400">
                {totalTokens > 0 ? totalTokens : "---"} <span className="text-xs text-zinc-500">tks</span>
            </p>
            <p className="text-[10px] text-zinc-500">Model: GPT-4o-mini</p>
          </div>
        </div>
      </motion.header>

      {/* PANEL VISUAL (Gráficos) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <Card className="bg-hyper-surface border-hyper-border ring-0 lg:col-span-2 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-white font-medium mb-1">Firma de Tráfico (Motor Ingestión)</h3>
              <p className="text-xs text-zinc-500">
                Latencia actual: <span className="text-hyper-accent font-mono">{metrics.avg_latency_ms}ms</span>
              </p>
            </div>
            <Badge color="orange" size="xs">Real-Time Flow</Badge>
          </div>
          
          <div className="h-48 mt-6 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={trafico60s}>
                <defs>
                  <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAnomalo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="tiempo" stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#3f3f46" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
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

        <Card className="bg-hyper-surface border-hyper-border ring-0 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="text-white font-medium text-center mb-1">Composición de Amenazas</h3>
            <p className="text-xs text-zinc-500 text-center mb-2">Basado en alertas actuales</p>
          </div>

          <div className="h-36 w-full relative mt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={dynamicDistribution}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={6}
                  dataKey="value" stroke="none" cornerRadius={4}
                >
                  {dynamicDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#1f1f22', borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-mono text-white">{alerts.length}</span>
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
                <span className="text-white font-mono">{item.value} units</span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* FEED DE ALERTAS REALES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full pb-12">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
            Narrativa de Incidentes (Real-Time)
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            {alerts.map((alerta: any, index: number) => (
              <motion.div key={alerta.alert_id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: index * 0.1 }}>
                <Card className="bg-hyper-surface border-hyper-border ring-0 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Badge color={alerta.gnn_metadata?.label_binary === 1 ? "red" : "green"}>
                        {alerta.gnn_metadata?.label_binary === 1 ? "ATAQUE" : "BENIGNO"}
                      </Badge>
                      <h3 className="text-md font-medium text-white">{alerta.gnn_metadata?.label_multiclass}</h3>
                    </div>
                    <div className="text-right">
                       <p className="text-xs text-zinc-500">{new Date(alerta.timestamp).toLocaleTimeString()}</p>
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
                          {alerta.narrative?.executive_summary || "Analizando comportamiento del flujo con inteligencia narrativa..."}
                        </p>
                        {alerta.narrative?.technical_detail && (
                          <p className="text-zinc-500 text-xs italic border-l border-white/10 pl-3">
                            {alerta.narrative.technical_detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                    <span className="text-xs text-zinc-500">Confianza GNN: {(alerta.gnn_metadata?.confidence_score * 100).toFixed(1)}%</span>
                    <Badge color="gray" size="xs">Latencia: {metrics.avg_latency_ms}ms</Badge>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* SOC ASSISTANT */}
        <div className="lg:col-span-1 h-full">
          <div className="sticky top-6 h-[calc(100vh-12rem)]">
            <Card className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 ring-0 h-full flex flex-col shadow-2xl">
              <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                <div className="w-2 h-2 rounded-full bg-hyper-accent animate-pulse"></div>
                <h3 className="text-white font-medium">SOC Assistant</h3>
              </div>
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 text-sm text-zinc-400">
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