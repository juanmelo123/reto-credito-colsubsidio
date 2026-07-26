import { test } from "node:test";
import assert from "node:assert/strict";

import { SMMLV, TOPE_HASTA_1_SMMLV, TOPE_MULTIPLO_SALARIO, LIMITES_PRODUCTO } from "./constants";
import { topePorCapacidad, modalidadDe, evaluar, montoPorCuota } from "./decision";
import { generarExogenos, generarCedulasEjemplo, normalizarCategoria } from "./synthetic";
import { parsearInsumo } from "./insumo";
import { procesarLote } from "./engine";
import { LOTE_DEMO, loteDemoComoCsv } from "./demo";
import type { ProductoId } from "./types";

// ---------------------------------------------------------------------------
// Regla de monto del brief: hasta 1 SMMLV -> $1.500.000; por encima -> 3x salario.
// ---------------------------------------------------------------------------

test("tope: ingreso hasta 1 SMMLV queda en el monto fijo del brief", () => {
  assert.equal(topePorCapacidad(SMMLV), TOPE_HASTA_1_SMMLV);
  assert.equal(topePorCapacidad(900_000), TOPE_HASTA_1_SMMLV);
});

test("tope: por encima de 1 SMMLV son 3 veces el salario", () => {
  assert.equal(topePorCapacidad(10_000_000), 30_000_000);
  assert.equal(topePorCapacidad(SMMLV + 1), (SMMLV + 1) * TOPE_MULTIPLO_SALARIO);
});

test("ningun monto recomendado supera 3x el ingreso (salvo hipotecario y compra de cartera)", () => {
  const cedulas = generarCedulasEjemplo(2000);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  const exentos: ProductoId[] = ["hipotecario", "compra_cartera"];

  for (const { exogenos, recomendacion } of results) {
    if (!recomendacion.elegible || !recomendacion.productoRecomendado) continue;
    if (exentos.includes(recomendacion.productoRecomendado)) continue;
    const tope = topePorCapacidad(exogenos.ingresoEstimado);
    // roundMonto puede subir el valor al redondear; se tolera ese margen.
    assert.ok(
      recomendacion.montoSugerido <= tope * 1.05,
      `${exogenos.cedula}: ${recomendacion.montoSugerido} > tope ${tope} (${recomendacion.productoRecomendado})`
    );
  }
});

test("el monto nunca baja del minimo del producto recomendado", () => {
  const cedulas = generarCedulasEjemplo(500);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  for (const { recomendacion: r } of results) {
    if (!r.elegible || !r.productoRecomendado) continue;
    assert.ok(r.montoSugerido >= LIMITES_PRODUCTO[r.productoRecomendado].min);
  }
});

// ---------------------------------------------------------------------------
// El monto financiable descuenta la tasa: nunca es cuota x plazo.
// ---------------------------------------------------------------------------

test("montoPorCuota descuenta el interes en vez de multiplicar cuota por plazo", () => {
  const cuota = 1_000_000;
  for (const id of Object.keys(LIMITES_PRODUCTO) as ProductoId[]) {
    const { plazoMeses } = LIMITES_PRODUCTO[id];
    const vp = montoPorCuota(cuota, id);
    assert.ok(vp > 0, `${id}: valor presente no positivo`);
    assert.ok(vp < cuota * plazoMeses, `${id}: ${vp} no descuenta la tasa`);
  }
  // A 180 meses el efecto es grande: el simple producto casi triplica el real.
  assert.ok(montoPorCuota(cuota, "hipotecario") < cuota * 180 * 0.5);
  assert.equal(montoPorCuota(0, "cupo_rotativo"), 0);
});

test("la cuota implicita del monto recomendado cabe en la capacidad de pago", () => {
  const cedulas = generarCedulasEjemplo(500);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  for (const { recomendacion: r } of results) {
    if (!r.elegible || !r.productoRecomendado) continue;
    if (r.productoRecomendado === "compra_cartera") continue; // el monto lo fija la deuda comprada
    const maxFinanciable = montoPorCuota(r.capacidadCuota, r.productoRecomendado);
    // 1.05 tolera el redondeo de presentacion del monto.
    assert.ok(
      r.montoSugerido <= Math.max(maxFinanciable, LIMITES_PRODUCTO[r.productoRecomendado].min) * 1.05,
      `${r.productoRecomendado}: ${r.montoSugerido} excede lo financiable con ${r.capacidadCuota}/mes`
    );
  }
});

