"use client";

import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";
import { getIPMetadata } from "../lib/netIntel";

export type IPIntelPayload = {
  country?: string;
  country_name?: string;
  isp?: string;
  type?: string;
  usage_type?: string;
  is_proxy?: boolean;
};

type IPProfilePopoverProps = {
  ip: string;
  intel?: IPIntelPayload | null;
  className?: string;
  textClassName?: string;
};

const getUsageTypeBadgeUi = (usageType: string) => {
  const key = usageType.trim().toLowerCase();
  if (key === "proxy / vpn") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-100";
  }
  if (key === "cloud / datacenter") {
    return "border-hyper-accent/30 bg-hyper-accent/10 text-hyper-accent";
  }
  if (key === "residential") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  }
  if (key === "mobile") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  }
  if (key === "business") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  }
  return "border-white/10 bg-black/30 text-zinc-200";
};

const normalizeCountryCode = (value: unknown) => {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw && raw !== "zz" && raw.length === 2 ? raw : "zz";
};

export function IPProfilePopover({ ip, intel, className, textClassName }: IPProfilePopoverProps) {
  const meta = getIPMetadata(ip);

  const countryCode = normalizeCountryCode(intel?.country ?? meta.country);
  const countryName = String(intel?.country_name ?? meta.countryName ?? "Unknown").trim() || "Unknown";
  const isp = String(intel?.isp ?? meta.isp ?? "Unknown").trim() || "Unknown";
  const usageType = String(intel?.usage_type ?? meta.type ?? "Unknown").trim() || "Unknown";
  const isProxy = Boolean(intel?.is_proxy);
  const badgeUi = getUsageTypeBadgeUi(usageType);

  const flagSrc = countryCode !== "zz" ? `/flags/${countryCode}_32.png` : "/globe.svg";
  const flagAlt = countryCode !== "zz" ? countryCode.toUpperCase() : "Unknown";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={
            className ??
            "inline-flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
          }
          aria-label={`Perfil de IP ${ip}`}
        >
          <img
            src={flagSrc}
            alt={flagAlt}
            width={32}
            height={32}
            className="h-8 w-8 rounded-sm"
            onError={(e) => {
              e.currentTarget.src = "/globe.svg";
            }}
          />
          <span className={textClassName ?? "font-mono font-medium text-[15px] text-zinc-100 hover:text-white"}>{ip}</span>
          <Info className="h-4 w-4 text-zinc-400" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="start"
          className="z-[90] w-[320px] rounded-2xl border border-white/10 bg-hyper-surface/95 p-4 text-zinc-200 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-400">Dossier Técnico</p>

              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/30">
                  <img
                    src={flagSrc}
                    alt={flagAlt}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-sm"
                    onError={(e) => {
                      e.currentTarget.src = "/globe.svg";
                    }}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-base font-semibold text-white whitespace-normal break-words leading-snug" title={countryName}>
                    {countryName} <span className="text-zinc-400">({countryCode !== "zz" ? countryCode.toUpperCase() : "--"})</span>
                  </p>
                  <p className="mt-0.5 font-mono font-medium text-[15px] text-zinc-100 break-all">{ip}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isProxy ? (
              <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 px-3 py-2">
                <p className="text-sm font-semibold text-yellow-100">⚠️ Nodo de Privacidad Detectado</p>
              </div>
            ) : null}

            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">ASN / Organización</p>
              <p className="mt-1 text-sm text-zinc-200">{isp}</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Tipo de Conexión</p>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeUi}`}>{usageType}</span>
              </div>
            </div>
          </div>

          <Popover.Arrow className="fill-white/10" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
