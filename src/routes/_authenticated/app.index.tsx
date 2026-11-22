
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/queries";
import { presetRange, pctChange, type DashboardData, type RangePreset } from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [{ title: "لوحة التحكم — CAFE OS" }],
  }),
  loader: async ({ context }) => {
    const memberships = await context.queryClient.ensureQueryData(
      q.myMemberships(context.user.id),
    );
    const tenantId = memberships[0]?.tenant_id;
    if (!tenantId) return;
    await Promise.all([
      context.queryClient.ensureQueryData(q.tenant(tenantId)),
      context.queryClient.ensureQueryData(q.branches(tenantId)),
    ]);
  },
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  return (
    <ModulePage module="dashboard" wide>
      {membership && (
        <Dashboard
          tenantId={membership.tenant_id}
          preferredBranch={membership.branch_id}
        />
      )}
    </ModulePage>
  );
}

function Dashboard({
  tenantId,
  preferredBranch,
}: {
  tenantId: string;
  preferredBranch: string | null;
}) {
  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));
  const { data: branches } = useSuspenseQuery(q.branches(tenantId));

  const [period, setPeriod] = useState<RangePreset>("7d");
  const [branch, setBranch] = useState(preferredBranch ?? "all");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: tenant.timezone || "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const range = presetRange(
    period as Exclude<RangePreset, "custom">,
    today,
  );

  const result = useQuery({
    queryKey: ["dashboard-overview", tenantId, branch, range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_overview", {
        _tenant: tenantId,
        ...(branch === "all" ? {} : { _branch: branch }),
        _from: range.from,
        _to: range.to,
      });

      if (error) throw error;
      return data as unknown as DashboardData;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const data = result.data;
  const currency = tenant.currency || "EGP";

  function money(value: number) {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function num(value: number) {
    return (value || 0).toLocaleString("ar-EG");
  }

  const metrics = data
    ? [
        ["إجمالي المبيعات", money(data.current.sales), `${num(data.current.orders)} طلب`],
        ["صافي المبيعات", money(data.current.net_sales), "بعد الضريبة والخصومات"],
        ["مجمل الربح", money(data.current.gross_profit), "بعد تكلفة المنتجات"],
        ["صافي الربح", money(data.current.net_profit), "بعد المصروفات"],
        ["المصروفات", money(data.current.expenses), "خلال الفترة"],
        ["متوسط الفاتورة", money(data.current.avg_ticket), "متوسط قيمة الطلب"],
      ]
    : [];

  const profitChange = data
    ? pctChange(data.current.net_profit, data.previous.net_profit)
    : null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 p-4 md:p-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            لوحة متابعة أداء الكافيه
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            aria-label="اختيار الفرع"
          >
            <option value="all">كل الفروع</option>
            {branches.filter((b) => b.is_active).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RangePreset)}
            className="h-10 rounded-md border bg-background px-3 text-sm"
            aria-label="الفترة"
          >
            <option value="today">اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
            <option value="month">هذا الشهر</option>
          </select>
        </div>
      </header>

      {result.isPending && (
        <p className="rounded-xl border p-5 text-sm text-muted-foreground">
          جاري تحميل البيانات...
        </p>
      )}

      {result.isError && (
        <p role="alert" className="rounded-xl border border-destructive p-4 text-sm text-destructive">
          تعذر تحميل لوحة التحكم: {result.error.message}
        </p>
      )}

      {data && (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(([label, value, hint]) => (
              <article key={label} className="rounded-xl border bg-card p-4 shadow-sm">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-xl border bg-card p-4 xl:col-span-2">
              <h2 className="mb-4 font-semibold">المبيعات اليومية</h2>

              {data.daily.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  لا توجد مبيعات في الفترة المحددة.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.daily.map((day) => {
                    const max = Math.max(
                      1,
                      ...data.daily.map((item) => item.sales),
                    );
                    const width = (day.sales / max) * 100;

                    return (
                      <div
                        key={day.date}
                        className="grid grid-cols-[75px_minmax(0,1fr)_auto] items-center gap-3 text-sm"
                      >
                        <span className="text-muted-foreground" dir="ltr">
                          {day.date.slice(5)}
                        </span>
                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                        <span className="font-semibold tabular-nums">
                          {money(day.sales)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="rounded-xl border bg-card p-4">
              <h2 className="mb-4 font-semibold">مقارنة الأرباح</h2>
              <p className="text-sm text-muted-foreground">مقارنة بالفترة السابقة</p>
              <p className="mt-3 text-3xl font-bold">
                {profitChange === null
                  ? "—"
                  : `${profitChange > 0 ? "+" : ""}${profitChange.toFixed(1)}%`}
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الفترة الحالية</span>
                  <b>{money(data.current.net_profit)}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الفترة السابقة</span>
                  <b>{money(data.previous.net_profit)}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">تكلفة البضاعة</span>
                  <b>{money(data.current.cogs)}</b>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">الضريبة</span>
                  <b>{money(data.current.tax)}</b>
                </div>
              </div>
            </article>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-xl border bg-card p-4">
              <h2 className="mb-4 font-semibold">الأكثر مبيعًا</h2>
              {data.top_products.length ? (
                <div className="space-y-3">
                  {data.top_products.slice(0, 8).map((item) => (
                    <div
                      key={item.name}
                      className="flex justify-between gap-3 border-b pb-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {num(item.quantity)} وحدة
                          {item.uncosted ? " · التكلفة غير مسجلة" : ""}
                        </p>
                      </div>
                      <b className="text-sm">{money(item.revenue)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد مبيعات مسجلة.</p>
              )}
            </article>

            <article className="rounded-xl border bg-card p-4">
              <h2 className="mb-4 font-semibold">تنبيهات المخزون</h2>
              <div className="mb-4 flex gap-5 text-sm">
                <span>مخزون منخفض: <b>{num(data.stock.low_count)}</b></span>
                <span>نفد: <b>{num(data.stock.out_count)}</b></span>
              </div>
              {data.stock.alerts.length ? (
                <div className="space-y-3">
                  {data.stock.alerts.slice(0, 8).map((item) => (
                    <div
                      key={`${item.id}-${item.branch_name}`}
                      className="flex justify-between gap-3 border-b pb-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.branch_name}</p>
                      </div>
                      <b className="text-sm">
                        {num(item.quantity)} {item.base_unit}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد تنبيهات حاليًا.</p>
              )}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