// ---------------------------------------------------------------------------
// Modalidad (libranza / no libranza / cupo).
// ---------------------------------------------------------------------------

test("modalidad: con pagaduria es libranza, sin pagaduria no libranza, rotativos son cupo", () => {
  assert.equal(modalidadDe("libre_inversion", "Indefinido"), "Libranza");
  assert.equal(modalidadDe("libre_inversion", "Pensionado"), "Libranza");
  assert.equal(modalidadDe("libre_inversion", "Independiente"), "No libranza");
  assert.equal(modalidadDe("libre_inversion", "Prestacion de servicios"), "No libranza");
  assert.equal(modalidadDe("cupo_rotativo", "Indefinido"), "Cupo");
  assert.equal(modalidadDe("rotativo_seguros_impuestos", "Independiente"), "Cupo");
});

// ---------------------------------------------------------------------------
// Cobertura del portafolio: los 8 productos deben poder ganar en modo auto.
// ---------------------------------------------------------------------------

test("modo auto alcanza todo el portafolio en un lote de 2.000", () => {
  const cedulas = generarCedulasEjemplo(2000);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  const ganadores = new Set(
    results.map((r) => r.recomendacion.productoRecomendado).filter(Boolean)
  );
  const faltantes = (Object.keys(LIMITES_PRODUCTO) as ProductoId[]).filter(
    (id) => !ganadores.has(id)
  );
  assert.deepEqual(faltantes, [], `productos que nunca ganan en auto: ${faltantes.join(", ")}`);
});

// ---------------------------------------------------------------------------
// Afinidad por criterios ponderados.
// ---------------------------------------------------------------------------

test("se evaluan los 8 productos incluso cuando el perfil no es elegible", () => {
  const base = generarExogenos("1024587963");
  const noElegible = evaluar({ ...base, moraDias: 90, cedulaValida: true });
  assert.equal(noElegible.elegible, false);
  assert.equal(noElegible.productos.length, 8);
  assert.deepEqual(
    noElegible.productos.map((p) => p.id).sort(),
    (Object.keys(LIMITES_PRODUCTO) as ProductoId[]).sort()
  );
});

test("un perfil no elegible no muestra ningun producto como disponible", () => {
  const cedulas = generarCedulasEjemplo(500);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  const noElegibles = results.filter((r) => !r.recomendacion.elegible);
  assert.ok(noElegibles.length > 0, "el lote de prueba deberia traer no elegibles");

  for (const { exogenos: e, recomendacion: r } of noElegibles) {
    // Decir "no elegible" arriba y ofrecer un producto al 92% abajo es la
    // contradiccion que un analista no puede defender frente al afiliado.
    const disponibles = r.productos.filter((p) => p.aplica);
    assert.deepEqual(
      disponibles.map((p) => p.id),
      [],
      `${e.cedula}: no elegible pero ofrece ${disponibles.map((p) => p.id).join(", ")}`
    );
    assert.equal(
      r.productos.every((p) => p.montoSugerido === 0),
      true,
      `${e.cedula}: no elegible con monto sugerido distinto de cero`
    );
  }
});

test("la afinidad es exactamente los puntos cumplidos sobre los posibles", () => {
  const cedulas = generarCedulasEjemplo(300);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  for (const { recomendacion } of results) {
    for (const p of recomendacion.productos) {
      const posibles = p.criterios.reduce((a, c) => a + c.peso, 0);
      const cumplidos = p.criterios.reduce((a, c) => a + (c.cumple ? c.peso : 0), 0);
      assert.equal(
        p.afinidad,
        Math.round((cumplidos / posibles) * 100),
        `${p.id}: afinidad ${p.afinidad}% no cuadra con ${cumplidos}/${posibles}`
      );
    }
  }
});

