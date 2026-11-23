
-- Little Cafe Command
-- Order Workflow Foundation
-- Safe additive foundation.
-- Does not modify create_sale or deduct inventory.

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
  add column if not exists deleted_by uuid
    references auth.users(id),
  add column if not exists barista_status text
    not null default 'not_sent',
  add column if not exists barista_rejection_reason text,
  add column if not exists barista_responded_at timestamptz;

-- Existing completed sales with a recorded payment method
-- are marked paid. Other existing rows remain unchanged.
update public.orders
set
  payment_status = 'paid',
  paid_at = coalesce(paid_at, created_at)
where status = 'completed'
  and payment_method is not null
  and payment_status is null;

-- =====================================================
-- 2. VALIDATION CONSTRAINTS
-- =====================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
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
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_barista_status_check'
  ) then
    alter table public.orders
      add constraint orders_barista_status_check
      check (
        barista_status in (
          'not_sent',
          'sent',
          'accepted',
          'rejected'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_table_label_length_check'
  ) then
    alter table public.orders
      add constraint orders_table_label_length_check
      check (
        table_label is null
        or char_length(table_label) <= 80
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
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
-- =====================================================

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,

  actor_id uuid
    references auth.users(id)
    on delete set null,

  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_events_order_tenant_fkey
    foreign key (order_id, tenant_id)
    references public.orders(id, tenant_id),

  constraint order_events_branch_tenant_fkey
    foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id),

  constraint order_events_type_check
    check (
      char_length(trim(event_type)) between 1 and 80
    )
);

-- =====================================================
-- 4. INDEXES
-- =====================================================

create index if not exists idx_order_events_order_created
  on public.order_events (
    order_id,
    created_at desc
  );

create index if not exists idx_order_events_branch_created
  on public.order_events (
    tenant_id,
    branch_id,
    created_at desc
  );

create index if not exists idx_orders_open_branch
  on public.orders (
    tenant_id,
    branch_id,
    created_at desc
  )
  where status in ('draft', 'pending')
    and deleted_at is null;

-- =====================================================
-- 5. SECURE AUTOMATIC EVENT CAPTURE
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

  -- -----------------------------------------------
  -- Orders
  -- -----------------------------------------------

  if tg_table_name = 'orders' then

    v_order_id := new.id;
    v_tenant_id := new.tenant_id;
    v_branch_id := new.branch_id;

    if tg_op = 'INSERT' then

      v_event_type := 'order_created';

      v_details := jsonb_build_object(
        'order_number', new.order_number,
        'order_type', new.order_type,
        'status', new.status,
        'total', new.total,
        'table_label', new.table_label
      );

    else

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

  -- -----------------------------------------------
  -- Order items
  -- -----------------------------------------------

  elsif tg_table_name = 'order_items' then

    if tg_op = 'DELETE' then
      v_order_id := old.order_id;
    else
      v_order_id := new.order_id;
    end if;

    select
      o.tenant_id,
      o.branch_id
    into
      v_tenant_id,
      v_branch_id
    from public.orders o
    where o.id = v_order_id;

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

  end if;

  -- -----------------------------------------------
  -- Save event
  -- -----------------------------------------------

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

  return null;

end;
$function$;

-- =====================================================
-- 6. AUTOMATIC EVENT TRIGGERS
-- =====================================================

drop trigger if exists trg_capture_order_event
  on public.orders;

create trigger trg_capture_order_event
after insert or update
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
-- 7. HISTORY TABLE SECURITY
-- =====================================================

alter table public.order_events
  enable row level security;

revoke all on table public.order_events
  from public, anon, authenticated;

grant select on table public.order_events
  to authenticated;

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

-- No direct access to execute the trigger function.
revoke all on function public.capture_order_event()
  from public, anon, authenticated;

commit;
