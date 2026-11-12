export type TenantRole = "owner" | "manager" | "cashier" | "barista" | "inventory_manager";

export const MODULES = {
  dashboard: "لوحة التحكم",
  pos: "نقطة البيع",
  products: "المنتجات",
  recipes: "الريسبيات",
  cost: "التكلفة والأرباح",
  inventory: "المخزون",
  purchasing: "المشتريات",
  suppliers: "الموردين",
  expenses: "المصروفات",
  reports: "التقارير",
  employees: "الموظفين",
  settings: "الإعدادات",
} as const;

export type ModuleKey = keyof typeof MODULES;

export const ROLE_LABELS: Record<TenantRole, string> = {
  owner: "المالك",
  manager: "مدير",
  cashier: "كاشير",
  barista: "باريستا",
  inventory_manager: "مسؤول مخزون",
};

/** Mirrors public.role_default_modules in the database (the database enforces it). */
export function roleDefaultModules(role: TenantRole): ModuleKey[] {
  switch (role) {
    case "owner":
      return Object.keys(MODULES) as ModuleKey[];
    case "manager":
      return ["dashboard", "pos", "products", "recipes", "cost", "inventory", "purchasing", "suppliers", "expenses", "reports"];
    case "cashier":
    case "barista":
      return ["pos"];
    case "inventory_manager":
      return ["dashboard", "inventory", "purchasing", "suppliers"];
  }
}

export function hasModule(m: { role: TenantRole; modules: string[] | null }, module: ModuleKey) {
  if (m.role === "owner") return true;
  return (m.modules ?? roleDefaultModules(m.role)).includes(module);
}
