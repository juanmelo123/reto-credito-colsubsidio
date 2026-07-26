import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-line bg-surface shadow-card",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

// Titulo de seccion en versalitas: separa bloques sin gastar peso visual, que
// en una pantalla densa de datos es lo escaso.
export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "m-0 mb-3.5 text-[12px] font-bold uppercase tracking-[0.05em] text-faint",
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  tono = "neutro",
  className,
  ...props
}: React.ComponentProps<"span"> & {
  tono?: "neutro" | "marca" | "bajo" | "medio" | "alto" | "match" | "nomatch";
}) {
  const tonos = {
    neutro: "bg-surface-2 border-line text-muted",
    marca: "bg-brand-soft border-transparent text-brand-dark",
    bajo: "bg-riesgo-bajo-soft border-transparent text-brand-dark",
    medio: "bg-riesgo-medio-soft border-transparent text-riesgo-medio",
    alto: "bg-riesgo-alto-soft border-transparent text-riesgo-alto",
    match: "bg-match-soft border-transparent text-match",
    nomatch: "bg-nomatch-soft border-transparent text-nomatch",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tonos[tono],
        className
      )}
      {...props}
    />
  );
}
