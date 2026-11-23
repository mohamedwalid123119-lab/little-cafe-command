
-- Little Cafe Command
-- Order Workflow Foundation
-- Corrected and security-reviewed candidate.
-- Does not apply itself to the database.

begin;

-- =====================================================
-- 1. ORDER WORKFLOW COLUMNS
-- =====================================================

alter table public.orders
  add column if not exists table_label text,
  add column if not exists payment_status text,
  add column if not exists sent_to_barista_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists barista_status text not null default 'not_sent',
  add column if not exists barista_rejection_reason text,
  add column if not exists barista_responded_at timestamptz;

-- Backfill existing completed sales.
update public.orders
set
  payment_status = 'paid',
  paid_at = coalesce(paid_at, created_at)
where status = 'completed'
  and payment_method is not null
  and payment_status is null;

-- New orders are unpaid unless a trusted payment operation
-- explicitly marks them as paid.
alter table public.orders
  alter column payment_status set default 'unpaid';

-- =====================================================
-- 2. VALIDATION CONSTRAINTS
-- =====================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_payment_status_check'
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (
        payment_status is null
        or payment_status in ('unpaid', 'paid', 'refunded')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_barista_status_check'
  ) then
    alter table public.orders
      add constraint orders_barista_status_check
      check (
        barista_status in ('not_sent', 'sent', 'accepted', 'rejected')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_table_label_length_check'
  ) then
    alter table public.orders
      add constraint orders_table_label_length_check
      check (table_label is null or char_length(table_label) <= 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_barista_reason_length_check'
  ) then
    alter table public.orders
      add constraint orders_barista_reason_length_check
      check (
        barista_rejection_reason is null
        or char_length(barista_rejection_reason) <= 500
      );
  end if;
end
$$;

-- =====================================================
-- 3. ORDER ACTIVITY HISTORY
-- order_id becomes NULL after permanent order deletion.
-- The event and its details remain available.
-- =====================================================

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  branch_id uuid not null,
  order_id uuid,

  actor_id uuid references auth.users(id) on delete set null,

  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_events_order_fkey
    foreign key (order_id)
    references public.orders(id)
    on delete set null,

  constraint order_events_branch_tenant_fkey
    foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id),

  constraint order_events_type_check
    check (char_length(trim(event_type)) between 1 and 80)
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

create index if not exists idx_order_events_order_created
  on public.order_events (order_id, created_at desc);

create index if not exists idx_order_events_branch_created
  on public.order_events (tenant_id, branch_id, created_at desc);

create index if not exists idx_orders_open_branch
  on public.orders (tenant_id, branch_id, created_at desc)
  where status in ('draft', 'pending')
    and deleted_at is null;

-- =====================================================
-- 5. AUTOMATIC EVENT CAPTURE
-- Handles order INSERT, UPDATE and DELETE.
-- Handles order item INSERT, UPDATE and DELETE.
-- =====================================================

create or replace function public.capture_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order_id uuid;
  v_tenant_id uuid;
  v_branch_id uuid;
  v_event_type text;
  v_details jsonb := '{}'::jsonb;
