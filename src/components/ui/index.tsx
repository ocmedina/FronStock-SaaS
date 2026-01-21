'use client';

import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', padding = 'md' }: CardProps) {
    const paddingClasses = {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
    };

    return (
        <div
            className={`rounded-xl border ${paddingClasses[padding]} ${className}`}
            style={{
                background: 'var(--background-card)',
                borderColor: 'var(--border)',
            }}
        >
            {children}
        </div>
    );
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                    {title}
                </h1>
                {subtitle && (
                    <p style={{ color: 'var(--foreground-secondary)' }}>{subtitle}</p>
                )}
            </div>
            {action}
        </div>
    );
}

interface ButtonProps {
    children: ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit';
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    className?: string;
}

export function Button({
    children,
    onClick,
    type = 'button',
    variant = 'primary',
    size = 'md',
    disabled = false,
    className = '',
}: ButtonProps) {
    const baseStyles = 'font-medium rounded-lg transition-all flex items-center justify-center gap-2';

    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-lg',
    };

    const variantStyles = {
        primary: 'text-white shadow-lg hover:shadow-xl hover:scale-[1.02]',
        secondary: 'border hover:shadow-md',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        ghost: 'hover:bg-opacity-10',
    };

    const getStyle = () => {
        if (variant === 'primary') {
            return { background: 'var(--gradient-primary)' };
        }
        if (variant === 'secondary') {
            return {
                background: 'var(--background-card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
            };
        }
        return {};
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
            style={getStyle()}
        >
            {children}
        </button>
    );
}

interface InputProps {
    label?: string;
    type?: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    min?: number;
    step?: string;
}

export function Input({
    label,
    type = 'text',
    value,
    onChange,
    placeholder,
    required = false,
    disabled = false,
    className = '',
    min,
    step,
}: InputProps) {
    return (
        <div className={className}>
            {label && (
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground-secondary)' }}>
                    {label} {required && '*'}
                </label>
            )}
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                min={min}
                step={step}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                style={{
                    background: 'var(--background-card)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                }}
            />
        </div>
    );
}

interface SelectProps {
    label?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: ReactNode;
    required?: boolean;
    className?: string;
}

export function Select({ label, value, onChange, children, required = false, className = '' }: SelectProps) {
    return (
        <div className={className}>
            {label && (
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground-secondary)' }}>
                    {label} {required && '*'}
                </label>
            )}
            <select
                value={value}
                onChange={onChange}
                required={required}
                className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                    background: 'var(--background-card)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                }}
            >
                {children}
            </select>
        </div>
    );
}

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-2xl',
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className={`${sizeClasses[size]} w-full rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col`}
                style={{ background: 'var(--background-card)' }}
            >
                <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
                    <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
                    {subtitle && <p style={{ color: 'var(--foreground-secondary)' }} className="text-sm">{subtitle}</p>}
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    {children}
                </div>
                {footer && (
                    <div className="p-6 border-t flex gap-3" style={{ borderColor: 'var(--border)' }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

interface TableProps {
    headers: string[];
    children: ReactNode;
    emptyMessage?: string;
}

export function Table({ headers, children, emptyMessage = 'No hay datos' }: TableProps) {
    return (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full">
                <thead style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                    <tr>
                        {headers.map((header, i) => (
                            <th
                                key={i}
                                className="text-left px-6 py-4 text-sm font-semibold"
                                style={{ color: 'var(--foreground-secondary)' }}
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody style={{ background: 'var(--background-card)' }}>
                    {children}
                </tbody>
            </table>
        </div>
    );
}

interface BadgeProps {
    children: ReactNode;
    variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
    const styles = {
        success: { background: 'var(--success-light)', color: 'var(--success)' },
        warning: { background: 'var(--warning-light)', color: 'var(--warning)' },
        danger: { background: 'var(--danger-light)', color: 'var(--danger)' },
        info: { background: 'var(--info-light)', color: 'var(--info)' },
        neutral: { background: 'var(--border)', color: 'var(--foreground-secondary)' },
    };

    return (
        <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={styles[variant]}
        >
            {children}
        </span>
    );
}
