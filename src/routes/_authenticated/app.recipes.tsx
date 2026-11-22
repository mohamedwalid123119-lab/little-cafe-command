
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/recipes")({
  head: () => ({
    meta: [{ title: "الريسبيات — CAFE OS" }],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const tenantId = memberships[0]?.tenant_id ?? "";
  const queryClient = useQueryClient();

  const { data: recipes = [], isLoading } = useQuery({
    ...q.recipes(tenantId),
    enabled: Boolean(tenantId),
  });

  const { data: ingredients = [] } = useQuery({
    ...q.ingredients(tenantId),
    enabled: Boolean(tenantId),
  });

  const { data: units = [] } = useQuery(q.units());

  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [recipeKind, setRecipeKind] = useState<"menu_item" | "sub_recipe">("menu_item");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("pcs");
  const [instructions, setInstructions] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [itemNote, setItemNote] = useState("");
  const [message, setMessage] = useState("");

  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedId);

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    ...q.recipeItems(selectedId),
    enabled: Boolean(selectedId),
  });

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(search.toLowerCase()),
  );

  const unitName = (code: string) =>
    units.find((item) => item.code === code)?.name_ar ?? code;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["recipes", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["recipe-items", selectedId] }),
      queryClient.invalidateQueries({ queryKey: ["costing", tenantId] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = recipeName.trim();
      const yieldValue = Number(yieldQuantity);

      if (name.length < 2) throw new Error("اكتب اسم الوصفة");
      if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
        throw new Error("كمية الناتج غير صحيحة");
      }

      const { data, error } = await supabase
        .from("recipes")
        .insert({
          tenant_id: tenantId,
          name,
          kind: recipeKind,
          yield_quantity: yieldValue,
          yield_unit: yieldUnit,
          instructions: instructions.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      setRecipeName("");
      setInstructions("");
      setYieldQuantity("1");
      setSelectedId(id);
      setMessage("تم إنشاء الوصفة. أضف مكوناتها الآن.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecipe) throw new Error("اختار وصفة أولاً");
      if (!ingredientId) throw new Error("اختار الخامة");

      const amount = Number(quantity);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("اكتب كمية صحيحة أكبر من صفر");
      }

      const ingredient = ingredients.find((item) => item.id === ingredientId);
      if (!ingredient) throw new Error("الخامة غير موجودة");

      const selectedUnit = units.find((item) => item.code === unit);
      const baseUnit = units.find((item) => item.code === ingredient.base_unit);

      if (!selectedUnit || !baseUnit || selectedUnit.dimension !== baseUnit.dimension) {
        throw new Error("وحدة القياس لا تتوافق مع وحدة الخامة");
      }

      const { error } = await supabase.from("recipe_items").insert({
        tenant_id: tenantId,
        recipe_id: selectedRecipe.id,
        ingredient_id: ingredientId,
        quantity: amount,
        unit,
        notes: itemNote.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setQuantity("");
      setItemNote("");
      setMessage("تمت إضافة المكون للوصفة");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recipe_items")
        .delete()
        .eq("id", id)
        .eq("recipe_id", selectedId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage("تم حذف المكون");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (recipe: (typeof recipes)[number]) => {
      const { error } = await supabase
        .from("recipes")
        .update({ is_active: !recipe.is_active })
        .eq("id", recipe.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error: Error) => setMessage(error.message),
  });

  const selectedIngredient = ingredients.find((item) => item.id === ingredientId);

  const compatibleUnits = selectedIngredient
    ? units.filter((item) => {
        const base = units.find((u) => u.code === selectedIngredient.base_unit);
        return base && item.dimension === base.dimension;
      })
    : [];

  return (
    <ModulePage module="recipes" wide>
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">إجمالي الوصفات</p>
            <p className="mt-2 text-2xl font-bold">{recipes.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">وصفات مشروبات وأصناف</p>
            <p className="mt-2 text-2xl font-bold">
              {recipes.filter((r) => r.kind === "menu_item").length}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">تحضيرات داخلية</p>
            <p className="mt-2 text-2xl font-bold">
              {recipes.filter((r) => r.kind === "sub_recipe").length}
            </p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 text-lg font-bold">إنشاء وصفة جديدة</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">اسم الوصفة</label>
              <input
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="مثال: Spanish Latte"
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">نوع الوصفة</label>
              <select
                value={recipeKind}
                onChange={(e) => setRecipeKind(e.target.value as "menu_item" | "sub_recipe")}
                className="w-full rounded-lg border bg-background p-3"
              >
                <option value="menu_item">مشروب أو صنف للبيع</option>
                <option value="sub_recipe">تحضير داخلي</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">كمية الناتج</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={yieldQuantity}
                onChange={(e) => setYieldQuantity(e.target.value)}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">وحدة الناتج</label>
              <select
                value={yieldUnit}
                onChange={(e) => setYieldUnit(e.target.value)}
                className="w-full rounded-lg border bg-background p-3"
              >
                {units.map((u) => (
                  <option key={u.code} value={u.code}>{u.name_ar}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">طريقة التحضير</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder="خطوات التحضير..."
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={createMutation.isPending || !recipeName.trim()}
            onClick={() => {
              setMessage("");
              createMutation.mutate();
            }}
            className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء الوصفة"}
          </button>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.5fr]">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-bold">قائمة الوصفات</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن وصفة..."
              className="mb-3 w-full rounded-lg border bg-background p-3"
            />

            {isLoading ? (
              <p className="p-4 text-center text-muted-foreground">جارٍ التحميل...</p>
            ) : filteredRecipes.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">لا توجد وصفات بعد.</p>
            ) : (
              <div className="space-y-2">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(recipe.id);
                      setMessage("");
                    }}
                    className={`w-full rounded-lg border p-3 text-right ${
                      selectedId === recipe.id ? "border-primary bg-primary/5" : "bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{recipe.name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {recipe.kind === "sub_recipe" ? "تحضير داخلي" : "صنف للبيع"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recipe.is_active ? "نشطة" : "متوقفة"} · الناتج {recipe.yield_quantity}{" "}
                      {unitName(recipe.yield_unit)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            {!selectedRecipe ? (
              <div className="py-12 text-center text-muted-foreground">
                اختار وصفة من القائمة لعرض مكوناتها وإدارتها.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{selectedRecipe.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      تكلفة الوحدة المسجلة: {Number(selectedRecipe.cost_per_unit ?? 0).toFixed(3)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(selectedRecipe)}
                    disabled={toggleMutation.isPending}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    {selectedRecipe.is_active ? "إيقاف الوصفة" : "تفعيل الوصفة"}
                  </button>
                </div>

                <div className="my-5 rounded-lg border p-3">
                  <h3 className="mb-3 font-semibold">إضافة مكون</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      value={ingredientId}
                      onChange={(e) => {
                        setIngredientId(e.target.value);
                        const item = ingredients.find((i) => i.id === e.target.value);
                        if (item) setUnit(item.base_unit);
                      }}
                      className="w-full rounded-lg border bg-background p-3"
                    >
                      <option value="">اختار الخامة</option>
                      {ingredients.filter((i) => i.is_active).map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="الكمية"
                      className="w-full rounded-lg border bg-background p-3"
                    />

                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full rounded-lg border bg-background p-3"
                    >
                      {compatibleUnits.map((u) => (
                        <option key={u.code} value={u.code}>{u.name_ar}</option>
                      ))}
                    </select>

                    <input
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      placeholder="ملاحظة (اختياري)"
                      className="w-full rounded-lg border bg-background p-3"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!ingredientId || !quantity || addItemMutation.isPending}
                    onClick={() => {
                      setMessage("");
                      addItemMutation.mutate();
                    }}
                    className="mt-3 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {addItemMutation.isPending ? "جارٍ الإضافة..." : "إضافة المكون"}
                  </button>
                </div>

                <h3 className="mb-3 font-semibold">مكونات الوصفة</h3>
                {itemsLoading ? (
                  <p className="p-4 text-center text-muted-foreground">جارٍ تحميل المكونات...</p>
                ) : items.length === 0 ? (
                  <p className="rounded-lg bg-muted p-4 text-center text-muted-foreground">
                    الوصفة لسه مفيهاش مكونات.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <strong>{item.ingredient?.name ?? item.sub_recipe?.name ?? "مكون"}</strong>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.quantity} {unitName(item.unit)}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={deleteItemMutation.isPending}
                          onClick={() => {
                            if (window.confirm("حذف المكون من الوصفة؟")) {
                              deleteItemMutation.mutate(item.id);
                            }
                          }}
                          className="rounded-lg border px-3 py-2 text-sm text-destructive"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRecipe.instructions && (
                  <div className="mt-5 rounded-lg bg-muted p-3">
                    <h3 className="mb-2 font-semibold">طريقة التحضير</h3>
                    <p className="whitespace-pre-wrap text-sm">{selectedRecipe.instructions}</p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {message && (
          <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>
        )}
      </div>
    </ModulePage>
  );
}
