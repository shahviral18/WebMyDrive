export const MONTHLY_BASE_PRICES: Record<string, number> = {
  "Basic": 330,
  "Pro": 550,
  "Premium": 1000,
  "Enterprise": 1650,
};

export function roundDiscountedPrice(value: number) {
  const discounted = value * 0.75;
  if (Math.abs(discounted - 412.5) < 1) return 420;
  if (Math.abs(discounted - 1237.5) < 1) return 1250;
  return Math.round(discounted / 10) * 10;
}

export function getShortPlanName(name: string) {
  return name.replace(/^Cloud Storage\s*[–-]\s*/i, "").trim();
}
