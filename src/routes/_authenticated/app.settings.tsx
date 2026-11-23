
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CAFE OS" },
      { name: "description", content: "Cafe, branches and subscription settings." },
    ],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function money(value: number, language: "ar" | "en") {
  return `${Number(value || 0).toLocaleString(language === "ar" ? "ar-EG" : "en-US")} ${language === "ar" ? "ج.م" : "EGP"}`;
}

function statusLabel(status: string, language: "ar" | "en") {
  const labels = {
    ar: {
      active: "نشط",
      trialing: "فترة تجريبية",
      trial: "فترة تجريبية",
      past_due: "متأخر في السداد",
      cancelled: "ملغي",
      canceled: "ملغي",
      expired: "منتهي",
      suspended: "موقوف",
    },
    en: {
      active: "Active",
      trialing: "Trial",
      trial: "Trial",
      past_due: "Payment overdue",
      cancelled: "Cancelled",
      canceled: "Cancelled",
      expired: "Expired",
      suspended: "Suspended",
    },
  };

  return labels[language][status as keyof typeof labels.ar] ?? status;
}

function Page() {
  const { user } = authRoute.useRouteContext();
  const { language } = useAppPreferences();
  const isAr = language === "ar";

  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) {
    return (
      <ModulePage module="settings">
        {isAr
          ? "لا يوجد كافيه مرتبط بحسابك حتى الآن."
          : "No cafe is linked to your account yet."}
      </ModulePage>
    );
  }

  return (
    <ModulePage module="settings" wide>
      <Settings tenantId={membership.tenant_id} />
    </ModulePage>
  );
}

