import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { useAppPreferences } from "@/components/app-preferences";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({
    meta: [{ title: "Products — CAFE OS" }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
  },
  component: Page,
});

const translations = {
  ar: {
    noCafe: "لا يوجد كافيه مرتبط بحسابك حتى الآن.",
    total: "إجمالي المنتجات",
    active: "المنتجات النشطة",
    variants: "الأحجام والأنواع",
    close: "إغلاق",
    addCategory: "إضافة قسم جديد",
    categoryPlaceholder: "مثال: قهوة ساخنة",
    add: "إضافة القسم",
    saving: "جارٍ الحفظ...",
    noCategories: "لا توجد أقسام حتى الآن.",
    addProduct: "إضافة منتج جديد",
    productName: "اسم المنتج",
    productExample: "مثال: Spanish Latte",
    category: "القسم",
    noCategory: "بدون قسم",
    firstVariant: "اسم الحجم أو النوع الأول",
    variantExample: "صغير / وسط / كبير",
    price: "سعر البيع",
    temperature: "درجة التقديم",
    unspecified: "غير محدد",
    hot: "ساخن",
    cold: "بارد",
    recipe: "الوصفة المرتبطة",
    noRecipe: "بدون وصفة حالياً",
    description: "وصف المنتج (اختياري)",
    descriptionPlaceholder: "وصف مختصر للمنتج",
    creating: "جارٍ إنشاء المنتج...",
    saveProduct: "حفظ المنتج",
    addVariant: "إضافة حجم أو نوع لمنتج موجود",
    chooseProduct: "اختار المنتج",
    newVariant: "اسم الحجم الجديد",
    variantPlaceholder: "كبير / صغير / دبل",
    noRecipeOption: "بدون وصفة",
    addingVariant: "جارٍ إضافة الحجم...",
    saveVariant: "إضافة الحجم",
    productsList: "قائمة المنتجات",
    search: "ابحث باسم المنتج...",
    allCategories: "كل الأقسام",
    noGroup: "بدون قسم",
    activeStop: "نشط — إيقاف",
    inactiveActivate: "متوقف — تفعيل",
    available: "متاح للبيع",
    stopped: "متوقف",
    recipeLabel: "الوصفة:",
    notLinked: "غير مرتبطة",
    noVariants: "لا توجد أحجام مضافة لهذا المنتج.",
    noProducts: "لا توجد منتجات مطابقة.",
    categoryRequired: "اكتب اسم القسم.",
    productRequired: "اكتب اسم المنتج.",
    variantRequired: "اكتب اسم الحجم أو النوع.",
    validPrice: "اكتب سعرًا صحيحًا.",
    chooseFirst: "اختار المنتج أولاً.",
    categorySaved: "تمت إضافة القسم بنجاح.",
    productSaved: "تم إنشاء المنتج والحجم بنجاح.",
    variantSaved: "تمت إضافة الحجم بنجاح.",
    productUpdated: "تم تحديث حالة المنتج.",
    productCreatedVariantFailed: "تم إنشاء المنتج، لكن تعذرت إضافة حجمه: ",
    reviewProduct: "راجع المنتج وأضف الحجم من قسم الأحجام.",
  },
  en: {
    noCafe: "No cafe is linked to your account yet.",
    total: "Total Products",
    active: "Active Products",
    variants: "Sizes & Variants",
    close: "Close",
    addCategory: "Add New Category",
    categoryPlaceholder: "Example: Hot Coffee",
    add: "Add Category",
    saving: "Saving...",
    noCategories: "No categories yet.",
    addProduct: "Add New Product",
    productName: "Product Name",
    productExample: "Example: Spanish Latte",
    category: "Category",
    noCategory: "No Category",
    firstVariant: "First Size or Variant",
    variantExample: "Small / Medium / Large",
    price: "Selling Price",
    temperature: "Serving Temperature",
    unspecified: "Unspecified",
    hot: "Hot",
    cold: "Cold",
    recipe: "Linked Recipe",
    noRecipe: "No recipe for now",
    description: "Product Description (Optional)",
    descriptionPlaceholder: "Short product description",
    creating: "Creating product...",
    saveProduct: "Save Product",
    addVariant: "Add Size or Variant to Existing Product",
    chooseProduct: "Select Product",
    newVariant: "New Size or Variant Name",
    variantPlaceholder: "Large / Small / Double",
    noRecipeOption: "No Recipe",
    addingVariant: "Adding variant...",
    saveVariant: "Add Variant",
    productsList: "Product List",
    search: "Search product name...",
    allCategories: "All Categories",
    noGroup: "No Category",
    activeStop: "Active — Deactivate",
    inactiveActivate: "Inactive — Activate",
    available: "Available for Sale",
    stopped: "Inactive",
    recipeLabel: "Recipe:",
    notLinked: "Not linked",
    noVariants: "No sizes or variants added to this product.",
    noProducts: "No matching products found.",
    categoryRequired: "Enter a category name.",
    productRequired: "Enter a product name.",
    variantRequired: "Enter a size or variant name.",
    validPrice: "Enter a valid price.",
    chooseFirst: "Select a product first.",
    categorySaved: "Category added successfully.",
    productSaved: "Product and first variant created successfully.",
    variantSaved: "Variant added successfully.",
    productUpdated: "Product status updated.",
    productCreatedVariantFailed: "Product created, but its variant could not be added: ",
    reviewProduct: "Review the product and add its variant from the variants section.",
  },
};

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];
  const { language } = useAppPreferences();
  const isArabic = language === "ar";

  if (!membership) {
    return (
      <ModulePage module="products">
        {isArabic ? translations.ar.noCafe : translations.en.noCafe}
      </ModulePage>
    );
  }

  return (
    <ModulePage module="products" wide>
      <Products tenantId={membership.tenant_id} />
    </ModulePage>
  );
}

