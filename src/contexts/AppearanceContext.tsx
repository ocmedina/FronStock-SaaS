'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type DensityMode = 'comfortable' | 'compact';
export type FontSizeMode = 'sm' | 'md' | 'lg';

interface AppearanceContextType {
  density: DensityMode;
  setDensity: (value: DensityMode) => void;
  fontSize: FontSizeMode;
  setFontSize: (value: FontSizeMode) => void;
  sidebarDefaultCollapsed: boolean;
  setSidebarDefaultCollapsed: (value: boolean) => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  density: 'appearance-density',
  fontSize: 'appearance-font-size',
  sidebarCollapsed: 'appearance-sidebar-default-collapsed',
} as const;

function isDensity(value: unknown): value is DensityMode {
  return value === 'comfortable' || value === 'compact';
}

function isFontSize(value: unknown): value is FontSizeMode {
  return value === 'sm' || value === 'md' || value === 'lg';
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    return {
      density: 'comfortable' as DensityMode,
      setDensity: () => {},
      fontSize: 'md' as FontSizeMode,
      setFontSize: () => {},
      sidebarDefaultCollapsed: false,
      setSidebarDefaultCollapsed: () => {},
    };
  }
  return context;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DensityMode>('comfortable');
  const [fontSize, setFontSizeState] = useState<FontSizeMode>('md');
  const [sidebarDefaultCollapsed, setSidebarDefaultCollapsedState] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const savedDensity = localStorage.getItem(STORAGE_KEYS.density);
    if (isDensity(savedDensity)) {
      setDensityState(savedDensity);
    }

    const savedFontSize = localStorage.getItem(STORAGE_KEYS.fontSize);
    if (isFontSize(savedFontSize)) {
      setFontSizeState(savedFontSize);
    }

    const savedSidebar = localStorage.getItem(STORAGE_KEYS.sidebarCollapsed);
    if (savedSidebar === 'true' || savedSidebar === 'false') {
      setSidebarDefaultCollapsedState(savedSidebar === 'true');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-density', density);
    document.body.setAttribute('data-density', density);
    document.documentElement.classList.toggle('density-compact', density === 'compact');
    document.body.classList.toggle('density-compact', density === 'compact');
    localStorage.setItem(STORAGE_KEYS.density, density);
  }, [density, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-font-size', fontSize);
    document.body.setAttribute('data-font-size', fontSize);
    const fontSizeMap: Record<FontSizeMode, string> = {
      sm: '13px',
      md: '16px',
      lg: '19px',
    };
    document.documentElement.style.fontSize = fontSizeMap[fontSize];
    localStorage.setItem(STORAGE_KEYS.fontSize, fontSize);
  }, [fontSize, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(sidebarDefaultCollapsed));
  }, [sidebarDefaultCollapsed, mounted]);

  const value = useMemo(
    () => ({
      density,
      setDensity: setDensityState,
      fontSize,
      setFontSize: setFontSizeState,
      sidebarDefaultCollapsed,
      setSidebarDefaultCollapsed: setSidebarDefaultCollapsedState,
    }),
    [density, fontSize, sidebarDefaultCollapsed]
  );

  if (!mounted) {
    return <>{children}</>;
  }

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
