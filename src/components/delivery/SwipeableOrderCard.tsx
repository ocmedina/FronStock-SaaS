"use client";

import { useRef, useState } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { Check, Info, Phone, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getDeliveryPaymentLabel } from "@/lib/utils/delivery";

interface SwipeableOrderCardProps {
    order: any;
    onSwipeRight: (orderId: string) => void;
    onViewDetails: (orderId: string) => void;
    children?: React.ReactNode;
}

export function SwipeableOrderCard({ order, onSwipeRight, onViewDetails, children }: SwipeableOrderCardProps) {
    const controls = useAnimation();
    const [actionState, setActionState] = useState<"idle" | "deliver">("idle");
    const SWIPE_THRESHOLD = 80;

    const handleDrag = (_: any, info: PanInfo) => {
        // Hacia la derecha = Entregar
        if (info.offset.x > SWIPE_THRESHOLD) {
            setActionState("deliver");
        } else {
            setActionState("idle");
        }
    };

    const handleDragEnd = async (_: any, info: PanInfo) => {
        if (info.offset.x > SWIPE_THRESHOLD) {
            // Animamos la tarjeta volando hacia la derecha y gatillamos acción
            await controls.start({ x: 500, opacity: 0, transition: { duration: 0.3 } });
            
            // Vibrar dispositivo táctil
            if (navigator.vibrate) navigator.vibrate(50);
            
            onSwipeRight(order.id);
            
            // Reset position silent
            controls.set({ x: 0, opacity: 1 });
            setActionState("idle");
        } else {
            // Rebotar a la posición inicial
            controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 25 } });
            setActionState("idle");
        }
    };

    return (
        <div className="relative w-full rounded-2xl overflow-hidden touch-pan-y shadow-lg mb-4 bg-slate-900 border border-slate-800">
            {/* Background Action Layer (underneath the swipable card) */}
            <div className="absolute inset-0 flex items-center justify-start px-8 bg-emerald-500">
                <div className={`flex flex-col items-center gap-1 transition-transform duration-200 ${actionState === 'deliver' ? 'scale-110 text-slate-950 font-black' : 'scale-95 text-emerald-950 font-bold'}`}>
                    <Check className="h-8 w-8" strokeWidth={3} />
                    <span className="text-[10px] uppercase tracking-wider">Entregar</span>
                </div>
            </div>

            {/* Draggable Top Layer */}
            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                animate={controls}
                whileTap={{ scale: 0.98 }}
                className="relative bg-slate-900 z-10 p-5 min-h-[120px] rounded-2xl border-l-[6px] border-l-slate-700 w-full flex flex-col justify-between cursor-grab active:cursor-grabbing"
            >
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0" onClick={() => onViewDetails(order.id)}>
                        <h3 className="text-xl font-extrabold text-white truncate drop-shadow-md">
                            {order.customer?.name || "Cliente Final"}
                        </h3>
                        {order.delivery_metadata?.address && (
                            <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="text-sm truncate opacity-90">{order.delivery_metadata.address}</span>
                            </div>
                        )}
                        {order.customer?.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="text-xs font-mono">{order.customer.phone}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-2xl font-black text-emerald-400 tracking-tight drop-shadow-sm">
                            ${Number(order.total).toLocaleString()}
                        </span>
                        
                        <div className="flex gap-2 items-center">
                            {order.payment_method && (
                                <Badge className="border-cyan-500/20 bg-cyan-500/10 font-bold text-[10px] text-cyan-200">
                                    {getDeliveryPaymentLabel(order.payment_method)}
                                </Badge>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onViewDetails(order.id);
                                }}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                            >
                                <Info className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {children && <div className="mt-3">{children}</div>}

                <div className="mt-4 pt-3 border-t border-slate-800/50 flex items-center justify-between pointer-events-none">
                    <p className="text-[10px] uppercase text-slate-500 font-bold tracking-widest flex items-center gap-2">
                        <span>Deslizar para Entregar</span>
                        <motion.span 
                            animate={{ x: [0, 5, 0] }} 
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                            →
                        </motion.span>
                    </p>
                    <span className="text-xs text-slate-600 font-semibold">#{order.id.slice(0, 8)}</span>
                </div>
            </motion.div>
        </div>
    );
}
