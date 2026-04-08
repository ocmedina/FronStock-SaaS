"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="mb-6 p-4 rounded-full bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Algo salió mal</h2>
      <p className="text-muted-foreground mb-1 max-w-md">
        Ocurrió un error inesperado en esta sección. Tu información está a salvo.
      </p>
      {error.message && (
        <p className="text-xs text-muted-foreground/60 mt-1 mb-6 font-mono bg-muted px-3 py-1 rounded-md max-w-lg truncate">
          {error.message}
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
          <Home className="h-4 w-4 mr-2" /> Ir al inicio
        </Button>
        <Button onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
        </Button>
      </div>
    </div>
  );
}
