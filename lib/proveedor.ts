import { generarExogenos } from "./synthetic";
import type { DatosExogenos, RegistroEntrada } from "./types";

// ---------------------------------------------------------------------------
// COSTURA DE FUENTES DE DATOS EXOGENOS
//
// El motor de decision no sabe de donde salen las variables exogenas: habla
// contra esta interfaz. Hoy la unica implementacion es sintetica; manana un
// conector de buro, un scraper o un servicio interno se enchufan aqui sin
// tocar `decision.ts` ni la UI.
// ---------------------------------------------------------------------------

export interface ProveedorExogenos {
  id: string;
  descripcion: string;
  // Recibe el registro tal como lo subio el usuario y devuelve el perfil
  // enriquecido. Los campos que ya vengan en el registro deben respetarse.
  enriquecer(registro: RegistroEntrada): DatosExogenos;
}

export const proveedorSintetico: ProveedorExogenos = {
  id: "sintetico",
  descripcion:
    "Datos sinteticos deterministas sembrados con la cedula. No consulta fuentes reales.",
  enriquecer: (registro) => generarExogenos(registro.cedula, registro),
};

// Proveedor por defecto del prototipo.
export const proveedorPorDefecto = proveedorSintetico;
