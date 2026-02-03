import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { Invoice } from './types';
import { Organization } from '@/types/database.types';

// Register fonts if needed (using default Helvetica for now which supports basic accents)
// Font.register({ family: 'Roboto', src: 'path/to/font.ttf' });

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
    invoiceTypeBox: {
        borderWidth: 1,
        borderColor: '#000000',
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    invoiceType: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    invoiceCode: {
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
        width: '50%',
    },
    colQty: {
        width: '15%',
        textAlign: 'right',
    },
    colPrice: {
        width: '15%',
        textAlign: 'right',
    },
    colTotal: {
        width: '20%',
        textAlign: 'right',
    },
    totals: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        marginBottom: 20,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        width: '50%',
        paddingVertical: 5,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalLabel: {
        width: '50%',
        textAlign: 'right',
        paddingRight: 10,
        fontWeight: 'bold',
    },
    totalValue: {
        width: '50%',
        textAlign: 'right',
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#000000',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    caeBlock: {
        width: '60%',
    },
    qrBlock: {
        width: '40%',
        alignItems: 'flex-end',
    },
    bold: {
        fontWeight: 'bold',
    }
});

interface InvoicePDFProps {
    invoice: Invoice;
    organization?: Organization | null;
}

export const InvoicePDF = ({ invoice, organization }: InvoicePDFProps) => {
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
                        <Text style={styles.label}>{organization?.tax_condition || "Condición IVA: Responsable Inscripto"}</Text>
                    </View>

                    <View style={styles.headerCenter}>
                        <View style={styles.invoiceTypeBox}>
                            <Text style={styles.invoiceType}>{invoice.type}</Text>
                            <Text style={styles.invoiceCode}>COD. 011</Text>
                        </View>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={styles.title}>FACTURA</Text>
                        <View style={styles.row}>
                            <Text style={styles.label}>N°: </Text>
                            <Text style={[styles.value, styles.bold]}>{invoice.invoice_number}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Fecha: </Text>
                            <Text style={styles.value}>{new Date(invoice.created_at).toLocaleDateString("es-AR")}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>CUIT: </Text>
                            <Text style={styles.value}>{organization?.cuit || "30-00000000-0"}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Ingresos Brutos: </Text>
                            <Text style={styles.value}>{organization?.gross_income_number || "00-00000000"}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Inicio de Actividades: </Text>
                            <Text style={styles.value}>{organization?.activity_start_date ? new Date(organization.activity_start_date).toLocaleDateString("es-AR") : "01/01/2024"}</Text>
                        </View>
                    </View>
                </View>

                {/* Customer Info */}
                <View style={styles.customerSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ width: '48%' }}>
                            <Text style={styles.label}>Cliente:</Text>
                            <Text style={[styles.value, styles.bold]}>{invoice.customer?.name || "Consumidor Final"}</Text>

                            <Text style={styles.label}>Condición IVA:</Text>
                            <Text style={styles.value}>Consumidor Final</Text>
                        </View>
                        <View style={{ width: '48%' }}>
                            <Text style={styles.label}>CUIT / DNI:</Text>
                            <Text style={styles.value}>{invoice.customer?.cuit || "-"}</Text>

                            <Text style={styles.label}>Condición de venta:</Text>
                            <Text style={styles.value}>Contado</Text>
                        </View>
                    </View>
                </View>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={[styles.label, styles.colDesc, styles.bold]}>Descripción</Text>
                    <Text style={[styles.label, styles.colQty, styles.bold]}>Cantidad</Text>
                    <Text style={[styles.label, styles.colPrice, styles.bold]}>Precio Unit.</Text>
                    <Text style={[styles.label, styles.colTotal, styles.bold]}>Subtotal</Text>
                </View>

                {/* Table Items */}
                <View style={styles.table}>
                    {invoice.sale?.sale_items && invoice.sale.sale_items.length > 0 ? (
                        invoice.sale.sale_items.map((item, index) => (
                            <View style={styles.tableRow} key={index}>
                                <Text style={styles.colDesc}>{item.product?.name || "Producto sin nombre"}</Text>
                                <Text style={styles.colQty}>{item.quantity}</Text>
                                <Text style={styles.colPrice}>$ {Number(item.unit_price).toLocaleString("es-AR")}</Text>
                                <Text style={styles.colTotal}>$ {Number(item.total).toLocaleString("es-AR")}</Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.tableRow}>
                            <Text style={styles.colDesc}>Venta #{invoice.sale_id?.split('-')[0] || "-"}</Text>
                            <Text style={styles.colQty}>1</Text>
                            <Text style={styles.colPrice}>$ {Number(invoice.total).toLocaleString("es-AR")}</Text>
                            <Text style={styles.colTotal}>$ {Number(invoice.total).toLocaleString("es-AR")}</Text>
                        </View>
                    )}
                </View>

                {/* Totals */}
                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>$ {Number(invoice.total).toLocaleString("es-AR")}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>IVA (21%):</Text>
                        <Text style={styles.totalValue}>$ 0,00</Text>
                    </View>
                    <View style={[styles.totalRow, { borderTopWidth: 2, borderTopColor: '#000000' }]}>
                        <Text style={[styles.totalLabel, { fontSize: 14 }]}>TOTAL:</Text>
                        <Text style={[styles.totalValue, { fontSize: 14 }]}>$ {Number(invoice.total).toLocaleString("es-AR")}</Text>
                    </View>
                </View>

                {/* Footer / CAE */}
                <View style={styles.footer}>
                    {invoice.cae ? (
                        <>
                            <View style={styles.caeBlock}>
                                <Text style={{ marginBottom: 5 }}>Comprobante Autorizado</Text>
                                <View style={styles.row}>
                                    <Text style={[styles.bold, { marginRight: 10 }]}>CAE N°:</Text>
                                    <Text>{invoice.cae}</Text>
                                </View>
                                <View style={styles.row}>
                                    <Text style={[styles.bold, { marginRight: 10 }]}>Fecha Vto. CAE:</Text>
                                    <Text>{new Date(invoice.cae_expiration!).toLocaleDateString("es-AR")}</Text>
                                </View>
                            </View>
                            <View style={styles.qrBlock}>
                                <Text style={{ fontSize: 8 }}>QR AFIP</Text>
                            </View>
                        </>
                    ) : (
                        <View style={{ width: '100%', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
                                DOCUMENTO NO VÁLIDO COMO FACTURA (VISTA PREVIA)
                            </Text>
                        </View>
                    )}
                </View>
            </Page>
        </Document>
    );
};
