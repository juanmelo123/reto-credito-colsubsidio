"use client";

import { useMemo, useRef, useState } from "react";
import { Download, Loader2, Play, Sparkles, Upload, X } from "lucide-react";

import type { EnrichResponse, Proposito, PerfilCompleto } from "@/lib/types";
import { generarCedulasEjemplo } from "@/lib/synthetic";
import { parsearInsumo } from "@/lib/insumo";
import { loteDemoComoCsv } from "@/lib/demo";
import { formatCOP, formatCOPCompact, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label, Textarea, FieldHint } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge, Card, CardBody, CardTitle } from "@/components/ui/card";
import AfinidadPortafolio from "./AfinidadPortafolio";
import { RiskBadge, DistBars } from "./shared";

const PROPOSITOS: { value: Proposito; label: string }[] = [
  { value: "auto", label: "Automatico (mayor afinidad)" },
  { value: "consumo", label: "Consumo / compras" },
  { value: "libre", label: "Libre inversion" },
  { value: "vivienda", label: "Vivienda" },
  { value: "educacion", label: "Educacion" },
  { value: "unificar", label: "Unificar deudas" },
  { value: "complementario", label: "Credito complementario" },
  { value: "seguros_impuestos", label: "Seguros e impuestos" },
];

const LABEL_COLUMNA: Record<string, string> = {
  cedula: "cedula",
  nombre: "nombre",
  correo: "correo",
  direccion: "direccion",
  categoriaAfiliacion: "categoria",
};

