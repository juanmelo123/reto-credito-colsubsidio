import {
  SMMLV,
  DTI_ALERTA,
  MAX_DTI,
  LIMITES_PRODUCTO,
  CREDITO_MUJER,
  ANTIGUEDAD_MINIMA,
} from "./constants";
import type { Criterio, DatosExogenos, ProductoId } from "./types";

// ---------------------------------------------------------------------------
// AFINIDAD POR PRODUCTO
//
// Cada producto declara el perfil de cliente que busca como una lista de
// criterios con peso. La afinidad es simplemente:
//
//   afinidad = puntos de los criterios que cumple / puntos posibles
//
// Con eso el numero que ve el analista y las razones que lo sustentan salen del
// MISMO lugar: no se pueden desincronizar. Cambiar un peso cambia el %, la
// razon y el orden del portafolio a la vez.
//
// Un criterio `bloqueante` que no se cumple deja el producto en "no aplica":
// no es que encaje poco, es que no se puede otorgar.
// ---------------------------------------------------------------------------

export interface ContextoDecision {
  dti: number;
  capacidadCuota: number;
  // Monto que se financiaria con la capacidad disponible, antes de topes.
  montoFinanciable: number;
}

// Constructor corto: los criterios se leen como una tabla.
function c(
  peso: number,
  cumple: boolean,
  etiqueta: string,
  detalle: string,
  bloqueante = false
): Criterio {
  return { peso, cumple, etiqueta, detalle, bloqueante };
}

function money(v: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(v));
}

function enSMMLV(v: number): string {
  return `${(v / SMMLV).toFixed(1)} SMMLV`;
}

// Lo que vale para TODO el portafolio: los filtros duros de elegibilidad, poder
// pagar la cuota, y que el monto alcance el minimo comercial del producto.
//
// Los filtros duros van aqui y no solo en `decision.ts` porque si no, un perfil
// no elegible mostraba sus productos como disponibles: "no elegible" arriba y
// "Credito complementario 92%, $20.000.000" abajo. Modelados como criterios
// bloqueantes, un rechazo global apaga los 8 productos con su motivo a la vista.
function criteriosBase(id: ProductoId, e: DatosExogenos, ctx: ContextoDecision): Criterio[] {
  const lim = LIMITES_PRODUCTO[id];
  const monto = id === "compra_cartera" ? e.saldoDeudaExterna : ctx.montoFinanciable;
  const antiguedadMinima = ANTIGUEDAD_MINIMA[e.tipoContrato] ?? 6;

  return [
    c(
      10,
      e.cedulaValida,
      "Cédula con formato válido",
      e.cedulaValida ? `${e.cedula}` : `${e.cedula}: no se puede verificar identidad`,
      true
    ),
    c(
      12,
      e.antiguedadMeses >= antiguedadMinima,
      `Antigüedad mínima del vínculo (${antiguedadMinima} meses para "${e.tipoContrato}")`,
      `${e.antiguedadMeses} meses`,
      true
    ),
    c(
      12,
      e.moraDias < 60,
      "Sin mora vigente de 60 días o más",
      e.moraDias === 0 ? "Al día con el sistema" : `Mora de ${e.moraDias} días`,
      true
    ),
    c(
      18,
      ctx.capacidadCuota > 0,
      `Capacidad de cuota disponible (DTI < ${Math.round(MAX_DTI * 100)}%)`,
      ctx.capacidadCuota > 0
        ? `${money(ctx.capacidadCuota)}/mes libres`
        : `Sin margen: la cuota actual ya copa el ${Math.round(MAX_DTI * 100)}% del ingreso`,
      true
    ),
    c(
      15,
      monto >= lim.min,
      `Monto alcanza el mínimo del producto (${money(lim.min)})`,
      monto >= lim.min
        ? `Financiable ${money(monto)}`
        : `Solo financiable ${money(monto)} con la capacidad actual`,
      true
    ),
  ];
}

