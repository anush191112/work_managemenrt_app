export { normalizeEmail, normalizePhone } from "./import-validation";

export function formatExportName(value: string): string {
  const firstSpace = value.indexOf(" ");
  if (firstSpace < 0) return value;

  const prefix = value.slice(0, firstSpace + 1);
  const remainingWords = value.slice(firstSpace + 1).trim().split(/\s+/).filter(Boolean);
  const firstMeaningfulWord = remainingWords.find((word) => word.replaceAll(".", "").length > 1);
  return firstMeaningfulWord ? `${prefix}${firstMeaningfulWord}` : value;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
