import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy that fetches an image URL and returns it as a base64 data URL.
 * This avoids CORS issues when react-pdf tries to render external images.
 * Only allows URLs from our Supabase storage domain.
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    // Only allow fetching from our Supabase storage domain
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || !url.startsWith(supabaseUrl)) {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
    }

    try {
        const res = await fetch(url);
        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch image' }, { status: res.status });
        }

        const contentType = res.headers.get('content-type') || 'image/png';
        const buffer = await res.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const dataUrl = `data:${contentType};base64,${base64}`;

        return NextResponse.json(
            { base64: dataUrl },
            {
                headers: {
                    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
                },
            }
        );
    } catch {
        return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
    }
}
