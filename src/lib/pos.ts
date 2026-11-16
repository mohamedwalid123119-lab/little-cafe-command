// Pure point-of-sale helpers. The database (public.create_sale) re-prices every order;
// computeTotals mirrors its formula so the cashier sees the same total that gets saved.

export interface CartLine {
  variantId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export const PAYMENT_METHODS = ["cash", "card", "wallet", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const ORDER_TYPES = ["dine_in", "takeaway", "delivery"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/** Max lines and quantity per line accepted by the database. */
export const MAX_LINES = 100;
export const MAX_QTY = 1000;

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function addToCart(lines: CartLine[], item: Omit<CartLine, "quantity">, qty = 1): CartLine[] {
  const existing = lines.find((l) => l.variantId === item.variantId);
  if (existing) return setQuantity(lines, item.variantId, existing.quantity + qty);
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { ...item, quantity: Math.min(qty, MAX_QTY) }];
}

/** Sets a line's quantity; zero or less removes the line. */
export function setQuantity(lines: CartLine[], variantId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, variantId);
  return lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, MAX_QTY) } : l));
}

export function removeLine(lines: CartLine[], variantId: string): CartLine[] {
  return lines.filter((l) => l.variantId !== variantId);
}

export const lineTotal = (l: CartLine) => r2(l.quantity * l.unitPrice);
export const itemCount = (lines: CartLine[]) => lines.reduce((s, l) => s + l.quantity, 0);

export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/** Same rules as public.create_sale: discount capped to subtotal; VAT included in or added to prices. */
export function computeTotals(lines: CartLine[], discount: number, vatPercent: number, pricesIncludeVat: boolean): Totals {
  const subtotal = r2(lines.reduce((s, l) => s + lineTotal(l), 0));
  const disc = r2(Math.min(Math.max(Number.isFinite(discount) ? discount : 0, 0), subtotal));
  const vat = Number(vatPercent) || 0;
  if (pricesIncludeVat) {
    const total = r2(subtotal - disc);
    return { subtotal, discount: disc, tax: r2(total - total / (1 + vat / 100)), total };
  }
  const tax = r2(((subtotal - disc) * vat) / 100);
  return { subtotal, discount: disc, tax, total: r2(subtotal - disc + tax) };
}

/** Change to hand back for a cash payment; null when the amount received is not enough. */
export function changeDue(total: number, received: number): number | null {
  if (!Number.isFinite(received) || received < total) return null;
  return r2(received - total);
}

/** Payload for public.create_sale. */
export const saleItems = (lines: CartLine[]) => lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity }));

/** Expected cash in the drawer: opening balance + completed cash sales of the shift. */
export function expectedCash(opening: number, orders: { status: string; payment_method: string | null; total: number }[]) {
  return r2(opening + orders.filter((o) => o.status === "completed" && o.payment_method === "cash").reduce((s, o) => s + Number(o.total), 0));
}
