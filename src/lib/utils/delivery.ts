/**
 * Shared utility functions for the Delivery module.
 * Centralizes logic duplicated across delivery/page.tsx, orders/page.tsx,
 * history/page.tsx, and OrderDetailsModal.tsx
 */

export const DELIVERY_PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  mixed: 'Mixto',
  fiado: 'Fiado',
  credit: 'Cuenta Corriente',
  current_account: 'Cuenta Corriente',
  cuenta_corriente: 'Cuenta Corriente',
};

/** Translates a payment method key to a human-readable label */
export function getDeliveryPaymentLabel(method?: string | null): string {
  if (!method) return 'Sin definir';
  return DELIVERY_PAYMENT_LABELS[method.toLowerCase()] ?? method;
}

/** Returns the summary payment label for an order considering multiple payments */
export function getOrderPaymentSummary(order: {
  payment_method?: string | null;
  order_payments?: { method?: string; payment_method?: string }[];
}): string {
  const payments = Array.isArray(order?.order_payments) ? order.order_payments : [];
  const methods: string[] = Array.from(
    new Set(
      payments
        .map((p) => String(p.method || p.payment_method || '').toLowerCase())
        .filter(Boolean)
    )
  );
  if (methods.length > 1) return 'Mixto';
  if (methods.length === 1) return getDeliveryPaymentLabel(methods[0]);
  return getDeliveryPaymentLabel(order?.payment_method);
}

/** Normalizes delivery status strings from different schema versions */
export function normalizeDeliveryStatus(rawStatus?: string): string {
  const status = String(rawStatus || '').toLowerCase();
  if (['delivered', 'completed', 'entregado', 'done'].includes(status)) return 'delivered';
  if (['not_delivered', 'not_home', 'failed', 'returned', 'no_entregado'].includes(status)) return 'not_delivered';
  if (['cancelled', 'canceled', 'rejected'].includes(status)) return 'cancelled';
  if (['rescheduled', 'reprogramado'].includes(status)) return 'rescheduled';
  return status || 'pending';
}
