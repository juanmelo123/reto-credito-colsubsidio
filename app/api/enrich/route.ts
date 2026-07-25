import { NextResponse } from "next/server";
import { procesarLote } from "@/lib/engine";
import { validarCedula, normalizarCategoria } from "@/lib/synthetic";
import type { EnrichRequest, Proposito, RegistroEntrada } from "@/lib/types";

const PROPOSITOS_VALIDOS: Proposito[] = [
  "auto",
  "consumo",
  "vivienda",
  "educacion",
  "libre",
  "unificar",
  "complementario",
  "seguros_impuestos",
];

const MAX_CEDULAS = 5000;

// Solo se aceptan los campos que el brief define como insumo. Cualquier otra
// columna del archivo del usuario se ignora.
function normalizarRegistro(raw: unknown): RegistroEntrada | null {
  if (typeof raw === "string") {
    const { normalizada } = validarCedula(raw);
    const cedula = normalizada || raw.trim();
    return cedula ? { cedula } : null;
  }
  if (!raw || typeof raw !== "object") return null;

  const r = raw as Record<string, unknown>;
  const texto = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined;

  const cedulaRaw = texto(r.cedula) ?? "";
  const { normalizada } = validarCedula(cedulaRaw);
  const cedula = normalizada || cedulaRaw;
  if (!cedula) return null;

  return {
    cedula,
    nombre: texto(r.nombre),
    correo: texto(r.correo),
    direccion: texto(r.direccion),
    categoriaAfiliacion: normalizarCategoria(texto(r.categoriaAfiliacion)) ?? undefined,
  };
}

export async function POST(req: Request) {
  let body: EnrichRequest;
  try {
    body = (await req.json()) as EnrichRequest;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const entrada: unknown[] = Array.isArray(body?.registros)
    ? body.registros
    : Array.isArray(body?.cedulas)
      ? body.cedulas
      : [];

  if (entrada.length === 0) {
    return NextResponse.json(
      {
        error:
          "Se espera { registros: [{cedula, nombre?, correo?, direccion?, categoriaAfiliacion?}] } o { cedulas: string[] }",
      },
      { status: 400 }
    );
  }

  // Limpieza: normaliza, descarta vacios y deduplica por cedula.
  const vistas = new Set<string>();
  const registros: RegistroEntrada[] = [];
  for (const raw of entrada) {
    const reg = normalizarRegistro(raw);
    if (!reg || vistas.has(reg.cedula)) continue;
    vistas.add(reg.cedula);
    registros.push(reg);
  }

  if (registros.length === 0) {
    return NextResponse.json({ error: "No se recibieron cedulas validas" }, { status: 400 });
  }
  if (registros.length > MAX_CEDULAS) {
    return NextResponse.json(
      { error: `Maximo ${MAX_CEDULAS} cedulas por lote (se recibieron ${registros.length}).` },
      { status: 413 }
    );
  }

  const proposito: Proposito =
    body.proposito && PROPOSITOS_VALIDOS.includes(body.proposito) ? body.proposito : "auto";

  return NextResponse.json(procesarLote(registros, proposito));
}
