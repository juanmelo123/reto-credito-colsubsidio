import { NextResponse } from "next/server";
import { procesarLote } from "@/lib/engine";
import { validarCedula } from "@/lib/synthetic";
import type { EnrichRequest, Proposito } from "@/lib/types";

const PROPOSITOS_VALIDOS: Proposito[] = [
  "auto",
  "consumo",
  "vivienda",
  "educacion",
  "libre",
  "unificar",
  "seguros_impuestos",
];

const MAX_CEDULAS = 5000;

export async function POST(req: Request) {
  let body: EnrichRequest;
  try {
    body = (await req.json()) as EnrichRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.cedulas)) {
    return NextResponse.json(
      { error: "Se espera { cedulas: string[], proposito?: string }" },
      { status: 400 }
    );
  }

  // Limpieza: normaliza, descarta vacios y duplicados.
  const vistas = new Set<string>();
  const cedulas: string[] = [];
  for (const raw of body.cedulas) {
    if (typeof raw !== "string") continue;
    const { normalizada } = validarCedula(raw);
    const key = normalizada || raw.trim();
    if (!key || vistas.has(key)) continue;
    vistas.add(key);
    cedulas.push(key);
  }

  if (cedulas.length === 0) {
    return NextResponse.json({ error: "No se recibieron cedulas validas" }, { status: 400 });
  }
  if (cedulas.length > MAX_CEDULAS) {
    return NextResponse.json(
      { error: `Maximo ${MAX_CEDULAS} cedulas por lote (se recibieron ${cedulas.length}).` },
      { status: 413 }
    );
  }

  const proposito: Proposito =
    body.proposito && PROPOSITOS_VALIDOS.includes(body.proposito) ? body.proposito : "auto";

  const response = procesarLote(cedulas, proposito);
  return NextResponse.json(response);
}
