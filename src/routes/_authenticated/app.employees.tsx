
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/app/employees")({
  head: () => ({
    meta: [{ title: "Employees — CAFE OS" }],
  }),
  component: Page,
});

const authRoute = getRouteApi("/_authenticated");

const roleLabels: Record<string, [string, string]> = {
  owner: ["مالك الكافيه", "Cafe Owner"],
  admin: ["مدير النظام", "System Admin"],
  manager: ["مدير فرع", "Branch Manager"],
  supervisor: ["مشرف", "Supervisor"],
  cashier: ["كاشير", "Cashier"],
  barista: ["باريستا", "Barista"],
  staff: ["موظف", "Staff"],
};

const moduleLabels: Record<string, [string, string]> = {
  dashboard: ["الرئيسية", "Dashboard"],
  pos: ["نقطة البيع", "Point of Sale"],
  inventory: ["المخزون", "Inventory"],
  products: ["المنتجات", "Products"],
  recipes: ["الوصفات", "Recipes"],
  purchasing: ["المشتريات", "Purchasing"],
  suppliers: ["الموردون", "Suppliers"],
  employees: ["الموظفون", "Employees"],
  expenses: ["المصروفات", "Expenses"],
  reports: ["التقارير", "Reports"],
  settings: ["الإعدادات", "Settings"],
  cost: ["التكلفة", "Cost Analysis"],
};

function roleLabel(role: string, isArabic: boolean) {
  const labels = roleLabels[role];
  return labels ? labels[isArabic ? 0 : 1] : role;
}

function moduleLabel(module: string, isArabic: boolean) {
  const labels = moduleLabels[module];
  return labels ? labels[isArabic ? 0 : 1] : module;
}

function Page() {
  const { user } = authRoute.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  if (!membership) {
    return (
      <ModulePage module="employees">
        {isArabic
          ? "لا يوجد كافيه مرتبط بحسابك حتى الآن."
          : "No cafe is linked to your account yet."}
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
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  const t = {
    title: isArabic ? "إدارة الموظفين" : "Employee Management",
    description: isArabic
      ? "متابعة أعضاء فريق الكافيه وحساباتهم وصلاحياتهم."
      : "Manage cafe team members, accounts and permissions.",
    total: isArabic ? "إجمالي الأعضاء" : "Total Members",
    active: isArabic ? "أعضاء نشطون" : "Active Members",
    inactive: isArabic ? "أعضاء غير نشطين" : "Inactive Members",
    filters: isArabic ? "البحث والتصفية" : "Search & Filters",
    searchLabel: isArabic ? "البحث بالاسم أو الهاتف" : "Search by Name or Phone",
    searchPlaceholder: isArabic ? "اسم الموظف أو رقم الهاتف" : "Employee name or phone",
    status: isArabic ? "حالة العضوية" : "Membership Status",
    allStatuses: isArabic ? "كل الحالات" : "All Statuses",
    activeOption: isArabic ? "نشط" : "Active",
    inactiveOption: isArabic ? "غير نشط" : "Inactive",
    job: isArabic ? "الوظيفة" : "Role",
    allJobs: isArabic ? "كل الوظائف" : "All Roles",
    team: isArabic ? "فريق العمل" : "Team Members",
    results: isArabic ? "عدد النتائج:" : "Results:",
    employee: isArabic ? "الموظف" : "Employee",
    phone: isArabic ? "الهاتف" : "Phone",
    role: isArabic ? "الوظيفة" : "Role",
    state: isArabic ? "الحالة" : "Status",
    details: isArabic ? "التفاصيل" : "Details",
    close: isArabic ? "إغلاق" : "Close",
    viewDetails: isArabic ? "عرض التفاصيل" : "View Details",
    noResults: isArabic ? "لا توجد نتائج مطابقة للبحث." : "No matching results found.",
    noName: isArabic ? "اسم غير مسجل" : "Unnamed",
    notRegistered: isArabic ? "غير مسجل" : "Not registered",
    joined: isArabic ? "تاريخ الانضمام" : "Joined Date",
    permissions: isArabic ? "صلاحيات الوصول" : "Access Permissions",
    noPermissions: isArabic
      ? "لا توجد صلاحيات مخصصة مسجلة لهذه العضوية."
      : "No custom permissions are registered for this membership.",
    note: isArabic
      ? "الشاشة تعرض بيانات العضويات والصلاحيات الحالية. إضافة الموظفين وتعديل أدوارهم تحتاج إلى مسار دعوات آمن على الخادم."
      : "This screen displays current membership and permission data. Adding employees and changing their roles requires a secure server-side invitation flow.",
  };

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
    <div dir={isArabic ? "rtl" : "ltr"} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.total}</p>
          <p className="mt-2 text-2xl font-bold">{members.length}</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.active}</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {activeCount}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.inactive}</p>
          <p className="mt-2 text-2xl font-bold">{inactiveCount}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h3 className="mb-4 font-bold">{t.filters}</h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium">
              {t.searchLabel}
            </label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-lg border bg-background p-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {t.status}
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="all">{t.allStatuses}</option>
              <option value="active">{t.activeOption}</option>
              <option value="inactive">{t.inactiveOption}</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              {t.job}
            </label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="w-full rounded-lg border bg-background p-3"
            >
              <option value="all">{t.allJobs}</option>
              {Array.from(new Set(members.map((member) => member.role))).map(
                (role) => (
                  <option key={role} value={role}>
                    {roleLabel(role, isArabic)}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <h3 className="font-bold">{t.team}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.results} {filteredMembers.length}
          </p>
        </div>

        {filteredMembers.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {t.noResults}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={`w-full min-w-[650px] text-sm ${isArabic ? "text-right" : "text-left"}`}>
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3">{t.employee}</th>
                  <th className="p-3">{t.phone}</th>
                  <th className="p-3">{t.role}</th>
                  <th className="p-3">{t.state}</th>
                  <th className="p-3">{t.details}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="border-t">
                    <td className="p-3 font-semibold">
                      {member.profile?.full_name || t.noName}
                    </td>
                    <td className="p-3">
                      {member.profile?.phone || "—"}
                    </td>
                    <td className="p-3">
                      {roleLabel(member.role, isArabic)}
                    </td>
                    <td className="p-3">
                      {member.is_active ? (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">
                          {t.activeOption}
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-3 py-1 text-xs">
                          {t.inactiveOption}
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
                          ? t.close
                          : t.viewDetails}
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
            {currentMember.profile?.full_name || t.noName}
          </h3>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t.role}</p>
              <p className="mt-1 font-semibold">
                {roleLabel(currentMember.role, isArabic)}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t.phone}</p>
              <p className="mt-1 font-semibold">
                {currentMember.profile?.phone || t.notRegistered}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t.joined}</p>
              <p className="mt-1 font-semibold">
                {new Date(currentMember.created_at).toLocaleDateString(
                  isArabic ? "ar-EG" : "en-US",
                )}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{t.state}</p>
              <p className="mt-1 font-semibold">
                {currentMember.is_active ? t.activeOption : t.inactiveOption}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="mb-3 font-bold">{t.permissions}</h4>

            {currentMember.modules?.length ? (
              <div className="flex flex-wrap gap-2">
                {currentMember.modules.map((module) => (
                  <span
                    key={module}
                    className="rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    {moduleLabel(module, isArabic)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                {t.noPermissions}
              </p>
            )}
          </div>
        </section>
      )}

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {t.note}
      </div>
    </div>
  );
}
