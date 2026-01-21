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
  wholesale_price: number | null;
  stock: number;
}

interface Customer {
  id: string;
  name: string;
  customer_type: "retail" | "wholesale";
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

type PaymentMethod = "cash" | "card" | "transfer" | "credit";

const paymentMethods = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
  { value: "transfer", label: "Transferencia", icon: Building },
  { value: "credit", label: "Fiado", icon: User },
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
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
        .select("id, name, sku, barcode, price, wholesale_price, stock")
        .eq("organization_id", organizationId)
        .gt("stock", 0)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name, customer_type")
        .eq("organization_id", organizationId)
        .order("name"),
    ]);

    console.log("Products response:", productsRes);
    console.log("Customers response:", customersRes);

    if (productsRes.error) {
      console.error("Error fetching products:", productsRes.error);
    }
    if (customersRes.error) {
      console.error("Error fetching customers:", customersRes.error);
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

  const selectCustomer = (customerId: string | null) => {
    const customer = customers.find((c) => c.id === customerId);
    const isWholesale = customer?.customer_type === "wholesale";

    // Recalcular precios del carrito según el tipo de cliente
    const updatedCart = cart.map((item) => {
      // Determinar precio base según tipo de cliente
      const basePrice = isWholesale
        ? (item.product.wholesale_price || item.product.price)
        : item.product.price;

      // Actualizamos el producto en el item del carrito para reflejar el precio que se está cobrando
      // OJO: Esto visualmente mostrará el precio correcto en la lista
      return {
        ...item,
        product: {
          ...item.product,
          price: basePrice
        }
      };
    });

    updateActiveTab({
      customerId,
      cart: updatedCart
    });
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
    // Determinar precio según el cliente actual
    const currentCustomer = customers.find(c => c.id === activeTab.customerId);
    const isWholesale = currentCustomer?.customer_type === "wholesale";
    const productPrice = isWholesale ? (product.wholesale_price || product.price) : product.price;

    // Crear objeto producto con el precio ajustado
    const productWithAdjustedPrice = {
      ...product,
      price: productPrice
    };

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
      newCart = [...cart, { product: productWithAdjustedPrice, quantity: 1, discount: 0 }];
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
      // Validar que si es fiado, debe haber cliente seleccionado
      const isCredit = activeTab.paymentMethod === "credit";
      if (isCredit && !activeTab.customerId) {
        alert("Para ventas a crédito (fiado) debe seleccionar un cliente");
        setIsProcessing(false);
        return;
      }

      // Preparar items para la función RPC
      const items = cart.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name || "Sin nombre",
        quantity: item.quantity,
        unit_price: item.product.price ?? 0,
      }));

      // Llamar a la función RPC que ejecuta todo en una transacción atómica
      const { data, error } = await supabase.rpc("process_sale", {
        p_org_id: organizationId,
        p_customer_id: activeTab.customerId || null,
        p_payment_method: isCredit ? "credit" : activeTab.paymentMethod,
        p_items: items,
      });

      if (error) {
        throw error;
      }

      // Verificar respuesta de la función
      const result = data as { success: boolean; sale_id?: string; error?: string; total?: number; is_credit?: boolean };

      if (!result.success) {
        throw new Error(result.error || "Error al procesar la venta");
      }

      setLastSaleTotal(result.total || total);
      clearCart();
      setShowSuccessModal(true);
      fetchData();
    } catch (error: unknown) {
      const err = error as {
        message?: string;
        details?: string;
        code?: string;
      };
      console.error("Error processing sale:", err.message || err.details);
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
    <div className="flex flex-col h-[100vh] -m-6 bg-slate-950 shadow-2xl">
      {/* Header con pestañas - Dark Theme */}
      <div className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto flex-1 no-scrollbar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`
                group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border
                ${tab.id === activeTabId
                  ? "bg-slate-800 border-slate-700 text-slate-100 shadow-sm"
                  : "bg-transparent border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }
              `}
            >
              <div className={`p-1.5 rounded-md ${tab.id === activeTabId ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-800 text-slate-500 group-hover:text-slate-400"}`}>
                <ShoppingCart className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{tab.name}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  {tab.cart.length} items • ${tab.cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0).toLocaleString("es-AR")}
                </span>
              </div>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 rounded transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={addNewTab}
            className="h-9 w-9 p-0 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:text-emerald-500 hover:border-emerald-500/50 hover:bg-emerald-500/5"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 px-2 border-l border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShortcutsModal(true)}
            className="text-slate-400 hover:text-slate-200"
          >
            <Keyboard className="h-4 w-4 mr-2" />
            <span className="text-xs">Atajos</span>
          </Button>
        </div>
      </div>

      {/* Main Content - 2 columns */}
      <div className="flex flex-1 min-h-0 bg-slate-950">

        {/* LEFT COLUMN: Products & Cart (Flexible) */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-slate-800">

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 z-20 sticky top-0">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar producto (F2)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      // Auto-add if exact match or single result
                      const exactMatch = products.find(
                        (p) =>
                          p.barcode === searchQuery ||
                          p.sku === searchQuery
                      );
                      if (exactMatch) {
                        addToCart(exactMatch);
                        setSearchQuery("");
                      } else if (filteredProducts.length > 0) {
                        // Default to first result if present
                        addToCart(filteredProducts[0]);
                        setSearchQuery("");
                      }
                    }
                  }}
                  className="pl-10 h-11 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                    <span className="text-xs">↵</span> Enter
                  </kbd>
                </div>

                {/* Dropdown de Resultados */}
                {searchQuery && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden max-h-[400px] overflow-y-auto z-50">
                    <div className="p-2 border-b border-slate-800 bg-slate-950/30">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-2">Resultados ({filteredProducts.length})</span>
                    </div>
                    <div className="p-1">
                      {filteredProducts.slice(0, 8).map((product, index) => (
                        <div
                          key={product.id}
                          onClick={() => {
                            addToCart(product);
                            setSearchQuery("");
                            searchInputRef.current?.focus();
                          }}
                          className={`
                                 flex items-center justify-between p-2 rounded-md cursor-pointer group transition-all
                                 ${index === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-slate-800 border border-transparent"}
                              `}
                        >
                          <div className="flex flex-col">
                            <span className={`text-sm font-medium ${index === 0 ? "text-emerald-400" : "text-slate-200"}`}>{product.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                {product.sku || product.barcode || "S/C"}
                              </span>
                              <span className={`text-xs ${product.stock <= 5 ? "text-red-400" : "text-slate-500"}`}>Stock: {product.stock}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-emerald-400 text-sm">${product.price.toLocaleString("es-AR")}</span>
                            <div className={`p-1.5 rounded-full ${index === 0 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white"}`}>
                              <Plus className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {filteredProducts.length > 8 && (
                      <div className="p-2 text-center text-xs text-slate-500 border-t border-slate-800 bg-slate-950/30">
                        + {filteredProducts.length - 8} más... Sigue escribiendo
                      </div>
                    )}
                  </div>
                )}
                {searchQuery && filteredProducts.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-xl p-4 text-center z-50">
                    <Package className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-sm text-slate-400">No se encontraron productos</p>
                  </div>
                )}
              </div>
              <Button
                onClick={() => setShowProductModal(true)}
                className="h-11 px-6 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700"
              >
                <Package className="h-4 w-4 mr-2" />
                Catálogo (F3)
              </Button>
            </div>
          </div>

          {/* Active Cart Items */}
          {cart.length > 0 ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-medium text-slate-400">
                  Items en carrito ({totalItems})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="h-6 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  Vaciar carrito
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="group bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-200 truncate">{item.product.name}</span>
                          <Badge variant="outline" className="text-[10px] h-5 border-slate-700 text-slate-500 bg-slate-950">
                            {item.product.sku || "N/A"}
                          </Badge>
                        </div>
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="text-emerald-400 font-medium">
                            ${(item.product.price * item.quantity).toLocaleString("es-AR")}
                          </span>
                          <span className="text-slate-500 text-xs">
                            (${item.product.price} uni.)
                          </span>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-3 bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-mono font-bold text-slate-200">
                          {item.quantity}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          disabled={item.quantity >= item.product.stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromCart(item.product.id)}
                        className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10 ml-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8">
              <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
                <ShoppingCart className="h-10 w-10 opacity-50" />
              </div>
              <p className="text-lg font-medium text-slate-500">Carrito vacío</p>
              <p className="text-sm">Escanea un producto o busca para agregar</p>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Customer & Payment (Fixed) */}
        <div className="w-[400px] flex flex-col bg-slate-900 p-6 border-l border-slate-800 shadow-xl z-20">

          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-1 bg-emerald-500 rounded-full" />
            <div>
              <h2 className="text-lg font-bold text-white leading-none">Detalle de Venta</h2>
              <span className="text-xs text-slate-500 font-mono">#{activeTab.id.slice(-6)}</span>
            </div>
          </div>

          <div className="space-y-6 flex-1">
            {/* Customer Selector */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold ml-1">Cliente</label>
              <Select
                value={activeTab.customerId || "general"}
                onValueChange={(v) =>
                  updateActiveTab({ customerId: v === "general" ? null : v })
                }
              >
                <SelectTrigger className="h-12 bg-slate-950 border-slate-800 text-slate-200 focus:ring-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="flex flex-col items-start">
                      <SelectValue placeholder="Cliente general" />
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                  <SelectItem value="general">Cliente general</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-slate-500 font-bold ml-1">Método de Pago</label>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isActive = activeTab.paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      onClick={() =>
                        updateActiveTab({
                          paymentMethod: method.value as PaymentMethod,
                        })
                      }
                      className={`
                        flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all
                        ${isActive
                          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-800"
                        }
                      `}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? "text-emerald-500" : "text-slate-500"}`} />
                      <span className="text-xs font-medium">{method.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resume Card */}
            <div className="mt-auto bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Subtotal ({totalItems} items)</span>
                <span>${subtotal.toLocaleString("es-AR")}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Descuento</span>
                <span>$0</span>
              </div>
              <div className="h-px bg-slate-800 my-2" />
              <div className="flex justify-between items-end">
                <span className="text-slate-400 font-medium pb-1">Total a Pagar</span>
                <span className="text-3xl font-bold text-white tracking-tight">
                  <span className="text-emerald-500 text-lg mr-1">$</span>
                  {total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full h-14 text-lg font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-900/20"
              onClick={() => setShowConfirmModal(true)}
              disabled={cart.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <span>Cobrar</span>
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded ml-2">F8</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Product Search Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Catálogo de Productos</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              ref={modalSearchRef}
              placeholder="Buscar por nombre, SKU o código de barras..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-emerald-500/20"
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 border border-slate-800 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-800/50">
                  <TableHead className="text-slate-400">Producto</TableHead>
                  <TableHead className="text-slate-400">Código</TableHead>
                  <TableHead className="text-right text-slate-400">Precio</TableHead>
                  <TableHead className="text-right text-slate-400">Stock</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modalFilteredProducts.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  modalFilteredProducts.slice(0, 50).map((product) => {
                    const inCart = cart.find((item) => item.product.id === product.id);
                    return (
                      <TableRow
                        key={product.id}
                        className="cursor-pointer hover:bg-slate-800 border-slate-800"
                        onClick={() => addToCart(product)}
                      >
                        <TableCell className="text-slate-200 font-medium">{product.name}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-sm">
                          {product.sku || product.barcode || "-"}
                        </TableCell>
                        <TableCell className="text-right text-slate-200 font-semibold">
                          ${Number(product.price).toLocaleString("es-AR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={product.stock <= 5 ? "destructive" : "secondary"} className="bg-slate-800 text-slate-300">
                            {product.stock}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-700">
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
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmar Venta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 p-3 space-y-2 max-h-32 overflow-y-auto bg-slate-950/50">
              {cart.map((item) => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span className="text-slate-400">
                    {item.quantity}x {item.product.name}
                  </span>
                  <span className="text-slate-200 font-medium">
                    ${(item.product.price * item.quantity).toLocaleString("es-AR")}
                  </span>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 border border-slate-800">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Productos</span>
                <span className="text-slate-200">{totalItems} items</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Pago</span>
                <span className="text-slate-200">
                  {paymentMethods.find((m) => m.value === activeTab.paymentMethod)?.label}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Cliente</span>
                <span className="text-slate-200">
                  {activeTab.customerId
                    ? customers.find((c) => c.id === activeTab.customerId)?.name
                    : "General"}
                </span>
              </div>
              <div className="border-t border-slate-700 pt-2 mt-2">
                <div className="flex justify-between text-xl font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-emerald-400">${total.toLocaleString("es-AR")}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              Cancelar
            </Button>
            <Button onClick={processSale} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-500 text-white border-0">
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
        <DialogContent className="text-center bg-slate-900 border-slate-800">
          <div className="flex flex-col items-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4 ring-1 ring-emerald-500/50">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-xl mb-1 text-white">¡Venta Exitosa!</DialogTitle>
            <p className="text-3xl font-bold text-emerald-400 my-2">
              ${lastSaleTotal.toLocaleString("es-AR")}
            </p>
          </div>
          <DialogFooter className="gap-3 sm:justify-center">
            <Button
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => {
                const printWindow = window.open('', '_blank', 'width=400,height=600');
                if (printWindow) {
                  printWindow.document.write(`
                    <html>
                      <head>
                        <title>Ticket de Venta</title>
                        <style>
                          body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
                          h1 { font-size: 18px; text-align: center; margin-bottom: 10px; }
                          .divider { border-top: 1px dashed #000; margin: 10px 0; }
                          .total { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; }
                          .footer { text-align: center; font-size: 12px; margin-top: 20px; }
                        </style>
                      </head>
                      <body>
                        <h1>TICKET DE VENTA</h1>
                        <p>Fecha: ${new Date().toLocaleString('es-AR')}</p>
                        <div class="divider"></div>
                        <p class="total">Total: $${lastSaleTotal.toLocaleString('es-AR')}</p>
                        <div class="divider"></div>
                        <p class="footer">¡Gracias por su compra!</p>
                      </body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}
            >
              <Receipt className="h-4 w-4 mr-2" /> Imprimir
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white border-0" onClick={() => setShowSuccessModal(false)}>
              Nueva Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Cart Confirmation Modal */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Vaciar Carrito
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que deseas vaciar el carrito? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearCart();
                setShowClearConfirm(false);
              }}
              className="bg-red-600 hover:bg-red-700 border-0"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Sí, vaciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shortcuts Modal */}
      <Dialog open={showShortcutsModal} onOpenChange={setShowShortcutsModal}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Atajos de Teclado</DialogTitle>
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
                className="flex items-center justify-between py-1 border-b border-slate-800 last:border-0"
              >
                <span className="text-sm text-slate-300">{shortcut.desc}</span>
                <kbd className="px-2 py-1 bg-slate-800 rounded text-xs font-mono text-slate-400 border border-slate-700">
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
