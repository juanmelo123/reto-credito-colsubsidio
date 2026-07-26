"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, Mail, Search, Sparkles } from "lucide-react";

import type { PerfilCompleto, Proposito, CampoInsumo, CategoriaAfiliacion } from "@/lib/types";
import { planDePago } from "@/lib/propuesta";
import { formatCOP, formatPercent } from "@/lib/format";
import { CASOS_INDIVIDUALES } from "@/lib/demo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldHint } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, Card, CardBody, CardTitle } from "@/components/ui/card";
import AfinidadPortafolio from "./AfinidadPortafolio";
import { RiskBadge, ScoreGauge } from "./shared";

const PROPOSITOS: { value: Proposito; label: string }[] = [
  { value: "auto", label: "Automático (mayor afinidad)" },
  { value: "consumo", label: "Consumo / compras" },
  { value: "libre", label: "Libre inversión" },
  { value: "vivienda", label: "Vivienda" },
  { value: "educacion", label: "Educación" },
  { value: "unificar", label: "Unificar deudas" },
  { value: "complementario", label: "Crédito complementario" },
  { value: "seguros_impuestos", label: "Seguros e impuestos" },
];

const CATEGORIAS: { value: string; label: string }[] = [
  { value: "auto", label: "Inferir del ingreso" },
  { value: "A", label: "A — hasta 2 SMMLV" },
  { value: "B", label: "B — de 2 a 4 SMMLV" },
  { value: "C", label: "C — más de 4 SMMLV" },
  { value: "D", label: "D — no afiliado" },
];

interface Consulta {
  cedula: string;
  proposito: Proposito;
  nombre?: string;
  correo?: string;
  direccion?: string;
  categoriaAfiliacion?: CategoriaAfiliacion;
}

