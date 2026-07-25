// Tipos compartidos del motor de enriquecimiento y decision crediticia.

export type Genero = "F" | "M";

export type CategoriaAfiliacion = "A" | "B" | "C" | "D";

export type TipoContrato =
  | "Indefinido"
  | "Termino fijo"
  | "Prestacion de servicios"
  | "Independiente"
  | "Pensionado";

export type ProductoId =
  | "cupo_rotativo"
  | "libre_inversion"
  | "hipotecario"
  | "educativo"
  | "compra_cartera"
  | "credito_mujer"
  | "rotativo_seguros_impuestos";

export type Proposito =
  | "auto"
  | "consumo"
  | "vivienda"
  | "educacion"
  | "libre"
  | "unificar"
  | "seguros_impuestos";

// Variables exogenas sinteticas: lo que un buro / scraper devolveria a partir de la cedula.
export interface DatosExogenos {
  cedula: string;
  cedulaValida: boolean;
  // Identidad y contacto
  nombre: string;
  genero: Genero;
  edad: number;
  ciudad: string;
  correo: string;
  instagram: string | null;
  linkedin: boolean;
  // Laboral / ingreso
  tipoContrato: TipoContrato;
  antiguedadMeses: number;
  ingresoEstimado: number;
  categoriaAfiliacion: CategoriaAfiliacion;
  afiliado: boolean;
  // Senales de mercado (endeudamiento)
  scoreBuro: number; // 150 - 950 (simulado)
  entidadesConDeuda: number;
  saldoDeudaExterna: number;
  cuotaMensualDeudas: number;
  moraDias: number; // 0 = al dia
  embargos: boolean;
  // Actividad economica (independientes)
  tieneNegocio: boolean;
  presenciaDigitalNegocio: boolean;
}

export interface ProductoElegible {
  id: ProductoId;
  nombre: string;
  montoSugerido: number;
  encaje: number; // 0 - 100, que tanto encaja el producto con el perfil
}

export interface Recomendacion {
  elegible: boolean;
  productoRecomendado: ProductoId | null;
  nombreProducto: string;
  montoSugerido: number;
  score: number; // 0 - 100 (probabilidad de aprobacion / calidad crediticia)
  nivelRiesgo: "Bajo" | "Medio" | "Alto";
  dti: number; // 0 - 1
  capacidadCuota: number; // cuota mensual adicional que puede asumir
  productosElegibles: ProductoElegible[];
  razones: string[]; // por que se recomienda / como se llego al monto
  alertas: string[]; // banderas de riesgo
}

export interface PerfilCompleto {
  exogenos: DatosExogenos;
  recomendacion: Recomendacion;
}

export interface EnrichRequest {
  cedulas: string[];
  proposito?: Proposito;
}

export interface EnrichResponse {
  results: PerfilCompleto[];
  resumen: {
    total: number;
    elegibles: number;
    noElegibles: number;
    ingresoPromedio: number;
    distribucionProducto: Record<string, number>;
    distribucionCategoria: Record<string, number>;
    distribucionRiesgo: Record<string, number>;
  };
}
