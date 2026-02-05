import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
    key: string;
    description: string;
    action: () => void;
    enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
    shortcuts: KeyboardShortcut[];
    enabled?: boolean;
}

export function useKeyboardShortcuts({
    shortcuts,
    enabled = true,
}: UseKeyboardShortcutsOptions) {
    const handleKeyPress = useCallback(
        (event: KeyboardEvent) => {
            // Find matching shortcut
            const shortcut = shortcuts.find(
                (s) => s.key === event.key && (s.enabled !== false)
            );

            if (!shortcut) return;

            // For F1, allow it even in input fields (search focus)
            // For other function keys, prevent default and execute
            const isInInput =
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement;

            // Allow F1 always, block other shortcuts when in input
            if (isInInput && event.key !== 'F1') {
                return;
            }

            event.preventDefault();
            shortcut.action();
        },
        [shortcuts]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [enabled, handleKeyPress]);

    return { shortcuts };
}
