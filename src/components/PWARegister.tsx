"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWARegister() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // ── Service Worker Registration ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        registrationRef.current = registration;

        if (registration.waiting) setHasUpdate(true);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setHasUpdate(true);
            }
          });
        });
      } catch (err) {
        console.warn("Service Worker registration failed:", err);
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  // ── Install Prompt ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const alreadyDismissed = sessionStorage.getItem("pwa-install-dismissed");
    if (alreadyDismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show the banner after a brief delay
      setTimeout(() => setShowInstallBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  const handleUpdate = () => {
    registrationRef.current?.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      {/* ── Update Available Banner ──────────────────────────────────────── */}
      {hasUpdate && (
        <div className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-2xl shadow-black/40">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
              <RefreshCw className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Nueva versión disponible</p>
              <p className="text-[11px] text-slate-400">Actualizá para obtener las últimas mejoras.</p>
            </div>
            <button
              onClick={handleUpdate}
              className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors"
            >
              Actualizar
            </button>
          </div>
        </div>
      )}

      {/* ── Install App Banner ───────────────────────────────────────────── */}
      {showInstallBanner && !dismissed && (
        <div className="fixed bottom-20 left-4 right-4 z-[100] mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-2xl shadow-black/40">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/10">
              <Download className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Instalar FrontStock</p>
              <p className="text-[11px] text-slate-400">Acceso rápido desde tu pantalla de inicio.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleInstall}
                className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
              >
                Instalar
              </button>
              <button
                onClick={handleDismiss}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
