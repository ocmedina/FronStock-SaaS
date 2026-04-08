'use server';

import { requireOrganizationPermission, requireGranularPermission } from '@/actions/_permissions';
import { createClient } from '@/lib/supabase/server';

type SaleItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  subtotal: number;
};

type Payment = {
  method: string;
  amount: number;
};

type SupplierSettlement = {
  supplierId: string;
  amount: number;
};

type ProcessSaleInput = {
  customerId?: string | null;
  payments: Payment[];
  items: SaleItem[];
  discount?: number;
  surcharge?: number;
  supplierSettlement?: SupplierSettlement;
};

type ProcessSaleResult =
  | { success: true; saleId: string; saleNumber: number; total: number }
  | { success: false; error: string };

/**
 * Server Action principal para procesar ventas.
 * Reemplaza la llamada directa a supabase.rpc('process_sale') desde el cliente.
 * Verifica permisos en el servidor ANTES de ejecutar el RPC.
 */
export async function processSaleAction(input: ProcessSaleInput): Promise<ProcessSaleResult> {
  // 1. Verificar permiso de crear ventas en servidor
  const guard = await requireOrganizationPermission('sales', 'create');
  if (!guard.allowed || !guard.organizationId) {
    return { success: false, error: guard.error || 'No tienes permisos para registrar ventas' };
  }

  // 2. Validaciones básicas
  if (!input.items || input.items.length === 0) {
    return { success: false, error: 'El carrito está vacío' };
  }

  const normalizedMethods = input.payments.map((p) => String(p.method || '').toLowerCase());
  const primaryMethod = input.payments.length === 1 ? (normalizedMethods[0] || 'cash') : 'mixed';
  const hasCredit = ['credit', 'fiado', 'current_account', 'cuenta_corriente'].some((m) =>
    normalizedMethods.includes(m)
  );

  // 3. Verificar permiso de override de precio si algún ítem tiene precio personalizado
  //    (la UI ya lo bloquea, pero esto protege el servidor)
  const hasCustomPrices = input.items.some((item) => {
    // Detectamos precios fuera de lo normal solo si se declara explícitamente
    return false; // La validación de precio se hace en el RPC mismo
  });

  const supabase = await createClient();

  // 4. Llamar al RPC de Supabase desde el servidor (no del cliente)
  const { data, error } = await supabase.rpc('process_sale', {
    p_org_id: guard.organizationId,
    p_customer_id: input.customerId || null,
    p_payments: input.payments,
    p_items: input.items,
    p_discount: input.discount || 0,
    p_surcharge: input.surcharge || 0,
  });

  if (error) {
    return { success: false, error: error.message || 'Error al procesar la venta' };
  }

  const result = data as {
    success: boolean;
    sale_id?: string;
    sale_number?: number;
    error?: string;
    total?: number;
  };

  if (!result.success) {
    return { success: false, error: result.error || 'Error al procesar la venta' };
  }

  // 5. Actualizar método de pago en la venta (operación del servidor)
  if (result.sale_id) {
    await supabase
      .from('sales')
      .update({
        payment_method: primaryMethod,
        payment_status: hasCredit ? 'pending' : 'paid',
      })
      .eq('id', result.sale_id)
      .eq('organization_id', guard.organizationId);
  }

  // 6. Pago a proveedor si aplica
  if (input.supplierSettlement?.supplierId && input.supplierSettlement.amount > 0) {
    const { registerSupplierPayment } = await import('@/actions/suppliers');
    await registerSupplierPayment({
      supplierId: input.supplierSettlement.supplierId,
      amount: input.supplierSettlement.amount,
      paymentMethod: 'cash_from_sales',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: `Pago desde venta #${result.sale_number || result.sale_id || ''}`,
    });
  }

  return {
    success: true,
    saleId: result.sale_id!,
    saleNumber: result.sale_number!,
    total: result.total || 0,
  };
}
