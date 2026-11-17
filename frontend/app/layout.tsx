import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

// Tipografía de toda la interfaz (spec 004, E4; CA-UI-01): moderna y legible, autoalojada por next/font.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Mercado de Abastos", template: "%s · Mercado de Abastos" },
  description: "Marketplace multivendedor del mercado de abastos: productos frescos de varios puestos en un solo lugar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      {/* En móvil, la barra inferior (CA-UI-03) es fija: el espacio inferior evita que tape el contenido. */}
      <body className="flex min-h-full flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
