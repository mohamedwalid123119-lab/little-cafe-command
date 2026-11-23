import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — CAFE OS" },
      { name: "description", content: "Manage and track cafe expenses." },
    ],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

const translations = {
  ar: {
    noCafe: "لا يوجد كافيه مرتبط بحسابك حتى الآن.",
    title: "إدارة المصروفات",
    subtitle: "سجل مصروفات الكافيه وتابع الإنفاق حسب الفرع والتاريخ.",
    count: "عدد المصروفات",
    total: "إجمالي المصروفات",
    currentBranch: "الفرع الحالي",
    chooseBranch: "اختيار الفرع",
    noBranch: "لا يوجد فرع مسجل لهذا الكافيه. أضف فرعًا أولًا.",
    addTitle: "تسجيل مصروف جديد",
    category: "تصنيف المصروف",
    chooseCategory: "اختار التصنيف",
    amount: "المبلغ بالجنيه",
    payment: "طريقة الدفع",
    date: "تاريخ المصروف",
    details: "تفاصيل المصروف",
    detailsPlaceholder: "تفاصيل إضافية (اختياري)",
    save: "تسجيل المصروف",
    saving: "جارٍ الحفظ...",
    filters: "تصفية المصروفات",
    from: "من تاريخ",
    to: "إلى تاريخ",
    allCategories: "كل التصنيفات",
    invalidDates: "تاريخ البداية يجب أن يكون قبل تاريخ النهاية.",
    history: "سجل المصروفات",
    results: "إجمالي النتائج",
    loading: "جارٍ تحميل المصروفات...",
    loadError: "تعذر تحميل المصروفات:",
    empty: "لا توجد مصروفات في الفترة المحددة.",
    paymentMethod: "طريقة الدفع",
    periodTotal: "إجمالي الفترة:",
    cash: "نقدي",
    card: "بطاقة",
    instapay: "إنستاباي",
    bankTransfer: "تحويل بنكي",
    other: "أخرى",
    rent: "إيجار",
    utilities: "كهرباء ومياه",
    salaries: "رواتب وأجور",
    supplies: "مشتريات خامات",
    maintenance: "صيانة",
    cleaning: "نظافة",
    transport: "نقل ومواصلات",
    marketing: "تسويق وإعلانات",
    tools: "أدوات ومستلزمات",
    misc: "أخرى",
    categoryRequired: "اختار تصنيف المصروف.",
    amountRequired: "اكتب مبلغًا صحيحًا أكبر من صفر.",
    dateRequired: "حدد تاريخ المصروف.",
    branchRequired: "لا يوجد فرع متاح لتسجيل المصروف.",
    saved: "تم تسجيل المصروف بنجاح.",
    saveError: "تعذر تسجيل المصروف.",
    noDetails: "—",
  },
  en: {
    noCafe: "No cafe is linked to your account yet.",
    title: "Expense Management",
    subtitle: "Record cafe expenses and track spending by branch and date.",
    count: "Expense Count",
    total: "Total Expenses",
    currentBranch: "Current Branch",
    chooseBranch: "Select Branch",
    noBranch: "No branch is registered for this cafe. Add a branch first.",
    addTitle: "Record New Expense",
    category: "Expense Category",
    chooseCategory: "Select a category",
    amount: "Amount (EGP)",
    payment: "Payment Method",
    date: "Expense Date",
    details: "Expense Details",
    detailsPlaceholder: "Additional details (optional)",
    save: "Record Expense",
    saving: "Saving...",
    filters: "Filter Expenses",
    from: "From Date",
    to: "To Date",
    allCategories: "All Categories",
    invalidDates: "The start date must be before the end date.",
    history: "Expense History",
    results: "Total Results",
    loading: "Loading expenses...",
    loadError: "Could not load expenses:",
    empty: "No expenses found for the selected period.",
    paymentMethod: "Payment Method",
    periodTotal: "Period Total:",
    cash: "Cash",
    card: "Card",
    instapay: "InstaPay",
    bankTransfer: "Bank Transfer",
    other: "Other",
    rent: "Rent",
    utilities: "Utilities",
    salaries: "Salaries & Wages",
    supplies: "Raw Materials",
    maintenance: "Maintenance",
    cleaning: "Cleaning",
    transport: "Transport",
    marketing: "Marketing & Advertising",
    tools: "Tools & Supplies",
    misc: "Other",
    categoryRequired: "Select an expense category.",
    amountRequired: "Enter a valid amount greater than zero.",
    dateRequired: "Select the expense date.",
    branchRequired: "No branch is available for recording this expense.",
    saved: "Expense recorded successfully.",
    saveError: "Could not record the expense.",
    noDetails: "—",
  },
};

