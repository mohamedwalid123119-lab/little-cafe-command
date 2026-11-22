
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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

  const stockMap = useMemo(
    () => new Map(stock.map((item) => [item.ingredient_id, Number(item.quantity)])),
    [stock],
  );

  const filteredIngredients = ingredients.filter((ingredient) =>
    `${ingredient.name} ${ingredient.group_name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const selected = ingredients.find((item) => item.id === selectedIngredient);
  const selectedBalance = selected ? stockMap.get(selected.id) ?? 0 : 0;

  const unitName = (code: string) =>
    units.find((unit) => unit.code === code)?.name_ar ?? code;

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !branchId) {
        throw new Error("اختار الفرع والخامة أولاً");
      }

      const value = Number(amount);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("اكتب كمية صحيحة أكبر من صفر");
      }

      const signedQuantity = direction === "add" ? value : -value;

      if (direction === "remove" && value > selectedBalance) {
        throw new Error("الكمية المطلوبة أكبر من الرصيد المتاح");
      }

      const { error } = await supabase.from("inventory_movements").insert({
        tenant_id: tenantId,
        branch_id: branchId,
        ingredient_id: selected.id,
        movement_type: "adjustment",
        quantity: signedQuantity,
        unit_cost: Number(selected.cost_per_base_unit ?? 0),
        notes: note.trim() || "تسوية مخزون يدوية",
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage("تم تسجيل حركة المخزون بنجاح");
      setAmount("");
      setNote("");
      await queryClient.invalidateQueries({
        queryKey: ["inventory-stock", tenantId, branchId],
      });
    },
    onError: (error: Error) => {
      setMessage(error.message || "تعذر تسجيل الحركة");
    },
  });

  const lowStockCount = ingredients.filter((item) => {
    const balance = stockMap.get(item.id) ?? 0;
    return item.reorder_level !== null &&
      item.reorder_level !== undefined &&
      balance <= Number(item.reorder_level);
  }).length;

  const totalIngredients = ingredients.length;

  return (
    <ModulePage module="inventory" wide>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">إجمالي الخامات</p>
            <p className="mt-2 text-2xl font-bold">{totalIngredients}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">خامات وصلت لحد التنبيه</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{lowStockCount}</p>
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

        <div className="rounded-xl border bg-card p-4">
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
                {ingredients.map((ingredient) => (
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
              الرصيد الحالي: <strong>{selectedBalance.toLocaleString("ar-EG")}</strong>{" "}
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
            disabled={!selectedIngredient || !amount || !branchId || movementMutation.isPending}
            onClick={() => {
              setMessage("");
              movementMutation.mutate();
            }}
            className="mt-4 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {movementMutation.isPending ? "جارٍ الحفظ..." : "تسجيل الحركة"}
          </button>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="text-lg font-bold">أرصدة الخامات</h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن خامة..."
              className="mt-3 w-full rounded-lg border bg-background p-3"
            />
          </div>

          {ingredientsLoading || stockLoading ? (
            <p className="p-6 text-center text-muted-foreground">جارٍ تحميل المخزون...</p>
          ) : filteredIngredients.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">لا توجد خامات مطابقة للبحث.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">الخامة</th>
                    <th className="p-3">المجموعة</th>
                    <th className="p-3">الرصيد</th>
                    <th className="p-3">حد التنبيه</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngredients.map((ingredient) => {
                    const balance = stockMap.get(ingredient.id) ?? 0;
                    const threshold = ingredient.reorder_level;
                    const isLow = threshold !== null &&
                      threshold !== undefined &&
                      balance <= Number(threshold);

                    return (
                      <tr key={ingredient.id} className="border-t">
                        <td className="p-3 font-medium">{ingredient.name}</td>
                        <td className="p-3 text-muted-foreground">
                          {ingredient.group_name || "—"}
                        </td>
                        <td className="p-3 font-semibold">
                          {balance.toLocaleString("ar-EG")} {unitName(ingredient.base_unit)}
                        </td>
                        <td className="p-3">
                          {threshold === null || threshold === undefined
                            ? "—"
                            : Number(threshold).toLocaleString("ar-EG")}
                        </td>
                        <td className="p-3">
                          {isLow ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                              مخزون منخفض
                            </span>
                          ) : (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                              متاح
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ModulePage>
  );
}
