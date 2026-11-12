import { describe, expect, it } from "vitest";
import { costPerBaseUnit, lineCost, margins, netPrice, recipeTotals, suggestedPrice } from "./costing";

// Spanish Latte (hot, medium) from the demo cafe — same numbers the database engine produced.
function spanishLatte(milkPricePerLiter: number) {
  const beansPerG = costPerBaseUnit(950, 1, 1000);
  const espressoPerMl = (18 * beansPerG) / 60; // 60 ml double-shot batch
  const milkPerMl = costPerBaseUnit(milkPricePerLiter, 1, 1000);
  const condPerG = costPerBaseUnit(48, 370, 1);
  return recipeTotals(
    [
      { cost: lineCost(60, 1, espressoPerMl), kind: "sub_recipe", optional: false },
      { cost: lineCost(220, 1, milkPerMl), kind: "raw", optional: false },
      { cost: lineCost(30, 1, condPerG), kind: "raw", optional: false },
      { cost: lineCost(1, 1, costPerBaseUnit(160, 50, 1)), kind: "packaging", optional: false },
      { cost: lineCost(1, 1, costPerBaseUnit(95, 100, 1)), kind: "packaging", optional: false },
    ],
    3,
    1,
  );
}

describe("recipe costing", () => {
  it("costs 1 kg bought at 950 EGP as 0.95 EGP per gram", () => {
    expect(costPerBaseUnit(950, 1, 1000)).toBeCloseTo(0.95, 6);
  });

  it("costs a dozen bought at 60 EGP as 5 EGP per piece", () => {
    expect(costPerBaseUnit(60, 1, 12)).toBe(5);
  });

  it("Spanish Latte hot costs 35.29 EGP with milk at 42 EGP/L", () => {
    expect(spanishLatte(42).total.toFixed(2)).toBe("35.29");
  });

  it("Spanish Latte hot rises to 37.10 EGP when milk goes to 50 EGP/L", () => {
    expect(spanishLatte(50).total.toFixed(2)).toBe("37.10");
  });

  it("applies waste % to ingredients only, not packaging", () => {
    const t = recipeTotals(
      [
        { cost: 100, kind: "raw", optional: false },
        { cost: 10, kind: "packaging", optional: false },
      ],
      10,
      1,
    );
    expect(t.waste).toBe(10);
    expect(t.total).toBe(120);
  });

  it("keeps optional items out of the total", () => {
    const t = recipeTotals(
      [
        { cost: 20, kind: "raw", optional: false },
        { cost: 5, kind: "raw", optional: true },
      ],
      0,
      1,
    );
    expect(t.total).toBe(20);
    expect(t.optional).toBe(5);
  });

  it("divides batch cost by yield to get cost per portion", () => {
    expect(recipeTotals([{ cost: 120, kind: "raw", optional: false }], 0, 8).perPortion).toBe(15);
  });
});

describe("pricing and margins", () => {
  it("removes 14% VAT from a 114 EGP VAT-inclusive price", () => {
    expect(netPrice(114, 14, true)).toBeCloseTo(100, 6);
  });

  it("food cost of 30 on a net 100 price is 30% with 70 EGP profit", () => {
    const m = margins(100, 30);
    expect(m.profit).toBe(70);
    expect(m.foodCostPercent).toBe(30);
  });

  it("suggests 120 EGP for a 35.29 cost at 30% target without VAT", () => {
    expect(suggestedPrice(35.29, 30, 0, true)).toBe(120);
  });
});
