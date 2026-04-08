"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ShoppingCart } from "lucide-react";

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[POS Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="mb-6 p-4 rounded-full bg-amber-500/10">
        <ShoppingCart className="h-10 w-10 text-amber-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Error en el POS</h2>
      <p className="text-muted-foreground mb-1 max-w-md">
        El punto de venta encontró un problema. Las ventas pendientes en modo offline están a salvo en tu dispositivo.
      </p>
      {error.message && (
        <p className="text-xs text-muted-foreground/60 mt-1 mb-6 font-mono bg-muted px-3 py-1 rounded-md max-w-lg truncate">
          {error.message}
        </p>
      )}
      <Button onClick={reset} size="lg">
        <RefreshCw className="h-4 w-4 mr-2" /> Reiniciar POS
      </Button>
    </div>
  );
}
