// Approximate average regular gasoline price ($/gal) by US state. These are
// rough static reference values (no live feed) used to estimate trip fuel cost
// from the states a route passes through. Users can override the price per trip.

export const NATIONAL_AVG_GAS_PRICE = 3.2;

export const STATE_GAS_PRICES: Record<string, number> = {
  AL: 2.85, AK: 3.75, AZ: 3.45, AR: 2.8, CA: 4.75, CO: 3.05, CT: 3.35,
  DE: 3.1, DC: 3.45, FL: 3.15, GA: 2.95, HI: 4.6, ID: 3.55, IL: 3.5,
  IN: 3.2, IA: 3.05, KS: 2.95, KY: 3.05, LA: 2.85, ME: 3.25, MD: 3.3,
  MA: 3.3, MI: 3.25, MN: 3.1, MS: 2.75, MO: 2.95, MT: 3.45, NE: 3.05,
  NV: 4.05, NH: 3.15, NJ: 3.25, NM: 3.1, NY: 3.45, NC: 3.0, ND: 3.15,
  OH: 3.15, OK: 2.8, OR: 3.95, PA: 3.45, RI: 3.25, SC: 2.9, SD: 3.1,
  TN: 2.85, TX: 2.85, UT: 3.35, VT: 3.3, VA: 3.05, WA: 4.35, WV: 3.15,
  WI: 3.1, WY: 3.25,
};

// Average price across the given state codes (e.g. ["CO","UT"]). Falls back to
// the national average for unknown codes or when no states are provided.
export function gasPriceForStates(codes: string[] | null | undefined): number {
  if (!codes || codes.length === 0) return NATIONAL_AVG_GAS_PRICE;
  const prices = codes.map((c) => STATE_GAS_PRICES[c] ?? NATIONAL_AVG_GAS_PRICE);
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}
