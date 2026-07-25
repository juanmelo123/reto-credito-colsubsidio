import {
  SMMLV,
  MAX_DTI,
  DTI_ALERTA,
  ANTIGUEDAD_MINIMA,
  LIMITES_PRODUCTO,
  CREDITO_MUJER,
} from "./constants";
import { roundMonto } from "./format";
import type {
  DatosExogenos,
  Recomendacion,
  ProductoId,
  ProductoElegible,
  Proposito,
} from "./types";

// ---------------------------------------------------------------------------
// MOTOR DE DECISION CREDITICIA
//
// Arbol de decision del MVP:
//   1. Filtros duros (elegibilidad): cedula, antiguedad laboral, mora, embargos.
//   2. Capacidad de pago: DTI actual + cuota adicional disponible.
//   3. Score de aprobacion (0-100) y nivel de riesgo.
//   4. Asignacion de producto del portafolio (con propositos y senales exogenas).
// ---------------------------------------------------------------------------

export function evaluar(
  e: DatosExogenos,
  proposito: Proposito = "auto"
): Recomendacion {
  const razones: string[] = [];
  const alertas: string[] = [];

  // --- 1. FILTROS DUROS -----------------------------------------------------
  const antiguedadMinima = ANTIGUEDAD_MINIMA[e.tipoContrato] ?? 6;
  let elegible = true;

  if (!e.cedulaValida) {
    elegible = false;
    alertas.push("Cedula con formato invalido: no se puede verificar identidad.");
  }
  if (e.antiguedadMeses < antiguedadMinima) {
    elegible = false;
    alertas.push(
      `Antiguedad de ${e.antiguedadMeses} meses no cumple el minimo de ${antiguedadMinima} para vinculo "${e.tipoContrato}".`
    );
  }
  if (e.moraDias >= 60) {
    elegible = false;
    alertas.push(`Mora activa de ${e.moraDias} dias: no elegible para credito nuevo.`);
  } else if (e.moraDias > 0) {
    alertas.push(`Mora leve de ${e.moraDias} dias: revisar antes de aprobar.`);
  }
  if (e.embargos) {
    alertas.push("Reporta embargos vigentes: restringe varios productos.");
  }

  // --- 2. CAPACIDAD DE PAGO -------------------------------------------------
  const dti = e.ingresoEstimado > 0 ? e.cuotaMensualDeudas / e.ingresoEstimado : 0;
  const capacidadCuota = Math.max(0, e.ingresoEstimado * MAX_DTI - e.cuotaMensualDeudas);

  razones.push(
    `Ingreso estimado ${money(e.ingresoEstimado)} (${(e.ingresoEstimado / SMMLV).toFixed(1)} SMMLV) -> categoria ${e.categoriaAfiliacion}.`
  );
  if (e.cuotaMensualDeudas > 0) {
    razones.push(
      `Endeudamiento externo: ${e.entidadesConDeuda} entidad(es), saldo ${money(e.saldoDeudaExterna)}, cuota ${money(e.cuotaMensualDeudas)}/mes -> DTI ${(dti * 100).toFixed(0)}%.`
    );
  } else {
    razones.push("Sin deudas reportadas con otras entidades (DTI 0%).");
  }
  razones.push(`Capacidad de cuota adicional estimada: ${money(capacidadCuota)}/mes.`);

  const sobreendeudado = dti >= DTI_ALERTA && e.entidadesConDeuda >= 2;
  if (sobreendeudado) {
    alertas.push(`Senal de sobreendeudamiento (DTI ${(dti * 100).toFixed(0)}%).`);
  }

  // --- 3. SCORE DE APROBACION (0-100) ---------------------------------------
  const score = calcularScore(e, dti);
  const nivelRiesgo: Recomendacion["nivelRiesgo"] =
    score >= 70 ? "Bajo" : score >= 45 ? "Medio" : "Alto";

  // --- 4. ASIGNACION DE PRODUCTO --------------------------------------------
  if (!elegible) {
    return {
      elegible: false,
      productoRecomendado: null,
      nombreProducto: "No elegible por ahora",
      montoSugerido: 0,
      score,
      nivelRiesgo,
      dti,
      capacidadCuota,
      productosElegibles: [],
      razones,
      alertas,
    };
  }

  const productosElegibles = evaluarProductos(e, capacidadCuota, dti, sobreendeudado, alertas);

  // Seleccion del producto recomendado: propósito declarado tiene prioridad,
  // si es "auto" se elige el de mayor encaje.
  let recomendado: ProductoElegible | undefined;

  if (proposito !== "auto") {
    const objetivo = PROPOSITO_A_PRODUCTO[proposito];
    recomendado = productosElegibles.find((p) => p.id === objetivo);
    if (recomendado) {
      razones.push(`Producto alineado al proposito declarado ("${LABEL_PROPOSITO[proposito]}").`);
    } else {
      razones.push(
        `El proposito "${LABEL_PROPOSITO[proposito]}" no encaja con el perfil; se sugiere la mejor alternativa.`
      );
    }
  }

  if (!recomendado) {
    recomendado = [...productosElegibles].sort((a, b) => b.encaje - a.encaje)[0];
  }

  if (!recomendado) {
    // Elegible pero ningun producto encaja (caso borde).
    return {
      elegible: true,
      productoRecomendado: null,
      nombreProducto: "Sin oferta automatica",
      montoSugerido: 0,
      score,
      nivelRiesgo,
      dti,
      capacidadCuota,
      productosElegibles: [],
      razones,
      alertas,
    };
  }

  // Razon especifica del producto ganador.
  razones.push(motivoProducto(recomendado.id, e, dti, sobreendeudado));

  return {
    elegible: true,
    productoRecomendado: recomendado.id,
    nombreProducto: recomendado.nombre,
    montoSugerido: recomendado.montoSugerido,
    score,
    nivelRiesgo,
    dti,
    capacidadCuota,
    productosElegibles: [...productosElegibles].sort((a, b) => b.encaje - a.encaje),
    razones,
    alertas,
  };
}

