import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "ASTOLE | Triaje Táctico",
  description: "Plataforma de ciberseguridad impulsada por Hypergraph",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-transparent text-zinc-100 antialiased`}>
        <div className="fixed inset-0 z-0">
          <GridDistortion
            backgroundColor="#09090b"
            lineColor="rgba(255, 255, 255, 0.075)"
            cellSize={56}
            distortionStrength={0.5}
            className="absolute inset-0 h-full w-full"
          />
        </div>
		<Noise className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]" />
        <SmoothScroll>
          <div className="relative z-10 flex min-h-screen bg-transparent text-zinc-100">
            <Sidebar />
            <main className="flex-1 ml-72 relative min-h-screen">
              <div className="fixed inset-0 ml-72 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-hyper-accent/10 via-transparent to-transparent pointer-events-none z-0"></div>
              {children}
            </main>
          </div>
        </SmoothScroll>
      </body>
    </html>
  );
}