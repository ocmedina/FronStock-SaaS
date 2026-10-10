"use client";

import { useState, useEffect, useMemo } from "react";
import { useSupabaseTable } from "@/hooks/useSupabaseTable";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts,
  bulkUpdateProducts,
} from "@/actions/products";
import { toast } from "sonner";
import {
  ImportExcelModal,
  type ImportedProduct,
  BulkUpdateModal,
  type BulkUpdateData,
  LabelModal,
  ProductKPIs,
  ProductFilters,
  ProductTable,
  ProductGrid,
  ProductModal,
} from "@/components/products";

export default function ProductsPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { canCreate, canEdit, canDelete, canView } = usePermissions();
  const canViewCost = canView('products:cost_price');

  const {
    data: products,
    isLoading,
    error,
    getAll,
    create,
    update,
    remove,
  } = useSupabaseTable<Product>({ table: "products" });

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);

  // Filter & View States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Cliente solo para combos (product_combos no tiene server action aún)
  const supabase = createClient();

  // KPIs
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0);
  const totalSalesValue = products.reduce((acc, p) => acc + (p.price || 0) * p.stock, 0);
  const lowStockCount = products.filter(p => p.min_stock && p.stock <= p.min_stock).length;

  // Load products
  useEffect(() => {
    if (organizationId) {
      getAll({ orderBy: { column: "created_at", ascending: false } });
    }
  }, [organizationId, getAll]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.barcode?.includes(searchQuery) ||
        p.plu?.includes(searchQuery)
    );
  }, [products, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  // Selected products for labels
  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  // Handlers
  const handleSave = async (
    productData: Omit<Product, "id" | "organization_id" | "created_at">,
    comboItems?: { child_product_id: string; quantity: number }[],
  ) => {
    try {
      if (editingProduct) {
        const result = await updateProduct(editingProduct.id, productData as any, comboItems);
        if (result.error) {
          toast.error(result.error);
          return;
        }
      } else {
        const result = await createProduct(productData as any, comboItems);
        if (result.error) {
          toast.error(result.error);
          return;
        }
      }

      toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
      setShowModal(false);
      setEditingProduct(null);
      getAll({ orderBy: { column: "created_at", ascending: false } });
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Error al guardar el producto. Verifica los datos.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    const result = await deleteProduct(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Producto eliminado");
      getAll({ orderBy: { column: "created_at", ascending: false } });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleImport = async (importedProducts: ImportedProduct[]) => {
    const result = await importProducts(importedProducts as any);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${importedProducts.length} productos importados`);
    getAll({ orderBy: { column: "created_at", ascending: false } });
  };

  const handleBulkUpdate = async (updates: BulkUpdateData) => {
    const ids = Array.from(selectedIds);
    const result = await bulkUpdateProducts(ids, updates.field as 'price' | 'stock', updates.operation, updates.value);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if ('warning' in result && result.warning) toast.warning(result.warning);
    else toast.success(`${ids.length} productos actualizados`);
    setSelectedIds(new Set());
    getAll({ orderBy: { column: "created_at", ascending: false } });
  };

  const handleGenerateLabel = (product: Product) => {
    setSelectedIds(new Set([product.id]));
    setShowLabelModal(true);
  };

  // Loading state
  if (orgLoading || (isLoading && products.length === 0)) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 rounded-lg bg-destructive/10 text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Catálogo e inventario
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Productos</h1>
          <p className="mt-1 text-muted-foreground">Gestioná tu catálogo, precios y niveles de stock.</p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          {canCreate("products") && (
            <div className="flex w-full gap-2 md:w-auto">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="hidden sm:flex"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="sm:hidden"
                size="icon"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setShowModal(true);
                }}
                className="flex-1 shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 md:flex-none"
              >
                <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <ProductKPIs
        totalProducts={products.length}
        inventoryValue={totalInventoryValue}
        salesValue={totalSalesValue}
        lowStockCount={lowStockCount}
      />

      {/* Filters & Controls */}
      <ProductFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedCount={selectedIds.size}
        onBulkUpdate={() => setShowBulkUpdateModal(true)}
        onGenerateLabels={() => setShowLabelModal(true)}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      {/* Products Table */}
      {viewMode === "table" && (
        <ProductTable
          products={paginatedProducts}
          selectedIds={selectedIds}
          searchQuery={searchQuery}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onEdit={(product) => {
            setEditingProduct(product);
            setShowModal(true);
          }}
          onDelete={handleDelete}
          onGenerateLabel={handleGenerateLabel}
          canEdit={canEdit("products")}
          canDelete={canDelete("products")}
          canViewCost={canViewCost}
        />
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <ProductGrid
          products={paginatedProducts}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onEdit={(product) => {
            setEditingProduct(product);
            setShowModal(true);
          }}
          onDelete={handleDelete}
        />
      )}

      {/* Pagination Controls */}
      {filteredProducts.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-4 border-t px-2 pt-4 sm:flex-row sm:gap-0">
          <div className="text-center text-sm text-muted-foreground sm:text-left">
            Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredProducts.length)} de {filteredProducts.length} productos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <div className="text-sm font-medium min-w-[3rem] text-center">
              {currentPage} / {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      <ProductModal
        open={showModal}
        product={editingProduct}
        allProducts={products}
        onSave={handleSave}
        onClose={() => {
          setShowModal(false);
          setEditingProduct(null);
        }}
        canViewCost={canViewCost}
      />

      {/* Import Modal */}
      <ImportExcelModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        open={showBulkUpdateModal}
        onClose={() => setShowBulkUpdateModal(false)}
        selectedCount={selectedIds.size}
        onUpdate={handleBulkUpdate}
      />

      {/* Label Modal */}
      <LabelModal
        open={showLabelModal}
        onClose={() => setShowLabelModal(false)}
        products={selectedProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
        }))}
      />
    </div>
  );
}
