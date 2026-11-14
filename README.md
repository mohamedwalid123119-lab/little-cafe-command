# Little Cafe Command

PROJECT: CAFE OS



Professional Multi-Tenant Cafe Management SaaS Platform



Act as a world-class software architect, senior full-stack developer, SaaS product designer, restaurant operations consultant, and professional cafe owner.



Your mission is to design and build a professional, scalable, secure, multi-tenant SaaS platform specifically for coffee shops, cafes, and restaurants.



This is a real commercial software product intended to be sold to hundreds or thousands of independent cafes through monthly subscriptions.



Do not build a simple demo dashboard. Build a real, functional application with a scalable architecture.



1. PRODUCT IDENTITY



Product name: CAFE OS



Product type: Cloud-based Cafe Management SaaS.



Target market: Egypt initially, with the ability to expand internationally.



Currency: Egyptian Pound (EGP).



Primary language: Arabic.



Interface direction: Full RTL (Right to Left).



Design style:



- Premium and modern.

- Professional hospitality software.

- Clean and minimal interface.

- Easy for cafe owners and employees.

- Responsive on mobile phones, tablets, and computers.

- Use clear typography, professional charts, and organized navigation.



2. MULTI-TENANT ARCHITECTURE



This is one central software platform serving multiple independent cafes.



Each cafe must have:



- Its own account.

- Its own database records.

- Its own employees.

- Its own products and recipes.

- Its own inventory.

- Its own suppliers.

- Its own sales and financial reports.

- Its own subscription.



Implement strict tenant isolation.



A cafe must NEVER be able to access another cafe's information.



Use Supabase authentication and PostgreSQL with Row Level Security (RLS).



Never rely only on frontend restrictions for data security.



Create a separate platform administrator role with access to platform-level management, not ordinary cafe accounts.



3. MAIN MODULES



Build the platform with these main modules:



A. Dashboard

B. Point of Sale (POS)

C. Products and Menu

D. Recipe Management

E. Cost Control

F. Inventory Management

G. Purchasing and Suppliers

H. Sales and Expenses

I. Financial Reports

J. Employees and Permissions

K. Branch Management

L. Subscription Management

M. Platform Administration



4. RECIPE MANAGEMENT SYSTEM



This is one of the most important features of CAFE OS.



Build a professional recipe management engine.



Every product must support:



- Product name.

- Category.

- Product image.

- Selling price.

- Recipe ingredients.

- Ingredient quantities.

- Measurement units.

- Packaging costs.

- Preparation waste percentage.

- Recipe yield.

- Optional ingredients.

- Product variations and sizes.

- Hot and iced versions.

- Additional modifiers.



Support ingredients such as:



- Coffee beans.

- Milk.

- Syrups.

- Sauces.

- Chocolate.

- Matcha.

- Tea.

- Sugar.

- Ice.

- Cups.

- Lids.

- Straws.

- Packaging.



Support sub-recipes and batch preparation.



Example:

A Spanish Latte recipe can contain espresso, milk, condensed milk, and a cup.



If the cost of milk changes, automatically recalculate the cost of every affected recipe.



5. COST CONTROL ENGINE



Create a dynamic costing engine.



Calculate automatically:



1. Total ingredient cost.

2. Packaging cost.

3. Waste cost.

4. Total recipe cost.

5. Selling price.

6. Food cost percentage.

7. Gross contribution per item.

8. Gross margin percentage.



Use these formulas:



Food Cost % = Total Recipe Cost / Selling Price × 100



Gross Contribution = Selling Price - Total Recipe Cost



Gross Margin % = Gross Contribution / Selling Price × 100



Clearly distinguish gross contribution from net profit.



Never calculate net profit without accounting for operating expenses.



Show cost changes and their impact on profitability.



Allow users to compare recipe costs over time.



6. INVENTORY MANAGEMENT



Create a professional inventory system.



Features:



- Raw material inventory.

- Stock quantities.

- Measurement units.

- Purchase prices.

- Supplier management.

- Stock receiving.

- Stock consumption.

- Stock transfers.

- Waste recording.

- Stock adjustments.

- Minimum stock alerts.

- Inventory valuation.

- Stock movement history.



Automatically deduct recipe ingredients when a POS order is completed.



Support unit conversions such as:

1 kilogram = 1000 grams.

1 liter = 1000 milliliters.



Prevent invalid unit conversions.



Maintain a complete inventory movement ledger.



7. POINT OF SALE



