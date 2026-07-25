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
3. **Decide** con un árbol de negocio:
   - **Filtros duros**: cédula, antigüedad mínima por tipo de vínculo, mora, embargos.
   - **Capacidad de pago**: DTI actual y cuota adicional disponible (`MAX_DTI = 40 %`).
   - **Tope de monto del brief**: hasta 1 SMMLV → $1.500.000 por libranza; por encima →
     **3× el salario**. Se exceptúan hipotecario (garantía real) y compra de cartera (el monto
     lo fija la deuda que se compra).
   - **Modalidad**: libranza (con pagaduría), no libranza o cupo (rotativos).
   - **Score de aprobación** 0–100 y nivel de riesgo (Bajo/Medio/Alto).
   - **Asignación de producto** entre los 8 del portafolio.
4. **Explica**: cada recomendación trae las razones y alertas que la sustentan, incluido cuándo
   el monto se recortó por el tope de capacidad.

## Decisiones de modelo que vale la pena mirar

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

```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # 22 tests del motor (node:test, sin framework)
```

- **Consulta individual**: escribe una cédula y, opcionalmente, los datos que ya tengas.
  Casos de ejemplo: `1028404676` (compra de cartera), `1051570194` (ingreso bajo 1 SMMLV →
  tope de $1.500.000), `1022383083` (hipotecario) y `28247876` (Crédito Mujer).
- **Consulta por lote**: pega cédulas, usa "Ejemplo CSV con columnas" o sube tu archivo.
  Devuelve tabla ordenable, distribuciones agregadas y **exporta un CSV enriquecido** de 26
  columnas con trazabilidad de qué campos vinieron del insumo.

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
| `insumo.ts`      | Lectura del CSV del usuario (delimitadores, alias de columna)             |
| `proveedor.ts`   | **Costura de fuentes**: interfaz `ProveedorExogenos` que hoy resuelve sintético |
| `synthetic.ts`   | Proveedor sintético determinista por cédula                               |
| `decision.ts`    | Motor de decisión: filtros, DTI, tope, modalidad, score, producto         |
| `engine.ts`      | Orquesta enriquecimiento + decisión y arma el resumen del lote            |
| `motor.test.ts`  | Tests del motor                                                          |

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
