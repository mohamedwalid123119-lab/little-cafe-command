
-- Little Cafe Command
-- Order Workflow Foundation
-- Additive and safe foundation

begin;

-- 1. Add order workflow fields without changing
-- the behavior of the existing create_sale function.
alter table public.orders
  add column if not exists table_label text,
  add column if not exists payment_status text,
  add column if not exists sent_to_barista_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid
    references auth.users(id);

-- 2. Payment status validation.
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
end
$$;

-- 3. Order activity history.
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
    references public.tenants(id),
  order_id uuid not null,
  actor_id uuid
    references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_events_order_tenant_fkey
    foreign key (order_id, tenant_id)
    references public.orders(id, tenant_id),

  constraint order_events_type_check
    check (length(trim(event_type)) between 1 and 80)
);

-- 4. Indexes.
create index if not exists idx_order_events_order_created
  on public.order_events (order_id, created_at desc);

create index if not exists idx_order_events_tenant_created
  on public.order_events (tenant_id, created_at desc);

create index if not exists idx_orders_open_branch
  on public.orders (tenant_id, branch_id, created_at desc)
  where status in ('draft', 'pending');

-- 5. Row Level Security.
alter table public.order_events
  enable row level security;

drop policy if exists "order events read"
  on public.order_events;

create policy "order events read"
  on public.order_events
  for select
  to authenticated
  using (
    public.has_module(tenant_id, 'pos')
    or public.has_module(tenant_id, 'reports')
  );

-- No direct insert, update, or delete policies.
-- Event creation will be handled by secured RPC functions.

commit;
