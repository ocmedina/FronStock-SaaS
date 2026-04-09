import { useState, useEffect } from 'react';

export function useImageToBase64(imageUrl: string | null | undefined) {
    const [base64, setBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!imageUrl) {
            setBase64(null);
            return;
        }

        setLoading(true);

        // If it's already a data URL (base64), use it directly
        if (imageUrl.startsWith('data:')) {
            setBase64(imageUrl);
            setLoading(false);
            return;
        }

        // Use server-side proxy to avoid CORS issues with Supabase Storage
        fetch(`/api/logo-base64?url=${encodeURIComponent(imageUrl)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.base64) {
                    setBase64(data.base64);
                } else {
                    setBase64(null);
                }
                setLoading(false);
            })
            .catch(error => {
                console.error('Error cargando imagen para PDF:', error);
                setBase64(null);
                setLoading(false);
            });
    }, [imageUrl]);

    return { base64, loading };
}

/**
 * Fetch logo as base64 on-demand (for use in click handlers).
 * Uses the server-side proxy to avoid CORS.
 */
export async function fetchLogoBase64(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    // If it's already a data URL (base64), return it directly — no need to proxy
    if (url.startsWith('data:')) return url;
    try {
        const res = await fetch(`/api/logo-base64?url=${encodeURIComponent(url)}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error('[fetchLogoBase64] API error:', res.status, errData);
            return null;
        }
        const data = await res.json();
        return data.base64 || null;
    } catch (e) {
        console.error('[fetchLogoBase64] Network/parse error:', e);
        return null;
    }
}