begin

  -- -------------------------------------------------
  -- Orders
  -- -------------------------------------------------

  if tg_table_name = 'orders' then

    if tg_op = 'DELETE' then
      v_order_id := old.id;
      v_tenant_id := old.tenant_id;
      v_branch_id := old.branch_id;
      v_event_type := 'order_deleted';

      v_details := jsonb_build_object(
        'order_number', old.order_number,
        'order_type', old.order_type,
        'status', old.status,
        'payment_status', old.payment_status,
        'total', old.total,
        'table_label', old.table_label,
        'deleted_snapshot', to_jsonb(old)
      );

    elsif tg_op = 'INSERT' then
      v_order_id := new.id;
      v_tenant_id := new.tenant_id;
      v_branch_id := new.branch_id;
      v_event_type := 'order_created';

      v_details := jsonb_build_object(
        'order_number', new.order_number,
        'order_type', new.order_type,
        'status', new.status,
        'total', new.total,
        'table_label', new.table_label
      );

    else
      v_order_id := new.id;
      v_tenant_id := new.tenant_id;
      v_branch_id := new.branch_id;
      v_event_type := 'order_updated';

      v_details := jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'old_total', old.total,
        'new_total', new.total,
        'old_discount', old.discount,
        'new_discount', new.discount,
        'old_payment_method', old.payment_method,
        'new_payment_method', new.payment_method,
        'old_payment_status', old.payment_status,
        'new_payment_status', new.payment_status,
        'old_table_label', old.table_label,
        'new_table_label', new.table_label,
        'old_barista_status', old.barista_status,
        'new_barista_status', new.barista_status,
        'deleted_at', new.deleted_at
      );
    end if;

  -- -------------------------------------------------
  -- Order items
  -- -------------------------------------------------

  elsif tg_table_name = 'order_items' then

    if tg_op = 'DELETE' then
      v_order_id := old.order_id;
    else
      v_order_id := new.order_id;
    end if;

    select o.tenant_id, o.branch_id
    into v_tenant_id, v_branch_id
    from public.orders o
    where o.id = v_order_id;

    -- During cascading deletion the parent may no longer
    -- be available. The order_deleted event keeps its snapshot.
    if v_tenant_id is null or v_branch_id is null then
      return null;
    end if;

    if tg_op = 'INSERT' then
      v_event_type := 'item_added';

      v_details := jsonb_build_object(
        'product_name', new.product_name,
        'quantity', new.quantity,
        'unit_price', new.unit_price,
        'notes', new.notes
      );

    elsif tg_op = 'UPDATE' then
      v_event_type := 'item_updated';

      v_details := jsonb_build_object(
        'old_product_name', old.product_name,
        'new_product_name', new.product_name,
        'old_quantity', old.quantity,
        'new_quantity', new.quantity,
        'old_unit_price', old.unit_price,
        'new_unit_price', new.unit_price,
        'old_notes', old.notes,
        'new_notes', new.notes
      );

    else
      v_event_type := 'item_removed';

      v_details := jsonb_build_object(
        'product_name', old.product_name,
        'quantity', old.quantity,
        'unit_price', old.unit_price,
        'notes', old.notes
      );
    end if;

  else
    return null;
  end if;

  -- -------------------------------------------------
  -- Save event
  -- -------------------------------------------------

  if v_order_id is not null
     and v_tenant_id is not null
     and v_branch_id is not null then

    insert into public.order_events (
      tenant_id,
      branch_id,
      order_id,
      actor_id,
      event_type,
      details
    )
    values (
      v_tenant_id,
      v_branch_id,
      v_order_id,
      auth.uid(),
      v_event_type,
      v_details
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

-- =====================================================
-- 6. EVENT TRIGGERS
-- =====================================================

drop trigger if exists trg_capture_order_event
  on public.orders;

create trigger trg_capture_order_event
after insert or update
on public.orders
for each row
execute function public.capture_order_event();

drop trigger if exists trg_capture_order_delete_event
  on public.orders;

create trigger trg_capture_order_delete_event
before delete
on public.orders
for each row
execute function public.capture_order_event();

drop trigger if exists trg_capture_order_item_event
  on public.order_items;

create trigger trg_capture_order_item_event
after insert or update or delete
on public.order_items
for each row
execute function public.capture_order_event();

-- =====================================================
-- 7. ORDER EVENTS SECURITY
-- =====================================================

alter table public.order_events
  enable row level security;

revoke all on table public.order_events
  from public, anon, authenticated, service_role;

grant select on table public.order_events
  to authenticated, service_role;

drop policy if exists "order events read"
  on public.order_events;

drop policy if exists order_events_read_branch
  on public.order_events;

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
        or m.branch_id = order_events.branch_id
        or (
          m.role::text = 'manager'
          and m.branch_id is null
        )
      )
  )
);

-- Trigger function is not an exposed RPC.
revoke all on function public.capture_order_event()
  from public, anon, authenticated;

-- =====================================================
-- 8. SECURE EXISTING SALE FUNCTION
-- Preserves the original VAT, item and inventory logic.
-- Only adds role restriction and payment tracking.
-- =====================================================

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

  -- Only owner, manager and cashier can register sales.
  -- Barista is explicitly excluded.
  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = _tenant
      and m.user_id = v_uid
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text in ('owner', 'manager')
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
    and status = 'open';

  if v_session is null then
    raise exception 'افتح وردية أولاً قبل تسجيل المبيعات';
  end if;

  select *
  into v_t
  from public.tenants
  where id = _tenant;

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
    'completed',
    v_sub,
    v_disc,
    v_tax,
    v_total,
    _payment_method,
    nullif(left(trim(coalesce(_notes, '')), 500), ''),
    v_uid,
    'paid',
    now()
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
        when count(*) over (partition by p.id) > 0
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
  join public.products p
    on p.id = v.product_id
  left join public.recipes r
    on r.id = v.recipe_id;

  -- Original inventory consumption logic is preserved.
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

  return v_order;
end;
$function$;

-- Keep create_sale callable only by authenticated users.
revoke execute on function public.create_sale(
  uuid, uuid, jsonb, text, text, numeric, text
) from public, anon;

grant execute on function public.create_sale(
  uuid, uuid, jsonb, text, text, numeric, text
) to authenticated;

commit;
