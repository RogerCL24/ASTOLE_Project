"use client";
import { motion } from "framer-motion";
import { Card, Badge, Button, DonutChart } from "@tremor/react";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// HACK TAILWIND V4
const tremorSafelist = "bg-amber-500 fill-amber-500 stroke-amber-500 text-amber-500 bg-orange-500 fill-orange-500 stroke-orange-500 text-orange-500 bg-yellow-500 fill-yellow-500 stroke-yellow-500 text-yellow-500";

// --- DATOS SIMULADOS ---
const trafico60s = [
  { tiempo: "00s", "Tráfico Normal": 230, "Tráfico Anómalo": 10 },
  { tiempo: "10s", "Tráfico Normal": 250, "Tráfico Anómalo": 15 },
  { tiempo: "20s", "Tráfico Normal": 210, "Tráfico Anómalo": 25 },
  { tiempo: "30s", "Tráfico Normal": 280, "Tráfico Anómalo": 180 }, 
  { tiempo: "40s", "Tráfico Normal": 240, "Tráfico Anómalo": 320 },
  { tiempo: "50s", "Tráfico Normal": 220, "Tráfico Anómalo": 150 },
  { tiempo: "60s", "Tráfico Normal": 260, "Tráfico Anómalo": 40 },
];

const distribucionAmenazas = [
  { name: "Movimiento Lateral", value: 45, color: "#f97316" }, // Orange 500
  { name: "Exfiltración DNS", value: 35, color: "#f59e0b" },   // Amber 500
  { name: "Escaneo de Puertos", value: 20, color: "#eab308" }, // Yellow 500
];

// 🟢 ACTUALIZADO: Datos enriquecidos con métricas AI y Logs crudos
const alertasEnVivo = [
  {
    id: "ALT-092", tipoGNN: "Movimiento Lateral", severidad: "Crítica", color: "red",
    rawLog: "event=ssh_fail src=192.168.1.45 dst=db-prod count=32",
    resumenLLM: "Possible lateral movement attempt from Sales workstation towards production database via repeated SSH failures.",
    tokens: 145, tiempo: "Hace 12s",
    riskScore: 8.7, likelihood: "High", confidence: "92%"
  },
  {
    id: "ALT-093", tipoGNN: "Exfiltración DNS", severidad: "Alta", color: "orange",
    rawLog: "query=txt len=512 dst=8.8.8.8 domain=unknown-c2.com",
    resumenLLM: "Unusually long TXT queries directed to an unknown external DNS server, indicating possible data exfiltration.",
    tokens: 189, tiempo: "Hace 45s",
    riskScore: 7.4, likelihood: "Medium", confidence: "85%"
  }
];

