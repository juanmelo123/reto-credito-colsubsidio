#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { procesarLote, procesarRegistro, filaCompacta } from "../lib/engine";
import { parsearInsumo } from "../lib/insumo";
import { LOTE_DEMO } from "../lib/demo";
import { LIMITES_PRODUCTO, SMMLV, MAX_DTI, TOPE_HASTA_1_SMMLV } from "../lib/constants";
import type { Proposito, RegistroEntrada } from "../lib/types";

// ---------------------------------------------------------------------------
// SERVIDOR MCP del motor de enriquecimiento crediticio.
//
// Expone las mismas funciones que la UI y el CLI, para que un agente consulte
// perfiles y analice cartera sin levantar el servidor de Next.
//
// Criterio de diseno: los lotes devuelven filas compactas por defecto. Un lote
// de 2.000 registros con los criterios de los 8 productos cada uno son cientos
// de miles de tokens que el agente no necesita para responder "a quien llamo
// primero". El detalle completo se pide explicitamente y por registro.
// ---------------------------------------------------------------------------

const proposito = z
  .enum([
    "auto",
    "consumo",
    "libre",
    "vivienda",
    "educacion",
    "unificar",
    "complementario",
    "seguros_impuestos",
  ])
  .default("auto")
  .describe("Producto al que apuntar. 'auto' deja que el motor elija por afinidad.");

const server = new McpServer({ name: "reto-credito-colsubsidio", version: "0.1.0" });

function json(valor: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(valor, null, 2) }] };
}

// --- Perfil individual ------------------------------------------------------
server.registerTool(
  "perfilar_cedula",
  {
    title: "Perfilar una cedula",
    description:
      "Enriquece una cedula con variables exogenas sinteticas y devuelve el perfil completo: " +
      "datos del afiliado, capacidad de pago y los 8 productos del portafolio con su afinidad " +
      "(0-100) y el detalle de que criterio cumple y cual no. Usalo cuando necesites explicar " +
      "una decision, no solo conocerla.",
    inputSchema: {
      cedula: z.string().describe("Numero de cedula (6 a 10 digitos)"),
      proposito,
      insumo: z
        .object({
          nombre: z.string().optional(),
          correo: z.string().optional(),
          direccion: z.string().optional(),
          categoriaAfiliacion: z.enum(["A", "B", "C", "D"]).optional(),
        })
        .optional()
        .describe("Datos que ya conoces. Se respetan tal cual y no se sobrescriben."),
    },
  },
  async ({ cedula, proposito: p, insumo }) => {
    const registro: RegistroEntrada = { cedula, ...insumo };
    return json(procesarRegistro(registro, p as Proposito));
  }
);

// --- Lote -------------------------------------------------------------------
server.registerTool(
  "procesar_lote",
  {
    title: "Procesar un lote",
    description:
      "Procesa muchas cedulas de una vez y devuelve el resumen agregado mas una fila por " +
      "registro (sin el detalle de criterios, para no inundar el contexto). Acepta una lista " +
      "de cedulas o el contenido de un CSV con las columnas del brief. Es la herramienta para " +
      "analizar cartera: priorizar, medir concentracion de riesgo o dimensionar oportunidades.",
    inputSchema: {
      cedulas: z.array(z.string()).optional().describe("Lista de cedulas"),
      csv: z
        .string()
        .optional()
        .describe("Contenido de un CSV con encabezado (cedula, nombre, correo, direccion, categoria)"),
      proposito,
      soloResumen: z
        .boolean()
        .default(false)
        .describe("true devuelve unicamente el resumen agregado, sin las filas"),
    },
  },
  async ({ cedulas, csv, proposito: p, soloResumen }) => {
    const registros: RegistroEntrada[] = csv
      ? parsearInsumo(csv).registros
      : (cedulas ?? []).map((cedula) => ({ cedula }));

    if (registros.length === 0) {
      return json({ error: "Hay que pasar `cedulas` o `csv` con al menos una cedula legible." });
    }

    const { results, resumen, proveedor } = procesarLote(registros, p as Proposito);
    return json(
      soloResumen ? { proveedor, resumen } : { proveedor, resumen, filas: results.map(filaCompacta) }
    );
  }
);

// --- Lote de demostracion ---------------------------------------------------
server.registerTool(
  "lote_demo",
  {
    title: "Lote de demostracion",
    description:
      "Corre el lote curado de 54 casos que cubre los 8 productos del portafolio, los dos topes " +
      "de monto del brief y los tres motivos de rechazo. Util para explorar el motor sin traer " +
      "datos propios.",
    inputSchema: { proposito, soloResumen: z.boolean().default(false) },
  },
  async ({ proposito: p, soloResumen }) => {
    const { results, resumen, proveedor } = procesarLote(LOTE_DEMO, p as Proposito);
    return json(
      soloResumen ? { proveedor, resumen } : { proveedor, resumen, filas: results.map(filaCompacta) }
    );
  }
);

// --- Politica vigente -------------------------------------------------------
// Sin esto el agente tiene que adivinar de donde sale un monto o un rechazo.
server.registerTool(
  "politica_credito",
  {
    title: "Politica de credito vigente",
    description:
      "Devuelve los parametros con los que decide el motor: SMMLV, DTI maximo, topes de monto " +
      "del brief y limites, plazo y tasa de cada uno de los 8 productos. Consultalo antes de " +
      "explicar por que un monto quedo en cierto valor.",
    inputSchema: {},
  },
  async () =>
    json({
      smmlv: SMMLV,
      maxDti: MAX_DTI,
      topeIngresoHasta1Smmlv: TOPE_HASTA_1_SMMLV,
      topeMultiploSalario: 3,
      productosSinTopeSalarial: ["hipotecario", "compra_cartera"],
      productos: LIMITES_PRODUCTO,
      nota:
        "Datos 100% sinteticos y deterministas. La misma cedula devuelve siempre el mismo " +
        "perfil; no se consulta informacion real de ninguna persona.",
    })
);

// Sin top-level await: tsx compila este archivo a CommonJS y ahi no existe.
server.connect(new StdioServerTransport()).catch((e: unknown) => {
  console.error("no se pudo iniciar el servidor MCP:", e);
  process.exit(1);
});
