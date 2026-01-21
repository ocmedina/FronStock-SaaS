'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type LayoutMode = 'sidebar' | 'navbar';

interface LayoutContextType {
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
}

const LayoutContext = createContext<LayoutContextType>({
    layoutMode: 'sidebar',
    setLayoutMode: () => { },
});

export const useLayout = () => useContext(LayoutContext);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('sidebar');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem('layout-mode') as LayoutMode;
        if (saved === 'sidebar' || saved === 'navbar') {
            setLayoutMode(saved);
        }
    }, []);

    const handleSetLayoutMode = (mode: LayoutMode) => {
        setLayoutMode(mode);
        localStorage.setItem('layout-mode', mode);
    };

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <LayoutContext.Provider value={{ layoutMode, setLayoutMode: handleSetLayoutMode }}>
            {children}
        </LayoutContext.Provider>
    );
}
