"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AccessDenied } from "@/components/Protected";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Banknote, ArrowRightLeft, HandCoins, ReceiptText, TrendingUp, Eye } from "lucide-react";
import { toast } from "sonner";
import { getOpenCashSession } from "@/lib/cash-session";

type PaymentKey = "cash" | "transfer" | "card" | "credit" | "other";

type MethodTotals = Record<PaymentKey, number>;

interface CashClosingData {
  soldTotal: number;
  soldLocal: number;
  soldDelivery: number;
  collectedTotal: number;
  collectedLocal: number;
  collectedDelivery: number;
  expensesTotal: number;
  fiadoTotal: number;
  expectedCash: number;
  expectedTransfer: number;
  soldByMethod: MethodTotals;
  collectedByMethod: MethodTotals;
  expensesByMethod: MethodTotals;
}

interface SavedCashClosing {
  id: string;
  closure_date: string;
  sold_total: number;
  sold_local: number;
  sold_delivery: number;
  collected_total: number;
  collected_local: number;
  collected_delivery: number;
  expenses_total: number;
  fiado_total: number;
  expected_cash: number;
  expected_transfer: number;
  sold_by_method?: Record<string, number> | null;
  collected_by_method?: Record<string, number> | null;
  expenses_by_method?: Record<string, number> | null;
  closed_at: string;
}

interface ActiveCashSession {
  id: string;
  opened_at: string;
  opening_amount: number;
  register_id: string;
  status: "open" | "closed";
}

const emptyTotals = (): MethodTotals => ({
  cash: 0,
  transfer: 0,
  card: 0,
  credit: 0,
  other: 0,
});

const defaultData: CashClosingData = {
  soldTotal: 0,
  soldLocal: 0,
  soldDelivery: 0,
  collectedTotal: 0,
  collectedLocal: 0,
  collectedDelivery: 0,
  expensesTotal: 0,
  fiadoTotal: 0,
  expectedCash: 0,
  expectedTransfer: 0,
  soldByMethod: emptyTotals(),
  collectedByMethod: emptyTotals(),
  expensesByMethod: emptyTotals(),
};

const normalizeMethod = (method: unknown): PaymentKey => {
  const value = String(method || "").toLowerCase();
  if (value === "cash" || value === "efectivo") return "cash";
  if (value === "transfer" || value === "transferencia") return "transfer";
  if (value === "card" || value === "tarjeta" || value === "debit_card" || value === "credit_card") return "card";
  if (value === "credit" || value === "fiado" || value === "account") return "credit";
  return "other";
};

const methodLabel: Record<PaymentKey, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card: "Tarjeta",
  credit: "Fiado",
  other: "Otros",
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toMethodTotals = (value: unknown): MethodTotals => {
  const source = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    cash: Number(source.cash || 0),
    transfer: Number(source.transfer || 0),
    card: Number(source.card || 0),
    credit: Number(source.credit || 0),
    other: Number(source.other || 0),
  };
};

const getTodayRange = () => {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return {
    dayStart,
    dayEnd,
    startIso: dayStart.toISOString(),
    endIso: dayEnd.toISOString(),
    dateKey: dayStart.toISOString().slice(0, 10),
  };
};

