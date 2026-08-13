import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

/// Una sola familia para toda la app. Manrope es geométrica y cálida: se lee
/// bien en un celular a las 7 de la mañana y no parece plantilla.
const texto = Manrope({
  subsets: ["latin"],
  variable: "--fuente-texto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Servicios verificados",
  description:
    "Resuelve lo que necesitas en tu casa o tu empresa, con personas verificadas, precio conocido y respaldo.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO" className={texto.variable}>
      <body>{children}</body>
    </html>
  );
}
