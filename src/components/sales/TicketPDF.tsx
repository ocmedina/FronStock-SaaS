import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Organization } from '@/types/database.types';

// Constants for 80mm thermal paper
// 80mm = ~226 points (1mm = 2.83465 points)
const TICKET_WIDTH = 226;

interface SaleItem {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface Sale {
    id: string;
    created_at: string;
    customer?: { name: string; cuit?: string; address?: string } | null;
    total: number;
    payment_method: string;
}

interface TicketPDFProps {
    sale: Sale;
    items: SaleItem[];
    organization?: Organization | null;
    logoBase64?: string | null;
}

const styles = StyleSheet.create({
    page: {
        width: TICKET_WIDTH,
        padding: 5,
        fontSize: 9,
        fontFamily: 'Helvetica',
        backgroundColor: '#FFFFFF',
    },
    section: {
        marginBottom: 8,
    },
    center: {
        alignItems: 'center',
        textAlign: 'center',
    },
    logo: {
        width: 60,
        height: 60,
        marginBottom: 4,
        objectFit: 'contain',
        alignSelf: 'center',
    },
    companyName: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    text: {
        fontSize: 8,
        marginBottom: 1,
    },
    title: {
        fontSize: 10,
        fontWeight: 'bold',
        marginVertical: 4,
        textAlign: 'center',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#000',
        paddingVertical: 2,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    bold: {
        fontWeight: 'bold',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000',
        paddingBottom: 2,
        marginTop: 4,
        marginBottom: 4,
    },
    itemRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    colQty: {
        width: '15%',
    },
    colDesc: {
        width: '55%',
    },
    colTotal: {
        width: '30%',
        textAlign: 'right',
    },
    totalSection: {
        borderTopWidth: 1,
        borderTopColor: '#000',
        marginTop: 4,
        paddingTop: 4,
    },
    finalMessage: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 8,
        fontStyle: 'italic',
    }
});

export const TicketPDF = ({ sale, items, organization, logoBase64 }: TicketPDFProps) => {
    const formattedDate = new Date(sale.created_at).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });

    const getPaymentLabel = (method: string) => {
        const methods: Record<string, string> = {
            'cash': 'Efectivo',
            'card': 'Tarjeta',
            'transfer': 'Transferencia',
            'credit': 'Cta. Corriente'
        };
        return methods[method] || method;
    };

    return (
        <Document>
            <Page size={{ width: TICKET_WIDTH, height: 1200 }} style={styles.page}>
                {/* Header / Logo */}
                <View style={[styles.section, styles.center]}>
                    {logoBase64 && (
                        <Image src={logoBase64} style={styles.logo} />
                    )}
                    <Text style={styles.companyName}>{organization?.name || "EMPRESA"}</Text>
                    {organization?.address && (
                        <Text style={styles.text}>{organization.address}</Text>
                    )}
                    {organization?.city && (
                        <Text style={styles.text}>{organization.city}</Text>
                    )}
                    {organization?.cuit && (
                        <Text style={styles.text}>CUIT: {organization.cuit}</Text>
                    )}
                </View>

                {/* Info Venta */}
                <View style={styles.section}>
                    <Text style={styles.title}>TICKET DE VENTA</Text>
                    <View style={styles.row}>
                        <Text style={styles.text}>Fecha:</Text>
                        <Text style={styles.text}>{formattedDate}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.text}>Venta #:</Text>
                        <Text style={[styles.text, styles.bold]}>{sale.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.text}>Cliente:</Text>
                        <Text style={[styles.text, { width: 100, textAlign: 'right' }]}>
                            {sale.customer?.name || "Consumidor Final"}
                        </Text>
                    </View>
                </View>

                {/* Items */}
                <View style={styles.section}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.text, styles.colQty, styles.bold]}>Cant</Text>
                        <Text style={[styles.text, styles.colDesc, styles.bold]}>Producto</Text>
                        <Text style={[styles.text, styles.colTotal, styles.bold]}>Total</Text>
                    </View>

                    {items.map((item, index) => (
                        <View key={index} style={styles.itemRow}>
                            <Text style={[styles.text, styles.colQty]}>{item.quantity}</Text>
                            <Text style={[styles.text, styles.colDesc]}>{item.product_name}</Text>
                            <Text style={[styles.text, styles.colTotal]}>${item.total}</Text>
                        </View>
                    ))}
                </View>

                {/* Total */}
                <View style={[styles.section, styles.totalSection]}>
                    <View style={styles.row}>
                        <Text style={[styles.text, styles.bold]}>TOTAL A PAGAR</Text>
                        <Text style={[styles.text, styles.bold, { fontSize: 12 }]}>
                            ${sale.total.toLocaleString("es-AR")}
                        </Text>
                    </View>
                    <View style={[styles.row, { marginTop: 4 }]}>
                        <Text style={styles.text}>Forma de Pago:</Text>
                        <Text style={styles.text}>{getPaymentLabel(sale.payment_method)}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.finalMessage}>
                    <Text>*** Gracias por su compra ***</Text>
                    <Text style={{ marginTop: 4 }}>Documento no válido como factura</Text>
                    <Text style={{ fontSize: 5, color: '#C0C0C0', marginTop: 6 }}>Este documento fue generado por Frontio Web Solutions</Text>
                </View>
            </Page>
        </Document>
    );
};
