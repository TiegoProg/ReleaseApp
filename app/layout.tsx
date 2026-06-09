import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orbita — Agencia de marketing agéntica",
  description:
    "Una agencia de marketing operada por agentes de IA, orquestada por Claude. Visualiza la red orbital de agentes en tiempo real.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
