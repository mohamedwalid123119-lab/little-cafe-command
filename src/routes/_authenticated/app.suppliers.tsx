
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/suppliers")({
  head: () => ({
    meta: [{ title: "Suppliers — CAFE OS" }],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function Page() {
  const { user } = authRoute.useRouteContext();
  const { language } = useAppPreferences();
  const isAr = language === "ar";
  const tr = (ar: string, en: string) => isAr ? ar : en;

  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const tenantId = memberships[0]?.tenant_id ?? "";

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
  });

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const resetForm = () => {
    setEditingId("");
    setName("");
    setPhone("");
    setAddress("");
    setNotes("");
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["suppliers", tenantId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["purchasing-suppliers", tenantId],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error(tr("لا يوجد كافيه مرتبط بالحساب", "No cafe is linked to this account."));
      }

      if (name.trim().length < 2) {
        throw new Error(tr("اكتب اسم المورد بشكل صحيح", "Enter a valid supplier name."));
      }

      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("suppliers")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", tenantId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert({
            tenant_id: tenantId,
            ...payload,
          });

        if (error) throw error;
      }
    },
    onSuccess: async () => {
      setMessage(
        editingId
          ? tr("تم تعديل بيانات المورد", "Supplier details updated.")
          : tr("تمت إضافة المورد", "Supplier added successfully."),
      );
      resetForm();
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      if (!tenantId) {
        throw new Error(tr("لا يوجد كافيه مرتبط بالحساب", "No cafe is linked to this account."));
      }

      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage(tr("تم حذف المورد", "Supplier deleted."));
      if (editingId) resetForm();
      await refresh();
    },
    onError: (error: Error) => {
      setMessage(
        error.message.includes("foreign key")
          ? tr(
              "لا يمكن حذف المورد لأنه مرتبط بفاتورة شراء. يمكنك تعديل بياناته بدلًا من حذفه.",
              "This supplier is linked to a purchase invoice and cannot be deleted. You can edit its details instead.",
            )
          : error.message,
      );
    },
  });

  if (!tenantId) {
    return (
      <ModulePage module="suppliers">
        {tr(
          "لا يوجد كافيه مرتبط بحسابك حتى الآن.",
          "No cafe is linked to your account yet.",
        )}
      </ModulePage>
    );
  }

  const filteredSuppliers = suppliers.filter((supplier) =>
    `${supplier.name} ${supplier.phone ?? ""} ${supplier.address ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  const startEdit = (supplier: (typeof suppliers)[number]) => {
    setEditingId(supplier.id);
    setName(supplier.name);
    setPhone(supplier.phone ?? "");
    setAddress(supplier.address ?? "");
    setNotes(supplier.notes ?? "");
    setMessage("");
  };

  return (
    <ModulePage module="suppliers" wide>
      <div dir={isAr ? "rtl" : "ltr"} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              {tr("دليل الموردين", "Suppliers Directory")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                "احفظ بيانات الموردين وأرقام التواصل والعناوين في مكان واحد.",
                "Keep supplier details, contact numbers and addresses in one place.",
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {tr("إجمالي الموردين", "Total Suppliers")}
            </span>
            <p className="text-2xl font-bold">{suppliers.length}</p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-4 text-lg font-bold">
            {editingId
              ? tr("تعديل بيانات المورد", "Edit Supplier")
              : tr("إضافة مورد جديد", "Add New Supplier")}
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {tr("اسم المورد *", "Supplier Name *")}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr("اسم المورد أو الشركة", "Supplier or company name")}
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
                placeholder={tr("رقم التواصل", "Contact number")}
                maxLength={30}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                {tr("العنوان", "Address")}
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={tr("عنوان المورد بالتفصيل", "Supplier full address")}
                maxLength={300}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                {tr("ملاحظات إضافية (اختياري)", "Additional Notes (Optional)")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={tr("أي معلومات إضافية عن المورد", "Additional supplier information")}
                maxLength={500}
                rows={2}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!name.trim() || saveMutation.isPending}
              onClick={() => {
                setMessage("");
                saveMutation.mutate();
              }}
              className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saveMutation.isPending
                ? tr("جارٍ الحفظ...", "Saving...")
                : editingId
                  ? tr("حفظ التعديلات", "Save Changes")
                  : tr("إضافة المورد", "Add Supplier")}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-5 py-3"
              >
                {tr("إلغاء", "Cancel")}
              </button>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-4">
            <h3 className="font-bold">
              {tr("قائمة الموردين", "Suppliers List")}
            </h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr(
                "ابحث باسم المورد أو الهاتف أو العنوان...",
                "Search by supplier name, phone or address...",
              )}
              className="mt-3 w-full rounded-lg border bg-background p-3"
            />
          </div>

          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">
              {tr("جارٍ تحميل الموردين...", "Loading suppliers...")}
            </p>
          ) : filteredSuppliers.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              {tr(
                "لا يوجد موردون مسجلون أو لا توجد نتائج مطابقة.",
                "No suppliers registered or no matching results.",
              )}
            </p>
          ) : (
            <div className="divide-y">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <h4 className="font-bold">{supplier.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {tr("الهاتف:", "Phone:")}{" "}
                      {supplier.phone || tr("غير مسجل", "Not registered")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {tr("العنوان:", "Address:")}{" "}
                      {supplier.address || tr("غير مسجل", "Not registered")}
                    </p>
                    {supplier.notes && (
                      <p className="text-sm text-muted-foreground">
                        {tr("ملاحظات:", "Notes:")} {supplier.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(supplier)}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      {tr("تعديل", "Edit")}
                    </button>

                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            tr(
                              `هل أنت متأكد من حذف المورد ${supplier.name}؟`,
                              `Are you sure you want to delete supplier ${supplier.name}?`,
                            )
                          )
                        ) {
                          setMessage("");
                          deleteMutation.mutate(supplier.id);
                        }
                      }}
                      className="rounded-lg border border-destructive px-4 py-2 text-sm text-destructive disabled:opacity-50"
                    >
                      {tr("حذف", "Delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {message && (
          <p role="status" className="rounded-lg bg-muted p-3 text-sm">
            {message}
          </p>
        )}
      </div>
    </ModulePage>
  );
}
