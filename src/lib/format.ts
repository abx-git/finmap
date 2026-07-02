export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} %`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function percentColor(value: number): string {
  if (value > 0.5) return "text-green-400";
  if (value < -0.5) return "text-red-400";
  return "text-gray-400";
}

export function finvizColor(value: number): string {
  if (value >= 3) return "#00c853";
  if (value >= 1) return "#4caf50";
  if (value >= 0.25) return "#81c784";
  if (value > 0) return "#a5d6a7";
  if (value === 0) return "#616161";
  if (value > -0.25) return "#ef9a9a";
  if (value > -1) return "#e57373";
  if (value > -3) return "#f44336";
  return "#d50000";
}
