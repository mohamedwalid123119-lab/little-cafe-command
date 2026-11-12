// Client-side mirror of the database costing engine (recalc_recipe / v_variant_costing).
// The database is the source of truth; these helpers power live previews and margin math.

export type UnitDimension = "mass" | "volume" | "count";

export interface UnitDef {
  code: string;
  name_ar: string;
  dimension: UnitDimension;
  factor_to_base: number;
}

export const round = (n: number, digits = 4) => {
  const f = 10 ** digits;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Cost of one base unit (g / ml / pcs) from a purchase: price ÷ (quantity × unit factor). */
export function costPerBaseUnit(purchasePrice: number, purchaseQuantity: number, unitFactor: number) {
  if (purchaseQuantity <= 0 || unitFactor <= 0) return 0;
  return purchasePrice / (purchaseQuantity * unitFactor);
}

/** Cost of one recipe line: quantity × unit factor × cost per base unit. */
export function lineCost(quantity: number, unitFactor: number, costPerBase: number) {
  return quantity * unitFactor * costPerBase;
}

export type LineKind = "raw" | "packaging" | "sub_recipe";

export interface CostLine {
  cost: number;
  kind: LineKind;
  optional: boolean;
}

/**
 * Recipe totals. Waste % applies to ingredients (raw + prepared batches) only, not packaging.
 * Optional items are reported separately and excluded from the total.
 */
export function recipeTotals(lines: CostLine[], wastePercent: number, yieldQuantity: number) {
  let ingredient = 0;
  let packaging = 0;
  let optional = 0;
  for (const l of lines) {
    const c = round(l.cost, 4);
    if (l.optional) optional += c;
    else if (l.kind === "packaging") packaging += c;
    else ingredient += c;
  }
  const waste = round((ingredient * wastePercent) / 100, 4);
  const total = round(ingredient + packaging + waste, 4);
  const perPortion = yieldQuantity > 0 ? round(total / yieldQuantity, 4) : 0;
  return {
    ingredient: round(ingredient, 4),
    packaging: round(packaging, 4),
    optional: round(optional, 4),
    waste,
    total,
    perPortion,
  };
}

/** Selling price without VAT. */
export function netPrice(sellingPrice: number, vatPercent: number, pricesIncludeVat: boolean) {
  return pricesIncludeVat ? sellingPrice / (1 + vatPercent / 100) : sellingPrice;
}

export function margins(net: number, cost: number) {
  const profit = net - cost;
  return {
    profit,
    foodCostPercent: net > 0 ? (cost / net) * 100 : null,
    marginPercent: net > 0 ? (profit / net) * 100 : null,
  };
}

/** Menu price that hits the target food cost %, rounded up to the nearest `step` EGP. */
export function suggestedPrice(
  cost: number,
  targetFoodCostPercent: number,
  vatPercent: number,
  pricesIncludeVat: boolean,
  step = 5,
) {
  if (cost <= 0 || targetFoodCostPercent <= 0) return 0;
  const net = cost / (targetFoodCostPercent / 100);
  const gross = pricesIncludeVat ? net * (1 + vatPercent / 100) : net;
  return Math.ceil(round(gross, 6) / step) * step;
}
