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

        // Convertir la imagen a base64
        fetch(imageUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setBase64(reader.result as string);
                    setLoading(false);
                    console.log('✅ Logo convertido a base64 para PDF');
                };
                reader.onerror = () => {
                    console.error('❌ Error convirtiendo imagen a base64');
                    setBase64(null);
                    setLoading(false);
                };
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('❌ Error cargando imagen para PDF:', error);
                console.log('URL de la imagen:', imageUrl);
                setBase64(null);
                setLoading(false);
            });
    }, [imageUrl]);

    return { base64, loading };
}
