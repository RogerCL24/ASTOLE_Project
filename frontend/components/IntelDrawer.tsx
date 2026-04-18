import type { ReactNode } from "react";
import {
  AlertCircle,
  BadgeInfo,
  CircleDot,
  Info,
  Network,
  ShieldAlert,
  Target,
} from "lucide-react";

export type IntelDrawerContext = "top-attackers" | "assets" | "composition" | "incidents";
export type IntelDrawerTopic =
  | "attack-label"
  | "ports"
  | "intrusion-risk"
  | "ring"
  | "ioc"
  | "distribution"
  | null;

type IntelDrawerProps = {
  open: boolean;
  context: IntelDrawerContext | null;
  topic?: IntelDrawerTopic;
  originCountryBreakdown?: Array<{ country: string; flag: string; percent: number }>;
  onClose: () => void;
};

const SectionTitle = ({ icon, title }: { icon: ReactNode; title: string }) => (
  <div className="flex items-center gap-2 text-zinc-100">
    <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-black/30 text-zinc-200">
      {icon}
    </span>
    <p className="text-base font-semibold">{title}</p>
  </div>
);

const Callout = ({
  tone,
  children,
}: {
  tone: "rose" | "orange" | "yellow" | "zinc";
  children: ReactNode;
}) => {
  const toneClass =
    tone === "rose"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-100"
      : tone === "orange"
        ? "border-orange-400/25 bg-orange-400/10 text-orange-100"
        : tone === "yellow"
          ? "border-yellow-300/25 bg-yellow-300/10 text-yellow-100"
          : "border-white/10 bg-black/30 text-zinc-200";

  return <div className={`rounded-xl border px-3 py-2 text-base leading-snug ${toneClass}`}>{children}</div>;
};

