"use client"
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-hyper-bg text-zinc-100">
      
      {/* Sidebar Fija (fixed top-0 left-0 h-screen) */}
      <nav className="w-64 border-r border-hyper-border bg-hyper-surface p-6 flex flex-col justify-between fixed top-0 left-0 h-screen z-20">
        <div>
          <div className="mb-10">
            <h1 className="text-xl font-bold tracking-widest text-white">ASTOLE</h1>
            <p className="text-xs text-hyper-accent mt-1">powered by Hypergraph</p>
          </div>
          
          <ul className="space-y-4">
            <li>
              <Link href="/" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-hyper-accent"></span>
                Triaje en Vivo (Capa 1)
              </Link>
            </li>
            <li>
              <Link href="/investigacion" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-zinc-700"></span>
                Chat RAG (Capa 2)
              </Link>
            </li>
            <li className="pt-6 mt-6 border-t border-white/5">
              <Link href="/telemetria" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Telemetría & KPIs
              </Link>
            </li>
          </ul>
        </div>
        
        {/* Status de la Ingesta */}
        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
          <p className="text-xs text-zinc-500 mb-2">Estado del Motor</p>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm">Ingesta Activa (60s)</span>
          </div>
        </div>
      </nav>

      {/* Área de Contenido Principal (ml-64 empuja el contenido para no pisar la sidebar) */}
      <main className="flex-1 ml-64 relative min-h-screen">
        <div className="fixed inset-0 ml-64 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-hyper-accent/10 via-transparent to-transparent pointer-events-none z-0"></div>
        {children}
      </main>

    </div>
  )
}