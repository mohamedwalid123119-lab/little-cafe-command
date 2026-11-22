
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/inventory")({
  head: () => ({
    meta: [
      { title: "المخزون — CAFE OS" },
      { name: "description", content: "إدارة الخامات والأرصدة وحركات المخزون." },
    ],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

type IngredientForm = {
  name: string;
  kind: "raw" | "packaging";
  group_name: string;
  purchase_unit: string;
  purchase_quantity: string;
  purchase_price: string;
  reorder_level: string;
  sku: string;
  notes: string;
};

const emptyForm: IngredientForm = {
  name: "",
  kind: "raw",
  group_name: "",
  purchase_unit: "g",
  purchase_quantity: "1",
  purchase_price: "0",
  reorder_level: "",
  sku: "",
  notes: "",
};

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  const tenantId = membership?.tenant_id ?? "";
  const queryClient = useQueryClient();

  const { data: ingredients = [], isLoading: ingredientsLoading } = useQuery({
    ...q.ingredients(tenantId),
    enabled: Boolean(tenantId),
  });

  const { data: branches = [] } = useQuery({
    ...q.branches(tenantId),
    enabled: Boolean(tenantId),
  });

  const { data: units = [] } = useQuery(q.units());

  const assignedBranch = membership?.branch_id ?? "";
  const [branchChoice, setBranchChoice] = useState("");
  const branchId =
    assignedBranch ||
    branchChoice ||
    branches.find((branch) => branch.is_main)?.id ||
    branches[0]?.id ||
    "";

  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["inventory-stock", tenantId, branchId],
    enabled: Boolean(tenantId && branchId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_ingredient_stock")
        .select("ingredient_id, quantity")
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId);

      if (error) throw error;
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const [showIngredientForm, setShowIngredientForm] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientForm>(emptyForm);
  const [formMessage, setFormMessage] = useState("");

  const stockMap = useMemo(
    () => new Map(stock.map((item) => [item.ingredient_id, Number(item.quantity)])),
    [stock],
  );

  const activeIngredients = ingredients.filter((item) => item.is_active);

  const filteredIngredients = ingredients.filter((ingredient) =>
    `${ingredient.name} ${ingredient.group_name ?? ""} ${ingredient.sku ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );

  const selected = ingredients.find((item) => item.id === selectedIngredient);
  const selectedBalance = selected ? stockMap.get(selected.id) ?? 0 : 0;

  const unitName = (code: string) =>
    units.find((unit) => unit.code === code)?.name_ar ?? code;

  const invalidateInventory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ingredients", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-stock", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["costing", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["recent-price-changes", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
    ]);
  };

  const ingredientMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const quantity = Number(form.purchase_quantity);
      const price = Number(form.purchase_price);
      const reorder =
        form.reorder_level.trim() === "" ? null : Number(form.reorder_level);

      if (!name) throw new Error("اكتب اسم الخامة.");
      if (!form.purchase_unit) throw new Error("اختر وحدة الشراء.");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("كمية الشراء يجب أن تكون أكبر من صفر.");
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("سعر الشراء غير صحيح.");
      }
      if (reorder !== null && (!Number.isFinite(reorder) || reorder < 0)) {
        throw new Error("حد التنبيه يجب أن يكون صفرًا أو أكبر.");
      }

      const payload = {
        name,
        kind: form.kind,
        group_name: form.group_name.trim() || null,
        purchase_unit: form.purchase_unit,
        purchase_quantity: quantity,
        purchase_price: price,
        reorder_level: reorder,
        sku: form.sku.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingIngredient) {
        const { data, error } = await supabase
          .from("ingredients")
          .update(payload)
          .eq("id", editingIngredient)
          .eq("tenant_id", tenantId)
          .select("id")
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error("لم يتم تعديل الخامة. تحقق من الصلاحيات.");
        }
      } else {
        const { data, error } = await supabase
          .from("ingredients")
          .insert({
            ...payload,
            tenant_id: tenantId,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (!data) {
          throw new Error("لم يتم تأكيد إضافة الخامة.");
        }
      }
    },
    onSuccess: async () => {
      setFormMessage("تم حفظ بيانات الخامة بنجاح.");
      setForm(emptyForm);
      setEditingIngredient(null);
      setShowIngredientForm(false);
      await invalidateInventory();
    },
    onError: (error: Error) => {
      setFormMessage(error.message || "تعذر حفظ بيانات الخامة.");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (ingredient: (typeof ingredients)[number]) => {
      const { data, error } = await supabase
        .from("ingredients")
        .update({ is_active: !ingredient.is_active })
        .eq("id", ingredient.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("لم يتم تغيير حالة الخامة.");
      }
    },
    onSuccess: invalidateInventory,
    onError: (error: Error) => {
      setFormMessage(error.message || "تعذر تغيير حالة الخامة.");
    },
  });

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !branchId) {
        throw new Error("اختار الفرع والخامة أولاً.");
      }

      if (!selected.is_active) {
        throw new Error("لا يمكن تسجيل حركة لخامة موقوفة.");
      }

      const value = Number(amount);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("اكتب كمية صحيحة أكبر من صفر.");
      }

      if (direction === "remove" && value > selectedBalance) {
        throw new Error("الكمية المطلوبة أكبر من الرصيد المتاح.");
      }

      const { data, error } = await supabase
        .from("inventory_movements")
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          ingredient_id: selected.id,
          movement_type: "adjustment",
          quantity: direction === "add" ? value : -value,
          unit_cost: Number(selected.cost_per_base_unit ?? 0),
          notes: note.trim() || "تسوية مخزون يدوية",
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("لم يتم تأكيد تسجيل حركة المخزون.");
      }
    },
    onSuccess: async () => {
      setMessage("تم تسجيل حركة المخزون بنجاح.");
      setAmount("");
      setNote("");
      await invalidateInventory();
    },
    onError: (error: Error) => {
      setMessage(error.message || "تعذر تسجيل الحركة.");
    },
  });

  function openNewIngredient() {
    setEditingIngredient(null);
    setForm(emptyForm);
    setFormMessage("");
    setShowIngredientForm(true);
  }

  function openEditIngredient(ingredient: (typeof ingredients)[number]) {
    setEditingIngredient(ingredient.id);
    setForm({
      name: ingredient.name,
      kind: ingredient.kind,
      group_name: ingredient.group_name ?? "",
      purchase_unit: ingredient.purchase_unit,
      purchase_quantity: String(ingredient.purchase_quantity),
      purchase_price: String(ingredient.purchase_price),
      reorder_level:
        ingredient.reorder_level === null
          ? ""
          : String(ingredient.reorder_level),
      sku: ingredient.sku ?? "",
      notes: ingredient.notes ?? "",
    });
    setFormMessage("");
    setShowIngredientForm(true);
  }

  const lowStockCount = activeIngredients.filter((item) => {
    const balance = stockMap.get(item.id) ?? 0;
    return (
      item.reorder_level !== null &&
      item.reorder_level !== undefined &&
      balance <= Number(item.reorder_level)
    );
  }).length;

  const totalIngredients = activeIngredients.length;

  return (
    <ModulePage module="inventory" wide>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">إدارة المخزون</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              الخامات والأرصدة وتكلفة الشراء وحركات المخزون.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewIngredient}
            className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            + إضافة خامة جديدة
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">الخامات النشطة</p>
            <p className="mt-2 text-2xl font-bold">{totalIngredients}</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">خامات وصلت لحد التنبيه</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {lowStockCount}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">الفرع الحالي</p>
            <p className="mt-2 text-lg font-semibold">
              {branches.find((branch) => branch.id === branchId)?.name ?? "لا يوجد فرع"}
            </p>
          </div>
        </div>

        {!assignedBranch && branches.length > 1 && (
          <div className="rounded-xl border bg-card p-4">
            <label className="mb-2 block text-sm font-medium">اختيار الفرع</label>
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
          </div>
        )}

        {showIngredientForm && (
          <section className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                {editingIngredient ? "تعديل بيانات الخامة" : "إضافة خامة جديدة"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowIngredientForm(false);
                  setEditingIngredient(null);
                  setFormMessage("");
                }}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                إغلاق
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFormMessage("");
                ingredientMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">اسم الخامة *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="مثال: بن اسبريسو"
                    className="w-full rounded-lg border bg-background p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">نوع الصنف *</label>
                  <select
                    value={form.kind}
                    onChange={(event) =>
                      setForm({ ...form, kind: event.target.value as "raw" | "packaging" })
                    }
                    className="w-full rounded-lg border bg-background p-3"
                  >
                    <option value="raw">خامة / مكون وصفة</option>
                    <option value="packaging">مواد تعبئة وتغليف</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">المجموعة</label>
                  <input
                    value={form.group_name}
                    onChange={(event) => setForm({ ...form, group_name: event.target.value })}
                    placeholder="مثال: القهوة أو الألبان"
                    className="w-full rounded-lg border bg-background p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">كود الصنف (اختياري)</label>
                  <input
                    value={form.sku}
                    onChange={(event) => setForm({ ...form, sku: event.target.value })}
                    placeholder="SKU"
                    className="w-full rounded-lg border bg-background p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">وحدة الشراء *</label>
                  <select
                    value={form.purchase_unit}
                    onChange={(event) => setForm({ ...form, purchase_unit: event.target.value })}
                    className="w-full rounded-lg border bg-background p-3"
                  >
                    {units.map((unit) => (
                      <option key={unit.code} value={unit.code}>
                        {unit.name_ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">كمية الشراء *</label>
                  <input
                    required
                    type="number"
                    min="0.0001"
                    step="any"
                    value={form.purchase_quantity}
                    onChange={(event) =>
                      setForm({ ...form, purchase_quantity: event.target.value })
                    }
                    className="w-full rounded-lg border bg-background p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">سعر الشراء الإجمالي *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchase_price}
                    onChange={(event) =>
                      setForm({ ...form, purchase_price: event.target.value })
                    }
                    className="w-full rounded-lg border bg-background p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    حد التنبيه (
                    {unitName(
                      units.find((unit) => unit.code === form.purchase_unit)?.dimension === "mass"
                        ? "g"
                        : units.find((unit) => unit.code === form.purchase_unit)?.dimension === "volume"
                          ? "ml"
                          : "pcs",
                    )}
                    )
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={form.reorder_level}
                    onChange={(event) =>
                      setForm({ ...form, reorder_level: event.target.value })
                    }
                    placeholder="اتركه فارغًا لإلغاء التنبيه"
                    className="w-full rounded-lg border bg-background p-3"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    الحد يُسجل بوحدة الأساس: جرام أو مللي أو قطعة.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  rows={2}
                  className="w-full rounded-lg border bg-background p-3"
                  placeholder="ملاحظات اختيارية عن الخامة"
                />
              </div>

              <div className="rounded-lg bg-muted p-3 text-sm">
                تكلفة وحدة الاستخدام سيحسبها النظام تلقائيًا من سعر الشراء والكمية والوحدة.
                لن تحتاج إلى إدخالها يدويًا.
              </div>

              {formMessage && (
                <p className="rounded-lg bg-muted p-3 text-sm" role="status">
                  {formMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={ingredientMutation.isPending}
                className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
              >
                {ingredientMutation.isPending
                  ? "جارٍ الحفظ..."
                  : editingIngredient
                    ? "حفظ التعديلات"
                    : "إضافة الخامة"}
              </button>
            </form>
          </section>
        )}

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 text-lg font-bold">تسجيل حركة مخزون يدوية</h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">الخامة</label>
              <select
                value={selectedIngredient}
                onChange={(event) => setSelectedIngredient(event.target.value)}
                className="w-full rounded-lg border bg-background p-3"
              >
                <option value="">اختار الخامة</option>
                {activeIngredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">نوع الحركة</label>
              <select
                value={direction}
                onChange={(event) => setDirection(event.target.value as "add" | "remove")}
                className="w-full rounded-lg border bg-background p-3"
              >
                <option value="add">إضافة رصيد</option>
                <option value="remove">خصم رصيد</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                الكمية {selected ? `(${unitName(selected.base_unit)})` : ""}
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="اكتب الكمية"
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">ملاحظات</label>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="سبب التسوية (اختياري)"
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>
          </div>

          {selected && (
            <p className="mt-3 text-sm text-muted-foreground">
              الرصيد الحالي:{" "}
              <strong>{selectedBalance.toLocaleString("ar-EG")}</strong>{" "}
              {unitName(selected.base_unit)}
            </p>
          )}

          {message && (
            <p className="mt-3 rounded-lg bg-muted p-3 text-sm" role="status">
              {message}
            </p>
          )}

          <button
            type="button"
            disabled={
              !selectedIngredient ||
              !amount ||
              !branchId ||
              movementMutation.isPending
            }
            onClick={() => {
              setMessage("");
              movementMutation.mutate();
            }}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {movementMutation.isPending ? "جارٍ الحفظ..." : "تسجيل الحركة"}
          </button>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="text-lg font-bold">أرصدة الخامات</h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالاسم أو المجموعة أو الكود..."
              className="mt-3 w-full rounded-lg border bg-background p-3"
            />
          </div>

          {ingredientsLoading || stockLoading ? (
            <p className="p-6 text-center text-muted-foreground">
              جارٍ تحميل المخزون...
            </p>
          ) : filteredIngredients.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              لا توجد خامات مطابقة للبحث.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">الخامة</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">المجموعة</th>
                    <th className="p-3">الرصيد</th>
                    <th className="p-3">حد التنبيه</th>
                    <th className="p-3">تكلفة وحدة الأساس</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredIngredients.map((ingredient) => {
                    const balance = stockMap.get(ingredient.id) ?? 0;
                    const threshold = ingredient.reorder_level;
                    const isLow =
                      ingredient.is_active &&
                      threshold !== null &&
                      threshold !== undefined &&
                      balance <= Number(threshold);

                    return (
                      <tr key={ingredient.id} className="border-t">
                        <td className="p-3 font-medium">{ingredient.name}</td>

                        <td className="p-3">
                          {ingredient.kind === "packaging" ? "تعبئة وتغليف" : "خامة"}
                        </td>

                        <td className="p-3 text-muted-foreground">
                          {ingredient.group_name || "—"}
                        </td>

                        <td className="p-3 font-semibold">
                          {balance.toLocaleString("ar-EG")}{" "}
                          {unitName(ingredient.base_unit)}
                        </td>

                        <td className="p-3">
                          {threshold === null || threshold === undefined
                            ? "—"
                            : Number(threshold).toLocaleString("ar-EG")}
                        </td>

                        <td className="p-3">
                          {Number(ingredient.cost_per_base_unit).toLocaleString("ar-EG", {
                            maximumFractionDigits: 5,
                          })}
                        </td>

                        <td className="p-3">
                          {!ingredient.is_active ? (
                            <span className="rounded-full bg-muted px-2 py-1 text-xs">
                              موقوفة
                            </span>
                          ) : isLow ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                              مخزون منخفض
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                              متاح
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditIngredient(ingredient)}
                              className="rounded-lg border px-3 py-2 text-xs"
                            >
                              تعديل
                            </button>

                            <button
                              type="button"
                              disabled={statusMutation.isPending}
                              onClick={() => {
                                setFormMessage("");
                                statusMutation.mutate(ingredient);
                              }}
                              className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50"
                            >
                              {ingredient.is_active ? "إيقاف" : "تفعيل"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ModulePage>
  );
}
