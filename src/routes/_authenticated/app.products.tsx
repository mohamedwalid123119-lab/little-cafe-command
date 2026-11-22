
import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ModulePage } from "@/components/module-page";
import { q } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/products")({
  head: () => ({
    meta: [
      { title: "المنتجات — CAFE OS" },
      { name: "description", content: "إدارة المنتجات والأقسام والأحجام والأسعار." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
  },
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) {
    return <ModulePage module="products">لا يوجد كافيه مرتبط بحسابك حتى الآن.</ModulePage>;
  }

  return (
    <ModulePage module="products" wide>
      <Products tenantId={membership.tenant_id} />
    </ModulePage>
  );
}

function Products({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();

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

  const [variantName, setVariantName] = useState("عادي");
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
      if (!name) throw new Error("اكتب اسم القسم.");

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
      setMessage("تمت إضافة القسم بنجاح.");
      await refresh();
    },
    onError: (error: Error) => setMessage(error.message),
  });

  const productMutation = useMutation({
    mutationFn: async () => {
      const name = productName.trim();
      const price = Number(variantPrice);

      if (!name) throw new Error("اكتب اسم المنتج.");
      if (!variantName.trim()) throw new Error("اكتب اسم الحجم أو النوع.");
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("اكتب سعرًا صحيحًا.");
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
          `تم إنشاء المنتج، لكن تعذرت إضافة حجمه: ${variantError.message}. راجع المنتج وأضف الحجم من قسم الأحجام.`
        );
      }
    },
    onSuccess: async () => {
      setProductName("");
      setProductDescription("");
      setProductCategory("");
      setVariantName("عادي");
      setVariantPrice("");
      setTemperature("none");
      setRecipeId("");
      setMessage("تم إنشاء المنتج والحجم بنجاح.");
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

      if (!selectedProduct) throw new Error("اختار المنتج أولاً.");
      if (!newVariantName.trim()) throw new Error("اكتب اسم الحجم.");
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("اكتب سعرًا صحيحًا.");
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
      setMessage("تمت إضافة الحجم بنجاح.");
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
      setMessage("تم تحديث حالة المنتج.");
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
    0
  );

  return (
    <div dir="rtl" className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">إجمالي المنتجات</p>
          <p className="mt-2 text-2xl font-bold">{products.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">المنتجات النشطة</p>
          <p className="mt-2 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">الأحجام والأنواع</p>
          <p className="mt-2 text-2xl font-bold">{variantCount}</p>
        </div>
      </div>

      {message && (
        <div role="status" className="rounded-xl border bg-muted p-3 text-sm">
          {message}
          <button
            type="button"
            onClick={() => setMessage("")}
            className="mr-3 font-bold"
          >
            إغلاق
          </button>
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">إضافة قسم جديد</h2>
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            categoryMutation.mutate();
          }}
        >
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="مثال: قهوة ساخنة"
            className="min-w-0 flex-1 rounded-lg border bg-background p-3"
          />
          <button
            disabled={categoryMutation.isPending}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {categoryMutation.isPending ? "جارٍ الحفظ..." : "إضافة القسم"}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span key={category.id} className="rounded-full border px-3 py-1 text-sm">
              {category.name}
            </span>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد أقسام حتى الآن.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">إضافة منتج جديد</h2>

        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            productMutation.mutate();
          }}
        >
          <label className="text-sm">
            اسم المنتج
            <input
              required
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              placeholder="مثال: Spanish Latte"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>

          <label className="text-sm">
            القسم
            <select
              value={productCategory}
              onChange={(event) => setProductCategory(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3"
            >
              <option value="">بدون قسم</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            اسم الحجم أو النوع الأول
            <input
              required
              value={variantName}
              onChange={(event) => setVariantName(event.target.value)}
              placeholder="صغير / وسط / كبير"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>

          <label className="text-sm">
            سعر البيع
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={variantPrice}
              onChange={(event) => setVariantPrice(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>

          <label className="text-sm">
            درجة التقديم
            <select
              value={temperature}
              onChange={(event) =>
                setTemperature(event.target.value as "none" | "hot" | "cold")
              }
              className="mt-1 w-full rounded-lg border bg-background p-3"
            >
              <option value="none">غير محدد</option>
              <option value="hot">ساخن</option>
              <option value="cold">بارد</option>
            </select>
          </label>

          <label className="text-sm">
            الوصفة المرتبطة
            <select
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3"
            >
              <option value="">بدون وصفة حالياً</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            وصف المنتج (اختياري)
            <input
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              placeholder="وصف مختصر للمنتج"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>

          <button
            disabled={productMutation.isPending}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2"
          >
            {productMutation.isPending ? "جارٍ إنشاء المنتج..." : "حفظ المنتج"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-4 text-lg font-bold">إضافة حجم أو نوع لمنتج موجود</h2>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            المنتج
            <select
              value={selectedProduct}
              onChange={(event) => setSelectedProduct(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3"
            >
              <option value="">اختار المنتج</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            اسم الحجم الجديد
            <input
              value={newVariantName}
              onChange={(event) => setNewVariantName(event.target.value)}
              placeholder="كبير / صغير / دبل"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>

          <label className="text-sm">
            سعر البيع
            <input
              type="number"
              min="0"
              step="0.01"
              value={newVariantPrice}
              onChange={(event) => setNewVariantPrice(event.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
          </label>

          <label className="text-sm">
            درجة التقديم
            <select
              value={newVariantTemperature}
              onChange={(event) =>
                setNewVariantTemperature(
                  event.target.value as "none" | "hot" | "cold"
                )
              }
              className="mt-1 w-full rounded-lg border bg-background p-3"
            >
              <option value="none">غير محدد</option>
              <option value="hot">ساخن</option>
              <option value="cold">بارد</option>
            </select>
          </label>

          <label className="text-sm md:col-span-2">
            الوصفة
            <select
              value={newVariantRecipe}
              onChange={(event) => setNewVariantRecipe(event.target.value)}
              className="mt-1 w-full rounded-lg border bg-background p-3"
            >
              <option value="">بدون وصفة</option>
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
            onClick={() => variantMutation.mutate()}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50 md:col-span-2"
          >
            {variantMutation.isPending ? "جارٍ الحفظ..." : "إضافة الحجم"}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="space-y-3 border-b p-4">
          <h2 className="text-lg font-bold">قائمة المنتجات</h2>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المنتج..."
            className="w-full rounded-lg border bg-background p-3"
          />

          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="w-full rounded-lg border bg-background p-3"
          >
            <option value="all">كل الأقسام</option>
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
                      "بدون قسم"}
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
                  {product.is_active ? "نشط — إيقاف" : "متوقف — تفعيل"}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(product.product_variants ?? []).map((variant) => (
                  <div key={variant.id} className="rounded-lg border p-3">
                    <div className="flex justify-between gap-2">
                      <b>{variant.name}</b>
                      <span className="font-bold text-primary">
                        {Number(variant.selling_price).toLocaleString("ar-EG")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {variant.temperature === "hot"
                        ? "ساخن"
                        : variant.temperature === "cold"
                          ? "بارد"
                          : "غير محدد"}
                      {" · "}
                      {variant.is_active ? "متاح للبيع" : "متوقف"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      الوصفة:{" "}
                      {recipes.find((recipe) => recipe.id === variant.recipe_id)?.name ??
                        "غير مرتبطة"}
                    </p>
                  </div>
                ))}
                {(!product.product_variants ||
                  product.product_variants.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    لا توجد أحجام مضافة لهذا المنتج.
                  </p>
                )}
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              لا توجد منتجات مطابقة.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
