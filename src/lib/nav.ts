
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
  titleEn: string;
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
  descriptionEn: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    module: "dashboard",
    path: "/app",
    icon: LayoutDashboard,
    titleEn: "Dashboard",
    description: "ملخص المبيعات والأرباح والمصروفات والمخزون.",
    descriptionEn: "Overview of sales, profits, expenses, and inventory.",
  },
  {
    module: "pos",
    path: "/app/pos",
    icon: Coffee,
    titleEn: "Point of Sale",
    description: "تسجيل الطلبات والبيع خلال الوردية.",
    descriptionEn: "Manage orders and sales during shifts.",
  },
  {
    module: "products",
    path: "/app/products",
    icon: Package,
    titleEn: "Products",
    description: "المنتجات والأقسام والأحجام والإضافات.",
    descriptionEn: "Products, categories, sizes, and extras.",
  },
  {
    module: "recipes",
    path: "/app/recipes",
    icon: ChefHat,
    titleEn: "Recipes",
    description: "الريسبيات والتحضيرات ومكوناتها.",
    descriptionEn: "Recipes, preparations, and ingredients.",
  },
  {
    module: "cost",
    path: "/app/cost",
    icon: Calculator,
    titleEn: "Costs & Profits",
    description: "تكلفة كل منتج وهامش الربح والسعر المقترح.",
    descriptionEn: "Product costs, profit margins, and suggested prices.",
  },
  {
    module: "inventory",
    path: "/app/inventory",
    icon: Warehouse,
    titleEn: "Inventory",
    description: "الخامات والكميات المتاحة وتنبيهات النقص.",
    descriptionEn: "Stock quantities, available materials, and low-stock alerts.",
  },
  {
    module: "purchasing",
    path: "/app/purchasing",
    icon: ShoppingCart,
    titleEn: "Purchasing",
    description: "فواتير الشراء واستلام البضاعة.",
    descriptionEn: "Purchase invoices and receiving goods.",
  },
  {
    module: "suppliers",
    path: "/app/suppliers",
    icon: Truck,
    titleEn: "Suppliers",
    description: "بيانات الموردين.",
    descriptionEn: "Supplier information.",
  },
  {
    module: "expenses",
    path: "/app/expenses",
    icon: Wallet,
    titleEn: "Expenses",
    description: "مصروفات الكافيه حسب النوع.",
    descriptionEn: "Cafe expenses by category.",
  },
  {
    module: "reports",
    path: "/app/reports",
    icon: BarChart3,
    titleEn: "Reports",
    description: "تقارير المبيعات والأرباح.",
    descriptionEn: "Sales and profit reports.",
  },
  {
    module: "employees",
    path: "/app/employees",
    icon: Users,
    titleEn: "Employees",
    description: "فريق العمل والصلاحيات والورديات.",
    descriptionEn: "Staff, permissions, and shifts.",
  },
  {
    module: "settings",
    path: "/app/settings",
    icon: Settings,
    titleEn: "Settings",
    description: "إعدادات الكافيه والفروع والاشتراك.",
    descriptionEn: "Cafe settings, branches, and subscription.",
  },
].map((item) => ({
  ...item,
  title: MODULES[item.module],
})) as NavItem[];

export function navItem(module: ModuleKey) {
  return NAV_ITEMS.find((item) => item.module === module)!;
}

export function activeNavItem(pathname: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  return NAV_ITEMS.find((item) =>
    item.path === "/app"
      ? p === "/app"
      : p === item.path || p.startsWith(`${item.path}/`)
  );
}
