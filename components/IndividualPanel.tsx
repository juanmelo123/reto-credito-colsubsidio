"use client";

import { useState } from "react";
import type { PerfilCompleto, Proposito } from "@/lib/types";
import { formatCOP, formatPercent } from "@/lib/format";
import { RiskBadge, CatBadge, ScoreGauge } from "./shared";

const PROPOSITOS: { value: Proposito; label: string }[] = [
  { value: "auto", label: "Automatico (mejor encaje)" },
  { value: "consumo", label: "Consumo / compras" },
  { value: "libre", label: "Libre inversion" },
  { value: "vivienda", label: "Vivienda" },
  { value: "educacion", label: "Educacion" },
  { value: "unificar", label: "Unificar deudas" },
  { value: "seguros_impuestos", label: "Seguros e impuestos" },
];

export default function IndividualPanel() {
  const [cedula, setCedula] = useState("");
  const [proposito, setProposito] = useState<Proposito>("auto");
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
        body: JSON.stringify({ cedulas: [c], proposito }),
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
              placeholder="Ej: 1024587963"
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
        <p className="hint">
          Datos sinteticos y deterministas: la misma cedula devuelve siempre el mismo perfil.
          Casos de ejemplo — <code>538470559</code> (compra de cartera),{" "}
          <code>128813890</code> (libre inversion sin historial) y <code>452792170</code>{" "}
          (credito mujer).
        </p>
        {error && <div className="error-box">{error}</div>}
      </div>

      {data && <Resultado data={data} />}
    </div>
  );
}

function Resultado({ data }: { data: PerfilCompleto }) {
  const { exogenos: e, recomendacion: r } = data;
  return (
    <div className="result-grid">
      {/* --- Perfil enriquecido --- */}
      <div className="card card-pad">
        <p className="card-title">Perfil enriquecido · variables exogenas</p>

        <div className="section-label">Identidad y contacto</div>
        <div className="data-list">
          <Row k="Nombre" v={e.nombre} />
          <Row k="Cedula" v={`${e.cedula}${e.cedulaValida ? "" : " (formato invalido)"}`} />
          <Row k="Edad / Genero" v={`${e.edad} anios · ${e.genero === "F" ? "Femenino" : "Masculino"}`} />
          <Row k="Ciudad" v={e.ciudad} />
          <Row k="Correo" v={e.correo} />
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
                  Monto sugerido: <b>{formatCOP(r.montoSugerido)}</b>
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

        {r.productosElegibles.length > 1 && (
          <>
            <div className="section-label">Otros productos elegibles</div>
            <div className="chips">
              {r.productosElegibles
                .filter((p) => p.id !== r.productoRecomendado)
                .map((p) => (
                  <span className="chip" key={p.id}>
                    {p.nombre} <b>{formatCOP(p.montoSugerido)}</b>
                    <span className="enc">encaje {p.encaje}</span>
                  </span>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="data-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
