"use client";

import { useEffect, useRef, useState } from "react";

export function PWARegister() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        registrationRef.current = registration;

        if (registration.waiting) {
          setHasUpdate(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setHasUpdate(true);
            }
          });
        });
      } catch (error) {
        console.warn("Service worker registration failed", error);
      }
    };

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    window.addEventListener("load", register);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("load", register);
    };
  }, []);

  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-xl">
      <p className="mb-2">Hay una nueva versión disponible.</p>
      <button
        type="button"
        onClick={() => registrationRef.current?.waiting?.postMessage({ type: "SKIP_WAITING" })}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
      >
        Actualizar ahora
      </button>
    </div>
  );
}