export default function CashClosingPage() {
  const supabase = useMemo(() => createClient(), []);
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { canView } = usePermissions();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<CashClosingData>(defaultData);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [history, setHistory] = useState<SavedCashClosing[]>([]);
  const [selectedClosing, setSelectedClosing] = useState<SavedCashClosing | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveCashSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState<string>("0");
  const [openingNotes, setOpeningNotes] = useState<string>("");
  const [countedCash, setCountedCash] = useState<string>("");
  const [closeNotes, setCloseNotes] = useState<string>("");

  const fetchCashClosing = useCallback(async () => {
    if (!organizationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { startIso, endIso } = getTodayRange();

      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id, total, payment_method, payment_status, channel")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .gte("created_at", startIso)
        .lt("created_at", endIso);

      if (salesError) throw salesError;

      const mixedSaleIds = (sales || [])
        .filter((sale: any) => String(sale.payment_method || "").toLowerCase() === "mixed")
        .map((sale: any) => sale.id);

      const [salePaymentsResult, orderPaymentsResult, ordersResult, supplierPaymentsResult] = await Promise.all([
        mixedSaleIds.length > 0
          ? supabase
              .from("sale_payments")
              .select("sale_id, amount, payment_method")
              .eq("organization_id", organizationId)
              .in("sale_id", mixedSaleIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("order_payments")
          .select("amount, method")
          .eq("organization_id", organizationId)
          .gte("paid_at", startIso)
          .lt("paid_at", endIso),
        supabase
          .from("orders")
          .select("total, payment_status, payment_method, payment_amount, lifecycle_status, delivery_status")
          .eq("organization_id", organizationId)
          .gte("created_at", startIso)
          .lt("created_at", endIso),
        supabase
          .from("supplier_payments")
          .select("amount, payment_method")
          .eq("organization_id", organizationId)
          .gte("payment_date", startIso.slice(0, 10))
          .lt("payment_date", endIso.slice(0, 10)),
      ]);

      if (salePaymentsResult.error) throw salePaymentsResult.error;
      if (orderPaymentsResult.error) throw orderPaymentsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (supplierPaymentsResult.error) throw supplierPaymentsResult.error;

      const soldByMethod = emptyTotals();
      const collectedByMethod = emptyTotals();
      const expensesByMethod = emptyTotals();

      let soldLocal = 0;
      let soldDelivery = 0;
      let collectedLocal = 0;
      let collectedDelivery = 0;
      let fiadoTotal = 0;

      const salePaymentsBySale = new Map<string, Array<{ amount: number; payment_method: string }>>();
      (salePaymentsResult.data || []).forEach((payment: any) => {
        const saleId = String(payment.sale_id || "");
        if (!saleId) return;
        const list = salePaymentsBySale.get(saleId) || [];
        list.push({
          amount: Number(payment.amount || 0),
          payment_method: String(payment.payment_method || ""),
        });
        salePaymentsBySale.set(saleId, list);
      });

      (sales || []).forEach((sale: any) => {
        const total = Number(sale.total || 0);
        const paymentStatus = String(sale.payment_status || "paid").toLowerCase();
        const normalizedMethod = normalizeMethod(sale.payment_method);
        const isMixed = String(sale.payment_method || "").toLowerCase() === "mixed";

        soldLocal += total;

        if (isMixed) {
          const paymentParts = salePaymentsBySale.get(String(sale.id || "")) || [];
          if (paymentParts.length === 0) {
            soldByMethod.other += total;
          } else {
            paymentParts.forEach((part) => {
              const method = normalizeMethod(part.payment_method);
              soldByMethod[method] += Number(part.amount || 0);
            });
          }
        } else {
          soldByMethod[normalizedMethod] += total;
        }

        if (paymentStatus === "pending" || paymentStatus === "partial") {
          fiadoTotal += total;
        }

        if (isMixed) {
          const paymentParts = salePaymentsBySale.get(String(sale.id || "")) || [];
          paymentParts.forEach((part) => {
            const method = normalizeMethod(part.payment_method);
            const amount = Number(part.amount || 0);
            collectedByMethod[method] += amount;
            collectedLocal += amount;
          });
        } else if (paymentStatus === "paid") {
          collectedByMethod[normalizedMethod] += total;
          collectedLocal += total;
        }
      });

      (ordersResult.data || []).forEach((order: any) => {
        const lifecycle = String(order.lifecycle_status || order.delivery_status || "").toLowerCase();
        if (lifecycle === "cancelled" || lifecycle === "canceled" || lifecycle === "returned") return;

        const total = Number(order.total || 0);
        const paymentMethod = normalizeMethod(order.payment_method);
        const paymentStatus = String(order.payment_status || "pending").toLowerCase();
        const paidAmount = Number(order.payment_amount || 0);

        soldDelivery += total;
        soldByMethod[paymentMethod] += total;

        if (paymentMethod === "credit" && (paymentStatus === "pending" || paymentStatus === "partial")) {
          fiadoTotal += Math.max(total - Math.max(paidAmount, 0), 0);
        }
      });

      (orderPaymentsResult.data || []).forEach((payment: any) => {
        const amount = Number(payment.amount || 0);
        const method = normalizeMethod(payment.method);
        collectedByMethod[method] += amount;
        collectedDelivery += amount;
      });

      (supplierPaymentsResult.data || []).forEach((payment: any) => {
        const amount = Number(payment.amount || 0);
        const method = normalizeMethod(payment.payment_method);
        expensesByMethod[method] += amount;
      });

      const soldTotal = soldLocal + soldDelivery;
      const collectedTotal = collectedLocal + collectedDelivery;
      const expensesTotal = Object.values(expensesByMethod).reduce((sum, value) => sum + Number(value || 0), 0);

      setData({
        soldTotal,
        soldLocal,
        soldDelivery,
        collectedTotal,
        collectedLocal,
        collectedDelivery,
        expensesTotal,
        fiadoTotal,
        expectedCash: collectedByMethod.cash - expensesByMethod.cash,
        expectedTransfer: collectedByMethod.transfer - expensesByMethod.transfer,
        soldByMethod,
        collectedByMethod,
        expensesByMethod,
      });
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el cierre de caja");
      setData(defaultData);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, supabase]);

  const fetchHistory = useCallback(async () => {
    if (!organizationId) return;

    const { data: closings, error: closingsError } = await supabase
      .from("cash_closings")
      .select("id, closure_date, sold_total, sold_local, sold_delivery, collected_total, collected_local, collected_delivery, expenses_total, fiado_total, expected_cash, expected_transfer, sold_by_method, collected_by_method, expenses_by_method, closed_at")
      .eq("organization_id", organizationId)
      .order("closure_date", { ascending: false })
      .limit(30);

    if (closingsError) {
      setHistory([]);
      return;
    }

    setHistory((closings || []) as SavedCashClosing[]);
  }, [organizationId, supabase]);

  const saveCurrentClosingSnapshot = useCallback(async (overrides?: { expectedCash?: number }) => {
    if (!organizationId || isSaving) return;

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { dateKey } = getTodayRange();

      const { error: saveError } = await supabase
        .from("cash_closings")
        .upsert(
          {
            organization_id: organizationId,
            closure_date: dateKey,
            sold_total: data.soldTotal,
            sold_local: data.soldLocal,
            sold_delivery: data.soldDelivery,
            collected_total: data.collectedTotal,
            collected_local: data.collectedLocal,
            collected_delivery: data.collectedDelivery,
            expenses_total: data.expensesTotal,
            fiado_total: data.fiadoTotal,
            expected_cash: overrides?.expectedCash ?? data.expectedCash,
            expected_transfer: data.expectedTransfer,
            sold_by_method: data.soldByMethod,
            collected_by_method: data.collectedByMethod,
            expenses_by_method: data.expensesByMethod,
            closed_by: user?.id || null,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "organization_id,closure_date",
          },
        );

      if (saveError) throw saveError;

      toast.success("Cierre del día guardado correctamente");
      await fetchHistory();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el cierre del día");
    } finally {
      setIsSaving(false);
    }
  }, [organizationId, isSaving, supabase, data, fetchHistory]);

  const fetchActiveSession = useCallback(async () => {
    if (!organizationId) return;
    const session = await getOpenCashSession(supabase, organizationId);
    setActiveSession(session as ActiveCashSession | null);
  }, [organizationId, supabase]);

  const handleOpenSession = useCallback(async () => {
    if (!organizationId || isOpening) return;

    setIsOpening(true);
    try {
      const { data: result, error: openError } = await supabase.rpc("open_cash_session", {
        p_org_id: organizationId,
        p_opening_amount: Number(openingAmount || 0),
        p_notes: openingNotes || null,
      });

      if (openError) throw openError;
      if (result?.success === false) throw new Error(result?.error || "No se pudo abrir caja");

      toast.success("Caja abierta correctamente");
      setOpeningNotes("");
      await fetchActiveSession();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo abrir la caja");
    } finally {
      setIsOpening(false);
    }
  }, [organizationId, isOpening, supabase, openingAmount, openingNotes, fetchActiveSession]);

  const handleCloseSession = useCallback(async () => {
    if (!organizationId || !activeSession || isClosing) return;

    const countedValue = Number(countedCash || 0);
    if (!Number.isFinite(countedValue) || countedValue < 0) {
      toast.error("Ingresa un conteo válido");
      return;
    }

    setIsClosing(true);
    try {
      const { data: result, error: closeError } = await supabase.rpc("close_cash_session", {
        p_org_id: organizationId,
        p_counted_cash: countedValue,
        p_notes: closeNotes || null,
      });

      if (closeError) throw closeError;
      if (result?.success === false) throw new Error(result?.error || "No se pudo cerrar caja");

      await saveCurrentClosingSnapshot({
        expectedCash: Number(result?.expected_cash || 0),
      });
      await Promise.all([fetchCashClosing(), fetchHistory(), fetchActiveSession()]);

      setCountedCash("");
      setCloseNotes("");

      const difference = Number(result?.difference_cash || 0);
      if (difference === 0) {
        toast.success("Caja cerrada sin diferencias");
      } else if (difference > 0) {
        toast.success(`Caja cerrada con sobrante de ${formatMoney(difference)}`);
      } else {
        toast.error(`Caja cerrada con faltante de ${formatMoney(Math.abs(difference))}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cerrar la caja");
    } finally {
      setIsClosing(false);
    }
  }, [organizationId, activeSession, isClosing, countedCash, closeNotes, supabase, saveCurrentClosingSnapshot, fetchCashClosing, fetchHistory, fetchActiveSession]);

  useEffect(() => {
    if (!orgLoading && organizationId) {
      fetchCashClosing();
      fetchHistory();
      fetchActiveSession();
    }
  }, [orgLoading, organizationId, fetchCashClosing, fetchHistory, fetchActiveSession]);

  if (!orgLoading && !canView("reports")) {
    return <AccessDenied message="No tienes permiso para acceder al cierre de caja" />;
  }

  const netResult = data.collectedTotal - data.expensesTotal;
  const selectedSoldByMethod = toMethodTotals(selectedClosing?.sold_by_method);
  const selectedCollectedByMethod = toMethodTotals(selectedClosing?.collected_by_method);
  const selectedExpensesByMethod = toMethodTotals(selectedClosing?.expenses_by_method);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cierre de Caja</h1>
          <p className="text-sm text-muted-foreground">Apertura y cierre operativo de caja con control de diferencias y auditoría diaria.</p>
        </div>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Turno de caja</CardTitle>
          <CardDescription>
            {activeSession
              ? `Caja abierta desde ${new Date(activeSession.opened_at).toLocaleString("es-AR")}`
              : "No hay caja abierta. Debes abrir caja para operar en POS y pedidos online."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeSession ? (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Monto de apertura</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <p className="text-sm font-medium">Observaciones de apertura</p>
                <Textarea
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Opcional"
                  className="min-h-[44px]"
                />
              </div>
              <div className="md:col-span-3">
                <Button onClick={handleOpenSession} disabled={isOpening || isLoading}>
                  {isOpening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Abrir caja
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Apertura registrada</p>
                <div className="rounded-md border px-3 py-2 text-sm font-medium">
                  {formatMoney(Number(activeSession.opening_amount || 0))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Efectivo esperado (sistema)</p>
                <div className="rounded-md border px-3 py-2 text-sm font-medium">
                  {formatMoney(data.expectedCash + Number(activeSession.opening_amount || 0))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Conteo físico de efectivo</p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2 md:col-span-3">
                <p className="text-sm font-medium">Observaciones de cierre</p>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Motivo de diferencia, incidencias, etc."
                />
              </div>
              <div className="md:col-span-3 flex items-center gap-2 flex-wrap">
                <Button onClick={handleCloseSession} disabled={isClosing || isSaving || isLoading}>
                  {isClosing || isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Cerrar caja y día
                </Button>
                {countedCash !== "" ? (
                  <Badge variant={Number(countedCash) - (data.expectedCash + Number(activeSession.opening_amount || 0)) >= 0 ? "default" : "destructive"}>
                    Diferencia preliminar: {formatMoney(Number(countedCash) - (data.expectedCash + Number(activeSession.opening_amount || 0)))}
                  </Badge>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando cierre del día...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardDescription>Vendido hoy</CardDescription>
                <CardTitle className="text-xl">{formatMoney(data.soldTotal)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <div>Local: {formatMoney(data.soldLocal)}</div>
                <div>Reparto: {formatMoney(data.soldDelivery)}</div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardDescription>Cobrado hoy</CardDescription>
                <CardTitle className="text-xl">{formatMoney(data.collectedTotal)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <div>Local: {formatMoney(data.collectedLocal)}</div>
                <div>Reparto: {formatMoney(data.collectedDelivery)}</div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardDescription>Gastos del día</CardDescription>
                <CardTitle className="text-xl">{formatMoney(data.expensesTotal)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Pagos a proveedores y egresos registrados.</CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardDescription>Resultado neto</CardDescription>
                <CardTitle className="text-xl">{formatMoney(netResult)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={netResult >= 0 ? "default" : "destructive"}>
                  {netResult >= 0 ? "Positivo" : "Negativo"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Esperado en caja</CardDescription>
                <CardTitle className="text-xl">{formatMoney(data.expectedCash)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Cobros en efectivo menos gastos en efectivo.</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Esperado en transferencias</CardDescription>
                <CardTitle className="text-xl">{formatMoney(data.expectedTransfer)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Cobros por transferencia menos egresos por transferencia.</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Fiado generado</CardDescription>
                <CardTitle className="text-xl">{formatMoney(data.fiadoTotal)}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Ventas y pedidos con pago pendiente/parcial.</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <ReceiptText className="h-4 w-4" />
                Detalle por método de pago
              </CardTitle>
              <CardDescription>Comparativo entre vendido, cobrado y gastos por tipo de pago.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Vendido</TableHead>
                      <TableHead className="text-right">Cobrado</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["cash", "transfer", "card", "credit", "other"] as PaymentKey[]).map((key) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{methodLabel[key]}</TableCell>
                        <TableCell className="text-right">{formatMoney(data.soldByMethod[key])}</TableCell>
                        <TableCell className="text-right">{formatMoney(data.collectedByMethod[key])}</TableCell>
                        <TableCell className="text-right">{formatMoney(data.expensesByMethod[key])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  Efectivo cobrado
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(data.collectedByMethod.cash)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferencias cobradas
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(data.collectedByMethod.transfer)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HandCoins className="h-4 w-4" />
                  Gastos en efectivo
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(data.expensesByMethod.cash)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Gastos por transferencia
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(data.expensesByMethod.transfer)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Cobrado con tarjeta
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xl font-semibold">{formatMoney(data.collectedByMethod.card)}</CardContent>
            </Card>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Historial de cierres</CardTitle>
              <CardDescription>Se guardan los días cerrados para seguimiento y control.</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay cierres guardados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-right">Vendido</TableHead>
                        <TableHead className="text-right">Cobrado</TableHead>
                        <TableHead className="text-right">Gastos</TableHead>
                        <TableHead className="text-right">Fiado</TableHead>
                        <TableHead className="text-right">Caja esperada</TableHead>
                        <TableHead className="text-right">Transfer. esperada</TableHead>
                        <TableHead className="text-right">Detalle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {new Date(`${item.closure_date}T00:00:00`).toLocaleDateString("es-AR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={item.collected_total - item.expenses_total >= 0 ? "default" : "destructive"}>
                              {formatMoney(item.collected_total - item.expenses_total)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatMoney(item.sold_total)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.collected_total)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.expenses_total)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.fiado_total)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.expected_cash)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.expected_transfer)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedClosing(item)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver detalle
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={!!selectedClosing} onOpenChange={(open) => !open && setSelectedClosing(null)}>
            <DialogContent className="w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] h-[92vh] max-h-[92vh] overflow-y-auto p-4 sm:w-full sm:max-w-4xl sm:h-auto sm:max-h-[90vh] sm:p-6 lg:max-w-6xl xl:max-w-7xl">
              <DialogHeader>
                <DialogTitle>
                  Detalle del cierre {selectedClosing ? new Date(`${selectedClosing.closure_date}T00:00:00`).toLocaleDateString("es-AR") : ""}
                </DialogTitle>
              </DialogHeader>

              {selectedClosing && (
                <div className="space-y-4">
                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2 2xl:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-1">
                        <CardDescription>Vendido</CardDescription>
                        <CardTitle className="text-2xl tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.sold_total)}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p className="leading-none">Local: <span className="tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.sold_local)}</span></p>
                        <p className="leading-none">Reparto: <span className="tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.sold_delivery)}</span></p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-1">
                        <CardDescription>Cobrado</CardDescription>
                        <CardTitle className="text-2xl tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.collected_total)}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p className="leading-none">Local: <span className="tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.collected_local)}</span></p>
                        <p className="leading-none">Reparto: <span className="tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.collected_delivery)}</span></p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-1">
                        <CardDescription>Gastos</CardDescription>
                        <CardTitle className="text-2xl tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.expenses_total)}</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground space-y-1">
                        <p className="leading-none">Fiado: <span className="tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.fiado_total)}</span></p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-1">
                        <CardDescription>Resultado Neto</CardDescription>
                        <CardTitle className="text-2xl tabular-nums whitespace-nowrap">{formatMoney(selectedClosing.collected_total - selectedClosing.expenses_total)}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge variant={selectedClosing.collected_total - selectedClosing.expenses_total >= 0 ? "default" : "destructive"}>
                          {selectedClosing.collected_total - selectedClosing.expenses_total >= 0 ? "Positivo" : "Negativo"}
                        </Badge>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Desglose por método</CardTitle>
                      <CardDescription>Comparativo de vendido, cobrado y gastos por método en el cierre seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Método</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Vendido</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Cobrado</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Gastos</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(["cash", "transfer", "card", "credit", "other"] as PaymentKey[]).map((key) => (
                              <TableRow key={key}>
                                <TableCell className="font-medium">{methodLabel[key]}</TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(selectedSoldByMethod[key])}</TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(selectedCollectedByMethod[key])}</TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">{formatMoney(selectedExpensesByMethod[key])}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
