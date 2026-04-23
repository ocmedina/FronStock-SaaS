'use client';

import Image from 'next/image';

export default function DashboardLoading() {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
            {/* Animated logo */}
            <div className="relative flex items-center justify-center">
                {/* Pulsing ring */}
                <div className="absolute h-28 w-28 rounded-full border-2 border-blue-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute h-24 w-24 rounded-full border border-blue-500/10 animate-pulse" />

                {/* Logo */}
                <div className="relative h-20 w-20 animate-[bounce-subtle_2s_ease-in-out_infinite]">
                    <Image
                        src="/logo.png"
                        alt="FrontStock"
                        fill
                        className="object-contain drop-shadow-lg"
                        priority
                    />
                </div>
            </div>

            {/* Text */}
            <div className="mt-8 flex flex-col items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground tracking-wide">
                    FrontStock
                </h2>
                <p className="text-sm text-muted-foreground animate-pulse">
                    Cargando tu espacio de trabajo...
                </p>
            </div>

            {/* Loading bar */}
            <div className="mt-6 w-48 h-1 bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full"
                    style={{
                        animation: 'loading-bar 1.5s ease-in-out infinite',
                        backgroundSize: '200% 100%',
                    }}
                />
            </div>

            <style jsx>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes loading-bar {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }
            `}</style>
        </div>
    );
}