export default function IndividualPanel() {
  const [cedula, setCedula] = useState("");
  const [proposito, setProposito] = useState<Proposito>("auto");
  // Campos del insumo del brief: opcionales. Lo que se llene NO se sintetiza.
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [categoria, setCategoria] = useState("auto");
  const [verInsumo, setVerInsumo] = useState(false);
  const [data, setData] = useState<PerfilCompleto | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rota entre los casos de demostracion en vez de repetir siempre el mismo.
  const [demoIdx, setDemoIdx] = useState(0);

  async function consultar(cedulaOverride?: string) {
    const c = (cedulaOverride ?? cedula).trim();
    if (!c) {
      setError("Ingresa una cédula para consultar.");
      return;
    }
    setLoading(true);
    setError(null);
    const registro = {
      cedula: c,
      nombre: nombre.trim() || undefined,
      correo: correo.trim() || undefined,
      direccion: direccion.trim() || undefined,
      categoriaAfiliacion:
        categoria === "auto" ? undefined : (categoria as CategoriaAfiliacion),
    };
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros: [registro], proposito }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en la consulta");
      setData(json.results[0]);
      // Se guarda el insumo exacto con el que se calculo el perfil: el correo
      // se manda con eso, aunque despues editen los campos del formulario.
      setConsulta({ ...registro, proposito });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Carga un caso de demostracion y lo consulta de una: en tarima, un clic.
  function cargarDemo() {
    const caso = CASOS_INDIVIDUALES[demoIdx % CASOS_INDIVIDUALES.length];
    setDemoIdx((i) => i + 1);
    setCedula(caso.cedula);
    setNombre("");
    setCorreo("");
    setDireccion("");
    setCategoria("auto");
    setProposito("auto");
    void consultar(caso.cedula);
  }

  const siguienteDemo = CASOS_INDIVIDUALES[demoIdx % CASOS_INDIVIDUALES.length];

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="ced">Cédula</Label>
              <Input
                id="ced"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej: 15148524"
                value={cedula}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? "ced-error" : undefined}
                onChange={(e) => {
                  setCedula(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && consultar()}
              />
            </div>

            <div className="min-w-[220px] flex-1">
              <Label htmlFor="prop">Propósito del crédito</Label>
              <Select value={proposito} onValueChange={(v) => setProposito(v as Proposito)}>
                <SelectTrigger id="prop" className="group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPOSITOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => consultar()} disabled={loading}>
              {loading ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Search aria-hidden />
              )}
              {loading ? "Consultando..." : "Enriquecer y perfilar"}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={cargarDemo} disabled={loading}>
              <Sparkles aria-hidden />
              Usar datos de demostración
            </Button>
            <span className="text-[12px] text-faint">{siguienteDemo.titulo}</span>

            <div className="flex-1" />

            <Button
              variant="quiet"
              size="sm"
              onClick={() => setVerInsumo((v) => !v)}
              aria-expanded={verInsumo}
              aria-controls="insumo-fields"
            >
              Datos que ya tengo
              <ChevronDown
                aria-hidden
                className={cn("transition-transform duration-200", verInsumo && "rotate-180")}
              />
            </Button>
          </div>

          {verInsumo && (
            <div id="insumo-fields" className="mt-4 border-t border-line pt-4">
              <p className="mb-3 text-[12.5px] text-faint">
                Los cinco campos del brief. Lo que llenes se respeta tal cual y no se sobrescribe;
                lo que dejes vacio lo aporta el motor.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="in-nombre">Nombre</Label>
                  <Input
                    id="in-nombre"
                    value={nombre}
                    onChange={(ev) => setNombre(ev.target.value)}
                    placeholder="Se enriquece"
                  />
                </div>
                <div>
                  <Label htmlFor="in-correo">Correo</Label>
                  <Input
                    id="in-correo"
                    type="email"
                    value={correo}
                    onChange={(ev) => setCorreo(ev.target.value)}
                    placeholder="Se enriquece"
                  />
                </div>
                <div>
                  <Label htmlFor="in-dir">Dirección</Label>
                  <Input
                    id="in-dir"
                    value={direccion}
                    onChange={(ev) => setDireccion(ev.target.value)}
                    placeholder="Se enriquece"
                  />
                </div>
                <div>
                  <Label htmlFor="in-cat">Categoría de afiliación</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger id="in-cat" className="group">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {error ? (
            <FieldHint error className="mt-3" >
              <span id="ced-error">{error}</span>
            </FieldHint>
          ) : (
            <FieldHint className="mt-3">
              Datos sintéticos y deterministas: la misma cédula devuelve siempre el mismo perfil.
            </FieldHint>
          )}
        </CardBody>
      </Card>

      {data && <Resultado data={data} consulta={consulta} />}
    </div>
  );
}

function Resultado({ data, consulta }: { data: PerfilCompleto; consulta: Consulta | null }) {
  const { exogenos: e, recomendacion: r } = data;
  const delInsumo = (campo: CampoInsumo) => e.camposDeInsumo.includes(campo);
  const plan = r.productoRecomendado ? planDePago(r.productoRecomendado, r.montoSugerido) : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      {/* --- Perfil enriquecido --- */}
      <Card className="h-fit">
        <CardBody>
          <CardTitle>Perfil enriquecido · variables exógenas</CardTitle>
          {e.camposDeInsumo.length > 0 && (
            <p className="-mt-2 mb-3 text-[12.5px] text-faint">
              {e.camposDeInsumo.length} campo(s) vienen de tu insumo y se respetaron tal cual.
            </p>
          )}

          <Seccion titulo="Identidad y contacto" />
          <dl className="flex flex-col">
            <Row k="Nombre" v={e.nombre} insumo={delInsumo("nombre")} />
            <Row
              k="Cédula"
              v={`${e.cedula}${e.cedulaValida ? "" : " (formato invalido)"}`}
              insumo
            />
            <Row
              k="Edad / Género"
              v={`${e.edad} años · ${e.genero === "F" ? "Femenino" : "Masculino"}`}
            />
            <Row k="Ciudad" v={e.ciudad} />
            <Row k="Dirección" v={e.direccion} insumo={delInsumo("direccion")} />
            <Row k="Correo" v={e.correo} insumo={delInsumo("correo")} />
            <Row k="Instagram" v={e.instagram ?? "No detectado"} />
            <Row k="LinkedIn" v={e.linkedin ? "Perfil detectado" : "No detectado"} />
          </dl>

          <Seccion titulo="Laboral e ingreso" />
          <dl className="flex flex-col">
            <Row k="Vínculo" v={e.tipoContrato} />
            <Row k="Antigüedad" v={`${e.antiguedadMeses} meses`} />
            <Row k="Ingreso estimado" v={formatCOP(e.ingresoEstimado)} />
            <Row
              k="Categoría afiliación"
              v={e.afiliado ? `Categoría ${e.categoriaAfiliacion}` : "No afiliado (D)"}
              insumo={delInsumo("categoriaAfiliacion")}
            />
            {e.tipoContrato === "Independiente" && (
              <Row
                k="Negocio"
                v={
                  e.tieneNegocio
                    ? e.presenciaDigitalNegocio
                      ? "Activo · con presencia digital"
                      : "Activo · sin presencia digital"
                    : "No detectado"
                }
              />
            )}
          </dl>

          <Seccion titulo="Señales de mercado" />
          <dl className="flex flex-col">
            <Row k="Score de buró (sim.)" v={`${e.scoreBuro} / 950`} />
            <Row k="Entidades con deuda" v={`${e.entidadesConDeuda}`} />
            <Row k="Saldo deuda externa" v={formatCOP(e.saldoDeudaExterna)} />
            <Row k="Cuota mensual deudas" v={formatCOP(e.cuotaMensualDeudas)} />
            <Row k="Estado de pago" v={e.moraDias === 0 ? "Al día" : `Mora ${e.moraDias} días`} />
            <Row k="Embargos" v={e.embargos ? "Si reporta" : "No"} />
          </dl>
        </CardBody>
      </Card>

      {/* --- Recomendacion + afinidad --- */}
      <div className="flex flex-col gap-5">
        <Card>
          <CardBody>
            <CardTitle>Recomendación del motor</CardTitle>

            {r.elegible && r.productoRecomendado ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-faint">Producto recomendado</p>
                    <p className="my-0.5 text-[22px] font-extrabold leading-tight tracking-tight">
                      {r.nombreProducto}
                    </p>
                    <p className="text-[15px] text-muted">
                      Monto sugerido:{" "}
                      <b className="text-[17px] text-accent-strong">{formatCOP(r.montoSugerido)}</b>{" "}
                      · {r.modalidad}
                    </p>
                  </div>
                  <div className="shrink-0 text-center">
                    <ScoreGauge score={r.score} />
                    <p className="mt-0.5 text-[11px] text-faint">Score aprob.</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <RiskBadge nivel={r.nivelRiesgo} />
                  <Badge>Cat. {e.categoriaAfiliacion}</Badge>
                  <Badge tono="neutro">{r.modalidad}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Metrica valor={formatPercent(r.dti)} label="DTI actual" />
                  <Metrica
                    valor={formatCOP(r.capacidadCuota)}
                    label="Cuota adicional/mes"
                    chico
                  />
                  <Metrica valor={formatCOP(r.topeMonto)} label="Tope por capacidad" chico />
                  <Metrica valor={`${e.scoreBuro}`} label="Score buró" />
                </div>

                {plan && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <Metrica valor={formatCOP(plan.cuota)} label="Cuota mensual" chico />
                    <Metrica valor={`${plan.plazoMeses} meses`} label="Plazo" chico />
                    <Metrica
                      valor={formatPercent(plan.tasaMensual, 2)}
                      label="Tasa mensual"
                      chico
                    />
                    <Metrica valor={formatCOP(plan.totalAPagar)} label="Total a pagar" chico />
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-[var(--radius-control)] border border-riesgo-alto/30 bg-riesgo-alto-soft p-4">
                <p className="text-[18px] font-extrabold text-riesgo-alto">No elegible por ahora</p>
                <p className="mt-1 text-[13.5px] text-riesgo-alto/80">
                  El perfil no supera los filtros duros del portafolio. Abajo esta que faltaria
                  para cada producto.
                </p>
              </div>
            )}

            <Seccion titulo="Por qué" />
            <ul className="flex flex-col">
              {r.razones.map((rz, i) => (
                <Punto key={i}>{rz}</Punto>
              ))}
            </ul>

            {r.alertas.length > 0 && (
              <>
                <Seccion titulo="Alertas" tono="alerta" />
                <ul className="flex flex-col">
                  {r.alertas.map((a, i) => (
                    <Punto key={i} tono="alerta">
                      {a}
                    </Punto>
                  ))}
                </ul>
              </>
            )}

            {consulta && (
              <EnviarPropuesta key={e.cedula} consulta={consulta} correoPerfil={e.correo} />
            )}
          </CardBody>
        </Card>

        <AfinidadPortafolio productos={r.productos} recomendado={r.productoRecomendado} />
      </div>
    </div>
  );
}

