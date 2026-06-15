"use client";

import { useState, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Sidebar from "@/components/Sidebar";
import Noise from "@/components/ui/Noise";
import GridDistortion from "@/components/ui/GridDistortion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // true = modo oscuro (diseño corporativo), false = modo diurno (proyector)
  // Arranca sin valor para evitar el flash hasta que el efecto se ejecute
  const [isDark, setIsDark] = useState<boolean | null>(null);

  // Al montar: leemos la preferencia guardada, o usamos oscuro por defecto
  useEffect(() => {
    const saved = localStorage.getItem("hypergraph.theme");
    if (saved === "light") {
      setIsDark(false);
    } else {
      setIsDark(true); // oscuro por defecto
    }
  }, []);

  // Sincronizamos la clase del <html> y guardamos preferencia
  useEffect(() => {
    if (isDark === null) return;
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
      localStorage.setItem("hypergraph.theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("hypergraph.theme", "light");
    }
  }, [isDark]);

  // Mientras no sabemos el tema, no renderizamos nada (evita flash)
  if (isDark === null) {
    return (
      <html lang="es">
        <body className={`${geistSans.variable} ${geistMono.variable}`} />
      </html>
    );
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-transparent antialiased transition-colors duration-300`}
      >
        {/* Fondo interactivo dinámico acoplado a las variables CSS */}
        <div data-grid-bg className="fixed inset-0 z-0">
          <GridDistortion
            backgroundColor={isDark ? "#09090b" : "#f9f8f6"}
            lineColor={
              isDark ? "rgba(255, 255, 255, 0.075)" : "rgba(0, 0, 0, 0.06)"
            }
            cellSize={56}
            distortionStrength={0.3}
            className="absolute inset-0 h-full w-full"
          />
        </div>

        <Noise
          className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        />

        {/* ── TOGGLE DÍA / NOCHE ── */}
        <button
          onClick={() => setIsDark((prev) => !prev)}
          aria-label={isDark ? "Cambiar a modo día" : "Cambiar a modo noche"}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer shadow-md transition-all
            bg-hyper-surface border border-hyper-border text-hyper-text
            hover:opacity-80"
        >
          {isDark ? "☀️ Modo Día" : "🌙 Modo Noche"}
        </button>

        <SmoothScroll>
          <div className="relative z-10 flex min-h-screen bg-transparent">
            <Sidebar isDark={isDark} />
            <main className="flex-1 ml-20 relative min-h-screen">
              {/* Gradiente de fondo adaptativo. Reservamos solo la franja del
                  sidebar colapsado (ml-20); el sidebar expandido por hover se
                  superpone al contenido sin reorganizarlo. */}
              <div
                data-radial-bg
                className="fixed inset-0 ml-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#D18400]/10 via-transparent to-transparent pointer-events-none z-0"
              />
              {children}
            </main>
          </div>
        </SmoothScroll>
      </body>
    </html>
  );
}
