import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agencia — marketing agéntico",
  description:
    "Una agencia de marketing operada por agentes de IA. Cada área es una sala viva: te dice qué hace, te pide decisiones y la dirige en tiempo real. Orquestada por Claude.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* Fuentes cargadas en runtime (sin dependencia de red en build) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
