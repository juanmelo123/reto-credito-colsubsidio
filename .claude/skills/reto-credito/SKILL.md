---
name: reto-credito
description: Opera y analiza el motor de enriquecimiento crediticio de Colsubsidio. Usala cuando haya que perfilar una cedula, procesar un lote de afiliados, explicar por que el motor recomendo (o descarto) un producto, analizar una cartera para priorizar gestion comercial o medir riesgo, o calibrar los parametros de politica de credito. Trigger: "perfilar", "cedula", "afiliado", "lote", "cartera", "afinidad", "compra de cartera", "DTI", "capacidad de pago", "que producto le ofrezco", "motor de credito".
---

# Motor de enriquecimiento crediticio — Colsubsidio x 30X

Parte de una cedula (o un lote), la enriquece con variables exogenas y recomienda un producto
de credito del portafolio con monto, modalidad y **afinidad explicable**.

> **Todos los datos son sinteticos y deterministas.** No se consulta ni almacena informacion real
> de ninguna persona: cada cedula genera un perfil simulado reproducible. Decilo cuando presentes
> resultados — no dejes que nadie lea estas salidas como datos de una persona real.

## Como consultarlo

Tres caminos a las **mismas funciones**. Elegi por contexto, no por preferencia:

| Camino | Cuando | Como |
| --- | --- | --- |
| **MCP** | Por defecto, si las herramientas `perfilar_cedula` / `procesar_lote` / `lote_demo` / `politica_credito` estan disponibles | Llamalas directamente |
| **CLI** | Sin MCP, o dentro de un script/pipe | `pnpm --silent reto <cmd>` |
| **HTTP** | Si ya hay un `pnpm dev` corriendo, o el motor esta en otra maquina | `POST /api/enrich` |

### CLI

`--silent` no es opcional: sin el, pnpm escribe su banner en stdout y la salida deja de ser JSON.

```bash
pnpm --silent reto perfil 15148524                     # una cedula
pnpm --silent reto lote afiliados.csv                  # un CSV
pnpm --silent reto lote - < datos.csv                  # desde stdin
pnpm --silent reto demo --resumen                      # 54 casos curados, solo agregados
pnpm --silent reto perfil 7974362414 --proposito unificar
```

Propositos: `auto` (default, gana la mayor afinidad) · `consumo` · `libre` · `vivienda` ·
`educacion` · `unificar` · `complementario` · `seguros_impuestos`.

### HTTP

```bash
curl -s localhost:3000/api/enrich -H 'content-type: application/json' \
  -d '{"registros":[{"cedula":"15148524","categoriaAfiliacion":"B"}],"proposito":"auto"}'
```

## Como leer la salida

### Afinidad: el numero y su explicacion son lo mismo

Cada producto declara su cliente objetivo como criterios con peso.

```
afinidad = suma de pesos de los criterios que cumple / suma de todos los pesos
```

Por eso **no existe una afinidad sin razones**: si el numero dice 88%, los criterios te dicen
exactamente cuales 12 puntos faltaron. Cuando expliques una decision, cita los criterios — no
parafrasees el porcentaje.

Cada `criterio` trae:

- `etiqueta` — la regla: `"Score de buro >= 600"`
- `detalle` — el valor real del perfil: `"Buro 765"`
- `peso` — puntos que aporta
- `cumple` — si el perfil lo cumple
- `bloqueante` — si al no cumplirse **impide otorgar** el producto

### `aplica` vs `afinidad`: no los confundas

Se evaluan **siempre los 8 productos**, incluso para un perfil no elegible.

- `aplica: false` → incumple un criterio **bloqueante**. No es que encaje poco: **no se puede
  otorgar**. Su `montoSugerido` es `0` y nunca puede ser el recomendado.
- Un producto con `aplica: false` puede tener afinidad **mas alta** que uno aplicable. Es normal
  y es informacion util: "Credito Mujer daria 88%, pero esta bloqueado porque no tiene afiliacion
  vigente" es exactamente el dato que necesita un asesor para saber que gestionar.

Los productos vienen ordenados: primero los que aplican por afinidad descendente, despues los
bloqueados. `productos[0]` es el recomendado salvo que se haya forzado un `proposito`.

### Elegibilidad global

`elegible: false` es distinto de que un producto no aplique: son los filtros duros del perfil
(cedula invalida, antiguedad bajo el minimo del vinculo, mora >= 60 dias). Ahi no hay oferta
posible por ahora, y `alertas` dice por que.

### Reglas de monto que hay que saber para explicar cualquier cifra

- **Tope del brief**: ingreso hasta 1 SMMLV → maximo **$1.500.000** por libranza. Por encima →
  **3x el salario**. Se exceptuan hipotecario (garantia real) y compra de cartera (el monto lo
  fija la deuda que se compra).
- **`topeAplicado: true`** significa que la capacidad de pago daba para mas y el tope recorto el
  monto. Vale la pena decirlo: es una restriccion de politica, no del perfil.
