import { evaluar } from "./decision";
import { LIMITES_PRODUCTO } from "./constants";
import { proveedorPorDefecto, type ProveedorExogenos } from "./proveedor";
import type {
  PerfilCompleto,
  Proposito,
  EnrichResponse,
  RegistroEntrada,
} from "./types";

// Enriquece + perfila un solo registro del insumo.
export function procesarRegistro(
  registro: RegistroEntrada,
  proposito: Proposito = "auto",
  proveedor: ProveedorExogenos = proveedorPorDefecto
): PerfilCompleto {
  const exogenos = proveedor.enriquecer(registro);
  const recomendacion = evaluar(exogenos, proposito);
  return { exogenos, recomendacion };
}

// Atajo cuando lo unico que hay es la cedula.
export function procesarCedula(
  cedula: string,
  proposito: Proposito = "auto",
  proveedor: ProveedorExogenos = proveedorPorDefecto
): PerfilCompleto {
  return procesarRegistro({ cedula }, proposito, proveedor);
}

// Una fila por registro con lo que sirve para analizar cartera. El perfil
// completo trae los criterios de los 8 productos: util en pantalla, ruidoso
// cuando lo que se quiere es mirar 2.000 registros de un golpe.
export interface FilaCompacta {
  cedula: string;
  nombre: string;
  edad: number;
  ciudad: string;
  categoria: string;
  ingreso: number;
  dti: number;
  scoreBuro: number;
  score: number;
  riesgo: string;
  elegible: boolean;
  producto: string | null;
  afinidad: number;
  monto: number;
  modalidad: string;
  // Deuda externa: lo que sustenta una oportunidad de compra de cartera.
  entidadesConDeuda: number;
  saldoDeudaExterna: number;
  alertas: string[];
}

export function filaCompacta({ exogenos: e, recomendacion: r }: PerfilCompleto): FilaCompacta {
  return {
    cedula: e.cedula,
    nombre: e.nombre,
    edad: e.edad,
    ciudad: e.ciudad,
    categoria: e.categoriaAfiliacion,
    ingreso: e.ingresoEstimado,
    dti: Number(r.dti.toFixed(3)),
    scoreBuro: e.scoreBuro,
    score: r.score,
    riesgo: r.nivelRiesgo,
    elegible: r.elegible,
    producto: r.productoRecomendado,
    afinidad: r.productos.find((p) => p.id === r.productoRecomendado)?.afinidad ?? 0,
    monto: r.montoSugerido,
    modalidad: r.modalidad,
    entidadesConDeuda: e.entidadesConDeuda,
    saldoDeudaExterna: e.saldoDeudaExterna,
    alertas: r.alertas,
  };
}

// Procesa un lote y arma el resumen agregado.
export function procesarLote(
  registros: RegistroEntrada[],
  proposito: Proposito = "auto",
  proveedor: ProveedorExogenos = proveedorPorDefecto
): EnrichResponse {
  const results = registros.map((r) => procesarRegistro(r, proposito, proveedor));

  const distribucionProducto: Record<string, number> = {};
  const distribucionCategoria: Record<string, number> = {};
  const distribucionRiesgo: Record<string, number> = {};
  const distribucionModalidad: Record<string, number> = {};
  let elegibles = 0;
  let sumaIngreso = 0;
  let camposDeInsumo = 0;

  for (const r of results) {
    sumaIngreso += r.exogenos.ingresoEstimado;
    if (r.exogenos.camposDeInsumo.length > 0) camposDeInsumo++;
    const cat = r.exogenos.categoriaAfiliacion;
    distribucionCategoria[cat] = (distribucionCategoria[cat] ?? 0) + 1;

    if (r.recomendacion.elegible) {
      elegibles++;
      const prod = r.recomendacion.productoRecomendado
        ? LIMITES_PRODUCTO[r.recomendacion.productoRecomendado].nombre
        : "Sin oferta";
      distribucionProducto[prod] = (distribucionProducto[prod] ?? 0) + 1;
      const riesgo = r.recomendacion.nivelRiesgo;
      distribucionRiesgo[riesgo] = (distribucionRiesgo[riesgo] ?? 0) + 1;
      const mod = r.recomendacion.modalidad;
      distribucionModalidad[mod] = (distribucionModalidad[mod] ?? 0) + 1;
    } else {
      distribucionProducto["No elegible"] = (distribucionProducto["No elegible"] ?? 0) + 1;
    }
  }

  return {
    proveedor: proveedor.id,
    results,
    resumen: {
      total: results.length,
      elegibles,
      noElegibles: results.length - elegibles,
      ingresoPromedio: results.length ? Math.round(sumaIngreso / results.length) : 0,
      camposDeInsumo,
      distribucionProducto,
      distribucionCategoria,
      distribucionRiesgo,
      distribucionModalidad,
    },
  };
}
