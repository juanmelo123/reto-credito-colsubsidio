// Propuesta comercial personalizada: plan de pago discriminado + texto armado
// con la situacion concreta del perfil. Se usa para el correo (y manana para
// WhatsApp, que consume los mismos bloques de texto sin el HTML).

import { LIMITES_PRODUCTO, SMMLV } from "./constants";
import { formatCOP, formatPercent } from "./format";
import type { PerfilCompleto, ProductoId, ProductoEvaluado, DatosExogenos } from "./types";

export interface PlanPago {
  plazoMeses: number;
  tasaMensual: number;
  tasaEA: number;
  cuota: number;
  totalAPagar: number;
  intereses: number;
}

// Cuota fija de una anualidad: es la inversa exacta de `montoPorCuota`, asi el
// monto que muestra la UI y la cuota del correo nunca se contradicen.
export function planDePago(producto: ProductoId, monto: number): PlanPago {
  const { plazoMeses, tasaMensual } = LIMITES_PRODUCTO[producto];
  const cuota =
    tasaMensual > 0
      ? (monto * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -plazoMeses))
      : monto / plazoMeses;
  const totalAPagar = cuota * plazoMeses;
  return {
    plazoMeses,
    tasaMensual,
    tasaEA: Math.pow(1 + tasaMensual, 12) - 1,
    cuota,
    totalAPagar,
    intereses: totalAPagar - monto,
  };
}

const primerNombre = (n: string) => n.split(" ")[0] ?? n;

// Como aprovechar el producto SEGUN la situacion del afiliado, no segun el
// folleto: cambia si esta sobreendeudado, si es independiente, si tiene cupo
// libre, etc.
function comoUsarlo(perfil: PerfilCompleto, plan: PlanPago): string[] {
  const { exogenos: e, recomendacion: r } = perfil;
  const tips: string[] = [];
  const holgura = r.capacidadCuota - plan.cuota;

  switch (r.productoRecomendado) {
    case "compra_cartera":
      tips.push(
        `Úsalo para pagar de una vez tus ${e.entidadesConDeuda} obligaciones (${formatCOP(e.saldoDeudaExterna)}) y quedarte con una sola cuota de ${formatCOP(plan.cuota)} al mes en lugar de ${formatCOP(e.cuotaMensualDeudas)}.`
      );
      if (e.cuotaMensualDeudas > plan.cuota) {
        tips.push(
          `Liberas ${formatCOP(e.cuotaMensualDeudas - plan.cuota)} cada mes: destínalos a un ahorro o a abonos extraordinarios a capital para cerrar antes de los ${plan.plazoMeses} meses.`
        );
      }
      tips.push("No tomes deuda nueva mientras consolidas: es lo que baja tu DTI y sube tu score.");
      break;
    case "libre_inversion":
      tips.push(
        `Es desembolso directo a tu cuenta: te sirve para un objetivo con retorno (remodelación, herramientas de trabajo, estudios) más que para gasto corriente.`
      );
      tips.push(
        `Pide solo lo que necesites: de los ${formatCOP(plan.totalAPagar)} que terminas pagando, ${formatCOP(plan.intereses)} son intereses del plazo de ${plan.plazoMeses} meses.`
      );
      break;
    case "hipotecario":
      tips.push(
        `Este monto es el valor a financiar; súmale tu cuota inicial para saber el precio de vivienda al que puedes apuntar.`
      );
      tips.push(
        `A ${plan.plazoMeses} meses los intereses pesan ${formatCOP(plan.intereses)}: cada abono extraordinario a capital en los primeros años recorta ese total de forma notoria.`
      );
      break;
    case "educativo":
      tips.push(
        `Cubre matrícula y materiales del programa; el desembolso va directo a la institución, así que ten a mano la orden de matrícula.`
      );
      tips.push(
        `La cuota de ${formatCOP(plan.cuota)} cabe en tu capacidad actual (${formatCOP(r.capacidadCuota)}/mes) sin tocar tus otros compromisos.`
      );
      break;
    case "credito_mujer":
      tips.push(
        `Está pensado para capital de trabajo o proyecto propio: ${e.tieneNegocio ? "úsalo en inventario o equipos de tu negocio, que es lo que devuelve la cuota" : "úsalo en un proyecto que genere ingreso, no en gasto de consumo"}.`
      );
      tips.push(
        `Incluye los beneficios del programa (acompañamiento y tasa preferencial); pregúntalos antes de firmar.`
      );
      break;
    case "cupo_rotativo":
      tips.push(
        `Es un cupo reutilizable: solo pagas intereses por lo que uses, no por los ${formatCOP(r.montoSugerido)} completos.`
      );
      tips.push(
        `Ideal para compras del mes y gastos imprevistos; si lo usas completo, la cuota sería de ${formatCOP(plan.cuota)} a ${plan.plazoMeses} meses.`
      );
      break;
    case "complementario":
      tips.push(
        `Es una línea adicional sobre lo que ya tienes: úsala para un gasto puntual y no como extensión del cupo del mes.`
      );
      break;
    case "rotativo_seguros_impuestos":
      tips.push(
        `Difiere en ${plan.plazoMeses} cuotas lo que hoy pagas de golpe (SOAT, predial, matrícula, pólizas) y evita mover tu flujo de caja.`
      );
      break;
    default:
      break;
  }

  // Por debajo de esto la holgura es ruido de redondeo del monto, no un margen.
  if (holgura > 50_000) {
    tips.push(
      `Después de esta cuota te quedan ${formatCOP(holgura)}/mes de capacidad libre: es tu margen de seguridad, no lo comprometas completo.`
    );
  }
  if (e.moraDias > 0) {
    tips.push(
      `Ponte al día en los ${e.moraDias} días de mora antes del desembolso: es lo único que hoy puede frenar la aprobación.`
    );
  }
  return tips;
}

