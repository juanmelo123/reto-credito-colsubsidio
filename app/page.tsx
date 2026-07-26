"use client";

import Image from "next/image";
import * as Tabs from "@radix-ui/react-tabs";
import { ShieldCheck } from "lucide-react";

import IndividualPanel from "@/components/IndividualPanel";
import LotePanel from "@/components/LotePanel";

export default function Home() {
  return (
    <>
      {/* El logo oficial es la version para fondo oscuro (isotipo amarillo +
          marca en blanco), por eso la barra va en azul Colsubsidio. */}
      <header className="sticky top-0 z-20 bg-brand shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-6 py-3.5">
          <Image
            src="/marca/logo-colsubsidio.png"
            alt="Colsubsidio"
            width={1141}
            height={217}
            priority
            className="h-6 w-auto shrink-0"
          />
          <span aria-hidden className="h-7 w-px shrink-0 bg-white/25" />
          <div className="min-w-0">
            <h1 className="m-0 text-base font-bold tracking-tight text-white">
              Motor de Enriquecimiento Crediticio
            </h1>
            <p className="m-0 text-[12.5px] text-white/70">
              Reto Crédito · Hackathon Colsubsidio x 30X
            </p>
          </div>
          <div className="flex-1" />
          <span className="hidden rounded-full bg-accent px-3 py-1.5 text-[11.5px] font-semibold text-grafito sm:inline">
            Datos sintéticos
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 py-6">
        <div className="mb-5 flex items-start gap-2.5 rounded-[var(--radius-control)] border border-accent-line bg-accent-soft px-3.5 py-3 text-[13px] text-grafito">
          <ShieldCheck aria-hidden className="mt-px size-4 shrink-0" />
          <p className="m-0">
            <strong className="font-semibold text-grafito">
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
