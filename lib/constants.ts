import type { ProductoId } from "./types";

// ---------------------------------------------------------------------------
// Parametros de negocio. Ajustables en un solo lugar.
// ---------------------------------------------------------------------------

// Salario Minimo Mensual Legal Vigente 2026: Decreto 1469 del 29-dic-2025.
export const SMMLV = 1_750_905;
// Auxilio de transporte 2026 (Decreto 1470/2025). Aplica hasta 2 SMMLV.
export const AUXILIO_TRANSPORTE = 249_095;

// Tope de monto por capacidad de pago. Regla textual del brief:
//   - Ingreso hasta 1 SMMLV  -> libranza por maximo $1.500.000 (monto fijo del brief).
//   - Ingreso por encima     -> hasta 3 veces el salario.
export const TOPE_HASTA_1_SMMLV = 1_500_000;
export const TOPE_MULTIPLO_SALARIO = 3;

// El tope de 3x aplica a credito de consumo/libranza. Se exceptuan:
//   - hipotecario: garantia real y plazo a 15 anos, no se rige por multiplo de salario.
//   - compra_cartera: el monto lo fija la deuda que se va a comprar, no el salario.
export const PRODUCTOS_SIN_TOPE_SALARIAL: ReadonlySet<ProductoId> = new Set<ProductoId>([
  "hipotecario",
  "compra_cartera",
]);

// Umbrales de categoria de afiliacion (multiplos de SMMLV sobre el ingreso).
//   A: <= 2 SMMLV
//   B: > 2 y <= 4 SMMLV
//   C: > 4 SMMLV
//   D: no afiliado (prospecto)
export const CATEGORIA_UMBRALES = {
  A: 2,
  B: 4,
} as const;

// Politica de capacidad de pago.
export const MAX_DTI = 0.4; // La cuota total de deuda no debe superar el 40% del ingreso.
export const DTI_ALERTA = 0.35; // A partir de aqui se considera senal de sobreendeudamiento.

// Antiguedad laboral minima segun vinculo (meses) - tomado del brief y del sitio.
export const ANTIGUEDAD_MINIMA: Record<string, number> = {
  Indefinido: 2,
  "Termino fijo": 6,
  "Prestacion de servicios": 6,
  Independiente: 12,
  Pensionado: 6,
};

// Limites de monto por producto (COP).
// `tasaMensual` es la tasa de interes corriente usada para convertir una cuota
// mensual en monto financiable. Sin ella, `cuota x plazo` sobreestima el monto
// varias veces en los plazos largos. Son ordenes de magnitud de mercado,
// parametrizables: la tasa real la fija la politica comercial.
export const LIMITES_PRODUCTO: Record<
  ProductoId,
  { min: number; max: number; nombre: string; plazoMeses: number; tasaMensual: number }
> = {
  cupo_rotativo: {
    min: 150_000,
    max: 5_000_000,
    nombre: "Cupo de credito rotativo",
    plazoMeses: 12,
    tasaMensual: 0.021,
  },
  libre_inversion: {
    min: 500_000,
    max: 150_000_000,
    nombre: "Credito de libre inversion",
    plazoMeses: 60,
    tasaMensual: 0.0175,
  },
  hipotecario: {
    min: 20_000_000,
    max: 800_000_000,
    nombre: "Credito hipotecario",
    plazoMeses: 180,
    tasaMensual: 0.0105,
  },
  educativo: {
    min: 300_000,
    max: 60_000_000,
    nombre: "Credito educativo",
    plazoMeses: 48,
    tasaMensual: 0.0125,
  },
  compra_cartera: {
    min: 1_000_000,
    max: 150_000_000,
    nombre: "Compra de cartera",
    plazoMeses: 60,
    tasaMensual: 0.0155,
  },
  credito_mujer: {
    min: 500_000,
    max: 30_000_000,
    nombre: "Credito Mujer",
    plazoMeses: 48,
    tasaMensual: 0.0165,
  },
  complementario: {
    min: 300_000,
    max: 20_000_000,
    nombre: "Credito complementario",
    plazoMeses: 36,
    tasaMensual: 0.018,
  },
  rotativo_seguros_impuestos: {
    min: 150_000,
    max: 5_000_000,
    nombre: "Rotativo seguros e impuestos",
    plazoMeses: 11,
    tasaMensual: 0.0195,
  },
};

// Requisitos especificos del Credito Mujer (segun sitio Colsubsidio).
export const CREDITO_MUJER = {
  edadMin: 18,
  edadMax: 69,
  ingresoMinSMMLV: 1,
};