Create a fast, user-friendly cafe POS.



Features:



- Product categories.

- Product selection.

- Shopping cart.

- Product sizes.

- Hot and iced options.

- Custom modifiers.

- Discounts.

- Taxes.

- Multiple payment methods.

- Cash and card payments.

- Order history.

- Order cancellation with authorization.

- Receipt generation.



The POS must be designed for quick service during busy cafe hours.



Design the architecture to support offline operation in a future phase. Do not claim offline support until it is actually implemented and tested.



8. FINANCIAL MANAGEMENT



Include:



- Daily sales.

- Monthly sales.

- Expenses.

- Purchases.

- Cash movements.

- Sales by product.

- Sales by category.

- Gross contribution.

- Operating expenses.

- Net operating profit.

- Profitability reports.



Allow date filtering and exportable reports.



Never confuse sales revenue with profit.



9. EMPLOYEE MANAGEMENT



Create role-based access control.



Roles:



- Owner.

- Manager.

- Cashier.

- Barista.

- Inventory manager.



Allow owners to control which modules each employee can access.



Record important employee actions in an audit log.



10. BRANCH MANAGEMENT



Support multiple branches under one cafe business.



Each branch should have its own:



- Inventory.

- Sales.

- Employees.

- Expenses.

- Reports.



Allow the business owner to view consolidated reports across all branches.



11. SUBSCRIPTION SYSTEM



Create subscription management for the SaaS platform.



Include:



- Basic plan.

- Professional plan.

- Enterprise plan.

- Monthly subscription.

- Subscription expiration.

- Trial period.

- Account activation and suspension.

- Subscription history.



Build the subscription management structure, but do not integrate real payment processing until the payment provider and business requirements are approved.



12. PLATFORM ADMINISTRATOR



Create a separate administrator dashboard.



The administrator can:



- View registered cafes.

- Activate and suspend accounts.

- View subscription statuses.

- Manage subscription plans.

- Monitor platform activity.

- View system-level statistics.

- Manage support requests.



Never expose cafe financial information to platform staff without explicitly authorized access and appropriate audit logging.



13. DATABASE AND TECHNICAL ARCHITECTURE



Use:



- React.

- TypeScript.

- A modern responsive UI framework.

- Supabase.

- PostgreSQL.

- Supabase Authentication.

- Row Level Security.

- Secure server-side business logic where necessary.



Design normalized database tables for:



- Tenants.

- Users.

- Memberships.

- Branches.

- Products.

- Categories.

- Ingredients.

- Recipes.

- Recipe ingredients.

- Suppliers.

- Purchases.

- Inventory movements.

- Orders.

- Order items.

- Expenses.

- Subscriptions.

- Audit logs.



Every tenant-owned record must be associated with the correct tenant.



Use database transactions for operations that update both orders and inventory.



Avoid exposing service-role keys in frontend code.



14. USER EXPERIENCE



Create a professional Arabic RTL dashboard.



Sidebar navigation:



- الرئيسية.

- الكاشير.

- المنتجات.

- الريسبي.

- الكوست.

- المخازن.

- المشتريات.

- الموردين.

- المصروفات.

- التقارير.

- الموظفين.

- الإعدادات.



Use Egyptian business terminology where appropriate.



All buttons must have functional actions.



All forms must validate inputs.



All important actions must provide clear success or error feedback.



15. DEVELOPMENT STRATEGY



Do not attempt to generate every module at once.



First, establish the complete project architecture and database structure.



Then implement the application in stages:



Stage 1:

Authentication, tenant creation, database security, dashboard, products, ingredients, recipes, and automatic costing.



Stage 2:

Inventory, purchasing, suppliers, and waste management.



Stage 3:

POS, orders, payments, and sales.



Stage 4:

Expenses, financial reports, employees, and branches.



Stage 5:

Subscriptions, administrator dashboard, and production hardening.



Build Stage 1 first.



Keep the code modular and reusable.



Do not use fake calculations or hardcoded business data as a substitute for real functionality.



Create sample data only in a clearly labeled demo environment.



Before claiming a feature is complete, test its actual functionality.



If a reqPROJECT: CAFE OS

Professional Multi-Tenant Cafe Management SaaS Platform

Act as a world-class software architect, senior full-stack developer, SaaS product designer, restaurant operations consultant, and professional cafe owner.

Your mission is to design and build a professional, scalable, secure, multi-tenant SaaS platform specifically for coffee shops, cafes, and restaurants.

