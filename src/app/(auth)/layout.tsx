export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex">
            {/* Panel izquierdo - Branding visual */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0066FF] via-[#0052CC] to-[#003D99] relative overflow-hidden">
                <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
                    <div className="max-w-md">
                        {/* Logo */}
                        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-black/20">
                            <img src="/logo.png" alt="FrontStock" className="w-14 h-14" />
                        </div>

                        <h1 className="text-4xl font-bold mb-3">FrontStock</h1>
                        <p className="text-xl text-white/80 mb-10">
                            La plataforma inteligente para gestionar tu inventario
                        </p>

                        {/* Features */}
                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Control Total</h3>
                                    <p className="text-sm text-white/70">Gestiona stock, ventas y compras en un solo lugar</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Reportes en Tiempo Real</h3>
                                    <p className="text-sm text-white/70">Visualiza métricas y toma decisiones informadas</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Seguro y Confiable</h3>
                                    <p className="text-sm text-white/70">Tus datos protegidos con la mejor tecnología</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Panel derecho - Formulario */}
            <div className="w-full lg:w-1/2 flex items-center justify-center bg-[#0a0a0f] p-8 relative">
                {/* Sutil efecto de fondo */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#0066FF]/10 via-transparent to-transparent" />

                <div className="relative z-10 w-full max-w-md">
                    {children}
                </div>
            </div>
        </div>
    );
}
