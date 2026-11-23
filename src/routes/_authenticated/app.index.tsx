
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
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
  { id: "alerts", ar: "التنبيهات والنشاط", en: "Alerts", icon: "!" },
];

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
  const isArabic = true;

  function money(value: number | null | undefined) {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function num(value: number | null | undefined) {
    return (value || 0).toLocaleString("ar-EG");
  }

  const currentSection = sections.find((item) => item.id === section)!;

  return (
    <div
      dir="rtl"
      className="min-h-full w-full space-y-5 bg-[#f5f3ed] p-3 text-[#171717] dark:bg-[#090909] dark:text-white md:p-6"
    >
      {/* رأس لوحة التحكم */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-[#a88732]">
            LITTLE CAFE COMMAND
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {tenant.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            لوحة متابعة وإدارة الكافيه
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-10 rounded-lg border border-[#b99a45]/40 bg-white px-3 text-sm dark:bg-[#171717]"
            aria-label="اختيار الفرع"
          >
            <option value="all">كل الفروع</option>
            {branches.filter((b) => b.is_active).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as RangePreset)}
            className="h-10 rounded-lg border border-[#b99a45]/40 bg-white px-3 text-sm dark:bg-[#171717]"
            aria-label="الفترة الزمنية"
          >
            <option value="today">اليوم</option>
            <option value="7d">آخر 7 أيام</option>
            <option value="30d">آخر 30 يوم</option>
            <option value="month">هذا الشهر</option>
          </select>
        </div>
      </header>

      {/* شريط الأقسام الثابت */}
      <nav
        aria-label="أقسام لوحة التحكم"
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
                {isArabic ? item.ar : item.en}
              </span>
            </button>
          );
        })}
      </nav>

      {/* عنوان القسم المختار */}
      <div className="flex items-center justify-between border-b border-[#b99a45]/40 pb-3">
        <h2 className="text-xl font-bold">
          {currentSection.ar}
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {range.from} — {range.to}
        </span>
      </div>

      {result.isPending && (
        <div className="rounded-xl border border-[#b99a45]/30 bg-white p-8 text-center dark:bg-[#151515]">
          جاري تحميل البيانات...
        </div>
      )}

      {result.isError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/50 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          تعذر تحميل لوحة التحكم: {result.error.message}
        </div>
      )}

      {data && (
        <>
          {section === "overview" && (
            <Overview
              data={data}
              money={money}
              num={num}
            />
          )}

          {section === "sales" && (
            <Sales
              data={data}
              money={money}
              num={num}
            />
          )}

          {section === "stock" && (
            <Inventory
              data={data}
              money={money}
              num={num}
            />
          )}

          {section === "shifts" && (
            <Shifts
              data={data}
              money={money}
              num={num}
            />
          )}

          {section === "products" && (
            <Products
              data={data}
              money={money}
              num={num}
            />
          )}

          {section === "alerts" && (
            <Alerts
              data={data}
              money={money}
              num={num}
            />
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
    <section className="rounded-2xl border border-[#b99a45]/30 bg-white p-4 shadow-sm dark:bg-[#151515]">
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
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {title}
      </p>
      <p className="mt-3 text-xl font-bold tabular-nums text-[#9b7927] dark:text-[#dfc16a] md:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </article>
  );
}

function Overview({
  data,
  money,
  num,
}: {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
}) {
  const change = pctChange(
    data.current.net_profit,
    data.previous.net_profit,
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title="إجمالي المبيعات" value={money(data.current.sales)} hint={`${num(data.current.orders)} طلب`} />
        <Metric title="صافي المبيعات" value={money(data.current.net_sales)} hint="بعد الضريبة والخصومات" />
        <Metric title="مجمل الربح" value={money(data.current.gross_profit)} hint="بعد تكلفة المنتجات" />
        <Metric title="صافي الربح" value={money(data.current.net_profit)} hint="بعد المصروفات" />
        <Metric title="المصروفات" value={money(data.current.expenses)} />
        <Metric title="متوسط الفاتورة" value={money(data.current.avg_ticket)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="المبيعات اليومية">
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
          ) : (
            <Empty />
          )}
        </Panel>

        <Panel title="مقارنة الأرباح">
          <p className="text-sm text-gray-500">مقارنة بالفترة السابقة</p>
          <p className="my-4 text-3xl font-bold text-[#b18d35]">
            {change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          </p>
          <Info label="الفترة الحالية" value={money(data.current.net_profit)} />
          <Info label="الفترة السابقة" value={money(data.previous.net_profit)} />
          <Info label="تكلفة البضاعة" value={money(data.current.cogs)} />
          <Info label="الضريبة" value={money(data.current.tax)} />
        </Panel>

        <Panel title="ملخص المخزون">
          <MetricInline label="عدد الخامات" value={num(data.stock.items)} />
          <MetricInline label="مخزون منخفض" value={num(data.stock.low_count)} />
          <MetricInline label="خامات نفدت" value={num(data.stock.out_count)} />
          <MetricInline label="قيمة المخزون" value={money(data.stock.value)} />
        </Panel>
      </div>
    </div>
  );
}

function Sales({
  data,
  money,
  num,
}: {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="المبيعات" value={money(data.current.sales)} />
        <Metric title="عدد الطلبات" value={num(data.current.orders)} />
        <Metric title="متوسط الفاتورة" value={money(data.current.avg_ticket)} />
        <Metric title="الطلبات الملغاة" value={num(data.current.cancelled)} />
      </div>

      <Panel title="المبيعات اليومية">
        {data.daily.length ? data.daily.map((day) => (
          <div key={day.date} className="mb-4 grid grid-cols-[80px_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span dir="ltr">{day.date.slice(5)}</span>
            <div className="h-3 rounded-full bg-gray-200 dark:bg-[#303030]">
              <div
                className="h-3 rounded-full bg-[#c6a34a]"
                style={{ width: `${Math.min(100, day.sales / Math.max(1, ...data.daily.map((d) => d.sales)) * 100)}%` }}
              />
            </div>
            <b>{money(day.sales)}</b>
          </div>
        )) : <Empty />}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="طرق الدفع">
          {data.payments.length ? data.payments.map((p) => (
            <Info key={p.method} label={p.method} value={`${money(p.total)} · ${num(p.orders)} طلب`} />
          )) : <Empty />}
        </Panel>

        <Panel title="ساعات الذروة">
          {data.hours.length ? data.hours.map((h) => (
            <Info key={h.hour} label={`${String(h.hour).padStart(2, "0")}:00`} value={`${money(h.sales)} · ${num(h.orders)} طلب`} />
          )) : <Empty />}
        </Panel>
      </div>

      <Panel title="أداء الموظفين">
        {data.staff.length ? data.staff.map((s) => (
          <Info
            key={s.user_id}
            label={s.full_name || "موظف"}
            value={`${money(s.sales)} · ${num(s.orders)} طلب`}
          />
        )) : <Empty />}
      </Panel>
    </div>
  );
}

function Inventory({
  data,
  money,
  num,
}: {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="عدد الخامات" value={num(data.stock.items)} />
        <Metric title="قيمة المخزون" value={money(data.stock.value)} />
        <Metric title="مخزون منخفض" value={num(data.stock.low_count)} />
        <Metric title="نفد من المخزون" value={num(data.stock.out_count)} />
      </div>

      <Panel title="تنبيهات المخزون">
        {data.stock.alerts.length ? data.stock.alerts.map((item) => (
          <Info
            key={`${item.id}-${item.branch_name}`}
            label={`${item.name} — ${item.branch_name}`}
            value={`${num(item.quantity)} ${item.base_unit}`}
          />
        )) : <Empty />}
      </Panel>

      <Panel title="استهلاك الخامات والهالك">
        <MetricInline label="تكلفة الهالك" value={money(data.stock.waste_cost)} />
        {data.stock.consumption.length ? data.stock.consumption.map((item) => (
          <Info
            key={item.name}
            label={`${item.name} (${num(item.quantity)} ${item.base_unit})`}
            value={money(item.cost)}
          />
        )) : <Empty />}
      </Panel>
    </div>
  );
}

function Shifts({
  data,
  money,
  num,
}: {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
}) {
  const openShifts = data.shifts.filter((s) => s.status === "open").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title="الورديات المفتوحة" value={num(openShifts)} />
        <Metric title="إجمالي الورديات" value={num(data.shifts.length)} />
        <Metric title="مبيعات الفترة" value={money(data.current.sales)} />
      </div>

      <Panel title="تفاصيل الورديات والخزنة">
        {data.shifts.length ? data.shifts.map((shift) => (
          <div key={shift.id} className="mb-4 rounded-xl border border-[#b99a45]/30 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <b>{shift.branch_name}</b>
              <span className={shift.status === "open" ? "text-green-600" : "text-gray-500"}>
                {shift.status === "open" ? "مفتوحة" : "مغلقة"}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              المسؤول: {shift.opened_by_name || "غير محدد"}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Info label="المبيعات" value={money(shift.sales)} />
              <Info label="مبيعات الكاش" value={money(shift.cash_sales)} />
              <Info label="رصيد الفتح" value={money(shift.opening_balance)} />
              <Info label="رصيد الإغلاق المتوقع" value={money(shift.expected_balance || 0)} />
              <Info label="عدد الطلبات" value={num(shift.orders)} />
              {shift.variance !== null && (
                <Info label="فرق الخزنة" value={money(shift.variance)} />
              )}
            </div>
          </div>
        )) : <Empty />}
      </Panel>
    </div>
  );
}

function Products({
  data,
  money,
  num,
}: {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
}) {
  return (
    <div className="space-y-5">
      <Panel title="المنتجات الأكثر مبيعًا">
        {data.top_products.length ? data.top_products.map((item, index) => (
          <div key={item.name} className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#b99a45]/20 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c6a34a] font-bold text-black">
                {index + 1}
              </span>
              <div>
                <b>{item.name}</b>
                <p className="text-xs text-gray-500">
                  {num(item.quantity)} وحدة
                  {item.uncosted ? " · التكلفة غير مسجلة" : ""}
                </p>
              </div>
            </div>
            <div className="text-left">
              <b>{money(item.revenue)}</b>
              <p className="text-xs text-gray-500">الربح: {money(item.profit)}</p>
            </div>
          </div>
        )) : <Empty />}
      </Panel>
    </div>
  );
}

function Alerts({
  data,
  money,
  num,
}: {
  data: DashboardData;
  money: (v: number) => string;
  num: (v: number) => string;
}) {
  const openShifts = data.shifts.filter((s) => s.status === "open");
  const uncosted = data.top_products.filter((p) => p.uncosted);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric title="تنبيهات المخزون" value={num(data.stock.alerts.length)} />
        <Metric title="ورديات مفتوحة" value={num(openShifts.length)} />
        <Metric title="منتجات تكلفتها غير مسجلة" value={num(uncosted.length)} />
      </div>

      <Panel title="تنبيهات المخزون">
        {data.stock.alerts.length ? data.stock.alerts.map((item) => (
          <Info
            key={`${item.id}-${item.branch_name}`}
            label={`${item.name} — ${item.branch_name}`}
            value={`${num(item.quantity)} ${item.base_unit}`}
          />
        )) : <Empty />}
      </Panel>

      <Panel title="الورديات المفتوحة">
        {openShifts.length ? openShifts.map((shift) => (
          <Info
            key={shift.id}
            label={`${shift.branch_name} — ${shift.opened_by_name || "غير محدد"}`}
            value={`مبيعات ${money(shift.sales)}`}
          />
        )) : <Empty />}
      </Panel>

      <Panel title="تنبيهات تكلفة المنتجات">
        {uncosted.length ? uncosted.map((item) => (
          <Info key={item.name} label={item.name} value="التكلفة غير مسجلة" />
        )) : <Empty />}
      </Panel>

      <p className="text-xs text-gray-500">
        هذا القسم يعرض التنبيهات المتاحة حاليًا. سجل النشاط التفصيلي سيتم إضافته في مرحلة لاحقة.
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 py-3 text-sm last:border-0 dark:border-[#333]">
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
      <b className="text-left">{value}</b>
    </div>
  );
}

function MetricInline({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between rounded-lg bg-[#f5f3ed] p-3 text-sm dark:bg-[#222]">
      <span>{label}</span>
      <b className="text-[#9b7927] dark:text-[#dfc16a]">{value}</b>
    </div>
  );
}

function Empty() {
  return (
    <p className="py-8 text-center text-sm text-gray-500">
      لا توجد بيانات مسجلة في الفترة المحددة.
    </p>
  );
}
