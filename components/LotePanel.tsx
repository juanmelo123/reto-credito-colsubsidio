"use client";

import { useMemo, useRef, useState } from "react";
import type { EnrichResponse, Proposito, PerfilCompleto } from "@/lib/types";
import { generarCedulasEjemplo } from "@/lib/synthetic";
import { formatCOP, formatCOPCompact, formatPercent } from "@/lib/format";
import { RiskBadge, CatBadge, DistBars } from "./shared";

const PROPOSITOS: { value: Proposito; label: string }[] = [
  { value: "auto", label: "Automatico (mejor encaje)" },
  { value: "consumo", label: "Consumo / compras" },
  { value: "libre", label: "Libre inversion" },
  { value: "vivienda", label: "Vivienda" },
  { value: "educacion", label: "Educacion" },
  { value: "unificar", label: "Unificar deudas" },
  { value: "seguros_impuestos", label: "Seguros e impuestos" },
];

type SortKey =
  | "cedula"
  | "nombre"
  | "categoria"
  | "ingreso"
  | "dti"
  | "score"
  | "producto"
  | "monto";

export default function LotePanel() {
  const [texto, setTexto] = useState("");
  const [proposito, setProposito] = useState<Proposito>("auto");
  const [data, setData] = useState<EnrichResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCedulas(t: string): string[] {
    const tokens = t.split(/[^\d]+/).filter((x) => x.length >= 6 && x.length <= 10);
    return Array.from(new Set(tokens));
  }

  const cedulasDetectadas = useMemo(() => parseCedulas(texto).length, [texto]);

  function usarEjemplo(n: number) {
    setTexto(generarCedulasEjemplo(n).join("\n"));
    setFileName(null);
    setData(null);
  }

  function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTexto(String(reader.result ?? ""));
      setFileName(file.name);
      setData(null);
    };
    reader.readAsText(file);
  }

  async function procesar() {
    const cedulas = parseCedulas(texto);
    if (cedulas.length === 0) {
      setError("No se detectaron cedulas (numeros de 6 a 10 digitos) en el insumo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cedulas, proposito }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en la consulta");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const mapped = data.results.map((p) => flatten(p));
    const dir = sortDir === "asc" ? 1 : -1;
    return mapped.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "nombre" || key === "cedula" || key === "producto" ? "asc" : "desc");
    }
  }

  function exportCSV() {
    if (!data) return;
    const header = [
      "cedula",
      "nombre",
      "ciudad",
      "correo",
      "genero",
      "edad",
      "vinculo",
      "antiguedad_meses",
      "ingreso_estimado",
      "categoria",
      "score_buro",
      "entidades_deuda",
      "saldo_deuda_externa",
      "cuota_deudas",
      "mora_dias",
      "dti",
      "score_aprobacion",
      "riesgo",
      "elegible",
      "producto_recomendado",
      "monto_sugerido",
    ];
    const lines = data.results.map((p) => {
      const e = p.exogenos;
      const r = p.recomendacion;
      return [
        e.cedula,
        `"${e.nombre}"`,
        e.ciudad,
        e.correo,
        e.genero,
        e.edad,
        `"${e.tipoContrato}"`,
        e.antiguedadMeses,
        e.ingresoEstimado,
        e.categoriaAfiliacion,
        e.scoreBuro,
        e.entidadesConDeuda,
        e.saldoDeudaExterna,
        e.cuotaMensualDeudas,
        e.moraDias,
        r.dti.toFixed(3),
        r.score,
        r.nivelRiesgo,
        r.elegible ? "SI" : "NO",
        `"${r.nombreProducto}"`,
        r.montoSugerido,
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "perfiles-enriquecidos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="card card-pad">
        <label className="field-label" htmlFor="lote">
          Insumo: cedulas (una por linea, separadas por coma, o pega/sube un CSV)
        </label>
        <textarea
          id="lote"
          placeholder={"1024587963\n52830147\n79004521\n..."}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setFileName(null);
          }}
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            Subir CSV / TXT
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFile}
            style={{ display: "none" }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => usarEjemplo(500)}>
            Ejemplo 500
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => usarEjemplo(2000)}>
            Ejemplo 2.000
          </button>
          <div className="spacer" />
          <select
            value={proposito}
            onChange={(e) => setProposito(e.target.value as Proposito)}
            style={{ width: "auto", padding: "8px 12px", fontSize: 13 }}
          >
            {PROPOSITOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={procesar} disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Procesando..." : "Procesar lote"}
          </button>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <p className="hint" style={{ margin: 0 }}>
            {fileName ? `Archivo: ${fileName} · ` : ""}
            {cedulasDetectadas} cedula(s) detectada(s) en el insumo.
          </p>
        </div>
        {error && <div className="error-box">{error}</div>}
      </div>

      {data && (
        <div style={{ marginTop: 20 }}>
          <div className="stats">
            <Stat value={String(data.resumen.total)} label="Perfiles procesados" accent />
            <Stat
              value={`${data.resumen.elegibles}`}
              label={`Elegibles (${formatPercent(
                data.resumen.total ? data.resumen.elegibles / data.resumen.total : 0
              )})`}
            />
            <Stat value={String(data.resumen.noElegibles)} label="No elegibles" />
            <Stat value={formatCOPCompact(data.resumen.ingresoPromedio)} label="Ingreso promedio" />
          </div>

          <div className="dist-grid">
            <div className="card card-pad">
              <p className="card-title">Producto recomendado</p>
              <DistBars data={data.resumen.distribucionProducto} />
            </div>
            <div className="card card-pad">
              <p className="card-title">Categoria</p>
              <DistBars data={data.resumen.distribucionCategoria} color="var(--accent)" />
            </div>
            <div className="card card-pad">
              <p className="card-title">Nivel de riesgo</p>
              <DistBars data={data.resumen.distribucionRiesgo} color="#5b7fa6" />
            </div>
          </div>

          <div className="toolbar">
            <span className="count-pill">{rows.length} resultados</span>
            <div className="spacer" />
            <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
              Exportar CSV enriquecido
            </button>
          </div>

          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <Th k="cedula" cur={sortKey} dir={sortDir} onClick={toggleSort}>
                    Cedula
                  </Th>
                  <Th k="nombre" cur={sortKey} dir={sortDir} onClick={toggleSort}>
                    Nombre
                  </Th>
                  <Th k="categoria" cur={sortKey} dir={sortDir} onClick={toggleSort}>
                    Cat.
                  </Th>
                  <Th k="ingreso" cur={sortKey} dir={sortDir} onClick={toggleSort} num>
                    Ingreso est.
                  </Th>
                  <Th k="dti" cur={sortKey} dir={sortDir} onClick={toggleSort} num>
                    DTI
                  </Th>
                  <Th k="score" cur={sortKey} dir={sortDir} onClick={toggleSort} num>
                    Score
                  </Th>
                  <th>Riesgo</th>
                  <Th k="producto" cur={sortKey} dir={sortDir} onClick={toggleSort}>
                    Producto recomendado
                  </Th>
                  <Th k="monto" cur={sortKey} dir={sortDir} onClick={toggleSort} num>
                    Monto
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.cedula}>
                    <td className="t-muted num">{row.cedula}</td>
                    <td className="t-name">{row.nombre}</td>
                    <td>
                      <CatBadge cat={row.categoria} />
                    </td>
                    <td className="t-num">{formatCOP(row.ingreso)}</td>
                    <td className="t-num">{formatPercent(row.dti)}</td>
                    <td className="t-num">{row.score}</td>
                    <td>
                      {row.elegible ? (
                        <RiskBadge nivel={row.riesgo} />
                      ) : (
                        <span className="badge badge-alto">No elegible</span>
                      )}
                    </td>
                    <td>{row.producto}</td>
                    <td className="t-num">{row.monto > 0 ? formatCOP(row.monto) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type FlatRow = {
  cedula: string;
  nombre: string;
  categoria: string;
  ingreso: number;
  dti: number;
  score: number;
  producto: string;
  monto: number;
  riesgo: PerfilCompleto["recomendacion"]["nivelRiesgo"];
  elegible: boolean;
};

function flatten(p: PerfilCompleto): FlatRow {
  return {
    cedula: p.exogenos.cedula,
    nombre: p.exogenos.nombre,
    categoria: p.exogenos.categoriaAfiliacion,
    ingreso: p.exogenos.ingresoEstimado,
    dti: p.recomendacion.dti,
    score: p.recomendacion.score,
    producto: p.recomendacion.elegible ? p.recomendacion.nombreProducto : "No elegible",
    monto: p.recomendacion.montoSugerido,
    riesgo: p.recomendacion.nivelRiesgo,
    elegible: p.recomendacion.elegible,
  };
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="stat">
      <div className={`sv num ${accent ? "sacc" : ""}`}>{value}</div>
      <div className="sl">{label}</div>
    </div>
  );
}

function Th({
  k,
  cur,
  dir,
  onClick,
  num,
  children,
}: {
  k: SortKey;
  cur: SortKey;
  dir: "asc" | "desc";
  onClick: (k: SortKey) => void;
  num?: boolean;
  children: React.ReactNode;
}) {
  const active = k === cur;
  return (
    <th
      onClick={() => onClick(k)}
      style={{ textAlign: num ? "right" : "left" }}
      title="Ordenar"
    >
      {children}
      {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
