import {
  BarChart3,
  Package,
  Warehouse,
  Calculator,
  ChefHat,
  Coffee,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { MODULES, type ModuleKey } from "./permissions";

export interface NavItem {
  module: ModuleKey;
  title: string;
  path:
    | "/app"
    | "/app/pos"
    | "/app/products"
    | "/app/recipes"
    | "/app/cost"
    | "/app/inventory"
    | "/app/purchasing"
    | "/app/suppliers"
    | "/app/expenses"
    | "/app/reports"
    | "/app/employees"
    | "/app/settings";
  icon: LucideIcon;
  description: string;
}

/** One entry per existing module (MODULES); order = sidebar order. */
export const NAV_ITEMS: NavItem[] = [
  { module: "dashboard", path: "/app", icon: LayoutDashboard, description: "ملخص المبيعات والأرباح والمصروفات والمخزون." },
  { module: "pos", path: "/app/pos", icon: Coffee, description: "تسجيل الطلبات والبيع خلال الوردية." },
  { module: "products", path: "/app/products", icon: Package, description: "المنتجات والأقسام والأحجام والإضافات." },
  { module: "recipes", path: "/app/recipes", icon: ChefHat, description: "الريسبيات والتحضيرات ومكوناتها." },
  { module: "cost", path: "/app/cost", icon: Calculator, description: "تكلفة كل منتج وهامش الربح والسعر المقترح." },
  { module: "inventory", path: "/app/inventory", icon: Warehouse, description: "الخامات والكميات المتاحة وتنبيهات النقص." },
  { module: "purchasing", path: "/app/purchasing", icon: ShoppingCart, description: "فواتير الشراء واستلام البضاعة." },
  { module: "suppliers", path: "/app/suppliers", icon: Truck, description: "بيانات الموردين." },
  { module: "expenses", path: "/app/expenses", icon: Wallet, description: "مصروفات الكافيه حسب النوع." },
  { module: "reports", path: "/app/reports", icon: BarChart3, description: "تقارير المبيعات والأرباح." },
  { module: "employees", path: "/app/employees", icon: Users, description: "فريق العمل والصلاحيات والورديات." },
  { module: "settings", path: "/app/settings", icon: Settings, description: "إعدادات الكافيه والفروع والاشتراك." },
].map((i) => ({ ...i, title: MODULES[i.module as ModuleKey] })) as NavItem[];

export function navItem(module: ModuleKey) {
  return NAV_ITEMS.find((i) => i.module === module)!;
}

/** The nav item whose page is open: exact match for the dashboard, prefix match for the rest. */
export function activeNavItem(pathname: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  return NAV_ITEMS.find((i) => (i.path === "/app" ? p === "/app" : p === i.path || p.startsWith(`${i.path}/`)));
}

