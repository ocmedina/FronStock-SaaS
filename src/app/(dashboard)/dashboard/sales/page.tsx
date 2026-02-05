"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  SearchBar,
  Cart,
  PaymentPanel,
  QuickActions,
  StatusBar,
  SuspendedSalesModal,
  SalesTabs,
} from "@/components/sales/v2";
import { POSProductModal } from "@/components/sales/POSProductModal";
import { useSuspendedSales } from "@/hooks/useSuspendedSales";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import type { Product, Customer, CartItem } from "@/components/sales/types";

export default function POSPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tabs State
  const [tabs, setTabs] = useState([{ id: '1', name: 'Venta 1' }]);
  const [activeTabId, setActiveTabId] = useState('1');

  // Tab-specific state (stored per tab)
  const [tabsData, setTabsData] = useState<Record<string, {
    cart: CartItem[];
    customerId: string | null;
    discount: number;
    surcharge: number;
  }>>({
    '1': { cart: [], customerId: null, discount: 0, surcharge: 0 }
  });

  // Current tab data
  const currentTabData = tabsData[activeTabId] || { cart: [], customerId: null, discount: 0, surcharge: 0 };
  const cart = currentTabData.cart;
  const selectedCustomerId = currentTabData.customerId;
  const discount = currentTabData.discount;
  const surcharge = currentTabData.surcharge;

  // Update current tab data
  const updateTabData = (updates: Partial<typeof currentTabData>) => {
    setTabsData(prev => ({
      ...prev,
      [activeTabId]: { ...prev[activeTabId], ...updates }
    }));
  };

  // UI State
  const [showCatalog, setShowCatalog] = useState(false);
  const [showSuspended, setShowSuspended] = useState(false);

  // Suspended Sales
  const { suspendedSales, suspendSale, resumeSale, deleteSuspendedSale } = useSuspendedSales();

  const supabase = createClient();

  // Fetch Data (only once on mount)
  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    const [productsRes, customersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, barcode, plu, price, wholesale_price, stock")
        .eq("organization_id", organizationId)
        .gt("stock", 0)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name, customer_type, sales_channel")
        .eq("organization_id", organizationId)
        .in("sales_channel", ["counter", "general"])
        .order("name"),
    ]);

    if (productsRes.data) setProducts(productsRes.data as Product[]);
    if (customersRes.data) {
      setCustomers(customersRes.data);
    }

    setIsLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  // Tab Management
  const handleAddTab = () => {
    const newTabNumber = tabs.length + 1;
    const newTabId = Date.now().toString();
    const newTab = { id: newTabId, name: `Venta ${newTabNumber}` };

    setTabs([...tabs, newTab]);
    setTabsData(prev => ({
      ...prev,
      [newTabId]: { cart: [], customerId: null, discount: 0, surcharge: 0 }
    }));
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length === 1) {
      toast.error("No puedes cerrar la última venta");
      return;
    }

    const tabToClose = tabsData[tabId];
    if (tabToClose.cart.length > 0) {
      toast.error("No puedes cerrar una venta con productos");
      return;
    }

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    const newTabsData = { ...tabsData };
    delete newTabsData[tabId];
    setTabsData(newTabsData);

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  // Cart Management
  const addToCart = (product: Product) => {
    const currentCustomer = customers.find((c) => c.id === selectedCustomerId);
    const isWholesale = currentCustomer?.customer_type === "wholesale";
    const productPrice = isWholesale ? product.wholesale_price || product.price : product.price;

    const existing = cart.find((item) => item.product.id === product.id);
    let newCart: CartItem[];

    if (existing) {
      if (existing.quantity < product.stock) {
        newCart = cart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        toast.error("Stock insuficiente");
        return;
      }
    } else {
      newCart = [
        ...cart,
        {
          product: { ...product, price: productPrice },
          quantity: 1,
          discount: 0,
        },
      ];
    }

    updateTabData({ cart: newCart });
    toast.success(`${product.name} agregado`);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      updateTabData({ cart: cart.filter((item) => item.product.id !== productId) });
    } else {
      const item = cart.find((i) => i.product.id === productId);
      if (item && quantity > item.product.stock) {
        toast.error("Stock insuficiente");
        return;
      }
      updateTabData({
        cart: cart.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
      });
    }
  };

  const removeFromCart = (productId: string) => {
    updateTabData({ cart: cart.filter((item) => item.product.id !== productId) });
  };

  const clearCart = () => {
    updateTabData({ cart: [], discount: 0, surcharge: 0 });
  };

  // Customer Change
  const handleCustomerChange = (customerId: string | null) => {
    if (customerId === "default") customerId = null;

    const customer = customers.find((c) => c.id === customerId);
    const isWholesale = customer?.customer_type === "wholesale";

    const updatedCart = cart.map((item) => {
      const basePrice = isWholesale
        ? item.product.wholesale_price || item.product.price
        : item.product.price;

      return {
        ...item,
        product: {
          ...item.product,
          price: basePrice,
        },
      };
    });

    updateTabData({ customerId, cart: updatedCart });
  };

  // Process Sale
  const processSale = async (payments?: Array<{ method: string; amount: number }>) => {
    if (cart.length === 0 || !organizationId) {
      toast.error("El carrito está vacío");
      return;
    }

    setIsProcessing(true);

    try {
      const items = cart.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name || "Sin nombre",
        quantity: item.quantity,
        unit_price: item.product.price ?? 0,
      }));

      const finalPayments = payments || [{ method: "cash", amount: total }];

      const { data, error } = await supabase.rpc("process_sale", {
        p_org_id: organizationId,
        p_customer_id: selectedCustomerId || null,
        p_payments: finalPayments,
        p_items: items,
        p_discount: discount || 0,
        p_surcharge: surcharge || 0,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        sale_id?: string;
        sale_number?: number;
        error?: string;
        total?: number;
      };

      if (!result.success) {
        throw new Error(result.error || "Error al procesar la venta");
      }

      toast.success(`¡Venta #${result.sale_number} procesada exitosamente!`, {
        description: `Total: $${total.toLocaleString("es-AR")}`,
      });

      // Clear current tab for next sale
      clearCart();
      fetchData();
    } catch (error: any) {
      console.error("Error processing sale:", error);
      toast.error(`Error: ${error.message || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Suspend Sale
  const handleSuspendSale = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }

    suspendSale({
      id: Date.now().toString(),
      name: `Venta ${Date.now()}`,
      cart,
      customerId: selectedCustomerId,
      payments: [],
      discount,
      surcharge,
    });

    clearCart();
    toast.success("Venta suspendida");
  };

  // Resume Sale
  const handleResumeSale = (id: string) => {
    const sale = resumeSale(id);
    if (sale) {
      updateTabData({
        cart: sale.cart,
        customerId: sale.customerId,
        discount: sale.discount || 0,
        surcharge: sale.surcharge || 0,
      });
      toast.success("Venta recuperada");
    }
  };

  // Keyboard Shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "F1",
        description: "Buscar",
        action: () => document.querySelector<HTMLInputElement>('input[type="text"]')?.focus(),
      },
      { key: "F3", description: "Catálogo", action: () => setShowCatalog(true) },
      { key: "F8", description: "Suspender", action: handleSuspendSale, enabled: cart.length > 0 },
      {
        key: "F9",
        description: "Recuperar",
        action: () => setShowSuspended(true),
        enabled: suspendedSales.length > 0,
      },
      { key: "F12", description: "Cobrar", action: processSale, enabled: cart.length > 0 },
      {
        key: "Escape",
        description: "Cancelar",
        action: () => {
          setShowCatalog(false);
          setShowSuspended(false);
        },
      },
    ],
  });

  // Calculations (memoized for performance)
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cart]
  );

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const total = useMemo(
    () => Math.max(0, subtotal - discount + surcharge),
    [subtotal, discount, surcharge]
  );

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] md:h-[100vh] -m-3 md:-m-6 bg-background">
      {/* Header */}
      <div className="h-16 border-b border-border bg-background px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">🏪 FrontStock POS</h1>
          <span className="text-sm text-muted-foreground">v2.0</span>
        </div>
      </div>

      {/* Sales Tabs */}
      <SalesTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onTabClose={handleCloseTab}
        onTabAdd={handleAddTab}
      />

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left Column - Search & Cart */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-border">
          {/* Search Bar */}
          <div className="p-6 pb-4">
            <SearchBar products={products} onProductSelect={addToCart} />
          </div>

          {/* Cart */}
          <div className="flex-1 min-h-0 border-t border-border">
            <Cart
              items={cart}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onClear={clearCart}
              subtotal={subtotal}
              totalItems={totalItems}
            />
          </div>
        </div>

        {/* Right Column - Payment Panel Only */}
        <div className="w-[480px] flex flex-col min-h-0">
          <PaymentPanel
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            subtotal={subtotal}
            discount={discount}
            surcharge={surcharge}
            total={total}
            onCustomerChange={handleCustomerChange}
            onProcessSale={processSale}
            processing={isProcessing}
          />
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Quick Actions */}
      <QuickActions
        suspendedCount={suspendedSales.length}
        onSuspendedClick={() => setShowSuspended(true)}
      />

      {/* Modals */}
      <POSProductModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        products={products}
        onSelect={addToCart}
      />

      <SuspendedSalesModal
        open={showSuspended}
        onOpenChange={setShowSuspended}
        suspendedSales={suspendedSales}
        onResume={handleResumeSale}
        onDelete={deleteSuspendedSale}
      />
    </div>
  );
}
