"use client";

import { useState, useEffect } from "react";
import { useSupabaseTable } from "@/hooks/useSupabaseTable";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  FileSpreadsheet,
  Edit3,
  Tag,
  MoreHorizontal,
  Package,
  Hash,
  Barcode,
  DollarSign,
  TrendingUp,
  Box as BoxIcon,
  AlertTriangle,
  Wand2,
  X,
  Layers,
  LayoutGrid,
  List,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ImportExcelModal,
  type ImportedProduct,
  BulkUpdateModal,
  type BulkUpdateData,
  LabelModal,
} from "@/components/products";

export default function ProductsPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const {
    data: products,
    isLoading,
    error,
    getAll,
    create,
    update,
    remove,
  } = useSupabaseTable<Product>({ table: "products" });

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // New states for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const supabase = createClient();

  // KPIs
  const totalInventoryValue = products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0);
  const totalSalesValue = products.reduce((acc, p) => acc + (p.price || 0) * p.stock, 0); // Valor de venta potencial
  const lowStockCount = products.filter(p => p.min_stock && p.stock <= p.min_stock).length;


  useEffect(() => {
    if (organizationId) {
      getAll({ orderBy: { column: "created_at", ascending: false } });
    }
  }, [organizationId, getAll]);

  const handleSave = async (
    productData: Omit<Product, "id" | "organization_id" | "created_at">,
    comboItems?: { child_product_id: string; quantity: number }[],
  ) => {
    try {
      let productId = editingProduct?.id;

      if (editingProduct) {
        await update(editingProduct.id, productData);
      } else {
        const newProduct = await create(
          productData as Omit<
            Product,
            keyof { id: string; organization_id: string; created_at: string }
          >,
        );
        productId = newProduct?.id;
      }

      // Guardar items del combo
      if (productData.is_combo && comboItems && productId && organizationId) {
        // 1. Eliminar items anteriores
        await supabase
          .from("product_combos")
          .delete()
          .eq("parent_product_id", productId);

        // 2. Insertar nuevos items
        if (comboItems.length > 0) {
          const itemsToInsert = comboItems.map((item) => ({
            organization_id: organizationId,
            parent_product_id: productId,
            child_product_id: item.child_product_id,
            quantity: item.quantity,
          }));

          const { error: comboError } = await supabase
            .from("product_combos")
            .insert(itemsToInsert);

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
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      await remove(id);
      getAll({ orderBy: { column: "created_at", ascending: false } });
    }
  };

  // Bulk selection handlers
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

  // Import handler
  const handleImport = async (importedProducts: ImportedProduct[]) => {
    if (!organizationId) return;

    for (const product of importedProducts) {
      await supabase.from("products").insert({
        organization_id: organizationId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: product.price,
        cost_price: product.cost_price,
        wholesale_price: product.wholesale_price,
        stock: product.stock,
        min_stock: product.min_stock,
        description: product.description,
      });
    }

    getAll({ orderBy: { column: "created_at", ascending: false } });
  };

  // Bulk update handler
  const handleBulkUpdate = async (updates: BulkUpdateData) => {
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));

    for (const product of selectedProducts) {
      let newValue: number;
      const currentValue =
        updates.field === "price" ? product.price : product.stock;

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
        newValue = Math.round(newValue * 100) / 100; // Round to 2 decimals
      } else {
        newValue = Math.round(newValue); // Round stock to integer
      }

      await supabase
        .from("products")
        .update({ [updates.field]: newValue })
        .eq("id", product.id);
    }

    setSelectedIds(new Set());
    getAll({ orderBy: { column: "created_at", ascending: false } });
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Pagination Logic
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = viewMode === "grid" ? 12 : 10;

  // Reset page when search or view changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, viewMode]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-lg bg-destructive/10 text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Title & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">Gestión de productos, combos y stock.</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate("products") && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="hidden sm:flex"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar
              </Button>
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setShowModal(true);
                }}
                className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
              >
                <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
              <h3 className="text-2xl font-bold mt-1">{products.length}</h3>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Valor Inventario</p>
              <h3 className="text-2xl font-bold mt-1">${totalInventoryValue.toLocaleString()}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Potencial Venta: <span className="text-emerald-500 font-medium">${totalSalesValue.toLocaleString()}</span>
              </p>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card/50 backdrop-blur-sm text-card-foreground shadow-sm hover:shadow-md transition-all">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock Bajo</p>
              <h3 className="text-2xl font-bold mt-1">{lowStockCount}</h3>
              <p className="text-xs text-muted-foreground mt-1">Productos requieren atención</p>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card/50 p-3 rounded-xl border">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50 border-input/50 focus:bg-background transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-5 duration-200">
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-md">
                {selectedIds.size} seleccionados
              </span>
              <Button variant="outline" size="icon-sm" onClick={() => setShowBulkUpdateModal(true)} title="Edición masiva">
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon-sm" onClick={() => setShowLabelModal(true)} title="Etiquetas">
                <Tag className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelectedIds(new Set())} title="Cancelar selección">
                <X className="h-4 w-4" />
              </Button>
              <div className="h-4 w-px bg-border mx-1" />
            </div>
          )}

          <div className="flex items-center border rounded-lg overflow-hidden bg-background shadow-sm p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              title="Vista lista"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              title="Vista cuadrícula"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className={`rounded-lg border bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden ${viewMode === 'grid' ? 'hidden' : 'block'}`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selectedIds.size === filteredProducts.length &&
                    filteredProducts.length > 0
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Códigos</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Minorista</TableHead>
              <TableHead className="text-right">Mayorista</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-full bg-muted">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium">
                      {searchQuery
                        ? "No se encontraron productos"
                        : "No hay productos"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? "Intenta con otra búsqueda"
                        : "¡Crea el primero!"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow
                  key={product.id}
                  className={selectedIds.has(product.id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(product.id)}
                      onCheckedChange={() => toggleSelect(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {product.sku && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Hash className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{product.sku}</span>
                        </div>
                      )}
                      {product.barcode && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Barcode className="h-3 w-3" />
                          <span className="font-mono">{product.barcode}</span>
                        </div>
                      )}
                      {!product.sku && !product.barcode && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {product.cost_price ? (
                      <span className="text-muted-foreground">
                        ${Number(product.cost_price).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ${Number(product.price).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {product.wholesale_price ? (
                      <span className="text-blue-600 dark:text-blue-400">
                        ${Number(product.wholesale_price).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={
                        product.stock <= 0
                          ? "destructive"
                          : product.min_stock &&
                            product.stock <= product.min_stock
                            ? "secondary"
                            : product.stock <= 10
                              ? "secondary"
                              : "default"
                      }
                      className="gap-1"
                    >
                      {product.min_stock &&
                        product.stock <= product.min_stock && (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                      {product.stock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit("products") && (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingProduct(product);
                              setShowModal(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedIds(new Set([product.id]));
                            setShowLabelModal(true);
                          }}
                        >
                          <Tag className="h-4 w-4 mr-2" />
                          Generar Etiqueta
                        </DropdownMenuItem>
                        {canDelete("products") && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(product.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-300">
          {paginatedProducts.map((product) => {
            const isSelected = selectedIds.has(product.id);
            return (
              <div
                key={product.id}
                className={`group relative flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                onClick={(e) => {
                  // Si hace click en la tarjeta (no botones), toggle selección o abrir editar? 
                  // Mejor solo selección si clickea fondo
                  // toggleSelect(product.id); 
                }}
              >
                <div className="p-5 flex flex-col h-full gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(product.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      {product.is_combo && (
                        <Badge variant="secondary" className="gap-1 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-purple-200">
                          <Layers className="h-3 w-3" /> Combo
                        </Badge>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingProduct(product); setShowModal(true); }}>
                          <Edit3 className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-semibold leading-none tracking-tight truncate" title={product.name}>
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">SKU: {product.sku || '-'}</p>
                  </div>

                  <div className="flex items-end justify-between mt-auto pt-2">
                    <div>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        ${product.price}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Unitario</p>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center gap-1 font-medium ${product.min_stock && product.stock <= product.min_stock
                        ? "text-rose-500"
                        : "text-foreground"
                        }`}>
                        <Package className="h-3.5 w-3.5" />
                        {product.stock}
                      </div>
                      <p className="text-[10px] text-muted-foreground">Stock</p>
                    </div>
                  </div>
                </div>

                {/* Footer bar with visually distinct actions if needed, or just hover effect */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredProducts.length > 0 && (
        <div className="flex items-center justify-between border-t pt-4 px-2">
          <div className="text-sm text-muted-foreground">
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

interface ProductModalProps {
  open: boolean;
  product: Product | null;
  allProducts: Product[];
  onSave: (
    data: Omit<Product, "id" | "organization_id" | "created_at">,
    comboItems?: { child_product_id: string; quantity: number }[]
  ) => Promise<void>;
  onClose: () => void;
}

function ProductModal({ open, product, allProducts, onSave, onClose }: ProductModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    price: "0",
    cost_price: "",
    wholesale_price: "",
    stock: "0",
    min_stock: "",
    description: "",
    is_combo: false,
  });
  const [comboItems, setComboItems] = useState<{ child_product_id: string; quantity: number }[]>([]);
  const [comboSearch, setComboSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
        price: product.price?.toString() || "0",
        cost_price: product.cost_price?.toString() || "",
        wholesale_price: product.wholesale_price?.toString() || "",
        stock: product.stock?.toString() || "0",
        min_stock: product.min_stock?.toString() || "",
        description: product.description || "",
        is_combo: product.is_combo || false,
      });

      if (product.is_combo) {
        const supabase = createClient();
        supabase
          .from("product_combos")
          .select("child_product_id, quantity")
          .eq("parent_product_id", product.id)
          .then(({ data }) => {
            if (data) {
              setComboItems(data);
            }
          });
      } else {
        setComboItems([]);
      }
    } else {
      setFormData({
        name: "",
        sku: "",
        barcode: "",
        price: "0",
        cost_price: "",
        wholesale_price: "",
        stock: "0",
        min_stock: "",
        description: "",
        is_combo: false,
      });
      setComboItems([]);
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: formData.name,
      sku: formData.sku || null,
      barcode: formData.barcode || null,
      price: parseFloat(formData.price) || 0,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      wholesale_price: formData.wholesale_price
        ? parseFloat(formData.wholesale_price)
        : null,
      stock: parseInt(formData.stock) || 0,
      min_stock: formData.min_stock ? parseInt(formData.min_stock) : null,
      description: formData.description || null,
      is_combo: formData.is_combo,
    }, comboItems);
    setSaving(false);
  };

  // Calcular margen de ganancia
  const profitMargin =
    formData.cost_price && formData.price
      ? (
        ((parseFloat(formData.price) - parseFloat(formData.cost_price)) /
          parseFloat(formData.cost_price)) *
        100
      ).toFixed(1)
      : null;

  // Funciones de generación
  const generateRandomBarcode = () => {
    // Generar EAN-13 ficticio (sin checksum real estricto para demo, pero formato válido)
    const prefix = "779"; // Argentina
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
    const code = prefix + random;

    // Calcular dígito verificador simple
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    setFormData(prev => ({ ...prev, barcode: code + checkDigit }));
  };

  const generateRandomSKU = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let sku = "";
    // Generar formato XXX-XXX-000
    for (let i = 0; i < 3; i++) sku += chars.charAt(Math.floor(Math.random() * 26)); // Letras
    sku += "-";
    for (let i = 0; i < 3; i++) sku += chars.charAt(Math.floor(Math.random() * 36));
    sku += "-";
    for (let i = 0; i < 3; i++) sku += chars.charAt(Math.floor(Math.random() * 10) + 26); // Números

    setFormData(prev => ({ ...prev, sku: sku }));
  };

  const addComboItem = (prod: Product) => {
    setComboItems((prev) => {
      const existing = prev.find((p) => p.child_product_id === prod.id);
      if (existing) {
        return prev.map((p) =>
          p.child_product_id === prod.id
            ? { ...p, quantity: p.quantity + 1 }
            : p,
        );
      }
      return [...prev, { child_product_id: prod.id, quantity: 1 }];
    });
    setComboSearch("");
  };

  const removeComboItem = (id: string) => {
    setComboItems((prev) => prev.filter((p) => p.child_product_id !== id));
  };

  const updateComboQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setComboItems((prev) =>
      prev.map((p) => (p.child_product_id === id ? { ...p, quantity: qty } : p)),
    );
  };

  // Calcular costo total del combo basado en componentes
  const comboCost = comboItems.reduce((acc, item) => {
    const prod = allProducts?.find((p) => p.id === item.child_product_id);
    return acc + (prod?.cost_price || 0) * item.quantity;
  }, 0);

  // Actualizar costo en formData si es combo (opcional, o solo mostrarlo)
  useEffect(() => {
    if (formData.is_combo) {
      setFormData(prev => ({ ...prev, cost_price: comboCost.toString() }));
    }
  }, [comboCost, formData.is_combo]);

  const filteredComboProducts = allProducts?.filter(
    (p) =>
      !p.is_combo && // No permitir combos dentro de combos por ahora para simplificar
      p.id !== product?.id && // No permitirse a sí mismo
      (p.name.toLowerCase().includes(comboSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(comboSearch.toLowerCase()))
  ).slice(0, 5) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            {product ? "Editar Producto" : "Nuevo Producto"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Producto */}
          <div className="flex items-center space-x-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Checkbox
              id="is_combo"
              checked={formData.is_combo}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_combo: !!checked }))}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="is_combo"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Es Combo / Promoción
              </label>
              <p className="text-sm text-muted-foreground">
                Selecciona esta opción si el producto está compuesto por otros productos.
              </p>
            </div>
          </div>

          {/* Información básica */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Información Básica
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nombre del Producto *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ej: Camiseta Nike Dry-Fit"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descripción del producto..."
                rows={2}
                className="w-full px-3 py-2 rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
              />
            </div>
          </div>

          {/* Códigos */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Códigos de Identificación
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    SKU
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={generateRandomSKU}
                    title="Generar SKU aleatorio"
                  >
                    <Wand2 className="h-3 w-3" />
                  </Button>
                </label>
                <Input
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  placeholder="Ej: CAM-NIK-001"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Barcode className="h-4 w-4 text-muted-foreground" />
                    Código de Barras
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={generateRandomBarcode}
                    title="Generar EAN-13 aleatorio"
                  >
                    <Wand2 className="h-3 w-3" />
                  </Button>
                </label>
                <Input
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, barcode: e.target.value })
                  }
                  placeholder="Ej: 7790001234567"
                />
              </div>
            </div>
          </div>

          {/* Componentes del Combo (Solo si es combo) */}
          {formData.is_combo && (
            <div className="space-y-4 rounded-lg border p-4 bg-slate-50 dark:bg-slate-800/50">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Componentes del Combo
              </h3>

              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={comboSearch}
                  onChange={e => setComboSearch(e.target.value)}
                  placeholder="Buscar productos para agregar..."
                  className="pl-9 bg-background"
                />
                {comboSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {filteredComboProducts.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">No se encontraron productos</div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        {filteredComboProducts.map(p => (
                          <div
                            key={p.id}
                            onClick={() => addComboItem(p)}
                            className="p-2.5 hover:bg-accent cursor-pointer flex justify-between items-center transition-colors border-b last:border-0"
                          >
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">SKU: {p.sku || '-'}</p>
                            </div>
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              ${p.cost_price || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border rounded-md divide-y bg-background">
                {comboItems.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                    <Layers className="h-8 w-8 opacity-20" />
                    <p>Agrega productos para armar el combo</p>
                  </div>
                ) : (
                  comboItems.map(item => {
                    const product = allProducts?.find(p => p.id === item.child_product_id);
                    return (
                      <div key={item.child_product_id} className="p-2 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product?.name || "Producto desconocido"}</p>
                          <p className="text-xs text-muted-foreground">Costo unit: ${product?.cost_price || 0}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border rounded-md overflow-hidden bg-background">
                            <span className="px-2 text-xs text-muted-foreground bg-muted border-r h-full flex items-center">Cant.</span>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateComboQuantity(item.child_product_id, parseInt(e.target.value) || 1)}
                              className="w-12 h-8 text-center text-sm focus:outline-none bg-transparent"
                              min="1"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeComboItem(item.child_product_id)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-between items-center text-sm pt-2">
                <span className="text-muted-foreground">Total items: {comboItems.reduce((a, b) => a + b.quantity, 0)}</span>
                <span className="font-medium text-muted-foreground">
                  Costo Sugerido: <span className="text-foreground font-bold">${comboCost.toFixed(2)}</span>
                </span>
              </div>
            </div>
          )}

          {/* Precios */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Precios
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-red-500" />
                  Costo
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) =>
                    setFormData({ ...formData, cost_price: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  Minorista *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  Mayorista
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.wholesale_price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      wholesale_price: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            {profitMargin && parseFloat(profitMargin) > 0 && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Margen de ganancia:{" "}
                  <span className="font-bold">{profitMargin}%</span>
                </p>
              </div>
            )}
          </div>

          {/* Inventario */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Inventario
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <BoxIcon className="h-4 w-4 text-muted-foreground" />
                  Stock Actual
                </label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) =>
                    setFormData({ ...formData, stock: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Stock Mínimo
                </label>
                <Input
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) =>
                    setFormData({ ...formData, min_stock: e.target.value })
                  }
                  placeholder="Alertar cuando sea menor a..."
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 shadow-lg shadow-primary/20"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Guardando..." : "Guardar Producto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
