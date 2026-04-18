"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@tremor/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Barcode, Bot, Shield, Target } from "lucide-react";
import { IPProfilePopover, type IPIntelPayload } from "../../components/IPProfilePopover";
import { formatPortWithService, normalizePortNumber } from "../../lib/netIntel";
import DecryptedText from "../../components/ui/DecryptedText";
import SpotlightCard from "../../components/ui/SpotlightCard";
import Magnetic from "../../components/ui/Magnetic";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const dotMeshOverlayClass =
  "pointer-events-none absolute inset-0 opacity-[0.15] bg-[radial-gradient(circle,rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:18px_18px]";

const formatMadridDateTime = (value: unknown) => {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
};

const getPriorityLabel = (confidenceScore: number, binaryLabel: number) => {
  if (binaryLabel !== 1) return "Baja";
  if (confidenceScore >= 0.97) return "Crítica";
  if (confidenceScore >= 0.95) return "Alta";
  return "Media";
};

const getAttackFrequencyLabel = (count: number) => {
  if (count >= 25) return "Alta";
  if (count >= 10) return "Media";
  return "Baja";
};

const getAlertAttackLabel = (alert: any) => {
  if (!alert) return "--";
  const direct = String(alert?.attack_type ?? alert?.attackType ?? "").trim();
  if (direct) return direct;

  const gnn = alert?.gnn_metadata;
  const fromGnn = (
    String(gnn?.label_multiclase ?? "").trim() ||
    String(gnn?.label_multiclass ?? "").trim() ||
    String(gnn?.labelMulticlass ?? "").trim() ||
    String(gnn?.label_multiclase_pred ?? "").trim()
  ).trim();

  return fromGnn || "--";
};

