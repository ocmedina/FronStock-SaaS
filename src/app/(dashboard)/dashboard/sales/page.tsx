"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";
import {
  POSHeader,
  POSProductSearch,
  POSCart,
  POSPaymentPanel,
  POSProductModal,
  POSShortcutsModal,
  Product,
  Customer,
  SaleTab,
  CartItem,
  PaymentMethod,
} from "@/components/sales";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TicketView } from "@/components/sales/TicketView";
import { Button } from "@/components/ui/button";
import { Check, X, Printer } from "lucide-react";
import React from "react";

export default function POSPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]); // New state for suppliers
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Tabs State
  const [tabs, setTabs] = useState<SaleTab[]>([
    {
      id: "1",
      name: "Venta 1",
      cart: [],
      customerId: null,
      payments: [],
      // @ts-ignore - dynamic extension
      supplierPayment: null, // NEW: Store supplier payment choice
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("1");
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const cart = activeTab?.cart || [];

  // Modals & UI State
  const [showProductModal, setShowProductModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Ticket State
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<any>(null);

  // Search State for POSProductSearch
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Last sale info
  const [lastSaleTotal, setLastSaleTotal] = useState(0);

  const supabase = createClient();

  // Data Fetching
  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    const [productsRes, customersRes, suppliersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, barcode, plu, price, wholesale_price, stock")
        .eq("organization_id", organizationId)
        .gt("stock", 0)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name, customer_type")
        .eq("organization_id", organizationId)
        .order("name"),
      supabase
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name"),
    ]);

    if (productsRes.data) setProducts(productsRes.data as Product[]);

    if (customersRes.data) {
      setCustomers(customersRes.data);
      // AUTO-SELECT "Consumidor Final" for existing empty tabs
      const finalConsumer = customersRes.data.find(c => c.name === "Consumidor Final");
      if (finalConsumer) {
        setTabs(prev => prev.map(t => ({
          ...t,
          customerId: t.customerId || finalConsumer.id
        })));
      }
    }

    // DEBUG: Log supplier fetch results
    console.log("🔍 Suppliers fetch result:", {
      data: suppliersRes.data,
      error: suppliersRes.error,
      count: suppliersRes.data?.length || 0
    });

    if (suppliersRes.error) {
      console.error("❌ Error fetching suppliers:", suppliersRes.error);
    }

    if (suppliersRes.data) {
      console.log("✅ Setting suppliers:", suppliersRes.data);
      setSuppliers(suppliersRes.data);
    } else {
      console.warn("⚠️ No supplier data received");
    }

    setIsLoading(false);
  }, [organizationId, supabase]);

  useEffect(() => {
    if (organizationId) fetchData();
  }, [organizationId, fetchData]);

  // Tab Management
  const updateActiveTab = (updates: Partial<SaleTab>) => {
    setTabs(tabs.map((t) => (t.id === activeTabId ? { ...t, ...updates } : t)));
  };

  const addNewTab = () => {
    const finalConsumer = customers.find(c => c.name === "Consumidor Final");

    const newId = String(Date.now());
    const newTab: SaleTab = {
      id: newId,
      name: `Venta ${tabs.length + 1}`,
      cart: [],
      customerId: finalConsumer ? finalConsumer.id : null,
      payments: [],
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

  // Cart Management
  const addToCart = (product: Product) => {
    const currentCustomer = customers.find(c => c.id === activeTab.customerId);
    const isWholesale = currentCustomer?.customer_type === "wholesale";
    const productPrice = isWholesale ? (product.wholesale_price || product.price) : product.price;

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
        return; // Stock limit reached
      }
    } else {
      newCart = [...cart, { product: productWithAdjustedPrice, quantity: 1, discount: 0 }];
    }

    updateActiveTab({ cart: newCart });
    setShowProductModal(false);
    setSearchQuery("");
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

  // Customer Selection & Price Update logic
  const handleCustomerChange = (customerId: string | null) => {
    // If "default" is passed from select component
    if (customerId === "default") customerId = null;

    const customer = customers.find((c) => c.id === customerId);
    const isWholesale = customer?.customer_type === "wholesale";

    const updatedCart = cart.map((item) => {
      const basePrice = isWholesale
        ? (item.product.wholesale_price || item.product.price)
        : item.product.price;

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

  const handleAddPayment = (payment: { method: any, amount: number }) => {
    const currentPayments = activeTab.payments || [];
    updateActiveTab({ payments: [...currentPayments, payment] });
  };

  const handleRemovePayment = (index: number) => {
    const currentPayments = activeTab.payments || [];
    updateActiveTab({ payments: currentPayments.filter((_, i) => i !== index) });
  };

  const handleSetPayments = (payments: { method: any, amount: number }[]) => {
    updateActiveTab({ payments });
  };

  const handleSupplierPaymentChange = (payment: { supplierId: string, amount: number } | null) => {
    // @ts-ignore
    updateActiveTab({ supplierPayment: payment });
  };

  // Sales Processing
  const processSale = async () => {
    if (cart.length === 0 || !organizationId) return;

    // If no payments explicitly added, assume FULL CASH (Basic fallback if logic fails, though UI should prevent)
    // Actually, UI now forces payments for Mixed. For Simple, we must ensure state IS updated.
    // I will rely on POSPaymentPanel updating the state via handleSetPayments.

    // Safety check: specific for mixed/partial logic
    const totalPaid = (activeTab.payments || []).reduce((sum, p) => sum + p.amount, 0);

    // If payments array is empty, this logic blocks. 
    // Is that what we want? 
    // If I'm in "Simple - Cash", I want `processSale` to just work.
    // If `POSPaymentPanel` updates state immediately on click, then `activeTab.payments` will have the data.
    // If `POSPaymentPanel` updates state ONLY on "Confirm", then here it's empty.
    // My previous thought in `POSPaymentPanel` was to update it immediately.
    // So if I add `handleSetPayments` and use it in `POSPaymentPanel`, I can ensure state is always sync.

    // Permitir un pequeño margen de error por decimales
    if (Math.abs(totalPaid - total) > 0.01) {
      // If totalPaid is 0, allow ONLY if we assume default cash? 
      // No, safer to enforce explicit payments in state.
      alert(`El total de los pagos ($${totalPaid}) debe ser igual al total de la venta ($${total}). Diferencia: $${Math.abs(totalPaid - total)}`);
      return;
    }

    setIsProcessing(true);
    setShowConfirmModal(false);

    try {
      const isCredit = activeTab.payments.some(p => p.method === "credit");
      if (isCredit && !activeTab.customerId) {
        alert("Para ventas a crédito (fiado) debe seleccionar un cliente");
        setIsProcessing(false);
        return;
      }

      const items = cart.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name || "Sin nombre",
        quantity: item.quantity,
        unit_price: item.product.price ?? 0,
      }));

      // Simplificar pagos para enviar
      const paymentsPayload = activeTab.payments.map(p => ({
        method: p.method,
        amount: p.amount
      }));

      console.log("Calling process_sale with:", {
        p_org_id: organizationId,
        p_customer_id: activeTab.customerId || null,
        p_payments: paymentsPayload,
        p_items: items,
        p_discount: activeTab.discount || 0,
        p_surcharge: activeTab.surcharge || 0
      });

      const { data, error } = await supabase.rpc("process_sale", {
        p_org_id: organizationId,
        p_customer_id: activeTab.customerId || null,
        p_payments: paymentsPayload,
        p_items: items,
        p_discount: activeTab.discount || 0,
        p_surcharge: activeTab.surcharge || 0,
        // @ts-ignore
        p_supplier_payment: activeTab.supplierPayment || null // NEW PARAM
      });

      if (error) {
        console.error("Supabase RPC Error raw:", error);
        throw error;
      }

      const result = data as { success: boolean; sale_id?: string; sale_number?: number; error?: string; total?: number };
      console.log("RPC Result:", result);

      if (!result.success) {
        throw new Error(result.error || "Error al procesar la venta");
      }

      setLastSaleTotal(result.total || total);

      // Prepare Ticket Data
      setLastSaleData({
        date: new Date(),
        id: result.sale_id || "N/A",
        saleNumber: result.sale_number,
        items: cart.map(item => ({
          quantity: item.quantity,
          product_name: item.product.name,
          total: item.quantity * (item.product.price || 0) // Approximation if not returned
        })),
        subtotal: subtotal,
        total: total,
        discount: activeTab.discount || 0,
        surcharge: activeTab.surcharge || 0,
        payments: activeTab.payments,
        customer: activeTab.customerId ? customers.find(c => c.id === activeTab.customerId) : undefined,
        // TODO: Get real org data
        organization: { name: "Mi Negocio" }
      });

      clearCart();
      setShowSuccessModal(true);
      fetchData();
    } catch (error: any) {
      console.error("Error processing sale (full):", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      alert(`Error al procesar la venta: ${error.message || JSON.stringify(error) || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") { e.preventDefault(); setShowShortcutsModal(true); }
      if (e.key === "F2") { e.preventDefault(); searchInputRef.current?.focus(); } // Process Sale is separate button, F2 on button
      if (e.key === "F3") { e.preventDefault(); setShowProductModal(true); }
      if (e.key === "F4") { e.preventDefault(); addNewTab(); }
      if (e.key === "F8" && cart.length > 0) { e.preventDefault(); setShowConfirmModal(true); }
      if (e.key === "Escape") {
        setShowProductModal(false);
        setShowConfirmModal(false);
        setShowSuccessModal(false);
        setShowShortcutsModal(false);
      }
      // Ctrl+1-9 Tabs
      if (e.ctrlKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabs[tabIndex]) setActiveTabId(tabs[tabIndex].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, tabs]);


  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = Math.max(0, subtotal - (activeTab.discount || 0) + (activeTab.surcharge || 0));

  if (orgLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] md:h-[100vh] -m-3 md:-m-6 bg-background shadow-2xl">
      <POSHeader
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onAddTab={addNewTab}
        onCloseTab={closeTab}
        onShowShortcuts={() => setShowShortcutsModal(true)}
      />

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-background">
        <div className="flex-1 flex flex-col min-h-0 lg:border-r border-border">
          <POSProductSearch
            products={products}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onProductSelect={addToCart}
            onOpenCatalog={() => setShowProductModal(true)}
            searchInputRef={searchInputRef}
          />
          <POSCart
            items={cart}
            onUpdateQuantity={updateQuantity}
            onRemove={removeFromCart}
            onClear={clearCart}
            subtotal={subtotal}
            totalItems={totalItems}
          />
        </div>

        <POSPaymentPanel
          activeTab={activeTab}
          customers={customers}
          subtotal={subtotal}
          total={Math.max(0, subtotal - (activeTab.discount || 0) + (activeTab.surcharge || 0))}
          onCustomerChange={handleCustomerChange}
          onAddPayment={handleAddPayment}
          onRemovePayment={handleRemovePayment}
          onSetPayments={handleSetPayments}
          onProcessSale={processSale}
          processing={isProcessing}
          discount={activeTab.discount}
          surcharge={activeTab.surcharge}
          onUpdateDiscount={(val) => updateActiveTab({ discount: val })}
          onUpdateSurcharge={(val) => updateActiveTab({ surcharge: val })}
          suppliers={suppliers}
          onSupplierPaymentChange={handleSupplierPaymentChange}
        />
      </div>

      <POSProductModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        products={products}
        onSelect={addToCart}
      />

      <POSShortcutsModal
        open={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Venta</DialogTitle>
            <DialogDescription>
              ¿Está seguro de procesar esta venta por <b>${total.toLocaleString("es-AR")}</b>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button onClick={processSale} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <div className="flex flex-col items-center justify-center p-6 space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground">¡Venta Exitosa!</DialogTitle>
            <div className="text-center space-y-1">
              <p className="text-muted-foreground">Total cobrado</p>
              <p className="text-3xl font-bold text-emerald-500">${lastSaleTotal.toLocaleString("es-AR")}</p>
            </div>
          </div>
          <DialogFooter className="sm:justify-center gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessModal(false);
                setShowTicketModal(true);
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir Ticket
            </Button>
            <Button
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500"
              onClick={() => setShowSuccessModal(false)}
            >
              Cerrar y Nueva Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TicketView
        open={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        saleData={lastSaleData}
      />
    </div>
  );
}
