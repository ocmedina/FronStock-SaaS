'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface SessionTimeoutProps {
    timeoutInMinutes?: number;
    warningTimeInMinutes?: number;
}

export function SessionTimeout({
    timeoutInMinutes = 15,
}: SessionTimeoutProps) {
    const router = useRouter();
    const supabase = createClient();
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<number>(Date.now());

    // Converts minutes to milliseconds
    const timeoutMs = timeoutInMinutes * 60 * 1000;

    const logout = useCallback(async () => {
        try {
            await supabase.auth.signOut();
            toast.message('Sesión cerrada por inactividad', {
                description: 'Por favor, inicia sesión nuevamente para continuar.'
            });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }, [router, supabase]);

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            const now = Date.now();
            const timeSinceLastActivity = now - lastActivityRef.current;

            // Double check if we really should logout (handling potential race conditions)
            if (timeSinceLastActivity >= timeoutMs) {
                logout();
            } else {
                // If for some reason timer fired early, restart it for the remaining time
                resetTimer();
            }
        }, timeoutMs);
    }, [timeoutMs, logout]);

    useEffect(() => {
        // Events to listen for
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

        // Initial setup
        resetTimer();

        // Add event listeners
        const handleActivity = () => {
            // Throttling could be added here if performance becomes an issue,
            // but for simple timer reset it's usually negligible.
            resetTimer();
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        // Cleanup
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [resetTimer]);

    // Component doesn't render anything visual (unless we add a warning modal later)
    return null;
}
