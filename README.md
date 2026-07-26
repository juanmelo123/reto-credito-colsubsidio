# Motor de Enriquecimiento Crediticio

**Reto Crédito — Hackathon Colsubsidio x 30X**

Prototipo (Next.js + TypeScript) que parte del **insumo que sube el usuario** (una cédula o un
lote de hasta 2.000+), lo enriquece con **variables exógenas** y recomienda un **producto de
crédito** del portafolio Colsubsidio con **monto, modalidad y score explicable**.

> ⚠️ **Datos 100 % sintéticos y deterministas.** No se consulta ni almacena información real de
> ninguna persona. Cada cédula genera —de forma reproducible— un perfil simulado que *emula* lo
> que devolvería un buró o una fuente externa. Esto respeta el Habeas Data (Ley 1581) y hace la
> demo controlable. El brief del reto habilita explícitamente el uso de data sintética.

---

## Features

| | |
| --- | --- |
| **Enriquecimiento exógeno** | De una cédula sale un perfil completo: contacto y redes, vínculo laboral, antigüedad, ingreso estimado, categoría A–D, score de buró, entidades con deuda, saldo, cuota, mora, embargos y actividad económica. |
| **Respeto del insumo** | Los 5 campos del brief que el usuario suba **no se sintetizan**. Cada dato se marca en la UI como `insumo` o `enriquecido`, y el CSV exportado lleva la trazabilidad. |
| **Afinidad explicable por producto** | Los 8 productos del portafolio, siempre, con su % de afinidad y el desglose criterio por criterio: qué cumple, qué no, y cuánto pesa cada uno. |
| **Bloqueos con motivo** | Un producto que no se puede otorgar dice por qué (*"Crédito Mujer: bloqueado por afiliación vigente"*), en vez de desaparecer de la lista. |
| **Reglas del brief** | Tope de $1.500.000 hasta 1 SMMLV y 3× el salario por encima; DTI máximo 40 %; antigüedad mínima por tipo de vínculo; modalidad libranza / no libranza / cupo. |
| **Lote de 2.000+** | Tabla ordenable, distribuciones agregadas, export CSV enriquecido y detalle de afinidad por afiliado sin salir de la tabla. |
| **Lote de demostración** | 54 casos curados que cubren los 8 productos, los dos topes y los tres motivos de rechazo. Un clic. |
| **Tres superficies** | UI, `POST /api/enrich`, CLI (`pnpm --silent reto`) y servidor MCP. Todas llaman a la misma función. |
| **Skill para agentes** | Un agente opera el motor y analiza cartera: a quién priorizar, oportunidad de compra de cartera en COP, concentración de riesgo. |
| **31 tests** | Sin framework (`node:test`). Cubren las reglas de monto, la coherencia de la afinidad y que la demo no quede coja al calibrar. |

## Por qué esta solución

**El número y su explicación son el mismo cálculo.** Es la decisión de diseño que sostiene todo
lo demás. Un motor que devuelve "afinidad 88%" y aparte un párrafo escrito a mano *va a mentir*
apenas alguien toque una regla. Acá cada producto declara su cliente objetivo como criterios con
peso y `afinidad = puntos cumplidos / puntos posibles`: el %, el orden del portafolio y el texto
que lee el analista salen de la misma estructura y no se pueden desincronizar. Cambiar un peso
mueve las tres cosas a la vez.

**Muestra lo que descartó, no solo lo que eligió.** Cualquier motor puede decir "ofrecele un cupo
rotativo". Este dice además que el hipotecario daba 78% y se cayó por antigüedad, y que el Crédito
Mujer daría 88% pero está bloqueado por afiliación. Eso convierte una recomendación en una
**conversación accionable**: el asesor sabe qué gestionar para abrir el siguiente producto.

**Las reglas de crédito viven en un solo lugar.** `constants.ts` y `criterios.ts` concentran toda
la política; la UI, el CLI, la API y el MCP son envoltorios sobre `procesarLote`. No hay una regla
en el frontend que contradiga al backend, y calibrar la política es editar una tabla, no cazar
condicionales por el código.

**Es defendible frente a un jurado de riesgo.** El monto descuenta la tasa (valor presente de la
anualidad, no `cuota × plazo`, que a 180 meses sobreestima casi al triple). El sobreendeudamiento
se mide por DTI y no por conteo de entidades. Un perfil rechazado no puede mostrar productos
disponibles. Cada una de esas tres es un error que el motor cometía antes y que hoy tiene un test
que lo impide.

