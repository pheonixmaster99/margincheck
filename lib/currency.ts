import type { CurrencyCode } from "@/types/job";

const DISPLAY_LOCALE = "en-CA";

export function formatCurrency(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyWithCents(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedCurrency(value: number, currency: CurrencyCode): string {
  if (value === 0) return formatCurrency(0, currency);
  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value), currency)}`;
}

export function getCurrencySymbol(currency: CurrencyCode): string {
  const parts = new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).formatToParts(0);
  return parts.find(({ type }) => type === "currency")?.value ?? currency;
}
