import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motor de Enriquecimiento Crediticio — Reto Colsubsidio x 30X",
  description:
    "Prototipo que enriquece perfiles a partir de la cedula con variables exogenas sinteticas y recomienda un producto de credito del portafolio Colsubsidio.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
