import { makeRng, type Rng } from "./prng";
import { SMMLV, CATEGORIA_UMBRALES } from "./constants";
import type {
  DatosExogenos,
  Genero,
  CategoriaAfiliacion,
  TipoContrato,
} from "./types";

// ---------------------------------------------------------------------------
// MOTOR DE DATOS EXOGENOS SINTETICOS
//
// Simula lo que un buro de credito / scraper de fuentes externas devolveria a
// partir de una cedula: contacto, redes, ingreso estimado, categoria de
// afiliacion y senales de endeudamiento en el mercado.
//
// Es 100% sintetico y deterministico: NO se consulta informacion real de
// ninguna persona. La misma cedula -> el mismo perfil, siempre.
// ---------------------------------------------------------------------------

const NOMBRES_F = [
  "Maria", "Luz", "Ana", "Sandra", "Diana", "Paula", "Laura", "Carolina",
  "Andrea", "Claudia", "Marcela", "Angela", "Patricia", "Johana", "Daniela",
  "Camila", "Valentina", "Natalia", "Gloria", "Adriana", "Yolanda", "Liliana",
];
const NOMBRES_M = [
  "Juan", "Carlos", "Andres", "Luis", "Jorge", "Diego", "Julian", "Santiago",
  "David", "Fabian", "Oscar", "Cristian", "Sergio", "Mauricio", "Nicolas",
  "Felipe", "Miguel", "Wilson", "Alexander", "German", "Ivan", "Ricardo",
];
const APELLIDOS = [
  "Rodriguez", "Gomez", "Gonzalez", "Martinez", "Lopez", "Garcia", "Perez",
  "Sanchez", "Ramirez", "Torres", "Diaz", "Vargas", "Castro", "Rojas",
  "Moreno", "Munoz", "Gutierrez", "Rivera", "Jimenez", "Herrera", "Medina",
  "Castaneda", "Cardenas", "Ospina", "Quintero", "Suarez", "Mejia", "Cortes",
];
const CIUDADES = [
  { nombre: "Bogota", peso: 30 },
  { nombre: "Medellin", peso: 14 },
  { nombre: "Cali", peso: 11 },
  { nombre: "Barranquilla", peso: 8 },
  { nombre: "Cartagena", peso: 5 },
  { nombre: "Bucaramanga", peso: 5 },
  { nombre: "Soacha", peso: 5 },
  { nombre: "Cucuta", peso: 4 },
  { nombre: "Pereira", peso: 4 },
  { nombre: "Ibague", peso: 3 },
  { nombre: "Manizales", peso: 3 },
  { nombre: "Villavicencio", peso: 3 },
  { nombre: "Neiva", peso: 3 },
  { nombre: "Zipaquira", peso: 2 },
];

const DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com"];

// Quita tildes/enes para armar correos y usuarios "scrapeables".
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Deriva la categoria de afiliacion a partir del ingreso (en multiplos de SMMLV).
function categoriaPorIngreso(ingreso: number): CategoriaAfiliacion {
  const enSalarios = ingreso / SMMLV;
  if (enSalarios <= CATEGORIA_UMBRALES.A) return "A";
  if (enSalarios <= CATEGORIA_UMBRALES.B) return "B";
  return "C";
}

function generarNombre(rng: Rng, genero: Genero): string {
  const pila = genero === "F" ? NOMBRES_F : NOMBRES_M;
  const primer = rng.pick(pila);
  // Mantener el mismo patron de draws del PRNG: bool siempre, pick solo si true.
  let segundo = "";
  if (rng.bool(0.4)) {
    const s = rng.pick(pila);
    segundo = s === primer ? "" : ` ${s}`; // evita nombre repetido sin draw extra
  }
  const ap1 = rng.pick(APELLIDOS);
  const ap2 = rng.pick(APELLIDOS);
  return `${primer}${segundo} ${ap1} ${ap2}`;
}

function generarCorreo(rng: Rng, nombre: string, cedula: string): string {
  const partes = nombre.split(" ").map(slug).filter(Boolean);
  const nick = partes[0];
  const ap = partes[partes.length - 1];
  const sufijo = rng.bool(0.6) ? cedula.slice(-Math.min(4, cedula.length)) : `${rng.int(1, 99)}`;
  const estilo = rng.int(0, 3);
  let local: string;
  if (estilo === 0) local = `${nick}.${ap}${sufijo}`;
  else if (estilo === 1) local = `${nick}${ap}`;
  else if (estilo === 2) local = `${nick}_${ap}${sufijo}`;
  else local = `${nick}${sufijo}`;
  return `${local}@${rng.pick(DOMINIOS)}`;
}

// Valida formato de cedula colombiana (solo digitos, longitud razonable).
export function validarCedula(raw: string): { valida: boolean; normalizada: string } {
  const normalizada = raw.replace(/[.\s-]/g, "").trim();
  const valida = /^\d{6,10}$/.test(normalizada);
  return { valida, normalizada };
}

