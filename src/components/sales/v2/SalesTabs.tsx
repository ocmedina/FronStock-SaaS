'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SalesTab {
    id: string;
    name: string;
}

interface SalesTabsProps {
    tabs: SalesTab[];
    activeTabId: string;
    onTabChange: (tabId: string) => void;
    onTabClose: (tabId: string) => void;
    onTabAdd: () => void;
}

export function SalesTabs({
    tabs,
    activeTabId,
    onTabChange,
    onTabClose,
    onTabAdd,
}: SalesTabsProps) {
    return (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/20">
            {/* Tabs */}
            <div className="flex items-center gap-1 flex-1 overflow-x-auto">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={cn(
                            'group flex items-center gap-2 px-4 py-2 rounded-lg transition-colors cursor-pointer',
                            activeTabId === tab.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background hover:bg-accent'
                        )}
                        onClick={() => onTabChange(tab.id)}
                    >
                        <span className="text-sm font-medium whitespace-nowrap">{tab.name}</span>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTabClose(tab.id);
                                }}
                                className={cn(
                                    'opacity-0 group-hover:opacity-100 transition-opacity',
                                    'hover:bg-destructive/20 rounded p-0.5'
                                )}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Tab Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={onTabAdd}
                className="shrink-0 h-8 w-8 p-0"
            >
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
}