test("un bloqueante incumplido deja el producto en 'no aplica' y fuera de la recomendacion", () => {
  const cedulas = generarCedulasEjemplo(300);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  for (const { recomendacion: r } of results) {
    for (const p of r.productos) {
      const bloqueado = p.criterios.some((c) => c.bloqueante && !c.cumple);
      assert.equal(p.aplica, !bloqueado, `${p.id}: aplica=${p.aplica} con bloqueado=${bloqueado}`);
      // Un producto que no aplica nunca puede llevar monto ni ser el recomendado.
      if (!p.aplica) {
        assert.equal(p.montoSugerido, 0, `${p.id}: monto en producto que no aplica`);
        assert.notEqual(r.productoRecomendado, p.id, `${p.id}: recomendado pese a no aplicar`);
      }
    }
  }
});

test("el producto recomendado es el de mayor afinidad entre los que aplican", () => {
  const cedulas = generarCedulasEjemplo(300);
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  for (const { recomendacion: r } of results) {
    if (!r.elegible || !r.productoRecomendado) continue;
    const mejor = r.productos.filter((p) => p.aplica)[0];
    assert.equal(r.productoRecomendado, mejor.id);
    assert.equal(r.montoSugerido, mejor.montoSugerido);
  }
});

test("todo criterio trae la regla y el valor real del perfil que la sustenta", () => {
  const r = evaluar(generarExogenos("1022383083"));
  for (const p of r.productos) {
    assert.ok(p.criterios.length > 0, `${p.id}: sin criterios`);
    for (const c of p.criterios) {
      assert.ok(c.etiqueta.length > 0 && c.detalle.length > 0, `${p.id}: criterio sin texto`);
      assert.ok(c.peso > 0, `${p.id}: criterio con peso ${c.peso}`);
    }
  }
});

test("el proposito declarado solo alcanza productos que aplican", () => {
  const cedulas = generarCedulasEjemplo(200);
  // Vivienda es el propósito mas exigente: casi nadie califica.
  const { results } = procesarLote(cedulas.map((cedula) => ({ cedula })), "vivienda");
  for (const { recomendacion: r } of results) {
    if (r.productoRecomendado !== "hipotecario") continue;
    const hip = r.productos.find((p) => p.id === "hipotecario")!;
    assert.equal(hip.aplica, true, "se recomendo hipotecario sin cumplir sus bloqueantes");
  }
});

// ---------------------------------------------------------------------------
// Filtros duros de elegibilidad.
// ---------------------------------------------------------------------------

test("mora de 60 dias o mas deja el perfil no elegible", () => {
  const base = generarExogenos("1024587963");
  const conMora = { ...base, moraDias: 60, antiguedadMeses: 48, cedulaValida: true };
  assert.equal(evaluar(conMora).elegible, false);
});

test("antiguedad por debajo del minimo del vinculo deja no elegible", () => {
  const base = generarExogenos("1024587963");
  // Indefinido exige 2 meses; termino fijo exige 6.
  assert.equal(
    evaluar({ ...base, tipoContrato: "Termino fijo", antiguedadMeses: 3, moraDias: 0 }).elegible,
    false
  );
  assert.equal(
    evaluar({ ...base, tipoContrato: "Indefinido", antiguedadMeses: 3, moraDias: 0 }).elegible,
    true
  );
});

test("DTI y capacidad de cuota salen de la cuota de deudas contra el ingreso", () => {
  const base = generarExogenos("1024587963");
  const e = {
    ...base,
    ingresoEstimado: 4_000_000,
    cuotaMensualDeudas: 800_000,
    moraDias: 0,
    tipoContrato: "Indefinido" as const,
    antiguedadMeses: 24,
  };
  const r = evaluar(e);
  assert.equal(r.dti, 0.2);
  // MAX_DTI 40% de 4M = 1.6M, menos 800k ya comprometidos.
  assert.equal(r.capacidadCuota, 800_000);
});

// ---------------------------------------------------------------------------
// Determinismo: la misma cedula siempre devuelve el mismo perfil.
// ---------------------------------------------------------------------------

