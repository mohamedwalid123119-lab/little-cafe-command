
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/suppliers")({
  head: () => ({
    meta: [{ title: "الموردين — CAFE OS" }],
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
      const cleanName = name.trim();

      if (cleanName.length < 2) {
        throw new Error("اكتب اسم المورد بشكل صحيح");
      }

      const payload = {
        name: cleanName,
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
      setMessage(editingId ? "تم تحديث بيانات المورد" : "تمت إضافة المورد");
      resetForm();
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (supplier: (typeof suppliers)[number]) => {
      const { error } = await supabase
        .from("suppliers")
        .update({ is_active: !supplier.is_active })
        .eq("id", supplier.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage("تم تحديث حالة المورد");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const filteredSuppliers = suppliers.filter((supplier) =>
    `${supplier.name} ${supplier.phone ?? ""} ${supplier.address ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const activeCount = suppliers.filter((s) => s.is_active).length;

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
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">إجمالي الموردين</p>
            <p className="mt-2 text-2xl font-bold">{suppliers.length}</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">موردون نشطون</p>
            <p className="mt-2 text-2xl font-bold">{activeCount}</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">موردون متوقفون</p>
            <p className="mt-2 text-2xl font-bold">
              {suppliers.length - activeCount}
            </p>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">
              {editingId ? "تعديل بيانات المورد" : "إضافة مورد جديد"}
            </h2>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">اسم المورد *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم المورد أو الشركة"
                maxLength={120}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">رقم الهاتف</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="رقم التواصل"
                maxLength={30}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">العنوان</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="عنوان المورد"
                maxLength={300}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">ملاحظات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل أو ملاحظات عن المورد"
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border bg-background p-3"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!name.trim() || saveMutation.isPending}
            onClick={() => {
              setMessage("");
              saveMutation.mutate();
            }}
            className="mt-4 w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50 sm:w-auto"
          >
            {saveMutation.isPending
              ? "جارٍ الحفظ..."
              : editingId
                ? "حفظ التعديلات"
                : "إضافة المورد"}
          </button>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b p-4">
            <h2 className="text-lg font-bold">قائمة الموردين</h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف أو العنوان..."
              className="mt-3 w-full rounded-lg border bg-background p-3"
            />
          </div>

          {isLoading ? (
            <p className="p-6 text-center text-muted-foreground">
              جارٍ تحميل الموردين...
            </p>
          ) : filteredSuppliers.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              لا يوجد موردون مطابقون للبحث.
            </p>
          ) : (
            <div className="divide-y">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{supplier.name}</strong>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          supplier.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {supplier.is_active ? "نشط" : "متوقف"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {supplier.phone || "لا يوجد هاتف"}
                    </p>

                    {supplier.address && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {supplier.address}
                      </p>
                    )}

                    {supplier.notes && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {supplier.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(supplier)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(supplier)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      {supplier.is_active ? "إيقاف" : "تفعيل"}
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
