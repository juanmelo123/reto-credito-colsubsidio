import { generarExogenos } from "./synthetic";
import { evaluar } from "./decision";
import { LIMITES_PRODUCTO } from "./constants";
import type { PerfilCompleto, Proposito, EnrichResponse } from "./types";

// Enriquece + perfila una sola cedula.
export function procesarCedula(cedula: string, proposito: Proposito = "auto"): PerfilCompleto {
  const exogenos = generarExogenos(cedula);
  const recomendacion = evaluar(exogenos, proposito);
  return { exogenos, recomendacion };
}

// Procesa un lote y arma el resumen agregado.
export function procesarLote(cedulas: string[], proposito: Proposito = "auto"): EnrichResponse {
  const results = cedulas.map((c) => procesarCedula(c, proposito));

  const distribucionProducto: Record<string, number> = {};
  const distribucionCategoria: Record<string, number> = {};
  const distribucionRiesgo: Record<string, number> = {};
  let elegibles = 0;
  let sumaIngreso = 0;

  for (const r of results) {
    sumaIngreso += r.exogenos.ingresoEstimado;
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
    } else {
      distribucionProducto["No elegible"] = (distribucionProducto["No elegible"] ?? 0) + 1;
    }
  }

  return {
    results,
    resumen: {
      total: results.length,
      elegibles,
      noElegibles: results.length - elegibles,
      ingresoPromedio: results.length ? Math.round(sumaIngreso / results.length) : 0,
      distribucionProducto,
      distribucionCategoria,
      distribucionRiesgo,
    },
  };
}