export function generarExogenos(cedulaRaw: string): DatosExogenos {
  const { valida, normalizada } = validarCedula(cedulaRaw);
  const cedula = normalizada || cedulaRaw.trim();

  const rng = makeRng(`col-cred::${cedula}`);

  const genero: Genero = rng.bool(0.51) ? "F" : "M";
  const edad = clamp(Math.round(rng.normal(38, 13)), 18, 78);
  const nombre = generarNombre(rng, genero);
  const ciudad = rng.weighted(CIUDADES.map((c) => ({ value: c.nombre, weight: c.peso })));
  const correo = generarCorreo(rng, nombre, cedula);
  const instagram = rng.bool(0.62) ? `@${slug(nombre.split(" ")[0])}${rng.int(1, 999)}` : null;
  const linkedin = rng.bool(0.34);

  // Ingreso estimado: distribucion log-normal sesgada a la derecha (mediana ~1.6 SMMLV).
  const factorIngreso = clamp(rng.lognormal(0.45, 0.62), 0.55, 30);
  const ingresoEstimado = Math.round((SMMLV * factorIngreso) / 10_000) * 10_000;

  // Afiliacion: ~12% son prospectos NO afiliados (categoria D).
  const afiliado = !rng.bool(0.12);
  const categoriaAfiliacion: CategoriaAfiliacion = afiliado
    ? categoriaPorIngreso(ingresoEstimado)
    : "D";

  // Vinculo laboral (pensionados mas frecuentes en edades altas).
  const tipoContrato: TipoContrato = rng.weighted<TipoContrato>([
    { value: "Indefinido", weight: edad > 60 ? 15 : 34 },
    { value: "Termino fijo", weight: 22 },
    { value: "Prestacion de servicios", weight: 16 },
    { value: "Independiente", weight: 20 },
    { value: "Pensionado", weight: edad > 58 ? 30 : 4 },
  ]);

  const antiguedadMeses = generarAntiguedad(rng, tipoContrato, edad);

  // Score de buro simulado (150-950), correlacionado con ingreso.
  const baseScore = 520 + (Math.log(factorIngreso + 1) / Math.log(31)) * 300;
  let scoreBuro = clamp(Math.round(rng.normal(baseScore, 110)), 150, 950);

  // Endeudamiento en el mercado (senal exogena clave).
  const entidadesConDeuda = rng.weighted([
    { value: 0, weight: 22 },
    { value: 1, weight: 30 },
    { value: 2, weight: 24 },
    { value: 3, weight: 14 },
    { value: 4, weight: 7 },
    { value: 5, weight: 3 },
  ]);

  let saldoDeudaExterna = 0;
  let cuotaMensualDeudas = 0;
  if (entidadesConDeuda > 0) {
    // El saldo escala con ingreso y numero de entidades.
    const factorDeuda = rng.lognormal(0.1, 0.7) * entidadesConDeuda;
    saldoDeudaExterna = Math.round((ingresoEstimado * factorDeuda) / 100_000) * 100_000;
    saldoDeudaExterna = clamp(saldoDeudaExterna, 300_000, ingresoEstimado * 40);
    // Cuota mensual aprox = saldo / plazo promedio (18-40 meses).
    const plazo = rng.int(18, 40);
    cuotaMensualDeudas = Math.round(saldoDeudaExterna / plazo / 10_000) * 10_000;
  }

  // Mora: mas probable con score bajo y varias entidades.
  const probMora = clamp(0.05 + (700 - scoreBuro) / 2000 + entidadesConDeuda * 0.02, 0.02, 0.5);
  const moraDias = rng.bool(probMora) ? rng.pick([15, 30, 30, 60, 90, 120]) : 0;
  if (moraDias > 0) scoreBuro = clamp(scoreBuro - moraDias, 150, 950);

  const embargos = rng.bool(clamp(0.02 + (moraDias > 60 ? 0.1 : 0), 0.02, 0.15));

  // Actividad economica para independientes.
  const esIndep = tipoContrato === "Independiente";
  const tieneNegocio = esIndep ? rng.bool(0.7) : rng.bool(0.12);
  const presenciaDigitalNegocio = tieneNegocio ? rng.bool(0.55) : false;

  return {
    cedula,
    cedulaValida: valida,
    nombre,
    genero,
    edad,
    ciudad,
    correo,
    instagram,
    linkedin,
    tipoContrato,
    antiguedadMeses,
    ingresoEstimado,
    categoriaAfiliacion,
    afiliado,
    scoreBuro,
    entidadesConDeuda,
    saldoDeudaExterna,
    cuotaMensualDeudas,
    moraDias,
    embargos,
    tieneNegocio,
    presenciaDigitalNegocio,
  };
}

function generarAntiguedad(rng: Rng, contrato: TipoContrato, edad: number): number {
  const maxPosible = Math.max(2, (edad - 18) * 12);
  if (contrato === "Pensionado") {
    return Math.min(clamp(Math.round(rng.normal(60, 40)), 1, 300), maxPosible);
  }
  if (contrato === "Independiente") {
    return Math.min(clamp(Math.round(rng.lognormal(2.7, 0.9)), 1, 240), maxPosible);
  }
  // Asalariados: mediana ~18 meses, con cola hacia antiguedades largas.
  return Math.min(clamp(Math.round(rng.lognormal(2.9, 0.85)), 1, 300), maxPosible);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Genera N cedulas sinteticas (para probar el flujo por lote).
export function generarCedulasEjemplo(n: number): string[] {
  const rng = makeRng(`lote-demo::${n}`);
  const out: string[] = [];
  const usadas = new Set<string>();
  while (out.length < n) {
    const len = rng.pick([8, 10, 10, 10]);
    let ced = `${rng.int(1, 9)}`;
    for (let i = 1; i < len; i++) ced += `${rng.int(0, 9)}`;
    if (!usadas.has(ced)) {
      usadas.add(ced);
      out.push(ced);
    }
  }
  return out;
}
