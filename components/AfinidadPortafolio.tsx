"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { Check, ChevronDown, Lock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { Badge, Card, CardBody, CardTitle } from "@/components/ui/card";
import type { Criterio, ProductoEvaluado, ProductoId } from "@/lib/types";

// ---------------------------------------------------------------------------
// AFINIDAD CON EL PORTAFOLIO
//
// Se listan los 8 productos SIEMPRE, incluidos los que no aplican. Que un
// producto desaparezca sin explicacion es justo lo que un analista no puede
// defender frente a un afiliado; ver "Credito Mujer daria 88%, pero esta
// bloqueado por afiliacion" es la informacion que le dice que gestionar.
//
// El % y los criterios de abajo son el mismo calculo: afinidad = puntos
// cumplidos / puntos posibles. No hay una narrativa escrita aparte que pueda
// contradecir al numero.
// ---------------------------------------------------------------------------

export default function AfinidadPortafolio({
  productos,
  recomendado,
}: {
  productos: ProductoEvaluado[];
  recomendado: ProductoId | null;
}) {
  const aplican = productos.filter((p) => p.aplica).length;

  return (
    <Card>
      <CardBody>
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="mb-0">Afinidad con el portafolio</CardTitle>
          <span className="text-[12.5px] text-faint">
            {aplican} de {productos.length} productos disponibles
          </span>
        </div>

        <Accordion.Root
          type="multiple"
          // El recomendado arranca abierto: es el que el analista va a leer.
          defaultValue={recomendado ? [recomendado] : []}
          className="flex flex-col gap-1.5"
        >
          {productos.map((p) => (
            <FilaProducto key={p.id} producto={p} esRecomendado={p.id === recomendado} />
          ))}
        </Accordion.Root>

        <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-faint">
          La afinidad es la suma de los pesos de los criterios que el perfil cumple sobre el total
          posible. Un producto <strong className="font-semibold text-nomatch">bloqueado</strong> no
          es baja afinidad: incumple un requisito que impide otorgarlo.
        </p>
      </CardBody>
    </Card>
  );
}

function FilaProducto({
  producto: p,
  esRecomendado,
}: {
  producto: ProductoEvaluado;
  esRecomendado: boolean;
}) {
  const bloqueantes = p.criterios.filter((c) => c.bloqueante && !c.cumple);

  return (
    <Accordion.Item
      value={p.id}
      className={cn(
        "overflow-hidden rounded-[var(--radius-control)] border transition-colors",
        esRecomendado
          ? "border-brand bg-brand-soft/40"
          : p.aplica
            ? "border-line bg-surface hover:border-line-strong"
            : "border-line bg-surface-2"
      )}
    >
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-black/[0.02]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-[14px] font-semibold",
                  p.aplica ? "text-ink" : "text-muted"
                )}
              >
                {p.nombre}
              </span>
              {esRecomendado && <Badge tono="marca">Recomendado</Badge>}
              {!p.aplica && (
                <Badge tono="nomatch">
                  <Lock aria-hidden className="size-3" />
                  Bloqueado
                </Badge>
              )}
            </div>

            <BarraAfinidad valor={p.afinidad} aplica={p.aplica} />

            {/* El motivo del bloqueo va en la fila cerrada: es el dato accionable
                y obligar a desplegar para verlo lo esconde. */}
            {!p.aplica ? (
              <p className="mt-1.5 text-[12px] leading-snug text-nomatch">
                {bloqueantes.map((c) => c.etiqueta).join(" · ")}
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-faint">
                {formatCOP(p.montoSugerido)} · {p.modalidad}
                {p.topeAplicado && " · monto recortado por el tope"}
              </p>
            )}
          </div>

          <span
            className={cn(
              "shrink-0 tabular text-[19px] font-extrabold leading-none",
              !p.aplica ? "text-faint" : p.afinidad >= 70 ? "text-brand" : "text-muted"
            )}
          >
            {p.afinidad}
            <span className="text-[12px] font-bold">%</span>
          </span>

          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-faint transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>

      <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <ul className="flex flex-col gap-px border-t border-line bg-line/40 px-0 py-0">
          {[...p.criterios]
            // Primero lo que falta: es lo que hay que gestionar.
            .sort((a, b) => Number(a.cumple) - Number(b.cumple) || b.peso - a.peso)
            .map((c, i) => (
              <FilaCriterio key={i} criterio={c} />
            ))}
        </ul>
      </Accordion.Content>
    </Accordion.Item>
  );
}

function BarraAfinidad({ valor, aplica }: { valor: number; aplica: boolean }) {
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Afinidad ${valor}%`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          // Un producto bloqueado se dibuja apagado por mas alto que sea el
          // numero: el color no puede sugerir que esta disponible.
          !aplica ? "bg-line-strong" : valor >= 70 ? "bg-brand" : "bg-accent-strong"
        )}
        style={{ width: `${Math.max(valor, 2)}%` }}
      />
    </div>
  );
}

function FilaCriterio({ criterio: c }: { criterio: Criterio }) {
  return (
    <li className="flex items-start gap-2.5 bg-surface px-3.5 py-2.5">
      <span
        aria-hidden
        className={cn(
          "mt-px flex size-4 shrink-0 items-center justify-center rounded-full",
          c.cumple ? "bg-match-soft text-match" : "bg-nomatch-soft text-nomatch"
        )}
      >
        {c.cumple ? <Check className="size-2.5" /> : <X className="size-2.5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] leading-snug", c.cumple ? "text-ink" : "text-muted")}>
          {c.etiqueta}
          {c.bloqueante && (
            <span
              className="ml-1.5 align-middle text-[9.5px] font-bold uppercase tracking-wide text-nomatch"
              title="Sin este requisito el producto no se puede otorgar"
            >
              obligatorio
            </span>
          )}
        </p>
        <p className="text-[12px] leading-snug text-faint">{c.detalle}</p>
      </div>

      <span
        className={cn(
          "shrink-0 tabular text-[12px] font-bold",
          c.cumple ? "text-match" : "text-faint"
        )}
        title={`${c.peso} puntos de afinidad`}
      >
        {c.cumple ? `+${c.peso}` : `0/${c.peso}`}
      </span>
    </li>
  );
}
