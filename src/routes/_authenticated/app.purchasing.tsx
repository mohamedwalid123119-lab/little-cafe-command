
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/purchasing")({
  head: () => ({ meta: [{ title: "المشتريات — CAFE OS" }] }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function Page() {
  const { user } = authRoute.useRouteContext();
  const { language } = useAppPreferences();
  const en = language === "en";
  const t = (ar: string, english: string) => en ? english : ar;
  const direction = en ? "ltr" : "rtl";
  const numberLocale = en ? "en-US" : "ar-EG";

  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  const tenantId = membership?.tenant_id ?? "";
  const queryClient = useQueryClient();

  const { data: branches = [] } = useQuery({
    ...q.branches(tenantId),
    enabled: Boolean(tenantId),
  });
  const { data: ingredients = [] } = useQuery({
    ...q.ingredients(tenantId),
    enabled: Boolean(tenantId),
  });
  const { data: units = [] } = useQuery(q.units());

  const { data: suppliers = [] } = useQuery({
    queryKey: ["purchasing-suppliers", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [branchChoice, setBranchChoice] = useState("");
  const branchId =
    membership?.branch_id ||
    branchChoice ||
    branches.find((b) => b.is_main)?.id ||
    branches[0]?.id ||
    "";

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchases", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*, supplier:suppliers(name), branch:branches(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [totalPrice, setTotalPrice] = useState("");
  const [message, setMessage] = useState("");

  const selectedPurchase = purchases.find((p) => p.id === selectedPurchaseId);

  const { data: purchaseItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["purchase-items", selectedPurchaseId],
    enabled: Boolean(selectedPurchaseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("*, ingredient:ingredients(name, base_unit)")
        .eq("purchase_id", selectedPurchaseId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedIngredient = ingredients.find((i) => i.id === ingredientId);

  const compatibleUnits = useMemo(() => {
    if (!selectedIngredient) return [];
    const base = units.find((u) => u.code === selectedIngredient.base_unit);
    return units.filter((u) => base && u.dimension === base.dimension);
  }, [selectedIngredient, units]);

  const unitName = (code: string) => {
    const found = units.find((u) => u.code === code);
    return found ? (en ? found.name_en || found.name_ar : found.name_ar) : code;
  };

  const statusName = (status: string) =>
    status === "draft"
      ? t("مسودة", "Draft")
      : status === "received"
        ? t("مستلمة", "Received")
        : t("ملغاة", "Cancelled");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["purchases", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["purchase-items", selectedPurchaseId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-stock"] }),
      queryClient.invalidateQueries({ queryKey: ["ingredients", tenantId] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error(t("اختار الفرع أولاً", "Select a branch first"));

      const { data, error } = await supabase
        .from("purchases")
        .insert({
          tenant_id: tenantId,
          branch_id: branchId,
          supplier_id: supplierId || null,
          reference_number: reference.trim() || null,
          notes: notes.trim() || null,
          status: "draft",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: async (id) => {
      setSelectedPurchaseId(id);
      setReference("");
      setNotes("");
      setMessage(t("تم إنشاء الفاتورة. أضف الخامات إليها.", "Invoice created. Add ingredients to it."));
      await queryClient.invalidateQueries({ queryKey: ["purchases", tenantId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPurchase || selectedPurchase.status !== "draft")
        throw new Error(t("اختار فاتورة مسودة أولاً", "Select a draft invoice first"));

      if (!selectedIngredient) throw new Error(t("اختار الخامة", "Select an ingredient"));

      const amount = Number(quantity);
      const price = Number(totalPrice);

      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error(t("اكتب كمية صحيحة أكبر من صفر", "Enter a valid quantity greater than zero"));

      if (!Number.isFinite(price) || price < 0)
        throw new Error(t("اكتب إجمالي سعر صحيح", "Enter a valid total price"));

      const selectedUnit = units.find((u) => u.code === unit);
      const baseUnit = units.find((u) => u.code === selectedIngredient.base_unit);

      if (!selectedUnit || !baseUnit || selectedUnit.dimension !== baseUnit.dimension)
        throw new Error(t("وحدة الشراء لا تتوافق مع وحدة الخامة", "Purchase unit is incompatible with the ingredient unit"));

      const rawBaseQuantity =
        (amount * Number(selectedUnit.factor_to_base)) /
        Number(baseUnit.factor_to_base);

      const baseQuantity = Number(rawBaseQuantity.toFixed(3));

      if (!Number.isFinite(baseQuantity) || baseQuantity <= 0)
        throw new Error(t("تعذر تحويل الكمية لوحدة المخزون الأساسية", "Could not convert quantity to the base inventory unit"));

      const costPerBaseUnit = price / baseQuantity;

      const item = {
        tenant_id: tenantId,
        purchase_id: selectedPurchase.id,
        ingredient_id: selectedIngredient.id,
        quantity: baseQuantity,
        unit_cost: Number(costPerBaseUnit.toFixed(4)),
        purchase_total: Number(price.toFixed(2)),
      };

      const { error } = await supabase
        .from("purchase_items")
        .insert(item as never);

      if (error) throw error;
    },
    onSuccess: async () => {
      setQuantity("");
      setTotalPrice("");
      setMessage(t("تمت إضافة الخامة للفاتورة", "Ingredient added to invoice"));
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPurchase || selectedPurchase.status !== "draft")
        throw new Error(t("الفاتورة ليست مسودة", "Invoice is not a draft"));

      if (purchaseItems.length === 0)
        throw new Error(t("أضف خامة واحدة على الأقل قبل الاستلام", "Add at least one ingredient before receiving"));

      const { data, error } = await supabase
        .from("purchases")
        .update({ status: "received" })
        .eq("id", selectedPurchase.id)
        .eq("tenant_id", tenantId)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error(
          t(
            "لم يتم استلام الفاتورة. تحقق من صلاحياتك أو حدّث الصفحة لأن حالة الفاتورة ربما تغيرت.",
            "Invoice was not received. Check your permissions or refresh the page; its status may have changed.",
          ),
        );
      }
    },
    onSuccess: async () => {
      setMessage(t("تم استلام الفاتورة وتسجيل الكميات في المخزون", "Invoice received and quantities added to inventory"));
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const draftCount = purchases.filter((p) => p.status === "draft").length;
  const receivedCount = purchases.filter((p) => p.status === "received").length;

  return (
    <ModulePage module="purchasing" wide>
      <div className="space-y-6" dir={direction}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("كل الفواتير", "All invoices")}</p>
            <p className="mt-2 text-2xl font-bold">{purchases.length}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("فواتير مسودة", "Draft invoices")}</p>
            <p className="mt-2 text-2xl font-bold">{draftCount}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{t("فواتير مستلمة", "Received invoices")}</p>
            <p className="mt-2 text-2xl font-bold">{receivedCount}</p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 text-lg font-bold">{t("إنشاء فاتورة شراء جديدة", "Create New Purchase Invoice")}</h2>

          {!membership?.branch_id && branches.length > 1 && (
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium">{t("الفرع", "Branch")}</label>
              <select value={branchId} onChange={(e) => setBranchChoice(e.target.value)} className="w-full rounded-lg border bg-background p-3">
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">{t("المورد", "Supplier")}</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-lg border bg-background p-3">
                <option value="">{t("بدون مورد محدد", "No specific supplier")}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">{t("رقم الفاتورة", "Invoice Number")}</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("رقم فاتورة المورد", "Supplier invoice number")} className="w-full rounded-lg border bg-background p-3" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">{t("ملاحظات", "Notes")}</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ملاحظات اختيارية", "Optional notes")} className="w-full rounded-lg border bg-background p-3" />
            </div>
          </div>

          <button type="button" disabled={!branchId || createMutation.isPending} onClick={() => { setMessage(""); createMutation.mutate(); }} className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto">
            {createMutation.isPending ? t("جارٍ الإنشاء...", "Creating...") : t("إنشاء فاتورة", "Create Invoice")}
          </button>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.5fr]">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-bold">{t("سجل الفواتير", "Invoice History")}</h2>

            {isLoading ? (
              <p className="p-4 text-center text-muted-foreground">{t("جارٍ التحميل...", "Loading...")}</p>
            ) : purchases.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">{t("لا توجد فواتير حتى الآن.", "No invoices yet.")}</p>
            ) : (
              <div className="space-y-2">
                {purchases.map((purchase) => (
                  <button key={purchase.id} type="button" onClick={() => { setSelectedPurchaseId(purchase.id); setMessage(""); }} className={`w-full rounded-lg border p-3 text-start ${selectedPurchaseId === purchase.id ? "border-primary bg-primary/5" : "bg-background"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <strong>{purchase.reference_number || t("فاتورة بدون رقم", "Unnumbered invoice")}</strong>
                      <span className="text-xs text-muted-foreground">{statusName(purchase.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {purchase.supplier?.name || t("بدون مورد", "No supplier")} · {purchase.branch?.name || ""}
                    </p>
                    <p className="mt-1 font-semibold">
                      {Number(purchase.total_amount).toLocaleString(numberLocale)} {t("ج.م", "EGP")}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            {!selectedPurchase ? (
              <p className="py-12 text-center text-muted-foreground">{t("اختار فاتورة من السجل لعرض تفاصيلها.", "Select an invoice from the history to view its details.")}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{selectedPurchase.reference_number || t("فاتورة شراء", "Purchase Invoice")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedPurchase.supplier?.name || t("بدون مورد", "No supplier")}</p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-sm">{statusName(selectedPurchase.status)}</span>
                </div>

                {selectedPurchase.status === "draft" && (
                  <div className="my-5 rounded-lg border p-3">
                    <h3 className="mb-3 font-semibold">{t("إضافة خامة للفاتورة", "Add Ingredient to Invoice")}</h3>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium">{t("الخامة", "Ingredient")}</label>
                        <select value={ingredientId} onChange={(e) => {
                          const id = e.target.value;
                          setIngredientId(id);
                          const item = ingredients.find((i) => i.id === id);
                          if (item) setUnit(item.purchase_unit || item.base_unit);
                        }} className="w-full rounded-lg border bg-background p-3">
                          <option value="">{t("اختار الخامة", "Select ingredient")}</option>
                          {ingredients.filter((i) => i.is_active).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">{t("الكمية المشتراة", "Purchased Quantity")}</label>
                        <input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t("مثال: 2", "Example: 2")} className="w-full rounded-lg border bg-background p-3" />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">{t("وحدة الشراء", "Purchase Unit")}</label>
                        <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-lg border bg-background p-3">
                          {compatibleUnits.map((u) => <option key={u.code} value={u.code}>{unitName(u.code)}</option>)}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium">{t("إجمالي سعر الكمية بالجنيه", "Total Quantity Price (EGP)")}</label>
                        <input type="number" min="0" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} placeholder="720" className="w-full rounded-lg border bg-background p-3" />
                      </div>
                    </div>

                    {selectedIngredient && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {t("وحدة المخزون الأساسية:", "Base inventory unit:")} {unitName(selectedIngredient.base_unit)}
                      </p>
                    )}

                    <button type="button" disabled={!ingredientId || !quantity || totalPrice === "" || addItemMutation.isPending} onClick={() => { setMessage(""); addItemMutation.mutate(); }} className="mt-3 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50">
                      {addItemMutation.isPending ? t("جارٍ الإضافة...", "Adding...") : t("إضافة الخامة", "Add Ingredient")}
                    </button>
                  </div>
                )}

                <h3 className="mb-3 font-semibold">{t("أصناف الفاتورة", "Invoice Items")}</h3>

                {itemsLoading ? (
                  <p className="p-4 text-center text-muted-foreground">{t("جارٍ تحميل الأصناف...", "Loading items...")}</p>
                ) : purchaseItems.length === 0 ? (
                  <p className="rounded-lg bg-muted p-4 text-center text-muted-foreground">{t("لم تتم إضافة خامات لهذه الفاتورة.", "No ingredients have been added to this invoice.")}</p>
                ) : (
                  <div className="space-y-2">
                    {purchaseItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <strong>{item.ingredient?.name || t("خامة", "Ingredient")}</strong>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {Number(item.quantity).toLocaleString(numberLocale)} {unitName(item.ingredient?.base_unit || "")}
                          </p>
                        </div>
                        <strong>
                          {Number((item as typeof item & { purchase_total?: number | null }).purchase_total ?? item.line_total ?? 0).toLocaleString(numberLocale)} {t("ج.م", "EGP")}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-4">
                  <strong>{t("إجمالي الفاتورة", "Invoice Total")}</strong>
                  <strong className="text-lg">
                    {Number(selectedPurchase.total_amount).toLocaleString(numberLocale)} {t("ج.م", "EGP")}
                  </strong>
                </div>

                {selectedPurchase.status === "draft" && (
                  <button type="button" disabled={purchaseItems.length === 0 || receiveMutation.isPending} onClick={() => {
                    if (window.confirm(t(
                      "تأكيد استلام الفاتورة؟ سيتم إضافة الكميات للمخزون ولا يمكن تعديل الفاتورة بعدها.",
                      "Confirm receiving this invoice? Quantities will be added to inventory and the invoice can no longer be edited.",
                    ))) {
                      setMessage("");
                      receiveMutation.mutate();
                    }
                  }} className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50">
                    {receiveMutation.isPending ? t("جارٍ الاستلام...", "Receiving...") : t("تأكيد استلام الفاتورة", "Confirm Invoice Receipt")}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
      </div>
    </ModulePage>
  );
}
