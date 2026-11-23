
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ModulePage } from "@/components/module-page";
import { supabase } from "@/integrations/supabase/client";
import { q } from "@/lib/queries";
import {
  addToCart, changeDue, computeTotals, itemCount, removeLine,
  saleItems, setQuantity, type CartLine, type OrderType, type PaymentMethod,
} from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/app/pos")({
  head: () => ({ meta: [{ title: "نقطة البيع — CAFE OS" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(q.myMemberships(context.user.id));
  },
  component: Page,
});

type Screen = "operations" | "sale";
type OrderRow = {
  id: string;
  order_number: number | null;
  order_type: string;
  status: string;
  payment_status?: string;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  payment_method: string | null;
  created_at: string;
  table_label?: string | null;
  notes?: string | null;
  barista_status?: string | null;
  barista_rejection_reason?: string | null;
  order_items?: { product_name: string; quantity: number; unit_price?: number; line_total?: number; notes?: string | null }[];
};

const money = (n: number, currency: string) =>
  `${Number(n || 0).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;

const time = (value: string) =>
  new Date(value).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("ar-EG", { day: "2-digit", month: "short", year: "numeric" });

const paymentLabel: Record<string, string> = {
  cash: "كاش", card: "بطاقة", wallet: "محفظة",
  bank_transfer: "تحويل بنكي", other: "أخرى",
};

const typeLabel = (type: string, table?: string | null) =>
  type === "takeaway" ? "تيك أواي" : type === "delivery" ? "دليفري" : `صالة${table ? ` · طاولة ${table}` : ""}`;

function Page() {
  const { user } = Route.useRouteContext();
  const { data: memberships } = useSuspenseQuery(q.myMemberships(user.id));
  const membership = memberships[0];

  if (!membership) return <ModulePage module="pos">لا يوجد فرع مرتبط بحسابك.</ModulePage>;

  return (
    <ModulePage module="pos" wide>
      <Cashier tenantId={membership.tenant_id} preferredBranch={membership.branch_id} />
    </ModulePage>
  );
}

function Cashier({ tenantId, preferredBranch }: { tenantId: string; preferredBranch: string | null }) {
  const queryClient = useQueryClient();
  const { data: tenant } = useSuspenseQuery(q.tenant(tenantId));
  const { data: branches } = useSuspenseQuery(q.branches(tenantId));
  const { data: catalog } = useSuspenseQuery(q.posCatalog(tenantId));

  const [branchId, setBranchId] = useState(
    preferredBranch ?? branches.find((b) => b.is_main)?.id ?? branches[0]?.id ?? "",
  );
  const [screen, setScreen] = useState<Screen>("operations");
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<"all" | "deleted">("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [discountFilter, setDiscountFilter] = useState("all");

  const [categoryId, setCategoryId] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [orderType, setOrderType] = useState<OrderType>("dine_in");
  const [tableLabel, setTableLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [received, setReceived] = useState("");
  const [message, setMessage] = useState("");

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const { data: session, isLoading: sessionLoading } = useQuery({
    ...q.openSession(tenantId, branchId),
    enabled: Boolean(branchId),
  });

  const { data: orders = [], refetch: refetchOrders, isFetching } = useQuery<OrderRow[]>({
    queryKey: ["pos-orders-workflow", tenantId, branchId, session?.id],
    enabled: Boolean(session?.id),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          id, order_number, order_type, status, payment_status,
          subtotal, discount, tax, total, payment_method, created_at,
          table_label, notes, barista_status, barista_rejection_reason,
          order_items(product_name, quantity, unit_price, line_total, notes)
        `)
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId)
        .eq("cash_session_id", session!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const totals = useMemo(
    () => computeTotals(cart, Number(discount) || 0, Number(tenant.vat_percent) || 0, tenant.prices_include_vat),
    [cart, discount, tenant.vat_percent, tenant.prices_include_vat],
  );

  const products = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return catalog.products.flatMap((product) => {
      if (categoryId !== "all" && product.category_id !== categoryId) return [];
      return (product.product_variants ?? [])
        .filter((variant) => variant.is_active)
        .filter((variant) => `${product.name} ${variant.name ?? ""}`.toLowerCase().includes(term))
        .map((variant) => ({
          id: variant.id,
          name: variant.name && variant.name !== product.name ? `${product.name} - ${variant.name}` : product.name,
          price: Number(variant.selling_price),
        }));
    });
  }, [catalog.products, categoryId, productSearch]);

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("اختر الفرع أولاً.");
      if (!session?.id) throw new Error("لا توجد وردية مفتوحة.");
      if (!cart.length) throw new Error("السلة فارغة.");
      if (orderType === "dine_in" && !tableLabel.trim()) throw new Error("اكتب رقم الطاولة.");

      const { data: orderId, error } = await (supabase as any).rpc("create_draft_order", {
        _tenant: tenantId,
        _branch: branchId,
        _items: saleItems(cart),
        _order_type: orderType,
        _table_label: tableLabel.trim() || null,
        _discount: Number(discount) || 0,
        _notes: notes.trim() || null,
      });
      if (error) throw error;

      const { error: sendError } = await (supabase as any).rpc("send_order_to_barista", { _order: orderId });
      if (sendError) throw new Error(`تم إنشاء الطلب، لكن تعذر إرساله للباريستا: ${sendError.message}`);
      return orderId as string;
    },
    onSuccess: async (id) => {
      setMessage(`تم إرسال الطلب للباريستا. رقم الطلب: ${id}`);
      setCart([]);
      setDiscount("0");
      setTableLabel("");
      setNotes("");
      setReceived("");
      setScreen("operations");
      await refreshData();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر إنشاء الطلب."),
  });

  const payMutation = useMutation({
    mutationFn: async ({ orderId, method }: { orderId: string; method: PaymentMethod }) => {
      const { data, error } = await (supabase as any).rpc("pay_order", {
        _order: orderId, _payment_method: method,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setMessage("تم تحصيل الطلب بنجاح.");
      setSelectedOrder(null);
      await refreshData();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "تعذر إتمام الدفع."),
  });

  async function refreshData() {
    await Promise.all([
      refetchOrders(),
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["ingredients"] }),
      queryClient.invalidateQueries({ queryKey: ["pos-catalog"] }),
    ]);
  }

  function resetFilters() {
    setDateFilter("today");
    setPaymentFilter("all");
    setDiscountFilter("all");
    setFilterFrom("");
    setFilterTo("");
    setSearch("");
  }

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const isDeleted = Boolean((order as any).deleted_at);
      if (tab === "deleted" ? !isDeleted : isDeleted) return false;

      const searchable = [
        order.order_number, order.id, order.table_label, order.notes,
        ...(order.order_items ?? []).map((item) => item.product_name),
      ].join(" ").toLowerCase();
      if (term && !searchable.includes(term)) return false;

      if (paymentFilter !== "all" && order.payment_method !== paymentFilter) return false;
      if (discountFilter === "yes" && Number(order.discount ?? 0) <= 0) return false;
      if (discountFilter === "no" && Number(order.discount ?? 0) > 0) return false;

      const created = new Date(order.created_at);
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (dateFilter === "today" && created < start) return false;
      if (dateFilter === "custom") {
        if (filterFrom && created < new Date(`${filterFrom}T00:00:00`)) return false;
        if (filterTo && created > new Date(`${filterTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [orders, search, tab, paymentFilter, discountFilter, dateFilter, filterFrom, filterTo]);

  const paidOrders = orders.filter((o) => o.status === "completed");
  const salesTotal = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const cashTotal = paidOrders.filter((o) => o.payment_method === "cash").reduce((sum, o) => sum + Number(o.total || 0), 0);
  const cardTotal = paidOrders.filter((o) => o.payment_method === "card").reduce((sum, o) => sum + Number(o.total || 0), 0);
  const walletTotal = paidOrders.filter((o) => o.payment_method === "wallet").reduce((sum, o) => sum + Number(o.total || 0), 0);
  const unpaidOrders = orders.filter((o) => o.status !== "completed");
  const unpaidTotal = unpaidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const taxTotal = paidOrders.reduce((sum, o) => sum + Number(o.tax || 0), 0);
  const discountTotal = paidOrders.reduce((sum, o) => sum + Number(o.discount || 0), 0);

  const cashChange = paymentMethod === "cash" ? changeDue(totals.total, Number(received)) : null;

  function addProduct(product: { id: string; name: string; price: number }) {
    setCart((current) => addToCart(current, {
      variantId: product.id, name: product.name, unitPrice: product.price,
    }));
  }

  function statusText(order: OrderRow) {
    if (order.status === "completed") return "مدفوع ومكتمل";
    if (order.barista_status === "rejected") return "مرفوض من الباريستا";
    if (order.barista_status === "accepted") return "مقبول · جاهز للتحصيل";
    return "بانتظار الباريستا";
  }

  return (
    <div dir="rtl" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="text-xl font-black">نقطة البيع</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tenant.name} · {screen === "sale" ? "عملية بيع جديدة" : "إدارة العمليات"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-lg px-3 py-2 text-xs font-bold ${session ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-800"}`}>
            {session ? "الوردية مفتوحة" : sessionLoading ? "جارٍ تحميل الوردية" : "لا توجد وردية"}
          </span>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="h-10 max-w-40 rounded-lg border bg-background px-3">
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
      </header>

      {!sessionLoading && !session && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          لا توجد وردية مفتوحة لهذا الفرع. افتح الوردية أولاً لتسجيل الطلبات.
        </div>
      )}

      {screen === "operations" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">العمليات</h3>
              <p className="text-sm text-muted-foreground">{filteredOrders.length} عملية</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters((v) => !v)} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${showFilters ? "bg-primary/10 text-primary" : "bg-card"}`}>
                <span className="ml-2">☷</span> الفلتر
              </button>
              <button onClick={() => void refetchOrders()} className="rounded-xl border bg-card px-4 py-2 text-sm">تحديث</button>
            </div>
          </div>

          <button onClick={() => setShowSummary(true)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-right transition hover:border-primary">
            <div>
              <p className="text-sm text-muted-foreground">صافي المبيعات المسجلة · الوردية الحالية</p>
              <p className="mt-1 text-2xl font-black text-primary">{money(salesTotal, tenant.currency)}</p>
            </div>
            <span className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-bold text-primary">تفاصيل المبيعات ←</span>
          </button>

          {showFilters && (
            <section className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-3">
              <label className="text-sm font-semibold">
                الفترة الزمنية
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3">
                  <option value="today">اليوم</option>
                  <option value="all">كل الفترات</option>
                  <option value="custom">فترة مخصصة</option>
                </select>
                {dateFilter === "custom" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-10 min-w-0 rounded-lg border bg-background px-2" />
                    <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-10 min-w-0 rounded-lg border bg-background px-2" />
                  </div>
                )}
              </label>
              <label className="text-sm font-semibold">
                طرق الدفع
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3">
                  <option value="all">كل طرق الدفع</option>
                  {Object.entries(paymentLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">
                الخصم
                <select value={discountFilter} onChange={(e) => setDiscountFilter(e.target.value)} className="mt-2 h-11 w-full rounded-lg border bg-background px-3">
                  <option value="all">الكل</option>
                  <option value="yes">بخصم</option>
                  <option value="no">بدون خصم</option>
                </select>
              </label>
              <div className="md:col-span-3">
                <button onClick={resetFilters} className="rounded-lg border px-4 py-2 text-sm">مسح الفلاتر</button>
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setTab("all")} className={`rounded-xl px-5 py-2 text-sm font-bold ${tab === "all" ? "bg-primary text-primary-foreground" : "border bg-card"}`}>الكل</button>
            <button onClick={() => setTab("deleted")} className={`rounded-xl px-5 py-2 text-sm font-bold ${tab === "deleted" ? "bg-primary text-primary-foreground" : "border bg-card"}`}>المحذوفات</button>
          </div>

          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث برقم الفاتورة أو الطاولة أو اسم المنتج..." className="h-12 w-full rounded-xl border bg-background px-4" />

          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
                لا توجد عمليات مطابقة للفلاتر الحالية.
              </div>
            ) : filteredOrders.map((order) => (
              <button key={order.id} onClick={() => setSelectedOrder(order)} className="block w-full rounded-2xl border bg-card p-4 text-right transition hover:border-primary hover:shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-black">فاتورة #{order.order_number ?? order.id.slice(0, 8)}</h4>
                    <p className="mt-1 text-xs text-muted-foreground">{typeLabel(order.order_type, order.table_label)} · {dateLabel(order.created_at)} · {time(order.created_at)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-black text-primary">{money(Number(order.total), tenant.currency)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{paymentLabel[order.payment_method ?? ""] ?? "لم يتم الدفع"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    {(order.order_items ?? []).slice(0, 4).map((item, i) => (
                      <span key={i} className="rounded-full bg-muted px-3 py-1 text-xs">{item.product_name} × {item.quantity}</span>
                    ))}
                    {(order.order_items?.length ?? 0) > 4 && <span className="text-xs text-muted-foreground">+ المزيد</span>}
                  </div>
                  <span className={`text-xs font-bold ${order.status === "completed" ? "text-emerald-700 dark:text-emerald-300" : order.barista_status === "rejected" ? "text-red-600" : "text-amber-700 dark:text-amber-300"}`}>{statusText(order)}</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-primary">عرض تفاصيل الفاتورة ←</p>
              </button>
            ))}
          </div>

          <button onClick={() => { setMessage(""); setScreen("sale"); }} className="fixed bottom-7 left-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl font-light text-primary-foreground shadow-xl transition hover:scale-105" aria-label="عملية بيع جديدة">+</button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">عملية بيع جديدة</h3>
              <p className="text-sm text-muted-foreground">اختر المنتجات وأضفها إلى الفاتورة</p>
            </div>
            <button onClick={() => setScreen("operations")} className="rounded-xl border px-4 py-2 text-sm">رجوع للعمليات</button>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(400px,1.8fr)_210px]">
            <aside className="order-3 space-y-4 rounded-2xl border bg-card p-4 xl:order-1">
              <div className="flex items-center justify-between">
                <div><h4 className="font-black">الفاتورة الحالية</h4><p className="text-xs text-muted-foreground">{itemCount(cart)} قطعة</p></div>
                {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-semibold text-destructive">إفراغ السلة</button>}
              </div>

              {cart.length === 0 ? (
                <div className="rounded-xl border border-dashed p-7 text-center text-sm text-muted-foreground">السلة فارغة<br />اختر منتجاً لإضافته</div>
              ) : (
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {cart.map((line) => (
                    <div key={line.variantId} className="rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-2"><b className="text-sm">{line.name}</b><button onClick={() => setCart((c) => removeLine(c, line.variantId))} className="text-xs text-destructive">حذف</button></div>
                      <p className="mt-1 text-xs text-muted-foreground">سعر الوحدة: {money(line.unitPrice, tenant.currency)}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setCart((c) => setQuantity(c, line.variantId, line.quantity - 1))} className="h-8 w-8 rounded-lg border">−</button>
                          <span className="min-w-8 text-center text-sm font-bold">{line.quantity}</span>
                          <button onClick={() => setCart((c) => setQuantity(c, line.variantId, line.quantity + 1))} className="h-8 w-8 rounded-lg border">+</button>
                        </div>
                        <b className="text-sm">{money(line.quantity * line.unitPrice, tenant.currency)}</b>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <label className="block text-sm font-semibold">نوع الطلب
                  <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3">
                    <option value="dine_in">صالة</option><option value="takeaway">تيك أواي</option><option value="delivery">دليفري</option>
                  </select>
                </label>
                {orderType === "dine_in" && <label className="block text-sm font-semibold">رقم الطاولة
                  <input value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="رقم الطاولة" className="mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                </label>}
                <label className="block text-sm font-semibold">الخصم بالجنيه
                  <input type="number" min="0" max={totals.subtotal} value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-background px-3" />
                </label>
                <label className="block text-sm font-semibold">ملاحظات الطلب
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className="mt-1 w-full rounded-lg border bg-background p-3" placeholder="ملاحظات للكاشير أو الباريستا..." />
                </label>
              </div>

              <div className="space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between"><span>الإجمالي قبل الخصم</span><b>{money(totals.subtotal, tenant.currency)}</b></div>
                <div className="flex justify-between"><span>الخصم</span><b>{money(totals.discount, tenant.currency)}</b></div>
                <div className="flex justify-between"><span>الضريبة</span><b>{money(totals.tax, tenant.currency)}</b></div>
                <div className="flex justify-between border-t pt-3 text-lg font-black"><span>الإجمالي</span><span className="text-primary">{money(totals.total, tenant.currency)}</span></div>
              </div>

              <button disabled={!session?.id || !cart.length || createOrderMutation.isPending || (orderType === "dine_in" && !tableLabel.trim())} onClick={() => createOrderMutation.mutate()} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-40">
                {createOrderMutation.isPending ? "جارٍ إرسال الطلب..." : "إرسال الطلب للباريستا"}
              </button>
            </aside>

            <section className="order-1 min-w-0 space-y-4 xl:order-2">
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="ابحث عن منتج..." className="h-12 w-full rounded-xl border bg-background px-4" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {products.map((product) => (
                  <button key={product.id} onClick={() => addProduct(product)} className="flex min-h-36 flex-col items-center justify-between rounded-2xl border bg-card p-3 text-center transition hover:border-primary hover:shadow-sm">
                    <div className="flex h-16 w-full items-center justify-center rounded-xl bg-muted text-3xl">☕</div>
                    <span className="mt-2 line-clamp-2 text-sm font-bold">{product.name}</span>
                    <span className="mt-2 font-black text-primary">{money(product.price, tenant.currency)}</span>
                    <span className="mt-1 text-xs text-muted-foreground">+ إضافة</span>
                  </button>
                ))}
              </div>
              {products.length === 0 && <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">لا توجد منتجات مطابقة.</p>}
            </section>

            <aside className="order-2 space-y-2 rounded-2xl border bg-card p-3 xl:order-3">
              <h4 className="mb-3 font-black">الأقسام</h4>
              <button onClick={() => setCategoryId("all")} className={`w-full rounded-xl px-3 py-3 text-right text-sm font-semibold ${categoryId === "all" ? "bg-primary text-primary-foreground" : "border bg-background"}`}>كل المنتجات</button>
              {catalog.categories.map((category) => (
                <button key={category.id} onClick={() => setCategoryId(category.id)} className={`w-full rounded-xl px-3 py-3 text-right text-sm font-semibold ${categoryId === category.id ? "bg-primary text-primary-foreground" : "border bg-background"}`}>{category.name}</button>
              ))}
            </aside>
          </div>
        </>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3" onClick={() => setSelectedOrder(null)}>
          <section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-xl font-black">تفاصيل الفاتورة</h3><p className="text-sm text-muted-foreground">رقم #{selectedOrder.order_number ?? selectedOrder.id.slice(0, 8)}</p></div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-lg border px-3 py-2">إغلاق</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground">نوع الطلب</p><b>{typeLabel(selectedOrder.order_type, selectedOrder.table_label)}</b></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground">التاريخ والوقت</p><b>{dateLabel(selectedOrder.created_at)} · {time(selectedOrder.created_at)}</b></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground">الحالة</p><b>{statusText(selectedOrder)}</b></div>
              <div className="rounded-xl bg-muted/50 p-3"><p className="text-muted-foreground">الدفع</p><b>{paymentLabel[selectedOrder.payment_method ?? ""] ?? "لم يتم الدفع"}</b></div>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-muted p-3 text-xs font-bold"><span>الصنف</span><span>الكمية</span><span>الإجمالي</span></div>
              {(selectedOrder.order_items ?? []).map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 border-t p-3 text-sm">
                  <div>{item.product_name}{item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}</div>
                  <span>{item.quantity}</span>
                  <b>{money(Number(item.line_total ?? Number(item.unit_price ?? 0) * item.quantity), tenant.currency)}</b>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span>قبل الخصم</span><b>{money(Number(selectedOrder.subtotal ?? 0), tenant.currency)}</b></div>
              <div className="flex justify-between"><span>الخصم</span><b>{money(Number(selectedOrder.discount ?? 0), tenant.currency)}</b></div>
              <div className="flex justify-between"><span>الضريبة</span><b>{money(Number(selectedOrder.tax ?? 0), tenant.currency)}</b></div>
              <div className="flex justify-between border-t pt-3 text-xl font-black"><span>الإجمالي</span><span className="text-primary">{money(Number(selectedOrder.total), tenant.currency)}</span></div>
            </div>
            {selectedOrder.notes && <p className="mt-3 rounded-xl bg-muted p-3 text-sm">ملاحظات: {selectedOrder.notes}</p>}
            {selectedOrder.barista_rejection_reason && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">سبب الرفض: {selectedOrder.barista_rejection_reason}</p>}
            {selectedOrder.status !== "completed" && selectedOrder.barista_status === "accepted" && (
              <div className="mt-4 space-y-3 border-t pt-4">
                <p className="font-bold">طريقة الدفع</p>
                <div className="grid grid-cols-3 gap-2">
                  {([["cash", "كاش"], ["card", "بطاقة"], ["wallet", "محفظة"]] as const).map(([value, label]) => (
                    <button key={value} onClick={() => setPaymentMethod(value)} className={`rounded-xl border p-3 text-sm font-bold ${paymentMethod === value ? "border-primary bg-primary/10 text-primary" : ""}`}>{label}</button>
                  ))}
                </div>
                <button disabled={payMutation.isPending} onClick={() => payMutation.mutate({ orderId: selectedOrder.id, method: paymentMethod })} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50">{payMutation.isPending ? "جارٍ التحصيل..." : "تحصيل الطلب"}</button>
              </div>
            )}
          </section>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3" onClick={() => setShowSummary(false)}>
          <section role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="text-xl font-black">ملخص مبيعات الوردية</h3><button onClick={() => setShowSummary(false)} className="rounded-lg border px-3 py-2">إغلاق</button></div>
            <p className="mt-1 text-sm text-muted-foreground">الأرقام محسوبة من الطلبات المسجلة في الوردية الحالية.</p>
            <div className="mt-4 rounded-2xl bg-primary/10 p-4"><p className="text-sm text-muted-foreground">إجمالي المبيعات المحصلة</p><p className="mt-1 text-2xl font-black text-primary">{money(salesTotal, tenant.currency)}</p></div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">الطلبات المدفوعة</p><b className="text-xl">{paidOrders.length}</b></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">الطلبات غير المحصلة</p><b className="text-xl">{unpaidOrders.length}</b></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">قيمة غير المحصل</p><b>{money(unpaidTotal, tenant.currency)}</b></div>
              <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">إجمالي الخصومات</p><b>{money(discountTotal, tenant.currency)}</b></div>
            </div>
            <h4 className="mt-5 font-bold">تفصيل طرق الدفع</h4>
            <div className="mt-2 space-y-2">
              {[
                ["كاش", cashTotal], ["بطاقة", cardTotal], ["محفظة إلكترونية", walletTotal],
                ["طرق أخرى", Math.max(0, salesTotal - cashTotal - cardTotal - walletTotal)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between rounded-lg border p-3 text-sm"><span>{label}</span><b>{money(Number(value), tenant.currency)}</b></div>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t pt-4 text-sm">
              <div className="flex justify-between"><span>إجمالي الضريبة</span><b>{money(taxTotal, tenant.currency)}</b></div>
              <div className="flex justify-between"><span>السحوبات</span><b>غير متاحة في سجل البيانات الحالي</b></div>
              <div className="flex justify-between"><span>صافي بعد السحوبات</span><b>لا يمكن حسابه دون سجل السحوبات</b></div>
            </div>
          </section>
        </div>
      )}

      {message && <div role="status" className="rounded-xl border bg-muted p-3 text-sm">{message}</div>}
      {isFetching && <p className="text-center text-xs text-muted-foreground">جارٍ تحديث العمليات...</p>}
    </div>
  );
}
