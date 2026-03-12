import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Estilos para el PDF
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 20,
        borderBottom: '2 solid #333',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: '#666',
    },
    section: {
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
        borderBottom: '1 solid #ddd',
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    label: {
        width: '40%',
        color: '#666',
    },
    value: {
        width: '60%',
        fontWeight: 'bold',
    },
    table: {
        marginTop: 10,
        marginBottom: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        padding: 8,
        fontWeight: 'bold',
        borderBottom: '2 solid #333',
    },
    tableRow: {
        flexDirection: 'row',
        padding: 8,
        borderBottom: '1 solid #ddd',
    },
    tableCol1: { width: '50%' },
    tableCol2: { width: '15%', textAlign: 'right' },
    tableCol3: { width: '20%', textAlign: 'right' },
    tableCol4: { width: '15%', textAlign: 'right' },
    totals: {
        marginTop: 10,
        alignItems: 'flex-end',
    },
    totalRow: {
        flexDirection: 'row',
        marginBottom: 4,
        width: '40%',
    },
    totalLabel: {
        width: '60%',
        textAlign: 'right',
        paddingRight: 10,
    },
    totalValue: {
        width: '40%',
        textAlign: 'right',
        fontWeight: 'bold',
    },
    grandTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        borderTop: '2 solid #333',
        paddingTop: 4,
    },
    alert: {
        backgroundColor: '#fff3cd',
        border: '1 solid #ffc107',
        padding: 10,
        marginTop: 10,
        marginBottom: 10,
        borderRadius: 4,
    },
    alertTitle: {
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#856404',
    },
    alertText: {
        color: '#856404',
        fontSize: 9,
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        borderTop: '1 solid #ddd',
        paddingTop: 10,
        fontSize: 8,
        color: '#666',
    },
});

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

interface PurchaseOrderPDFProps {
    orderNumber: string;
    orderDate: string;
    supplier: Supplier;
    items: PurchaseOrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    notes?: string;
}

export const PurchaseOrderPDF: React.FC<PurchaseOrderPDFProps> = ({
    orderNumber,
    orderDate,
    supplier,
    items,
    subtotal,
    tax,
    total,
    notes,
}) => {
    // Calcular anticipo si es requerido
    const advanceAmount = supplier.requires_advance && supplier.advance_percentage
        ? (total * supplier.advance_percentage) / 100
        : 0;
    const balanceAmount = total - advanceAmount;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>ORDEN DE COMPRA</Text>
                    <Text style={styles.subtitle}>#{orderNumber}</Text>
                </View>

                {/* Información General */}
                <View style={styles.section}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Fecha de Emisión:</Text>
                        <Text style={styles.value}>
                            {new Date(orderDate).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric'
                            })}
                        </Text>
                    </View>
                    {supplier.payment_days && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Fecha de Vencimiento:</Text>
                            <Text style={styles.value}>
                                {new Date(new Date(orderDate).getTime() + supplier.payment_days * 24 * 60 * 60 * 1000)
                                    .toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric'
                                    })}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Información del Proveedor */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PROVEEDOR</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nombre Comercial:</Text>
                        <Text style={styles.value}>{supplier.name}</Text>
                    </View>
                    {supplier.legal_name && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Razón Social:</Text>
                            <Text style={styles.value}>{supplier.legal_name}</Text>
                        </View>
                    )}
                    {supplier.tax_id && (
                        <View style={styles.row}>
                            <Text style={styles.label}>{supplier.tax_id_type || 'CUIT'}:</Text>
                            <Text style={styles.value}>{supplier.tax_id}</Text>
                        </View>
                    )}
                    {supplier.administrative_address && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Dirección:</Text>
                            <Text style={styles.value}>{supplier.administrative_address}</Text>
                        </View>
                    )}
                    {supplier.contact_name && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Contacto:</Text>
                            <Text style={styles.value}>{supplier.contact_name}</Text>
                        </View>
                    )}
                    {supplier.email && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Email:</Text>
                            <Text style={styles.value}>{supplier.email}</Text>
                        </View>
                    )}
                    {supplier.phone && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Teléfono:</Text>
                            <Text style={styles.value}>{supplier.phone}</Text>
                        </View>
                    )}
                </View>

                {/* Condiciones Comerciales */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>CONDICIONES COMERCIALES</Text>
                    {supplier.default_payment_condition && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Condición de Pago:</Text>
                            <Text style={styles.value}>{supplier.default_payment_condition}</Text>
                        </View>
                    )}
                    {supplier.payment_days && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Plazo de Pago:</Text>
                            <Text style={styles.value}>{supplier.payment_days} días</Text>
                        </View>
                    )}
                    {supplier.lead_time_days && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Tiempo de Entrega:</Text>
                            <Text style={styles.value}>{supplier.lead_time_days} días hábiles</Text>
                        </View>
                    )}
                    {supplier.warehouse_address && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Entregar en:</Text>
                            <Text style={styles.value}>{supplier.warehouse_address}</Text>
                        </View>
                    )}
                </View>

                {/* Productos */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>PRODUCTOS</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableCol1}>Producto</Text>
                            <Text style={styles.tableCol2}>Cant.</Text>
                            <Text style={styles.tableCol3}>Precio Unit.</Text>
                            <Text style={styles.tableCol4}>Subtotal</Text>
                        </View>
                        {items.map((item, index) => (
                            <View key={index} style={styles.tableRow}>
                                <Text style={styles.tableCol1}>{item.product_name}</Text>
                                <Text style={styles.tableCol2}>{item.quantity}</Text>
                                <Text style={styles.tableCol3}>
                                    ${item.unit_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </Text>
                                <Text style={styles.tableCol4}>
                                    ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Totales */}
                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>
                            ${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>IVA (21%):</Text>
                        <Text style={styles.totalValue}>
                            ${tax.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandTotal]}>
                        <Text style={styles.totalLabel}>TOTAL:</Text>
                        <Text style={styles.totalValue}>
                            ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>

                {/* Alerta de Anticipo */}
                {supplier.requires_advance && advanceAmount > 0 && (
                    <View style={styles.alert}>
                        <Text style={styles.alertTitle}>ANTICIPO REQUERIDO</Text>
                        <Text style={styles.alertText}>
                            Este proveedor requiere un anticipo del {supplier.advance_percentage}%
                            (${advanceAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                        </Text>
                        <Text style={styles.alertText}>
                            Saldo a pagar: ${balanceAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                )}

                {/* Datos Bancarios */}
                {(supplier.bank_name || supplier.bank_cbu_alias) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>DATOS PARA TRANSFERENCIA</Text>
                        {supplier.bank_name && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Banco:</Text>
                                <Text style={styles.value}>{supplier.bank_name}</Text>
                            </View>
                        )}
                        {supplier.bank_cbu_alias && (
                            <View style={styles.row}>
                                <Text style={styles.label}>CBU/Alias:</Text>
                                <Text style={styles.value}>{supplier.bank_cbu_alias}</Text>
                            </View>
                        )}
                        {supplier.requires_advance && advanceAmount > 0 && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Monto Anticipo:</Text>
                                <Text style={styles.value}>
                                    ${advanceAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Notas */}
                {notes && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>NOTAS</Text>
                        <Text>{notes}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>Documento generado automáticamente - {new Date().toLocaleString('es-AR')}</Text>
                </View>
                <Text style={{ fontSize: 6, color: '#C0C0C0', textAlign: 'center', marginTop: 10 }}>Este documento fue generado por Frontio Web Solutions</Text>
            </Page>
        </Document>
    );
};
