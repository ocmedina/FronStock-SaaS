import React from "react";
import { Page, Text, View, Document, StyleSheet, Image } from "@react-pdf/renderer";
import { Organization } from "@/types/database.types";

const TICKET_WIDTH = 226;

interface OrderItem {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price?: number;
  total?: number;
}

interface OrderData {
  id: string;
  created_at: string;
  customer?: { name: string; cuit?: string; address?: string } | null;
  total: number;
  payment_method?: string;
}

interface OrderRemito80PDFProps {
  order: OrderData;
  items: OrderItem[];
  organization?: Organization | null;
}

const styles = StyleSheet.create({
  page: {
    width: TICKET_WIDTH,
    padding: 6,
    fontSize: 9,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
  },
  section: {
    marginBottom: 8,
  },
  center: {
    alignItems: "center",
    textAlign: "center",
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 4,
    objectFit: "contain",
    alignSelf: "center",
  },
  companyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 2,
  },
  text: {
    fontSize: 8,
    marginBottom: 1,
  },
  title: {
    fontSize: 10,
    fontWeight: "bold",
    marginVertical: 4,
    textAlign: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    paddingVertical: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  colQty: {
    width: "15%",
  },
  colDesc: {
    width: "55%",
  },
  colTotal: {
    width: "30%",
    textAlign: "right",
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    marginTop: 4,
    paddingTop: 4,
  },
  bold: {
    fontWeight: "bold",
  },
  finalMessage: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 8,
  },
});

const getPaymentLabel = (method?: string) => {
  const methods: Record<string, string> = {
    cash: "Efectivo",
    card: "Tarjeta",
    transfer: "Transferencia",
    credit: "Cta. Corriente",
    current_account: "Cta. Corriente",
    cuenta_corriente: "Cta. Corriente",
  };
  if (!method) return "-";
  return methods[method] || method;
};

export const OrderRemito80PDF = ({ order, items, organization }: OrderRemito80PDFProps) => {
  const formattedDate = new Date(order.created_at).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Document>
      <Page size={{ width: TICKET_WIDTH, height: 1200 }} style={styles.page}>
        <View style={[styles.section, styles.center]}>
          {organization?.logo_url && <Image src={organization.logo_url} style={styles.logo} cache={false} />}
          <Text style={styles.companyName}>{organization?.name || "EMPRESA"}</Text>
          {organization?.address && <Text style={styles.text}>{organization.address}</Text>}
          <Text style={styles.text}>Buenos Aires, Argentina</Text>
          {organization?.cuit && <Text style={styles.text}>CUIT: {organization.cuit}</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>REMITO DE PEDIDO</Text>
          <View style={styles.row}>
            <Text style={styles.text}>Fecha:</Text>
            <Text style={styles.text}>{formattedDate}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>Pedido #:</Text>
            <Text style={[styles.text, styles.bold]}>{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>Cliente:</Text>
            <Text style={[styles.text, { width: 110, textAlign: "right" }]}>{order.customer?.name || "Consumidor Final"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={[styles.text, styles.colQty, styles.bold]}>Cant</Text>
            <Text style={[styles.text, styles.colDesc, styles.bold]}>Producto</Text>
            <Text style={[styles.text, styles.colTotal, styles.bold]}>Total</Text>
          </View>

          {items.length > 0 ? (
            items.map((item, index) => (
              <View key={`${item.id || item.product_name}-${index}`} style={styles.itemRow}>
                <Text style={[styles.text, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.text, styles.colDesc]}>{item.product_name}</Text>
                <Text style={[styles.text, styles.colTotal]}>${Number(item.total || 0).toLocaleString("es-AR")}</Text>
              </View>
            ))
          ) : (
            <View style={styles.itemRow}>
              <Text style={[styles.text, styles.colQty]}>1</Text>
              <Text style={[styles.text, styles.colDesc]}>Sin detalle de productos</Text>
              <Text style={[styles.text, styles.colTotal]}>$0</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, styles.totalSection]}>
          <View style={styles.row}>
            <Text style={[styles.text, styles.bold]}>TOTAL</Text>
            <Text style={[styles.text, styles.bold, { fontSize: 11 }]}>${Number(order.total || 0).toLocaleString("es-AR")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.text}>Pago:</Text>
            <Text style={styles.text}>{getPaymentLabel(order.payment_method)}</Text>
          </View>
        </View>

        <View style={styles.finalMessage}>
          <Text>Documento no válido como factura</Text>
        </View>
      </Page>
    </Document>
  );
};