This is a real commercial software product intended to be sold to hundreds or thousands of independent cafes through monthly subscriptions.

Do not build a simple demo dashboard. Build a real, functional application with a scalable architecture.

1. PRODUCT IDENTITY

Product name: CAFE OS

Product type: Cloud-based Cafe Management SaaS.

Target market: Egypt initially, with the ability to expand internationally.

Currency: Egyptian Pound (EGP).

Primary language: Arabic.

Interface direction: Full RTL (Right to Left).

Design style:

- Premium and modern.
- Professional hospitality software.
- Clean and minimal interface.
- Easy for cafe owners and employees.
- Responsive on mobile phones, tablets, and computers.
- Use clear typography, professional charts, and organized navigation.

2. MULTI-TENANT ARCHITECTURE

This is one central software platform serving multiple independent cafes.

Each cafe must have:

- Its own account.
- Its own database records.
- Its own employees.
- Its own products and recipes.
- Its own inventory.
- Its own suppliers.
- Its own sales and financial reports.
- Its own subscription.

Implement strict tenant isolation.

A cafe must NEVER be able to access another cafe's information.

Use Supabase authentication and PostgreSQL with Row Level Security (RLS).

Never rely only on frontend restrictions for data security.

Create a separate platform administrator role with access to platform-level management, not ordinary cafe accounts.

3. MAIN MODULES

Build the platform with these main modules:

A. Dashboard
B. Point of Sale (POS)
C. Products and Menu
D. Recipe Management
E. Cost Control
F. Inventory Management
G. Purchasing and Suppliers
H. Sales and Expenses
I. Financial Reports
J. Employees and Permissions
K. Branch Management
L. Subscription Management
M. Platform Administration

4. RECIPE MANAGEMENT SYSTEM

This is one of the most important features of CAFE OS.

Build a professional recipe management engine.

Every product must support:

- Product name.
- Category.
- Product image.
- Selling price.
- Recipe ingredients.
- Ingredient quantities.
- Measurement units.
- Packaging costs.
- Preparation waste percentage.
- Recipe yield.
- Optional ingredients.
- Product variations and sizes.
- Hot and iced versions.
- Additional modifiers.

Support ingredients such as:

- Coffee beans.
- Milk.
- Syrups.
- Sauces.
- Chocolate.
- Matcha.
- Tea.
- Sugar.
- Ice.
- Cups.
- Lids.
- Straws.
- Packaging.

Support sub-recipes and batch preparation.

Example:
A Spanish Latte recipe can contain espresso, milk, condensed milk, and a cup.

If the cost of milk changes, automatically recalculate the cost of every affected recipe.

5. COST CONTROL ENGINE

Create a dynamic costing engine.

Calculate automatically:

1. Total ingredient cost.
2. Packaging cost.
3. Waste cost.
4. Total recipe cost.
5. Selling price.
6. Food cost percentage.
7. Gross contribution per item.
8. Gross margin percentage.

Use these formulas:

Food Cost % = Total Recipe Cost / Selling Price × 100

Gross Contribution = Selling Price - Total Recipe Cost

Gross Margin % = Gross Contribution / Selling Price × 100

Clearly distinguish gross contribution from net profit.

Never calculate net profit without accounting for operating expenses.

Show cost changes and their impact on profitability.

Allow users to compare recipe costs over time.

6. INVENTORY MANAGEMENT

Create a professional inventory system.

Features:

- Raw material inventory.
- Stock quantities.
- Measurement units.
- Purchase prices.
- Supplier management.
- Stock receiving.
- Stock consumption.
- Stock transfers.
- Waste recording.
- Stock adjustments.
- Minimum stock alerts.
- Inventory valuation.
- Stock movement history.

Automatically deduct recipe ingredients when a POS order is completed.

Support unit conversions such as:
1 kilogram = 1000 grams.
1 liter = 1000 milliliters.

Prevent invalid unit conversions.

Maintain a complete inventory movement ledger.

7. POINT OF SALE

Create a fast, user-friendly cafe POS.

Features:

- Product categories.
- Product selection.
- Shopping cart.
- Product sizes.
- Hot and iced options.
- Custom modifiers.
- Discounts.
- Taxes.
- Multiple payment methods.
- Cash and card payments.
- Order history.
- Order cancellation with authorization.
- Receipt generation.

The POS must be designed for quick service during busy cafe hours.

