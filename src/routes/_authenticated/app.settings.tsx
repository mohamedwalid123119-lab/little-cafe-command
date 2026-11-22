
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — CAFE OS" },
      { name: "description", content: "إعدادات الكافيه والفروع والاشتراك." },
    ],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function money(value: number) {
  return `${Number(value || 0).toLocaleString("ar-EG")} ج.م`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "نشط",
    trialing: "فترة تجريبية",
    trial: "فترة تجريبية",
    past_due: "متأخر في السداد",
    cancelled: "ملغي",
    canceled: "ملغي",
    expired: "منتهي",
    suspended: "موقوف",
  };

  return labels[status] ?? status;
}

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) {
    return (
      <ModulePage module="settings">
        لا يوجد كافيه مرتبط بحسابك حتى الآن.
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
        throw new Error("اسم الكافيه يجب ألا يقل عن حرفين.");
      }

      if (!Number.isFinite(cost) || cost < 0 || cost > 100) {
        throw new Error("نسبة تكلفة الخامات يجب أن تكون بين 0 و100.");
      }

      if (!Number.isFinite(vatValue) || vatValue < 0 || vatValue > 100) {
        throw new Error("نسبة الضريبة يجب أن تكون بين 0 و100.");
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
      setMessage("تم حفظ إعدادات الكافيه بنجاح.");
      await refresh();
    },

    onError: (error: Error) => {
      setMessage(error.message || "تعذر حفظ الإعدادات.");
    },
  });

  const saveBranch = useMutation({
    mutationFn: async () => {
      const cleanName = branchName.trim();

      if (cleanName.length < 2) {
        throw new Error("اكتب اسم الفرع بشكل صحيح.");
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
        editingBranchId ? "تم تحديث بيانات الفرع." : "تمت إضافة الفرع.",
      );
      resetBranchForm();
      await refresh();
    },

    onError: (error: Error) => {
      setMessage(error.message || "تعذر حفظ الفرع.");
    },
  });

  const toggleBranch = useMutation({
    mutationFn: async (branch: (typeof branches)[number]) => {
      if (branch.is_main) {
        throw new Error("لا يمكن إيقاف الفرع الرئيسي.");
      }

      const { error } = await supabase
        .from("branches")
        .update({ is_active: !branch.is_active })
        .eq("id", branch.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },

    onSuccess: async () => {
      setMessage("تم تحديث حالة الفرع.");
      await refresh();
    },

    onError: (error: Error) => {
      setMessage(error.message || "تعذر تحديث حالة الفرع.");
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
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">إعدادات الكافيه</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          بيانات النشاط والفروع والتكلفة والضريبة والاشتراك.
        </p>
      </div>

      {message && (
        <p role="status" className="rounded-lg bg-muted p-3 text-sm">
          {message}
        </p>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 text-lg font-bold">بيانات الكافيه</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              اسم الكافيه
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
              رقم الهاتف
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
              المدينة
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
              العملة
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="EGP">الجنيه المصري EGP</option>
              <option value="SAR">الريال السعودي SAR</option>
              <option value="AED">الدرهم الإماراتي AED</option>
              <option value="USD">الدولار الأمريكي USD</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              المنطقة الزمنية
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="Africa/Cairo">القاهرة</option>
              <option value="Asia/Riyadh">الرياض</option>
              <option value="Asia/Dubai">دبي</option>
              <option value="UTC">UTC</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              لغة النظام
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="ar-EG">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 text-lg font-bold">إعدادات التكلفة والضريبة</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              نسبة تكلفة الخامات المستهدفة %
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
              تستخدم لمقارنة تكلفة الوصفات بالمبيعات.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              نسبة ضريبة القيمة المضافة %
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
            أسعار المنتجات تشمل الضريبة بالفعل
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
          {saveSettings.isPending ? "جارٍ الحفظ..." : "حفظ إعدادات الكافيه"}
        </button>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-4">
          <h3 className="text-lg font-bold">إدارة الفروع</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            إضافة الفروع وتعديل بياناتها وإيقافها أو تفعيلها.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              اسم الفرع
            </label>
            <input
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="اسم الفرع"
              maxLength={120}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              رقم الهاتف
            </label>
            <input
              value={branchPhone}
              onChange={(e) => setBranchPhone(e.target.value)}
              placeholder="رقم التواصل"
              maxLength={30}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-2 block text-sm font-medium">
              العنوان
            </label>
            <input
              value={branchAddress}
              onChange={(e) => setBranchAddress(e.target.value)}
              placeholder="عنوان الفرع"
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
              ? "جارٍ الحفظ..."
              : editingBranchId
                ? "حفظ تعديل الفرع"
                : "إضافة فرع"}
          </button>

          {editingBranchId && (
            <button
              type="button"
              onClick={resetBranchForm}
              className="rounded-lg border px-4 py-3"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        <div className="mt-5 space-y-3">
          {branches.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              لا توجد فروع مسجلة.
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
                        الفرع الرئيسي
                      </span>
                    )}

                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        branch.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {branch.is_active ? "نشط" : "متوقف"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {branch.phone || "لا يوجد هاتف"}
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
                    تعديل
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
                      {branch.is_active ? "إيقاف" : "تفعيل"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="text-lg font-bold">الاشتراك الحالي</h3>

        {!subscription ? (
          <p className="mt-3 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            لا يوجد اشتراك مسجل لهذا الكافيه حاليًا.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">الباقة</p>
              <p className="mt-1 font-semibold">
                {subscription.plan?.name_ar ?? "باقة غير محددة"}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">حالة الاشتراك</p>
              <p className="mt-1 font-semibold">
                {statusLabel(subscription.status)}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">السعر الشهري</p>
              <p className="mt-1 font-semibold">
                {money(Number(subscription.plan?.price_monthly_egp ?? 0))}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">نهاية الفترة</p>
              <p className="mt-1 font-semibold">
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString(
                      "ar-EG",
                    )
                  : subscription.trial_ends_at
                    ? new Date(subscription.trial_ends_at).toLocaleDateString(
                        "ar-EG",
                      )
                    : "غير محدد"}
              </p>
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          بيانات الاشتراك للعرض فقط. تغيير الباقة أو الدفع يحتاج إلى إجراء
          آمن من نظام الاشتراكات.
        </p>
      </section>
    </div>
  );
}
