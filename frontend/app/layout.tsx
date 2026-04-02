import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import Sidebar from "@/components/Sidebar";

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
      <body className={`${geistSans.variable} ${geistMono.variable} bg-hyper-bg text-zinc-100 antialiased`}>
        <SmoothScroll>
          <div className="flex min-h-screen bg-hyper-bg text-zinc-100">
            <Sidebar />
            <main className="flex-1 ml-64 relative min-h-screen">
              <div className="fixed inset-0 ml-64 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-hyper-accent/10 via-transparent to-transparent pointer-events-none z-0"></div>
              {children}
            </main>
          </div>
        </SmoothScroll>
      </body>
    </html>
  );
}