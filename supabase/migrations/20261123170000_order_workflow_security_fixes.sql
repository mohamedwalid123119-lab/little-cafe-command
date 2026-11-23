
begin;

-- =========================================================
-- 1. FIX ORDER ITEM LOCKING
-- Allow item edits only while an order is unpaid and editable.
-- =========================================================

create or replace function public.order_item_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
  v_payment_status text;
  v_order_id uuid;
begin
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  select o.status, o.payment_status
    into v_status, v_payment_status
  from public.orders o
  where o.id = v_order_id;

  -- Allow cascading deletion when the parent order is already gone.
  if not found then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if v_payment_status = 'paid'
     or v_status in ('completed', 'cancelled', 'refunded') then
    raise exception 'لا يمكن تعديل أصناف طلب مدفوع أو مغلق';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;


-- =========================================================
-- 2. BRANCH-SCOPED RLS POLICIES
-- Owner: all branches.
-- NULL branch assignment: all branches.
-- Specific branch assignment: that branch only.
-- =========================================================

drop policy if exists "orders read" on public.orders;
drop policy if exists "orders insert" on public.orders;
drop policy if exists "orders update" on public.orders;

create policy orders_read_scoped
on public.orders
for select
to authenticated
using (
  (
    public.has_module(tenant_id, 'pos')
    or public.has_module(tenant_id, 'reports')
  )
  and exists (
    select 1
    from public.memberships m
    where m.tenant_id = orders.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = orders.branch_id
      )
  )
);

create policy orders_insert_scoped
on public.orders
for insert
to authenticated
with check (
  public.can_write(tenant_id, 'pos')
  and created_by = (select auth.uid())
  and exists (
    select 1
    from public.memberships m
    where m.tenant_id = orders.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = orders.branch_id
      )
  )
);

create policy orders_update_scoped
on public.orders
for update
to authenticated
using (
  public.can_write(tenant_id, 'pos')
  and status in ('draft', 'pending')
  and payment_status is distinct from 'paid'
  and exists (
    select 1
    from public.memberships m
    where m.tenant_id = orders.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = orders.branch_id
      )
  )
)
with check (
  public.can_write(tenant_id, 'pos')
  and status in ('draft', 'pending')
  and payment_status is distinct from 'paid'
  and exists (
    select 1
    from public.memberships m
    where m.tenant_id = orders.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = orders.branch_id
      )
  )
);


-- =========================================================
-- 3. ORDER ITEMS BRANCH SCOPE
-- =========================================================

drop policy if exists "order items read" on public.order_items;
drop policy if exists "order items insert" on public.order_items;
drop policy if exists "order items update" on public.order_items;
drop policy if exists "order items delete" on public.order_items;

create policy order_items_read_scoped
on public.order_items
for select
to authenticated
using (
  (
    public.has_module(tenant_id, 'pos')
    or public.has_module(tenant_id, 'reports')
  )
  and exists (
    select 1
    from public.orders o
    join public.memberships m
      on m.tenant_id = o.tenant_id
    where o.id = order_items.order_id
      and o.tenant_id = order_items.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = o.branch_id
      )
  )
);

create policy order_items_insert_scoped
on public.order_items
for insert
to authenticated
with check (
  public.can_write(tenant_id, 'pos')
  and exists (
    select 1
    from public.orders o
    join public.memberships m
      on m.tenant_id = o.tenant_id
    where o.id = order_items.order_id
      and o.tenant_id = order_items.tenant_id
      and o.status in ('draft', 'pending')
      and o.payment_status is distinct from 'paid'
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = o.branch_id
      )
  )
);

create policy order_items_update_scoped
on public.order_items
for update
to authenticated
using (
  public.can_write(tenant_id, 'pos')
  and exists (
    select 1
    from public.orders o
    join public.memberships m
      on m.tenant_id = o.tenant_id
    where o.id = order_items.order_id
      and o.tenant_id = order_items.tenant_id
      and o.status in ('draft', 'pending')
      and o.payment_status is distinct from 'paid'
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = o.branch_id
      )
  )
)
with check (
  public.can_write(tenant_id, 'pos')
  and exists (
    select 1
    from public.orders o
    join public.memberships m
      on m.tenant_id = o.tenant_id
    where o.id = order_items.order_id
      and o.tenant_id = order_items.tenant_id
      and o.status in ('draft', 'pending')
      and o.payment_status is distinct from 'paid'
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = o.branch_id
      )
  )
);

create policy order_items_delete_scoped
on public.order_items
for delete
to authenticated
using (
  public.can_write(tenant_id, 'pos')
  and exists (
    select 1
    from public.orders o
    join public.memberships m
      on m.tenant_id = o.tenant_id
    where o.id = order_items.order_id
      and o.tenant_id = order_items.tenant_id
      and o.status in ('draft', 'pending')
      and o.payment_status is distinct from 'paid'
      and m.user_id = (select auth.uid())
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = o.branch_id
      )
  )
);


