"use client";

import { useState } from "react";
import IndividualPanel from "@/components/IndividualPanel";
import LotePanel from "@/components/LotePanel";

export default function Home() {
  const [tab, setTab] = useState<"individual" | "lote">("individual");

  return (
    <>
      <header className="appbar">
        <div className="appbar-inner">
          <div className="logo" aria-hidden />
          <div>
            <h1>Motor de Enriquecimiento Crediticio</h1>
            <p className="sub">Reto Credito · Hackathon Colsubsidio x 30X</p>
          </div>
          <div className="spacer" />
          <span className="env">Datos sinteticos</span>
        </div>
      </header>

      <main className="container">
        <div className="disclaimer">
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
            🔒
          </span>
          <div>
            <strong>Prototipo con datos 100% sinteticos y deterministas.</strong> No se consulta
            ni almacena informacion real de personas. Cada cedula genera un perfil simulado,
            reproducible, que emula lo que devolveria un buro o una fuente externa (Habeas Data —
            Ley 1581).
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button
            className={`tab ${tab === "individual" ? "active" : ""}`}
            onClick={() => setTab("individual")}
            role="tab"
            aria-selected={tab === "individual"}
          >
            Consulta individual
          </button>
          <button
            className={`tab ${tab === "lote" ? "active" : ""}`}
            onClick={() => setTab("lote")}
            role="tab"
            aria-selected={tab === "lote"}
          >
            Consulta por lote
          </button>
        </div>

        {tab === "individual" ? <IndividualPanel /> : <LotePanel />}
      </main>

      <footer className="footer">
        Prototipo demostrativo · El portafolio (cupo rotativo, libre inversion, hipotecario,
        educativo, compra de cartera, credito mujer, seguros e impuestos) y las categorias A–D
        siguen el brief del reto. Motores de datos y decision configurables en <code>/lib</code>.
      </footer>
    </>
  );
}
