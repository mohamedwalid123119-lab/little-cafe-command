
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/queries";
import {
  presetRange,
  pctChange,
  type DashboardData,
  type RangePreset,
} from "@/lib/dashboard";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [{ title: "CAFE OS — Dashboard" }],
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

type Section =
  | "overview"
  | "sales"
  | "stock"
  | "shifts"
  | "products"
  | "alerts";

const sections: { id: Section; ar: string; en: string; icon: string }[] = [
  { id: "overview", ar: "ملخص الأداء", en: "Overview", icon: "◈" },
  { id: "sales", ar: "حركة المبيعات", en: "Sales", icon: "↗" },
  { id: "stock", ar: "حالة المخزون", en: "Inventory", icon: "▦" },
  { id: "shifts", ar: "الورديات والخزنة", en: "Shifts & Cash", icon: "◷" },
  { id: "products", ar: "الأكثر مبيعًا", en: "Top Products", icon: "★" },
  { id: "alerts", ar: "التنبيهات والنشاط", en: "Alerts & Activity", icon: "!" },
];

function tr(isArabic: boolean, ar: string, en: string) {
  return isArabic ? ar : en;
}

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
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  const [section, setSection] = useState<Section>("overview");
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
    queryKey: [
      "dashboard-overview",
      tenantId,
      branch,
      range.from,
      range.to,
    ],
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

  function money(value: number | null | undefined) {
    return new Intl.NumberFormat(isArabic ? "ar-EG" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function num(value: number | null | undefined) {
    return (value || 0).toLocaleString(isArabic ? "ar-EG" : "en-US");
  }

  const currentSection = sections.find((item) => item.id === section)!;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="min-h-full w-full space-y-5 bg-[#f5f3ed] p-3 text-[#171717] dark:bg-[#090909] dark:text-white md:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#a88732]">
            LITTLE CAFE COMMAND
          </p>
          <h1 className="mt-1 text-2xl font-bold">{tenant.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {tr(isArabic, "لوحة متابعة وإدارة الكافيه", "Cafe Management Dashboard")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-10 rounded-lg border border-[#b99a45]/40 bg-white px-3 text-sm dark:bg-[#171717]"
            aria-label={tr(isArabic, "اختيار الفرع", "Select Branch")}
          >
            <option value="all">{tr(isArabic, "كل الفروع", "All Branches")}</option>
            {branches.filter((b) => b.is_active).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RangePreset)}
            className="h-10 rounded-lg border border-[#b99a45]/40 bg-white px-3 text-sm dark:bg-[#171717]"
            aria-label={tr(isArabic, "الفترة الزمنية", "Time Period")}
          >
            <option value="today">{tr(isArabic, "اليوم", "Today")}</option>
            <option value="7d">{tr(isArabic, "آخر 7 أيام", "Last 7 Days")}</option>
            <option value="30d">{tr(isArabic, "آخر 30 يوم", "Last 30 Days")}</option>
            <option value="month">{tr(isArabic, "هذا الشهر", "This Month")}</option>
          </select>
        </div>
      </header>

      <nav
        aria-label={tr(isArabic, "أقسام لوحة التحكم", "Dashboard Sections")}
        className="grid grid-cols-2 gap-2 rounded-2xl border border-[#b99a45]/40 bg-[#111111] p-2 sm:grid-cols-3 xl:grid-cols-6"
      >
        {sections.map((item) => {
          const active = section === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              aria-pressed={active}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl px-2 py-3 text-center transition-all ${
                active
                  ? "bg-[#c6a34a] text-[#111111] shadow-lg"
                  : "text-[#d7c18a] hover:bg-[#29251a]"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-bold sm:text-sm">
                {tr(isArabic, item.ar, item.en)}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-b border-[#b99a45]/40 pb-3">
        <h2 className="text-xl font-bold">
          {tr(isArabic, currentSection.ar, currentSection.en)}
        </h2>
        <span dir="ltr" className="text-xs text-gray-500 dark:text-gray-400">
          {range.from} — {range.to}
        </span>
      </div>

      {result.isPending && (
        <div className="rounded-xl border border-[#b99a45]/30 bg-white p-8 text-center dark:bg-[#151515]">
          {tr(isArabic, "جاري تحميل البيانات...", "Loading data...")}
        </div>
      )}

      {result.isError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/50 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {tr(isArabic, "تعذر تحميل لوحة التحكم:", "Could not load dashboard:")}{" "}
          {result.error.message}
        </div>
      )}

      {data && (
        <>
          {section === "overview" && (
            <Overview data={data} money={money} num={num} isArabic={isArabic} />
          )}
          {section === "sales" && (
            <Sales data={data} money={money} num={num} isArabic={isArabic} />
          )}
          {section === "stock" && (
            <Inventory data={data} money={money} num={num} isArabic={isArabic} />
          )}
          {section === "shifts" && (
            <Shifts data={data} money={money} num={num} isArabic={isArabic} />
          )}
          {section === "products" && (
            <Products data={data} money={money} num={num} isArabic={isArabic} />
          )}
          {section === "alerts" && (
            <Alerts data={data} money={money} num={num} isArabic={isArabic} />
          )}
        </>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#b99a32]/30 bg-white p-4 shadow-sm dark:bg-[#151515]">
      <h3 className="mb-4 font-bold text-[#9b7927] dark:text-[#d5b65b]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Metric({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-2xl border border-[#b99a45]/40 bg-white p-4 shadow-sm dark:bg-[#151515]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-3 text-xl font-bold tabular-nums text-[#9b7927] dark:text-[#dfc16a] md:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </article>
  );
}

type DashboardProps = {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
  isArabic: boolean;
};

function Overview({ data, money, num, isArabic }: DashboardProps) {
  const change = pctChange(data.current.net_profit, data.previous.net_profit);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title={tr(isArabic, "إجمالي المبيعات", "Total Sales")} value={money(data.current.sales)} hint={`${num(data.current.orders)} ${tr(isArabic, "طلب", "orders")}`} />
        <Metric title={tr(isArabic, "صافي المبيعات", "Net Sales")} value={money(data.current.net_sales)} hint={tr(isArabic, "بعد الضريبة والخصومات", "After tax and discounts")} />
        <Metric title={tr(isArabic, "مجمل الربح", "Gross Profit")} value={money(data.current.gross_profit)} hint={tr(isArabic, "بعد تكلفة المنتجات", "After product costs")} />
        <Metric title={tr(isArabic, "صافي الربح", "Net Profit")} value={money(data.current.net_profit)} hint={tr(isArabic, "بعد المصروفات", "After expenses")} />
        <Metric title={tr(isArabic, "المصروفات", "Expenses")} value={money(data.current.expenses)} />
        <Metric title={tr(isArabic, "متوسط الفاتورة", "Average Ticket")} value={money(data.current.avg_ticket)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={tr(isArabic, "المبيعات اليومية", "Daily Sales")}>
          {data.daily.length ? (
            <div className="space-y-4">
              {data.daily.map((day) => {
                const max = Math.max(1, ...data.daily.map((d) => d.sales));
                const width = (day.sales / max) * 100;
                return (
                  <div key={day.date} className="grid grid-cols-[75px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
                    <span dir="ltr" className="text-gray-500">{day.date.slice(5)}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-[#303030]">
                      <div className="h-full rounded-full bg-[#c6a34a]" style={{ width: `${width}%` }} />
                    </div>
                    <b>{money(day.sales)}</b>
                  </div>
                );
              })}
            </div>
          ) : <Empty isArabic={isArabic} />}
        </Panel>

        <Panel title={tr(isArabic, "مقارنة الأرباح", "Profit Comparison")}>
          <p className="text-sm text-gray-500">{tr(isArabic, "مقارنة بالفترة السابقة", "Compared to previous period")}</p>
          <p className="my-4 text-3xl font-bold text-[#b18d35]">
            {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          </p>
          <Info label={tr(isArabic, "الفترة الحالية", "Current Period")} value={money(data.current.net_profit)} />
          <Info label={tr(isArabic, "الفترة السابقة", "Previous Period")} value={money(data.previous.net_profit)} />
          <Info label={tr(isArabic, "تكلفة البضاعة", "Cost of Goods")} value={money(data.current.cogs)} />
          <Info label={tr(isArabic, "الضريبة", "Tax")} value={money(data.current.tax)} />
        </Panel>

        <Panel title={tr(isArabic, "ملخص المخزون", "Inventory Summary")}>
          <MetricInline label={tr(isArabic, "عدد الخامات", "Materials Count")} value={num(data.stock.items)} />
          <MetricInline label={tr(isArabic, "مخزون منخفض", "Low Stock")} value={num(data.stock.low_count)} />
          <MetricInline label={tr(isArabic, "خامات نفدت", "Out of Stock")} value={num(data.stock.out_count)} />
          <MetricInline label={tr(isArabic, "قيمة المخزون", "Inventory Value")} value={money(data.stock.value)} />
        </Panel>
      </div>
    </div>
  );
}

function Sales({ data, money, num, isArabic }: DashboardProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title={tr(isArabic, "المبيعات", "Sales")} value={money(data.current.sales)} />
        <Metric title={tr(isArabic, "عدد الطلبات", "Number of Orders")} value={num(data.current.orders)} />
        <Metric title={tr(isArabic, "متوسط الفاتورة", "Average Ticket")} value={money(data.current.avg_ticket)} />
        <Metric title={tr(isArabic, "الطلبات الملغاة", "Cancelled Orders")} value={num(data.current.cancelled)} />
      </div>

      <Panel title={tr(isArabic, "المبيعات اليومية", "Daily Sales")}>
        {data.daily.length ? data.daily.map((day) => (
          <div key={day.date} className="mb-4 grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span dir="ltr">{day.date.slice(5)}</span>
            <div className="h-3 rounded-full bg-gray-200 dark:bg-[#303030]">
              <div className="h-3 rounded-full bg-[#c6a34a]" style={{ width: `${Math.min(100, day.sales / Math.max(1, ...data.daily.map((d) => d.sales)) * 100)}%` }} />
            </div>
            <b>{money(day.sales)}</b>
          </div>
        )) : <Empty isArabic={isArabic} />}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={tr(isArabic, "طرق الدفع", "Payment Methods")}>
          {data.payments.length ? data.payments.map((p) => (
            <Info key={p.method} label={p.method} value={`${money(p.total)} · ${num(p.orders)} ${tr(isArabic, "طلب", "orders")}`} />
          )) : <Empty isArabic={isArabic} />}
        </Panel>

        <Panel title={tr(isArabic, "ساعات الذروة", "Peak Hours")}>
          {data.hours.length ? data.hours.map((h) => (
            <Info key={h.hour} label={`${String(h.hour).padStart(2, "0")}:00`} value={`${money(h.sales)} · ${num(h.orders)} ${tr(isArabic, "طلب", "orders")}`} />
          )) : <Empty isArabic={isArabic} />}
        </Panel>
      </div>

      <Panel title={tr(isArabic, "أداء الموظفين", "Staff Performance")}>
        {data.staff.length ? data.staff.map((s) => (
          <Info
            key={s.user_id}
            label={s.full_name || tr(isArabic, "موظف", "Employee")}
            value={`${money(s.sales)} · ${num(s.orders)} ${tr(isArabic, "طلب", "orders")}`}
          />
        )) : <Empty isArabic={isArabic} />}
      </Panel>
    </div>
  );
}

function Inventory({ data, money, num, isArabic }: DashboardProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title={tr(isArabic, "عدد الخامات", "Materials Count")} value={num(data.stock.items)} />
        <Metric title={tr(isArabic, "قيمة المخزون", "Inventory Value")} value={money(data.stock.value)} />
        <Metric title={tr(isArabic, "مخزون منخفض", "Low Stock")} value={num(data.stock.low_count)} />
        <Metric title={tr(isArabic, "نفد من المخزون", "Out of Stock")} value={num(data.stock.out_count)} />
      </div>

      <Panel title={tr(isArabic, "تنبيهات المخزون", "Inventory Alerts")}>
        {data.stock.alerts.length ? data.stock.alerts.map((item) => (
          <Info
            key={`${item.id}-${item.branch_name}`}
            label={`${item.name} — ${item.branch_name}`}
            value={`${num(item.quantity)} ${item.base_unit}`}
          />
        )) : <Empty isArabic={isArabic} />}
      </Panel>

      <Panel title={tr(isArabic, "استهلاك الخامات والهالك", "Material Consumption & Waste")}>
        <MetricInline label={tr(isArabic, "تكلفة الهالك", "Waste Cost")} value={money(data.stock.waste_cost)} />
        {data.stock.consumption.length ? data.stock.consumption.map((item) => (
          <Info
            key={item.name}
            label={`${item.name} (${num(item.quantity)} ${item.base_unit})`}
            value={money(item.cost)}
          />
        )) : <Empty isArabic={isArabic} />}
      </Panel>
    </div>
  );
}

function Shifts({ data, money, num, isArabic }: DashboardProps) {
  const openShifts = data.shifts.filter((s) => s.status === "open");

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title={tr(isArabic, "الورديات المفتوحة", "Open Shifts")} value={num(openShifts.length)} />
        <Metric title={tr(isArabic, "إجمالي الورديات", "Total Shifts")} value={num(data.shifts.length)} />
        <Metric title={tr(isArabic, "مبيعات الفترة", "Period Sales")} value={money(data.current.sales)} />
      </div>

      <Panel title={tr(isArabic, "تفاصيل الورديات والخزنة", "Shifts & Cash Details")}>
        {data.shifts.length ? data.shifts.map((shift) => (
          <div key={shift.id} className="mb-4 rounded-xl border border-[#b99a45]/30 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <b>{shift.branch_name}</b>
              <span className={shift.status === "open" ? "text-green-600" : "text-gray-500"}>
                {shift.status === "open"
                  ? tr(isArabic, "مفتوحة", "Open")
                  : tr(isArabic, "مغلقة", "Closed")}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {tr(isArabic, "المسؤول:", "Responsible:")} {shift.opened_by_name || tr(isArabic, "غير محدد", "Not specified")}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Info label={tr(isArabic, "المبيعات", "Sales")} value={money(shift.sales)} />
              <Info label={tr(isArabic, "مبيعات الكاش", "Cash Sales")} value={money(shift.cash_sales)} />
              <Info label={tr(isArabic, "رصيد الفتح", "Opening Balance")} value={money(shift.opening_balance)} />
              <Info label={tr(isArabic, "رصيد الإغلاق المتوقع", "Expected Closing Balance")} value={money(shift.expected_balance || 0)} />
              <Info label={tr(isArabic, "عدد الطلبات", "Number of Orders")} value={num(shift.orders)} />
              {shift.variance !== null && (
                <Info label={tr(isArabic, "فرق الخزنة", "Cash Variance")} value={money(shift.variance)} />
              )}
            </div>
          </div>
        )) : <Empty isArabic={isArabic} />}
      </Panel>
    </div>
  );
}

function Products({ data, money, num, isArabic }: DashboardProps) {
  return (
    <div className="space-y-5">
      <Panel title={tr(isArabic, "المنتجات الأكثر مبيعًا", "Top Selling Products")}>
        {data.top_products.length ? data.top_products.map((item, index) => (
          <div key={item.name} className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#b99a45]/20 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c6a34a] font-bold text-black">
                {index + 1}
              </span>
              <div>
                <b>{item.name}</b>
                <p className="text-xs text-gray-500">
                  {num(item.quantity)} {tr(isArabic, "وحدة", "units")}
                  {item.uncosted
                    ? ` · ${tr(isArabic, "التكلفة غير مسجلة", "Cost not recorded")}`
                    : ""}
                </p>
              </div>
            </div>
            <div className="text-left">
              <b>{money(item.revenue)}</b>
              <p className="text-xs text-gray-500">
                {tr(isArabic, "الربح:", "Profit:")} {money(item.profit)}
              </p>
            </div>
          </div>
        )) : <Empty isArabic={isArabic} />}
      </Panel>
    </div>
  );
}

function Alerts({ data, money, num, isArabic }: DashboardProps) {
  const openShifts = data.shifts.filter((s) => s.status === "open");
  const uncosted = data.top_products.filter((p) => p.uncosted);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title={tr(isArabic, "تنبيهات المخزون", "Inventory Alerts")} value={num(data.stock.alerts.length)} />
        <Metric title={tr(isArabic, "ورديات مفتوحة", "Open Shifts")} value={num(openShifts.length)} />
        <Metric title={tr(isArabic, "منتجات تكلفتها غير مسجلة", "Products Without Recorded Cost")} value={num(uncosted.length)} />
      </div>

      <Panel title={tr(isArabic, "تنبيهات المخزون", "Inventory Alerts")}>
        {data.stock.alerts.length ? data.stock.alerts.map((item) => (
          <Info
            key={`${item.id}-${item.branch_name}`}
            label={`${item.name} — ${item.branch_name}`}
            value={`${num(item.quantity)} ${item.base_unit}`}
          />
        )) : <Empty isArabic={isArabic} />}
      </Panel>

      <Panel title={tr(isArabic, "الورديات المفتوحة", "Open Shifts")}>
        {openShifts.length ? openShifts.map((shift) => (
          <Info
            key={shift.id}
            label={`${shift.branch_name} — ${shift.opened_by_name || tr(isArabic, "غير محدد", "Not specified")}`}
            value={`${tr(isArabic, "مبيعات", "Sales")} ${money(shift.sales)}`}
          />
        )) : <Empty isArabic={isArabic} />}
      </Panel>

      <Panel title={tr(isArabic, "تنبيهات تكلفة المنتجات", "Product Cost Alerts")}>
        {uncosted.length ? uncosted.map((item) => (
          <Info
            key={item.name}
            label={item.name}
            value={tr(isArabic, "التكلفة غير مسجلة", "Cost not recorded")}
          />
        )) : <Empty isArabic={isArabic} />}
      </Panel>

      <p className="text-xs text-gray-500">
        {tr(
          isArabic,
          "هذا القسم يعرض التنبيهات المتاحة حاليًا. سجل النشاط التفصيلي سيتم إضافته في مرحلة لاحقة.",
          "This section displays currently available alerts. A detailed activity log will be added in a later stage.",
        )}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 py-3 text-sm last:border-0 dark:border-[#333]">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <b className="text-left">{value}</b>
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-lg bg-[#f5f3ed] p-3 text-sm dark:bg-[#222]">
      <span>{label}</span>
      <b className="text-[#9b7927] dark:text-[#dfc16a]">{value}</b>
    </div>
  );
}

function Empty({ isArabic }: { isArabic: boolean }) {
  return (
    <p className="py-8 text-center text-sm text-gray-500">
      {tr(isArabic, "لا توجد بيانات مسجلة في الفترة المحددة.", "No data recorded for the selected period.")}
    </p>
  );
}