-- =========================================================
-- 4. FIX ORDER EVENT BRANCH VISIBILITY
-- =========================================================

drop policy if exists "order events read" on public.order_events;
drop policy if exists order_events_read_branch on public.order_events;

create policy order_events_read_branch
on public.order_events
for select
to authenticated
using (
  (
    public.has_module(tenant_id, 'pos')
    or public.has_module(tenant_id, 'reports')
  )
  and exists (
    select 1
    from public.memberships m
    where m.tenant_id = order_events.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = order_events.branch_id
      )
  )
);


-- =========================================================
-- 5. CASH SESSION READ BRANCH SCOPE
-- =========================================================

drop policy if exists "cash sessions read" on public.cash_sessions;

create policy cash_sessions_read_scoped
on public.cash_sessions
for select
to authenticated
using (
  (
    public.has_module(tenant_id, 'pos')
    or public.has_module(tenant_id, 'reports')
  )
  and exists (
    select 1
    from public.memberships m
    where m.tenant_id = cash_sessions.tenant_id
      and m.user_id = (select auth.uid())
      and m.is_active
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = cash_sessions.branch_id
      )
  )
);


-- =========================================================
-- 6. PREVENT DIRECT CLIENT WRITES TO PAYMENT TABLES
-- The existing create_sale RPC remains the instant-sale path.
-- Future draft/payment workflows will use dedicated RPCs.
-- =========================================================

revoke all on public.orders from anon;
revoke all on public.order_items from anon;

revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.order_items from authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;


-- =========================================================
-- 7. CORRECTED INSTANT SALE RPC
-- Order starts pending/unpaid.
-- Items and FIFO stock movements happen in the same transaction.
-- It becomes paid/completed only after stock succeeds.
-- =========================================================

create or replace function public.create_sale(
  _tenant uuid,
  _branch uuid,
  _items jsonb,
  _payment_method text default 'cash'::text,
  _order_type text default 'dine_in'::text,
  _discount numeric default 0,
  _notes text default null::text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_t public.tenants%rowtype;
  v_session uuid;
  v_order uuid;
  v_number bigint;
  v_sub numeric := 0;
  v_disc numeric;
  v_tax numeric;
  v_total numeric;
  it record;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if not public.can_write(_tenant, 'pos') then
    raise exception 'ليس لديك صلاحية تسجيل المبيعات';
  end if;

  if not exists (
    select 1
    from public.branches
    where id = _branch
      and tenant_id = _tenant
      and is_active
  ) then
    raise exception 'الفرع غير موجود';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = _tenant
      and m.user_id = v_uid
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = _branch
      )
  ) then
    raise exception 'غير مسموح لك بالبيع في هذا الفرع';
  end if;

  if _items is null
     or jsonb_typeof(_items) <> 'array'
     or jsonb_array_length(_items) = 0 then
    raise exception 'الطلب فارغ';
  end if;

  if jsonb_array_length(_items) > 100 then
    raise exception 'عدد أصناف الطلب كبير جداً';
  end if;

  if coalesce(_payment_method, '') not in ('cash', 'card', 'wallet', 'other') then
    raise exception 'طريقة دفع غير صحيحة';
  end if;

  if coalesce(_order_type, '') not in ('dine_in', 'takeaway', 'delivery') then
    raise exception 'نوع طلب غير صحيح';
  end if;

  select id
  into v_session
  from public.cash_sessions
  where branch_id = _branch
    and tenant_id = _tenant
    and status = 'open'
  order by opened_at desc
  limit 1;

  if v_session is null then
    raise exception 'افتح وردية أولاً قبل تسجيل المبيعات';
  end if;

  select *
  into v_t
  from public.tenants
  where id = _tenant;

  if not found then
    raise exception 'بيانات الكافيه غير موجودة';
  end if;

  for it in
    select
      x.quantity,
      v.selling_price,
      p.name as pname
    from jsonb_to_recordset(_items)
      as x(variant_id uuid, quantity numeric)
    left join public.product_variants v
      on v.id = x.variant_id
      and v.tenant_id = _tenant
      and v.is_active
    left join public.products p
      on p.id = v.product_id
      and p.is_active
  loop
    if it.pname is null then
      raise exception 'منتج غير متاح للبيع';
    end if;

    if it.quantity is null
       or it.quantity <= 0
       or it.quantity > 1000 then
      raise exception 'كمية غير صحيحة';
    end if;

    v_sub := v_sub + round(it.quantity * it.selling_price, 2);
  end loop;

  v_disc := least(greatest(coalesce(_discount, 0), 0), v_sub);

  if v_t.prices_include_vat then
    v_total := v_sub - v_disc;
    v_tax := round(
      v_total - v_total / (1 + v_t.vat_percent / 100),
      2
    );
  else
    v_tax := round(
      (v_sub - v_disc) * v_t.vat_percent / 100,
      2
    );
    v_total := v_sub - v_disc + v_tax;
  end if;

  insert into public.orders (
    tenant_id,
    branch_id,
    cash_session_id,
    order_type,
    status,
    subtotal,
    discount,
    tax,
    total,
    payment_method,
    notes,
    created_by,
    payment_status,
    paid_at
  )
  values (
    _tenant,
    _branch,
    v_session,
    _order_type,
    'pending',
    v_sub,
    v_disc,
    v_tax,
    v_total,
    _payment_method,
    nullif(left(trim(coalesce(_notes, '')), 500), ''),
    v_uid,
    'unpaid',
    null
  )
  returning id, order_number
  into v_order, v_number;

  insert into public.order_items (
    tenant_id,
    order_id,
    product_id,
    variant_id,
    product_name,
    quantity,
    unit_price,
    unit_cost
  )
  select
    _tenant,
    v_order,
    p.id,
    v.id,
    left(
      p.name ||
      case
        when v.name is not null
          and v.name <> ''
          and v.name <> p.name
        then ' - ' || v.name
        else ''
      end,
      200
    ),
    x.quantity,
    v.selling_price,
    r.cost_per_portion
  from jsonb_to_recordset(_items)
    as x(variant_id uuid, quantity numeric)
  join public.product_variants v
    on v.id = x.variant_id
    and v.tenant_id = _tenant
    and v.is_active
  join public.products p
    on p.id = v.product_id
    and p.is_active
  left join public.recipes r
    on r.id = v.recipe_id;

  -- Keep the original FIFO inventory triggers and recipe logic.
  insert into public.inventory_movements (
    tenant_id,
    branch_id,
    ingredient_id,
    movement_type,
    quantity,
    unit_cost,
    reference_id,
    notes,
    created_by
  )
  select
    _tenant,
    _branch,
    c.ingredient_id,
    'sale',
    -round(sum(c.quantity), 3),
    i.cost_per_base_unit,
    v_order,
    'بيع طلب #' || v_number,
    v_uid
  from public.order_items oi
  join public.product_variants v
    on v.id = oi.variant_id
  cross join lateral public.recipe_consumption(
    v.recipe_id,
    oi.quantity
  ) c
  join public.ingredients i
    on i.id = c.ingredient_id
  where oi.order_id = v_order
    and v.recipe_id is not null
  group by c.ingredient_id, i.cost_per_base_unit
  having round(sum(c.quantity), 3) > 0;

  -- Payment is finalized only after all inventory operations succeed.
  update public.orders
  set
    status = 'completed',
    payment_status = 'paid',
    paid_at = now(),
    updated_at = now()
  where id = v_order
    and tenant_id = _tenant
    and status = 'pending'
    and payment_status = 'unpaid';

  if not found then
    raise exception 'تعذر إتمام عملية الدفع';
  end if;

  return v_order;
