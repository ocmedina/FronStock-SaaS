"use client";

import React, { useCallback } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomNumpadProps {
    value: string; // The current numeric/string value (e.g., "1500", "0")
    onChange: (newValue: string) => void;
    onConfirm?: () => void;
    maxDecimals?: number;
}

export function CustomNumpad({ value, onChange, onConfirm, maxDecimals = 0 }: CustomNumpadProps) {
    const handlePress = useCallback((key: string) => {
        if (key === "backspace") {
            if (value.length > 0) {
                const newValue = value.slice(0, -1);
                onChange(newValue === "" ? "0" : newValue);
            }
            return;
        }

        if (key === "clear") {
            onChange("0");
            return;
        }

        // Prevent multiple decimals
        if (key === "." && value.includes(".")) {
            return;
        }
        // If maxDecimals is 0, ignore decimal pushes
        if (key === "." && maxDecimals === 0) {
            return;
        }

        // Handle initial zero replacing
        let newValue = value;
        if (newValue === "0" && key !== ".") {
            newValue = key;
        } else {
            newValue += key;
        }

        // Enforce max decimals if applicable
        if (maxDecimals > 0 && newValue.includes(".")) {
            const [, decimalPart] = newValue.split(".");
            if (decimalPart && decimalPart.length > maxDecimals) {
                return;
            }
        }

        onChange(newValue);
    }, [value, onChange, maxDecimals]);

    const buttons = [
        "1", "2", "3",
        "4", "5", "6",
        "7", "8", "9",
        "00", "0", "backspace"
    ];

    return (
        <div className="w-full bg-slate-950 p-4 rounded-t-3xl sm:rounded-3xl shadow-xl border-t sm:border border-slate-800">
            {/* Display header (optional inside the numpad, usually handled outside, but useful for feedback) */}
            <div className="grid grid-cols-3 gap-3">
                {buttons.map((btn) => {
                    const isAction = btn === "backspace" || btn === "clear";
                    return (
                        <button
                            key={btn}
                            onClick={() => handlePress(btn)}
                            className={cn(
                                "h-16 rounded-2xl flex items-center justify-center text-3xl font-bold transition-all active:scale-95",
                                isAction
                                    ? "bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white"
                                    : "bg-slate-800 text-white hover:bg-slate-700 active:bg-slate-600 shadow-md",
                                btn === "0" && "", // Could make "0" take 2 columns if wanted, but preserving 3x4 grid
                            )}
                        >
                            {btn === "backspace" ? <Delete className="h-8 w-8" /> : btn}
                        </button>
                    );
                })}
            </div>
            
            {onConfirm && (
                <button 
                    onClick={onConfirm}
                    className="w-full mt-4 h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all text-xl font-black text-white shadow-lg shadow-emerald-600/20"
                >
                    Confirmar Monto
                </button>
            )}
        </div>
    );
}
