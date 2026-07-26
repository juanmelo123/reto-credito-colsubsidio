import {
  SMMLV,
  MAX_DTI,
  DTI_ALERTA,
  ANTIGUEDAD_MINIMA,
  LIMITES_PRODUCTO,
  TOPE_HASTA_1_SMMLV,
  TOPE_MULTIPLO_SALARIO,
  PRODUCTOS_SIN_TOPE_SALARIAL,
} from "./constants";
import { criteriosDe, afinidadDe, PRIORIDAD_PRODUCTO } from "./criterios";
import { roundMonto } from "./format";
import type {
  DatosExogenos,
  Recomendacion,
  ProductoId,
  ProductoEvaluado,
  Proposito,
  Modalidad,
  TipoContrato,
} from "./types";

const TODOS_LOS_PRODUCTOS = Object.keys(LIMITES_PRODUCTO) as ProductoId[];

// Monto financiable con una cuota mensual dada: valor presente de una anualidad.
//   VP = cuota * (1 - (1 + i)^-n) / i
// Sin descontar la tasa, `cuota x plazo` sobreestima el monto varias veces en
// los plazos largos (a 180 meses, casi el triple).
export function montoPorCuota(cuotaMensual: number, producto: ProductoId): number {
  const { plazoMeses, tasaMensual } = LIMITES_PRODUCTO[producto];
  if (cuotaMensual <= 0) return 0;
  if (tasaMensual <= 0) return cuotaMensual * plazoMeses;
  return (cuotaMensual * (1 - Math.pow(1 + tasaMensual, -plazoMeses))) / tasaMensual;
}

// Tope duro de monto por capacidad de pago (regla textual del brief):
//   hasta 1 SMMLV -> $1.500.000 por libranza;  por encima -> 3 veces el salario.
export function topePorCapacidad(ingresoMensual: number): number {
  if (ingresoMensual <= SMMLV) return TOPE_HASTA_1_SMMLV;
  return ingresoMensual * TOPE_MULTIPLO_SALARIO;
}

// La libranza exige pagaduria (descuento de nomina o de mesada pensional).
const CONTRATOS_CON_PAGADURIA: ReadonlySet<TipoContrato> = new Set<TipoContrato>([
  "Indefinido",
  "Termino fijo",
  "Pensionado",
]);

// Los rotativos se recaudan como cupo, no por libranza.
const PRODUCTOS_CUPO: ReadonlySet<ProductoId> = new Set<ProductoId>([
  "cupo_rotativo",
  "rotativo_seguros_impuestos",
]);