// El correo se arma en el servidor con la misma cedula: aqui solo se elige el
// destinatario. El del perfil es sintetico, por eso se puede sobrescribir.
function EnviarPropuesta({
  consulta,
  correoPerfil,
}: {
  consulta: Consulta;
  correoPerfil: string;
}) {
  const [destino, setDestino] = useState(correoPerfil);
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok">("idle");
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setEstado("enviando");
    setError(null);
    try {
      const res = await fetch("/api/propuesta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...consulta, destino: destino.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudo enviar");
      setEstado("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setEstado("idle");
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <Seccion titulo="Enviar propuesta" />
      <p className="mb-2 text-[12.5px] text-faint">
        Correo personalizado con el producto recomendado, la cuota, el total a pagar y cómo
        aprovecharlo según esta situación.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="destino">Destinatario</Label>
          <Input
            id="destino"
            type="email"
            value={destino}
            onChange={(ev) => {
              setDestino(ev.target.value);
              setEstado("idle");
            }}
          />
        </div>
        <Button onClick={enviar} disabled={estado === "enviando" || !destino.trim()}>
          {estado === "enviando" ? (
            <Loader2 aria-hidden className="animate-spin" />
          ) : estado === "ok" ? (
            <Check aria-hidden />
          ) : (
            <Mail aria-hidden />
          )}
          {estado === "enviando" ? "Enviando..." : estado === "ok" ? "Enviado" : "Enviar por correo"}
        </Button>
      </div>
      {error ? (
        <FieldHint error className="mt-2">
          {error}
        </FieldHint>
      ) : estado === "ok" ? (
        <FieldHint className="mt-2">Propuesta enviada a {destino}.</FieldHint>
      ) : null}
    </div>
  );
}

function Seccion({ titulo, tono }: { titulo: string; tono?: "alerta" }) {
  return (
    <p
      className={cn(
        "mb-1 mt-4 text-[11px] font-bold uppercase tracking-[0.05em] first:mt-0",
        tono === "alerta" ? "text-riesgo-alto" : "text-brand"
      )}
    >
      {titulo}
    </p>
  );
}

function Metrica({ valor, label, chico }: { valor: string; label: string; chico?: boolean }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line bg-surface-2 p-3 text-center">
      <p className={cn("tabular font-extrabold", chico ? "text-[15px]" : "text-[20px]")}>{valor}</p>
      <p className="mt-0.5 text-[11.5px] text-faint">{label}</p>
    </div>
  );
}

