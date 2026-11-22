
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/queries";
import { todayIn } from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({
    meta: [
      { title: "التقارير — CAFE OS" },
      { name: "description", content: "تقارير المبيعات والأرباح." },
    ],
  }),
  component: Page,
});

type Report = {
  period: {
    from: string;
    to: string;
    timezone: string;
  };
  sales: {
    orders_count: number;
    subtotal: number;
    discounts: number;
    taxes: number;
    total_sales: number;
    net_sales: number;
  };
  costs: {
    fifo_cogs: number;
    incomplete_fifo_movements: number;
    fifo_complete: boolean;
    uncosted_items: number;
    uncovered_orders: number;
    cost_complete: boolean;
    waste_cost_estimate: number;
    waste_movements: number;
  };
  profit: {
    gross_profit: number | null;
    net_profit: number | null;
    profit_status: string;
  };
  expenses: {
    total: number;
    details: {
      category: string;
      description: string | null;
      amount: number;
      date: string;
      payment_method: string | null;
    }[];
  };
  products: {
    name: string;
    quantity_sold: number;
    orders_count: number;
    revenue: number;
    estimated_cost: number;
    estimated_profit: number;
    cost_status: string;
  }[];
  order_types: {
    order_type: string;
    orders_count: number;
    sales: number;
  }[];
  payments: {
    payment_method: string;
    orders_count: number;
    total: number;
  }[];
  shifts: {
    shifts_count: number;
    opening_balance: number;
    closing_balance: number;
    expected_balance: number;
  };
};

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  return (
    <ModulePage module="reports" wide>
      {membership ? (
        <Reports
          tenantId={membership.tenant_id}
          preferredBranch={membership.branch_id}
        />
      ) : null}
    </ModulePage>
  );
}