test("la misma cedula produce identico perfil en dos corridas", () => {
  assert.deepEqual(generarExogenos("52830147"), generarExogenos("52830147"));
});

test("pasar campos de insumo no altera las variables exogenas del perfil", () => {
  const sin = generarExogenos("52830147");
  const con = generarExogenos("52830147", {
    cedula: "52830147",
    nombre: "Ana Maria Bermudez",
    correo: "ana@correo.com",
    direccion: "Calle 1 # 2 - 3",
  });
  assert.equal(con.nombre, "Ana Maria Bermudez");
  assert.equal(con.correo, "ana@correo.com");
  assert.equal(con.direccion, "Calle 1 # 2 - 3");
  assert.deepEqual(con.camposDeInsumo.sort(), ["correo", "direccion", "nombre"]);
  // Lo que no vino en el insumo debe quedar exactamente igual.
  assert.equal(con.scoreBuro, sin.scoreBuro);
  assert.equal(con.ingresoEstimado, sin.ingresoEstimado);
  assert.equal(con.entidadesConDeuda, sin.entidadesConDeuda);
  assert.equal(con.tipoContrato, sin.tipoContrato);
});

test("la categoria del insumo manda y arrastra el ingreso a su banda", () => {
  const e = generarExogenos("1024587963", { cedula: "1024587963", categoriaAfiliacion: "A" });
  assert.equal(e.categoriaAfiliacion, "A");
  assert.ok(e.ingresoEstimado <= SMMLV * 2, `ingreso ${e.ingresoEstimado} fuera de la banda A`);

  const c = generarExogenos("1024587963", { cedula: "1024587963", categoriaAfiliacion: "C" });
  assert.equal(c.categoriaAfiliacion, "C");
  assert.ok(c.ingresoEstimado > SMMLV * 4, `ingreso ${c.ingresoEstimado} fuera de la banda C`);
});

test("la ciudad se toma de la direccion del insumo cuando la nombra", () => {
  const e = generarExogenos("52830147", {
    cedula: "52830147",
    direccion: "Calle 93 # 15 - 20, Bogota",
  });
  assert.equal(e.ciudad, "Bogota");
  // Una direccion sin ciudad reconocible deja la ciudad enriquecida.
  const sinCiudad = generarExogenos("52830147", { cedula: "52830147", direccion: "Calle 93 # 15" });
  assert.equal(sinCiudad.ciudad, generarExogenos("52830147").ciudad);
});

test("categoria D marca el perfil como no afiliado", () => {
  const e = generarExogenos("1024587963", { cedula: "1024587963", categoriaAfiliacion: "D" });
  assert.equal(e.afiliado, false);
});

// ---------------------------------------------------------------------------
// Lectura del insumo del usuario.
// ---------------------------------------------------------------------------

test("parsea CSV con encabezado y respeta las columnas del brief", () => {
  const csv = [
    "cedula,nombre,correo,direccion,categoria",
    '1024587963,"Restrepo Ochoa, Laura",laura@x.com,Calle 93 # 15-20,B',
    "52830147,Ana Bermudez,ana@x.com,Carrera 7 # 116-40,C",
  ].join("\n");
  const { registros, columnasDetectadas } = parsearInsumo(csv);

  assert.equal(registros.length, 2);
  assert.equal(registros[0].nombre, "Restrepo Ochoa, Laura"); // la coma entre comillas no parte la celda
  assert.equal(registros[0].categoriaAfiliacion, "B");
  assert.equal(registros[1].correo, "ana@x.com");
  assert.deepEqual(columnasDetectadas.sort(), [
    "categoriaAfiliacion",
    "cedula",
    "correo",
    "direccion",
    "nombre",
  ]);
});

test("acepta separador punto y coma y alias de encabezado", () => {
  const csv = ["Documento;Nombre completo;Email", "1024587963;Laura R;laura@x.com"].join("\n");
  const { registros } = parsearInsumo(csv);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].cedula, "1024587963");
  assert.equal(registros[0].nombre, "Laura R");
  assert.equal(registros[0].correo, "laura@x.com");
});

