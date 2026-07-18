import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";

// react-pdf's color inheritance from parent View/Page down to Text is
// unreliable in practice (renders as browser-default link-blue instead of
// the page's declared color) — every Text style below sets color
// explicitly rather than relying on cascade.
const INK = "#111111";
const MUTED = "#666666";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: INK },
  venueName: { fontSize: 16, fontWeight: 700, marginBottom: 2, color: INK },
  meta: { fontSize: 9, color: MUTED, marginBottom: 1 },
  section: { marginTop: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  rowLabel: { fontSize: 10, color: INK },
  rowValue: { fontSize: 10, color: INK },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #cccccc",
    paddingBottom: 4,
    marginBottom: 4,
  },
  headerCell: { fontSize: 9, color: MUTED },
  itemName: { flex: 3, color: INK },
  itemQty: { flex: 1, textAlign: "right", color: INK },
  itemTotal: { flex: 1, textAlign: "right", color: INK },
  divider: { borderBottom: "1px solid #cccccc", marginVertical: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  totalLabel: { fontSize: 12, fontWeight: 700, color: INK },
  totalValue: { fontSize: 12, fontWeight: 700, color: INK },
});

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface ReceiptData {
  receiptId: string;
  venueName: string;
  venueAddress: string | null;
  spotLabel: string;
  paidAt: Date;
  currency: string;
  items: ReceiptItem[];
  /** Only set when items[] doesn't fully account for amount (even-split mode). */
  unitemizedShare: number | null;
  tipAmount: number;
  feeAmount: number;
  total: number;
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const {
    receiptId,
    venueName,
    venueAddress,
    spotLabel,
    paidAt,
    currency,
    items,
    unitemizedShare,
    tipAmount,
    feeAmount,
    total,
  } = data;

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <Text style={styles.venueName}>{venueName}</Text>
        {venueAddress && <Text style={styles.meta}>{venueAddress}</Text>}
        <Text style={styles.meta}>{spotLabel}</Text>
        <Text style={styles.meta}>Receipt #{receiptId}</Text>
        <Text style={styles.meta}>{paidAt.toLocaleString()}</Text>

        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, styles.itemName]}>Item</Text>
            <Text style={[styles.headerCell, styles.itemQty]}>Qty</Text>
            <Text style={[styles.headerCell, styles.itemTotal]}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQty}>{item.quantity}</Text>
              <Text style={styles.itemTotal}>
                {formatMoney(item.quantity * item.unitPrice, currency)}
              </Text>
            </View>
          ))}
          {unitemizedShare !== null && (
            <View style={styles.row}>
              <Text style={styles.itemName}>Your share of the bill</Text>
              <Text style={styles.itemQty} />
              <Text style={styles.itemTotal}>{formatMoney(unitemizedShare, currency)}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {tipAmount > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tip</Text>
            <Text style={styles.rowValue}>{formatMoney(tipAmount, currency)}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Service fee</Text>
          <Text style={styles.rowValue}>{formatMoney(feeAmount, currency)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
        </View>
      </Page>
    </Document>
  );
}
