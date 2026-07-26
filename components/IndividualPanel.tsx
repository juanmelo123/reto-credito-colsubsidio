"use client";

import { useState } from "react";
import type { PerfilCompleto, Proposito, CampoInsumo } from "@/lib/types";
import { formatCOP, formatPercent } from "@/lib/format";
import { RiskBadge, CatBadge, ScoreGauge } from "./shared";

const PROPOSITOS: { value: Proposito; label: string }[] = [
  { value: "auto", label: "Automatico (mejor encaje)" },
  { value: "consumo", label: "Consumo / compras" },
  { value: "libre", label: "Libre inversion" },
  { value: "vivienda", label: "Vivienda" },
  { value: "educacion", label: "Educacion" },
  { value: "unificar", label: "Unificar deudas" },
  { value: "complementario", label: "Credito complementario" },
  { value: "seguros_impuestos", label: "Seguros e impuestos" },
];

export default function IndividualPanel() {
  const [cedula, setCedula] = useState("");
  const [proposito, setProposito] = useState<Proposito>("auto");
  // Campos del insumo del brief: opcionales. Lo que se llene NO se sintetiza.
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [direccion, setDireccion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [verInsumo, setVerInsumo] = useState(false);
  const [data, setData] = useState<PerfilCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function consultar() {
    const c = cedula.trim();
    if (!c) {
      setError("Ingresa una cedula.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registros: [
            {
              cedula: c,
              nombre: nombre.trim() || undefined,
              correo: correo.trim() || undefined,
              direccion: direccion.trim() || undefined,
              categoriaAfiliacion: categoria || undefined,
            },
          ],
          proposito,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en la consulta");
      setData(json.results[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") consultar();
  }

  return (
    <div>
      <div className="card card-pad">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 240px" }}>
            <label className="field-label" htmlFor="ced">
              Cedula
            </label>
            <input
              id="ced"
              type="text"
              inputMode="numeric"
              placeholder="Ej: 1028404676"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              onKeyDown={onKey}
            />
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label className="field-label" htmlFor="prop">
              Proposito del credito
            </label>
            <select
              id="prop"
              value={proposito}
              onChange={(e) => setProposito(e.target.value as Proposito)}
            >
              {PROPOSITOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={consultar} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Consultando..." : "Enriquecer y perfilar"}
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 12 }}
          onClick={() => setVerInsumo((v) => !v)}
          aria-expanded={verInsumo}
        >
          {verInsumo ? "Ocultar" : "Agregar"} datos que ya tengo (opcional)
        </button>

        {verInsumo && (
          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: "1 1 200px" }}>
              <label className="field-label" htmlFor="in-nombre">
                Nombre
              </label>
              <input
                id="in-nombre"
                value={nombre}
                onChange={(ev) => setNombre(ev.target.value)}
                placeholder="Se enriquece si lo dejas vacio"
              />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label className="field-label" htmlFor="in-correo">
                Correo
              </label>
              <input
                id="in-correo"
                value={correo}
                onChange={(ev) => setCorreo(ev.target.value)}
                placeholder="Se enriquece si lo dejas vacio"
              />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label className="field-label" htmlFor="in-dir">
                Direccion
              </label>
              <input
                id="in-dir"
                value={direccion}
                onChange={(ev) => setDireccion(ev.target.value)}
                placeholder="Se enriquece si lo dejas vacio"
              />
            </div>
            <div style={{ flex: "0 1 160px" }}>
              <label className="field-label" htmlFor="in-cat">
                Categoria afiliacion
              </label>
              <select id="in-cat" value={categoria} onChange={(ev) => setCategoria(ev.target.value)}>
                <option value="">Inferir del ingreso</option>
                <option value="A">A (hasta 2 SMMLV)</option>
                <option value="B">B (2 a 4 SMMLV)</option>
                <option value="C">C (mas de 4 SMMLV)</option>
                <option value="D">D (no afiliado)</option>
              </select>
            </div>
          </div>
        )}

        <p className="hint">
          Datos sinteticos y deterministas: la misma cedula devuelve siempre el mismo perfil.
          Casos de ejemplo — <code>1028404676</code> (compra de cartera, 4 entidades),{" "}
          <code>1051570194</code> (ingreso bajo 1 SMMLV: tope de $1.500.000),{" "}
          <code>1022383083</code> (hipotecario, categoria C) y <code>28247876</code> (credito
          mujer, pensionada).
        </p>
        {error && <div className="error-box">{error}</div>}
      </div>

      {data && <Resultado data={data} />}
    </div>
  );
}

function Resultado({ data }: { data: PerfilCompleto }) {
  const { exogenos: e, recomendacion: r } = data;
  const delInsumo = (campo: CampoInsumo) => e.camposDeInsumo.includes(campo);
  return (
    <div className="result-grid">
      {/* --- Perfil enriquecido --- */}
      <div className="card card-pad">
        <p className="card-title">Perfil enriquecido · variables exogenas</p>
        {e.camposDeInsumo.length > 0 && (
          <p className="hint" style={{ marginTop: 0 }}>
            {e.camposDeInsumo.length} campo(s) vienen de tu insumo y se respetaron tal cual; el
            resto lo aporta el motor.
          </p>
        )}

        <div className="section-label">Identidad y contacto</div>
        <div className="data-list">
          <Row k="Nombre" v={e.nombre} insumo={delInsumo("nombre")} />
          <Row k="Cedula" v={`${e.cedula}${e.cedulaValida ? "" : " (formato invalido)"}`} insumo />
          <Row k="Edad / Genero" v={`${e.edad} anios · ${e.genero === "F" ? "Femenino" : "Masculino"}`} />
          <Row k="Ciudad" v={e.ciudad} />
          <Row k="Direccion" v={e.direccion} insumo={delInsumo("direccion")} />
          <Row k="Correo" v={e.correo} insumo={delInsumo("correo")} />
          <Row k="Instagram" v={e.instagram ?? "No detectado"} />
          <Row k="LinkedIn" v={e.linkedin ? "Perfil detectado" : "No detectado"} />
        </div>

        <div className="section-label">Laboral e ingreso</div>
        <div className="data-list">
          <Row k="Vinculo" v={e.tipoContrato} />
          <Row k="Antiguedad" v={`${e.antiguedadMeses} meses`} />
          <Row k="Ingreso estimado" v={formatCOP(e.ingresoEstimado)} />
          <Row
            k="Categoria afiliacion"
            v={e.afiliado ? `Categoria ${e.categoriaAfiliacion}` : "No afiliado (D)"}
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
        </div>

        <div className="section-label">Senales de mercado</div>
        <div className="data-list">
          <Row k="Score de buro (sim.)" v={`${e.scoreBuro} / 950`} />
          <Row k="Entidades con deuda" v={`${e.entidadesConDeuda}`} />
          <Row k="Saldo deuda externa" v={formatCOP(e.saldoDeudaExterna)} />
          <Row k="Cuota mensual deudas" v={formatCOP(e.cuotaMensualDeudas)} />
          <Row k="Estado de pago" v={e.moraDias === 0 ? "Al dia" : `Mora ${e.moraDias} dias`} />
          <Row k="Embargos" v={e.embargos ? "Si reporta" : "No"} />
        </div>
      </div>

      {/* --- Recomendacion --- */}
      <div className="card card-pad">
        <p className="card-title">Recomendacion del motor</p>

        {r.elegible && r.productoRecomendado ? (
          <>
            <div className="reco-head">
              <div>
                <div style={{ fontSize: 12.5, color: "var(--faint)", fontWeight: 600 }}>
                  Producto recomendado
                </div>
                <div className="reco-product">{r.nombreProducto}</div>
                <div className="reco-amount">
                  Monto sugerido: <b>{formatCOP(r.montoSugerido)}</b> · {r.modalidad}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <ScoreGauge score={r.score} />
                <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                  Score aprob.
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <RiskBadge nivel={r.nivelRiesgo} />
              <CatBadge cat={e.categoriaAfiliacion} />
            </div>

            <div className="metrics">
              <div className="metric">
                <div className="mv num">{formatPercent(r.dti)}</div>
                <div className="ml">DTI actual</div>
              </div>
              <div className="metric">
                <div className="mv num" style={{ fontSize: 16 }}>
                  {formatCOP(r.capacidadCuota)}
                </div>
                <div className="ml">Cuota adicional/mes</div>
              </div>
              <div className="metric">
                <div className="mv num" style={{ fontSize: 16 }}>
                  {formatCOP(r.topeMonto)}
                </div>
                <div className="ml">Tope por capacidad</div>
              </div>
              <div className="metric">
                <div className="mv num">{e.scoreBuro}</div>
                <div className="ml">Score buro</div>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              background: "var(--risk-alto-soft)",
              border: "1px solid #f3c4c5",
              borderRadius: "var(--radius-sm)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#b02328" }}>
              No elegible por ahora
            </div>
            <div style={{ fontSize: 13.5, color: "#8a4b4b", marginTop: 4 }}>
              El perfil no supera los filtros duros del portafolio.
            </div>
          </div>
        )}

        <div className="section-label" style={{ marginTop: 18 }}>
          Por que
        </div>
        <ul className="reasons">
          {r.razones.map((rz, i) => (
            <li key={i}>{rz}</li>
          ))}
        </ul>

        {r.alertas.length > 0 && (
          <>
            <div className="section-label" style={{ color: "var(--risk-alto)" }}>
              Alertas
            </div>
            <ul className="reasons alerts">
              {r.alertas.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </>
        )}

        {r.productos.length > 1 && (
          <>
            <div className="section-label">Otros productos elegibles</div>
            <div className="chips">
              {r.productos
                .filter((p) => p.aplica && p.id !== r.productoRecomendado)
                .map((p) => (
                  <span className="chip" key={p.id}>
                    {p.nombre} <b>{formatCOP(p.montoSugerido)}</b>
                    <span className="enc">
                      {p.modalidad} · afinidad {p.afinidad}%
                    </span>
                  </span>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// `insumo` solo se pasa en los 5 campos que el brief define como entrada del
// usuario: ahi el badge distingue si el dato vino del archivo o lo puso el
// motor. En el resto de variables (siempre exogenas) el badge seria ruido.
function Row({ k, v, insumo }: { k: string; v: string; insumo?: boolean }) {
  return (
    <div className="data-row">
      <span className="k">{k}</span>
      <span className="v">
        {v}
        {insumo !== undefined && (
          <span
            className={`origen ${insumo ? "origen-insumo" : ""}`}
            title={insumo ? "Dato que trajiste en tu insumo" : "Variable exogena aportada por el motor"}
          >
            {insumo ? "insumo" : "enriquecido"}
          </span>
        )}
      </span>
    </div>
  );
}
