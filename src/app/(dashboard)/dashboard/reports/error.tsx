"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Reports Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <div className="mb-4 p-3 rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold mb-2">Error al cargar reportes</h2>
      <p className="text-muted-foreground mb-4 max-w-sm">
        No se pudieron cargar los datos de reportes. Intenta con un período diferente o recargá.
      </p>
      <Button onClick={reset} variant="outline">
        <RefreshCw className="h-4 w-4 mr-2" /> Reintentar
      </Button>
    </div>
  );
}