export default function Capa1Triaje() {
  return (
    <div className="min-h-screen p-8 lg:p-12 font-sans relative z-10 flex flex-col gap-8">
      
      {/* HEADER TÁCTICO */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex justify-between items-end"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Dashboard</h1>
          <p className="text-zinc-400 text-sm flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hyper-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-hyper-accent"></span>
            </span>
            Ventana actual: 10:45:00 - 10:46:00
          </p>
        </div>
        
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reducción (GNN)</p>
            <p className="text-xl font-mono text-white">15k <span className="text-zinc-500 text-sm">→</span> 2</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Coste AI</p>
            <p className="text-xl font-mono text-green-400">334 <span className="text-xs text-zinc-500">tks</span></p>
          </div>
        </div>
      </motion.header>

      {/* PANEL VISUAL (Gráficos) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <Card className="bg-hyper-surface border-hyper-border ring-0 lg:col-span-2">
          <h3 className="text-white font-medium mb-1">Firma de Tráfico (Últimos 60s)</h3>
          <p className="text-xs text-zinc-500 mb-4">Volumen de paquetes NetFlow analizados</p>
          
          <div className="h-48 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafico60s} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAnomalo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                
                <XAxis dataKey="tiempo" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`}/>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-hyper-surface)', borderColor: 'var(--color-hyper-border)', borderRadius: '8px', color: '#ededed' }} 
                  itemStyle={{ color: '#ededed' }}
                />
                
                <Area type="monotone" dataKey="Tráfico Normal" stroke="#f59e0b" fillOpacity={1} fill="url(#colorNormal)" />
                <Area type="monotone" dataKey="Tráfico Anómalo" stroke="#ff4108" fillOpacity={1} fill="url(#colorAnomalo)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráfico 2: Distribución del Ataque (RECHARTS PURO + DEEP TECH) */}
        <Card className="bg-hyper-surface border-hyper-border ring-0 flex flex-col justify-between">
          <div>
            <h3 className="text-white font-medium text-center mb-1">Composición de la Alerta</h3>
            <p className="text-xs text-zinc-500 text-center mb-2">Tipos de ataque detectados</p>
          </div>

          {/* El Donut Personalizado */}
          <div className="h-36 w-full relative mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribucionAmenazas}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4} /* Le da un toque muy moderno a los bordes */
                >
                  {distribucionAmenazas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#1f1f22', borderRadius: '8px', fontSize: '12px', color: '#ededed' }}
                  itemStyle={{ color: '#ededed' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Texto en el centro del Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-mono text-white">3</span>
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">Vectores</span>
            </div>
          </div>

          {/* Leyenda Analítica Custom */}
          <div className="flex flex-col gap-2 mt-4 w-full px-2">
            {distribucionAmenazas.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {/* Punto con resplandor (Glow) usando boxShadow */}
                  <span 
                    className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" 
                    style={{ color: item.color, backgroundColor: item.color }} 
                  />
                  <span className="text-zinc-400">{item.name}</span>
                </div>
                <span className="text-white font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  {item.value}%
                </span>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* SECCIÓN INFERIOR: FEED DE ALERTAS + SOC ASSISTANT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full pb-12">
        
        {/* COLUMNA IZQUIERDA: Alertas (Ocupa 2 espacios) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-hyper-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Narrativa de Incidentes
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            {alertasEnVivo.map((alerta, index) => (
              <motion.div key={alerta.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.4 + (index * 0.1) }}>
                <Card className="bg-hyper-surface border-hyper-border ring-0 h-full flex flex-col">
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <Badge color={alerta.color} className="font-mono">{alerta.severidad}</Badge>
                      <h3 className="text-md font-medium text-white">{alerta.tipoGNN}</h3>
                    </div>
                    {/* 🟢 FEATURE 3: AI Prioritization Badges */}
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">Confidence: {alerta.confidence}</span>
                        <span className="text-xs font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded border border-red-400/20">
                          Risk: {alerta.riskScore}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Likelihood: {alerta.likelihood}</span>
                    </div>
                  </div>

                  {/* 🟢 FEATURE 1: AI Summarizer (Raw Log vs Human Text) */}
                  <div className="mb-4">
                    <div className="bg-black/60 rounded-t-md p-3 font-mono text-xs text-zinc-500 border border-white/5 border-b-0 break-all">
                      <span className="text-zinc-600 mr-2">{'>'}</span> {alerta.rawLog}
                    </div>
                    <div className="bg-hyper-accent/5 border border-hyper-accent/10 rounded-b-md p-3 flex gap-3 items-start">
                      <span className="text-hyper-accent text-sm mt-0.5 animate-pulse">✨</span>
                      <p className="text-zinc-300 text-sm leading-relaxed">
                        {alerta.resumenLLM}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-white/5">
                    <span className="text-xs text-zinc-500">Model: local-llama-3-8b • {alerta.tokens} tks</span>
                    <span className="text-xs text-zinc-500">{alerta.tiempo}</span>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 🟢 FEATURE 2: SOC Assistant Chat Copilot (Ocupa 1 espacio, pegado a la derecha) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
          className="lg:col-span-1 h-full"
        >
          <div className="sticky top-6 h-[calc(100vh-12rem)] min-h-[500px]">
            <Card className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 ring-0 h-full flex flex-col shadow-2xl">
              
              {/* Chat Header */}
              <div className="flex items-center gap-2 pb-4 border-b border-white/10">
                <div className="w-2 h-2 rounded-full bg-hyper-accent animate-pulse"></div>
                <h3 className="text-white font-medium">SOC Assistant</h3>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="bg-white/5 text-zinc-300 text-sm p-3 rounded-xl rounded-tl-sm w-[85%]">
                  Why was ALT-092 flagged?
                </div>
                <div className="bg-hyper-accent/10 border border-hyper-accent/20 text-zinc-200 text-sm p-3 rounded-xl rounded-tr-sm w-[90%] ml-auto flex flex-col gap-2">
                  <span className="text-hyper-accent text-xs font-mono">✨ Analysis Complete</span>
                  <p>Based on the GNN topology, 32 SSH failures within 10 seconds from a Sales IP to a Production DB is highly anomalous. Historical baseline shows 0 SSH traffic between these zones.</p>
                </div>
                
                {/* Sugerencias Rápidas */}
                <div className="flex flex-col gap-2 pt-2">
                  <button className="text-xs text-left bg-black/40 hover:bg-white/10 border border-white/5 text-zinc-400 p-2 rounded transition-colors">
                    Show related incidents
                  </button>
                  <button className="text-xs text-left bg-black/40 hover:bg-white/10 border border-white/5 text-zinc-400 p-2 rounded transition-colors">
                    Is this likely C2 traffic?
                  </button>
                </div>
              </div>

              {/* Chat Input */}
              <div className="pt-4 border-t border-white/10 mt-auto">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Ask Copilot..." 
                    className="w-full bg-black/50 border border-white/10 rounded-md py-2.5 pl-3 pr-10 text-sm text-white outline-none focus:border-hyper-accent transition-colors" 
                  />
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-hyper-accent transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </div>

            </Card>
          </div>
        </motion.div>

      </div>
    </div>
  );
}