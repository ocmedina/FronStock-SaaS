"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EditOrderModal } from "@/components/orders/EditOrderModal";
import { useMediaQuery } from "@/hooks/use-media-query";

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [open, setOpen] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const supabase = createClient();

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*, customer:customers(*)")
          .eq("id", orderId)
          .single();

        if (error) throw error;
        setOrderData(data);
      } catch (error: any) {
        toast.error("No se pudo cargar el pedido");
        router.push("/dashboard/orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!orderData || !orderId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <EditOrderModal
        orderId={orderId}
        orderData={orderData}
        open={isDesktop ? false : open}
        inline={isDesktop}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            router.push("/dashboard/orders");
          }
        }}
        onSuccess={() => {
          router.push("/dashboard/orders");
        }}
      />
    </div>
  );
}
