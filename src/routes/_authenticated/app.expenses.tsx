
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({
    meta: [
      { title: "المصروفات — CAFE OS" },
      { name: "description", content: "إدارة ومتابعة مصروفات الكافيه." },
    ],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

const expenseCategories = [
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

function money(value: number) {
  return `${value.toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

function paymentMethodLabel(value: string | null) {
  const labels: Record<string, string> = {
    cash: "نقدي",
    card: "بطاقة",
    instapay: "إنستاباي",
    bank_transfer: "تحويل بنكي",
    other: "أخرى",
  };

  return labels[value ?? "other"] ?? "أخرى";
}

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) {
    return (
      <ModulePage module="expenses">
        لا يوجد كافيه مرتبط بحسابك حتى الآن.
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
        throw new Error("لا يوجد فرع متاح لتسجيل المصروف.");
      }

      if (!category.trim()) {
        throw new Error("اختار تصنيف المصروف.");
      }

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("اكتب مبلغًا صحيحًا أكبر من صفر.");
      }

      if (!spentAt) {
        throw new Error("حدد تاريخ المصروف.");
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
      setMessage("تم تسجيل المصروف بنجاح.");
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
      setMessage(error.message || "تعذر تسجيل المصروف.");
    },
  });

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">إدارة المصروفات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          سجل مصروفات الكافيه وتابع الإنفاق حسب الفرع والتاريخ.
        </p>
      </div>

      {!branchId ? (
        <div className="rounded-xl border bg-card p-5 text-sm">
          لا يوجد فرع مسجل لهذا الكافيه. أضف فرعًا أولًا.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                عدد المصروفات
              </p>
              <p className="mt-2 text-2xl font-bold">
                {expenses.length}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                إجمالي المصروفات
              </p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                {money(totalExpenses)}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                الفرع الحالي
              </p>
              <p className="mt-2 text-lg font-semibold">
                {branches.find((item) => item.id === branchId)?.name ?? "—"}
              </p>
            </div>
          </div>

          {!assignedBranch && branches.length > 1 && (
            <section className="rounded-xl border bg-card p-4">
              <label className="mb-2 block text-sm font-medium">
                اختيار الفرع
              </label>

              <select
                value={branchId}
                onChange={(event) => setBranchChoice(event.target.value)}
                className="w-full rounded-lg border bg-background p-3"
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
              تسجيل مصروف جديد
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  تصنيف المصروف
                </label>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-lg border bg-background p-3"
                >
                  <option value="">اختار التصنيف</option>
                  {expenseCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  المبلغ بالجنيه
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border bg-background p-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  طريقة الدفع
                </label>

                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="w-full rounded-lg border bg-background p-3"
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="instapay">إنستاباي</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="other">أخرى</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  تاريخ المصروف
                </label>

                <input
                  type="date"
                  value={spentAt}
                  onChange={(event) => setSpentAt(event.target.value)}
                  className="w-full rounded-lg border bg-background p-3"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">
                  تفاصيل المصروف
                </label>

                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="تفاصيل إضافية (اختياري)"
                  className="w-full rounded-lg border bg-background p-3"
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
              {addMutation.isPending ? "جارٍ الحفظ..." : "تسجيل المصروف"}
            </button>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="mb-4 font-bold">تصفية المصروفات</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm">
                  من تاريخ
                </label>

                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-lg border bg-background p-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  إلى تاريخ
                </label>

                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-lg border bg-background p-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  التصنيف
                </label>

                <select
                  value={filterCategory}
                  onChange={(event) => setFilterCategory(event.target.value)}
                  className="w-full rounded-lg border bg-background p-3"
                >
                  <option value="all">كل التصنيفات</option>
                  {expenseCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {fromDate > toDate && (
              <p className="mt-3 text-sm text-red-600">
                تاريخ البداية يجب أن يكون قبل تاريخ النهاية.
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b p-4">
              <h3 className="font-bold">سجل المصروفات</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                إجمالي النتائج: {expenses.length}
              </p>
            </div>

            {isLoading ? (
              <p className="p-8 text-center text-sm">
                جارٍ تحميل المصروفات...
              </p>
            ) : error ? (
              <p className="p-8 text-center text-sm text-red-600">
                تعذر تحميل المصروفات: {(error as Error).message}
              </p>
            ) : expenses.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                لا توجد مصروفات في الفترة المحددة.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-right text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">التصنيف</th>
                      <th className="p-3">التفاصيل</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">المبلغ</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenses.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="p-3">{item.spent_at}</td>

                        <td className="p-3 font-medium">
                          {item.category}
                        </td>

                        <td className="p-3">
                          {item.description || "—"}
                        </td>

                        <td className="p-3">
                          {paymentMethodLabel(item.payment_method)}
                        </td>

                        <td className="p-3 font-semibold text-red-600">
                          {money(Number(item.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expenses.length > 0 && (
              <div className="border-t bg-muted/30 p-4 text-left font-bold">
                إجمالي الفترة: {money(totalExpenses)}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