// --- Perfil objetivo de cada producto ---------------------------------------
function criteriosPropios(
  id: ProductoId,
  e: DatosExogenos,
  ctx: ContextoDecision
): Criterio[] {
  const { dti } = ctx;
  const pctDti = `${(dti * 100).toFixed(0)}%`;
  const sinMora = e.moraDias === 0;
  const textoMora = sinMora ? "Al día con el sistema" : `Mora de ${e.moraDias} días`;

  switch (id) {
    // Producto de entrada: consumo recurrente de ticket chico.
    case "cupo_rotativo":
      return [
        c(15, dti < MAX_DTI, `DTI bajo el ${Math.round(MAX_DTI * 100)}%`, `DTI actual ${pctDti}`),
        c(15, sinMora, "Sin mora vigente", textoMora),
        c(
          20,
          e.categoriaAfiliacion === "A" || e.categoriaAfiliacion === "B",
          "Categoría A o B",
          `Categoría ${e.categoriaAfiliacion}`
        ),
        c(15, e.scoreBuro >= 600, "Score de buró >= 600", `Buró ${e.scoreBuro}`),
        c(
          15,
          e.ingresoEstimado <= SMMLV * 4,
          "Ingreso hasta 4 SMMLV (encaja el ticket chico)",
          `Ingreso ${money(e.ingresoEstimado)} (${enSMMLV(e.ingresoEstimado)})`
        ),
        c(12, e.antiguedadMeses >= 12, "Antigüedad laboral >= 12 meses", `${e.antiguedadMeses} meses`),
      ];

    // Ticket medio-alto y desembolso directo, incluso sin vida crediticia.
    case "libre_inversion":
      return [
        c(15, sinMora, "Sin mora vigente", textoMora, true),
        c(20, e.scoreBuro >= 650, "Score de buró >= 650", `Buró ${e.scoreBuro}`),
        c(
          15,
          e.ingresoEstimado > SMMLV * 2,
          "Ingreso sobre 2 SMMLV (soporta ticket alto)",
          `Ingreso ${money(e.ingresoEstimado)} (${enSMMLV(e.ingresoEstimado)})`
        ),
        c(
          15,
          e.entidadesConDeuda === 0,
          "Sin obligaciones vigentes: Colsubsidio presta sin historial",
          e.entidadesConDeuda === 0
            ? "No reporta créditos con otras entidades"
            : `${e.entidadesConDeuda} entidad(es) con deuda vigente`
        ),
        c(15, e.antiguedadMeses >= 12, "Antigüedad laboral >= 12 meses", `${e.antiguedadMeses} meses`),
      ];

    // Ticket alto a 15 anos: exige respaldo y horizonte laboral.
    case "hipotecario":
      return [
        c(
          12,
          e.categoriaAfiliacion === "B" || e.categoriaAfiliacion === "C",
          "Categoría B o C",
          `Categoría ${e.categoriaAfiliacion}`,
          true
        ),
        c(12, e.scoreBuro >= 600, "Score de buró >= 600", `Buró ${e.scoreBuro}`, true),
        c(8, !e.embargos, "Sin embargos vigentes", e.embargos ? "Reporta embargos" : "Sin embargos", true),
        // Un credito a 15 anos no se otorga sobre un vinculo recien estrenado,
        // por corta que sea la antiguedad minima general del contrato.
        c(10, e.antiguedadMeses >= 12, "Antigüedad laboral >= 12 meses", `${e.antiguedadMeses} meses`, true),
        c(18, e.edad < 50, "Edad bajo 50 (el plazo llega a 180 meses)", `${e.edad} años`),
        c(15, e.antiguedadMeses >= 36, "Antigüedad laboral >= 36 meses", `${e.antiguedadMeses} meses`),
        c(
          15,
          e.tipoContrato === "Indefinido" || e.tipoContrato === "Pensionado",
          "Vínculo estable con pagaduría",
          e.tipoContrato
        ),
      ];

    // La senal es la etapa formativa.
    case "educativo":
      return [
        c(30, e.edad <= 30, "Edad hasta 30 (etapa formativa)", `${e.edad} años`),
        c(15, e.edad <= 35, "Edad hasta 35", `${e.edad} años`),
        c(
          15,
          e.categoriaAfiliacion === "A" || e.categoriaAfiliacion === "B",
          "Categoría A o B (subsidio educativo)",
          `Categoría ${e.categoriaAfiliacion}`
        ),
        c(10, sinMora, "Sin mora vigente", textoMora),
        c(10, e.antiguedadMeses >= 6, "Antigüedad laboral >= 6 meses", `${e.antiguedadMeses} meses`),
        c(10, e.scoreBuro >= 550, "Score de buró >= 550", `Buró ${e.scoreBuro}`),
      ];

    // Razon de ser puramente exogena: deuda repartida en varias entidades.
    case "compra_cartera":
      return [
        c(
          20,
          e.entidadesConDeuda >= 2,
          "Deuda en 2 o más entidades",
          `${e.entidadesConDeuda} entidad(es), saldo ${money(e.saldoDeudaExterna)}`,
          true
        ),
        c(
          30,
          dti >= DTI_ALERTA,
          `Señal de sobreendeudamiento (DTI >= ${Math.round(DTI_ALERTA * 100)}%)`,
          `DTI actual ${pctDti}`
        ),
        c(10, e.entidadesConDeuda >= 3, "Deuda dispersa en 3 o más entidades", `${e.entidadesConDeuda} entidad(es)`),
        c(15, sinMora, "Sin mora vigente (unificar antes de caer en mora)", textoMora),
        c(15, e.scoreBuro >= 500, "Score de buró >= 500", `Buró ${e.scoreBuro}`),
      ];

    // Producto objetivo: requisitos verificables del sitio de Colsubsidio.
    case "credito_mujer":
      return [
        c(20, e.genero === "F", "Genero femenino", e.genero === "F" ? "Femenino" : "Masculino", true),
        c(
          8,
          e.edad >= CREDITO_MUJER.edadMin && e.edad <= CREDITO_MUJER.edadMax,
          `Edad entre ${CREDITO_MUJER.edadMin} y ${CREDITO_MUJER.edadMax}`,
          `${e.edad} años`,
          true
        ),
        c(
          12,
          e.ingresoEstimado > SMMLV * CREDITO_MUJER.ingresoMinSMMLV,
          `Ingreso sobre ${CREDITO_MUJER.ingresoMinSMMLV} SMMLV`,
          `${money(e.ingresoEstimado)} (${enSMMLV(e.ingresoEstimado)})`,
          true
        ),
        c(10, e.afiliado, "Afiliación vigente a Colsubsidio", e.afiliado ? "Afiliada vigente" : "No afiliada (categoría D)", true),
        c(8, !e.embargos, "Sin embargos vigentes", e.embargos ? "Reporta embargos" : "Sin embargos", true),
        c(15, dti < DTI_ALERTA, `DTI bajo el ${Math.round(DTI_ALERTA * 100)}%`, `DTI actual ${pctDti}`),
        c(
          15,
          e.tieneNegocio,
          "Actividad económica propia (emprendimiento)",
          e.tieneNegocio
            ? e.presenciaDigitalNegocio
              ? "Negocio propio con presencia digital verificable"
              : "Negocio propio"
            : "Sin actividad económica propia detectada"
        ),
      ];

    // Linea adicional para el afiliado que ya se mueve sano en el mercado.
    case "complementario":
      return [
        c(15, e.afiliado, "Afiliación vigente a Colsubsidio", e.afiliado ? "Afiliado vigente" : "No afiliado (categoría D)", true),
        c(12, sinMora, "Sin mora vigente", textoMora, true),
        c(
          25,
          e.entidadesConDeuda >= 1 && e.entidadesConDeuda <= 2,
          "Entre 1 y 2 obligaciones vigentes al día",
          `${e.entidadesConDeuda} entidad(es) con deuda`
        ),
        c(15, dti < DTI_ALERTA, `DTI bajo el ${Math.round(DTI_ALERTA * 100)}%`, `DTI actual ${pctDti}`),
        c(10, e.antiguedadMeses >= 24, "Antigüedad laboral >= 24 meses", `${e.antiguedadMeses} meses`),
        c(8, e.scoreBuro >= 650, "Score de buró >= 650", `Buró ${e.scoreBuro}`),
      ];

    // La senal es tener que pagar predial, vehiculo o polizas.
    case "rotativo_seguros_impuestos":
      return [
        c(
          12,
          e.categoriaAfiliacion !== "D",
          "Afiliado a la caja",
          e.categoriaAfiliacion === "D" ? "No afiliado (categoría D)" : `Categoría ${e.categoriaAfiliacion}`,
          true
        ),
        c(
          25,
          e.categoriaAfiliacion === "C",
          "Categoría C (patrimonio con predial / vehículo / pólizas)",
          `Categoría ${e.categoriaAfiliacion}`
        ),
        c(
          20,
          e.tieneNegocio,
          "Actividad económica propia (obligaciones tributarias)",
          e.tieneNegocio ? "Negocio propio" : "Sin actividad económica propia detectada"
        ),
        c(15, sinMora, "Sin mora vigente", textoMora),
        c(10, e.scoreBuro >= 550, "Score de buró >= 550", `Buró ${e.scoreBuro}`),
      ];
  }
}

