"use client";

import { useState, useEffect, useCallback } from 'react';

type NetworkStatus = 'online' | 'offline' | 'blocked' | 'degraded';

export function useOnlineStatus() {
  const [browserOnline, setBrowserOnline] = useState(true);
  const [isSupabaseReachable, setIsSupabaseReachable] = useState(true);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('online');
  const [wasOffline, setWasOffline] = useState(false);

  const checkSupabaseHealth = useCallback(async () => {
    const isBrowserOnline = navigator.onLine;

    if (!isBrowserOnline) {
      setBrowserOnline(false);
      setIsSupabaseReachable(false);
      setNetworkStatus('offline');
      return;
    }

    setBrowserOnline(true);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      setIsSupabaseReachable(false);
      setNetworkStatus('degraded');
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (response.ok || response.status === 401 || response.status === 403) {
        setIsSupabaseReachable(true);
        setNetworkStatus('online');
      } else {
        setIsSupabaseReachable(false);
        setNetworkStatus('degraded');
      }
    } catch {
      setIsSupabaseReachable(false);
      setNetworkStatus('blocked');
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const initialStatus = navigator.onLine;
    setBrowserOnline(initialStatus);

    checkSupabaseHealth();

    const handleOnline = async () => {
      console.log('[NET] Network: ONLINE - Reconnected!');
      setBrowserOnline(true);
      setWasOffline(true);
      await checkSupabaseHealth();
      
      // Reset wasOffline after 8 seconds (increased for better stability)
      setTimeout(() => {
        console.log('[TIMER] Resetting wasOffline flag');
        setWasOffline(false);
      }, 8000);
    };

    const handleOffline = () => {
      console.log('[NET] Network: OFFLINE');
      setBrowserOnline(false);
      setIsSupabaseReachable(false);
      setNetworkStatus('offline');
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkSupabaseHealth]);

  useEffect(() => {
    if (!browserOnline) return;

    const interval = setInterval(() => {
      checkSupabaseHealth();
    }, 15000);

    return () => clearInterval(interval);
  }, [browserOnline, checkSupabaseHealth]);

  const isOnline = browserOnline && isSupabaseReachable;

  return {
    isOnline,
    wasOffline,
    browserOnline,
    isSupabaseReachable,
    networkStatus,
  };
}
