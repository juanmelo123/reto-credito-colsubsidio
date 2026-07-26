import type { RegistroEntrada } from "./types";

// ---------------------------------------------------------------------------
// LOTE DE DEMOSTRACION
//
// 54 cedulas fijas, elegidas corriendo el motor sobre un universo sintetico y
// filtrando por el caso que producen. No son aleatorias: cubren a proposito
// todo el portafolio, los dos topes del brief y los tres motivos de rechazo,
// para que la demo muestre siempre la misma historia completa.
//
// Como el proveedor sintetico es determinista, estas cedulas devuelven siempre
// el mismo perfil. Si se cambian los pesos en `criterios.ts` o los umbrales en
// `constants.ts`, los productos que ganan pueden moverse: es la gracia del
// modelo, pero conviene revisar este lote despues de calibrar.
//
// Algunos registros traen nombre/correo/direccion/categoria para demostrar que
// el insumo del usuario se respeta y NO se sobrescribe con datos enriquecidos.
// ---------------------------------------------------------------------------

export const LOTE_DEMO: RegistroEntrada[] = [
  // Sobreendeudamiento -> compra de cartera. El caso que solo existe gracias a
  // un dato exogeno: deuda repartida en varias entidades.
  { cedula: "7974362414", nombre: "Andres Munoz Gutierrez", categoriaAfiliacion: "A" },
  { cedula: "2093713454" },
  { cedula: "1514781989" },
  { cedula: "4565792656", correo: "claudia.jimenez@empresa.com.co" },
  { cedula: "2980190529" },

  // Credito Mujer: edad, ingreso, afiliacion vigente y sin embargos.
  { cedula: "4587361827", nombre: "Valentina Herrera Herrera", categoriaAfiliacion: "C" },
  { cedula: "1110305764" },
  { cedula: "4237493136", direccion: "Carrera 43A # 7-50, Medellin" },
  { cedula: "1086230783" },
  { cedula: "7438617296" },
  { cedula: "28044732", nombre: "Claudia Gloria Herrera Suarez", correo: "cherrera52@gmail.com" },

  // Hipotecario: ticket alto, 180 meses, respaldo y horizonte laboral.
  { cedula: "15148524", nombre: "Angela Adriana Rojas Suarez", categoriaAfiliacion: "B" },
  { cedula: "6694033367" },
  { cedula: "2759845556" },
  { cedula: "1012628603", direccion: "Calle 93 # 15-20, Bogota" },

  // Educativo: la senal es la etapa formativa.
  { cedula: "51163069" },
  { cedula: "8990664204" },
  { cedula: "16995740" },
  { cedula: "2502800909", nombre: "Sergio Castaneda Vargas" },
  { cedula: "5783764830" },
  { cedula: "96698784" },

  // Complementario: afiliado al dia con 1-2 obligaciones sanas.
  { cedula: "7787968880" },
  { cedula: "5658483025" },
  { cedula: "5649320109", categoriaAfiliacion: "B" },
  { cedula: "3795920880" },
  { cedula: "7961706079" },

  // Rotativo seguros e impuestos: patrimonio con predial / vehiculo / polizas.
  { cedula: "15513482" },
  { cedula: "3235666525", nombre: "Andres Rodriguez Cortes", categoriaAfiliacion: "C" },
  { cedula: "3106003838" },

  // Libre inversion: ticket medio-alto, incluso sin vida crediticia.
  { cedula: "1211094264" },
  { cedula: "3088435964" },
  { cedula: "8008248026", correo: "andrea.rodriguez@correo.com" },
  { cedula: "5343312621" },

  // Ingreso hasta 1 SMMLV -> tope de $1.500.000 por libranza (regla del brief).
  { cedula: "5869791535" },
  { cedula: "2082640782" },
  { cedula: "1770994988" },
  { cedula: "8139539938", nombre: "Maria Jimenez Medina" },
  { cedula: "8118886664" },

  // Cupo rotativo: el perfil sano tipico, consumo recurrente de ticket chico.
  { cedula: "5787410235" },
  { cedula: "6661550938" },
  { cedula: "6839771359" },
  { cedula: "65018623" },

  // No elegible por mora igual o mayor a 60 dias.
  { cedula: "4988327556" },
  { cedula: "11601047" },
  { cedula: "5243793366" },
  { cedula: "7537381753", nombre: "Natalia Paula Suarez Suarez" },

  // No elegible por antiguedad bajo el minimo de su vinculo laboral.
  { cedula: "9232953935" },
  { cedula: "4828062968" },
  { cedula: "9636293997" },

  // Embargos vigentes: bloquean Credito Mujer e hipotecario, no todo el portafolio.
  { cedula: "74336465" },
  { cedula: "4926558853" },

  // Categoria D: prospecto no afiliado. Recibe oferta, pero pierde los productos
  // que exigen afiliacion vigente.
  { cedula: "9566625959" },
  { cedula: "64227574" },
  { cedula: "62207269" },
];

// Casos sueltos para el panel individual: uno por historia, en el orden en que
// conviene contarlos en una demo.
export const CASOS_INDIVIDUALES: Array<{ cedula: string; titulo: string }> = [
  { cedula: "15148524", titulo: "Hipotecario: afinidad 100%" },
  { cedula: "7974362414", titulo: "Sobreendeudada: compra de cartera" },
  { cedula: "4587361827", titulo: "Credito Mujer: cumple los 7 criterios" },
  { cedula: "8118886664", titulo: "Ingreso de 1 SMMLV: tope de $1.500.000" },
  { cedula: "51163069", titulo: "19 anos: credito educativo" },
  { cedula: "4988327556", titulo: "No elegible: mora vigente" },
  { cedula: "62207269", titulo: "No afiliado (categoria D): oferta limitada" },
];

// El lote demo en el mismo formato CSV que aceptaria un archivo del usuario.
export function loteDemoComoCsv(): string {
  const filas = LOTE_DEMO.map((r) =>
    [r.cedula, r.nombre ?? "", r.correo ?? "", r.direccion ?? "", r.categoriaAfiliacion ?? ""]
      .map((v) => (v.includes(",") ? `"${v}"` : v))
      .join(",")
  );
  return ["cedula,nombre,correo,direccion,categoria", ...filas].join("\n");
}
