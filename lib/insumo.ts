import { normalizarCategoria, validarCedula } from "./synthetic";
import type { RegistroEntrada } from "./types";

// ---------------------------------------------------------------------------
// LECTURA DEL INSUMO DEL USUARIO
//
// El reto parte de un archivo que sube el propio usuario. Los campos iniciales
// del brief son cedula, nombre, correo, direccion y categoria de afiliacion:
// si vienen en el archivo se respetan; lo que falte lo enriquece el proveedor.
//
// Soporta CSV con encabezado (`,` `;` o tab) y tambien una lista pelada de
// cedulas, que es como se pegan a mano en la demo.
// ---------------------------------------------------------------------------

// Nombres de columna que se aceptan para cada campo del brief.
export const ALIAS: Record<string, keyof RegistroEntrada> = {
  cedula: "cedula",
  cedulas: "cedula",
  documento: "cedula",
  "numero documento": "cedula",
  "numero de documento": "cedula",
  identificacion: "cedula",
  cc: "cedula",
  id: "cedula",
  nombre: "nombre",
  nombres: "nombre",
  "nombre completo": "nombre",
  "nombre y apellidos": "nombre",
  correo: "correo",
  email: "correo",
  mail: "correo",
  "correo electronico": "correo",
  direccion: "direccion",
  "direccion residencia": "direccion",
  "direccion de residencia": "direccion",
  categoria: "categoriaAfiliacion",
  "categoria afiliacion": "categoriaAfiliacion",
  "categoria de afiliacion": "categoriaAfiliacion",
  "categoria afiliado": "categoriaAfiliacion",
};

export function normalizarEncabezado(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Split que respeta comillas dobles, porque los nombres traen comas.
export function splitCSVLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let enComillas = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (enComillas && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        enComillas = !enComillas;
      }
    } else if (ch === delim && !enComillas) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function detectarDelimitador(linea: string): string {
  const candidatos = [";", ",", "\t", "|"];
  let mejor = ",";
  let max = 0;
  for (const d of candidatos) {
    const n = splitCSVLine(linea, d).length;
    if (n > max) {
      max = n;
      mejor = d;
    }
  }
  return mejor;
}

// Extrae cedulas sueltas de un texto pegado a mano.
function cedulasPeladas(texto: string): RegistroEntrada[] {
  const tokens = texto.split(/[^\d]+/).filter((x) => x.length >= 6 && x.length <= 10);
  return Array.from(new Set(tokens)).map((cedula) => ({ cedula }));
}

export interface InsumoParseado {
  registros: RegistroEntrada[];
  // Campos del brief que el archivo realmente traia (para mostrarlo en la UI).
  columnasDetectadas: (keyof RegistroEntrada)[];
}

export function parsearInsumo(textoRaw: string): InsumoParseado {
  const texto = textoRaw.replace(/^﻿/, "");
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (lineas.length === 0) return { registros: [], columnasDetectadas: [] };

  const delim = detectarDelimitador(lineas[0]);
  const celdasEncabezado = splitCSVLine(lineas[0], delim).map(normalizarEncabezado);
  const mapa = celdasEncabezado.map((h) => ALIAS[h] ?? null);

  // Sin columna de cedula reconocible no hay encabezado: es una lista pelada.
  if (!mapa.includes("cedula")) {
    return { registros: cedulasPeladas(texto), columnasDetectadas: ["cedula"] };
  }

  const columnasDetectadas = Array.from(
    new Set(mapa.filter((c): c is keyof RegistroEntrada => c !== null))
  );

  const vistas = new Set<string>();
  const registros: RegistroEntrada[] = [];
  for (const linea of lineas.slice(1)) {
    const celdas = splitCSVLine(linea, delim);
    const reg: Partial<Record<keyof RegistroEntrada, string>> = {};
    mapa.forEach((campo, i) => {
      const valor = celdas[i]?.trim();
      if (campo && valor) reg[campo] = valor;
    });

    const { normalizada } = validarCedula(reg.cedula ?? "");
    const cedula = normalizada || (reg.cedula ?? "").trim();
    if (!cedula || vistas.has(cedula)) continue;
    vistas.add(cedula);

    registros.push({
      cedula,
      nombre: reg.nombre,
      correo: reg.correo,
      direccion: reg.direccion,
      categoriaAfiliacion: normalizarCategoria(reg.categoriaAfiliacion) ?? undefined,
    });
  }

  return { registros, columnasDetectadas };
}
