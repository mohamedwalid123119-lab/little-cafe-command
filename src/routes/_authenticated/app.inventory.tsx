
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/inventory")({
  head: () => ({
    meta: [{ title: "Inventory — CAFE OS" }],
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

const categories = {
  ar: {
    title: "إدارة المخزون",
    description: "الخامات والأرصدة وتكلفة الشراء وحركات المخزون.",
    add: "إضافة خامة جديدة",
    active: "الخامات النشطة",
    low: "خامات وصلت لحد التنبيه",
    branch: "الفرع الحالي",
    noBranch: "لا يوجد فرع",
    chooseBranch: "اختيار الفرع",
    edit: "تعديل بيانات الخامة",
    close: "إغلاق",
    name: "اسم الخامة",
    kind: "نوع الصنف",
    raw: "خامة / مكون وصفة",
    packaging: "مواد تعبئة وتغليف",
    group: "المجموعة",
    sku: "كود الصنف (اختياري)",
    unit: "وحدة الشراء",
    quantity: "كمية الشراء",
    price: "سعر الشراء الإجمالي",
    reorder: "حد التنبيه",
    reorderHint: "اتركه فارغًا لإلغاء التنبيه",
    reorderNote: "الحد يُسجل بوحدة الأساس: جرام أو مللي أو قطعة.",
    notes: "ملاحظات",
    optionalNotes: "ملاحظات اختيارية عن الخامة",
    costInfo: "تكلفة وحدة الاستخدام سيحسبها النظام تلقائيًا من سعر الشراء والكمية والوحدة. لن تحتاج إلى إدخالها يدويًا.",
    saving: "جارٍ الحفظ...",
    saveChanges: "حفظ التعديلات",
    addIngredient: "إضافة الخامة",
    movement: "تسجيل حركة مخزون يدوية",
    ingredient: "الخامة",
    chooseIngredient: "اختار الخامة",
    movementType: "نوع الحركة",
    addStock: "إضافة رصيد",
    removeStock: "خصم رصيد",
    amount: "الكمية",
    reason: "سبب التسوية (اختياري)",
    currentBalance: "الرصيد الحالي:",
    recordMovement: "تسجيل الحركة",
    balances: "أرصدة الخامات",
    search: "ابحث بالاسم أو المجموعة أو الكود...",
    loading: "جارٍ تحميل المخزون...",
    noResults: "لا توجد خامات مطابقة للبحث.",
    tableIngredient: "الخامة",
    tableKind: "النوع",
    tableGroup: "المجموعة",
    balance: "الرصيد",
    threshold: "حد التنبيه",
    unitCost: "تكلفة وحدة الأساس",
    status: "الحالة",
    actions: "الإجراءات",
    packagingShort: "تعبئة وتغليف",
    rawShort: "خامة",
    stopped: "موقوفة",
    lowStock: "مخزون منخفض",
    available: "متاح",
    editButton: "تعديل",
    deactivate: "إيقاف",
    activate: "تفعيل",
    noCafe: "لا يوجد كافيه مرتبط بحسابك حتى الآن.",
    noBranchMessage: "لا يوجد فرع مسجل لهذا الكافيه. أضف فرعًا أولًا.",
    nameRequired: "اكتب اسم الخامة.",
    unitRequired: "اختر وحدة الشراء.",
    quantityInvalid: "كمية الشراء يجب أن تكون أكبر من صفر.",
    priceInvalid: "سعر الشراء غير صحيح.",
    reorderInvalid: "حد التنبيه يجب أن يكون صفرًا أو أكبر.",
    saved: "تم حفظ بيانات الخامة بنجاح.",
    saveFailed: "تعذر حفظ بيانات الخامة.",
    statusFailed: "تعذر تغيير حالة الخامة.",
    statusNotChanged: "لم يتم تغيير حالة الخامة.",
    permissionFailed: "لم يتم تعديل الخامة. تحقق من الصلاحيات.",
    addNotConfirmed: "لم يتم تأكيد إضافة الخامة.",
    chooseBoth: "اختار الفرع والخامة أولاً.",
    inactiveMovement: "لا يمكن تسجيل حركة لخامة موقوفة.",
    amountInvalid: "اكتب كمية صحيحة أكبر من صفر.",
    insufficient: "الكمية المطلوبة أكبر من الرصيد المتاح.",
    movementSaved: "تم تسجيل حركة المخزون بنجاح.",
    movementFailed: "تعذر تسجيل الحركة.",
    movementNotConfirmed: "لم يتم تأكيد تسجيل حركة المخزون.",
    defaultNote: "تسوية مخزون يدوية",
    example: "مثال: بن اسبريسو",
    groupExample: "مثال: القهوة أو الألبان",
    emptyReorder: "اتركه فارغًا لإلغاء التنبيه",
    enterQuantity: "اكتب الكمية",
  },
  en: {
    title: "Inventory Management",
    description: "Ingredients, stock balances, purchase costs and stock movements.",
    add: "Add New Ingredient",
    active: "Active Ingredients",
    low: "Ingredients at Reorder Level",
    branch: "Current Branch",
    noBranch: "No Branch",
    chooseBranch: "Select Branch",
    edit: "Edit Ingredient",
    close: "Close",
    name: "Ingredient Name",
    kind: "Item Type",
    raw: "Raw Material / Recipe Ingredient",
    packaging: "Packaging Materials",
    group: "Group",
    sku: "Item Code (Optional)",
    unit: "Purchase Unit",
    quantity: "Purchase Quantity",
    price: "Total Purchase Price",
    reorder: "Reorder Alert Level",
    reorderHint: "Leave empty to disable the alert",
    reorderNote: "The threshold uses the base unit: gram, milliliter or piece.",
    notes: "Notes",
    optionalNotes: "Optional ingredient notes",
    costInfo: "Usage unit cost is calculated automatically from purchase price, quantity and unit. No manual entry is required.",
    saving: "Saving...",
    saveChanges: "Save Changes",
    addIngredient: "Add Ingredient",
    movement: "Manual Stock Movement",
    ingredient: "Ingredient",
    chooseIngredient: "Select Ingredient",
    movementType: "Movement Type",
    addStock: "Add Stock",
    removeStock: "Remove Stock",
    amount: "Quantity",
    reason: "Adjustment reason (optional)",
    currentBalance: "Current Balance:",
    recordMovement: "Record Movement",
    balances: "Ingredient Balances",
    search: "Search by name, group or code...",
    loading: "Loading inventory...",
    noResults: "No matching ingredients found.",
    tableIngredient: "Ingredient",
    tableKind: "Type",
    tableGroup: "Group",
    balance: "Balance",
    threshold: "Alert Level",
    unitCost: "Base Unit Cost",
    status: "Status",
    actions: "Actions",
    packagingShort: "Packaging",
    rawShort: "Raw Material",
    stopped: "Inactive",
    lowStock: "Low Stock",
    available: "Available",
    editButton: "Edit",
    deactivate: "Deactivate",
    activate: "Activate",
    noCafe: "No cafe is linked to your account yet.",
    noBranchMessage: "No branch is registered for this cafe. Add a branch first.",
    nameRequired: "Enter the ingredient name.",
    unitRequired: "Select a purchase unit.",
    quantityInvalid: "Purchase quantity must be greater than zero.",
    priceInvalid: "Invalid purchase price.",
    reorderInvalid: "Alert level must be zero or greater.",
    saved: "Ingredient details saved successfully.",
    saveFailed: "Unable to save ingredient details.",
    statusFailed: "Unable to change ingredient status.",
    statusNotChanged: "Ingredient status was not changed.",
    permissionFailed: "Ingredient was not updated. Check your permissions.",
    addNotConfirmed: "Ingredient creation was not confirmed.",
    chooseBoth: "Select a branch and ingredient first.",
    inactiveMovement: "Cannot record a movement for an inactive ingredient.",
    amountInvalid: "Enter a valid quantity greater than zero.",
    insufficient: "Requested quantity exceeds available stock.",
    movementSaved: "Stock movement recorded successfully.",
    movementFailed: "Unable to record stock movement.",
    movementNotConfirmed: "Stock movement was not confirmed.",
    defaultNote: "Manual stock adjustment",
    example: "Example: Espresso beans",
    groupExample: "Example: Coffee or Dairy",
    emptyReorder: "Leave empty to disable the alert",
    enterQuantity: "Enter quantity",
  },
};

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  if (!membership) {
    return (
      <ModulePage module="inventory">
        {isArabic
          ? "لا يوجد كافيه مرتبط بحسابك حتى الآن."
          : "No cafe is linked to your account yet."}
      </ModulePage>
    );
  }

  return (
    <Inventory
      tenantId={membership.tenant_id}
      assignedBranch={membership.branch_id ?? ""}
      isArabic={isArabic}
    />
  );
}

function Inventory({
  tenantId,
  assignedBranch,
  isArabic,
}: {
  tenantId: string;
  assignedBranch: string;
  isArabic: boolean;
}) {
  const t = isArabic ? categories.ar : categories.en;
  const locale = isArabic ? "ar-EG" : "en-US";
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

  const unitName = (code: string) => {
    const unit = units.find((item) => item.code === code);
    if (!unit) return code;
    return isArabic ? unit.name_ar : unit.name_en || unit.name_ar;
  };

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

      if (!name) throw new Error(t.nameRequired);
      if (!form.purchase_unit) throw new Error(t.unitRequired);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(t.quantityInvalid);
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(t.priceInvalid);
      }
      if (reorder !== null && (!Number.isFinite(reorder) || reorder < 0)) {
        throw new Error(t.reorderInvalid);
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
        if (!data) throw new Error(t.permissionFailed);
      } else {
        const { data, error } = await supabase
          .from("ingredients")
          .insert({ ...payload, tenant_id: tenantId })
          .select("id")
          .single();

        if (error) throw error;
        if (!data) throw new Error(t.addNotConfirmed);
      }
    },
    onSuccess: async () => {
      setFormMessage(t.saved);
      setForm(emptyForm);
      setEditingIngredient(null);
      setShowIngredientForm(false);
      await invalidateInventory();
    },
    onError: (error: Error) => {
      setFormMessage(error.message || t.saveFailed);
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
      if (!data) throw new Error(t.statusNotChanged);
    },
    onSuccess: invalidateInventory,
    onError: (error: Error) => {
      setFormMessage(error.message || t.statusFailed);
    },
  });

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !branchId) throw new Error(t.chooseBoth);
      if (!selected.is_active) throw new Error(t.inactiveMovement);

      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(t.amountInvalid);
      }
      if (direction === "remove" && value > selectedBalance) {
        throw new Error(t.insufficient);
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
          notes: note.trim() || t.defaultNote,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!data) throw new Error(t.movementNotConfirmed);
    },
    onSuccess: async () => {
      setMessage(t.movementSaved);
      setAmount("");
      setNote("");
      await invalidateInventory();
    },
    onError: (error: Error) => {
      setMessage(error.message || t.movementFailed);
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
    return item.reorder_level != null && balance <= Number(item.reorder_level);
  }).length;

  const totalIngredients = activeIngredients.length;

  const inputClass = "w-full rounded-lg border bg-background p-3";
  const labelClass = "mb-2 block text-sm font-medium";

  return (
    <ModulePage module="inventory" wide>
      <div className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
          </div>
          <button
            type="button"
            onClick={openNewIngredient}
            className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            + {t.add}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t.active}</p>
            <p className="mt-2 text-2xl font-bold">{totalIngredients}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t.low}</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">{lowStockCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t.branch}</p>
            <p className="mt-2 text-lg font-semibold">
              {branches.find((branch) => branch.id === branchId)?.name ?? t.noBranch}
            </p>
          </div>
        </div>

        {!assignedBranch && branches.length > 1 && (
          <div className="rounded-xl border bg-card p-4">
            <label className={labelClass}>{t.chooseBranch}</label>
            <select
              value={branchId}
              onChange={(event) => setBranchChoice(event.target.value)}
              className={inputClass}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          </div>
        )}

        {!branchId ? (
          <div className="rounded-xl border bg-card p-5 text-sm">{t.noBranchMessage}</div>
        ) : (
          <>
            {showIngredientForm && (
              <section className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">
                    {editingIngredient ? t.edit : t.add}
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
                    {t.close}
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
                      <label className={labelClass}>{t.name} *</label>
                      <input
                        required
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        placeholder={t.example}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>{t.kind} *</label>
                      <select
                        value={form.kind}
                        onChange={(event) => setForm({ ...form, kind: event.target.value as "raw" | "packaging" })}
                        className={inputClass}
                      >
                        <option value="raw">{t.raw}</option>
                        <option value="packaging">{t.packaging}</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>{t.group}</label>
                      <input
                        value={form.group_name}
                        onChange={(event) => setForm({ ...form, group_name: event.target.value })}
                        placeholder={t.groupExample}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>{t.sku}</label>
                      <input
                        value={form.sku}
                        onChange={(event) => setForm({ ...form, sku: event.target.value })}
                        placeholder="SKU"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>{t.unit} *</label>
                      <select
                        value={form.purchase_unit}
                        onChange={(event) => setForm({ ...form, purchase_unit: event.target.value })}
                        className={inputClass}
                      >
                        {units.map((unit) => (
                          <option key={unit.code} value={unit.code}>
                            {isArabic ? unit.name_ar : unit.name_en || unit.name_ar}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>{t.quantity} *</label>
                      <input
                        required
                        type="number"
                        min="0.0001"
                        step="any"
                        value={form.purchase_quantity}
                        onChange={(event) => setForm({ ...form, purchase_quantity: event.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>{t.price} *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.purchase_price}
                        onChange={(event) => setForm({ ...form, purchase_price: event.target.value })}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>
                        {t.reorder} (
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
                        onChange={(event) => setForm({ ...form, reorder_level: event.target.value })}
                        placeholder={t.reorderHint}
                        className={inputClass}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{t.reorderNote}</p>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>{t.notes}</label>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      rows={2}
                      className={inputClass}
                      placeholder={t.optionalNotes}
                    />
                  </div>

                  <div className="rounded-lg bg-muted p-3 text-sm">{t.costInfo}</div>

                  {formMessage && (
                    <p className="rounded-lg bg-muted p-3 text-sm" role="status">{formMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={ingredientMutation.isPending}
                    className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
                  >
                    {ingredientMutation.isPending
                      ? t.saving
                      : editingIngredient
                        ? t.saveChanges
                        : t.addIngredient}
                  </button>
                </form>
              </section>
            )}

            <section className="rounded-xl border bg-card p-4">
              <h2 className="mb-4 text-lg font-bold">{t.movement}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className={labelClass}>{t.ingredient}</label>
                  <select
                    value={selectedIngredient}
                    onChange={(event) => setSelectedIngredient(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t.chooseIngredient}</option>
                    {activeIngredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{t.movementType}</label>
                  <select
                    value={direction}
                    onChange={(event) => setDirection(event.target.value as "add" | "remove")}
                    className={inputClass}
                  >
                    <option value="add">{t.addStock}</option>
                    <option value="remove">{t.removeStock}</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>
                    {t.amount} {selected ? `(${unitName(selected.base_unit)})` : ""}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={t.enterQuantity}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>{t.notes}</label>
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t.reason}
                    className={inputClass}
                  />
                </div>
              </div>

              {selected && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t.currentBalance}{" "}
                  <strong>{selectedBalance.toLocaleString(locale)}</strong>{" "}
                  {unitName(selected.base_unit)}
                </p>
              )}

              {message && (
                <p className="mt-3 rounded-lg bg-muted p-3 text-sm" role="status">{message}</p>
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
                {movementMutation.isPending ? t.saving : t.recordMovement}
              </button>
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b p-4">
                <h2 className="text-lg font-bold">{t.balances}</h2>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.search}
                  className={`mt-3 ${inputClass}`}
                />
              </div>

              {ingredientsLoading || stockLoading ? (
                <p className="p-6 text-center text-muted-foreground">{t.loading}</p>
              ) : filteredIngredients.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">{t.noResults}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.tableIngredient}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.tableKind}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.tableGroup}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.balance}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.threshold}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.unitCost}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.status}</th>
                        <th className={`p-3 ${isArabic ? "text-right" : "text-left"}`}>{t.actions}</th>
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
                              {ingredient.kind === "packaging" ? t.packagingShort : t.rawShort}
                            </td>
                            <td className="p-3 text-muted-foreground">{ingredient.group_name || "—"}</td>
                            <td className="p-3 font-semibold">
                              {balance.toLocaleString(locale)} {unitName(ingredient.base_unit)}
                            </td>
                            <td className="p-3">
                              {threshold == null ? "—" : Number(threshold).toLocaleString(locale)}
                            </td>
                            <td className="p-3">
                              {Number(ingredient.cost_per_base_unit).toLocaleString(locale, {
                                maximumFractionDigits: 5,
                              })}
                            </td>
                            <td className="p-3">
                              {!ingredient.is_active ? (
                                <span className="rounded-full bg-muted px-2 py-1 text-xs">{t.stopped}</span>
                              ) : isLow ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">{t.lowStock}</span>
                              ) : (
                                <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">{t.available}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditIngredient(ingredient)}
                                  className="rounded-lg border px-3 py-2 text-xs"
                                >
                                  {t.editButton}
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
                                  {ingredient.is_active ? t.deactivate : t.activate}
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
          </>
        )}
      </div>
    </ModulePage>
  );
}
