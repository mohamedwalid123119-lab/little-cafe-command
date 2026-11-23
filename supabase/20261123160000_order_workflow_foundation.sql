
-- Little Cafe Command
-- Order workflow foundation
-- Safe additive migration: preserves existing sales and order records.

begin;

-- 1. Extend existing orders without removing existing columns.
alter table public.orders
  add column if not exists table_label text,
  add column if not exists kitchen_status text not null default 'unsent',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists sent_to_kitchen_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists ready_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists deletion_reason text;

-- Existing completed sales are already paid.
update public.orders
set payment_status = 'paid',
    paid_at = coalesce(paid_at, created_at)
where status = 'completed'
  and payment_method is not null
  and payment_status = 'unpaid';

-- 2. Validate workflow states.
alter table public.orders
  add constraint orders_kitchen_status_check
  check (
    kitchen_status in (
      'unsent',
      'sent',
      'accepted',
      'rejected',
      'preparing',
      'ready'
    )
  );

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'paid'));

alter table public.orders
  add constraint orders_rejection_reason_length_check
  check (
    rejection_reason is null
    or char_length(rejection_reason) <= 500
  );

alter table public.orders
  add constraint orders_deletion_reason_length_check
  check (
    deletion_reason is null
    or char_length(deletion_reason) <= 500
  );

-- 3. Prevent two unpaid active dine-in orders
-- from occupying the same table in the same branch.
create unique index if not exists
  orders_one_unpaid_order_per_table_idx
on public.orders (tenant_id, branch_id, table_label)
where
  order_type = 'dine_in'
  and table_label is not null
  and payment_status = 'unpaid'
  and deleted_at is null
  and status not in ('cancelled', 'refunded');

-- 4. Order activity / modification history.
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  summary text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_events_order_tenant_fkey
    foreign key (order_id, tenant_id)
    references public.orders(id, tenant_id)
    on delete restrict,

  constraint order_events_type_check
    check (
      event_type in (
        'created',
        'updated',
        'item_added',
        'item_removed',
        'quantity_changed',
        'discount_changed',
        'note_changed',
        'sent_to_kitchen',
        'accepted_by_kitchen',
        'rejected_by_kitchen',
        'preparation_started',
        'marked_ready',
        'payment_received',
        'cancelled',
        'deleted',
        'restored',
        'ticket_printed'
      )
    )
);

create index if not exists order_events_order_created_idx
  on public.order_events (tenant_id, order_id, created_at desc);

create index if not exists orders_active_branch_created_idx
  on public.orders (tenant_id, branch_id, created_at desc)
  where deleted_at is null;

-- 5. Secure event history with RLS.
alter table public.order_events enable row level security;

drop policy if exists "order events read" on public.order_events;
create policy "order events read"
on public.order_events
for select
to authenticated
using (
  public.has_module(tenant_id, 'pos')
);

drop policy if exists "order events insert" on public.order_events;
create policy "order events insert"
on public.order_events
for insert
to authenticated
with check (
  public.can_write(tenant_id, 'pos')
  and actor_id = auth.uid()
);

-- No update or delete policy is intentionally provided:
-- activity history must remain append-only for normal users.

commit;