**Es defendible frente a legal.** Datos 100 % sintéticos y deterministas: cero PII real, cero
scraping de personas identificadas, Habeas Data intacto. Y como la fuente vive detrás de la
interfaz `ProveedorExogenos`, enchufar un buró real es implementar una interfaz —no reescribir el
motor.

**Sirve a un agente, no solo a una pantalla.** El CLI y el MCP exponen el mismo motor con salida
estructurada, y los lotes devuelven filas compactas a propósito: 2.000 registros con los criterios
de los 8 productos cada uno no caben útiles en el contexto de un modelo. La skill documenta cómo
leerlos y trae las recetas de análisis ya escritas.

---

## Qué hace

1. **Lee el insumo del usuario.** Los cinco campos del brief —cédula, nombre, correo, dirección
   y categoría de afiliación— se respetan tal como vienen; solo se enriquece lo que falte. La
   UI marca cada dato como `insumo` o `enriquecido`. Acepta CSV con encabezado (`,` `;` tab `|`),
   alias de columna (`documento`, `email`, `nombre completo`…) o una lista pelada de cédulas.
2. **Enriquece** con variables exógenas simuladas:
   - Contacto y redes: correo, Instagram, LinkedIn, dirección.
   - Laboral/ingreso: vínculo, antigüedad, ingreso estimado, categoría de afiliación (A–D).
   - Señales de mercado: score de buró, entidades con deuda, saldo y cuota de deuda externa,
     mora, embargos, actividad económica del independiente.
3. **Puntúa la afinidad de los 8 productos.** Cada producto declara su cliente objetivo como
   criterios con peso, y `afinidad = puntos cumplidos / puntos posibles`. Se evalúan **siempre
   los 8**, incluso para un perfil no elegible: el que incumple un criterio **bloqueante** sale
   marcado como no disponible con el motivo a la vista, en vez de desaparecer de la lista.
4. **Decide** con un árbol de negocio:
   - **Filtros duros**: cédula, antigüedad mínima por tipo de vínculo, mora, embargos.
   - **Capacidad de pago**: DTI actual y cuota adicional disponible (`MAX_DTI = 40 %`).
   - **Tope de monto del brief**: hasta 1 SMMLV → $1.500.000 por libranza; por encima →
     **3× el salario**. Se exceptúan hipotecario (garantía real) y compra de cartera (el monto
     lo fija la deuda que se compra).
   - **Modalidad**: libranza (con pagaduría), no libranza o cupo (rotativos).
   - **Score de aprobación** 0–100 y nivel de riesgo (Bajo/Medio/Alto).
   - **Asignación de producto**: gana la mayor afinidad entre los que aplican; a igual afinidad,
     el producto más específico le gana al genérico.
5. **Explica**: cada recomendación trae las razones y alertas que la sustentan, incluido cuándo
   el monto se recortó por el tope de capacidad.

## Decisiones de modelo que vale la pena mirar

- **La afinidad y su explicación son el mismo cálculo.** No hay una narrativa escrita aparte que
  pueda contradecir al número: si dice 88%, los criterios dicen exactamente cuáles 12 puntos
  faltaron. Cambiar un peso mueve el %, el orden del portafolio y el texto a la vez.
- **`aplica: false` no es baja afinidad.** Un producto bloqueado puede tener afinidad más alta
  que uno disponible, y eso es información útil: *"Crédito Mujer daría 88%, pero está bloqueado
  por afiliación vigente"* es lo que le dice al asesor qué gestionar.
- **El monto descuenta la tasa.** `montoPorCuota()` calcula el valor presente de la anualidad
  (`VP = cuota × (1 − (1+i)^−n) / i`) en vez de multiplicar cuota × plazo, que a 180 meses
  sobreestima el monto casi al triple.
- **La categoría del insumo manda sobre el ingreso.** Como la reporta el empleador, si el
  archivo dice "A" el ingreso estimado se ajusta a la banda de A: no se producen perfiles
  categoría A con ingreso de 8 SMMLV.
- **Sobreendeudamiento → compra de cartera.** En vez de ofrecer deuda nueva, el motor propone
  unificar. Es el producto cuya razón de ser es un dato exógeno puro: deudas con otras entidades.
- **Determinismo.** La misma cédula devuelve siempre el mismo perfil, y traer campos del insumo
  no altera las variables exógenas del resto del perfil.

## Cómo correrlo

