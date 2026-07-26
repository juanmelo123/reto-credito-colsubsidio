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
  | "complementario"
  | "rotativo_seguros_impuestos";

export type Proposito =
  | "auto"
  | "consumo"
  | "vivienda"
  | "educacion"
  | "libre"
  | "unificar"
  | "complementario"
  | "seguros_impuestos";

// Modalidad de desembolso/recaudo (regla de perfilamiento del brief).
export type Modalidad = "Libranza" | "No libranza" | "Cupo";

// Campos que el brief define como insumo que sube el usuario. Si vienen en el
// archivo NO se sintetizan: se respetan y se marcan como origen "insumo".
export type CampoInsumo = "nombre" | "correo" | "direccion" | "categoriaAfiliacion";

export interface RegistroEntrada {
  cedula: string;
  nombre?: string;
  correo?: string;
  direccion?: string;
  categoriaAfiliacion?: CategoriaAfiliacion;
}

// Variables exogenas sinteticas: lo que un buro / scraper devolveria a partir de la cedula.
export interface DatosExogenos {
  cedula: string;
  cedulaValida: boolean;
  // Identidad y contacto
  nombre: string;
  genero: Genero;
  edad: number;
  ciudad: string;
  direccion: string;
  correo: string;
  instagram: string | null;
  linkedin: boolean;
  // Trazabilidad: que campos vinieron del archivo del usuario y cuales se enriquecieron.
  camposDeInsumo: CampoInsumo[];
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
  modalidad: Modalidad;
  topeAplicado: boolean; // true si el tope por capacidad recorto el monto
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
  topeMonto: number; // tope duro por capacidad de pago (regla del brief)
  modalidad: Modalidad;
  productosElegibles: ProductoElegible[];
  razones: string[]; // por que se recomienda / como se llego al monto
  alertas: string[]; // banderas de riesgo
}

export interface PerfilCompleto {
  exogenos: DatosExogenos;
  recomendacion: Recomendacion;
}

export interface EnrichRequest {
  // Forma nueva: respeta los campos del insumo del usuario.
  registros?: RegistroEntrada[];
  // Forma corta (compatibilidad): solo cedulas, todo lo demas se enriquece.
  cedulas?: string[];
  proposito?: Proposito;
}

export interface EnrichResponse {
  proveedor: string; // que fuente de datos exogenos genero los perfiles
  results: PerfilCompleto[];
  resumen: {
    total: number;
    elegibles: number;
    noElegibles: number;
    ingresoPromedio: number;
    camposDeInsumo: number; // registros que traian datos propios del usuario
    distribucionProducto: Record<string, number>;
    distribucionCategoria: Record<string, number>;
    distribucionRiesgo: Record<string, number>;
    distribucionModalidad: Record<string, number>;
  };
}
