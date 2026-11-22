
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { ModulePage } from "@/components/module-page";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/queries";
import {
  addToCart,
  changeDue,
  computeTotals,
  itemCount,
  removeLine,
  saleItems,
  setQuantity,
  type CartLine,
  type OrderType,
  type PaymentMethod,
} from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/app/pos")({
  head: () => ({
    meta: [{ title: "الكاشير — CAFE OS" }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      q.myMemberships(context.user.id),
    );
  },
  component: Page,
});

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(
    q.myMemberships(user.id),
  );
  const membership = memberships[0];

  if (!membership) {
    return <ModulePage module="pos">لا يوجد فرع مرتبط بحسابك.</ModulePage>;
  }

  return (
    <ModulePage module="pos" wide>
      <Cashier tenantId={membership.tenant_id} preferredBranch={membership.branch_id} />
    </ModulePage>
  );
}

function Cashier({
  tenantId,
  preferredBranch,
}: {
  tenantId: string;
  preferredBranch: string | null;
}) {
  const queryClient = useQueryClient();
  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));
  const { data: branches } = useSuspenseQuery(q.branches(tenantId));
  const { data: catalog } = useSuspenseQuery(q.posCatalog(tenantId));

  const [branchId, setBranchId] = useState(
    preferredBranch ?? branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [received, setReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  const { data: session, isLoading: sessionLoading } = useQuery({
    ...q.openSession(tenantId, branchId),
    enabled: Boolean(branchId),
  });

  const { data: recentOrders } = useQuery({
    ...q.sessionOrders(session?.id ?? ""),
    enabled: Boolean(session?.id),
  });

  const totals = useMemo(
    () =>
      computeTotals(
        cart,
        Number(discount) || 0,
        Number(tenant.vat_percent) || 0,
        tenant.prices_include_vat,
      ),
    [cart, discount, tenant.vat_percent, tenant.prices_include_vat],
  );

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();

    return catalog.products.flatMap((product) => {
      if (categoryId !== "all" && product.category_id !== categoryId) {
        return [];
      }

      const variants = (product.product_variants ?? []).filter(
        (variant) => variant.is_active,
      );

      return variants
        .filter((variant) => {
          const label = `${product.name} ${variant.name ?? ""}`.toLowerCase();
          return !term || label.includes(term);
        })
        .map((variant) => ({
          id: variant.id,
          name:
            variant.name && variant.name !== product.name
              ? `${product.name} - ${variant.name}`
              : product.name,
          price: Number(variant.selling_price),
        }));
    });
  }, [catalog.products, categoryId, search]);

  const saleMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("اختر الفرع أولاً.");
      if (!session?.id) throw new Error("لا توجد وردية مفتوحة.");
      if (!cart.length) throw new Error("السلة فارغة.");

      const { data, error } = await supabase.rpc("create_sale", {
        _tenant: tenantId,
        _branch: branchId,
        _items: saleItems(cart),
        _payment_method: paymentMethod,
        _order_type: orderType,
        _discount: Number(discount) || 0,
        _notes: notes.trim() || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (orderId) => {
      setMessage(`تم تسجيل البيع بنجاح. رقم العملية: ${orderId}`);
      setCart([]);
      setDiscount("0");
      setReceived("");
      setNotes("");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pos-session-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["ingredients"] }),
        queryClient.invalidateQueries({ queryKey: ["pos-catalog"] }),
      ]);
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "تعذر تسجيل البيع.");
    },
  });

  useEffect(() => {
    setMessage("");
  }, [branchId]);

  function addProduct(product: { id: string; name: string; price: number }) {
    setCart((current) =>
      addToCart(
        current,
        {
          variantId: product.id,
          name: product.name,
          unitPrice: product.price,
        },
      ),
    );
    setMessage("");
  }

  const cashChange =
    paymentMethod === "cash"
      ? changeDue(totals.total, Number(received))
      : null;

  const canComplete =
    cart.length > 0 &&
    Boolean(session?.id) &&
    !saleMutation.isPending &&
    (paymentMethod !== "cash" || cashChange !== null);

  return (
    <div dir="rtl" className="space-y-4 p-2 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الكاشير</h1>
          <p className="text-sm text-muted-foreground">
            {tenant.name} · تسجيل المبيعات وإدارة الطلبات
          </p>
        </div>

        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="h-10 rounded-lg border bg-background px-3"
          aria-label="الفرع"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </header>

      {!sessionLoading && !session && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-900">
          <b>لا توجد وردية مفتوحة لهذا الفرع.</b>
          <p className="mt-1 text-sm">
            افتح الوردية أولاً حتى تتمكن من تسجيل المبيعات.
          </p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="h-12 w-full rounded-xl border bg-background px-4"
          />

          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setCategoryId("all")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                categoryId === "all"
                  ? "bg-primary text-primary-foreground"
                  : "border bg-card"
              }`}
            >
              الكل
            </button>

            {catalog.categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setCategoryId(category.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm ${
                  categoryId === category.id
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className="flex min-h-32 flex-col justify-between rounded-xl border bg-card p-3 text-right shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <span className="font-semibold">{product.name}</span>
                <span className="mt-3 text-lg font-bold text-primary">
                  {product.price.toLocaleString("ar-EG")} {tenant.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  اضغط للإضافة +
                </span>
              </button>
            ))}
          </div>

          {products.length === 0 && (
            <p className="rounded-xl border p-8 text-center text-muted-foreground">
              لا توجد منتجات مطابقة للبحث.
            </p>
          )}
        </section>

        <aside className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">سلة المشتريات</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-sm">
              {itemCount(cart)} صنف
            </span>
          </div>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              السلة فارغة. اختر منتجاً للبدء.
            </p>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {cart.map((line) => (
                <div
                  key={line.variantId}
                  className="rounded-lg border p-3"
                >
                  <div className="flex justify-between gap-2">
                    <b className="text-sm">{line.name}</b>
                    <button
                      onClick={() =>
                        setCart((current) =>
                          removeLine(current, line.variantId),
                        )
                      }
                      className="text-sm text-destructive"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setCart((current) =>
                            setQuantity(
                              current,
                              line.variantId,
                              line.quantity - 1,
                            ),
                          )
                        }
                        className="h-8 w-8 rounded-md border"
                      >
                        −
                      </button>
                      <b>{line.quantity}</b>
                      <button
                        onClick={() =>
                          setCart((current) =>
                            setQuantity(
                              current,
                              line.variantId,
                              line.quantity + 1,
                            ),
                          )
                        }
                        className="h-8 w-8 rounded-md border"
                      >
                        +
                      </button>
                    </div>
                    <b>
                      {(line.quantity * line.unitPrice).toLocaleString("ar-EG")}
                    </b>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <label className="block text-sm">
              نوع الطلب
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as OrderType)}
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              >
                <option value="dine_in">داخل الكافيه</option>
                <option value="takeaway">تيك أواي</option>
                <option value="delivery">دليفري</option>
              </select>
            </label>

            <label className="block text-sm">
              طريقة الدفع
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              >
                <option value="cash">نقدي</option>
                <option value="card">بطاقة</option>
                <option value="wallet">محفظة</option>
                <option value="other">أخرى</option>
              </select>
            </label>

            <label className="block text-sm">
              الخصم
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>

            {paymentMethod === "cash" && (
              <label className="block text-sm">
                المبلغ المستلم
                <input
                  type="number"
                  min="0"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder="اكتب المبلغ المستلم"
                  className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
                />
              </label>
            )}

            <label className="block text-sm">
              ملاحظات الطلب
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اختياري"
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>
          </div>

          <div className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>الإجمالي قبل الخصم</span>
              <b>{totals.subtotal.toLocaleString("ar-EG")}</b>
            </div>
            <div className="flex justify-between">
              <span>الخصم</span>
              <b>{totals.discount.toLocaleString("ar-EG")}</b>
            </div>
            <div className="flex justify-between">
              <span>الضريبة</span>
              <b>{totals.tax.toLocaleString("ar-EG")}</b>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>الإجمالي</span>
              <span className="text-primary">
                {totals.total.toLocaleString("ar-EG")} {tenant.currency}
              </span>
            </div>

            {paymentMethod === "cash" && received !== "" && (
              <div className="flex justify-between text-sm">
                <span>الباقي للعميل</span>
                <b>
                  {cashChange === null
                    ? "المبلغ المستلم غير كافٍ"
                    : cashChange.toLocaleString("ar-EG")}
                </b>
              </div>
            )}
          </div>

          <button
            disabled={!canComplete}
            onClick={() => {
              setMessage("");
              saleMutation.mutate();
            }}
            className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saleMutation.isPending ? "جاري تسجيل البيع..." : "تأكيد البيع"}
          </button>

          {message && (
            <p role="status" className="break-words text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </aside>
      </div>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-bold">آخر عمليات الوردية</h2>
        {!recentOrders?.length ? (
          <p className="text-sm text-muted-foreground">
            لا توجد عمليات مسجلة في هذه الوردية.
          </p>
        ) : (
          <div className="space-y-2">
            {recentOrders.slice(0, 8).map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm last:border-0"
              >
                <span>طلب #{order.order_number}</span>
                <span>{order.total.toLocaleString("ar-EG")} {tenant.currency}</span>
                <span className="text-muted-foreground">
                  {order.status === "completed" ? "مكتمل" : order.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