test("una lista pelada de cedulas sigue funcionando y deduplica", () => {
  const { registros } = parsearInsumo("1024587963\n52830147\n1024587963\n");
  assert.deepEqual(registros.map((r) => r.cedula), ["1024587963", "52830147"]);
});

test("normalizarCategoria acepta variantes y descarta basura", () => {
  assert.equal(normalizarCategoria("b"), "B");
  assert.equal(normalizarCategoria("Categoria C"), "C");
  assert.equal(normalizarCategoria("Z"), null);
  assert.equal(normalizarCategoria(undefined), null);
});

// ---------------------------------------------------------------------------
// Lote.
// ---------------------------------------------------------------------------

test("el resumen del lote cuadra con los resultados", () => {
  const cedulas = generarCedulasEjemplo(200);
  const { resumen, results } = procesarLote(cedulas.map((cedula) => ({ cedula })));
  assert.equal(resumen.total, 200);
  assert.equal(results.length, 200);
  assert.equal(resumen.elegibles + resumen.noElegibles, 200);
  const sumaProducto = Object.values(resumen.distribucionProducto).reduce((a, b) => a + b, 0);
  assert.equal(sumaProducto, 200);
  const sumaModalidad = Object.values(resumen.distribucionModalidad).reduce((a, b) => a + b, 0);
  assert.equal(sumaModalidad, resumen.elegibles);
});

// ---------------------------------------------------------------------------
// Lote de demostracion: existe para contar una historia completa. Si calibrar
// los pesos lo deja cojo, este test avisa antes de la demo, no durante.
// ---------------------------------------------------------------------------

test("el lote demo cubre todo el portafolio, los dos topes y los rechazos", () => {
  const { results, resumen } = procesarLote(LOTE_DEMO);

  const ganadores = new Set(results.map((r) => r.recomendacion.productoRecomendado).filter(Boolean));
  const faltantes = (Object.keys(LIMITES_PRODUCTO) as ProductoId[]).filter((id) => !ganadores.has(id));
  assert.deepEqual(faltantes, [], `el lote demo no muestra: ${faltantes.join(", ")}`);

  // Los dos topes de monto del brief.
  assert.ok(
    results.some((r) => r.exogenos.ingresoEstimado <= SMMLV && r.recomendacion.montoSugerido === TOPE_HASTA_1_SMMLV),
    "falta un caso que aterrice en el tope de $1.500.000"
  );
  assert.ok(
    results.some((r) => r.recomendacion.productos.some((p) => p.aplica && p.topeAplicado)),
    "falta un caso donde el tope por capacidad recorte el monto"
  );

  // Los tres motivos de rechazo y el prospecto no afiliado.
  assert.ok(resumen.noElegibles >= 3, "el lote demo deberia traer varios no elegibles");
  assert.ok(results.some((r) => r.exogenos.moraDias >= 60), "falta un rechazo por mora");
  assert.ok(results.some((r) => r.exogenos.embargos), "falta un caso con embargos");
  assert.ok(results.some((r) => r.exogenos.categoriaAfiliacion === "D"), "falta un no afiliado");

  // Y registros que llegan con datos propios del usuario.
  assert.ok(resumen.camposDeInsumo >= 8, `solo ${resumen.camposDeInsumo} registros traen insumo`);
});

test("el CSV del lote demo se vuelve a leer sin perder los campos del insumo", () => {
  const { registros } = parsearInsumo(loteDemoComoCsv());
  assert.equal(registros.length, LOTE_DEMO.length);
  assert.deepEqual(registros.map((r) => r.cedula), LOTE_DEMO.map((r) => r.cedula));
  const conNombre = LOTE_DEMO.filter((r) => r.nombre).length;
  assert.equal(registros.filter((r) => r.nombre).length, conNombre);
});

test("el resumen cuenta los registros que traian datos del usuario", () => {
  const { resumen } = procesarLote([
    { cedula: "1024587963", nombre: "Laura R" },
    { cedula: "52830147" },
  ]);
  assert.equal(resumen.camposDeInsumo, 1);
});