Design the architecture to support offline operation in a future phase. Do not claim offline support until it is actually implemented and tested.

8. FINANCIAL MANAGEMENT

Include:

- Daily sales.
- Monthly sales.
- Expenses.
- Purchases.
- Cash movements.
- Sales by product.
- Sales by category.
- Gross contribution.
- Operating expenses.
- Net operating profit.
- Profitability reports.

Allow date filtering and exportable reports.

Never confuse sales revenue with profit.

9. EMPLOYEE MANAGEMENT

Create role-based access control.

Roles:

- Owner.
- Manager.
- Cashier.
- Barista.
- Inventory manager.

Allow owners to control which modules each employee can access.

Record important employee actions in an audit log.

10. BRANCH MANAGEMENT

Support multiple branches under one cafe business.

Each branch should have its own:

- Inventory.
- Sales.
- Employees.
- Expenses.
- Reports.

Allow the business owner to view consolidated reports across all branches.

11. SUBSCRIPTION SYSTEM

Create subscription management for the SaaS platform.

Include:

- Basic plan.
- Professional plan.
- Enterprise plan.
- Monthly subscription.
- Subscription expiration.
- Trial period.
- Account activation and suspension.
- Subscription history.

Build the subscription management structure, but do not integrate real payment processing until the payment provider and business requirements are approved.

12. PLATFORM ADMINISTRATOR

Create a separate administrator dashboard.

The administrator can:

- View registered cafes.
- Activate and suspend accounts.
- View subscription statuses.
- Manage subscription plans.
- Monitor platform activity.
- View system-level statistics.
- Manage support requests.

Never expose cafe financial information to platform staff without explicitly authorized access and appropriate audit logging.

13. DATABASE AND TECHNICAL ARCHITECTURE

Use:

- React.
- TypeScript.
- A modern responsive UI framework.
- Supabase.
- PostgreSQL.
- Supabase Authentication.
- Row Level Security.
- Secure server-side business logic where necessary.

Design normalized database tables for:

- Tenants.
- Users.
- Memberships.
- Branches.
- Products.
- Categories.
- Ingredients.
- Recipes.
- Recipe ingredients.
- Suppliers.
- Purchases.
- Inventory movements.
- Orders.
- Order items.
- Expenses.
- Subscriptions.
- Audit logs.

Every tenant-owned record must be associated with the correct tenant.

Use database transactions for operations that update both orders and inventory.

Avoid exposing service-role keys in frontend code.

14. USER EXPERIENCE

Create a professional Arabic RTL dashboard.

Sidebar navigation:

- الرئيسية.
- الكاشير.
- المنتجات.
- الريسبي.
- الكوست.
- المخازن.
- المشتريات.
- الموردين.
- المصروفات.
- التقارير.
- الموظفين.
- الإعدادات.

Use Egyptian business terminology where appropriate.

All buttons must have functional actions.

All forms must validate inputs.

All important actions must provide clear success or error feedback.

15. DEVELOPMENT STRATEGY

Do not attempt to generate every module at once.

First, establish the complete project architecture and database structure.

Then implement the application in stages:

Stage 1:
Authentication, tenant creation, database security, dashboard, products, ingredients, recipes, and automatic costing.

Stage 2:
Inventory, purchasing, suppliers, and waste management.

Stage 3:
POS, orders, payments, and sales.

Stage 4:
Expenses, financial reports, employees, and branches.

Stage 5:
Subscriptions, administrator dashboard, and production hardening.

Build Stage 1 first.

Keep the code modular and reusable.

Do not use fake calculations or hardcoded business data as a substitute for real functionality.

Create sample data only in a clearly labeled demo environment.

Before claiming a feature is complete, test its actual functionality.

If a required integration is missing, explain exactly what is needed instead of pretending it works.

FINAL OBJECTIVE

Build CAFE OS as a serious commercial SaaS product that helps cafe owners control recipes, costs, inventory, sales, employees, and profitability.

The system must be reliable, secure, scalable, and easy to use.

Start by creating the project architecture and implementing Stage 1.uired integration is missing, explain exactly what is needed instead of pretending it works.



FINAL OBJECTIVE



Build CAFE OS as a serious commercial SaaS product that helps cafe owners control recipes, costs, inventory, sales, employees, and profitability.



The system must be reliable, secure, scalable, and easy to use.



Start by creating the project architecture and implementing Stage 1.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://little-cafe-command.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a2caaccb-29d3-4f05-9b09-ccd94555890e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
