
// Types and pure helpers for the management dashboard.

export interface PeriodKpis {
  orders: number;
  sales: number;
  tax: number;
  discount: number;
  net_sales: number;
  cogs: number | null;
  gross_profit: number | null;
  expenses: number;
  net_profit: number | null;
  avg_ticket: number;
  uncosted_items: number;
  incomplete_fifo_movements?: number;
  uncovered_orders?: number;
  cost_complete?: boolean;
  cancelled: number;
}

export interface DashboardData {
  range: {
    from: string;
    to: string;
    days: number;
    today: string;
    timezone: string;
  };
  current: PeriodKpis;
  previous: PeriodKpis;
  today: PeriodKpis;
  month: PeriodKpis;
  daily: {
    date: string;
    orders: number;
    sales: number;
    net_sales: number;
    cogs: number;
    expenses: number;
    net_profit: number;
  }[];
  hours: { hour: number; orders: number; sales: number }[];
  top_products: {
    name: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    uncosted: boolean;
  }[];
  payments: { method: string; orders: number; total: number }[];
  expense_categories: { category: string; total: number }[];
  staff: {
    user_id: string;
    full_name: string | null;
    role: string | null;
    orders: number;
    sales: number;
    avg_ticket: number;
    shifts: number;
    cash_variance: number | null;
  }[];
  shifts: {
    id: string;
    status: "open" | "closed";
    opened_at: string;
    closed_at: string | null;
    opening_balance: number;
    closing_balance: number | null;
    expected_balance: number | null;
    variance: number | null;
    branch_name: string;
    opened_by_name: string | null;
    orders: number;
    sales: number;
    cash_sales: number;
  }[];
  stock: {
    items: number;
    tracked: number;
    value: number;
    low_count: number;
    out_count: number;
    waste_cost: number;
    alerts: {
      id: string;
      name: string;
      base_unit: string;
      branch_name: string;
      quantity: number;
      reorder_level: number | null;
      ratio: number | null;
    }[];
    consumption: {
      name: string;
      base_unit: string;
      quantity: number;
      cost: number;
    }[];
  };
}

export type RangePreset =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "custom";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date in the cafe's timezone. */
export function todayIn(
  timeZone = "Africa/Cairo",
  now = new Date(),
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Inclusive date range for a preset. */
export function presetRange(
  preset: Exclude<RangePreset, "custom">,
  today: string,
) {
  const t = new Date(`${today}T00:00:00Z`);
  const minus = (n: number) =>
    iso(new Date(t.getTime() - n * 86_400_000));

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: minus(6), to: today };
    case "30d":
      return { from: minus(29), to: today };
    case "month":
      return {
        from: `${today.slice(0, 7)}-01`,
        to: today,
      };
  }
}

/** Returns null when either profit value is unavailable or previous is zero. */
export function pctChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (
    current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous) ||
    previous === 0
  ) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

export type StockStatus = "out" | "low" | "ok" | "untracked";

/** Stock status for one ingredient at one branch. */
export function stockStatus(
  quantity: number,
  reorderLevel: number | null | undefined,
): StockStatus {
  if (quantity <= 0) return "out";
  if (reorderLevel == null) return "untracked";
  return quantity <= reorderLevel ? "low" : "ok";
}

/** Signed adjustment needed to match a physical count. */
export function countAdjustment(
  currentQuantity: number,
  countedQuantity: number,
) {
  return (
    Math.round((countedQuantity - currentQuantity) * 1000) / 1000
  );
}

/** Positive = extra cash; negative = shortage. */
export function cashVariance(
  counted: number,
  openingBalance: number,
  cashSales: number,
) {
  return (
    Math.round(
      (counted - (openingBalance + cashSales)) * 100,
    ) / 100
  );
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "كاش",
  card: "كارت",
  wallet: "محفظة إلكترونية",
  bank_transfer: "تحويل بنكي",
  other: "أخرى",
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "صالة",
  takeaway: "تيك أواي",
  delivery: "توصيل",
};

export const EXPENSE_CATEGORIES = [
  "إيجار",
  "مرتبات",
  "كهرباء",
  "مياه",
  "غاز",
  "إنترنت",
  "صيانة",
  "تسويق",
  "نظافة",
  "نقل",
  "أخرى",
];