function Reports({
  tenantId,
  preferredBranch,
}: {
  tenantId: string;
  preferredBranch: string | null;
}) {
  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));
  const { data: branches } = useSuspenseQuery(q.branches(tenantId));

  const [branch, setBranch] = useState(preferredBranch ?? "all");
  const [from, setFrom] = useState(() => todayIn(tenant.timezone || "Africa/Cairo"));
  const [to, setTo] = useState(() => todayIn(tenant.timezone || "Africa/Cairo"));

  const reportQuery = useQuery({
    queryKey: ["detailed-profit-report", tenantId, branch, from, to],
    enabled: Boolean(from && to && from <= to),
    queryFn: async () => {
      const rpc = supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;

      const { data, error } = await rpc("detailed_profit_report", {
        _tenant: tenantId,
        _branch: branch === "all" ? null : branch,
        _from: from,
        _to: to,
        _cash_session: null,
      });

      if (error) throw new Error(error.message);
      return data as Report;
    },
    staleTime: 30000,
  });

  const data = reportQuery.data;
  const currency = tenant.currency || "EGP";

  function money(value: number | null | undefined) {
    if (value == null) return "غير متاح";
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function num(value: number | null | undefined) {
    return (value ?? 0).toLocaleString("ar-EG");
  }

  const cards = data
    ? [
        ["إجمالي المبيعات", money(data.sales.total_sales)],
        ["صافي المبيعات", money(data.sales.net_sales)],
        ["تكلفة الخامات FIFO", money(data.costs.fifo_cogs)],
        ["مجمل الربح", money(data.profit.gross_profit)],
        ["إجمالي المصروفات", money(data.expenses.total)],
        ["صافي الربح", money(data.profit.net_profit)],
        ["عدد الطلبات", num(data.sales.orders_count)],
        ["الخصومات", money(data.sales.discounts)],
        ["الضرائب", money(data.sales.taxes)],
      ]
    : [];

  return (
    <div className="space-y-5" dir="rtl">
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">تحديد التقرير</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">من تاريخ</span>
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">إلى تاريخ</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">الفرع</span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="all">كل الفروع</option>
              {branches.filter((b) => b.is_active).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => reportQuery.refetch()}
              disabled={reportQuery.isFetching || from > to}
              className="h-10 w-full rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {reportQuery.isFetching ? "جاري التحديث..." : "تحديث التقرير"}
            </button>
          </div>
        </div>

        {from > to && (
          <p className="mt-3 text-sm text-destructive">
            تاريخ البداية يجب أن يكون قبل تاريخ النهاية.
          </p>
        )}
      </section>

      {reportQuery.isPending && (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          جاري تحميل التقرير...
        </div>
      )}

      {reportQuery.isError && (
        <div className="rounded-xl border border-destructive p-4 text-sm text-destructive">
          تعذر تحميل التقرير: {reportQuery.error.message}
          <p className="mt-2">
            تأكد أن Migration التقارير تم تطبيقه على قاعدة البيانات.
          </p>
        </div>
      )}

      {data && (
        <>
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">ملخص الأداء المالي</h2>
              <span className="text-xs text-muted-foreground">
                {data.period.from} — {data.period.to}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map(([label, value]) => (
                <article key={label} className="rounded-xl border bg-card p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-bold">حالة دقة التكلفة والأرباح</h2>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className={`rounded-lg px-3 py-2 ${
                data.costs.cost_complete
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {data.costs.cost_complete
                  ? "تكلفة المخزون مكتملة"
                  : "توجد بيانات تكلفة ناقصة"}
              </span>
              <span className="rounded-lg bg-muted px-3 py-2">
                حركات FIFO الناقصة: {num(data.costs.incomplete_fifo_movements)}
              </span>
              <span className="rounded-lg bg-muted px-3 py-2">
                أصناف بلا تكلفة: {num(data.costs.uncosted_items)}
              </span>
              <span className="rounded-lg bg-muted px-3 py-2">
                طلبات بلا حركة مخزون: {num(data.costs.uncovered_orders)}
              </span>
            </div>

            {!data.costs.cost_complete && (
              <p className="mt-3 text-sm text-amber-700">
                الأرباح غير معروضة كأرقام نهائية لأن بعض تكاليف المبيعات لم تكتمل.
              </p>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-bold">تفاصيل المصروفات</h2>
              <div className="mb-3 flex justify-between border-b pb-3">
                <span className="text-sm text-muted-foreground">إجمالي المصروفات</span>
                <b>{money(data.expenses.total)}</b>
              </div>

              {data.expenses.details.length ? (
                <div className="space-y-3">
                  {data.expenses.details.map((expense, index) => (
                    <div key={`${expense.date}-${index}`} className="flex justify-between gap-3 border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{expense.category}</p>
                        <p className="text-xs text-muted-foreground">
                          {expense.description || "بدون وصف"} · {expense.date}
                        </p>
                      </div>
                      <b className="whitespace-nowrap">{money(expense.amount)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-5 text-center text-sm text-muted-foreground">
                  لا توجد مصروفات في الفترة.
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-bold">الهالك</h2>
              <p className="text-sm text-muted-foreground">تكلفة الهالك التقديرية</p>
              <p className="my-2 text-2xl font-bold">
                {money(data.costs.waste_cost_estimate)}
              </p>
              <p className="text-sm text-muted-foreground">
                عدد حركات الهالك: {num(data.costs.waste_movements)}
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-bold">الأصناف المباعة</h2>
            {data.products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead>
                    <tr className="border-b text-right text-muted-foreground">
                      <th className="p-3">الصنف</th>
                      <th className="p-3">الكمية</th>
                      <th className="p-3">عدد الطلبات</th>
                      <th className="p-3">المبيعات</th>
                      <th className="p-3">التكلفة التقديرية</th>
                      <th className="p-3">الربح التقديري</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((product, index) => (
                      <tr key={`${product.name}-${index}`} className="border-b last:border-0">
                        <td className="p-3 font-medium">{product.name}</td>
                        <td className="p-3">{num(product.quantity_sold)}</td>
                        <td className="p-3">{num(product.orders_count)}</td>
                        <td className="p-3">{money(product.revenue)}</td>
                        <td className="p-3">{money(product.estimated_cost)}</td>
                        <td className="p-3">{money(product.estimated_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-5 text-center text-sm text-muted-foreground">
                لا توجد أصناف مباعة في الفترة.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              تكلفة وربحية الصنف تقديرية حسب تكلفة الوصفة المسجلة وقت البيع، وليست توزيع FIFO مستقلًا لكل صنف.
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-bold">أنواع الطلبات</h2>
              {data.order_types.length ? data.order_types.map((item) => (
                <div key={item.order_type} className="flex justify-between gap-3 border-b py-3 last:border-0">
                  <div>
                    <p className="font-medium">
                      {item.order_type === "dine_in" ? "صالة" :
                       item.order_type === "takeaway" ? "تيك أواي" :
                       item.order_type === "delivery" ? "توصيل" : item.order_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {num(item.orders_count)} طلب
                    </p>
                  </div>
                  <b>{money(item.sales)}</b>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 font-bold">وسائل الدفع</h2>
              {data.payments.length ? data.payments.map((item) => (
                <div key={item.payment_method} className="flex justify-between gap-3 border-b py-3 last:border-0">
                  <div>
                    <p className="font-medium">
                      {item.payment_method === "cash" ? "كاش" :
                       item.payment_method === "card" ? "كارت" :
                       item.payment_method === "wallet" ? "محفظة إلكترونية" :
                       item.payment_method === "other" ? "أخرى" : item.payment_method}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {num(item.orders_count)} طلب
                    </p>
                  </div>
                  <b>{money(item.total)}</b>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-bold">ملخص الورديات</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">عدد الورديات</p>
                <b>{num(data.shifts.shifts_count)}</b>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">أرصدة الفتح</p>
                <b>{money(data.shifts.opening_balance)}</b>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">أرصدة الإغلاق</p>
                <b>{money(data.shifts.closing_balance)}</b>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الأرصدة المتوقعة</p>
                <b>{money(data.shifts.expected_balance)}</b>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