function Punto({ children, tono }: { children: React.ReactNode; tono?: "alerta" }) {
  return (
    <li className="relative border-b border-dashed border-line py-1.5 pl-5 text-[13.5px] last:border-b-0">
      <span
        aria-hidden
        className={cn(
          "absolute left-1 top-[13px] size-[7px] rounded-full",
          tono === "alerta" ? "bg-riesgo-alto" : "bg-brand"
        )}
      />
      {children}
    </li>
  );
}

// `insumo` solo se pasa en los 5 campos que el brief define como entrada del
// usuario: ahi el badge distingue si el dato vino del archivo o lo puso el
// motor. En el resto de variables (siempre exogenas) el badge seria ruido.
function Row({ k, v, insumo }: { k: string; v: string; insumo?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-2 text-[14px] last:border-b-0">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className="m-0 text-right font-semibold">
        {v}
        {insumo !== undefined && (
          <span
            className={cn(
              "ml-2 inline-block rounded-full border px-1.5 py-px align-middle text-[9.5px] font-bold uppercase tracking-[0.04em]",
              insumo
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface-2 text-faint"
            )}
            title={
              insumo
                ? "Dato que trajiste en tu insumo"
                : "Variable exógena aportada por el motor"
            }
          >
            {insumo ? "insumo" : "enriquecido"}
          </span>
        )}
      </dd>
    </div>
  );
}