Este repo usa **pnpm**. No mezclar con npm: rompe el lockfile.

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # 31 tests del motor (node:test, sin framework)
```

- **Consulta individual**: escribe una cédula y, opcionalmente, los datos que ya tengas. El botón
  **"Usar datos de demostración"** rota entre los casos interesantes: `15148524` (hipotecario,
  afinidad 100%), `7974362414` (sobreendeudado → compra de cartera), `4587361827` (Crédito Mujer,
  cumple los 7 criterios), `8118886664` (ingreso de 1 SMMLV → tope de $1.500.000) y `4988327556`
  (no elegible por mora).
- **Consulta por lote**: **"Cargar lote de demostración"** trae 54 casos curados que cubren los 8
  productos, los dos topes del brief y los tres motivos de rechazo. También acepta pegar cédulas o
  subir tu CSV. Devuelve tabla ordenable, distribuciones agregadas y **exporta un CSV enriquecido**
  con trazabilidad de qué campos vinieron del insumo. Clic en una fila para ver la afinidad de ese
  afiliado con los 8 productos.

## Para agentes: CLI, MCP y skill

Los tres caminos llaman a la misma `procesarLote`, así que la UI y un agente no pueden dar
respuestas distintas.

```bash
# CLI (JSON a stdout). --silent no es opcional: sin el, pnpm ensucia el pipe con su banner.
pnpm --silent reto perfil 15148524
pnpm --silent reto lote afiliados.csv --proposito unificar
pnpm --silent reto demo --resumen | jq '.distribucionProducto'

# Servidor MCP sobre stdio (ya declarado en .mcp.json)
pnpm mcp
```

El MCP expone `perfilar_cedula`, `procesar_lote`, `lote_demo` y `politica_credito`. Los lotes
devuelven filas compactas por defecto: 2.000 registros con los criterios de los 8 productos cada
uno no caben útil en el contexto de un agente.

`.claude/skills/reto-credito/SKILL.md` documenta cómo leer la afinidad y trae recetas de análisis
de cartera (a quién priorizar, oportunidad de compra de cartera en COP, concentración de riesgo).

## API

`POST /api/enrich`

```json
{
  "registros": [
    { "cedula": "1028404676", "nombre": "Luz Garcia", "correo": "luz@x.com",
      "direccion": "Calle 93 # 15-20 Bogota", "categoriaAfiliacion": "B" }
  ],
  "proposito": "auto"
}
```

También acepta la forma corta `{ "cedulas": ["1028404676"] }`. Propósitos válidos:
`auto | consumo | libre | vivienda | educacion | unificar | complementario | seguros_impuestos`.
Devuelve `results[]` (perfil + recomendación) y un `resumen` agregado.

## Dónde ajustar la lógica

| Archivo          | Responsabilidad                                                          |
| ---------------- | ------------------------------------------------------------------------ |
| `constants.ts`   | SMMLV, umbrales A–D, `MAX_DTI`, tope del brief, antigüedad, límites y tasa por producto |
| `criterios.ts`   | **El cliente objetivo de cada producto**: criterios, pesos y cuáles bloquean |
| `insumo.ts`      | Lectura del CSV del usuario (delimitadores, alias de columna)             |
| `proveedor.ts`   | **Costura de fuentes**: interfaz `ProveedorExogenos` que hoy resuelve sintético |
| `synthetic.ts`   | Proveedor sintético determinista por cédula                               |
| `demo.ts`        | Lote curado de 54 casos y cédulas de ejemplo del panel individual          |
| `decision.ts`    | Motor de decisión: filtros, DTI, tope, modalidad, score, producto         |
| `engine.ts`      | Orquesta enriquecimiento + decisión y arma el resumen del lote            |
| `motor.test.ts`  | Tests del motor                                                          |

Al calibrar pesos o umbrales, `pnpm test` avisa si los 8 productos dejan de poder ganar o si el
lote demo queda cojo: mejor enterarse antes de la demo que durante.

> `SMMLV = $1.750.905` (Decreto 1469 del 29-dic-2025). Es el parámetro que arrastra las
> categorías A–D y todos los montos: revísalo cada año en `constants.ts`.

## Enchufar una fuente real

`engine.ts` no importa `synthetic.ts`: habla contra `ProveedorExogenos`. Un conector de buró se
enchufa implementando esa interfaz, sin tocar el motor de decisión ni la UI:

```ts
export const proveedorBuro: ProveedorExogenos = {
  id: "buro",
  descripcion: "Consulta a central de riesgo",
  enriquecer: (registro) => { /* ... */ },
};
```

## Notas para producción (fuera del alcance del MVP)

- Conectores reales **con base legal y consentimiento**; nunca scrapear PII de personas
  identificadas por cédula.
- Persistencia, autenticación, trazabilidad de decisiones y validación estadística del score.
- Las tasas por producto en `constants.ts` son órdenes de magnitud de mercado, no la política
  comercial vigente.
