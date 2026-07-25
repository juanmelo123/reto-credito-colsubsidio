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