// --- Score de aprobacion ----------------------------------------------------
function calcularScore(e: DatosExogenos, dti: number): number {
  let s = 45;
  // Buro (0-950) aporta hasta ~32 puntos.
  s += ((e.scoreBuro - 150) / 800) * 32;
  // Antiguedad.
  if (e.antiguedadMeses >= 36) s += 10;
  else if (e.antiguedadMeses >= 12) s += 5;
  // Categoria / ingreso.
  if (e.categoriaAfiliacion === "C") s += 8;
  else if (e.categoriaAfiliacion === "B") s += 4;
  else if (e.categoriaAfiliacion === "D") s -= 4;
  // Estabilidad del vinculo.
  if (e.tipoContrato === "Indefinido" || e.tipoContrato === "Pensionado") s += 5;
  if (e.tipoContrato === "Independiente" && !e.tieneNegocio) s -= 4;
  // DTI.
  if (dti >= MAX_DTI) s -= 18;
  else if (dti >= DTI_ALERTA) s -= 9;
  // Mora / embargos.
  if (e.moraDias >= 90) s -= 25;
  else if (e.moraDias > 0) s -= 12;
  if (e.embargos) s -= 12;
  // Presencia digital verificable ayuda a validar identidad/actividad.
  if (e.linkedin) s += 2;
  if (e.presenciaDigitalNegocio) s += 2;

  return clamp(Math.round(s), 0, 100);
}