end;
$function$;

revoke execute on function public.create_sale(
  uuid, uuid, jsonb, text, text, numeric, text
) from public, anon;

grant execute on function public.create_sale(
  uuid, uuid, jsonb, text, text, numeric, text
) to authenticated;


-- =========================================================
-- 8. BARISTA ACCEPT / REJECT RPC
-- Barista cannot directly update orders or order items.
-- =========================================================

create or replace function public.respond_to_barista_order(
  _order uuid,
  _decision text,
  _reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_branch uuid;
  v_status text;
  v_payment_status text;
  v_barista_status text;
  v_reason text := nullif(trim(coalesce(_reason, '')), '');
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if _decision not in ('accepted', 'rejected') then
    raise exception 'قرار غير صحيح';
  end if;

  if _decision = 'rejected'
     and (v_reason is null or char_length(v_reason) > 500) then
    raise exception 'اكتب سبب الرفض بحد أقصى 500 حرف';
  end if;

  select
    o.tenant_id,
    o.branch_id,
    o.status,
    o.payment_status,
    o.barista_status
  into
    v_tenant,
    v_branch,
    v_status,
    v_payment_status,
    v_barista_status
  from public.orders o
  where o.id = _order
  for update;

  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = v_tenant
      and m.user_id = v_uid
      and m.is_active
      and m.role::text = 'barista'
      and (
        m.branch_id is null
        or m.branch_id = v_branch
      )
  ) then
    raise exception 'ليس لديك صلاحية التعامل مع هذا الطلب';
  end if;

  if not public.has_module(v_tenant, 'pos') then
    raise exception 'وحدة نقطة البيع غير متاحة لحسابك';
  end if;

  if v_status <> 'pending'
     or v_payment_status <> 'unpaid'
     or v_barista_status <> 'sent' then
    raise exception 'الطلب لم يعد متاحاً للاستجابة';
  end if;

  update public.orders
  set
    barista_status = _decision,
    barista_rejection_reason =
      case when _decision = 'rejected' then v_reason else null end,
    barista_responded_at = now(),
    updated_at = now()
  where id = _order;
end;
$function$;

revoke execute on function public.respond_to_barista_order(
  uuid, text, text
) from public, anon;

grant execute on function public.respond_to_barista_order(
  uuid, text, text
) to authenticated;


commit;
