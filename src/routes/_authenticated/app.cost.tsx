
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/app/cost")({
  head: () => ({
    meta: [
      { title: "التكلفة والأرباح — CAFE OS" },
      {
        name: "description",
        content: "تحليل تكلفة المنتجات وهوامش الربح والأسعار المقترحة.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
  },
  component: Page,
});

function money(value: number, currency = "ج.م") {
  return `${value.toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function percentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) {
    return (
      <ModulePage module="cost">
        لا يوجد كافيه مرتبط بحسابك حتى الآن.
      </ModulePage>
    );
  }

  return (
    <ModulePage module="cost" wide>
      <Costing tenantId={membership.tenant_id} />
    </ModulePage>
  );
}

function Costing({ tenantId }: { tenantId: string }) {
  const { data: rows } = useSuspenseQuery(q.costing(tenantId));
  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));

  const currency = tenant.currency || "ج.م";

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyMissingRecipe, setOnlyMissingRecipe] = useState(false);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.category_name)
            .filter((name): name is string => Boolean(name)),
        ),
      ),
    [rows],
  );

  const activeRows = rows.filter(
    (row) => row.product_active && row.is_active,
  );

  const missingRecipeCount = activeRows.filter(
    (row) => !row.recipe_id,
  ).length;

  const rowsWithRecipe = activeRows.filter(
    (row) => row.recipe_id && Number(row.net_price ?? 0) > 0,
  );

  const averageFoodCost =
    rowsWithRecipe.length > 0
      ? rowsWithRecipe.reduce((sum, row) => {
          const net = Number(row.net_price ?? 0);
          const cost = Number(row.total_cost ?? 0);
          return sum + (cost / net) * 100;
        }, 0) / rowsWithRecipe.length
      : null;

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !term ||
        `${row.product_name} ${row.variant_name} ${row.recipe_name ?? ""}`
          .toLowerCase()
          .includes(term);

      const matchesCategory =
        category === "all" || row.category_name === category;

      const matchesRecipe =
        !onlyMissingRecipe || !row.recipe_id;

      return matchesSearch && matchesCategory && matchesRecipe;
    });
  }, [rows, search, category, onlyMissingRecipe]);

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">تحليل تكلفة المنتجات</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          تحليل تكلفة وربحية الوحدة الواحدة بناءً على الوصفات وتكلفة الخامات المسجلة.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            المنتجات والأحجام النشطة
          </p>
          <p className="mt-2 text-2xl font-bold">
            {activeRows.length}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            متوسط نسبة تكلفة الوحدة
          </p>
          <p className="mt-2 text-2xl font-bold">
            {percentage(averageFoodCost)}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            وحدات بدون وصفة
          </p>
          <p className="mt-2 text-2xl font-bold">
            {missingRecipeCount}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            وحدات مرتبطة بوصفة
          </p>
          <p className="mt-2 text-2xl font-bold">
            {activeRows.length - missingRecipeCount}
          </p>
        </div>
      </div>

      {missingRecipeCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>تنبيه:</strong> يوجد {missingRecipeCount} منتج أو حجم نشط
          بدون وصفة مرتبطة. لا يمكن حساب تكلفة خاماته الفعلية قبل ربط الوصفة.
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 font-bold">البحث والتصفية</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث عن منتج أو حجم أو وصفة..."
            className="w-full rounded-lg border bg-background p-3"
          />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border bg-background p-3"
          >
            <option value="all">كل الأقسام</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              checked={onlyMissingRecipe}
              onChange={(event) =>
                setOnlyMissingRecipe(event.target.checked)
              }
            />
            عرض المنتجات بدون وصفة فقط
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <h3 className="font-bold">تفاصيل تكلفة وربحية كل منتج</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            عدد النتائج: {filteredRows.length}
          </p>
        </div>

        {filteredRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            لا توجد بيانات مطابقة. أضف منتجات واربطها بوصفات وخامات لعرض التكلفة.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-right text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3">المنتج</th>
                  <th className="p-3">الحجم</th>
                  <th className="p-3">الوصفة</th>
                  <th className="p-3">سعر البيع</th>
                  <th className="p-3">صافي السعر</th>
                  <th className="p-3">تكلفة الخامات</th>
                  <th className="p-3">التغليف</th>
                  <th className="p-3">الهالك</th>
                  <th className="p-3">إجمالي التكلفة</th>
                  <th className="p-3">ربح الوحدة</th>
                  <th className="p-3">نسبة التكلفة</th>
                  <th className="p-3">السعر المقترح</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const hasRecipe = Boolean(row.recipe_id);

                  const selling = Number(row.selling_price ?? 0);
                  const net = Number(row.net_price ?? 0);

                  const ingredientCost = Number(
                    row.ingredient_cost ?? 0,
                  );

                  const packagingCost = Number(
                    row.packaging_cost ?? 0,
                  );

                  const wasteCost = Number(
                    row.waste_cost ?? 0,
                  );

                  const cost = Number(row.total_cost ?? 0);

                  const profit = net - cost;

                  const foodCost =
                    hasRecipe && net > 0
                      ? (cost / net) * 100
                      : null;

                  const target = Number(
                    row.target_food_cost_percent ?? 0,
                  );

                  const suggestedPrice =
                    hasRecipe && target > 0
                      ? cost / (target / 100)
                      : null;

                  return (
                    <tr key={row.variant_id} className="border-t">
                      <td className="p-3 font-semibold">
                        {row.product_name}
                        {!row.product_active && (
                          <span className="mr-2 text-xs text-muted-foreground">
                            (متوقف)
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {row.variant_name || "—"}
                        {row.temperature === "hot"
                          ? " · ساخن"
                          : row.temperature === "cold"
                            ? " · بارد"
                            : ""}
                      </td>

                      <td className="p-3">
                        {row.recipe_name || (
                          <span className="text-amber-700">
                            بدون وصفة
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {money(selling, currency)}
                      </td>

                      <td className="p-3">
                        {money(net, currency)}
                      </td>

                      <td className="p-3">
                        {hasRecipe
                          ? money(ingredientCost, currency)
                          : "—"}
                      </td>

                      <td className="p-3">
                        {hasRecipe
                          ? money(packagingCost, currency)
                          : "—"}
                      </td>

                      <td className="p-3">
                        {hasRecipe
                          ? money(wasteCost, currency)
                          : "—"}
                      </td>

                      <td className="p-3 font-semibold">
                        {hasRecipe
                          ? money(cost, currency)
                          : "—"}
                      </td>

                      <td
                        className={`p-3 font-semibold ${
                          !hasRecipe
                            ? ""
                            : profit >= 0
                              ? "text-green-700"
                              : "text-red-700"
                        }`}
                      >
                        {hasRecipe
                          ? money(profit, currency)
                          : "—"}
                      </td>

                      <td className="p-3">
                        {percentage(foodCost)}
                      </td>

                      <td className="p-3">
                        {suggestedPrice === null
                          ? "غير محدد"
                          : money(suggestedPrice, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">
          توضيح طريقة الحساب
        </p>

        <ul className="mt-2 list-disc space-y-1 pr-5">
          <li>
            تكلفة الوحدة = تكلفة الخامات + التغليف + الهالك حسب الوصفة.
          </li>
          <li>
            ربح الوحدة = صافي سعر البيع − إجمالي تكلفة الوحدة.
          </li>
          <li>
            نسبة التكلفة = إجمالي تكلفة الوحدة ÷ صافي سعر البيع × 100.
          </li>
          <li>
            السعر المقترح يعتمد على نسبة التكلفة المستهدفة المسجلة في إعدادات الكافيه.
          </li>
          <li>
            متوسط نسبة التكلفة في الملخص هو متوسط حسابي للوحدات المرتبطة بوصفة ولها سعر صافٍ أكبر من صفر.
          </li>
          <li>
            ربح الوحدة ليس صافي ربح الكافيه؛ لا يشمل المصروفات التشغيلية العامة أو الرواتب أو الإيجار.
          </li>
        </ul>
      </div>
    </div>
  );
}
