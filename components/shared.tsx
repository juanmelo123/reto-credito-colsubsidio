"use client";

import type { Recomendacion } from "@/lib/types";

export function RiskBadge({ nivel }: { nivel: Recomendacion["nivelRiesgo"] }) {
  const cls =
    nivel === "Bajo" ? "badge-bajo" : nivel === "Medio" ? "badge-medio" : "badge-alto";
  const color =
    nivel === "Bajo"
      ? "var(--risk-bajo)"
      : nivel === "Medio"
      ? "var(--risk-medio)"
      : "var(--risk-alto)";
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" style={{ background: color }} />
      Riesgo {nivel}
    </span>
  );
}

export function CatBadge({ cat }: { cat: string }) {
  return <span className="badge badge-cat">Cat. {cat}</span>;
}

export function ScoreGauge({ score }: { score: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color =
    score >= 70 ? "var(--risk-bajo)" : score >= 45 ? "var(--risk-medio)" : "var(--risk-alto)";
  return (
    <div className="gauge">
      <svg width="74" height="74" viewBox="0 0 74 74">
        <circle cx="37" cy="37" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
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
        />
      </svg>
      <div className="g-val">{score}</div>
    </div>
  );
}

export function DistBars({
  data,
  color = "var(--primary)",
}: {
  data: Record<string, number>;
  color?: string;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div>
      {entries.map(([label, n]) => (
        <div className="bar-row" key={label}>
          <span className="bl" title={label}>
            {label}
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${(n / max) * 100}%`, background: color }}
            />
          </span>
          <span className="bn num">{n}</span>
        </div>
      ))}
    </div>
  );
}