// Que faltaria para calificar: los criterios bloqueantes que no cumple, del
// producto que mas cerca quedo.
function quePodemosHacer(perfil: PerfilCompleto): string[] {
  const { recomendacion: r } = perfil;
  const masCerca = [...r.productos].sort((a, b) => b.afinidad - a.afinidad)[0];
  const faltantes = (masCerca?.criterios ?? [])
    .filter((c) => !c.cumple && c.bloqueante)
    .map((c) => `${c.etiqueta} — hoy: ${c.detalle}`);
  return faltantes.length > 0
    ? faltantes
    : r.alertas.length > 0
      ? r.alertas
      : ["Revisemos tu caso con un asesor para encontrar una alternativa."];
}

function contexto(e: DatosExogenos, r: PerfilCompleto["recomendacion"]): string {
  const smmlv = (e.ingresoEstimado / SMMLV).toFixed(1);
  const deuda =
    e.entidadesConDeuda > 0
      ? `hoy pagas ${formatCOP(e.cuotaMensualDeudas)}/mes en ${e.entidadesConDeuda} obligación(es), lo que deja tu nivel de endeudamiento en ${formatPercent(r.dti)}`
      : `no tienes obligaciones reportadas con otras entidades, así que tu capacidad está intacta`;
  return `Miramos tu perfil en ${e.ciudad}: ingreso estimado de ${formatCOP(e.ingresoEstimado)} (${smmlv} SMMLV), vínculo ${e.tipoContrato.toLowerCase()} con ${e.antiguedadMeses} meses de antigüedad y categoría ${e.categoriaAfiliacion}. Además, ${deuda}.`;
}

function alternativas(r: PerfilCompleto["recomendacion"]): ProductoEvaluado[] {
  return r.productos.filter((p) => p.aplica && p.id !== r.productoRecomendado).slice(0, 2);
}

export interface Propuesta {
  asunto: string;
  html: string;
  texto: string;
}

