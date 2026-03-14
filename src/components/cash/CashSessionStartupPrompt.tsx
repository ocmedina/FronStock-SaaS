"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOpenCashSession, shouldRequireOpenCashSession } from "@/lib/cash-session";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const promptStorageKey = (organizationId: string) => `cash-session-startup-prompt:${organizationId}`;
const promptEnabledStorageKey = (organizationId: string) => `cash-session-startup-prompt-enabled:${organizationId}`;

export function CashSessionStartupPrompt() {
  const supabase = useMemo(() => createClient(), []);
  const { organizationId, organization, profile, isLoading } = useOrganization();

  const [open, setOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isOpening, setIsOpening] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");

  useEffect(() => {
    let cancelled = false;

    const checkStartupPrompt = async () => {
      if (isLoading || !organizationId) {
        return;
      }

      const storageKey = promptStorageKey(organizationId);
      const enabledRaw = localStorage.getItem(promptEnabledStorageKey(organizationId));
      const isEnabled = enabledRaw === null ? true : enabledRaw === "true";

      if (!isEnabled) {
        if (!cancelled) {
          setIsChecking(false);
        }
        return;
      }

      if (sessionStorage.getItem(storageKey) === "handled") {
        if (!cancelled) {
          setIsChecking(false);
        }
        return;
      }

      const session = await getOpenCashSession(supabase, organizationId);
      if (cancelled) {
        return;
      }

      const shouldPrompt = shouldRequireOpenCashSession({
        organization,
        profile,
        // En startup no sabemos metodo de pago; solo validamos alcance/politica global.
        paymentMethods: ["cash"],
      });

      if (!shouldPrompt) {
        sessionStorage.setItem(storageKey, "handled");
        setIsChecking(false);
        return;
      }

      if (session) {
        sessionStorage.setItem(storageKey, "handled");
        setIsChecking(false);
        return;
      }

      setOpen(true);
      setIsChecking(false);
    };

    void checkStartupPrompt();

    return () => {
      cancelled = true;
    };
  }, [isLoading, organizationId, organization, profile, supabase]);

  const handleSkip = () => {
    if (!organizationId) return;
    sessionStorage.setItem(promptStorageKey(organizationId), "handled");
    setOpen(false);
  };

  const handleOpenCash = async () => {
    if (!organizationId || isOpening) return;

    const opening = Number(openingAmount || 0);
    if (!Number.isFinite(opening) || opening < 0) {
      toast.error("Ingresa un monto de apertura válido");
      return;
    }

    setIsOpening(true);
    try {
      const { data: result, error } = await supabase.rpc("open_cash_session", {
        p_org_id: organizationId,
        p_opening_amount: opening,
        p_notes: openingNotes || null,
      });

      if (error) throw error;
      if (result?.success === false) {
        throw new Error(result?.error || "No se pudo abrir la caja");
      }

      sessionStorage.setItem(promptStorageKey(organizationId), "handled");
      setOpen(false);
      toast.success("Caja abierta correctamente");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo abrir la caja");
    } finally {
      setIsOpening(false);
    }
  };

  if (isChecking) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleSkip()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
          <DialogDescription>
            No hay una caja abierta para esta sesión. ¿Querés abrirla ahora?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
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
          <div className="space-y-2">
            <p className="text-sm font-medium">Notas (opcional)</p>
            <Textarea
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="Observaciones de apertura"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleSkip} disabled={isOpening}>
            No por ahora
          </Button>
          <Button onClick={handleOpenCash} disabled={isOpening}>
            {isOpening ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Abrir caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
