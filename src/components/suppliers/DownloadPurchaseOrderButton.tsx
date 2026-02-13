'use client';

import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { PurchaseOrderPDF } from './PurchaseOrderPDF';

interface PurchaseOrderItem {
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
}

interface Supplier {
    name: string;
    legal_name?: string;
    tax_id?: string;
    tax_id_type?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    administrative_address?: string;
    warehouse_address?: string;
    default_payment_condition?: string;
    payment_days?: number;
    requires_advance?: boolean;
    advance_percentage?: number;
    bank_name?: string;
    bank_cbu_alias?: string;
    lead_time_days?: number;
}

interface DownloadPurchaseOrderButtonProps {
    orderNumber: string;
    orderDate: string;
    supplier: Supplier;
    items: PurchaseOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
    variant?: 'default' | 'outline' | 'ghost';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

export function DownloadPurchaseOrderButton({
    orderNumber,
    orderDate,
    supplier,
    items,
    subtotal,
    tax,
    total,
    notes,
    variant = 'default',
    size = 'default',
    className,
}: DownloadPurchaseOrderButtonProps) {
    const fileName = `OC-${orderNumber}-${supplier.name.replace(/\s+/g, '-')}.pdf`;

    return (
        <PDFDownloadLink
            document={
                <PurchaseOrderPDF
                    orderNumber={orderNumber}
                    orderDate={orderDate}
                    supplier={supplier}
                    items={items}
                    subtotal={subtotal}
                    tax={tax}
                    total={total}
                    notes={notes}
                />
            }
            fileName={fileName}
        >
            {({ loading }) => (
                <Button
                    variant={variant}
                    size={size}
                    className={className}
                    disabled={loading}
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generando PDF...
                        </>
                    ) : (
                        <>
                            <Download className="h-4 w-4 mr-2" />
                            Descargar PDF
                        </>
                    )}
                </Button>
            )}
        </PDFDownloadLink>
    );
}