// --- Evaluacion de cada producto del portafolio -----------------------------
function evaluarProductos(
  e: DatosExogenos,
  capacidadCuota: number,
  dti: number,
  sobreendeudado: boolean,
  alertas: string[]
): ProductoElegible[] {
  const out: ProductoElegible[] = [];
  const push = (id: ProductoId, montoRaw: number, encaje: number) => {
    const lim = LIMITES_PRODUCTO[id];
    const monto = roundMonto(clamp(montoRaw, lim.min, lim.max));
    if (monto >= lim.min && encaje > 0) {
      out.push({ id, nombre: lim.nombre, montoSugerido: monto, encaje: clamp(encaje, 0, 100) });
    }
  };

  const capOK = capacidadCuota > 0;

  // Compra de cartera: razon de ser = deudas con otras entidades.
  // Solo debe DOMINAR cuando hay sobreendeudamiento real; si el DTI es bajo,
  // queda como alternativa por debajo de un cupo/credito nuevo.
  if (e.entidadesConDeuda >= 2 && e.saldoDeudaExterna >= LIMITES_PRODUCTO.compra_cartera.min) {
    let encaje = 28 + e.entidadesConDeuda * 6 + (sobreendeudado ? 35 : 0);
    if (e.moraDias > 0) encaje -= 10;
    push("compra_cartera", e.saldoDeudaExterna, encaje);
  }

  // Cupo rotativo / consumo: base para casi todos con capacidad.
  if (capOK) {
    let encaje = 55 - dti * 40;
    if (e.categoriaAfiliacion === "A" || e.categoriaAfiliacion === "B") encaje += 8;
    push("cupo_rotativo", capacidadCuota * LIMITES_PRODUCTO.cupo_rotativo.plazoMeses, encaje);
  }

  // Libre inversion: hasta 150M, incluso sin historial. Ideal independientes/cat C.
  if (capOK && e.moraDias === 0) {
    let encaje = 40 + (e.scoreBuro > 650 ? 15 : 0);
    if (e.categoriaAfiliacion === "C") encaje += 15;
    if (e.tipoContrato === "Independiente" && e.tieneNegocio) encaje += 15;
    if (e.entidadesConDeuda === 0) encaje += 10; // sin historial tradicional -> Colsubsidio lo permite
    push("libre_inversion", capacidadCuota * LIMITES_PRODUCTO.libre_inversion.plazoMeses, encaje);
  }

  // Hipotecario: ticket alto, requiere capacidad e ingreso solidos.
  if (capacidadCuota >= 800_000 && (e.categoriaAfiliacion === "B" || e.categoriaAfiliacion === "C") && e.scoreBuro >= 600 && !e.embargos) {
    let encaje = 30 + (e.categoriaAfiliacion === "C" ? 12 : 0) + (e.edad < 55 ? 8 : 0);
    push("hipotecario", capacidadCuota * LIMITES_PRODUCTO.hipotecario.plazoMeses, encaje);
  }

  // Educativo: accesible, sirve para jovenes / formacion.
  if (capOK) {
    let encaje = 22 + (e.edad <= 35 ? 14 : 0);
    push("educativo", capacidadCuota * LIMITES_PRODUCTO.educativo.plazoMeses, encaje);
  }

  // Credito Mujer: requisitos verificables.
  if (
    e.genero === "F" &&
    e.edad >= CREDITO_MUJER.edadMin &&
    e.edad <= CREDITO_MUJER.edadMax &&
    e.ingresoEstimado > SMMLV * CREDITO_MUJER.ingresoMinSMMLV &&
    e.afiliado &&
    !e.embargos &&
    capOK
  ) {
    // Producto objetivo con beneficios diferenciales: si la afiliada califica,
    // el motor lo prioriza sobre un cupo generico.
    let encaje = 61 - dti * 20 + (e.tipoContrato === "Independiente" ? 6 : 0);
    push("credito_mujer", capacidadCuota * LIMITES_PRODUCTO.credito_mujer.plazoMeses, encaje);
  } else if (e.genero === "F" && e.embargos) {
    alertas.push("Credito Mujer no disponible: reporta embargos.");
  }

  // Rotativo seguros e impuestos: complementario, para quienes ya tienen consumo.
  if (capOK && e.categoriaAfiliacion !== "D") {
    push("rotativo_seguros_impuestos", capacidadCuota * 8, 18);
  }

  return out;
}

// --- Mapeos y textos --------------------------------------------------------
const PROPOSITO_A_PRODUCTO: Record<Exclude<Proposito, "auto">, ProductoId> = {
  consumo: "cupo_rotativo",
  vivienda: "hipotecario",
  educacion: "educativo",
  libre: "libre_inversion",
  unificar: "compra_cartera",
  seguros_impuestos: "rotativo_seguros_impuestos",
};

const LABEL_PROPOSITO: Record<Proposito, string> = {
  auto: "Automatico",
  consumo: "Consumo",
  vivienda: "Vivienda",
  educacion: "Educacion",
  libre: "Libre inversion",
  unificar: "Unificar deudas",
  seguros_impuestos: "Seguros e impuestos",
};

function motivoProducto(
  id: ProductoId,
  e: DatosExogenos,
  dti: number,
  sobreendeudado: boolean
): string {
  switch (id) {
    case "compra_cartera":
      return sobreendeudado
        ? `Se recomienda COMPRA DE CARTERA: unifica ${e.entidadesConDeuda} obligaciones (${money(e.saldoDeudaExterna)}) en una sola cuota con menor tasa, en lugar de otorgar deuda nueva.`
        : `Compra de cartera atractiva: puede consolidar ${e.entidadesConDeuda} creditos externos y mejorar plazo/tasa.`;
    case "libre_inversion":
      return e.entidadesConDeuda === 0
        ? "Libre inversion: perfil sin historial tradicional, producto que Colsubsidio otorga aun sin vida crediticia, con desembolso directo."
        : "Libre inversion: buena capacidad y score para un desembolso directo de ticket medio-alto.";
    case "hipotecario":
      return `Perfil con capacidad e ingreso (categoria ${e.categoriaAfiliacion}) apto para financiacion de vivienda a largo plazo.`;
    case "educativo":
      return "Credito educativo: monto accesible para financiar formacion; encaja con el perfil de edad/ingreso.";
    case "credito_mujer":
      return "Credito Mujer: cumple edad, ingreso, afiliacion vigente y ausencia de embargos; incluye beneficios adicionales.";
    case "cupo_rotativo":
      return `Cupo rotativo: DTI ${(dti * 100).toFixed(0)}% permite un cupo reutilizable para consumo recurrente.`;
    case "rotativo_seguros_impuestos":
      return "Rotativo para seguros e impuestos: complementa el portafolio para pagos puntuales a corto plazo.";
    default:
      return "";
  }
}

function money(v: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(v));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
