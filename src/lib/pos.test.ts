import { describe, expect, it } from "vitest";
import { addToCart, changeDue, computeTotals, expectedCash, itemCount, removeLine, saleItems, setQuantity, type CartLine } from "./pos";

const latte = { variantId: "v1", name: "لاتيه", unitPrice: 60 };
const esp = { variantId: "v2", name: "إسبريسو", unitPrice: 35.5 };

describe("cart", () => {
  it("adding the same product twice increases its quantity", () => {
    const c = addToCart(addToCart([], latte), latte);
    expect(c).toHaveLength(1);
    expect(c[0]?.quantity).toBe(2);
  });
  it("setting quantity to zero removes the line", () => {
    const c = setQuantity(addToCart([], latte), "v1", 0);
    expect(c).toEqual([]);
  });
  it("remove deletes only that product", () => {
    const c = removeLine(addToCart(addToCart([], latte), esp), "v1");
    expect(c.map((l) => l.variantId)).toEqual(["v2"]);
  });
  it("quantity is capped at 1000 per line", () => {
    expect(setQuantity(addToCart([], latte), "v1", 5000)[0]?.quantity).toBe(1000);
  });
  it("counts items and builds the sale payload", () => {
    const c: CartLine[] = addToCart(addToCart([], latte, 2), esp);
    expect(itemCount(c)).toBe(3);
    expect(saleItems(c)).toEqual([{ variant_id: "v1", quantity: 2 }, { variant_id: "v2", quantity: 1 }]);
  });
});

describe("totals (mirror of create_sale)", () => {
  const cart = addToCart(addToCart([], latte, 2), esp); // 120 + 35.5 = 155.5
  it("no VAT", () => {
    expect(computeTotals(cart, 10, 0, true)).toEqual({ subtotal: 155.5, discount: 10, tax: 0, total: 145.5 });
  });
  it("VAT included in prices: total unchanged, tax extracted", () => {
    expect(computeTotals(cart, 0, 14, true)).toEqual({ subtotal: 155.5, discount: 0, tax: 19.1, total: 155.5 });
  });
  it("VAT added on top of prices after discount", () => {
    expect(computeTotals(cart, 5.5, 14, false)).toEqual({ subtotal: 155.5, discount: 5.5, tax: 21, total: 171 });
  });
  it("discount cannot exceed subtotal or be negative", () => {
    expect(computeTotals(cart, 999, 0, true).total).toBe(0);
    expect(computeTotals(cart, -20, 0, true).discount).toBe(0);
  });
});

describe("cash", () => {
  it("change due", () => {
    expect(changeDue(145.5, 200)).toBe(54.5);
    expect(changeDue(145.5, 100)).toBeNull();
  });
  it("expected drawer counts only completed cash orders", () => {
    const orders = [
      { status: "completed", payment_method: "cash", total: 170 },
      { status: "completed", payment_method: "card", total: 80 },
      { status: "cancelled", payment_method: "cash", total: 50 },
    ];
    expect(expectedCash(500, orders)).toBe(670);
  });
});