export function IntelDrawer({ open, context, topic = null, originCountryBreakdown = [], onClose }: IntelDrawerProps) {
  if (!open) return null;

  const header =
    context === "top-attackers"
      ? "Top Atacantes"
      : context === "assets"
        ? "Activos Críticos"
        : context === "composition"
          ? "Composición"
          : context === "incidents"
            ? "Narrativa de Incidentes"
            : "Intel";

  return (
    <div className="fixed inset-0 z-[75]">
      <button type="button" aria-label="Cerrar panel" onClick={onClose} className="absolute inset-0 bg-black/55" />

      <aside
        className="absolute right-0 top-0 h-full w-full max-w-xl lg:max-w-2xl border-l border-white/10 bg-hyper-surface/95 backdrop-blur-md p-6 text-zinc-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base uppercase tracking-[0.25em] text-zinc-400">Intel-Drawer</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{header} — Ayuda Contextual</h3>
            <p className="mt-1 text-base text-zinc-400">Explicación ampliada (más legible) para interpretar métricas y etiquetas.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-200 hover:border-white/20 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 space-y-5 text-base text-zinc-300">
          {context === "top-attackers" ? (
            <>
              <SectionTitle icon={<Target className="h-4 w-4 text-orange-200" />} title="Cómo leer el ranking" />
              <Callout tone="zinc">
                <span className="font-semibold text-white">IP</span> = origen con más alertas en el intervalo actual. Útil para priorizar triage sin
                perder el foco.
              </Callout>

              <SectionTitle icon={<BadgeInfo className="h-4 w-4 text-yellow-200" />} title="Etiqueta de Ataque" />
              <Callout tone={topic === "attack-label" ? "yellow" : "zinc"}>
                <span className="font-semibold text-white">[Etiqueta]</span> es el vector principal más frecuente (solo ataques). El{" "}
                <span className="font-semibold text-white">color</span> coincide con el donut de Composición (no indica severidad).
              </Callout>

              <SectionTitle icon={<Network className="h-4 w-4 text-zinc-200" />} title="Puerto objetivo" />
              <Callout tone={topic === "ports" ? "orange" : "zinc"}>
                Se muestra el <span className="font-semibold text-white">dst_port</span> más atacado por frecuencia. El mapeo de servicio es{" "}
                <span className="font-semibold text-white">estricto</span>: si el puerto no está en el diccionario, se enseña solo el número.
              </Callout>

              <SectionTitle icon={<ShieldAlert className="h-4 w-4 text-rose-200" />} title="[Riesgo de Intrusión]" />
              <Callout tone={topic === "intrusion-risk" ? "rose" : "zinc"}>
                Badge de priorización: puertos típicos de acceso remoto/servicios expuestos (21/22/23/445). No implica explotación confirmada; su
                objetivo es acelerar la priorización.
              </Callout>
            </>
          ) : null}

          {context === "assets" ? (
            <>
              <SectionTitle icon={<CircleDot className="h-4 w-4 text-zinc-200" />} title="Semántica del cubo" />
              <Callout tone="zinc">
                <span className="font-semibold text-white">Color del cubo</span> = severidad agregada del activo (dst_ip) por la peor alerta. El pulso
                se reserva para severidad Crítica.
              </Callout>

              <SectionTitle icon={<AlertCircle className="h-4 w-4 text-rose-200" />} title="Anillo rojo exterior" />
              <Callout tone={topic === "ring" ? "rose" : "zinc"}>
                <span className="font-semibold text-white">Anillo rojo</span> = alerta Crítica reciente (&lt; 2 min). Está diseñado para mantener
                visibilidad incluso cuando hay saturación de alertas menores.
              </Callout>

              <SectionTitle icon={<ShieldAlert className="h-4 w-4 text-orange-200" />} title="IoC (Índice de Compromiso)" />
              <Callout tone={topic === "ioc" ? "orange" : "zinc"}>
                IoC es un indicador agregado (no un IOC forense) para expresar el nivel de riesgo del activo según las alertas observadas. Úsalo como
                guía rápida para priorizar investigación.
              </Callout>
            </>
          ) : null}

          {context === "composition" ? (
            <>
              <SectionTitle icon={<BadgeInfo className="h-4 w-4 text-orange-200" />} title="Qué representa el donut" />
              <Callout tone={topic === "distribution" ? "orange" : "zinc"}>
                Distribución de <span className="font-semibold text-white">etiquetas multiclass</span> (intervalo actual). Los colores solo sirven para
                correlación visual con etiquetas (no severidad).
              </Callout>
            </>
          ) : null}

          {context === "incidents" ? (
            <>
              <SectionTitle icon={<Info className="h-4 w-4 text-zinc-200" />} title="Cómo leer el feed" />
              <Callout tone="zinc">
                Cada card resume un incidente detectado. El objetivo es poder escanear rápido: <span className="font-semibold text-white">cuándo</span>
                {" "}(Data Time), <span className="font-semibold text-white">qué</span> (vector/etiqueta) y{" "}
                <span className="font-semibold text-white">a quién</span> (origen→destino).
              </Callout>

              {originCountryBreakdown.length ? (
                <>
                  <SectionTitle icon={<Network className="h-4 w-4 text-zinc-200" />} title="Tráfico por origen" />
                  <Callout tone="zinc">
                    <div className="flex flex-wrap gap-2">
                      {originCountryBreakdown.map((entry) => (
                        <span
                          key={entry.country}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-sm font-semibold text-zinc-200"
                        >
                          <span className="text-sm">{entry.flag}</span>
                          {entry.percent}%
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      Basado en IP Intel del backend (DB1/PX2). Si falta información, se muestra como Unknown.
                    </p>
                  </Callout>
                </>
              ) : null}

              <SectionTitle icon={<Info className="h-4 w-4 text-zinc-200" />} title="Acción: Investigar" />
              <Callout tone="zinc">
                El botón <span className="font-semibold text-white">Investigar con IA</span> abre la Sala de Investigación (Capa 2) y transfiere los
                datos clave del incidente para comenzar el triage.
              </Callout>
            </>
          ) : null}

          {context ? (
            <>
              <SectionTitle icon={<Info className="h-4 w-4 text-zinc-200" />} title="Guía de Prioridades" />
              <Callout tone="zinc">
                <div className="space-y-3">
                  <p className="text-base leading-relaxed text-zinc-200">
                    La franja vertical en la izquierda de cada incidente resume la prioridad operativa.
                  </p>
                  <div className="space-y-2 text-base text-zinc-200">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-1.5 rounded-full bg-red-500" />
                      <span>
                        <span className="font-semibold text-white">Crítica</span>: atender ahora.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-1.5 rounded-full bg-orange-500" />
                      <span>
                        <span className="font-semibold text-white">Alta</span>: triage inmediato.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-1.5 rounded-full bg-zinc-500" />
                      <span>
                        <span className="font-semibold text-white">Media</span>: revisar contexto.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-1.5 rounded-full bg-zinc-700" />
                      <span>
                        <span className="font-semibold text-white">Baja</span>: monitoreo.
                      </span>
                    </div>
                  </div>
                </div>
              </Callout>
            </>
          ) : null}

          {!context ? <Callout tone="zinc">Pulsa el icono (i) de una sección o una etiqueta para abrir su explicación.</Callout> : null}
        </div>
      </aside>
    </div>
  );
}
