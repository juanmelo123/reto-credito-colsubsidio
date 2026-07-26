"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/card";
import type { Recomendacion } from "@/lib/types";

export function RiskBadge({ nivel }: { nivel: Recomendacion["nivelRiesgo"] }) {
  const tono = nivel === "Bajo" ? "bajo" : nivel === "Medio" ? "medio" : "alto";
  const punto = {
    Bajo: "bg-riesgo-bajo",
    Medio: "bg-riesgo-medio",
    Alto: "bg-riesgo-alto",
  }[nivel];

  return (
    <Badge tono={tono}>
      <span aria-hidden className={cn("size-[7px] rounded-full", punto)} />
      Riesgo {nivel}
    </Badge>
  );
}

export function ScoreGauge({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color =
    score >= 70
      ? "var(--color-riesgo-bajo)"
      : score >= 45
        ? "var(--color-riesgo-medio)"
        : "var(--color-riesgo-alto)";

  return (
    <div className="relative size-[74px] shrink-0">
      <svg
        width="74"
        height="74"
        viewBox="0 0 74 74"
        className="-rotate-90"
        role="img"
        aria-label={`Score de aprobación ${score} sobre 100`}
      >
        <circle cx="37" cy="37" r={r} fill="none" stroke="var(--color-line)" strokeWidth="7" />
        <circle
          cx="37"
          cy="37"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[19px] font-extrabold tabular">
        {score}
      </span>
    </div>
  );
}

export function DistBars({
  data,
  color = "var(--color-brand)",
}: {
  data: Record<string, number>;
  color?: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([label, n]) => (
        <div className="flex items-center gap-2.5 text-[13px]" key={label}>
          <span className="w-[130px] shrink-0 truncate text-muted" title={label}>
            {label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${(n / max) * 100}%`, background: color }}
            />
          </span>
          <span className="w-9 shrink-0 text-right font-bold tabular">{n}</span>
        </div>
      ))}
    </div>
  );
}