const categoryKeys = [
  "rent",
  "utilities",
  "salaries",
  "supplies",
  "maintenance",
  "cleaning",
  "transport",
  "marketing",
  "tools",
  "misc",
] as const;

const categoryValues = [
  "إيجار",
  "كهرباء ومياه",
  "رواتب وأجور",
  "مشتريات خامات",
  "صيانة",
  "نظافة",
  "نقل ومواصلات",
  "تسويق وإعلانات",
  "أدوات ومستلزمات",
  "أخرى",
];

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset();

  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10);
}

function money(value: number, isArabic: boolean) {
  return `${value.toLocaleString(isArabic ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${isArabic ? "ج.م" : "EGP"}`;
}

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  if (!membership) {
    return (
      <ModulePage module="expenses">
        {isArabic ? translations.ar.noCafe : translations.en.noCafe}
      </ModulePage>
    );
  }

  return (
    <ModulePage module="expenses" wide>
      <Expenses
        tenantId={membership.tenant_id}
        userId={user.id}
        assignedBranch={membership.branch_id ?? ""}
      />
    </ModulePage>
  );
}

function Expenses({
  tenantId,
  userId,
  assignedBranch,
}: {
  tenantId: string;
  userId: string;
  assignedBranch: string;
}) {
  const queryClient = useQueryClient();
  const { language } = useAppPreferences();
  const isArabic = language === "ar";
  const t = isArabic ? translations.ar : translations.en;
  const locale = isArabic ? "ar-EG" : "en-US";

  const { data: branches = [] } = useQuery({
    ...q.branches(tenantId),
    enabled: Boolean(tenantId),
  });

  const [branchChoice, setBranchChoice] = useState("");

  const branchId =
    assignedBranch ||
    branchChoice ||
    branches.find((branch) => branch.is_main)?.id ||
    branches[0]?.id ||
    "";

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [spentAt, setSpentAt] = useState(today());

  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [filterCategory, setFilterCategory] = useState("all");
  const [message, setMessage] = useState("");

  const {
    data: expenses = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "expenses",
      tenantId,
      branchId,
      fromDate,
      toDate,
      filterCategory,
    ],
    enabled: Boolean(
      tenantId &&
      branchId &&
      fromDate &&
      toDate &&
      fromDate <= toDate
    ),
    queryFn: async () => {
      let request = supabase
        .from("expenses")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId)
        .gte("spent_at", fromDate)
        .lte("spent_at", toDate)
        .order("spent_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (filterCategory !== "all") {
        request = request.eq("category", filterCategory);
      }

      const { data, error } = await request;

      if (error) throw error;

      return data ?? [];
    },
  });

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount);

      if (!branchId) {
        throw new Error(t.branchRequired);
      }

      if (!category.trim()) {
        throw new Error(t.categoryRequired);
      }

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(t.amountRequired);
      }

      if (!spentAt) {
        throw new Error(t.dateRequired);
      }

      const { error } = await supabase.from("expenses").insert({
        tenant_id: tenantId,
        branch_id: branchId,
        category: category.trim(),
        description: description.trim() || null,
        amount: value,
        payment_method: paymentMethod,
        spent_at: spentAt,
        created_by: userId,
      });

      if (error) throw error;
    },

    onSuccess: async () => {
      setMessage(t.saved);
      setCategory("");
      setDescription("");
      setAmount("");
      setPaymentMethod("cash");
      setSpentAt(today());

      await queryClient.invalidateQueries({
        queryKey: ["expenses", tenantId],
      });
    },

    onError: (error: Error) => {
      setMessage(error.message || t.saveError);
    },
  });

  const categoryLabel = (value: string) => {
    const index = categoryValues.indexOf(value);
    if (index === -1) return value;

    return isArabic
      ? categoryValues[index]
      : t[categoryKeys[index]];
  };

  const paymentLabel = (value: string | null) => {
    const labels: Record<string, string> = {
      cash: t.cash,
      card: t.card,
      instapay: t.instapay,
      bank_transfer: t.bankTransfer,
      other: t.other,
    };

    return labels[value ?? "other"] ?? t.other;
  };

  const inputClass =
    "w-full rounded-lg border bg-background p-3";
  const labelClass =
    "mb-2 block text-sm font-medium";

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      {!branchId ? (
        <div className="rounded-xl border bg-card p-5 text-sm">
          {t.noBranch}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {t.count}
              </p>
              <p className="mt-2 text-2xl font-bold">
                {expenses.length}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {t.total}
              </p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {money(totalExpenses, isArabic)}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {t.currentBranch}
              </p>
              <p className="mt-2 text-lg font-semibold">
                {branches.find((item) => item.id === branchId)?.name ?? "—"}
              </p>
            </div>
          </div>

          {!assignedBranch && branches.length > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <label className={labelClass}>
                {t.chooseBranch}
              </label>

              <select
                value={branchId}
                onChange={(event) => setBranchChoice(event.target.value)}
                className={inputClass}
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </section>
          )}

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 text-lg font-bold">
              {t.addTitle}
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className={labelClass}>
                  {t.category}
                </label>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className={inputClass}
                >
                  <option value="">{t.chooseCategory}</option>
                  {categoryValues.map((item, index) => (
                    <option key={item} value={item}>
                      {isArabic ? item : t[categoryKeys[index]]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  {t.amount}
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t.payment}
                </label>

                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className={inputClass}
                >
                  <option value="cash">{t.cash}</option>
                  <option value="card">{t.card}</option>
                  <option value="instapay">{t.instapay}</option>
                  <option value="bank_transfer">{t.bankTransfer}</option>
                  <option value="other">{t.other}</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  {t.date}
                </label>

                <input
                  type="date"
                  value={spentAt}
                  onChange={(event) => setSpentAt(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelClass}>
                  {t.details}
                </label>

                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t.detailsPlaceholder}
                  className={inputClass}
                />
              </div>
            </div>

            {message && (
              <p
                role="status"
                className="mt-3 rounded-lg bg-muted p-3 text-sm"
              >
                {message}
              </p>
            )}

            <button
              type="button"
              disabled={addMutation.isPending}
              onClick={() => {
                setMessage("");
                addMutation.mutate();
              }}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {addMutation.isPending ? t.saving : t.save}
            </button>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 font-bold">{t.filters}</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className={labelClass}>
                  {t.from}
                </label>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t.to}
                </label>

                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t.category}
                </label>

                <select
                  value={filterCategory}
                  onChange={(event) => setFilterCategory(event.target.value)}
                  className={inputClass}
                >
                  <option value="all">{t.allCategories}</option>
                  {categoryValues.map((item, index) => (
                    <option key={item} value={item}>
                      {isArabic ? item : t[categoryKeys[index]]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {fromDate > toDate && (
              <p className="mt-3 text-sm text-red-600">
                {t.invalidDates}
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b p-4">
              <h3 className="font-bold">{t.history}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.results}: {expenses.length}
              </p>
            </div>

            {isLoading ? (
              <p className="p-8 text-center text-sm">
                {t.loading}
              </p>
            ) : error ? (
              <p className="p-8 text-center text-sm text-red-600">
                {t.loadError} {(error as Error).message}
              </p>
            ) : expenses.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {t.empty}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className={`w-full min-w-[700px] text-sm ${isArabic ? "text-right" : "text-left"}`}>
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3">{t.date}</th>
                      <th className="p-3">{t.category}</th>
                      <th className="p-3">{t.details}</th>
                      <th className="p-3">{t.paymentMethod}</th>
                      <th className="p-3">{t.amount}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenses.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">{item.spent_at}</td>

                        <td className="p-3 font-medium">
                          {categoryLabel(item.category)}
                        </td>

                        <td className="p-3">
                          {item.description || t.noDetails}
                        </td>

                        <td className="p-3">
                          {paymentLabel(item.payment_method)}
                        </td>

                        <td className="p-3 font-semibold text-red-600">
                          {money(Number(item.amount), isArabic)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expenses.length > 0 && (
              <div className={`border-t bg-muted/30 p-4 font-bold ${isArabic ? "text-left" : "text-right"}`}>
                {t.periodTotal} {money(totalExpenses, isArabic)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}