"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { ShieldCheck } from "lucide-react";

import IndividualPanel from "@/components/IndividualPanel";
import LotePanel from "@/components/LotePanel";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3.5 px-6 py-3.5">
          {/* Marca de agua del prototipo: chevrones azul/amarillo, un guino al
              simbolo de Colsubsidio sin reproducir su logo — es un prototipo,
              no material oficial. */}
          <span
            aria-hidden
            className="flex size-[34px] shrink-0 items-center justify-center gap-0.5 rounded-[9px] bg-brand"
          >
            <i className="block h-3.5 w-[5px] bg-white [clip-path:polygon(0_0,60%_50%,0_100%,40%_100%,100%_50%,40%_0)]" />
            <i className="block h-3.5 w-[5px] bg-accent [clip-path:polygon(0_0,60%_50%,0_100%,40%_100%,100%_50%,40%_0)]" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-base font-bold tracking-tight">
              Motor de Enriquecimiento Crediticio
            </h1>
            <p className="m-0 text-[12.5px] text-muted">
              Reto Crédito · Hackathon Colsubsidio x 30X
            </p>
          </div>
          <div className="flex-1" />
          <span className="hidden rounded-full bg-brand-soft px-3 py-1.5 text-[11.5px] font-semibold text-brand-dark sm:inline">
            Datos sintéticos
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <div className="mb-5 flex items-start gap-2.5 rounded-[var(--radius-control)] border border-accent-line bg-accent-soft px-3.5 py-3 text-[13px] text-[#6b5200]">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0" />
          <p className="m-0">
            <strong className="font-semibold text-[#4d3b00]">
              Prototipo con datos 100 % sintéticos y deterministas.
            </strong>{" "}
            No se consulta ni almacena información real de personas. Cada cédula genera un perfil
            simulado, reproducible, que emula lo que devolvería un buró o una fuente externa
            (Habeas Data — Ley 1581).
          </p>
        </div>

        <Tabs.Root defaultValue="individual">
          <Tabs.List
            className="mb-5 inline-flex gap-1 rounded-full border border-line bg-surface p-1 shadow-card"
            aria-label="Modo de consulta"
          >
            <TabTrigger value="individual">Consulta individual</TabTrigger>
            <TabTrigger value="lote">Consulta por lote</TabTrigger>
          </Tabs.List>

          <Tabs.Content value="individual" className="focus-visible:outline-none">
            <IndividualPanel />
          </Tabs.Content>
          <Tabs.Content value="lote" className="focus-visible:outline-none">
            <LotePanel />
          </Tabs.Content>
        </Tabs.Root>
      </main>

      <footer className="px-6 pb-10 pt-8 text-center text-[12.5px] text-faint">
        Prototipo demostrativo · El portafolio (cupo rotativo, libre inversión, hipotecario,
        educativo, compra de cartera, crédito mujer, complementario, seguros e impuestos) y las
        categorías A–D siguen el brief del reto. Motores de datos y decisión configurables en{" "}
        <code className="rounded bg-surface-2 px-1 py-px">/lib</code>.
      </footer>
    </>
  );
}

function TabTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <Tabs.Trigger
      value={value}
      className="rounded-full px-5 py-2 text-sm font-semibold text-muted transition-colors duration-150 hover:text-ink data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-[0_2px_6px_rgba(0,103,177,0.3)]"
    >
      {children}
    </Tabs.Trigger>
  );
}
