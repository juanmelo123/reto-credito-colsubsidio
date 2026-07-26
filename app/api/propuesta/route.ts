import { NextResponse } from "next/server";
import { procesarRegistro } from "@/lib/engine";
import { construirPropuesta } from "@/lib/propuesta";
import { validarCedula, normalizarCategoria } from "@/lib/synthetic";
import type { Proposito } from "@/lib/types";

// El contenido del correo NO viaja desde el cliente: se recalcula aqui a partir
// de la cedula. Asi este endpoint no se puede usar para mandar texto arbitrario
// a direcciones arbitrarias.
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Falta RESEND_API_KEY en el entorno." }, { status: 500 });
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

  const destino = texto(body.destino) ?? perfil.exogenos.correo;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destino)) {
    return NextResponse.json({ error: `Correo inválido: ${destino}` }, { status: 400 });
  }

  const { asunto, html, texto: plano } = construirPropuesta(perfil);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM ?? "Colsubsidio Crédito <onboarding@resend.dev>",
      to: [destino],
      subject: asunto,
      html,
      text: plano,
    }),
  });

  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) {
    return NextResponse.json(
      { error: json.message ?? "Resend rechazó el envío" },
      { status: res.status }
    );
  }

  return NextResponse.json({ id: json.id, destino, asunto });
}