export function criteriosDe(
  id: ProductoId,
  e: DatosExogenos,
  ctx: ContextoDecision
): Criterio[] {
  return [...criteriosBase(id, e, ctx), ...criteriosPropios(id, e, ctx)];
}

// Afinidad = puntos cumplidos / puntos posibles. `aplica` es false apenas se
// incumple un bloqueante: el producto no es que encaje poco, es que no se puede
// otorgar.
export function afinidadDe(criterios: Criterio[]): { afinidad: number; aplica: boolean } {
  let posibles = 0;
  let obtenidos = 0;
  let aplica = true;
  for (const cr of criterios) {
    posibles += cr.peso;
    if (cr.cumple) obtenidos += cr.peso;
    else if (cr.bloqueante) aplica = false;
  }
  const afinidad = posibles > 0 ? Math.round((obtenidos / posibles) * 100) : 0;
  return { afinidad, aplica };
}

// Desempate cuando dos productos empatan en afinidad: gana el mas especifico.
// Un cupo rotativo encaja con casi todo el mundo; una compra de cartera solo
// encaja cuando el dato exogeno la justifica, y esa senal debe mandar.
export const PRIORIDAD_PRODUCTO: ProductoId[] = [
  "compra_cartera",
  "hipotecario",
  "credito_mujer",
  "educativo",
  "rotativo_seguros_impuestos",
  "complementario",
  "libre_inversion",
  "cupo_rotativo",
];
