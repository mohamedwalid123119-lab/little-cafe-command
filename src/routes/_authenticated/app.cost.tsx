
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/app/cost")({
  head: () => ({
    meta: [
      { title: "Cost & Profit — CAFE OS" },
      {
        name: "description",
        content: "Product cost analysis, profit margins and suggested prices.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
  },
  component: Page,
});

function money(value: number, currency = "EGP", language: "ar" | "en" = "ar") {
  return `${value.toLocaleString(language === "ar" ? "ar-EG" : "en-US", {
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
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  if (!membership) {
    return (
      <ModulePage module="cost">
        {isArabic
          ? "لا يوجد كافيه مرتبط بحسابك حتى الآن."
          : "No cafe is linked to your account yet."}
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
  const { language } = useAppPreferences();

  const isArabic = language === "ar";
  const currency = tenant.currency || (isArabic ? "ج.م" : "EGP");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyMissingRecipe, setOnlyMissingRecipe] = useState(false);

  const t = {
    title: isArabic ? "تحليل تكلفة المنتجات" : "Product Cost Analysis",
    description: isArabic
      ? "تحليل تكلفة وربحية الوحدة الواحدة بناءً على الوصفات وتكلفة الخامات المسجلة."
      : "Analyze unit cost and profitability based on recipes and recorded ingredient costs.",
    active: isArabic ? "المنتجات والأحجام النشطة" : "Active Products & Variants",
    average: isArabic ? "متوسط نسبة تكلفة الوحدة" : "Average Unit Cost %",
    missing: isArabic ? "وحدات بدون وصفة" : "Variants Without Recipes",
    linked: isArabic ? "وحدات مرتبطة بوصفة" : "Variants With Recipes",
    warning: isArabic ? "تنبيه:" : "Warning:",
    warningText: isArabic
      ? "منتج أو حجم نشط بدون وصفة مرتبطة. لا يمكن حساب تكلفة خاماته الفعلية قبل ربط الوصفة."
      : "active product(s) or variant(s) have no linked recipe. Actual ingredient cost cannot be calculated until a recipe is linked.",
    filters: isArabic ? "البحث والتصفية" : "Search & Filters",
    search: isArabic ? "ابحث عن منتج أو حجم أو وصفة..." : "Search product, variant or recipe...",
    all: isArabic ? "كل الأقسام" : "All Categories",
    missingOnly: isArabic ? "عرض المنتجات بدون وصفة فقط" : "Show items without recipes only",
    details: isArabic ? "تفاصيل تكلفة وربحية كل منتج" : "Product Cost & Profit Details",
    results: isArabic ? "عدد النتائج:" : "Results:",
    empty: isArabic
      ? "لا توجد بيانات مطابقة. أضف منتجات واربطها بوصفات وخامات لعرض التكلفة."
      : "No matching data. Add products and link them to recipes and ingredients to view costs.",
    product: isArabic ? "المنتج" : "Product",
    variant: isArabic ? "الحجم" : "Variant",
    recipe: isArabic ? "الوصفة" : "Recipe",
    selling: isArabic ? "سعر البيع" : "Selling Price",
    net: isArabic ? "صافي السعر" : "Net Price",
    ingredients: isArabic ? "تكلفة الخامات" : "Ingredient Cost",
    packaging: isArabic ? "التغليف" : "Packaging",
    waste: isArabic ? "الهالك" : "Waste",
    total: isArabic ? "إجمالي التكلفة" : "Total Cost",
    profit: isArabic ? "ربح الوحدة" : "Unit Profit",
    costPercent: isArabic ? "نسبة التكلفة" : "Cost %",
    suggested: isArabic ? "السعر المقترح" : "Suggested Price",
    stopped: isArabic ? "(متوقف)" : "(Inactive)",
    hot: isArabic ? "ساخن" : "Hot",
    cold: isArabic ? "بارد" : "Cold",
    noRecipe: isArabic ? "بدون وصفة" : "No Recipe",
    undefined: isArabic ? "غير محدد" : "Not Set",
    explanation: isArabic ? "توضيح طريقة الحساب" : "Calculation Method",
    formula1: isArabic
      ? "تكلفة الوحدة = تكلفة الخامات + التغليف + الهالك حسب الوصفة."
      : "Unit cost = ingredients + packaging + waste according to the recipe.",
    formula2: isArabic
      ? "ربح الوحدة = صافي سعر البيع − إجمالي تكلفة الوحدة."
      : "Unit profit = net selling price − total unit cost.",
    formula3: isArabic
      ? "نسبة التكلفة = إجمالي تكلفة الوحدة ÷ صافي سعر البيع × 100."
      : "Cost percentage = total unit cost ÷ net selling price × 100.",
    formula4: isArabic
      ? "السعر المقترح يعتمد على نسبة التكلفة المستهدفة المسجلة في إعدادات الكافيه."
      : "Suggested price is based on the target cost percentage configured in cafe settings.",
    formula5: isArabic
      ? "متوسط نسبة التكلفة في الملخص هو متوسط حسابي للوحدات المرتبطة بوصفة ولها سعر صافٍ أكبر من صفر."
      : "The average cost percentage is the arithmetic mean for variants linked to a recipe with a net price greater than zero.",
    formula6: isArabic
      ? "ربح الوحدة ليس صافي ربح الكافيه؛ لا يشمل المصروفات التشغيلية العامة أو الرواتب أو الإيجار."
      : "Unit profit is not the cafe's net profit; it excludes general operating expenses, salaries and rent.",
  };

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

  const formatMoney = (value: number) => money(value, currency, language);

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.active}</p>
          <p className="mt-2 text-2xl font-bold">{activeRows.length}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.average}</p>
          <p className="mt-2 text-2xl font-bold">{percentage(averageFoodCost)}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.missing}</p>
          <p className="mt-2 text-2xl font-bold">{missingRecipeCount}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.linked}</p>
          <p className="mt-2 text-2xl font-bold">
            {activeRows.length - missingRecipeCount}
          </p>
        </div>
      </div>

      {missingRecipeCount > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>{t.warning}</strong> {missingRecipeCount} {t.warningText}
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 font-bold">{t.filters}</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.search}
            className="w-full rounded-lg border bg-background p-3"
          />

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border bg-background p-3"
          >
            <option value="all">{t.all}</option>
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
              onChange={(event) => setOnlyMissingRecipe(event.target.checked)}
            />
            {t.missingOnly}
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <h3 className="font-bold">{t.details}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.results} {filteredRows.length}
          </p>
        </div>

        {filteredRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[1250px] text-sm ${isArabic ? "text-right" : "text-left"}`}>
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3">{t.product}</th>
                  <th className="p-3">{t.variant}</th>
                  <th className="p-3">{t.recipe}</th>
                  <th className="p-3">{t.selling}</th>
                  <th className="p-3">{t.net}</th>
                  <th className="p-3">{t.ingredients}</th>
                  <th className="p-3">{t.packaging}</th>
                  <th className="p-3">{t.waste}</th>
                  <th className="p-3">{t.total}</th>
                  <th className="p-3">{t.profit}</th>
                  <th className="p-3">{t.costPercent}</th>
                  <th className="p-3">{t.suggested}</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const hasRecipe = Boolean(row.recipe_id);
                  const selling = Number(row.selling_price ?? 0);
                  const net = Number(row.net_price ?? 0);
                  const ingredientCost = Number(row.ingredient_cost ?? 0);
                  const packagingCost = Number(row.packaging_cost ?? 0);
                  const wasteCost = Number(row.waste_cost ?? 0);
                  const cost = Number(row.total_cost ?? 0);
                  const profit = net - cost;

                  const foodCost =
                    hasRecipe && net > 0
                      ? (cost / net) * 100
                      : null;

                  const target = Number(row.target_food_cost_percent ?? 0);

                  const suggestedPrice =
                    hasRecipe && target > 0
                      ? cost / (target / 100)
                      : null;

                  return (
                    <tr key={row.variant_id} className="border-t">
                      <td className="p-3 font-semibold">
                        {row.product_name}
                        {!row.product_active && (
                          <span className="mx-2 text-xs text-muted-foreground">
                            {t.stopped}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {row.variant_name || "—"}
                        {row.temperature === "hot"
                          ? ` · ${t.hot}`
                          : row.temperature === "cold"
                            ? ` · ${t.cold}`
                            : ""}
                      </td>

                      <td className="p-3">
                        {row.recipe_name || (
                          <span className="text-amber-700">{t.noRecipe}</span>
                        )}
                      </td>

                      <td className="p-3">{formatMoney(selling)}</td>
                      <td className="p-3">{formatMoney(net)}</td>
                      <td className="p-3">{hasRecipe ? formatMoney(ingredientCost) : "—"}</td>
                      <td className="p-3">{hasRecipe ? formatMoney(packagingCost) : "—"}</td>
                      <td className="p-3">{hasRecipe ? formatMoney(wasteCost) : "—"}</td>
                      <td className="p-3 font-semibold">{hasRecipe ? formatMoney(cost) : "—"}</td>

                      <td
                        className={`p-3 font-semibold ${
                          !hasRecipe ? "" : profit >= 0 ? "text-green-700" : "text-red-700"
                        }`}
                      >
                        {hasRecipe ? formatMoney(profit) : "—"}
                      </td>

                      <td className="p-3">{percentage(foodCost)}</td>

                      <td className="p-3">
                        {suggestedPrice === null
                          ? t.undefined
                          : formatMoney(suggestedPrice)}
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
        <p className="font-semibold text-foreground">{t.explanation}</p>

        <ul className={`mt-2 list-disc space-y-1 ${isArabic ? "pr-5" : "pl-5"}`}>
          <li>{t.formula1}</li>
          <li>{t.formula2}</li>
          <li>{t.formula3}</li>
          <li>{t.formula4}</li>
          <li>{t.formula5}</li>
          <li>{t.formula6}</li>
        </ul>
      </div>
    </div>
  );
}