export function construirPropuesta(perfil: PerfilCompleto): Propuesta {
  const { exogenos: e, recomendacion: r } = perfil;
  const nombre = primerNombre(e.nombre);

  if (!r.elegible || !r.productoRecomendado) {
    const pasos = quePodemosHacer(perfil);
    const asunto = `${nombre}, esto es lo que falta para tu crédito en Colsubsidio`;
    const texto = [
      `Hola ${nombre},`,
      "",
      contexto(e, r),
      "",
      "Por ahora no podemos preaprobarte un desembolso automático, pero tu caso no está cerrado. Esto es lo que hay que resolver:",
      ...pasos.map((p) => `- ${p}`),
      "",
      `Cuando eso se cumpla, con tu capacidad actual (${formatCOP(r.capacidadCuota)}/mes) podríamos hablar de montos hasta ${formatCOP(r.topeMonto)}.`,
      "",
      "Un asesor de Colsubsidio puede acompañarte en el proceso.",
    ].join("\n");

    return {
      asunto,
      texto,
      html: envoltura(
        nombre,
        asunto,
        `
        <p style="${P}">${esc(contexto(e, r))}</p>
        <p style="${P}">Por ahora no podemos preaprobarte un desembolso automático, pero tu caso no está cerrado. Esto es lo que hay que resolver:</p>
        ${lista(pasos)}
        <p style="${P}">Cuando eso se cumpla, con tu capacidad actual (<b>${formatCOP(r.capacidadCuota)}/mes</b>) podríamos hablar de montos hasta <b>${formatCOP(r.topeMonto)}</b>.</p>
        `
      ),
    };
  }

  const plan = planDePago(r.productoRecomendado, r.montoSugerido);
  const tips = comoUsarlo(perfil, plan);
  const otras = alternativas(r);
  const asunto = `${nombre}, tu ${r.nombreProducto.toLowerCase()} por ${formatCOP(r.montoSugerido)} — cuota ${formatCOP(plan.cuota)}/mes`;

  const filas: [string, string][] = [
    ["Monto que recibes", formatCOP(r.montoSugerido)],
    ["Plazo", `${plan.plazoMeses} meses`],
    ["Tasa", `${formatPercent(plan.tasaMensual, 2)} mensual (${formatPercent(plan.tasaEA, 1)} E.A.)`],
    ["Cuota mensual", formatCOP(plan.cuota)],
    ["Intereses del crédito", formatCOP(plan.intereses)],
    ["Total a pagar", formatCOP(plan.totalAPagar)],
    ["Forma de pago", r.modalidad],
  ];

  const texto = [
    `Hola ${nombre},`,
    "",
    contexto(e, r),
    "",
    `Producto recomendado: ${r.nombreProducto} por ${formatCOP(r.montoSugerido)} (${r.modalidad}).`,
    "",
    "Tu cuenta clara:",
    ...filas.map(([k, v]) => `- ${k}: ${v}`),
    "",
    "Cómo te recomendamos usarlo:",
    ...tips.map((t) => `- ${t}`),
    "",
    "Por qué te lo ofrecemos:",
    ...r.razones.slice(0, 4).map((rz) => `- ${rz}`),
    ...(otras.length
      ? [
          "",
          "Otras opciones que también te aplican:",
          ...otras.map((p) => {
            const pl = planDePago(p.id, p.montoSugerido);
            return `- ${p.nombre}: hasta ${formatCOP(p.montoSugerido)} · cuota ${formatCOP(pl.cuota)} a ${pl.plazoMeses} meses`;
          }),
        ]
      : []),
    "",
    "Cifras estimadas con datos del motor de perfilamiento; la aprobación final depende del estudio de crédito.",
  ].join("\n");

  const html = envoltura(
    nombre,
    asunto,
    `
    <p style="${P}">${esc(contexto(e, r))}</p>

    <div style="border:1px solid #0067b1;border-radius:12px;overflow:hidden;margin:20px 0;">
      <div style="background:#0067b1;color:#fff;padding:14px 18px;">
        <div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.85;">Producto recomendado para ti</div>
        <div style="font-size:20px;font-weight:800;margin-top:4px;">${r.nombreProducto}</div>
        <div style="font-size:15px;margin-top:2px;">${formatCOP(r.montoSugerido)} · ${r.modalidad}</div>
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:14px;">
        ${filas
          .map(
            ([k, v]) => `
        <tr style="background:${k === "Total a pagar" ? "#fffdf4" : "#fff"};">
          <td style="padding:10px 18px;border-top:1px solid #dddddd;color:#575756;">${k}</td>
          <td style="padding:10px 18px;border-top:1px solid #dddddd;text-align:right;font-weight:${k === "Total a pagar" ? 800 : 600};">${v}</td>
        </tr>`
          )
          .join("")}
      </table>
    </div>

    <h2 style="${H2}">Cómo te recomendamos usarlo</h2>
    ${lista(tips)}

    <h2 style="${H2}">Por qué te lo ofrecemos</h2>
    ${lista(r.razones.slice(0, 4))}

    ${
      otras.length
        ? `<h2 style="${H2}">Otras opciones que también te aplican</h2>
    ${lista(
      otras.map((p) => {
        const pl = planDePago(p.id, p.montoSugerido);
        return `<b>${p.nombre}</b>: hasta ${formatCOP(p.montoSugerido)} · cuota ${formatCOP(pl.cuota)} a ${pl.plazoMeses} meses`;
      })
    )}`
        : ""
    }
    `
  );

  return { asunto, html, texto };
}

// --- Plantilla HTML (estilos en linea: los clientes de correo no leen CSS externo) ---

// El nombre puede venir del insumo del usuario: nunca entra crudo al HTML.
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

const P = "margin:0 0 14px;font-size:15px;line-height:1.6;color:#575756;";
const H2 =
  "margin:24px 0 8px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#0067b1;";

function lista(items: string[]): string {
  return `<ul style="margin:0 0 14px;padding-left:18px;">${items
    .map((i) => `<li style="font-size:14.5px;line-height:1.6;color:#575756;margin-bottom:6px;">${i}</li>`)
    .join("")}</ul>`;
}

// Cabecera de marca en HTML plano: azul Colsubsidio con el filete amarillo.
// El logo va como texto, no como <img>: sin dominio publico la imagen se
// rompe y muchos clientes bloquean remotas por defecto.
function envoltura(nombre: string, titulo: string, cuerpo: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6f8;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #dddddd;border-radius:14px;overflow:hidden;">
  <div style="background:#0067b1;padding:18px 28px;">
    <div style="font-size:19px;font-weight:800;letter-spacing:-.01em;color:#ffffff;">Colsubsidio</div>
    <div style="font-size:11.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#ffd000;margin-top:2px;">Crédito</div>
  </div>
  <div style="height:4px;background:#ffd000;"></div>
  <div style="padding:26px 28px 28px;">
  <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#1c1c1c;">Hola ${esc(nombre)}, tenemos una propuesta hecha a tu medida</h1>
  ${cuerpo}
  <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#757575;border-top:1px solid #dddddd;padding-top:14px;">
    Cifras estimadas por el motor de perfilamiento a partir de tu información; la aprobación final y las condiciones definitivas dependen del estudio de crédito. Este correo se generó automáticamente para el reto de crédito Colsubsidio.
  </p>
  </div>
</div>
<div style="display:none;">${titulo}</div>
</body></html>`;
}
