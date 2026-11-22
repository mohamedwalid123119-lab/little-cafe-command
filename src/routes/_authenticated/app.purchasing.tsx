
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/purchasing")({
  head: () => ({ meta: [{ title: "المشتريات — CAFE OS" }] }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function Page() {
  const { user } = authRoute.useRouteContext();
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

  const unitName = (code: string) =>
    units.find((u) => u.code === code)?.name_ar ?? code;

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
      if (!branchId) throw new Error("اختار الفرع أولاً");

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
      setMessage("تم إنشاء الفاتورة. أضف الخامات إليها.");
      await queryClient.invalidateQueries({ queryKey: ["purchases", tenantId] });
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPurchase || selectedPurchase.status !== "draft")
        throw new Error("اختار فاتورة مسودة أولاً");

      if (!selectedIngredient) throw new Error("اختار الخامة");

      const amount = Number(quantity);
      const price = Number(totalPrice);

      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("اكتب كمية صحيحة أكبر من صفر");

      if (!Number.isFinite(price) || price < 0)
        throw new Error("اكتب إجمالي سعر صحيح");

      const selectedUnit = units.find((u) => u.code === unit);
      const baseUnit = units.find((u) => u.code === selectedIngredient.base_unit);

      if (!selectedUnit || !baseUnit || selectedUnit.dimension !== baseUnit.dimension)
        throw new Error("وحدة الشراء لا تتوافق مع وحدة الخامة");

      const rawBaseQuantity =
        (amount * Number(selectedUnit.factor_to_base)) /
        Number(baseUnit.factor_to_base);

      const baseQuantity = Number(rawBaseQuantity.toFixed(3));

      if (!Number.isFinite(baseQuantity) || baseQuantity <= 0)
        throw new Error("تعذر تحويل الكمية لوحدة المخزون الأساسية");

      // تكلفة وحدة المخزون لأغراض FIFO، منفصلة عن إجمالي الفاتورة الفعلي.
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
      setMessage("تمت إضافة الخامة للفاتورة");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPurchase || selectedPurchase.status !== "draft")
        throw new Error("الفاتورة ليست مسودة");

      if (purchaseItems.length === 0)
        throw new Error("أضف خامة واحدة على الأقل قبل الاستلام");

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
          "لم يتم استلام الفاتورة. تحقق من صلاحياتك أو حدّث الصفحة لأن حالة الفاتورة ربما تغيرت."
        );
      }
    },
    onSuccess: async () => {
      setMessage("تم استلام الفاتورة وتسجيل الكميات في المخزون");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const draftCount = purchases.filter((p) => p.status === "draft").length;
  const receivedCount = purchases.filter((p) => p.status === "received").length;

  return (
    <ModulePage module="purchasing" wide>
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">كل الفواتير</p>
            <p className="mt-2 text-2xl font-bold">{purchases.length}</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">فواتير مسودة</p>
            <p className="mt-2 text-2xl font-bold">{draftCount}</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">فواتير مستلمة</p>
            <p className="mt-2 text-2xl font-bold">{receivedCount}</p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 text-lg font-bold">إنشاء فاتورة شراء جديدة</h2>

          {!membership?.branch_id && branches.length > 1 && (
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium">الفرع</label>
              <select
                value={branchId}
                onChange={(e) => setBranchChoice(e.target.value)}
                className="w-full rounded-lg border bg-background p-3"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">المورد</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border bg-background p-3"
              >
                <option value="">بدون مورد محدد</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">رقم الفاتورة</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="رقم فاتورة المورد"
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">ملاحظات</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية"
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!branchId || createMutation.isPending}
            onClick={() => {
              setMessage("");
              createMutation.mutate();
            }}
            className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء فاتورة"}
          </button>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.5fr]">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-bold">سجل الفواتير</h2>

            {isLoading ? (
              <p className="p-4 text-center text-muted-foreground">جارٍ التحميل...</p>
            ) : purchases.length === 0 ? (
              <p className="p-4 text-center text-muted-foreground">
                لا توجد فواتير حتى الآن.
              </p>
            ) : (
              <div className="space-y-2">
                {purchases.map((purchase) => (
                  <button
                    key={purchase.id}
                    type="button"
                    onClick={() => {
                      setSelectedPurchaseId(purchase.id);
                      setMessage("");
                    }}
                    className={`w-full rounded-lg border p-3 text-right ${
                      selectedPurchaseId === purchase.id
                        ? "border-primary bg-primary/5"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{purchase.reference_number || "فاتورة بدون رقم"}</strong>

                      <span className="text-xs text-muted-foreground">
                        {purchase.status === "draft" ? "مسودة" :
                          purchase.status === "received" ? "مستلمة" : "ملغاة"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {purchase.supplier?.name || "بدون مورد"} · {purchase.branch?.name || ""}
                    </p>

                    <p className="mt-1 font-semibold">
                      {Number(purchase.total_amount).toLocaleString("ar-EG")} ج.م
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4">
            {!selectedPurchase ? (
              <p className="py-12 text-center text-muted-foreground">
                اختار فاتورة من السجل لعرض تفاصيلها.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      {selectedPurchase.reference_number || "فاتورة شراء"}
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedPurchase.supplier?.name || "بدون مورد"}
                    </p>
                  </div>

                  <span className="rounded-full bg-muted px-3 py-1 text-sm">
                    {selectedPurchase.status === "draft" ? "مسودة" :
                      selectedPurchase.status === "received" ? "مستلمة" : "ملغاة"}
                  </span>
                </div>

                {selectedPurchase.status === "draft" && (
                  <div className="my-5 rounded-lg border p-3">
                    <h3 className="mb-3 font-semibold">إضافة خامة للفاتورة</h3>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium">الخامة</label>

                        <select
                          value={ingredientId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setIngredientId(id);
                            const item = ingredients.find((i) => i.id === id);
                            if (item) setUnit(item.purchase_unit || item.base_unit);
                          }}
                          className="w-full rounded-lg border bg-background p-3"
                        >
                          <option value="">اختار الخامة</option>
                          {ingredients.filter((i) => i.is_active).map((i) => (
                            <option key={i.id} value={i.id}>{i.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">الكمية المشتراة</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="مثال: 2"
                          className="w-full rounded-lg border bg-background p-3"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium">وحدة الشراء</label>
                        <select
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full rounded-lg border bg-background p-3"
                        >
                          {compatibleUnits.map((u) => (
                            <option key={u.code} value={u.code}>{u.name_ar}</option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-medium">
                          إجمالي سعر الكمية بالجنيه
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalPrice}
                          onChange={(e) => setTotalPrice(e.target.value)}
                          placeholder="مثال: 720"
                          className="w-full rounded-lg border bg-background p-3"
                        />
                      </div>
                    </div>

                    {selectedIngredient && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        وحدة المخزون الأساسية: {unitName(selectedIngredient.base_unit)}
                      </p>
                    )}

                    <button
                      type="button"
                      disabled={!ingredientId || !quantity || totalPrice === "" || addItemMutation.isPending}
                      onClick={() => {
                        setMessage("");
                        addItemMutation.mutate();
                      }}
                      className="mt-3 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {addItemMutation.isPending ? "جارٍ الإضافة..." : "إضافة الخامة"}
                    </button>
                  </div>
                )}

                <h3 className="mb-3 font-semibold">أصناف الفاتورة</h3>

                {itemsLoading ? (
                  <p className="p-4 text-center text-muted-foreground">
                    جارٍ تحميل الأصناف...
                  </p>
                ) : purchaseItems.length === 0 ? (
                  <p className="rounded-lg bg-muted p-4 text-center text-muted-foreground">
                    لم تتم إضافة خامات لهذه الفاتورة.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {purchaseItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div>
                          <strong>{item.ingredient?.name || "خامة"}</strong>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {Number(item.quantity).toLocaleString("ar-EG")}{" "}
                            {unitName(item.ingredient?.base_unit || "")}
                          </p>
                        </div>

                        <strong>
                          {Number(
                            (item as typeof item & { purchase_total?: number | null }).purchase_total
                              ?? item.line_total
                              ?? 0
                          ).toLocaleString("ar-EG")} ج.م
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between rounded-lg bg-muted p-4">
                  <strong>إجمالي الفاتورة</strong>
                  <strong className="text-lg">
                    {Number(selectedPurchase.total_amount).toLocaleString("ar-EG")} ج.م
                  </strong>
                </div>

                {selectedPurchase.status === "draft" && (
                  <button
                    type="button"
                    disabled={purchaseItems.length === 0 || receiveMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          "تأكيد استلام الفاتورة؟ سيتم إضافة الكميات للمخزون ولا يمكن تعديل الفاتورة بعدها."
                        )
                      ) {
                        setMessage("");
                        receiveMutation.mutate();
                      }
                    }}
                    className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {receiveMutation.isPending ? "جارٍ الاستلام..." : "تأكيد استلام الفاتورة"}
                  </button>
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
