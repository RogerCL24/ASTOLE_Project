import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import DashboardLayout from "@/components/Sidebar";

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
          <DashboardLayout>
            {children}
          </DashboardLayout>
        </SmoothScroll>
      </body>
    </html>
  );
}