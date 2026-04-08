"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Truck, RefreshCw } from "lucide-react";

export default function DeliveryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Delivery Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 p-4 rounded-full bg-red-500/10">
        <Truck className="h-10 w-10 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Error en Reparto</h2>
      <p className="text-slate-400 text-sm mb-1 max-w-xs">
        Ocurrió un problema. Los pedidos offline están seguros en tu dispositivo.
      </p>
      {error.message && (
        <p className="text-xs text-slate-600 mt-1 mb-6 font-mono bg-slate-900 px-3 py-1 rounded-md max-w-xs truncate">
          {error.message}
        </p>
      )}
      <Button
        onClick={reset}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
      >
        <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
      </Button>
    </div>
  );
}
