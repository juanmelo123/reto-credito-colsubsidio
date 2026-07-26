#!/usr/bin/env node
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";

import { procesarLote, procesarRegistro } from "../lib/engine";
import { parsearInsumo } from "../lib/insumo";
import { LOTE_DEMO } from "../lib/demo";
import type { Proposito } from "../lib/types";

// ---------------------------------------------------------------------------
// CLI del motor de enriquecimiento crediticio.
//
// Existe para que un agente (o un script) llegue a las MISMAS funciones que usa
// la UI y la API, sin levantar el servidor de Next. La salida es JSON pelada a
// stdout; los mensajes para humanos van a stderr, para que `| jq` nunca se
// ensucie.
//
// No tiene logica de negocio propia: todo lo resuelve `procesarLote`.
// ---------------------------------------------------------------------------

const PROPOSITOS: Proposito[] = [
  "auto",
  "consumo",
  "libre",
  "vivienda",
  "educacion",
  "unificar",
  "complementario",
  "seguros_impuestos",
];

// `--silent` importa: sin el, pnpm escribe su banner en stdout y rompe `| jq`.
const USO = `
Motor de enriquecimiento crediticio - Reto Credito Colsubsidio x 30X

  pnpm --silent reto perfil <cedula>      Perfil y recomendacion de una cedula
  pnpm --silent reto lote <archivo.csv>   Procesa un CSV (o una lista de cedulas)
  pnpm --silent reto lote -               Lee el insumo de stdin
  pnpm --silent reto demo                 Corre el lote de demostracion (54 casos)

Opciones
  --proposito <p>   ${PROPOSITOS.join(" | ")}   (default: auto)
  --resumen         Solo el resumen agregado, sin el detalle de cada registro

Usa siempre "pnpm --silent": sin esa bandera pnpm imprime su banner en stdout
y la salida deja de ser JSON valido.

Todos los datos son sinteticos y deterministas: la misma cedula devuelve
siempre el mismo perfil y no se consulta informacion real de ninguna persona.
`.trim();

function fallar(mensaje: string): never {
  console.error(`error: ${mensaje}\n`);
  console.error(USO);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    proposito: { type: "string", default: "auto" },
    resumen: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [comando, argumento] = positionals;

if (values.help || !comando) {
  console.error(USO);
  process.exit(values.help ? 0 : 1);
}

const proposito = values.proposito as Proposito;
if (!PROPOSITOS.includes(proposito)) {
  fallar(`proposito "${proposito}" no valido`);
}

switch (comando) {
  case "perfil": {
    if (!argumento) fallar("falta la cedula");
    imprimir(procesarRegistro({ cedula: argumento }, proposito));
    break;
  }

  case "lote": {
    if (!argumento) fallar("falta el archivo (usa - para leer de stdin)");
    const crudo = argumento === "-" ? readFileSync(0, "utf8") : leerArchivo(argumento);
    const { registros, columnasDetectadas } = parsearInsumo(crudo);
    if (registros.length === 0) fallar("el insumo no tiene ninguna cedula legible");
    const salida = procesarLote(registros, proposito);
    imprimir(values.resumen ? salida.resumen : { ...salida, columnasDetectadas });
    break;
  }

  case "demo": {
    const salida = procesarLote(LOTE_DEMO, proposito);
    imprimir(values.resumen ? salida.resumen : salida);
    break;
  }

  default:
    fallar(`comando "${comando}" desconocido`);
}

function leerArchivo(ruta: string): string {
  try {
    return readFileSync(ruta, "utf8");
  } catch {
    fallar(`no se pudo leer "${ruta}"`);
  }
}

function imprimir(valor: unknown): void {
  process.stdout.write(`${JSON.stringify(valor, null, 2)}\n`);
}