function Settings({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const { language } = useAppPreferences();
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const tr = (ar: string, en: string) => isAr ? ar : en;

  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));
  const { data: branches } = useSuspenseQuery(q.branches(tenantId));
  const { data: subscription } = useSuspenseQuery(q.subscription(tenantId));

  const [name, setName] = useState(tenant.name ?? "");
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [city, setCity] = useState(tenant.city ?? "");
  const [currency, setCurrency] = useState(tenant.currency ?? "EGP");
  const [timezone, setTimezone] = useState(
    tenant.timezone ?? "Africa/Cairo",
  );
  const [locale, setLocale] = useState(tenant.locale ?? "ar-EG");
  const [targetCost, setTargetCost] = useState(
    String(tenant.target_food_cost_percent ?? 30),
  );
  const [vat, setVat] = useState(String(tenant.vat_percent ?? 0));
  const [pricesIncludeVat, setPricesIncludeVat] = useState(
    Boolean(tenant.prices_include_vat),
  );

  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [editingBranchId, setEditingBranchId] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["branches", tenantId] }),
      queryClient.invalidateQueries({
        queryKey: ["subscription", tenantId],
      }),
    ]);
  };

  const saveSettings = useMutation({
    mutationFn: async () => {
      const cleanName = name.trim();
      const cost = Number(targetCost);
      const vatValue = Number(vat);

      if (cleanName.length < 2) {
        throw new Error(
          tr("اسم الكافيه يجب ألا يقل عن حرفين.", "Cafe name must be at least 2 characters."),
        );
      }

      if (!Number.isFinite(cost) || cost < 0 || cost > 100) {
        throw new Error(
          tr("نسبة تكلفة الخامات يجب أن تكون بين 0 و100.", "Target ingredient cost must be between 0 and 100."),
        );
      }

      if (!Number.isFinite(vatValue) || vatValue < 0 || vatValue > 100) {
        throw new Error(
          tr("نسبة الضريبة يجب أن تكون بين 0 و100.", "VAT rate must be between 0 and 100."),
        );
      }

      const { error } = await supabase
        .from("tenants")
        .update({
          name: cleanName,
          phone: phone.trim() || null,
          city: city.trim() || null,
          currency,
          timezone,
          locale,
          target_food_cost_percent: cost,
          vat_percent: vatValue,
          prices_include_vat: pricesIncludeVat,
        })
        .eq("id", tenantId);

      if (error) throw error;
    },

    onSuccess: async () => {
      setMessage(tr("تم حفظ إعدادات الكافيه بنجاح.", "Cafe settings saved successfully."));
      await refresh();
    },

    onError: (error: Error) => {
      setMessage(error.message || tr("تعذر حفظ الإعدادات.", "Could not save settings."));
    },
  });

  const saveBranch = useMutation({
    mutationFn: async () => {
      const cleanName = branchName.trim();

      if (cleanName.length < 2) {
        throw new Error(
          tr("اكتب اسم الفرع بشكل صحيح.", "Enter a valid branch name."),
        );
      }

      const payload = {
        name: cleanName,
        address: branchAddress.trim() || null,
        phone: branchPhone.trim() || null,
      };

      if (editingBranchId) {
        const { error } = await supabase
          .from("branches")
          .update(payload)
          .eq("id", editingBranchId)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert({
          tenant_id: tenantId,
          ...payload,
          is_main: false,
          is_active: true,
        });

        if (error) throw error;
      }
    },

    onSuccess: async () => {
      setMessage(
        editingBranchId
          ? tr("تم تحديث بيانات الفرع.", "Branch details updated.")
          : tr("تمت إضافة الفرع.", "Branch added successfully."),
      );
      resetBranchForm();
      await refresh();
    },

    onError: (error: Error) => {
      setMessage(error.message || tr("تعذر حفظ الفرع.", "Could not save branch."));
    },
  });

  const toggleBranch = useMutation({
    mutationFn: async (branch: (typeof branches)[number]) => {
      if (branch.is_main) {
        throw new Error(
          tr("لا يمكن إيقاف الفرع الرئيسي.", "The main branch cannot be deactivated."),
        );
      }

      const { error } = await supabase
        .from("branches")
        .update({ is_active: !branch.is_active })
        .eq("id", branch.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },

    onSuccess: async () => {
      setMessage(tr("تم تحديث حالة الفرع.", "Branch status updated."));
      await refresh();
    },

    onError: (error: Error) => {
      setMessage(error.message || tr("تعذر تحديث حالة الفرع.", "Could not update branch status."));
    },
  });

  function resetBranchForm() {
    setEditingBranchId("");
    setBranchName("");
    setBranchAddress("");
    setBranchPhone("");
  }

  function startEditBranch(branch: (typeof branches)[number]) {
    setEditingBranchId(branch.id);
    setBranchName(branch.name);
    setBranchAddress(branch.address ?? "");
    setBranchPhone(branch.phone ?? "");
    setMessage("");
  }

  return (
    <div dir={dir} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          {tr("إعدادات الكافيه", "Cafe Settings")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            "بيانات النشاط والفروع والتكلفة والضريبة والاشتراك.",
            "Business details, branches, costs, tax and subscription.",
          )}
        </p>
      </div>

      {message && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          {message}
        </p>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 text-lg font-bold">
          {tr("بيانات الكافيه", "Cafe Information")}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("اسم الكافيه", "Cafe Name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("رقم الهاتف", "Phone Number")}
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("المدينة", "City")}
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("العملة", "Currency")}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="EGP">{tr("الجنيه المصري EGP", "Egyptian Pound EGP")}</option>
              <option value="SAR">{tr("الريال السعودي SAR", "Saudi Riyal SAR")}</option>
              <option value="AED">{tr("الدرهم الإماراتي AED", "UAE Dirham AED")}</option>
              <option value="USD">{tr("الدولار الأمريكي USD", "US Dollar USD")}</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("المنطقة الزمنية", "Time Zone")}
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="Africa/Cairo">{tr("القاهرة", "Cairo")}</option>
              <option value="Asia/Riyadh">{tr("الرياض", "Riyadh")}</option>
              <option value="Asia/Dubai">{tr("دبي", "Dubai")}</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("لغة النظام", "System Locale")}
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="ar-EG">{tr("العربية", "Arabic")}</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 text-lg font-bold">
          {tr("إعدادات التكلفة والضريبة", "Cost & Tax Settings")}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("نسبة تكلفة الخامات المستهدفة %", "Target Ingredient Cost %")}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={targetCost}
              onChange={(e) => setTargetCost(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {tr(
                "تستخدم لمقارنة تكلفة الوصفات بالمبيعات.",
                "Used to compare recipe costs against sales.",
              )}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("نسبة ضريبة القيمة المضافة %", "VAT Rate %")}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 rounded-lg bg-muted/40 p-3">
          <input
            type="checkbox"
            checked={pricesIncludeVat}
            onChange={(e) => setPricesIncludeVat(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">
            {tr(
              "أسعار المنتجات تشمل الضريبة بالفعل",
              "Product prices already include VAT",
            )}
          </span>
        </label>

        <button
          type="button"
          disabled={saveSettings.isPending}
          onClick={() => {
            setMessage("");
            saveSettings.mutate();
          }}
          className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
        >
          {saveSettings.isPending
            ? tr("جارٍ الحفظ...", "Saving...")
            : tr("حفظ إعدادات الكافيه", "Save Cafe Settings")}
        </button>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-4">
          <h3 className="text-lg font-bold">
            {tr("إدارة الفروع", "Branch Management")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "إضافة الفروع وتعديل بياناتها وإيقافها أو تفعيلها.",
              "Add branches, edit their details, and activate or deactivate them.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("اسم الفرع", "Branch Name")}
            </label>
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder={tr("اسم الفرع", "Branch Name")}
              maxLength={120}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {tr("رقم الهاتف", "Phone Number")}
            </label>
            <input
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              placeholder={tr("رقم التواصل", "Contact Number")}
              maxLength={30}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              {tr("العنوان", "Address")}
            </label>
            <input
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder={tr("عنوان الفرع", "Branch Address")}
              maxLength={300}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saveBranch.isPending || !branchName.trim()}
            onClick={() => {
              setMessage("");
              saveBranch.mutate();
            }}
            className="rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saveBranch.isPending
              ? tr("جارٍ الحفظ...", "Saving...")
              : editingBranchId
                ? tr("حفظ تعديل الفرع", "Save Branch Changes")
                : tr("إضافة فرع", "Add Branch")}
          </button>

          {editingBranchId && (
            <button
              type="button"
              onClick={resetBranchForm}
              className="rounded-lg border px-4 py-3"
            >
              {tr("إلغاء التعديل", "Cancel Editing")}
            </button>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {branches.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              {tr("لا توجد فروع مسجلة.", "No branches registered.")}
            </p>
          ) : (
            branches.map((branch) => (
              <div
                key={branch.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{branch.name}</strong>

                    {branch.is_main && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        {tr("الفرع الرئيسي", "Main Branch")}
                      </span>
                    )}

                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        branch.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {branch.is_active
                        ? tr("نشط", "Active")
                        : tr("متوقف", "Inactive")}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {branch.phone || tr("لا يوجد هاتف", "No phone number")}
                  </p>

                  {branch.address && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {branch.address}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEditBranch(branch)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    {tr("تعديل", "Edit")}
                  </button>

                  {!branch.is_main && (
                    <button
                      type="button"
                      disabled={toggleBranch.isPending}
                      onClick={() => {
                        setMessage("");
                        toggleBranch.mutate(branch);
                      }}
                      className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {branch.is_active
                        ? tr("إيقاف", "Deactivate")
                        : tr("تفعيل", "Activate")}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-bold">
          {tr("الاشتراك الحالي", "Current Subscription")}
        </h3>

        {!subscription ? (
          <p className="mt-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            {tr(
              "لا يوجد اشتراك مسجل لهذا الكافيه حاليًا.",
              "There is no subscription registered for this cafe.",
            )}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                {tr("الباقة", "Plan")}
              </p>
              <p className="mt-1 font-semibold">
                {isAr
                  ? subscription.plan?.name_ar ?? "باقة غير محددة"
                  : subscription.plan?.name_en ?? subscription.plan?.name_ar ?? "Unknown Plan"}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                {tr("حالة الاشتراك", "Subscription Status")}
              </p>
              <p className="mt-1 font-semibold">
                {statusLabel(subscription.status, language)}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                {tr("السعر الشهري", "Monthly Price")}
              </p>
              <p className="mt-1 font-semibold">
                {money(Number(subscription.plan?.price_monthly_egp ?? 0), language)}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                {tr("نهاية الفترة", "Period End")}
              </p>
              <p className="mt-1 font-semibold">
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString(
                      isAr ? "ar-EG" : "en-US",
                    )
                  : subscription.trial_ends_at
                    ? new Date(subscription.trial_ends_at).toLocaleDateString(
                        isAr ? "ar-EG" : "en-US",
                      )
                    : tr("غير محدد", "Not specified")}
              </p>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {tr(
            "بيانات الاشتراك للعرض فقط. تغيير الباقة أو الدفع يحتاج إلى إجراء آمن من نظام الاشتراكات.",
            "Subscription details are view-only. Plan changes and payments must be handled securely by the subscription system.",
          )}
        </p>
      </section>
    </div>
  );
}
