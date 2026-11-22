
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

export const Route = createFileRoute("/_authenticated/app/recipes")({
  head: () => ({
    meta: [{ title: "الريسبيات — CAFE OS" }],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

type RecipeLink = {
  recipe_id: string;
  sub_recipe_id: string | null;
};

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

  const { data: recipeLinks = [] } = useQuery({
    queryKey: ["recipe-links", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async (): Promise<RecipeLink[]> => {
      const { data, error } = await supabase
        .from("recipe_items")
        .select("recipe_id, sub_recipe_id")
        .eq("tenant_id", tenantId)
        .not("sub_recipe_id", "is", null);

      if (error) throw error;
      return (data ?? []) as RecipeLink[];
    },
  });

  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  const [recipeName, setRecipeName] = useState("");
  const [recipeKind, setRecipeKind] = useState<"menu_item" | "sub_recipe">("menu_item");
  const [yieldQuantity, setYieldQuantity] = useState("1");
  const [yieldUnit, setYieldUnit] = useState("pcs");
  const [instructions, setInstructions] = useState("");

  const [editingRecipe, setEditingRecipe] = useState(false);
  const [editName, setEditName] = useState("");
  const [editYieldQuantity, setEditYieldQuantity] = useState("");
  const [editYieldUnit, setEditYieldUnit] = useState("pcs");
  const [editInstructions, setEditInstructions] = useState("");
  const [editWastePercent, setEditWastePercent] = useState("0");

  const [componentType, setComponentType] = useState<"ingredient" | "sub_recipe">("ingredient");
  const [ingredientId, setIngredientId] = useState("");
  const [subRecipeId, setSubRecipeId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [itemNote, setItemNote] = useState("");
  const [itemOptional, setItemOptional] = useState(false);
  const [editingItemId, setEditingItemId] = useState("");

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

  const selectedIngredient = ingredients.find((item) => item.id === ingredientId);
  const selectedSubRecipe = recipes.find((recipe) => recipe.id === subRecipeId);

  const componentBaseUnit =
    componentType === "ingredient"
      ? selectedIngredient?.base_unit
      : selectedSubRecipe?.yield_unit;

  const componentDimension = componentBaseUnit
    ? units.find((item) => item.code === componentBaseUnit)?.dimension
    : undefined;

  const compatibleUnits = componentDimension
    ? units.filter((item) => item.dimension === componentDimension)
    : [];

  const canUseAsSubRecipe = (candidateId: string) => {
    if (!selectedId || candidateId === selectedId) return false;

    const visited = new Set<string>();
    const stack = [candidateId];

    while (stack.length > 0) {
      const current = stack.pop()!;

      if (current === selectedId) return false;
      if (visited.has(current)) continue;

      visited.add(current);

      for (const link of recipeLinks) {
        if (link.recipe_id === current && link.sub_recipe_id) {
          stack.push(link.sub_recipe_id);
        }
      }
    }

    return true;
  };

  const availableSubRecipes = recipes.filter(
    (recipe) =>
      recipe.kind === "sub_recipe" &&
      recipe.is_active &&
      canUseAsSubRecipe(recipe.id),
  );

  const resetComponentForm = () => {
    setIngredientId("");
    setSubRecipeId("");
    setQuantity("");
    setItemNote("");
    setItemOptional(false);
    setUnit("g");
    setEditingItemId("");
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["recipes", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["recipe-items", selectedId] }),
      queryClient.invalidateQueries({ queryKey: ["recipe-links", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["costing", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["recipe-usage"] }),
    ]);
  };

  const startRecipeEdit = () => {
    if (!selectedRecipe) return;

    setEditName(selectedRecipe.name);
    setEditYieldQuantity(String(selectedRecipe.yield_quantity));
    setEditYieldUnit(selectedRecipe.yield_unit);
    setEditInstructions(selectedRecipe.instructions ?? "");
    setEditWastePercent(String(selectedRecipe.waste_percent ?? 0));
    setEditingRecipe(true);
    setMessage("");
  };

  const cancelRecipeEdit = () => {
    setEditingRecipe(false);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = recipeName.trim();
      const yieldValue = Number(yieldQuantity);

      if (!tenantId) throw new Error("لا يوجد كافيه مرتبط بالحساب");
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

  const updateRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecipe) throw new Error("اختار وصفة أولاً");

      const name = editName.trim();
      const yieldValue = Number(editYieldQuantity);
      const wasteValue = Number(editWastePercent);

      if (name.length < 2) throw new Error("اسم الوصفة يجب أن يكون حرفين على الأقل");
      if (!Number.isFinite(yieldValue) || yieldValue <= 0) {
        throw new Error("كمية الناتج غير صحيحة");
      }
      if (!Number.isFinite(wasteValue) || wasteValue < 0 || wasteValue > 100) {
        throw new Error("نسبة الهالك يجب أن تكون من 0 إلى 100");
      }
      if (!units.some((item) => item.code === editYieldUnit)) {
        throw new Error("وحدة الناتج غير صحيحة");
      }

      const { data, error } = await supabase
        .from("recipes")
        .update({
          name,
          yield_quantity: yieldValue,
          yield_unit: editYieldUnit,
          instructions: editInstructions.trim() || null,
          waste_percent: wasteValue,
        })
        .eq("id", selectedRecipe.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("لم يتم تعديل الوصفة. تحقق من الصلاحيات وحاول مرة أخرى.");
    },
    onSuccess: async () => {
      setEditingRecipe(false);
      setMessage("تم تحديث بيانات الوصفة وإعادة حساب تكلفتها.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("لا يوجد كافيه مرتبط بالحساب");
      if (!selectedRecipe) throw new Error("اختار وصفة أولاً");

      const amount = Number(quantity);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("اكتب كمية صحيحة أكبر من صفر");
      }

      const selectedUnit = units.find((item) => item.code === unit);
      if (!selectedUnit) throw new Error("وحدة القياس غير صحيحة");

      let ingredientValue: string | null = null;
      let subRecipeValue: string | null = null;

      if (componentType === "ingredient") {
        if (!ingredientId) throw new Error("اختار الخامة");

        const ingredient = ingredients.find((item) => item.id === ingredientId);
        if (!ingredient) throw new Error("الخامة غير موجودة");

        const baseUnit = units.find((item) => item.code === ingredient.base_unit);

        if (!baseUnit || selectedUnit.dimension !== baseUnit.dimension) {
          throw new Error("وحدة القياس لا تتوافق مع وحدة الخامة");
        }

        ingredientValue = ingredient.id;
      } else {
        if (!subRecipeId) throw new Error("اختار التحضير الداخلي");

        const subRecipe = recipes.find((item) => item.id === subRecipeId);
        if (!subRecipe || subRecipe.kind !== "sub_recipe") {
          throw new Error("التحضير الداخلي غير موجود");
        }

        if (!canUseAsSubRecipe(subRecipe.id)) {
          throw new Error("لا يمكن إضافة هذا التحضير لأنه قد يسبب دورة بين الوصفات");
        }

        const baseUnit = units.find((item) => item.code === subRecipe.yield_unit);

        if (!baseUnit || selectedUnit.dimension !== baseUnit.dimension) {
          throw new Error("وحدة القياس لا تتوافق مع وحدة ناتج التحضير");
        }

        subRecipeValue = subRecipe.id;
      }

      const { error } = await supabase.from("recipe_items").insert({
        tenant_id: tenantId,
        recipe_id: selectedRecipe.id,
        ingredient_id: ingredientValue,
        sub_recipe_id: subRecipeValue,
        quantity: amount,
        unit,
        notes: itemNote.trim() || null,
        is_optional: itemOptional,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      resetComponentForm();
      setMessage("تمت إضافة المكون للوصفة.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRecipe || !editingItemId) {
        throw new Error("اختار مكونًا صحيحًا للتعديل");
      }

      const amount = Number(quantity);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("اكتب كمية صحيحة أكبر من صفر");
      }

      const selectedUnit = units.find((item) => item.code === unit);
      if (!selectedUnit) throw new Error("وحدة القياس غير صحيحة");

      const currentItem = items.find((item) => item.id === editingItemId);
      if (!currentItem) throw new Error("المكون لم يعد موجودًا");

      const baseUnit = currentItem.ingredient
        ? units.find((item) => item.code === currentItem.ingredient.base_unit)
        : currentItem.sub_recipe
          ? units.find((item) => item.code === currentItem.sub_recipe.yield_unit)
          : undefined;

      if (!baseUnit || selectedUnit.dimension !== baseUnit.dimension) {
        throw new Error("وحدة القياس لا تتوافق مع المكون");
      }

      const { data, error } = await supabase
        .from("recipe_items")
        .update({
          quantity: amount,
          unit,
          notes: itemNote.trim() || null,
          is_optional: itemOptional,
        })
        .eq("id", editingItemId)
        .eq("recipe_id", selectedRecipe.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("لم يتم تعديل المكون. حاول مرة أخرى.");
    },
    onSuccess: async () => {
      resetComponentForm();
      setMessage("تم تعديل المكون وإعادة حساب تكلفة الوصفة.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("recipe_items")
        .delete()
        .eq("id", id)
        .eq("recipe_id", selectedId)
        .eq("tenant_id", tenantId)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("لم يتم حذف المكون. ربما تم حذفه بالفعل أو لا تملك الصلاحية.");
      }
    },
    onSuccess: async () => {
      resetComponentForm();
      setMessage("تم حذف المكون وإعادة حساب التكلفة.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (recipe: (typeof recipes)[number]) => {
      const { data, error } = await supabase
        .from("recipes")
        .update({ is_active: !recipe.is_active })
        .eq("id", recipe.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("لم يتم تغيير حالة الوصفة. تحقق من الصلاحيات.");
    },
    onSuccess: async () => {
      setMessage("تم تحديث حالة الوصفة.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const startItemEdit = (item: (typeof items)[number]) => {
    setEditingItemId(item.id);
    setComponentType(item.sub_recipe ? "sub_recipe" : "ingredient");
    setIngredientId(item.ingredient_id ?? "");
    setSubRecipeId(item.sub_recipe_id ?? "");
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setItemNote(item.notes ?? "");
    setItemOptional(item.is_optional);
    setMessage("");
  };

  if (!tenantId) {
    return (
      <ModulePage module="recipes">
        لا يوجد كافيه مرتبط بحسابك حتى الآن.
      </ModulePage>
    );
  }

  return (
    <ModulePage module="recipes" wide>
      <div dir="rtl" className="space-y-6">
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
                      resetComponentForm();
                      setEditingRecipe(false);
                      setMessage("");
                    }}
                    className={`w-full rounded-lg border p-3 text-right ${
                      selectedId === recipe.id
                        ? "border-primary bg-primary/5"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{recipe.name}</strong>
                      <span className="text-xs text-muted-foreground">
                        {recipe.kind === "sub_recipe" ? "تحضير داخلي" : "صنف للبيع"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {recipe.is_active ? "نشطة" : "متوقفة"} · الناتج{" "}
                      {recipe.yield_quantity} {unitName(recipe.yield_unit)}
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
                      الناتج: {selectedRecipe.yield_quantity} {unitName(selectedRecipe.yield_unit)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startRecipeEdit}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      تعديل الوصفة
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate(selectedRecipe)}
                      disabled={toggleMutation.isPending}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      {selectedRecipe.is_active ? "إيقاف الوصفة" : "تفعيل الوصفة"}
                    </button>
                  </div>
                </div>

                <div className="my-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">إجمالي تكلفة الوصفة</p>
                    <p className="mt-1 text-xl font-bold">
                      {Number(selectedRecipe.total_cost ?? 0).toFixed(3)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">تكلفة وحدة الناتج</p>
                    <p className="mt-1 text-xl font-bold">
                      {Number(selectedRecipe.cost_per_unit ?? 0).toFixed(3)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">تكلفة الخامات</p>
                    <p className="mt-1 font-semibold">
                      {Number(selectedRecipe.ingredient_cost ?? 0).toFixed(3)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm text-muted-foreground">تكلفة التغليف والهالك</p>
                    <p className="mt-1 font-semibold">
                      {(Number(selectedRecipe.packaging_cost ?? 0) + Number(selectedRecipe.waste_cost ?? 0)).toFixed(3)}
                    </p>
                  </div>
                </div>

                {editingRecipe && (
                  <div className="my-4 rounded-lg border p-4">
                    <h3 className="mb-3 font-semibold">تعديل بيانات الوصفة</h3>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm">اسم الوصفة</label>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded-lg border bg-background p-3"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm">كمية الناتج</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={editYieldQuantity}
                          onChange={(e) => setEditYieldQuantity(e.target.value)}
                          className="w-full rounded-lg border bg-background p-3"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm">وحدة الناتج</label>
                        <select
                          value={editYieldUnit}
                          onChange={(e) => setEditYieldUnit(e.target.value)}
                          className="w-full rounded-lg border bg-background p-3"
                        >
                          {units.map((u) => (
                            <option key={u.code} value={u.code}>{u.name_ar}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm">نسبة الهالك %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editWastePercent}
                          onChange={(e) => setEditWastePercent(e.target.value)}
                          className="w-full rounded-lg border bg-background p-3"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm">طريقة التحضير</label>
                        <textarea
                          rows={3}
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          className="w-full rounded-lg border bg-background p-3"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updateRecipeMutation.isPending}
                        onClick={() => updateRecipeMutation.mutate()}
                        className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {updateRecipeMutation.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRecipeEdit}
                        className="rounded-lg border px-4 py-3"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                <div className="my-5 rounded-lg border p-3">
                  <h3 className="mb-3 font-semibold">
                    {editingItemId ? "تعديل مكون" : "إضافة مكون"}
                  </h3>

                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={Boolean(editingItemId)}
                      onClick={() => {
                        setComponentType("ingredient");
                        resetComponentForm();
                      }}
                      className={`rounded-lg border p-3 text-sm ${
                        componentType === "ingredient"
                          ? "border-primary bg-primary/5 font-semibold"
                          : ""
                      }`}
                    >
                      خامة مباشرة
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(editingItemId)}
                      onClick={() => {
                        setComponentType("sub_recipe");
                        resetComponentForm();
                      }}
                      className={`rounded-lg border p-3 text-sm ${
                        componentType === "sub_recipe"
                          ? "border-primary bg-primary/5 font-semibold"
                          : ""
                      }`}
                    >
                      تحضير داخلي
                    </button>
                  </div>

                  {componentType === "ingredient" ? (
                    <select
                      value={ingredientId}
                      disabled={Boolean(editingItemId)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setIngredientId(value);
                        const item = ingredients.find((i) => i.id === value);
                        if (item) setUnit(item.base_unit);
                      }}
                      className="mb-3 w-full rounded-lg border bg-background p-3 disabled:opacity-60"
                    >
                      <option value="">اختار الخامة</option>
                      {ingredients
                        .filter((i) => i.is_active || i.id === ingredientId)
                        .map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                    </select>
                  ) : (
                    <select
                      value={subRecipeId}
                      disabled={Boolean(editingItemId)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSubRecipeId(value);
                        const item = recipes.find((r) => r.id === value);
                        if (item) setUnit(item.yield_unit);
                      }}
                      className="mb-3 w-full rounded-lg border bg-background p-3 disabled:opacity-60"
                    >
                      <option value="">اختار التحضير الداخلي</option>
                      {recipes
                        .filter((recipe) =>
                          recipe.kind === "sub_recipe" &&
                          (recipe.is_active || recipe.id === subRecipeId) &&
                          (recipe.id === subRecipeId || canUseAsSubRecipe(recipe.id)),
                        )
                        .map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.name} — الناتج {recipe.yield_quantity} {unitName(recipe.yield_unit)}
                          </option>
                        ))}
                    </select>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="الكمية المستخدمة"
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
                      {!compatibleUnits.some((u) => u.code === unit) && (
                        <option value={unit}>{unitName(unit)}</option>
                      )}
                    </select>

                    <input
                      value={itemNote}
                      onChange={(e) => setItemNote(e.target.value)}
                      placeholder="ملاحظة (اختياري)"
                      className="w-full rounded-lg border bg-background p-3 sm:col-span-2"
                    />

                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={itemOptional}
                        onChange={(e) => setItemOptional(e.target.checked)}
                      />
                      مكون اختياري
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        !quantity ||
                        (componentType === "ingredient" && !ingredientId) ||
                        (componentType === "sub_recipe" && !subRecipeId) ||
                        addItemMutation.isPending ||
                        updateItemMutation.isPending
                      }
                      onClick={() => {
                        setMessage("");
                        if (editingItemId) {
                          updateItemMutation.mutate();
                        } else {
                          addItemMutation.mutate();
                        }
                      }}
                      className="flex-1 rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {addItemMutation.isPending || updateItemMutation.isPending
                        ? "جارٍ الحفظ..."
                        : editingItemId
                          ? "حفظ تعديل المكون"
                          : "إضافة المكون"}
                    </button>

                    {editingItemId && (
                      <button
                        type="button"
                        onClick={resetComponentForm}
                        className="rounded-lg border px-4 py-3"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">مكونات الوصفة</h3>
                  <span className="text-sm text-muted-foreground">
                    {items.length} مكون
                  </span>
                </div>

                {itemsLoading ? (
                  <p className="p-4 text-center text-muted-foreground">
                    جارٍ تحميل المكونات...
                  </p>
                ) : items.length === 0 ? (
                  <p className="rounded-lg bg-muted p-4 text-center text-muted-foreground">
                    الوصفة لسه مفيهاش مكونات.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <strong>
                              {item.ingredient?.name ?? item.sub_recipe?.name ?? "مكون"}
                            </strong>

                            <p className="mt-1 text-sm text-muted-foreground">
                              {item.sub_recipe ? "تحضير داخلي" : "خامة"} ·{" "}
                              {item.quantity} {unitName(item.unit)}
                              {item.is_optional ? " · اختياري" : ""}
                            </p>

                            {item.notes && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                ملاحظة: {item.notes}
                              </p>
                            )}

                            <p className="mt-2 text-sm font-semibold">
                              تكلفة المكون: {Number(item.line_cost ?? 0).toFixed(3)}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startItemEdit(item)}
                              className="rounded-lg border px-3 py-2 text-sm"
                            >
                              تعديل
                            </button>

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
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedRecipe.instructions && !editingRecipe && (
                  <div className="mt-5 rounded-lg bg-muted p-3">
                    <h3 className="mb-2 font-semibold">طريقة التحضير</h3>
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedRecipe.instructions}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {message && (
          <p role="status" className="rounded-lg bg-muted p-3 text-sm">
            {message}
          </p>
        )}
      </div>
    </ModulePage>
  );
}
