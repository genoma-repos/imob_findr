

/**
 * Converte string numérica ("500000") em number
 */
export default function parsePrice(priceNumber: string): number | null {
  if (!priceNumber) return null;
  const asNumber = Number(priceNumber);
  return Number.isNaN(asNumber) ? null : asNumber;
}