type SortKey =
  | "cedula"
  | "nombre"
  | "categoria"
  | "ingreso"
  | "dti"
  | "score"
  | "afinidad"
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
  // Cedula cuya afinidad esta desplegada: el analista revisa un caso sin salir
  // de la tabla ni perder el orden en el que venia trabajando.
  const [detalle, setDetalle] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Lee el insumo tal como lo trae el usuario: CSV con encabezado o lista pelada.
  const insumo = useMemo(() => parsearInsumo(texto), [texto]);
  const columnasExtra = insumo.columnasDetectadas.filter((c) => c !== "cedula");

  function cargar(contenido: string) {
    setTexto(contenido);
    setFileName(null);
    setData(null);
    setDetalle(null);
    setError(null);
  }

  function handleFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      cargar(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
    // Permite volver a subir el mismo archivo: sin esto el change no dispara.
    ev.target.value = "";
  }

  async function procesar() {
    const { registros } = insumo;
    if (registros.length === 0) {
      setError("No se detectaron cedulas (numeros de 6 a 10 digitos) en el insumo.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registros, proposito }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error en la consulta");
      setData(json);
      setDetalle(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    const mapped = data.results.map(flatten);
    const dir = sortDir === "asc" ? 1 : -1;
    return mapped.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [data, sortKey, sortDir]);

  const perfilDetalle = useMemo(
    () => data?.results.find((p) => p.exogenos.cedula === detalle) ?? null,
    [data, detalle]
  );

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
      "cedula", "nombre", "ciudad", "direccion", "correo", "instagram", "genero", "edad",
      "vinculo", "antiguedad_meses", "ingreso_estimado", "categoria", "score_buro",
      "entidades_deuda", "saldo_deuda_externa", "cuota_deudas", "mora_dias", "dti",
      "score_aprobacion", "riesgo", "elegible", "producto_recomendado", "afinidad",
      "monto_sugerido", "modalidad", "tope_capacidad", "campos_del_insumo",
    ];
    const lines = data.results.map((p) => {
      const e = p.exogenos;
      const r = p.recomendacion;
      const afinidad = r.productos.find((x) => x.id === r.productoRecomendado)?.afinidad ?? 0;
      return [
        e.cedula, `"${e.nombre}"`, e.ciudad, `"${e.direccion}"`, e.correo, e.instagram ?? "",
        e.genero, e.edad, `"${e.tipoContrato}"`, e.antiguedadMeses, e.ingresoEstimado,
        e.categoriaAfiliacion, e.scoreBuro, e.entidadesConDeuda, e.saldoDeudaExterna,
        e.cuotaMensualDeudas, e.moraDias, r.dti.toFixed(3), r.score, r.nivelRiesgo,
        r.elegible ? "SI" : "NO", `"${r.nombreProducto}"`, afinidad, r.montoSugerido,
        r.modalidad, r.topeMonto, `"${e.camposDeInsumo.join(" ")}"`,
      ].join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    // El BOM hace que Excel en es-CO abra el archivo en UTF-8 sin romper tildes.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "perfiles-enriquecidos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardBody>
          <Label htmlFor="lote">
            Insumo: lista de cedulas, o CSV con encabezado (cedula, nombre, correo, direccion,
            categoria). Las columnas que traigas se respetan; el resto se enriquece.
          </Label>
          <Textarea
            id="lote"
            placeholder={
              "cedula,nombre,correo,direccion,categoria\n1024587963,...\n\n(o solo cedulas, una por linea)"
            }
            value={texto}
            aria-invalid={Boolean(error) || undefined}
            onChange={(e) => {
              setTexto(e.target.value);
              setFileName(null);
              if (error) setError(null);
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="accent" size="sm" onClick={() => cargar(loteDemoComoCsv())}>
              <Sparkles aria-hidden />
              Cargar lote de demostracion
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload aria-hidden />
              Subir CSV / TXT
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFile}
              className="sr-only"
              tabIndex={-1}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cargar(generarCedulasEjemplo(500).join("\n"))}
            >
              500 aleatorias
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cargar(generarCedulasEjemplo(2000).join("\n"))}
            >
              2.000 aleatorias
            </Button>

            <div className="flex-1" />

            <div className="w-[240px]">
              <Select value={proposito} onValueChange={(v) => setProposito(v as Proposito)}>
                <SelectTrigger className="group h-9 text-[13px]" aria-label="Proposito del credito">
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

            <Button onClick={procesar} disabled={loading}>
              {loading ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
              {loading ? "Procesando..." : "Procesar lote"}
            </Button>
          </div>

          <FieldHint error={Boolean(error)} className="mt-3">
            {error ?? (
              <>
                {fileName ? `Archivo: ${fileName} · ` : ""}
                {insumo.registros.length} cedula(s) detectada(s) en el insumo.
                {columnasExtra.length > 0
                  ? ` Columnas propias respetadas: ${columnasExtra
                      .map((c) => LABEL_COLUMNA[c] ?? c)
                      .join(", ")}.`
                  : " Sin columnas propias: todo se enriquece."}
              </>
            )}
          </FieldHint>
        </CardBody>
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
            <Stat value={String(data.resumen.total)} label="Perfiles procesados" acento />
            <Stat
              value={String(data.resumen.elegibles)}
              label={`Elegibles (${formatPercent(
                data.resumen.total ? data.resumen.elegibles / data.resumen.total : 0
              )})`}
            />
            <Stat value={String(data.resumen.noElegibles)} label="No elegibles" />
            <Stat value={formatCOPCompact(data.resumen.ingresoPromedio)} label="Ingreso promedio" />
            <Stat
              value={String(data.resumen.camposDeInsumo)}
              label="Con datos propios del insumo"
            />
          </div>

          <div className="grid gap-3.5 lg:grid-cols-[1.4fr_1fr_1fr]">
            <Card>
              <CardBody>
                <CardTitle>Producto recomendado</CardTitle>
                <DistBars data={data.resumen.distribucionProducto} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardTitle>Categoria</CardTitle>
                <DistBars data={data.resumen.distribucionCategoria} color="var(--color-accent)" />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <CardTitle>Nivel de riesgo</CardTitle>
                <DistBars data={data.resumen.distribucionRiesgo} color="#5b7fa6" />
              </CardBody>
            </Card>
          </div>

          {perfilDetalle && (
            <div className="relative">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-muted">
                  Afinidad de {perfilDetalle.exogenos.nombre}{" "}
                  <span className="font-normal text-faint">({perfilDetalle.exogenos.cedula})</span>
                </p>
                <Button variant="quiet" size="sm" onClick={() => setDetalle(null)}>
                  <X aria-hidden />
                  Cerrar
                </Button>
              </div>
              <AfinidadPortafolio
                productos={perfilDetalle.recomendacion.productos}
                recomendado={perfilDetalle.recomendacion.productoRecomendado}
              />
            </div>
          )}

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-muted">{rows.length} resultados</span>
              <span className="text-[12.5px] text-faint">
                · Clic en una fila para ver su afinidad con los 8 productos
              </span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={exportCSV}>
                <Download aria-hidden />
                Exportar CSV enriquecido
              </Button>
            </div>

            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface shadow-card">
              <table className="w-full min-w-[960px] border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <Th k="cedula" cur={sortKey} dir={sortDir} onClick={toggleSort}>Cedula</Th>
                    <Th k="nombre" cur={sortKey} dir={sortDir} onClick={toggleSort}>Nombre</Th>
                    <Th k="categoria" cur={sortKey} dir={sortDir} onClick={toggleSort}>Cat.</Th>
                    <Th k="ingreso" cur={sortKey} dir={sortDir} onClick={toggleSort} num>Ingreso est.</Th>
                    <Th k="dti" cur={sortKey} dir={sortDir} onClick={toggleSort} num>DTI</Th>
                    <Th k="score" cur={sortKey} dir={sortDir} onClick={toggleSort} num>Score</Th>
                    <th className="border-b border-line bg-surface-2 px-3.5 py-3 text-left text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint">
                      Riesgo
                    </th>
                    <Th k="producto" cur={sortKey} dir={sortDir} onClick={toggleSort}>Producto recomendado</Th>
                    <Th k="afinidad" cur={sortKey} dir={sortDir} onClick={toggleSort} num>Afinidad</Th>
                    <Th k="monto" cur={sortKey} dir={sortDir} onClick={toggleSort} num>Monto</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.cedula}
                      onClick={() => setDetalle((d) => (d === row.cedula ? null : row.cedula))}
                      className={cn(
                        "cursor-pointer transition-colors last:[&>td]:border-b-0",
                        detalle === row.cedula ? "bg-brand-soft" : "hover:bg-surface-2"
                      )}
                    >
                      <Td className="tabular text-muted">{row.cedula}</Td>
                      <Td className="font-semibold">{row.nombre}</Td>
                      <Td><Badge>Cat. {row.categoria}</Badge></Td>
                      <Td num>{formatCOP(row.ingreso)}</Td>
                      <Td num>{formatPercent(row.dti)}</Td>
                      <Td num>{row.score}</Td>
                      <Td>
                        {row.elegible ? (
                          <RiskBadge nivel={row.riesgo} />
                        ) : (
                          <Badge tono="alto">No elegible</Badge>
                        )}
                      </Td>
                      <Td>
                        {row.producto}
                        {row.elegible && (
                          <span className="mt-px block text-[11px] text-faint">{row.modalidad}</span>
                        )}
                      </Td>
                      <Td num>
                        {row.elegible ? (
                          <span
                            className={cn(
                              "font-bold",
                              row.afinidad >= 70 ? "text-brand" : "text-muted"
                            )}
                          >
                            {row.afinidad}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td num>{row.monto > 0 ? formatCOP(row.monto) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
  afinidad: number;
  producto: string;
  monto: number;
  modalidad: string;
  riesgo: PerfilCompleto["recomendacion"]["nivelRiesgo"];
  elegible: boolean;
};

function flatten(p: PerfilCompleto): FlatRow {
  const r = p.recomendacion;
  return {
    cedula: p.exogenos.cedula,
    nombre: p.exogenos.nombre,
    categoria: p.exogenos.categoriaAfiliacion,
    ingreso: p.exogenos.ingresoEstimado,
    dti: r.dti,
    score: r.score,
    afinidad: r.productos.find((x) => x.id === r.productoRecomendado)?.afinidad ?? 0,
    producto: r.elegible ? r.nombreProducto : "No elegible",
    monto: r.montoSugerido,
    modalidad: r.elegible ? r.modalidad : "—",
    riesgo: r.nivelRiesgo,
    elegible: r.elegible,
  };
}

function Stat({ value, label, acento }: { value: string; label: string; acento?: boolean }) {
  return (
    <Card>
      <div className="px-4 py-3.5">
        <p
          className={cn(
            "tabular text-[26px] font-extrabold leading-none tracking-tight",
            acento && "text-brand"
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-[12.5px] text-muted">{label}</p>
      </div>
    </Card>
  );
}

function Td({
  children,
  num,
  className,
}: {
  children: React.ReactNode;
  num?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap border-b border-line px-3.5 py-2.5",
        num && "text-right tabular",
        className
      )}
    >
      {children}
    </td>
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
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "sticky top-0 whitespace-nowrap border-b border-line bg-surface-2 px-3.5 py-3",
        "text-[11.5px] font-bold uppercase tracking-[0.04em] text-faint",
        num ? "text-right" : "text-left"
      )}
    >
      <button
        type="button"
        onClick={() => onClick(k)}
        className="inline-flex items-center gap-1 uppercase tracking-[0.04em] transition-colors hover:text-muted"
        title="Ordenar"
      >
        {children}
        <span aria-hidden className={cn("text-[9px]", !active && "opacity-0")}>
          {dir === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}
