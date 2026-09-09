export function isValidQuantityDone(quantityDone: number, quantityRequired: number | null): boolean {
  return quantityDone >= 0 && (quantityRequired === null || quantityDone <= quantityRequired);
}
