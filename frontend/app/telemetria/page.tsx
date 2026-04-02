"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Grid, Metric, ProgressBar, Text } from "@tremor/react";

type StatsResponse = {
  metrics?: {
    last_update?: string;
    status?: string;
    performance?: {
      total_flows_analyzed?: number;
      total_alerts_triggered?: number;
      avg_latency_ms?: number;
      compression_rate_percent?: number;
    };
  };
};

const formatNumber = (value: number) => new Intl.NumberFormat("es-ES").format(value);

const fallbackData: StatsResponse = {
  metrics: {
    last_update: "2026-03-19T17:29:25Z",
    status: "COMPLETED",
    performance: {
      total_flows_analyzed: 48387,
      total_alerts_triggered: 83,
      avg_latency_ms: 1.47,
      compression_rate_percent: 99.8285,
    },
  },
};

export default function TelemetriaPage() {
  const [data, setData] = useState<StatsResponse>(fallbackData);
  const [error, setError] = useState<string | null>(null);

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
    const interval = window.setInterval(fetchStats, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!data && !error) {
    return (
      <div className="min-h-screen bg-black px-6 py-10 lg:px-12">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center rounded-3xl border border-white/5 bg-zinc-950/80">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-hyper-accent border-t-transparent" />
            <Text className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
              Cargando telemetría SOC...
            </Text>
          </div>
        </div>
      </div>
    );
  }

  const performance = data?.metrics?.performance ?? {};
  const totalFlows = performance.total_flows_analyzed ?? 0;
  const totalAlerts = performance.total_alerts_triggered ?? 0;
  const avgLatency = performance.avg_latency_ms ?? 0;
  const compressionRate = performance.compression_rate_percent ?? 0;
  const alertRatio = totalFlows > 0 ? Math.min((totalAlerts / totalFlows) * 100, 100) : 0;
  const lastUpdate = data?.metrics?.last_update
    ? new Date(data.metrics.last_update).toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "medium",
      })
    : "Sin actualización";
  const engineStatus = data?.metrics?.status ?? "UNKNOWN";

  return (
    <div className="min-h-screen bg-black px-6 py-10 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge color={engineStatus === "COMPLETED" ? "green" : "orange"} size="xs">
              Motor {engineStatus === "COMPLETED" ? "Operativo" : engineStatus}
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                Telemetría SOC
              </h1>
              <Text className="mt-2 max-w-2xl text-sm text-zinc-400">
                Supervisión en tiempo real del motor de ingestión, con reducción de ruido, latencia y volumen analizado.
              </Text>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
              Última actualización
            </Text>
            <p className="mt-1 font-mono text-sm text-white">{lastUpdate}</p>
          </div>
        </header>

        {error ? (
          <Card className="border border-red-500/20 bg-red-500/5 ring-0">
            <Text className="text-red-300">{error}</Text>
          </Card>
        ) : null}

        <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Flujos Analizados</Text>
            <Metric className="mt-3 text-white">{formatNumber(totalFlows)}</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Procesados por el motor de ingestión</Text>
          </Card>

          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Alertas Generadas</Text>
            <Metric className="mt-3 text-white">{formatNumber(totalAlerts)}</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Eventos reales elevados al SOC</Text>
          </Card>

          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Latencia Media</Text>
            <Metric className="mt-3 text-white">{avgLatency.toFixed(2)} ms</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Tiempo medio por ventana procesada</Text>
          </Card>

          <Card className="border border-white/5 bg-zinc-950/80 ring-0">
            <Text className="text-zinc-400">Tasa de Compresión</Text>
            <Metric className="mt-3 text-white">{compressionRate.toFixed(2)}%</Metric>
            <Text className="mt-2 text-xs text-zinc-500">Ruido eliminado frente al tráfico bruto</Text>
          </Card>
        </Grid>

        <Card className="border border-hyper-border bg-hyper-surface ring-0">
          <div className="flex flex-col gap-2 border-b border-white/5 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Text className="text-[11px] uppercase tracking-[0.25em] text-hyper-accent">
                Eficiencia del motor
              </Text>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Flujos Totales vs Alertas Reales
              </h2>
              <Text className="mt-2 text-sm text-zinc-400">
                El objetivo es visualizar cuánto volumen se descarta como ruido antes de llegar al analista.
              </Text>
            </div>

            <Badge color="orange" size="xs">
              {compressionRate.toFixed(2)}% de reducción
            </Badge>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <Text className="text-zinc-300">Flujos Totales</Text>
                  <Metric className="text-white">{formatNumber(totalFlows)}</Metric>
                </div>
                <ProgressBar value={100} color="amber" className="h-3" />
                <Text className="mt-2 text-xs text-zinc-500">Base completa de tráfico ingerido</Text>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <Text className="text-zinc-300">Alertas Reales</Text>
                  <Metric className="text-red-300">{formatNumber(totalAlerts)}</Metric>
                </div>
                <ProgressBar value={Math.max(alertRatio, 1)} color="red" className="h-3" />
                <Text className="mt-2 text-xs text-zinc-500">
                  {alertRatio.toFixed(2)}% del tráfico total convertido en alerta accionable
                </Text>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-white/5 bg-black/40 p-5">
              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                  Ruido eliminado
                </Text>
                <Metric className="mt-2 text-white">{compressionRate.toFixed(2)}%</Metric>
                <Text className="mt-1 text-sm text-zinc-400">
                  Menos flujos irrelevantes llegan al analista humano.
                </Text>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                <Text className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                  Señal operativa
                </Text>
                <div className="mt-3 flex items-center gap-3">
                  <Badge color="green" size="xs">
                    SOC listo
                  </Badge>
                  <Text className="text-sm text-zinc-300">
                    Alertas reales concentradas en un volumen muy inferior al tráfico bruto.
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}