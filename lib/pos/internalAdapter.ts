import { prisma } from "@/lib/prisma";
import type {
  MarkPaidInput,
  NewLineItemInput,
  POSAdapter,
  POSTab,
  POSTabStatus,
} from "./types";
import type { Tab, LineItem, Payment, TabStatus } from "@prisma/client";

// InternalAdapter is the default: it reads and writes Venue Pay's own
// database directly. Every venue runs on this unless posSource is
// explicitly set to something else — it's what makes a venue launchable
// with zero POS integration.

const STATUS_MAP: Record<TabStatus, POSTabStatus> = {
  open: "open",
  partially_paid: "partially_paid",
  paid: "paid",
  closed: "closed",
  void: "void",
};

type TabWithItems = Tab & {
  lineItems: LineItem[];
  payments: Payment[];
  spot: { label: string };
};

function toPOSTab(tab: TabWithItems): POSTab {
  const subtotal = tab.lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0,
  );
  const paidTowardBill = tab.payments
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount, 0);
  return {
    id: tab.id,
    externalId: tab.externalId,
    spotLabel: tab.spot.label,
    status: STATUS_MAP[tab.status],
    currency: tab.currency,
    lineItems: tab.lineItems.map((li) => ({
      id: li.id,
      name: li.name,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      paid: li.paymentId !== null,
    })),
    subtotal,
    remainingSubtotal: Math.max(0, subtotal - paidTowardBill),
    createdAt: tab.createdAt,
  };
}

const TAB_INCLUDE = {
  lineItems: true,
  payments: true,
  spot: { select: { label: true } },
} as const;

export class InternalAdapter implements POSAdapter {
  async listOpenTabs(venueId: string): Promise<POSTab[]> {
    const tabs = await prisma.tab.findMany({
      where: {
        venueId,
        status: { in: ["open", "partially_paid"] },
      },
      include: TAB_INCLUDE,
      orderBy: { createdAt: "asc" },
    });
    return tabs.map(toPOSTab);
  }

  async getTab(venueId: string, spotLabel: string): Promise<POSTab | null> {
    const tab = await prisma.tab.findFirst({
      where: {
        venueId,
        status: { in: ["open", "partially_paid"] },
        spot: { label: spotLabel },
      },
      include: TAB_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return tab ? toPOSTab(tab) : null;
  }

  async addLineItems(
    venueId: string,
    spotLabel: string,
    items: NewLineItemInput[],
  ): Promise<POSTab> {
    if (items.length === 0) {
      throw new Error("addLineItems requires at least one item");
    }

    const spot = await prisma.spot.findFirst({
      where: { venueId, label: spotLabel },
    });
    if (!spot) {
      throw new Error(
        `No spot labeled "${spotLabel}" exists for venue ${venueId}`,
      );
    }

    const venue = await prisma.venue.findUniqueOrThrow({
      where: { id: venueId },
    });

    let tab = await prisma.tab.findFirst({
      where: { venueId, spotId: spot.id, status: { in: ["open", "partially_paid"] } },
    });

    if (!tab) {
      tab = await prisma.tab.create({
        data: {
          venueId,
          spotId: spot.id,
          status: "open",
          posSource: "internal",
          currency: venue.currency,
        },
      });
    }

    await prisma.lineItem.createMany({
      data: items.map((item) => ({
        tabId: tab!.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });

    const updated = await prisma.tab.findUniqueOrThrow({
      where: { id: tab.id },
      include: TAB_INCLUDE,
    });
    return toPOSTab(updated);
  }

  async markPaid(venueId: string, input: MarkPaidInput): Promise<void> {
    const tab = await prisma.tab.findFirst({
      where: { id: input.externalId, venueId },
      include: TAB_INCLUDE,
    });
    if (!tab) {
      throw new Error(
        `No tab ${input.externalId} found for venue ${venueId}`,
      );
    }

    // "Choose items" mode: lock the specific line items to this payment so
    // they drop out of what's offered to the next scanner. Even-split
    // payments don't pass lineItemIds, since they don't map to specific
    // items — reducing remainingSubtotal for those comes from the
    // payments-sum math in toPOSTab instead.
    if (input.lineItemIds && input.lineItemIds.length > 0) {
      await prisma.lineItem.updateMany({
        where: { id: { in: input.lineItemIds }, tabId: tab.id, paymentId: null },
        data: { paymentId: input.paymentId },
      });
    }

    const subtotal = tab.lineItems.reduce(
      (sum, li) => sum + li.quantity * li.unitPrice,
      0,
    );
    // Include the payment just recorded, since markPaid is called after the
    // Payment row is already written by the webhook handler.
    const paidTowardBill = tab.payments
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + p.amount, 0);

    const status: TabStatus = paidTowardBill >= subtotal ? "paid" : "partially_paid";

    await prisma.tab.update({
      where: { id: tab.id },
      data: {
        status,
        closedAt: status === "paid" ? new Date() : null,
      },
    });
  }
}