function Products({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const { language } = useAppPreferences();
  const isArabic = language === "ar";
  const t = isArabic ? translations.ar : translations.en;
  const locale = isArabic ? "ar-EG" : "en-US";

  const { data: categories } = useSuspenseQuery(q.categories(tenantId));
  const { data: products } = useSuspenseQuery(q.products(tenantId));
  const { data: recipes } = useSuspenseQuery(q.recipes(tenantId));

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [message, setMessage] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productCategory, setProductCategory] = useState("");

  const [variantName, setVariantName] = useState(isArabic ? "عادي" : "Regular");
  const [variantPrice, setVariantPrice] = useState("");
  const [temperature, setTemperature] = useState<"none" | "hot" | "cold">("none");
  const [recipeId, setRecipeId] = useState("");

  const [selectedProduct, setSelectedProduct] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [newVariantTemperature, setNewVariantTemperature] =
    useState<"none" | "hot" | "cold">("none");
  const [newVariantRecipe, setNewVariantRecipe] = useState("");

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["categories", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["pos-catalog", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["costing", tenantId] }),
    ]);
  };

  const categoryMutation = useMutation({
    mutationFn: async () => {
      const name = categoryName.trim();
      if (!name) throw new Error(t.categoryRequired);

      const { error } = await supabase.from("categories").insert({
        tenant_id: tenantId,
        name,
        sort_order: categories.length + 1,
        is_active: true,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setCategoryName("");
      setMessage(t.categorySaved);
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const productMutation = useMutation({
    mutationFn: async () => {
      const name = productName.trim();
      const price = Number(variantPrice);

      if (!name) throw new Error(t.productRequired);
      if (!variantName.trim()) throw new Error(t.variantRequired);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(t.validPrice);
      }

      const { data: product, error: productError } = await supabase
        .from("products")
        .insert({
          tenant_id: tenantId,
          name,
          description: productDescription.trim() || null,
          category_id: productCategory || null,
          is_active: true,
          sort_order: products.length + 1,
        })
        .select("id")
        .single();

      if (productError) throw productError;

      const { error: variantError } = await supabase
        .from("product_variants")
        .insert({
          tenant_id: tenantId,
          product_id: product.id,
          name: variantName.trim(),
          temperature,
          selling_price: price,
          recipe_id: recipeId || null,
          is_default: true,
          is_active: true,
          sort_order: 0,
        });

      if (variantError) {
        throw new Error(
          `${t.productCreatedVariantFailed}${variantError.message}. ${t.reviewProduct}`,
        );
      }
    },
    onSuccess: async () => {
      setProductName("");
      setProductDescription("");
      setProductCategory("");
      setVariantName(isArabic ? "عادي" : "Regular");
      setVariantPrice("");
      setTemperature("none");
      setRecipeId("");
      setMessage(t.productSaved);
      await refresh();
    },
    onError: async (error: Error) => {
      setMessage(error.message);
      await refresh();
    },
  });

  const variantMutation = useMutation({
    mutationFn: async () => {
      const price = Number(newVariantPrice);

      if (!selectedProduct) throw new Error(t.chooseFirst);
      if (!newVariantName.trim()) throw new Error(t.variantRequired);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(t.validPrice);
      }

      const { error } = await supabase.from("product_variants").insert({
        tenant_id: tenantId,
        product_id: selectedProduct,
        name: newVariantName.trim(),
        temperature: newVariantTemperature,
        selling_price: price,
        recipe_id: newVariantRecipe || null,
        is_default: false,
        is_active: true,
        sort_order: 10,
      });

      if (error) throw error;
    },
    onSuccess: async () => {
      setNewVariantName("");
      setNewVariantPrice("");
      setNewVariantTemperature("none");
      setNewVariantRecipe("");
      setMessage(t.variantSaved);
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !active })
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage(t.productUpdated);
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        (product.description ?? "").toLowerCase().includes(term);

      const matchesCategory =
        categoryFilter === "all" || product.category_id === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryFilter]);

  const activeCount = products.filter((product) => product.is_active).length;
  const variantCount = products.reduce(
    (total, product) => total + (product.product_variants?.length ?? 0),
    0,
  );

  const inputClass = "mt-1 w-full rounded-lg border bg-background p-3";
  const labelClass = "block text-sm font-medium";

  const temperatureLabel = (value: string) => {
    if (value === "hot") return t.hot;
    if (value === "cold") return t.cold;
    return t.unspecified;
  };

  return (
    <div dir={isArabic ? "rtl" : "ltr"} className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.total}</p>
          <p className="mt-2 text-2xl font-bold">{products.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.active}</p>
          <p className="mt-2 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t.variants}</p>
          <p className="mt-2 text-2xl font-bold">{variantCount}</p>
        </div>
      </div>

      {message && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border bg-muted p-3 text-sm">
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="shrink-0 font-bold"
          >
            {t.close}
          </button>
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">{t.addCategory}</h2>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage("");
            categoryMutation.mutate();
          }}
        >
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder={t.categoryPlaceholder}
            className="min-w-0 flex-1 rounded-lg border bg-background p-3"
          />
          <button
            disabled={categoryMutation.isPending}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {categoryMutation.isPending ? t.saving : t.add}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span key={category.id} className="rounded-full border px-3 py-1 text-sm">
              {category.name}
            </span>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.noCategories}</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">{t.addProduct}</h2>

        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage("");
            productMutation.mutate();
          }}
        >
          <label className={labelClass}>
            {t.productName}
            <input
              required
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder={t.productExample}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            {t.category}
            <select
              value={productCategory}
              onChange={(event) => setProductCategory(event.target.value)}
              className={inputClass}
            >
              <option value="">{t.noCategory}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            {t.firstVariant}
            <input
              required
              value={variantName}
              onChange={(event) => setVariantName(event.target.value)}
              placeholder={t.variantExample}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            {t.price}
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={variantPrice}
              onChange={(event) => setVariantPrice(event.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            {t.temperature}
            <select
              value={temperature}
              onChange={(event) =>
                setTemperature(event.target.value as "none" | "hot" | "cold")
              }
              className={inputClass}
            >
              <option value="none">{t.unspecified}</option>
              <option value="hot">{t.hot}</option>
              <option value="cold">{t.cold}</option>
            </select>
          </label>

          <label className={labelClass}>
            {t.recipe}
            <select
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
              className={inputClass}
            >
              <option value="">{t.noRecipe}</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            {t.description}
            <input
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              placeholder={t.descriptionPlaceholder}
              className={inputClass}
            />
          </label>

          <button
            disabled={productMutation.isPending}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2"
          >
            {productMutation.isPending ? t.creating : t.saveProduct}
          </button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">{t.addVariant}</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className={labelClass}>
            {t.productName}
            <select
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className={inputClass}
            >
              <option value="">{t.chooseProduct}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            {t.newVariant}
            <input
              value={newVariantName}
              onChange={(event) => setNewVariantName(event.target.value)}
              placeholder={t.variantPlaceholder}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            {t.price}
            <input
              type="number"
              min="0"
              step="0.01"
              value={newVariantPrice}
              onChange={(event) => setNewVariantPrice(event.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            {t.temperature}
            <select
              value={newVariantTemperature}
              onChange={(event) =>
                setNewVariantTemperature(
                  event.target.value as "none" | "hot" | "cold",
                )
              }
              className={inputClass}
            >
              <option value="none">{t.unspecified}</option>
              <option value="hot">{t.hot}</option>
              <option value="cold">{t.cold}</option>
            </select>
          </label>

          <label className={`${labelClass} md:col-span-2`}>
            {t.recipe}
            <select
              value={newVariantRecipe}
              onChange={(event) => setNewVariantRecipe(event.target.value)}
              className={inputClass}
            >
              <option value="">{t.noRecipeOption}</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={
              variantMutation.isPending ||
              !selectedProduct ||
              !newVariantName.trim() ||
              !newVariantPrice
            }
            onClick={() => {
              setMessage("");
              variantMutation.mutate();
            }}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2"
          >
            {variantMutation.isPending ? t.addingVariant : t.saveVariant}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="space-y-3 border-b p-4">
          <h2 className="text-lg font-bold">{t.productsList}</h2>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.search}
            className="w-full rounded-lg border bg-background p-3"
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="w-full rounded-lg border bg-background p-3"
          >
            <option value="all">{t.allCategories}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="divide-y">
          {filteredProducts.map((product) => (
            <div key={product.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{product.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categories.find((category) => category.id === product.category_id)?.name ??
                      t.noGroup}
                  </p>
                  {product.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {product.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={toggleMutation.isPending}
                  onClick={() =>
                    toggleMutation.mutate({
                      id: product.id,
                      active: product.is_active,
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    product.is_active
                      ? "text-green-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {product.is_active ? t.activeStop : t.inactiveActivate}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(product.product_variants ?? []).map((variant) => (
                  <div key={variant.id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-2">
                      <b>{variant.name}</b>
                      <span className="font-bold text-primary">
                        {Number(variant.selling_price).toLocaleString(locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {temperatureLabel(variant.temperature)}
                      {" · "}
                      {variant.is_active ? t.available : t.stopped}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.recipeLabel}{" "}
                      {recipes.find((recipe) => recipe.id === variant.recipe_id)?.name ??
                        t.notLinked}
                    </p>
                  </div>
                ))}
                {(!product.product_variants ||
                  product.product_variants.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    {t.noVariants}
                  </p>
                )}
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t.noProducts}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}