
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

export const Route = createFileRoute("/_authenticated/app/suppliers")({
  head: () => ({
    meta: [{ title: "دليل الموردين — CAFE OS" }],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

function Page() {
  const { user } = authRoute.useRouteContext();
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
      if (!tenantId) throw new Error("لا يوجد كافيه مرتبط بالحساب");

      if (name.trim().length < 2) {
        throw new Error("اكتب اسم المورد بشكل صحيح");
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
      setMessage(editingId ? "تم تعديل بيانات المورد" : "تمت إضافة المورد");
      resetForm();
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      if (!tenantId) throw new Error("لا يوجد كافيه مرتبط بالحساب");

      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage("تم حذف المورد");
      if (editingId) resetForm();
      await refresh();
    },
    onError: (error: Error) => {
      setMessage(
        error.message.includes("foreign key")
          ? "لا يمكن حذف المورد لأنه مرتبط بفاتورة شراء. يمكنك تعديل بياناته بدلًا من حذفه."
          : error.message,
      );
    },
  });

  if (!tenantId) {
    return (
      <ModulePage module="suppliers">
        لا يوجد كافيه مرتبط بحسابك حتى الآن.
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
      <div dir="rtl" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">دليل الموردين</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              احفظ بيانات الموردين وأرقام التواصل والعناوين في مكان واحد.
            </p>
          </div>

          <div className="rounded-xl border bg-card px-4 py-3">
            <span className="text-sm text-muted-foreground">
              إجمالي الموردين
            </span>
            <p className="text-2xl font-bold">{suppliers.length}</p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-4 text-lg font-bold">
            {editingId ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                اسم المورد *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم المورد أو الشركة"
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
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="عنوان المورد بالتفصيل"
                maxLength={300}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                ملاحظات إضافية (اختياري)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي معلومات إضافية عن المورد"
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
                ? "جارٍ الحفظ..."
                : editingId
                  ? "حفظ التعديلات"
                  : "إضافة المورد"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-5 py-3"
              >
                إلغاء
              </button>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-4">
            <h3 className="font-bold">قائمة الموردين</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المورد أو الهاتف أو العنوان..."
              className="mt-3 w-full rounded-lg border bg-background p-3"
            />
          </div>

          {isLoading ? (
            <p className="p-8 text-center text-muted-foreground">
              جارٍ تحميل الموردين...
            </p>
          ) : filteredSuppliers.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              لا يوجد موردون مسجلون أو لا توجد نتائج مطابقة.
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
                      الهاتف: {supplier.phone || "غير مسجل"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      العنوان: {supplier.address || "غير مسجل"}
                    </p>
                    {supplier.notes && (
                      <p className="text-sm text-muted-foreground">
                        ملاحظات: {supplier.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(supplier)}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `هل أنت متأكد من حذف المورد ${supplier.name}؟`,
                          )
                        ) {
                          setMessage("");
                          deleteMutation.mutate(supplier.id);
                        }
                      }}
                      className="rounded-lg border border-destructive px-4 py-2 text-sm text-destructive disabled:opacity-50"
                    >
                      حذف
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
