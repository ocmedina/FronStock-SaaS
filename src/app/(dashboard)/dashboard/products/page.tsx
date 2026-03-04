"use client";

import { useState, useEffect, useMemo } from "react";
import { useSupabaseTable } from "@/hooks/useSupabaseTable";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Plus, FileSpreadsheet, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
    if (editingProduct && !canEdit("products")) {
      toast.error("No tienes permisos para editar productos");
      return;
    }

    if (!editingProduct && !canCreate("products")) {
      toast.error("No tienes permisos para crear productos");
      return;
    }

    try {
      let productId = editingProduct?.id;

      if (editingProduct) {
        await update(editingProduct.id, productData);
      } else {
        // Check limits before creating
        const { checkProductLimit } = await import('@/actions/products');
        const limitCheck = await checkProductLimit();

        if (limitCheck.error) {
          alert(limitCheck.error);
          return;
        }

        const newProduct = await create(
          productData as Omit<Product, keyof { id: string; organization_id: string; created_at: string }>,
        );
        productId = newProduct?.id;
      }

      // Save combo items
      if (productData.is_combo && comboItems && productId && organizationId) {
        await supabase.from("product_combos").delete().eq("parent_product_id", productId);

        if (comboItems.length > 0) {
          const itemsToInsert = comboItems.map((item) => ({
            organization_id: organizationId,
            parent_product_id: productId,
            child_product_id: item.child_product_id,
            quantity: item.quantity,
          }));

          const { error: comboError } = await supabase.from("product_combos").insert(itemsToInsert);
          if (comboError) throw comboError;
        }
      }

      setShowModal(false);
      setEditingProduct(null);
      getAll({ orderBy: { column: "created_at", ascending: false } });
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error al guardar el producto. Verifica que los datos sean correctos.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!canDelete("products")) {
      toast.error("No tienes permisos para eliminar productos");
      return;
    }

    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    await remove(id);
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
    if (!canCreate("products")) {
      toast.error("No tienes permisos para importar productos");
      return;
    }

    if (!organizationId) return;
    for (const product of importedProducts) {
      await supabase.from("products").insert({
        organization_id: organizationId,
        ...product,
      });
    }
    getAll({ orderBy: { column: "created_at", ascending: false } });
  };

  const handleBulkUpdate = async (updates: BulkUpdateData) => {
    if (!canEdit("products")) {
      toast.error("No tienes permisos para editar productos");
      return;
    }

    const selectedProductsList = products.filter((p) => selectedIds.has(p.id));

    for (const product of selectedProductsList) {
      let newValue: number;
      const currentValue = updates.field === "price" ? product.price : product.stock;

      switch (updates.operation) {
        case "set":
          newValue = updates.value;
          break;
        case "add":
          newValue = currentValue + updates.value;
          break;
        case "subtract":
          newValue = Math.max(0, currentValue - updates.value);
          break;
        case "percentage":
          newValue = currentValue * (1 + updates.value / 100);
          break;
        default:
          newValue = currentValue;
      }

      if (updates.field === "price") {
        newValue = Math.round(newValue * 100) / 100;
      } else {
        newValue = Math.round(newValue);
      }

      await supabase.from("products").update({ [updates.field]: newValue }).eq("id", product.id);
    }

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
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">Gestión de productos, combos y stock.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {canCreate("products") && (
            <div className="flex gap-2 w-full md:w-auto">
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
                className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all flex-1 md:flex-none"
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
        <div className="flex flex-col sm:flex-row items-center justify-between border-t pt-4 px-2 gap-4 sm:gap-0">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
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