- El monto **descuenta la tasa** (valor presente de la anualidad), no es cuota x plazo.
- `capacidadCuota` = 40% del ingreso − cuota de deudas actuales. Si da 0, casi todo el portafolio
  queda bloqueado por el criterio base.

Consulta `politica_credito` (MCP) o `lib/constants.ts` antes de afirmar de donde sale un numero.

## Analizar cartera

Para lotes usa las **filas compactas** (`filas` en MCP, `results` en CLI/HTTP). Un lote de 2.000
registros con los criterios de los 8 productos cada uno no cabe util en contexto; las filas traen
lo que se necesita para decidir.

Campos de cada fila: `cedula`, `nombre`, `edad`, `ciudad`, `categoria`, `ingreso`, `dti`,
`scoreBuro`, `score`, `riesgo`, `elegible`, `producto`, `afinidad`, `monto`, `modalidad`,
`entidadesConDeuda`, `saldoDeudaExterna`, `alertas`.

### A quien llamar primero

Ordena por **monto x afinidad**, no por monto solo: un ticket alto con afinidad 60% es una
conversacion peor que uno mediano con 100%. Filtra `elegible: true` y `riesgo != "Alto"`.

```bash
pnpm --silent reto lote afiliados.csv \
  | jq '[.results[] | select(.recomendacion.elegible)
      | {cedula: .exogenos.cedula, nombre: .exogenos.nombre,
         producto: .recomendacion.nombreProducto, monto: .recomendacion.montoSugerido,
         afinidad: .recomendacion.productos[0].afinidad, riesgo: .recomendacion.nivelRiesgo}]
      | map(select(.riesgo != "Alto")) | sort_by(-(.monto * .afinidad)) | .[:20]'
```

### Oportunidad de compra de cartera

El caso que **solo existe gracias a un dato exogeno**. Busca `dti >= 0.35` con
`entidadesConDeuda >= 2` y suma `saldoDeudaExterna`: eso es saldo que hoy esta en otras entidades
y es dimensionable en pesos. Es la cifra mas vendible de un analisis de cartera.

Ojo con el error facil: **muchas entidades no es sobreendeudamiento**. Alguien con 4 obligaciones
y DTI de 6% esta comodo. La senal es el DTI, no el conteo.

### Concentracion de riesgo

Cruza `distribucionRiesgo` con `distribucionProducto` y con `modalidad`. La libranza tiene
recaudo por nomina: una cartera con mucho "No libranza" en riesgo Medio/Alto es un perfil de
cobranza distinto al que sugiere el score promedio.

### Cuanto aporta enriquecer

`resumen.camposDeInsumo` cuenta los registros que llegaron con datos propios. El resto del
perfil — ingreso, buro, deuda externa, mora — es **todo** aporte del motor. Para cuantificar el
valor: cuenta cuantos registros pasaron de "solo una cedula" a tener una oferta con monto.

## Calibrar la politica

Los parametros de negocio estan en **un solo lugar** y no hay logica de credito fuera de ahi:

| Archivo | Que cambiar |
| --- | --- |
| `lib/constants.ts` | SMMLV, `MAX_DTI`, topes del brief, antiguedad minima por vinculo, limites/plazo/tasa de cada producto |
| `lib/criterios.ts` | El cliente objetivo de cada producto: criterios, pesos y cuales son bloqueantes |
| `lib/decision.ts` | Filtros duros de elegibilidad y score de aprobacion |
| `lib/synthetic.ts` | Distribuciones del proveedor sintetico |

Al tocar pesos o umbrales:

1. `pnpm test` — 30 tests. Dos son los que importan aca: que los 8 productos sigan pudiendo ganar
   en un lote de 2.000, y que el **lote demo siga cubriendo la historia completa** (los 8
   productos, los dos topes, los tres rechazos). Si calibrar deja la demo coja, el test avisa.
2. Vuelve a correr `pnpm --silent reto demo --resumen` y compara `distribucionProducto` contra
   antes. Un cambio de peso chico puede mover la mitad de la cartera de producto.
3. Si cambia el SMMLV (decreto anual), es `lib/constants.ts` y arrastra las categorias A–D y
   todos los montos.

**No metas reglas de credito en la UI ni en el CLI.** Los tres caminos llaman a `procesarLote`;
si una regla vive fuera del motor, la UI y el agente empiezan a dar respuestas distintas.

## Enchufar una fuente real

`lib/engine.ts` no importa `synthetic.ts`: habla contra la interfaz `ProveedorExogenos`
(`lib/proveedor.ts`). Un conector de buro se enchufa implementando esa interfaz, sin tocar el
motor de decision ni la UI.

Si te piden conectar datos reales, decilo explicitamente: requiere **base legal y consentimiento**
(Ley 1581, Habeas Data). No scrapees PII de personas identificadas por cedula, ni propongas
hacerlo.
