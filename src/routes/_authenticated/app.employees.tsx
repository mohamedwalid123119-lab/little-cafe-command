
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({
    meta: [{ title: "الموظفون — CAFE OS" }],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

const roleLabels: Record<string, string> = {
  owner: "مالك الكافيه",
  admin: "مدير النظام",
  manager: "مدير فرع",
  supervisor: "مشرف",
  cashier: "كاشير",
  barista: "باريستا",
  staff: "موظف",
};

const moduleLabels: Record<string, string> = {
  dashboard: "الرئيسية",
  pos: "نقطة البيع",
  inventory: "المخزون",
  products: "المنتجات",
  recipes: "الوصفات",
  purchasing: "المشتريات",
  suppliers: "الموردون",
  employees: "الموظفون",
  expenses: "المصروفات",
  reports: "التقارير",
  settings: "الإعدادات",
  cost: "التكلفة",
};

function roleLabel(role: string) {
  return roleLabels[role] ?? role;
}

function moduleLabel(module: string) {
  return moduleLabels[module] ?? module;
}

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) {
    return (
      <ModulePage module="employees">
        لا يوجد كافيه مرتبط بحسابك حتى الآن.
      </ModulePage>
    );
  }

  return (
    <ModulePage module="employees" wide>
      <Employees tenantId={membership.tenant_id} />
    </ModulePage>
  );
}

function Employees({ tenantId }: { tenantId: string }) {
  const { data: members } = useSuspenseQuery(q.members(tenantId));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      const name = member.profile?.full_name ?? "";
      const phone = member.profile?.phone ?? "";

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        phone.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && member.is_active) ||
        (statusFilter === "inactive" && !member.is_active);

      const matchesRole =
        roleFilter === "all" || member.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [members, search, statusFilter, roleFilter]);

  const activeCount = members.filter((member) => member.is_active).length;
  const inactiveCount = members.length - activeCount;

  const currentMember = members.find(
    (member) => member.id === selectedMember,
  );

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">إدارة الموظفين</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          متابعة أعضاء فريق الكافيه وحساباتهم وصلاحياتهم.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">إجمالي الأعضاء</p>
          <p className="mt-2 text-2xl font-bold">{members.length}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">أعضاء نشطون</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">أعضاء غير نشطين</p>
          <p className="mt-2 text-2xl font-bold">
            {inactiveCount}
          </p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 font-bold">البحث والتصفية</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">
              البحث بالاسم أو الهاتف
            </label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="اسم الموظف أو رقم الهاتف"
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              حالة العضوية
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              الوظيفة
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="all">كل الوظائف</option>
              {Array.from(new Set(members.map((member) => member.role))).map(
                (role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <h3 className="font-bold">فريق العمل</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            عدد النتائج: {filteredMembers.length}
          </p>
        </div>

        {filteredMembers.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            لا توجد نتائج مطابقة للبحث.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-right text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3">الموظف</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">الوظيفة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="border-t">
                    <td className="p-3 font-semibold">
                      {member.profile?.full_name || "اسم غير مسجل"}
                    </td>
                    <td className="p-3">
                      {member.profile?.phone || "—"}
                    </td>
                    <td className="p-3">{roleLabel(member.role)}</td>
                    <td className="p-3">
                      {member.is_active ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">
                          نشط
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs">
                          غير نشط
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMember(
                            selectedMember === member.id ? null : member.id,
                          )
                        }
                        className="rounded-lg border px-3 py-2"
                      >
                        {selectedMember === member.id
                          ? "إغلاق"
                          : "عرض التفاصيل"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {currentMember && (
        <section className="rounded-xl border bg-card p-4">
          <h3 className="text-lg font-bold">
            {currentMember.profile?.full_name || "اسم غير مسجل"}
          </h3>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">الوظيفة</p>
              <p className="mt-1 font-semibold">
                {roleLabel(currentMember.role)}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">الهاتف</p>
              <p className="mt-1 font-semibold">
                {currentMember.profile?.phone || "غير مسجل"}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">تاريخ الانضمام</p>
              <p className="mt-1 font-semibold">
                {new Date(currentMember.created_at).toLocaleDateString("ar-EG")}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">الحالة</p>
              <p className="mt-1 font-semibold">
                {currentMember.is_active ? "نشط" : "غير نشط"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="mb-3 font-bold">صلاحيات الوصول</h4>

            {currentMember.modules?.length ? (
              <div className="flex flex-wrap gap-2">
                {currentMember.modules.map((module) => (
                  <span
                    key={module}
                    className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    {moduleLabel(module)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                لا توجد صلاحيات مخصصة مسجلة لهذه العضوية.
              </p>
            )}
          </div>
        </section>
      )}

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        الشاشة تعرض بيانات العضويات والصلاحيات الحالية. إضافة الموظفين
        وتعديل أدوارهم تحتاج إلى مسار دعوات آمن على الخادم.
      </div>
    </div>
  );
}