export default function InvestigacionConsole({
  caseId,
  srcIp,
  attackType,
  dstPort,
  timestamp,
}: {
  caseId: string;
  srcIp: string;
  attackType: string;
  dstPort: string;
  timestamp: string;
}) {
  const hasSelectedCase = Boolean(caseId && caseId !== "--");
  const [pivotMode, setPivotMode] = useState<"origin" | "destination">("origin");

  useEffect(() => {
    if (hasSelectedCase) setPivotMode("origin");
  }, [hasSelectedCase]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsStatus, setAlertsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setAlertsStatus("loading");
        const response = await fetch("/api/stats", { cache: "no-store" });
        const payload = await response.json();
        const incoming = Array.isArray(payload?.alerts) ? payload.alerts : [];
        if (!cancelled) {
          setAlerts(incoming);
          setAlertsStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setAlerts([]);
          setAlertsStatus("error");
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAlert = useMemo(() => {
    if (!alerts.length || !caseId || caseId === "--") return null;
    return alerts.find((a: any) => String(a?.alert_id ?? "") === String(caseId)) ?? null;
  }, [alerts, caseId]);

  const effectiveSrcIp = useMemo(() => {
    const fromUrl = srcIp && srcIp !== "--" ? String(srcIp) : "";
    const fromAlert = String(selectedAlert?.network_data?.src_ip ?? "").trim();
    return (fromUrl || fromAlert || "--").trim() || "--";
  }, [selectedAlert, srcIp]);

  const effectiveSrcIntel = useMemo(() => {
    return (selectedAlert?.ip_intel?.src as IPIntelPayload | undefined) ?? null;
  }, [selectedAlert]);

  const effectiveAttackType = useMemo(() => {
    const fromUrl = String(attackType ?? "").trim();
    const urlUseful = fromUrl && fromUrl !== "--" && fromUrl.toLowerCase() !== "actividad";

    const fromAlert = getAlertAttackLabel(selectedAlert);

    if (urlUseful) return fromUrl;
    if (fromAlert) return fromAlert;
    return (fromUrl || "--").trim() || "--";
  }, [attackType, selectedAlert]);

  const severityUi = useMemo(() => {
    const raw = String(effectiveAttackType ?? "").trim();
    const normalized = raw.toLowerCase();
    if (normalized.includes("exploit")) {
      return { label: "Exploit", className: "border-rose-400/35 bg-rose-500/15 text-rose-100" };
    }
    if (normalized.includes("dos")) {
      return { label: "DoS", className: "border-orange-400/35 bg-orange-500/15 text-orange-100" };
    }
    if (normalized.includes("recon")) {
      return { label: "Recon", className: "border-yellow-300/35 bg-yellow-400/15 text-yellow-100" };
    }
    if (raw && raw !== "--") {
      return { label: raw, className: "border-white/15 bg-white/5 text-zinc-100" };
    }
    return { label: "Evidencia", className: "border-white/10 bg-black/30 text-zinc-200" };
  }, [effectiveAttackType]);

  const selectedDstIp = useMemo(() => {
    const dst = selectedAlert?.network_data?.dst_ip;
    return dst ? String(dst) : "--";
  }, [selectedAlert]);

  const selectedDstPortLabel = useMemo(() => {
    const fromUrl = dstPort && dstPort !== "--" ? String(dstPort) : "";
    const fromAlert = String(selectedAlert?.network_data?.dst_port ?? "").trim();
    const raw = (fromUrl || fromAlert || "--").trim() || "--";
    const portNumber = normalizePortNumber(raw);
    return portNumber != null ? formatPortWithService(portNumber) : "--";
  }, [dstPort, selectedAlert]);

  const detectionTime = useMemo(() => {
    if (timestamp && timestamp !== "--") return timestamp;
    return selectedAlert?.timestamp ?? "--";
  }, [selectedAlert, timestamp]);

  const networkContext = useMemo(() => {
    if (!alerts.length || !effectiveSrcIp || effectiveSrcIp === "--") {
      return { otherVictims: 0, frequencyLabel: "--" as const, frequencyCount: 0 };
    }

    const allForSource = alerts.filter((a: any) => String(a?.network_data?.src_ip ?? "") === String(effectiveSrcIp));
    const count = allForSource.length;
    const frequencyLabel = getAttackFrequencyLabel(count);

    const currentDstIp = String(selectedAlert?.network_data?.dst_ip ?? "");
    const victims = new Set(
      allForSource
        .map((a: any) => String(a?.network_data?.dst_ip ?? ""))
        .filter((value: string) => value && value !== "Desconocida" && value !== currentDstIp)
    );

    return { otherVictims: victims.size, frequencyLabel, frequencyCount: count };
  }, [alerts, effectiveSrcIp, selectedAlert]);

  const relatedAlerts = useMemo(() => {
    if (!alerts.length || !hasSelectedCase || !selectedAlert) return [];

    const currentId = String(selectedAlert?.alert_id ?? "");
    const related = alerts.filter((a: any) => {
      const id = String(a?.alert_id ?? "");
      if (!id || id === currentId) return false;

      if (pivotMode === "origin") {
        return String(a?.network_data?.src_ip ?? "") === String(effectiveSrcIp);
      }

      const dstIp = String(selectedAlert?.network_data?.dst_ip ?? "");
      if (!dstIp) return false;
      return String(a?.network_data?.dst_ip ?? "") === dstIp;
    });

    return related
      .sort((left: any, right: any) => {
        const lt = new Date(String(left?.timestamp ?? 0)).getTime();
        const rt = new Date(String(right?.timestamp ?? 0)).getTime();
        return (Number.isFinite(rt) ? rt : 0) - (Number.isFinite(lt) ? lt : 0);
      })
      .slice(0, 12);
  }, [alerts, effectiveSrcIp, hasSelectedCase, pivotMode, selectedAlert]);

  const initialMessage = useMemo(() => {
    if (!hasSelectedCase) {
      return "Seleccione un caso para iniciar la investigación. Puedes elegir uno de los críticos sugeridos o abrir un incidente desde el feed.";
    }

    const ip = effectiveSrcIp && effectiveSrcIp !== "--" ? effectiveSrcIp : "la IP";
    const relatedCount = relatedAlerts.length;
    return `Iniciando sesión de investigación técnica... Cargando contexto de red para ${ip}. ${relatedCount} alertas relacionadas encontradas para pivotar.`;
  }, [effectiveSrcIp, hasSelectedCase, relatedAlerts.length]);

  const criticalSuggestions = useMemo(() => {
    if (alertsStatus === "loading" || alertsStatus === "idle") return [];

    const critical = alerts
      .map((a: any) => {
        const confidence = Number(a?.gnn_metadata?.confidence_score ?? 0);
        const binaryLabel = Number(a?.gnn_metadata?.binary_attack ?? a?.gnn_metadata?.label_binary ?? 0);
        const priority = getPriorityLabel(confidence, binaryLabel);
        return { alert: a, priority };
      })
      .filter((entry) => entry.priority === "Crítica")
      .sort((left, right) => {
        const lt = new Date(String(left.alert?.timestamp ?? 0)).getTime();
        const rt = new Date(String(right.alert?.timestamp ?? 0)).getTime();
        return (Number.isFinite(rt) ? rt : 0) - (Number.isFinite(lt) ? lt : 0);
      })
      .slice(0, 5)
      .map((entry) => entry.alert);

    if (critical.length) return critical;

    if (alertsStatus === "error") {
      // Fallback mock si no hay datos (modo demo/sidebar)
      return [
        {
          alert_id: "DEMO-CRIT-001",
          network_data: { src_ip: "198.51.100.23", dst_port: 22 },
          attack_type: "Exploits",
          timestamp: new Date().toISOString(),
        },
        {
          alert_id: "DEMO-CRIT-002",
          network_data: { src_ip: "203.0.113.9", dst_port: 445 },
          attack_type: "Exploits",
          timestamp: new Date().toISOString(),
        },
      ].slice(0, 5);
    }

    return [];
  }, [alerts, alertsStatus]);

  useEffect(() => {
    setMessages([{ role: "assistant", content: initialMessage }]);
  }, [initialMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setDraft("");
  };

  return (
    <div className="relative z-10 p-6 lg:p-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-white">Sala de Investigación</h1>
        <p className="mt-2 text-base text-zinc-400">Consola mixta: evidencia a la izquierda y Chat RAG a la derecha.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <motion.div
          className="xl:sticky xl:top-6 xl:self-start"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="space-y-6">
            <Card className="relative overflow-hidden bg-hyper-surface/60 border-hyper-border ring-0 backdrop-blur-md">
              <div aria-hidden className={dotMeshOverlayClass} />
              <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-zinc-400">Evidencia</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {hasSelectedCase ? (
                      <DecryptedText
                        text="Expediente de Caso"
                        animateOn="view"
                        revealDuration={0.8}
                        sequential
                        characters={'0101X?#&."'}
                      />
                    ) : (
                      "Seleccione un Caso para Investigar"
                    )}
                  </h2>
                </div>
                {hasSelectedCase ? (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-4 py-2 text-base font-semibold ${severityUi.className}`}>
                      Severidad: {severityUi.label}
                    </span>
                  </div>
                ) : null}
              </div>

              {!hasSelectedCase ? (
                <div className="mt-6">
                  <p className="text-sm text-zinc-400">
                    Abre un incidente desde el Dashboard o selecciona una alerta crítica sugerida para comenzar.
                  </p>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Últimas 5 alertas críticas</p>
                      {alertsStatus === "loading" ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
                      ) : null}
                    </div>

                    <div className="mt-3 max-h-64 overflow-y-auto pr-2 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                      <div className="space-y-2">
                        {criticalSuggestions.slice(0, 5).map((a: any) => {
                        const id = String(a?.alert_id ?? "--");
                        const ip = String(a?.network_data?.src_ip ?? "--");
                        const at = getAlertAttackLabel(a);
                        const port = String(a?.network_data?.dst_port ?? "--");
                        const portNumber = normalizePortNumber(port);
                        const portLabel = portNumber != null ? formatPortWithService(portNumber) : "--";
                        const ts = String(a?.timestamp ?? "");
                        const href = `/investigacion?${new URLSearchParams({
                          id,
                          src_ip: ip,
                          attack_type: at,
                          dst_port: port,
                          timestamp: ts,
                        }).toString()}`;

                        return (
                          <Link
                            key={id}
                            href={href}
                            className="block rounded-xl border border-white/10 bg-black/40 px-3 py-2 transition-all hover:border-hyper-accent/30 hover:bg-black/50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-mono font-medium text-white break-all">{id}</p>
                              <span className="rounded-full border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-100">
                                Crítica
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-zinc-200">
                              {ip} · {at} · dst_port {portLabel}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">{formatMadridDateTime(ts)}</p>
                          </Link>
                        );
                        })}

                        {alertsStatus === "ready" && criticalSuggestions.length === 0 ? (
                          <p className="text-sm text-zinc-400">Sin alertas críticas recientes en este intervalo.</p>
                        ) : null}

                        {alertsStatus === "error" ? (
                          <p className="text-xs text-zinc-400">No se pudo leer /api/stats. Mostrando sugerencias demo.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Barcode className="h-4 w-4 text-zinc-200" />
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">ID del Caso</p>
                    </div>
                    <p className="mt-2 text-base font-mono font-medium text-white break-all">{caseId}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Target className="h-4 w-4 text-hyper-accent" />
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Objetivo</p>
                    </div>
                    <div className="mt-2">
                      <IPProfilePopover
                        ip={effectiveSrcIp}
                        intel={effectiveSrcIntel}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 hover:border-white/20"
                        textClassName="font-mono font-medium text-[15px] text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Shield className="h-4 w-4 text-rose-200" />
                      <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Vector</p>
                    </div>
                    <p className="mt-2 text-base font-semibold text-zinc-100">{effectiveAttackType}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Detección Original</p>
                    <p className="mt-2 text-base font-mono font-medium text-white">{formatMadridDateTime(detectionTime)}</p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">Contexto de Red</p>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-zinc-300">Otras víctimas de esta IP</p>
                        <p className="text-sm font-semibold text-white">{networkContext.otherVictims} activos</p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-zinc-300">Frecuencia de ataque</p>
                        <p className="text-sm font-semibold text-white">
                          {networkContext.frequencyLabel} <span className="text-zinc-400">({networkContext.frequencyCount})</span>
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-zinc-300">Destino (incidente actual)</p>
                        <p className="text-sm font-mono font-medium text-white">{selectedDstIp}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-zinc-300">Puerto destino (incidente actual)</p>
                        <p className="text-sm font-mono font-medium text-white">{selectedDstPortLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </Card>

            {hasSelectedCase ? (
              <Card className="relative overflow-hidden bg-hyper-surface/55 border-hyper-border ring-0 backdrop-blur-md">
                <div aria-hidden className={dotMeshOverlayClass} />
                <div className="relative">
                  <div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-zinc-400">Pivotar Investigación</p>
                      <h3 className="mt-2 text-lg font-semibold text-white">Alertas Relacionadas</h3>
                      <p className="mt-1 text-sm text-zinc-300">Reutiliza el contexto de sesión para pivotar sin perder ritmo.</p>
                    </div>
                  </div>

                  <div className="mt-4 inline-flex w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
                    <button
                      type="button"
                      onClick={() => setPivotMode("origin")}
                      className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                        pivotMode === "origin" ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                      aria-pressed={pivotMode === "origin"}
                    >
                      Ver otros ataques de este ORIGEN
                    </button>
                    <button
                      type="button"
                      onClick={() => setPivotMode("destination")}
                      className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
                        pivotMode === "destination" ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5 hover:text-white"
                      }`}
                      aria-pressed={pivotMode === "destination"}
                    >
                      Ver otros ataques a este DESTINO
                    </button>
                  </div>

                  <div className="mt-5 max-h-72 overflow-y-auto pr-2 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
                    <div className="space-y-2">
                      {alertsStatus === "loading" ? (
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-200">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
                          Cargando alertas de sesión...
                        </div>
                      ) : null}

                      {alertsStatus === "ready" && relatedAlerts.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-300">
                          No hay alertas relacionadas para este pivote.
                        </div>
                      ) : null}

                      {relatedAlerts.map((a: any) => {
                      const id = String(a?.alert_id ?? "--");
                      const ip = String(a?.network_data?.src_ip ?? "--");
                      const at = getAlertAttackLabel(a);
                      const port = String(a?.network_data?.dst_port ?? "--");
                      const portNumber = normalizePortNumber(port);
                      const portLabel = portNumber != null ? formatPortWithService(portNumber) : "--";
                      const ts = String(a?.timestamp ?? "");
                      const href = `/investigacion?${new URLSearchParams({
                        id,
                        src_ip: ip,
                        attack_type: at,
                        dst_port: port,
                        timestamp: ts,
                      }).toString()}`;

                      return (
                        <Link
                          key={id}
                          href={href}
                          className="block rounded-xl border border-white/10 bg-black/30 px-3 py-2 transition-all hover:border-hyper-accent/30 hover:bg-black/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-mono font-medium text-white break-all">{id}</p>
                            <p className="text-xs text-zinc-400">{formatMadridDateTime(ts)}</p>
                          </div>
                          <p className="mt-1 text-sm text-zinc-200">
                            {ip} → {String(a?.network_data?.dst_ip ?? "--")} · {at} · dst_port {portLabel}
                          </p>
                        </Link>
                      );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut", delay: 0.06 }}
        >
          <SpotlightCard
            spotlightColor="rgba(209, 132, 0, 0.15)"
            className="min-h-[calc(100vh-14rem)]"
          >
            <Card className="relative overflow-hidden border-hyper-border ring-0 min-h-[calc(100vh-14rem)] flex flex-col bg-zinc-900/40 backdrop-blur-xl">
              <div aria-hidden className={dotMeshOverlayClass} />
              <div className="relative flex min-h-[calc(100vh-14rem)] flex-col">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-sm uppercase tracking-[0.25em] text-zinc-400">Chat RAG</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Asistente de Investigación (Capa 2)</h2>
              <p className="mt-1 text-sm text-zinc-400">Base de interfaz lista; backend RAG en desarrollo.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 pr-3 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
              <div className="space-y-3">
                {messages.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  const isWelcome = !isUser && idx === 0;
                  return (
                    <div key={idx} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[min(740px,92%)] rounded-2xl border px-4 py-3 text-base leading-relaxed ${
                          isUser
                            ? "border-hyper-accent/25 bg-hyper-accent/10 text-white"
                            : "border-white/10 bg-black/30 text-zinc-100 font-mono font-medium"
                        }`}
                      >
                        {!isUser ? (
                          <div className="mb-2 flex items-center gap-2 text-zinc-300">
                            <Bot className="h-4 w-4 text-hyper-accent" />
                            <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">Sistema</span>
                          </div>
                        ) : null}
                        {isWelcome ? (
                          <DecryptedText
                            text={msg.content}
                            animateOn="view"
                            revealDuration={0.8}
                            sequential
                            characters={'0101X?#&."'}
                          />
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 px-5 py-4">
              <div className="flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Escribe tu pregunta de investigación..."
                  className="min-h-[52px] flex-1 resize-none rounded-xl border border-hyper-accent/25 bg-black/50 px-4 py-3 text-base text-zinc-100 outline-none placeholder:text-zinc-400 ring-1 ring-hyper-accent/15 focus:border-hyper-accent/55 focus:ring-hyper-accent/35"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <Magnetic>
                  <button
                    type="button"
                    onClick={onSend}
                    className="rounded-xl border border-hyper-accent/35 bg-hyper-accent/20 px-5 py-3 text-sm font-semibold text-white transition-all ring-1 ring-hyper-accent/25 hover:bg-hyper-accent/30 hover:ring-hyper-accent/45"
                  >
                    Enviar
                  </button>
                </Magnetic>
              </div>
              <p className="mt-2 text-xs text-zinc-400">Enter para enviar · Shift+Enter para salto de línea</p>
            </div>
              </div>
            </Card>
          </SpotlightCard>
        </motion.div>
      </div>
    </div>
  );
}
