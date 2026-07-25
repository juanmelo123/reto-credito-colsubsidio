# Motor de Enriquecimiento Crediticio

**Reto Crédito — Hackathon Colsubsidio x 30X**

Prototipo (Next.js + TypeScript) que, a partir de una **cédula** (individual o en **lote**),
enriquece el perfil de la persona con **variables exógenas** y recomienda un **producto de
crédito** del portafolio Colsubsidio, con un **score explicable**.

> ⚠️ **Datos 100 % sintéticos y deterministas.** No se consulta ni almacena información real de
> ninguna persona. Cada cédula genera —de forma reproducible— un perfil simulado que *emula* lo
> que devolvería un buró o una fuente externa. Esto respeta el Habeas Data (Ley 1581) y hace la
> demo controlable. El brief del reto habilita explícitamente el uso de data sintética.

---

## Qué hace

1. **Enriquece** con variables exógenas simuladas:
   - Contacto y redes: correo, Instagram, LinkedIn.
   - Laboral/ingreso: vínculo, antigüedad, ingreso estimado, categoría de afiliación (A–D).
   - Señales de mercado: score de buró, entidades con deuda, saldo y cuota de deuda externa,
     mora, embargos, actividad económica del independiente.
2. **Decide** con un árbol de negocio:
   - **Filtros duros** (elegibilidad): cédula, antigüedad mínima por tipo de vínculo, mora, embargos.
   - **Capacidad de pago**: DTI actual y cuota adicional disponible (`MAX_DTI = 40%`).
   - **Score de aprobación** 0–100 y nivel de riesgo (Bajo/Medio/Alto).
   - **Asignación de producto** del portafolio (con propósito declarado o el de mayor encaje).
3. **Explica**: cada recomendación viene con las razones y alertas que la sustentan.

## El diferenciador

El motor detecta **sobreendeudamiento** (DTI + nº de entidades) y, en vez de ofrecer deuda
nueva, recomienda **Compra de cartera** — el producto cuya razón de ser es justamente un dato
exógeno (deudas con otras entidades). También ofrece **Libre inversión** a perfiles *sin historial
crediticio*, tal como Colsubsidio lo contempla.

## Cómo correrlo

```bash
npm install
npm run dev
# http://localhost:3000
```

- **Consulta individual**: escribe una cédula (p. ej. `1024587963`) y opcionalmente un propósito.
- **Consulta por lote**: pega cédulas, sube un CSV/TXT o usa "Ejemplo 500 / 2.000".
  Devuelve tabla ordenable, distribuciones agregadas y **exporta un CSV enriquecido**.

## API

`POST /api/enrich`

```json
{ "cedulas": ["1024587963", "52830147"], "proposito": "auto" }
```

Propósitos válidos: `auto | consumo | libre | vivienda | educacion | unificar | seguros_impuestos`.
Devuelve `results[]` (perfil + recomendación) y un `resumen` agregado.

## Dónde ajustar la lógica

Todo el negocio vive en [`/lib`](./lib):

| Archivo          | Responsabilidad                                                |
| ---------------- | -------------------------------------------------------------- |
| `constants.ts`   | SMMLV, umbrales A–D, `MAX_DTI`, antigüedad mínima, límites de producto |
| `synthetic.ts`   | Motor de datos exógenos sintéticos (determinista por cédula)   |
| `decision.ts`    | Motor de decisión: filtros, DTI, score, asignación de producto |
| `engine.ts`      | Orquesta enriquecimiento + decisión y arma el resumen del lote |

> `SMMLV` está fijado en `$1.500.000` (parámetro 2026). Ajústalo en `constants.ts`.

## Notas para producción (fuera del alcance del MVP)

- Reemplazar `synthetic.ts` por conectores reales (buró/centrales de riesgo) **con base legal y
  consentimiento**; nunca scrapear PII de personas identificadas por cédula.
- Persistencia, autenticación, trazabilidad de decisiones y validación del modelo de score.
