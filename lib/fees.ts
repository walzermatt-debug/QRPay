/** Our platform cut, in minor currency units, from a total in basis points. */
export function calculatePlatformFee(
  totalAmount: number,
  platformFeeBps: number,
): number {
  return Math.round((totalAmount * platformFeeBps) / 10000);
}
