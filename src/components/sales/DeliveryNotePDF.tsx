import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Organization } from '@/types/database.types';

// Define simplified types for the Remito since we might not have the full Invoice object
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
}

interface DeliveryNotePDFProps {
    sale: Sale;
    items: SaleItem[];
    organization?: Organization | null;
}

const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 30,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        flexDirection: 'row',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 10,
    },
    headerLeft: {
        width: '40%',
    },
    headerCenter: {
        width: '20%',
        alignItems: 'center',
    },
    headerRight: {
        width: '40%',
        alignItems: 'flex-end',
    },
    logo: {
        width: 80,
        height: 80,
        objectFit: 'contain',
        marginBottom: 5,
    },
    logoPlaceholder: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    docTypeBox: {
        borderWidth: 1,
        borderColor: '#000000',
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    docType: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    docCode: {
        fontSize: 8,
        marginTop: 2,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    label: {
        color: '#6B7280',
        marginBottom: 2,
        fontSize: 9,
    },
    value: {
        marginBottom: 5,
        fontSize: 10,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 2,
    },
    customerSection: {
        marginBottom: 20,
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    table: {
        width: '100%',
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingBottom: 5,
        marginBottom: 5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 5,
    },
    colDesc: {
        width: '60%',
    },
    colQty: {
        width: '20%',
        textAlign: 'right',
    },
    colUnit: {
        width: '20%',
        textAlign: 'right',
    },
    footer: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#000000',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    bold: {
        fontWeight: 'bold',
    }
});

export const DeliveryNotePDF = ({ sale, items, organization }: DeliveryNotePDFProps) => {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        {organization?.logo_url ? (
                            <View>
                                <Image src={organization.logo_url} style={styles.logo} />
                                <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 5 }}>{organization.name}</Text>
                            </View>
                        ) : (
                            <Text style={styles.logoPlaceholder}>{organization?.name || "EMPRESA"}</Text>
                        )}
                        <Text style={styles.label}>{organization?.address || "Dirección de la empresa"}</Text>
                        <Text style={styles.label}>Buenos Aires, Argentina</Text>
                    </View>

                    <View style={styles.headerCenter}>
                        <View style={styles.docTypeBox}>
                            <Text style={styles.docType}>R</Text>
                            <Text style={styles.docCode}>REMITO</Text>
                        </View>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={styles.title}>REMITO</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>N° Venta: </Text>
                            <Text style={[styles.value, styles.bold]}>{sale.id.slice(0, 8).toUpperCase()}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Fecha: </Text>
                            <Text style={styles.value}>{new Date(sale.created_at).toLocaleDateString("es-AR")}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Documento No Válido como Factura</Text>
                        </View>
                    </View>
                </View>

                {/* Customer Info */}
                <View style={styles.customerSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ width: '100%' }}>
                            <Text style={styles.label}>Cliente Destinatario:</Text>
                            <Text style={[styles.value, styles.bold]}>{sale.customer?.name || "Consumidor Final"}</Text>
                            {sale.customer?.cuit && (
                                <View style={styles.row}>
                                    <Text style={styles.label}>CUIT: </Text>
                                    <Text style={styles.value}>{sale.customer.cuit}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.label, styles.colDesc, styles.bold]}>Descripción / Producto</Text>
                    <Text style={[styles.label, styles.colQty, styles.bold]}>Cantidad</Text>
                    <Text style={[styles.label, styles.colUnit, styles.bold]}>Unidad</Text>
                </View>

                {/* Table Items */}
                <View style={styles.table}>
                    {items && items.length > 0 ? (
                        items.map((item, index) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={styles.colDesc}>{item.product_name || "Producto"}</Text>
                                <Text style={styles.colQty}>{item.quantity}</Text>
                                <Text style={styles.colUnit}>u.</Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.tableRow}>
                            <Text style={styles.colDesc}>Venta #{sale.id.slice(0, 8)}</Text>
                            <Text style={styles.colQty}>1</Text>
                            <Text style={styles.colUnit}>u.</Text>
                        </View>
                    )}
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={{ marginBottom: 20 }}>__________________________</Text>
                        <Text>Recibí Conforme</Text>
                        <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 5 }}>Firma y Aclaración</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
};
