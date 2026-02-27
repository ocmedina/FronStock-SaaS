'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const SESSION_TIMEOUT_KEY = 'security-session-timeout-minutes';

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
    const timeoutMinutesRef = useRef<number>(timeoutInMinutes);

    const getTimeoutMs = useCallback(() => {
        const raw = localStorage.getItem(SESSION_TIMEOUT_KEY);
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 5) {
            timeoutMinutesRef.current = parsed;
        } else {
            timeoutMinutesRef.current = timeoutInMinutes;
        }
        return timeoutMinutesRef.current * 60 * 1000;
    }, [timeoutInMinutes]);

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
        const timeoutMs = getTimeoutMs();

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
    }, [getTimeoutMs, logout]);

    useEffect(() => {
        const syncTimeoutFromServer = async () => {
            try {
                const { data: userData } = await supabase.auth.getUser();
                const userId = userData.user?.id;
                if (!userId) return;

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('organization_id')
                    .eq('id', userId)
                    .maybeSingle();

                const organizationId = profileData?.organization_id;
                if (!organizationId) return;

                const { data: prefData } = await supabase
                    .from('user_security_preferences')
                    .select('session_timeout_minutes')
                    .eq('user_id', userId)
                    .eq('organization_id', organizationId)
                    .maybeSingle();

                const timeout = prefData?.session_timeout_minutes;
                if (typeof timeout === 'number' && timeout >= 5) {
                    localStorage.setItem(SESSION_TIMEOUT_KEY, String(timeout));
                    window.dispatchEvent(new Event('security-timeout-changed'));
                }
            } catch {
                // no-op fallback to local/default timeout
            }
        };

        syncTimeoutFromServer();

        // Events to listen for
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

        // Initial setup
        resetTimer();

        const handleTimeoutChanged = () => {
            resetTimer();
        };
        window.addEventListener('security-timeout-changed', handleTimeoutChanged as EventListener);

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
            window.removeEventListener('security-timeout-changed', handleTimeoutChanged as EventListener);
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [resetTimer]);

    // Component doesn't render anything visual (unless we add a warning modal later)
    return null;
}
