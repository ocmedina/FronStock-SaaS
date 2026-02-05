'use client';

import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBarProps {
    shortcuts?: Array<{ key: string; label: string }>;
}

const DEFAULT_SHORTCUTS = [
    { key: 'F1', label: 'Buscar' },
    { key: 'F3', label: 'Catálogo' },
    { key: 'F8', label: 'Suspender' },
    { key: 'F9', label: 'Recuperar' },
    { key: 'F12', label: 'Cobrar' },
    { key: 'Esc', label: 'Limpiar' },
];

export function StatusBar({ shortcuts = DEFAULT_SHORTCUTS }: StatusBarProps) {
    return (
        <div className="h-10 bg-muted/30 border-t border-border px-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span className="font-medium">Atajos:</span>
            </div>

            <div className="flex items-center gap-3">
                {shortcuts.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-1">
                        <kbd className={cn(
                            'px-1.5 py-0.5 rounded',
                            'bg-background border border-border',
                            'font-mono font-semibold text-[10px]'
                        )}>
                            {key}
                        </kbd>
                        <span className="text-muted-foreground">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
