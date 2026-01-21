"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Check,
  Loader2,
  Keyboard,
  Package,
  User,
  CreditCard,
  Banknote,
  Building,
  CheckCircle2,
  AlertCircle,
  Receipt,
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number;
}

interface Customer {
  id: string;
  name: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

interface SaleTab {
  id: string;
  name: string;
  cart: CartItem[];
  customerId: string | null;
  paymentMethod: PaymentMethod;
}

type PaymentMethod = "cash" | "card" | "transfer";

const paymentMethods = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
  { value: "transfer", label: "Transferencia", icon: Building },
];

export default function POSPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Multiple sales tabs
  const [tabs, setTabs] = useState<SaleTab[]>([
    {
      id: "1",
      name: "Venta 1",
      cart: [],
      customerId: null,
      paymentMethod: "cash",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalSearchRef = useRef<HTMLInputElement>(null);

  // Last sale info
  const [lastSaleTotal, setLastSaleTotal] = useState(0);

  const supabase = createClient();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const cart = activeTab?.cart || [];

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    const [productsRes, customersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, barcode, price, stock")
        .eq("organization_id", organizationId)
        .gt("stock", 0)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),
    ]);

    console.log("Products response:", productsRes);

    if (productsRes.error) {
      console.error("Error fetching products:", productsRes.error);
    }

    if (productsRes.data) setProducts(productsRes.data as Product[]);
    if (customersRes.data) setCustomers(customersRes.data);
    setIsLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Show shortcuts help
      if (e.key === "F1") {
        e.preventDefault();
        setShowShortcutsModal(true);
      }
      // F2: Focus search
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F3: Open product modal
      if (e.key === "F3") {
        e.preventDefault();
        setShowProductModal(true);
      }
      // F4: New sale tab
      if (e.key === "F4") {
        e.preventDefault();
        addNewTab();
      }
      // F8: Confirm sale
      if (e.key === "F8" && cart.length > 0) {
        e.preventDefault();
        setShowConfirmModal(true);
      }
      // Escape: Close modals
      if (e.key === "Escape") {
        setShowProductModal(false);
        setShowConfirmModal(false);
        setShowShortcutsModal(false);
      }
      // Ctrl+1-9: Switch tabs
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabs[tabIndex]) {
          setActiveTabId(tabs[tabIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, tabs]);

  // Focus modal search when opened
  useEffect(() => {
    if (showProductModal) {
      setTimeout(() => modalSearchRef.current?.focus(), 100);
    }
  }, [showProductModal]);

  const updateActiveTab = (updates: Partial<SaleTab>) => {
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, ...updates } : t)));
  };

  const addNewTab = () => {
    const newId = String(Date.now());
    const newTab: SaleTab = {
      id: newId,
      name: `Venta ${tabs.length + 1}`,
      cart: [],
      customerId: null,
      paymentMethod: "cash",
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    let newCart: CartItem[];

    if (existing) {
      if (existing.quantity < product.stock) {
        newCart = cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      } else {
        return;
      }
    } else {
      newCart = [...cart, { product, quantity: 1, discount: 0 }];
    }

    updateActiveTab({ cart: newCart });
    setShowProductModal(false);
    setProductSearchQuery("");
  };

  const updateQuantity = (productId: string, quantity: number) => {
    let newCart: CartItem[];
    if (quantity <= 0) {
      newCart = cart.filter((item) => item.product.id !== productId);
    } else {
      newCart = cart.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      );
    }
    updateActiveTab({ cart: newCart });
  };

  const removeFromCart = (productId: string) => {
    updateActiveTab({
      cart: cart.filter((item) => item.product.id !== productId),
    });
  };

  const clearCart = () => {
    updateActiveTab({ cart: [], customerId: null });
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = subtotal;

  const processSale = async () => {
    if (cart.length === 0 || !organizationId) return;

    setIsProcessing(true);
    setShowConfirmModal(false);

    try {
      console.log("Creating sale with org:", organizationId);

      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          organization_id: organizationId,
          customer_id: activeTab.customerId || null,
          subtotal,
          total,
          payment_method: activeTab.paymentMethod,
          payment_status: "paid",
          status: "completed",
        })
        .select()
        .single();

      if (saleError) {
        console.error(
          "Sale insert error:",
          saleError.message,
          saleError.details,
          saleError.hint,
        );
        throw saleError;
      }

      console.log("Sale created:", sale.id);
      console.log("Cart items:", cart);

      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product.id,
        product_name: item.product.name || "Sin nombre",
        quantity: item.quantity,
        unit_price: item.product.price ?? 0,
        discount: item.discount ?? 0,
        total: (item.product.price ?? 0) * item.quantity - (item.discount ?? 0),
      }));

      console.log("Sale items to insert:", saleItems);

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);
      if (itemsError) {
        console.error(
          "Sale items error:",
          itemsError.message,
          itemsError.details,
        );
        throw itemsError;
      }

      // Actualizar stock de productos
      for (const item of cart) {
        const currentStock = item.product.stock ?? 0;
        const newStock = Math.max(0, currentStock - item.quantity);
        console.log(
          `Updating stock for ${item.product.name}: ${currentStock} -> ${newStock}`,
        );

        const { error: stockError } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", item.product.id);

        if (stockError) {
          console.error("Stock update error:", stockError.message);
        }
      }

      setLastSaleTotal(total);
      clearCart();
      setShowSuccessModal(true);
      fetchData();
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        details?: string;
        code?: string;
      };
      console.error(
        "Error processing sale:",
        err.message || err.details || JSON.stringify(error),
      );
      alert(
        `Error al procesar la venta: ${err.message || "Error desconocido"}`,
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const modalFilteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(productSearchQuery.toLowerCase()),
  );

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header con pestañas */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b">
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${
                tab.id === activeTabId
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent"
              }`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="font-medium whitespace-nowrap">{tab.name}</span>
              {tab.cart.length > 0 && (
                <Badge
                  variant={tab.id === activeTabId ? "secondary" : "default"}
                  className="h-5 min-w-5 flex items-center justify-center text-xs"
                >
                  {tab.cart.length}
                </Badge>
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="hover:bg-white/20 rounded-full p-0.5"
                  title="Cerrar pestaña"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addNewTab}>
            <Plus className="h-4 w-4" /> Nueva (F4)
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowShortcutsModal(true)}
        >
          <Keyboard className="h-4 w-4 mr-1" /> F1
        </Button>
      </div>

      {/* Main Content - 2 columns */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left Column: Search + Cart + Products */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search Bar */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre, SKU o código de barras... (F2)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Button variant="outline" onClick={() => setShowProductModal(true)}>
              <Package className="h-4 w-4 mr-2" /> Catálogo (F3)
            </Button>
          </div>

          {/* Cart Items - Horizontal scrollable */}
          {cart.length > 0 && (
            <div className="mb-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Carrito ({totalItems} items)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="h-7 text-xs text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Vaciar
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex-shrink-0 bg-background rounded-lg p-2 border min-w-48"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ${Number(item.product.price).toLocaleString("es-AR")}{" "}
                          c/u
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.product.id)}
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center font-bold text-sm">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-bold text-sm text-primary">
                        $
                        {(item.product.price * item.quantity).toLocaleString(
                          "es-AR",
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Products List */}
          <div className="flex-1 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        {searchQuery
                          ? "No se encontraron productos"
                          : "No hay productos con stock"}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const inCart = cart.find(
                      (item) => item.product.id === product.id,
                    );
                    return (
                      <TableRow
                        key={product.id}
                        className={`cursor-pointer hover:bg-muted/50 ${inCart ? "bg-primary/5" : ""}`}
                        onClick={() => addToCart(product)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{product.name}</span>
                            {inCart && (
                              <Badge variant="default" className="text-xs">
                                {inCart.quantity}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {product.sku || product.barcode || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${Number(product.price).toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              product.stock <= 5 ? "destructive" : "secondary"
                            }
                          >
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right Column: Payment & Total */}
        <div className="w-72 flex flex-col gap-4">
          {/* Customer Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente</label>
            <Select
              value={activeTab.customerId || "general"}
              onValueChange={(v) =>
                updateActiveTab({ customerId: v === "general" ? null : v })
              }
            >
              <SelectTrigger>
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Cliente general" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Cliente general</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Método de Pago</label>
            <div className="grid grid-cols-1 gap-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isActive = activeTab.paymentMethod === method.value;
                return (
                  <Button
                    key={method.value}
                    variant={isActive ? "default" : "outline"}
                    onClick={() =>
                      updateActiveTab({
                        paymentMethod: method.value as PaymentMethod,
                      })
                    }
                    className="justify-start h-10"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {method.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="flex-1" />

          <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span>{totalItems}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toLocaleString("es-AR")}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-xl font-bold">
                <span>Total</span>
                <span className="text-primary">
                  ${total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            size="lg"
            className="w-full h-12"
            onClick={() => setShowConfirmModal(true)}
            disabled={cart.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Cobrar (F8)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Product Search Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Catálogo de Productos</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={modalSearchRef}
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalFilteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  modalFilteredProducts.slice(0, 50).map((product) => {
                    const inCart = cart.find(
                      (item) => item.product.id === product.id,
                    );
                    return (
                      <TableRow
                        key={product.id}
                        className={`cursor-pointer hover:bg-muted/50 ${inCart ? "bg-primary/5" : ""}`}
                        onClick={() => addToCart(product)}
                      >
                        <TableCell className="font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {product.sku || product.barcode || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          ${Number(product.price).toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              product.stock <= 5 ? "destructive" : "secondary"
                            }
                          >
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Sale Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 space-y-2 max-h-32 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.product.id}
                  className="flex justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="font-medium">
                    $
                    {(item.product.price * item.quantity).toLocaleString(
                      "es-AR",
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Productos</span>
                <span>{totalItems} items</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pago</span>
                <span>
                  {
                    paymentMethods.find(
                      (m) => m.value === activeTab.paymentMethod,
                    )?.label
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span>
                  {activeTab.customerId
                    ? customers.find((c) => c.id === activeTab.customerId)?.name
                    : "General"}
                </span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    ${total.toLocaleString("es-AR")}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancelar
            </Button>
            <Button onClick={processSale} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" /> Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="text-center">
          <div className="flex flex-col items-center py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <DialogTitle className="text-xl mb-1">¡Venta Exitosa!</DialogTitle>
            <p className="text-2xl font-bold text-primary">
              ${lastSaleTotal.toLocaleString("es-AR")}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="flex-1">
              <Receipt className="h-4 w-4 mr-2" /> Imprimir
            </Button>
            <Button
              className="flex-1"
              onClick={() => setShowSuccessModal(false)}
            >
              Nueva Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shortcuts Modal */}
      <Dialog open={showShortcutsModal} onOpenChange={setShowShortcutsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atajos de Teclado</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { key: "F1", desc: "Mostrar esta ayuda" },
              { key: "F2", desc: "Enfocar búsqueda" },
              { key: "F3", desc: "Abrir catálogo" },
              { key: "F4", desc: "Nueva venta" },
              { key: "F8", desc: "Cobrar venta" },
              { key: "Ctrl+1-9", desc: "Cambiar pestañas" },
              { key: "Esc", desc: "Cerrar ventanas" },
            ].map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm">{shortcut.desc}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
