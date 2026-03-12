'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Lock } from 'lucide-react';

interface ProtectedProps {
    children: ReactNode;
    module: string;
    action?: 'view' | 'create' | 'edit' | 'delete';
    fallback?: ReactNode;
}

/**
 * Componente que muestra contenido solo si el usuario tiene permisos
 */
export function Protected({ children, module, action = 'view', fallback = null }: ProtectedProps) {
    const { can } = usePermissions();

    if (!can(module, action)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

interface ProtectedButtonProps {
    children: ReactNode;
    module: string;
    action: 'create' | 'edit' | 'delete';
    onClick?: () => void;
    className?: string;
    type?: 'button' | 'submit';
    disabled?: boolean;
}

/**
 * Botón que solo se muestra si el usuario tiene permisos
 */
export function ProtectedButton({
    children,
    module,
    action,
    onClick,
    className = '',
    type = 'button',
    disabled = false,
}: ProtectedButtonProps) {
    const { can } = usePermissions();

    if (!can(module, action)) {
        return null;
    }

    return (
        <button
            type={type}
            onClick={onClick}
            className={className}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

interface AccessDeniedProps {
    message?: string;
}

/**
 * Componente para mostrar cuando el acceso está denegado
 */
export function AccessDenied({ message = 'No tienes permiso para acceder a esta sección' }: AccessDeniedProps) {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="text-center">
                <Lock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Acceso Restringido</h2>
                <p className="text-slate-500">{message}</p>
            </div>
        </div>
    );
}
