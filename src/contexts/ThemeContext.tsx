'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    // Return safe defaults if not within provider
    if (!context) {
        return {
            theme: 'system' as Theme,
            resolvedTheme: 'light' as ResolvedTheme,
            toggleTheme: () => { },
            setTheme: () => { },
        };
    }
    return context;
}

interface ThemeProviderProps {
    children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
    const [mounted, setMounted] = useState(false);

    const applyThemeClass = (mode: Theme) => {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effectiveTheme: ResolvedTheme = mode === 'system'
            ? (systemPrefersDark ? 'dark' : 'light')
            : mode;

        if (effectiveTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        setResolvedTheme(effectiveTheme);
    };

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as Theme;
        const initialTheme: Theme =
            savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
                ? savedTheme
                : 'system';

        setThemeState(initialTheme);
        applyThemeClass(initialTheme);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        applyThemeClass(theme);
    }, [theme, mounted]);

    useEffect(() => {
        if (!mounted) return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemChange = () => {
            if (theme === 'system') {
                applyThemeClass('system');
            }
        };

        media.addEventListener('change', handleSystemChange);
        return () => media.removeEventListener('change', handleSystemChange);
    }, [theme, mounted]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        applyThemeClass(newTheme);
    };

    const toggleTheme = () => {
        const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    };

    // Evitar flash durante la hidratación
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
