import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

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
        borderBottomWidth: 2,
        borderBottomColor: '#000000',
        paddingBottom: 15,
    },
    headerLeft: {
        width: '60%',
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
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1F2937',
    },
    subtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 5,
    },
    label: {
        color: '#6B7280',
        fontSize: 9,
        marginBottom: 2,
    },
    value: {
        marginBottom: 5,
        fontSize: 10,
        fontWeight: 'bold',
    },
    supplierSection: {
        marginBottom: 20,
        backgroundColor: '#F3F4F6',
        padding: 15,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#1F2937',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    table: {
        width: '100%',
        marginBottom: 20,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#374151',
        color: '#FFFFFF',
        padding: 8,
        fontWeight: 'bold',
        borderRadius: 4,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingVertical: 8,
    },
    colProduct: {
        width: '45%',
        paddingLeft: 5,
    },
    colQty: {
        width: '15%',
        textAlign: 'center',
    },
    colCost: {
        width: '20%',
        textAlign: 'right',
    },
    colTotal: {
        width: '20%',
        textAlign: 'right',
        paddingRight: 5,
    },
    totals: {
        flexDirection: 'column',
        alignItems: 'flex-end',
        marginBottom: 30,
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
        paddingRight: 15,
        fontSize: 11,
    },
    totalValue: {
        width: '50%',
        textAlign: 'right',
        fontWeight: 'bold',
        fontSize: 11,
    },
    grandTotal: {
        borderTopWidth: 2,
        borderTopColor: '#000000',
        marginTop: 5,
    },
    footer: {
        marginTop: 'auto',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 15,
    },
    notes: {
        fontSize: 9,
        color: '#6B7280',
        marginTop: 10,
    },
    statusBadge: {
        padding: 5,
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 'bold',
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    statusPending: {
        backgroundColor: '#FEF3C7',
        color: '#92400E',
    },
    statusOrdered: {
        backgroundColor: '#DBEAFE',
        color: '#1E40AF',
    },
    statusReceived: {
        backgroundColor: '#D1FAE5',
        color: '#065F46',
    },
    statusCancelled: {
        backgroundColor: '#FEE2E2',
        color: '#991B1B',
    },
});

interface PurchaseOrderPDFProps {
    order: any;
    organization?: any;
    logoBase64?: string | null;
}

