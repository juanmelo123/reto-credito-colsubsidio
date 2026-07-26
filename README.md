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
