import { NextResponse } from "next/server";
import { procesarRegistro } from "@/lib/engine";
import { construirPropuesta } from "@/lib/propuesta";
import { validarCedula, normalizarCategoria } from "@/lib/synthetic";
import type { Proposito } from "@/lib/types";

// Envia la propuesta de credito por WhatsApp usando Kapso (WhatsApp Cloud API).
// Igual que el correo: el contenido NO viaja desde el cliente, se recalcula aqui
// a partir de la cedula, para que el endpoint no sirva para mandar texto
// arbitrario a numeros arbitrarios.
export async function POST(req: Request) {
  const apiKey = process.env.KAPSO_API_KEY;
  const phoneNumberId = process.env.KAPSO_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) {
    return NextResponse.json(
      { error: "Faltan KAPSO_API_KEY y/o KAPSO_PHONE_NUMBER_ID en el entorno." },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const texto = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined;

  const cedulaRaw = texto(body.cedula) ?? "";
  const { normalizada } = validarCedula(cedulaRaw);
  const cedula = normalizada || cedulaRaw;
  if (!cedula) return NextResponse.json({ error: "Falta la cédula" }, { status: 400 });

  // El numero destino SI viene del cliente (el perfil sintetico no tiene telefono).
  const destino = normalizarTelefono(texto(body.destino));
  if (!destino) {
    return NextResponse.json(
      { error: "Falta un número de WhatsApp válido (con indicativo de país, ej: 573001234567)." },
      { status: 400 }
    );
  }

  const perfil = procesarRegistro(
    {
      cedula,
      nombre: texto(body.nombre),
      correo: texto(body.correo),
      direccion: texto(body.direccion),
      categoriaAfiliacion: normalizarCategoria(texto(body.categoriaAfiliacion)) ?? undefined,
    },
    (texto(body.proposito) as Proposito) ?? "auto"
  );

  const { asunto, texto: plano } = construirPropuesta(perfil);
  // WhatsApp usa texto con formato ligero: *negrita*. El asunto va de titular.
  const mensaje = `*${asunto}*\n\n${plano}`.slice(0, 4096);

  const res = await fetch(
    `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: destino,
        type: "text",
        text: { body: mensaje, preview_url: false },
      }),
    }
  );

  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
    data?: { id?: string };
    error?: { message?: string };
    message?: string;
  };

  if (!res.ok) {
    const msg =
      json.error?.message ?? json.message ?? `Kapso rechazó el envío (HTTP ${res.status})`;
    return NextResponse.json({ error: msg }, { status: res.status });
  }

  const id = json.messages?.[0]?.id ?? json.data?.id ?? null;
  return NextResponse.json({ id, destino, asunto });
}

// Deja solo digitos y, para moviles colombianos de 10 digitos, antepone el 57.
function normalizarTelefono(raw: string | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) d = `57${d}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}
