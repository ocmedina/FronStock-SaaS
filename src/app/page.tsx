import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="FrontStock"
              width={40}
              height={40}
            />
            <span className="text-xl font-bold text-white">FrontStock</span>
          </div>
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative min-h-screen flex items-center">
        {/* Fondo con gradiente sutil */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0066FF]/15 via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Contenido */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066FF]/10 border border-[#0066FF]/30 rounded-full text-[#0066FF] text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-[#0066FF] rounded-full animate-pulse" />
                Sistema de Gestión de Inventario
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                Controla tu negocio con{" "}
                <span className="text-[#0066FF]">FrontStock</span>
              </h1>

              <p className="text-lg text-gray-400 mb-8 max-w-lg">
                La plataforma todo-en-uno para gestionar tu inventario, ventas, proveedores y reportes desde cualquier lugar.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-semibold rounded-xl shadow-lg shadow-[#0066FF]/25 transition-all duration-200 hover:shadow-[#0066FF]/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Comenzar Ahora
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Features Cards */}
            <div className="grid gap-4">
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors">
                <div className="w-12 h-12 bg-[#0066FF]/20 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Control de Stock</h3>
                <p className="text-gray-400 text-sm">Gestiona tu inventario en tiempo real con alertas de stock bajo y movimientos automáticos.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors">
                  <div className="w-10 h-10 bg-[#0066FF]/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-1">Reportes</h3>
                  <p className="text-gray-400 text-xs">Métricas en tiempo real</p>
                </div>

                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors">
                  <div className="w-10 h-10 bg-[#0066FF]/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-[#0066FF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-white mb-1">Ventas</h3>
                  <p className="text-gray-400 text-xs">Facturación simplificada</p>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] transition-colors">
                <div className="w-12 h-12 bg-[#0066FF]/20 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[#0066FF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Multi-Sucursal</h3>
                <p className="text-gray-400 text-sm">Administra múltiples ubicaciones desde una sola cuenta con roles y permisos personalizados.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 py-6 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-600">
            © 2026 FrontStock. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

