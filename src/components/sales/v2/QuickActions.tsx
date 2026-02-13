'use client';

import { Pause, History, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickActionsProps {
    suspendedCount?: number;
    onSuspendedClick?: () => void;
    onCatalogClick?: () => void;
    onHistoryClick?: () => void;
    onShortcutsClick?: () => void;
}

export function QuickActions({
    suspendedCount = 0,
    onSuspendedClick,
    onCatalogClick,
    onHistoryClick,
    onShortcutsClick,
}: QuickActionsProps) {
    return (
        <div className="fixed bottom-4 left-4 flex gap-2 z-40">
            {/* Suspended Sales */}
            {suspendedCount > 0 && onSuspendedClick && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onSuspendedClick}
                    className={cn(
                        'h-12 px-4 rounded-full shadow-lg',
                        'bg-amber-500 hover:bg-amber-600 text-white',
                        'gap-2 font-medium'
                    )}
                >
                    <Pause className="h-4 w-4" />
                    {suspendedCount} Suspendidas
                </Button>
            )}

            {/* History */}
            {onHistoryClick && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onHistoryClick}
                    className="h-12 px-4 rounded-full shadow-lg bg-blue-500 hover:bg-blue-600 text-white gap-2"
                >
                    <History className="h-4 w-4" />
                    Historial
                </Button>
            )}

            {/* Keyboard Shortcuts */}
            {onShortcutsClick && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onShortcutsClick}
                    className="h-12 w-12 rounded-full shadow-lg bg-gray-600 hover:bg-gray-700 text-white"
                >
                    <Keyboard className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}
