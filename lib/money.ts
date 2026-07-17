/** Formats minor currency units (e.g. cents) as a localized display string. */
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(minorUnits / 100);
}

/** Parses a user-entered decimal amount (e.g. "12.50") into minor units. */
export function toMinorUnits(decimalAmount: string): number {
  const value = Number.parseFloat(decimalAmount);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}
