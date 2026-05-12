export function formatGroupedNumber(value: number, fractionDigits = 0) {
  if (!Number.isFinite(value)) {
    const fallback = Number(0).toFixed(Math.max(0, fractionDigits));
    const [fallbackInteger, fallbackDecimal = ""] = fallback.split(".");
    return fractionDigits > 0 ? `${fallbackInteger}.${fallbackDecimal}` : fallbackInteger;
  }

  const normalizedFractionDigits = Math.max(0, fractionDigits);
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);
  const fixed = absoluteValue.toFixed(normalizedFractionDigits);
  const [integerPart, decimalPart = ""] = fixed.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (normalizedFractionDigits === 0) {
    return `${sign}${groupedInteger}`;
  }

  return `${sign}${groupedInteger}.${decimalPart}`;
}

export function formatCurrencySrd(value: number) {
  return `${formatGroupedNumber(value, 2)} SRD`;
}

export function formatCurrencyUsd(value: number) {
  return `${formatGroupedNumber(value, 2)} USD`;
}

export function formatCurrencyDollar(value: number) {
  return `$${formatGroupedNumber(value, 2)}`;
}

export function formatKilometers(value: number) {
  return `${formatGroupedNumber(value, 1)} km`;
}

export function formatPercent(value: number, options?: { showPlusForPositive?: boolean }) {
  const prefix = options?.showPlusForPositive && value > 0 ? "+" : "";
  return `${prefix}${formatGroupedNumber(value, 1)}%`;
}
