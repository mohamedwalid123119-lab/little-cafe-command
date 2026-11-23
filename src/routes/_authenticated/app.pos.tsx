
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
  head: () => ({ meta: [{ title: "الكاشير — CAFE OS" }] }),
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
  const [tableLabel, setTableLabel] = useState("");
  const [received, setReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [showCart, setShowCart] = useState(true);

  const { data: session, isLoading: sessionLoading } = useQuery({
    ...q.openSession(tenantId, branchId),
    enabled: Boolean(branchId),
  });

  const { data: orders = [], refetch: refetchOrders } = useQuery({
    queryKey: ["pos-orders-workflow", tenantId, branchId, session?.id],
    enabled: Boolean(session?.id),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          id, order_number, order_type, status, payment_status,
          total, payment_method, created_at, table_label,
          barista_status, barista_rejection_reason,
          order_items(product_name, quantity)
        `)
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId)
        .eq("cash_session_id", session!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data ?? [];
    },
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
      if (categoryId !== "all" && product.category_id !== categoryId) return [];

      return (product.product_variants ?? [])
        .filter((variant) => variant.is_active)
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
          image: (product as any).image_path as string | null,
        }));
    });
  }, [catalog.products, categoryId, search]);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("اختر الفرع أولاً.");
      if (!session?.id) throw new Error("لا توجد وردية مفتوحة.");
      if (!cart.length) throw new Error("السلة فارغة.");
      if (orderType === "dine_in" && !tableLabel.trim()) {
        throw new Error("اكتب رقم الطاولة أولاً.");
      }

      const rpc = (supabase as any).rpc;
      const { data: orderId, error: createError } = await rpc("create_draft_order", {
        _tenant: tenantId,
        _branch: branchId,
        _items: saleItems(cart),
        _order_type: orderType,
        _table_label: tableLabel.trim() || null,
        _discount: Number(discount) || 0,
        _notes: notes.trim() || null,
      });

      if (createError) throw createError;

      const { error: sendError } = await rpc("send_order_to_barista", {
        _order: orderId,
      });

      if (sendError) {
        throw new Error(
          `تم إنشاء الطلب رقم ${orderId}، لكن تعذر إرساله للباريستا: ${sendError.message}`,
        );
      }

      return orderId as string;
    },
    onSuccess: async (orderId) => {
      setMessage(`تم إرسال الطلب للباريستا بنجاح. رقم الطلب: ${orderId}`);
      clearCart(false);
      await refreshData();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء الطلب.");
      void refetchOrders();
    },
  });

  const payMutation = useMutation({
    mutationFn: async ({
      orderId,
      method,
    }: {
      orderId: string;
      method: PaymentMethod;
    }) => {
      const { data, error } = await (supabase as any).rpc("pay_order", {
        _order: orderId,
        _payment_method: method,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (orderId) => {
      setMessage(`تم تحصيل الطلب رقم ${orderId} بنجاح.`);
      setReceived("");
      await refreshData();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : "تعذر إتمام الدفع.");
    },
  });

  async function refreshData() {
    await Promise.all([
      refetchOrders(),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["ingredients"] }),
      queryClient.invalidateQueries({ queryKey: ["pos-catalog"] }),
    ]);
  }

  useEffect(() => {
    setMessage("");
  }, [branchId]);

  function clearCart(showMessage = true) {
    setCart([]);
    setDiscount("0");
    setReceived("");
    setNotes("");
    setTableLabel("");
    if (showMessage) setMessage("تم تفريغ السلة.");
  }

  function changeBranch(nextBranchId: string) {
    if (nextBranchId === branchId) return;
    setBranchId(nextBranchId);
    clearCart(false);
    setMessage("تم تغيير الفرع وتفريغ السلة.");
  }

  function addProduct(product: {
    id: string;
    name: string;
    price: number;
  }) {
    setCart((current) =>
      addToCart(current, {
        variantId: product.id,
        name: product.name,
        unitPrice: product.price,
      }),
    );
    setMessage("");
  }

  const cashChange =
    paymentMethod === "cash"
      ? changeDue(totals.total, Number(received))
      : null;

  const canCreate =
    cart.length > 0 &&
    Boolean(session?.id) &&
    !createOrderMutation.isPending &&
    (orderType !== "dine_in" || Boolean(tableLabel.trim()));

  const activeOrders = orders.filter(
    (order: any) =>
      order.status === "pending" && order.payment_status === "unpaid",
  );

  const completedOrders = orders.filter(
    (order: any) => order.status === "completed",
  );

  return (
    <div dir="rtl" className="space-y-4 p-2 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h1 className="text-2xl font-black">نقطة البيع</h1>
          <p className="text-sm text-muted-foreground">
            {tenant.name} · إدارة الطلبات والمبيعات
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {session ? "الوردية مفتوحة" : "لا توجد وردية"}
          </span>
          <select
            value={branchId}
            onChange={(e) => changeBranch(e.target.value)}
            className="h-10 max-w-40 rounded-lg border bg-background px-3"
            aria-label="الفرع"
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {!sessionLoading && !session && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <b>لا توجد وردية مفتوحة لهذا الفرع.</b>
          <p className="mt-1 text-sm">افتح الوردية أولاً حتى تتمكن من تسجيل الطلبات.</p>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(420px,1.7fr)_230px]">
        <aside className={`${showCart ? "block" : "hidden"} order-3 space-y-4 rounded-2xl border bg-card p-4 xl:order-1 xl:block`}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black">سلة المشتريات</h2>
              <p className="text-xs text-muted-foreground">
                {itemCount(cart)} قطعة
              </p>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => clearCart()}
                className="rounded-lg border border-destructive px-3 py-2 text-xs text-destructive"
              >
                إفراغ
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <div className="mb-2 text-3xl">🛒</div>
              السلة فارغة
              <p className="mt-1 text-xs">اختر منتجاً لإضافته للطلب</p>
            </div>
          ) : (
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {cart.map((line) => (
                <div key={line.variantId} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-sm">{line.name}</b>
                    <button
                      onClick={() =>
                        setCart((current) => removeLine(current, line.variantId))
                      }
                      className="text-xs text-destructive"
                    >
                      حذف
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    سعر الوحدة: {line.unitPrice.toLocaleString("ar-EG")} {tenant.currency}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setCart((current) =>
                            setQuantity(current, line.variantId, line.quantity - 1),
                          )
                        }
                        className="h-8 w-8 rounded-lg border"
                        aria-label="تقليل الكمية"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={line.quantity}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (Number.isInteger(value) && value >= 1 && value <= 1000) {
                            setCart((current) =>
                              setQuantity(current, line.variantId, value),
                            );
                          }
                        }}
                        className="h-8 w-12 rounded-lg border bg-background text-center"
                        aria-label={`كمية ${line.name}`}
                      />
                      <button
                        onClick={() =>
                          setCart((current) =>
                            setQuantity(current, line.variantId, line.quantity + 1),
                          )
                        }
                        className="h-8 w-8 rounded-lg border"
                        aria-label="زيادة الكمية"
                      >
                        +
                      </button>
                    </div>
                    <b className="text-sm text-primary">
                      {(line.quantity * line.unitPrice).toLocaleString("ar-EG")} {tenant.currency}
                    </b>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t pt-4">
            <label className="block text-sm font-semibold">
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

            {orderType === "dine_in" && (
              <label className="block text-sm font-semibold">
                رقم الطاولة
                <input
                  value={tableLabel}
                  onChange={(e) => setTableLabel(e.target.value)}
                  placeholder="مثال: 5"
                  className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
                />
              </label>
            )}

            <label className="block text-sm font-semibold">
              الخصم بالجنيه
              <input
                type="number"
                min="0"
                max={totals.subtotal}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border bg-background px-3"
              />
            </label>

            <label className="block text-sm font-semibold">
              ملاحظات الطلب
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="ملاحظات للكاشير أو الباريستا..."
                className="mt-1 w-full rounded-lg border bg-background p-3"
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
            <div className="flex justify-between border-t pt-3 text-xl font-black">
              <span>الإجمالي</span>
              <span className="text-primary">
                {totals.total.toLocaleString("ar-EG")} {tenant.currency}
              </span>
            </div>
          </div>

          <button
            disabled={!canCreate}
            onClick={() => {
              setMessage("");
              createOrderMutation.mutate();
            }}
            className="h-12 w-full rounded-xl bg-emerald-600 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {createOrderMutation.isPending ? "جاري إرسال الطلب..." : "إرسال الطلب للباريستا"}
          </button>

          <button
            onClick={() => setShowCart(false)}
            className="w-full rounded-lg border py-2 text-sm xl:hidden"
          >
            إخفاء السلة
          </button>
        </aside>

        <section className="order-1 min-w-0 space-y-4 xl:order-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-black">المنتجات</h2>
              <p className="text-xs text-muted-foreground">
                اختر المنتج لإضافته إلى السلة
              </p>
            </div>
            <button
              onClick={() => setShowCart((value) => !value)}
              className="rounded-xl border px-3 py-2 text-sm xl:hidden"
            >
              🛒 السلة ({itemCount(cart)})
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن اسم المنتج..."
            className="h-12 w-full rounded-xl border bg-background px-4"
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => addProduct(product)}
                className="group flex min-h-40 flex-col items-center justify-between rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:border-primary hover:shadow-md"
              >
                <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {product.image?.startsWith("http") ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">☕</span>
                  )}
                </div>
                <span className="mt-2 line-clamp-2 text-sm font-bold">
                  {product.name}
                </span>
                <span className="mt-2 font-black text-primary">
                  {product.price.toLocaleString("ar-EG")} {tenant.currency}
                </span>
                <span className="mt-1 text-xs text-muted-foreground group-hover:text-primary">
                  + إضافة
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

        <aside className="order-2 space-y-2 rounded-2xl border bg-card p-3 xl:order-3">
          <h2 className="mb-3 font-black">التصنيفات</h2>
          <button
            onClick={() => setCategoryId("all")}
            className={`w-full rounded-xl px-3 py-3 text-right text-sm font-semibold ${
              categoryId === "all"
                ? "bg-primary text-primary-foreground"
                : "border bg-background hover:bg-muted"
            }`}
          >
            الكل
          </button>
          {catalog.categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={`w-full rounded-xl px-3 py-3 text-right text-sm font-semibold ${
                categoryId === category.id
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background hover:bg-muted"
              }`}
            >
              {category.name}
            </button>
          ))}
        </aside>
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-black">العمليات</h2>
            <p className="text-xs text-muted-foreground">
              الطلبات المرتبطة بالوردية الحالية
            </p>
          </div>
          <button
            onClick={() => void refetchOrders()}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            تحديث
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">طلبات نشطة</p>
            <p className="text-2xl font-black">{activeOrders.length}</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">طلبات مكتملة</p>
            <p className="text-2xl font-black">{completedOrders.length}</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            لا توجد عمليات مسجلة في الوردية الحالية.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => {
              const isActive =
                order.status === "pending" && order.payment_status === "unpaid";
              const accepted = order.barista_status === "accepted";
              const rejected = order.barista_status === "rejected";

              return (
                <article
                  key={order.id}
                  className={`rounded-2xl border border-r-4 p-4 ${
                    rejected
                      ? "border-r-red-500"
                      : isActive
                        ? "border-r-amber-500"
                        : "border-r-emerald-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">
                        طلب #{order.order_number ?? order.id.slice(0, 8)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.order_type === "takeaway"
                          ? "تيك أواي"
                          : order.order_type === "delivery"
                            ? "دليفري"
                            : `طاولة ${order.table_label ?? ""}`}
                        {" · "}
                        {new Date(order.created_at).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <b className="text-lg text-primary">
                      {Number(order.total).toLocaleString("ar-EG")} {tenant.currency}
                    </b>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(order.order_items ?? []).map((item: any, index: number) => (
                      <span
                        key={`${order.id}-${index}`}
                        className="rounded-full bg-muted px-3 py-1 text-xs"
                      >
                        {item.product_name} × {item.quantity}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {order.status === "completed" ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          مدفوع ومكتمل
                        </span>
                      ) : rejected ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-red-800 dark:bg-red-950 dark:text-red-200">
                          مرفوض من الباريستا
                        </span>
                      ) : accepted ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          مقبول - جاهز للتحصيل
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          بانتظار الباريستا
                        </span>
                      )}
                    </div>

                    {isActive && accepted && (
                      <button
                        disabled={payMutation.isPending}
                        onClick={() =>
                          payMutation.mutate({
                            orderId: order.id,
                            method: paymentMethod,
                          })
                        }
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        تحصيل الطلب
                      </button>
                    )}
                  </div>

                  {rejected && order.barista_rejection_reason && (
                    <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
                      سبب الرفض: {order.barista_rejection_reason}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-bold">طريقة الدفع عند التحصيل</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["cash", "كاش", "💵"],
              ["card", "بطاقة", "💳"],
              ["wallet", "محفظة", "📱"],
            ] as const
          ).map(([value, label, icon]) => (
            <button
              key={value}
              onClick={() => setPaymentMethod(value)}
              className={`rounded-xl border p-3 text-center ${
                paymentMethod === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background"
              }`}
            >
              <span className="block text-xl">{icon}</span>
              <span className="text-sm font-bold">{label}</span>
            </button>
          ))}
        </div>

        {paymentMethod === "cash" && (
          <label className="mt-3 block text-sm font-semibold">
            المبلغ المستلم
            <input
              type="number"
              min="0"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              placeholder="يُستخدم عند مراجعة المبلغ قبل التحصيل"
              className="mt-1 h-11 w-full rounded-lg border bg-background px-3"
            />
          </label>
        )}

        {paymentMethod === "cash" && received !== "" && (
          <p className="mt-2 text-sm">
            {cashChange === null
              ? "المبلغ المستلم أقل من إجمالي الطلب الحالي."
              : `الباقي: ${cashChange.toLocaleString("ar-EG")} ${tenant.currency}`}
          </p>
        )}
      </section>

      {message && (
        <p
          role="status"
          className="break-words rounded-xl border bg-muted p-3 text-sm"
        >
          {message}
        </p>
      )}
    </div>
  );
}