export function modalidadDe(producto: ProductoId, contrato: TipoContrato): Modalidad {
  if (PRODUCTOS_CUPO.has(producto)) return "Cupo";
  return CONTRATOS_CON_PAGADURIA.has(contrato) ? "Libranza" : "No libranza";
}

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

  // Tope duro por capacidad de pago (regla del brief).
  const topeMonto = topePorCapacidad(e.ingresoEstimado);
  const modalidadBase: Modalidad = CONTRATOS_CON_PAGADURIA.has(e.tipoContrato)
    ? "Libranza"
    : "No libranza";
  razones.push(
    e.ingresoEstimado <= SMMLV
      ? `Ingreso hasta 1 SMMLV: tope de ${money(topeMonto)} por libranza.`
      : `Tope por capacidad: ${TOPE_MULTIPLO_SALARIO}x el salario = ${money(topeMonto)} (modalidad ${modalidadBase.toLowerCase()} o cupo).`
  );

  const sobreendeudado = dti >= DTI_ALERTA && e.entidadesConDeuda >= 2;
  if (sobreendeudado) {
    alertas.push(`Senal de sobreendeudamiento (DTI ${(dti * 100).toFixed(0)}%).`);
  }

  // --- 3. SCORE DE APROBACION (0-100) ---------------------------------------
  const score = calcularScore(e, dti);
  const nivelRiesgo: Recomendacion["nivelRiesgo"] =
    score >= 70 ? "Bajo" : score >= 45 ? "Medio" : "Alto";

  // --- 4. ASIGNACION DE PRODUCTO --------------------------------------------
  // Los 8 productos se evaluan siempre, incluso si el perfil no es elegible:
  // asi el analista ve que faltaria para que cada uno se abriera.
  const productos = evaluarProductos(e, capacidadCuota, dti);

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
      topeMonto,
      modalidad: modalidadBase,
      productos,
      razones,
      alertas,
    };
  }

  if (e.genero === "F" && e.embargos) {
    alertas.push("Credito Mujer no disponible: reporta embargos.");
  }

  const aplicables = productos.filter((p) => p.aplica);

  // Seleccion del producto recomendado: el proposito declarado tiene prioridad;
  // en "auto" gana el de mayor afinidad.
  let recomendado: ProductoEvaluado | undefined;

  if (proposito !== "auto") {
    const objetivo = PROPOSITO_A_PRODUCTO[proposito];
    recomendado = aplicables.find((p) => p.id === objetivo);
    if (recomendado) {
      razones.push(
        `Producto alineado al proposito declarado ("${LABEL_PROPOSITO[proposito]}"), afinidad ${recomendado.afinidad}%.`
      );
    } else {
      razones.push(
        `El proposito "${LABEL_PROPOSITO[proposito]}" no encaja con el perfil; se sugiere la mejor alternativa.`
      );
    }
  }

  recomendado ??= aplicables[0];

  if (!recomendado) {
    // Elegible pero ningun producto aplica (caso borde).
    return {
      elegible: true,
      productoRecomendado: null,
      nombreProducto: "Sin oferta automatica",
      montoSugerido: 0,
      score,
      nivelRiesgo,
      dti,
      capacidadCuota,
      topeMonto,
      modalidad: modalidadBase,
      productos,
      razones,
      alertas,
    };
  }

  razones.push(
    `Afinidad ${recomendado.afinidad}%: cumple ${recomendado.criterios.filter((c) => c.cumple).length} de ${recomendado.criterios.length} criterios del producto.`
  );

  // Razon especifica del producto ganador.
  razones.push(motivoProducto(recomendado.id, e, dti, sobreendeudado));
  if (recomendado.topeAplicado) {
    razones.push(
      `Monto recortado al tope por capacidad de pago (${money(topeMonto)}); la cuota daba para mas.`
    );
  }

  return {
    elegible: true,
    productoRecomendado: recomendado.id,
    nombreProducto: recomendado.nombre,
    montoSugerido: recomendado.montoSugerido,
    score,
    nivelRiesgo,
    dti,
    capacidadCuota,
    topeMonto,
    modalidad: recomendado.modalidad,
    productos,
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
// Se evaluan SIEMPRE los 8: el analista tiene que poder ver por que se cayo un
// producto, no solo cual quedo. El que incumple un bloqueante sale con
// `aplica: false` y el criterio que lo descarto a la vista.
function evaluarProductos(
  e: DatosExogenos,
  capacidadCuota: number,
  dti: number
): ProductoEvaluado[] {
  const tope = topePorCapacidad(e.ingresoEstimado);

  return TODOS_LOS_PRODUCTOS.map((id) => {
    const lim = LIMITES_PRODUCTO[id];
    // El monto de compra de cartera lo fija la deuda que se compra, no la cuota.
    const montoRaw =
      id === "compra_cartera" ? e.saldoDeudaExterna : montoPorCuota(capacidadCuota, id);

    const criterios = criteriosDe(id, e, {
      dti,
      capacidadCuota,
      montoFinanciable: montoRaw,
    });
    const { afinidad, aplica } = afinidadDe(criterios);

    // El tope por capacidad de pago manda sobre el calculo cuota x plazo.
    const conTope = PRODUCTOS_SIN_TOPE_SALARIAL.has(id) ? montoRaw : Math.min(montoRaw, tope);
    const topeAplicado = conTope < montoRaw;

    return {
      id,
      nombre: lim.nombre,
      montoSugerido: aplica ? roundMonto(clamp(conTope, lim.min, lim.max)) : 0,
      afinidad,
      aplica,
      criterios,
      modalidad: modalidadDe(id, e.tipoContrato),
      topeAplicado: aplica && topeAplicado,
    };
  }).sort(porAfinidad);
}

// Ordena por afinidad; a igual afinidad gana el producto mas especifico.
function porAfinidad(a: ProductoEvaluado, b: ProductoEvaluado): number {
  if (a.aplica !== b.aplica) return a.aplica ? -1 : 1;
  if (b.afinidad !== a.afinidad) return b.afinidad - a.afinidad;
  return PRIORIDAD_PRODUCTO.indexOf(a.id) - PRIORIDAD_PRODUCTO.indexOf(b.id);
}

// --- Mapeos y textos --------------------------------------------------------
const PROPOSITO_A_PRODUCTO: Record<Exclude<Proposito, "auto">, ProductoId> = {
  consumo: "cupo_rotativo",
  vivienda: "hipotecario",
  educacion: "educativo",
  libre: "libre_inversion",
  unificar: "compra_cartera",
  complementario: "complementario",
  seguros_impuestos: "rotativo_seguros_impuestos",
};

const LABEL_PROPOSITO: Record<Proposito, string> = {
  auto: "Automatico",
  consumo: "Consumo",
  vivienda: "Vivienda",
  educacion: "Educacion",
  libre: "Libre inversion",
  unificar: "Unificar deudas",
  complementario: "Credito complementario",
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
    case "complementario":
      return `Credito complementario: afiliado al dia con ${e.entidadesConDeuda} obligacion(es) y DTI ${(dti * 100).toFixed(0)}%; admite una linea adicional sin comprometer la capacidad.`;
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
