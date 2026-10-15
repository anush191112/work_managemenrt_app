export { normalizeEmail, normalizePhone } from "./import-validation";

function titleCase(value: string): string {
  return value.split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

export function formatExportName(value: string): string {
  const name = value.trim();
  const hasLetter = /[a-z]/i.test(name);
  if (!hasLetter || (name !== name.toUpperCase() && name !== name.toLowerCase())) return value;
  const formatted = titleCase(name);
  const words = formatted.split(" ");
  if (words.length < 3 || words[1].slice(0, 4).includes(".")) return formatted;
  return `${words[0]} ${words[1]}`;
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