export const PurchaseOrderPDF = ({ order, organization, logoBase64 }: PurchaseOrderPDFProps) => {
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending': return styles.statusPending;
            case 'ordered': return styles.statusOrdered;
            case 'received': return styles.statusReceived;
            case 'cancelled': return styles.statusCancelled;
            default: return styles.statusPending;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'PENDIENTE';
            case 'ordered': return 'ORDENADO';
            case 'received': return 'RECIBIDO';
            case 'cancelled': return 'CANCELADO';
            default: return status.toUpperCase();
        }
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        {logoBase64 ? (
                            <Image src={logoBase64} style={styles.logo} />
                        ) : organization?.logo_url ? (
                            <Image src={organization.logo_url} style={styles.logo} cache={false} />
                        ) : null}
                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 5 }}>
                            {organization?.name || "Mi Empresa"}
                        </Text>
                        <Text style={styles.subtitle}>{organization?.address || ""}</Text>
                        <Text style={styles.subtitle}>{organization?.phone || ""}</Text>
                        <Text style={styles.subtitle}>{organization?.email || ""}</Text>
                    </View>

                    <View style={styles.headerRight}>
                        <Text style={styles.title}>ORDEN DE COMPRA</Text>
                        <View style={[styles.statusBadge, getStatusStyle(order.status)]}>
                            <Text>{getStatusLabel(order.status)}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>N° Orden: </Text>
                            <Text style={styles.value}>{order.order_number || `OC-${order.id.slice(0, 8)}`}</Text>
                        </View>
                        <View style={styles.row}>
                            <Text style={styles.label}>Fecha: </Text>
                            <Text style={styles.value}>
                                {new Date(order.created_at).toLocaleDateString("es-AR")}
                            </Text>
                        </View>
                        {order.received_at && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Fecha Recepción: </Text>
                                <Text style={styles.value}>
                                    {new Date(order.received_at).toLocaleDateString("es-AR")}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Supplier Info */}
                <View style={styles.supplierSection}>
                    <Text style={styles.sectionTitle}>Proveedor</Text>
                    <View style={styles.row}>
                        <Text style={styles.label}>Nombre: </Text>
                        <Text style={styles.value}>{order.supplier?.name || "Proveedor"}</Text>
                    </View>
                    {order.supplier?.contact_name && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Contacto: </Text>
                            <Text style={styles.value}>{order.supplier.contact_name}</Text>
                        </View>
                    )}
                    {order.supplier?.phone && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Teléfono: </Text>
                            <Text style={styles.value}>{order.supplier.phone}</Text>
                        </View>
                    )}
                    {order.supplier?.email && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Email: </Text>
                            <Text style={styles.value}>{order.supplier.email}</Text>
                        </View>
                    )}
                </View>

                {/* Table Header */}
                <View style={styles.tableHeader}>
                    <Text style={styles.colProduct}>Producto</Text>
                    <Text style={styles.colQty}>Cantidad</Text>
                    <Text style={styles.colCost}>Costo Unit.</Text>
                    <Text style={styles.colTotal}>Total</Text>
                </View>

                {/* Table Items */}
                <View style={styles.table}>
                    {order.purchase_order_items && order.purchase_order_items.length > 0 ? (
                        order.purchase_order_items.map((item: any, index: number) => (
                            <View style={styles.tableRow} key={index}>
                                <View style={styles.colProduct}>
                                    <Text style={{ fontWeight: 'bold' }}>{item.product_name}</Text>
                                    {item.received_quantity > 0 && (
                                        <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>
                                            Recibido: {item.received_quantity} / {item.quantity}
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.colQty}>{item.quantity}</Text>
                                <Text style={styles.colCost}>$ {Number(item.unit_cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</Text>
                                <Text style={styles.colTotal}>$ {Number(item.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</Text>
                            </View>
                        ))
                    ) : (
                        <View style={styles.tableRow}>
                            <Text style={styles.colProduct}>Sin items</Text>
                            <Text style={styles.colQty}>-</Text>
                            <Text style={styles.colCost}>-</Text>
                            <Text style={styles.colTotal}>$ 0,00</Text>
                        </View>
                    )}
                </View>

                {/* Totals */}
                <View style={styles.totals}>
                    <View style={[styles.totalRow, styles.grandTotal]}>
                        <Text style={[styles.totalLabel, { fontSize: 14, fontWeight: 'bold' }]}>TOTAL:</Text>
                        <Text style={[styles.totalValue, { fontSize: 14 }]}>
                            $ {Number(order.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </Text>
                    </View>
                </View>

                {/* Notes */}
                {order.notes && (
                    <View style={{ marginBottom: 20 }}>
                        <Text style={styles.sectionTitle}>Notas</Text>
                        <Text style={styles.notes}>{order.notes}</Text>
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={{ fontSize: 9, color: '#6B7280', textAlign: 'center' }}>
                        Este documento es una orden de compra generada por {organization?.name || "el sistema"}
                    </Text>
                    <Text style={{ fontSize: 8, color: '#9CA3AF', textAlign: 'center', marginTop: 5 }}>
                        Generado el {new Date().toLocaleDateString("es-AR")} a las {new Date().toLocaleTimeString("es-AR")}
                    </Text>
                </View>
                <Text style={{ fontSize: 6, color: '#C0C0C0', textAlign: 'center', marginTop: 10 }}>Este documento fue generado por Frontio Web Solutions</Text>
            </Page>
        </Document>
    );
};
