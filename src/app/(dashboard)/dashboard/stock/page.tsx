"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  StockKPIs,
  StockChart,
  StockFilters,
  StockHistoryTable,
  StockMovementModal,
  Product,
  StockMovement,
} from "@/components/stock";

export default function StockMovementsPage() {
  const { organizationId, profile, isLoading: orgLoading } = useOrganization();
  const { canCreate } = usePermissions();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState({ type: "all", productId: "" });

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    let query = supabase
      .from("stock_movements")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (filter.type !== "all") {
      query = query.eq("movement_type", filter.type);
    }
    if (filter.productId) {
      query = query.eq("product_id", filter.productId);
    }

    const { data: movementsData } = await query;
    if (movementsData) setMovements(movementsData);

    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, stock")
      .eq("organization_id", organizationId)
      .order("name");
    if (productsData) setProducts(productsData);

    setIsLoading(false);
  }, [organizationId, filter, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  const handleOpenModal = () => {
    if (products.length === 0) return;
    setShowModal(true);
  };

  const handleSave = async (formData: any) => {
    const { createStockMovement } = await import("@/actions/stock");
    const result = await createStockMovement(formData);

    if (result.error) {
      toast.error(result.error);
      throw new Error(result.error);
    }

    toast.success("Movimiento registrado");
    setShowModal(false);
    fetchData();
  };

  // Calcular estadísticas para KPIs
  const stats = useMemo(() => {
    const entries = movements.filter((m) => m.movement_type === "entry").length;
    const exits = movements.filter((m) => m.movement_type === "exit").length;
    const adjustments = movements.filter(
      (m) => m.movement_type === "adjustment",
    ).length;
    const totalEntryQty = movements
      .filter((m) => m.quantity > 0)
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalExitQty = movements
      .filter((m) => m.quantity < 0)
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    return { entries, exits, adjustments, totalEntryQty, totalExitQty };
  }, [movements]);

  // Preparar datos para el gráfico
  const chartData = useMemo(() => {
    const last7Days: Record<string, { entries: number; exits: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last7Days[dateStr] = { entries: 0, exits: 0 };
    }

    movements.forEach((m) => {
      const dateStr = m.created_at.split("T")[0];
      if (last7Days[dateStr]) {
        if (m.quantity > 0) {
          last7Days[dateStr].entries += m.quantity;
        } else {
          last7Days[dateStr].exits += Math.abs(m.quantity);
        }
      }
    });

    return Object.entries(last7Days).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("es-AR", { weekday: "short" }),
      entradas: data.entries,
      salidas: data.exits,
    }));
  }, [movements]);

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Movimientos de Stock
          </h1>
          <p className="text-muted-foreground mt-1">
            Historial de entradas, salidas y ajustes
          </p>
        </div>
        {canCreate("stock") && products.length > 0 && (
          <Button
            onClick={handleOpenModal}
            className="shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Nuevo Movimiento
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <StockKPIs stats={stats} productsCount={products.length} />

      {/* Chart */}
      <StockChart data={chartData} />

      {/* Filters */}
      <StockFilters
        filter={filter}
        onFilterChange={(updates) => setFilter({ ...filter, ...updates })}
        products={products}
      />

      {/* Movements Table */}
      <StockHistoryTable movements={movements} />

      {/* Modal */}
      <StockMovementModal
        open={showModal}
        onClose={() => setShowModal(false)}
        products={products}
        onSave={handleSave}
      />
    </div>
  );
}
