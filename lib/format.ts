// Utilidades de formato para la UI.

export function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatCOPCompact(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${Math.round(value / 1000)}K`;
  }
  return `$${Math.round(value)}`;
}

export function formatPercent(value: number, decimals = 0): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Redondea un monto a un valor "presentable" segun su magnitud.
export function roundMonto(value: number): number {
  if (value <= 0) return 0;
  if (value >= 20_000_000) return Math.round(value / 1_000_000) * 1_000_000;
  if (value >= 1_000_000) return Math.round(value / 100_000) * 100_000;
  return Math.round(value / 50_000) * 50_000;
}
