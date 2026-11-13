-- CAFE OS operations foundation: suppliers, purchasing, stock ledger, cash shifts, orders, expenses.
-- Adapted from "Database Foundation V1" onto the existing tenant model (tenant_id + memberships/modules).
-- No automatic stock deduction, purchase receiving or financial reporting here (next migration).

-- ===== Suppliers =====
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  address text check (address is null or char_length(address) <= 300),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, name)
);
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "suppliers read" on public.suppliers for select to authenticated
  using (public.has_module(tenant_id, 'suppliers') or public.has_module(tenant_id, 'purchasing'));
create policy "suppliers insert" on public.suppliers for insert to authenticated
  with check (public.can_write(tenant_id, 'suppliers') or public.can_write(tenant_id, 'purchasing'));
create policy "suppliers update" on public.suppliers for update to authenticated
  using (public.can_write(tenant_id, 'suppliers') or public.can_write(tenant_id, 'purchasing'))
  with check (public.can_write(tenant_id, 'suppliers') or public.can_write(tenant_id, 'purchasing'));
create policy "suppliers delete" on public.suppliers for delete to authenticated
  using (public.can_write(tenant_id, 'suppliers'));

-- ===== Purchases =====
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  supplier_id uuid,
  reference_number text check (reference_number is null or char_length(reference_number) <= 60),
  status text not null default 'draft' check (status in ('draft','received','cancelled')),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  received_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (branch_id, tenant_id) references public.branches(id, tenant_id),
  foreign key (supplier_id, tenant_id) references public.suppliers(id, tenant_id)
);
grant select, insert, update, delete on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
create policy "purchases read" on public.purchases for select to authenticated
  using (public.has_module(tenant_id, 'purchasing'));
create policy "purchases insert" on public.purchases for insert to authenticated
  with check (public.can_write(tenant_id, 'purchasing'));
create policy "purchases update" on public.purchases for update to authenticated
  using (public.can_write(tenant_id, 'purchasing'))
  with check (public.can_write(tenant_id, 'purchasing'));
create policy "purchases delete drafts" on public.purchases for delete to authenticated
  using (public.can_write(tenant_id, 'purchasing') and status = 'draft');

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),          -- in the ingredient's base unit
  unit_cost numeric(12,4) not null check (unit_cost >= 0),        -- EGP per base unit
  line_total numeric(14,2) generated always as (round(quantity * unit_cost, 2)) stored,
  created_at timestamptz not null default now(),
  foreign key (purchase_id, tenant_id) references public.purchases(id, tenant_id) on delete cascade,
  foreign key (ingredient_id, tenant_id) references public.ingredients(id, tenant_id)
);
grant select, insert, update, delete on public.purchase_items to authenticated;
grant all on public.purchase_items to service_role;
alter table public.purchase_items enable row level security;
create policy "purchase items read" on public.purchase_items for select to authenticated
  using (public.has_module(tenant_id, 'purchasing'));
create policy "purchase items insert" on public.purchase_items for insert to authenticated
  with check (public.can_write(tenant_id, 'purchasing'));
create policy "purchase items update" on public.purchase_items for update to authenticated
  using (public.can_write(tenant_id, 'purchasing'))
  with check (public.can_write(tenant_id, 'purchasing'));
create policy "purchase items delete" on public.purchase_items for delete to authenticated
  using (public.can_write(tenant_id, 'purchasing'));

-- Items may only change while the purchase is a draft; keep total_amount in sync.
create or replace function public.purchase_item_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text; v_pid uuid := coalesce(new.purchase_id, old.purchase_id);
begin
  select status into v_status from public.purchases where id = v_pid;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'لا يمكن تعديل فاتورة شراء بعد استلامها أو إلغائها';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.purchase_item_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pid uuid;
begin
  foreach v_pid in array array_remove(array[
    case when tg_op <> 'INSERT' then old.purchase_id end,
    case when tg_op <> 'DELETE' then new.purchase_id end], null)
  loop
    update public.purchases
       set total_amount = coalesce((select sum(line_total) from public.purchase_items where purchase_id = v_pid), 0)
     where id = v_pid;
  end loop;
  return null;
end $$;

create trigger trg_purchase_item_guard before insert or update or delete on public.purchase_items
  for each row execute function public.purchase_item_guard();
create trigger trg_purchase_item_total after insert or update or delete on public.purchase_items
  for each row execute function public.purchase_item_total();

-- ===== Stock ledger (append-only; corrections are new adjustment rows) =====
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  ingredient_id uuid not null,
  movement_type text not null check (movement_type in ('purchase','sale','waste','adjustment','transfer_in','transfer_out')),
  quantity numeric(14,3) not null check (quantity <> 0),          -- signed, in the ingredient's base unit
  unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
  reference_id uuid,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (branch_id, tenant_id) references public.branches(id, tenant_id),
  foreign key (ingredient_id, tenant_id) references public.ingredients(id, tenant_id),
  check (
    (movement_type in ('purchase','transfer_in') and quantity > 0) or
    (movement_type in ('sale','waste','transfer_out') and quantity < 0) or
    movement_type = 'adjustment'
  )
);
grant select, insert on public.inventory_movements to authenticated;
grant all on public.inventory_movements to service_role;
alter table public.inventory_movements enable row level security;
create policy "movements read" on public.inventory_movements for select to authenticated
  using (public.has_module(tenant_id, 'inventory') or public.has_module(tenant_id, 'purchasing'));
create policy "movements insert" on public.inventory_movements for insert to authenticated
  with check (public.can_write(tenant_id, 'inventory') and created_by = auth.uid());

-- ===== Cash drawer shifts =====
create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  opened_by uuid not null default auth.uid(),
  closed_by uuid,
  opening_balance numeric(14,2) not null default 0 check (opening_balance >= 0),
  closing_balance numeric(14,2) check (closing_balance is null or closing_balance >= 0),
  expected_balance numeric(14,2),
  status text not null default 'open' check (status in ('open','closed')),
  notes text check (notes is null or char_length(notes) <= 500),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (id, tenant_id),
  unique (id, branch_id, tenant_id),
  foreign key (branch_id, tenant_id) references public.branches(id, tenant_id)
);
create unique index uq_cash_sessions_one_open_per_branch on public.cash_sessions(branch_id) where status = 'open';
grant select, insert, update on public.cash_sessions to authenticated;
grant all on public.cash_sessions to service_role;
alter table public.cash_sessions enable row level security;
create policy "cash sessions read" on public.cash_sessions for select to authenticated
  using (public.has_module(tenant_id, 'pos') or public.has_module(tenant_id, 'reports'));
create policy "cash sessions open" on public.cash_sessions for insert to authenticated
  with check (public.can_write(tenant_id, 'pos') and opened_by = auth.uid() and status = 'open');
create policy "cash sessions update open" on public.cash_sessions for update to authenticated
  using (public.can_write(tenant_id, 'pos') and status = 'open')
  with check (public.can_write(tenant_id, 'pos'));

create or replace function public.cash_session_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'closed' then
    raise exception 'الوردية مغلقة ولا يمكن تعديلها';
  end if;
  new.tenant_id := old.tenant_id; new.branch_id := old.branch_id;
  new.opened_by := old.opened_by; new.opened_at := old.opened_at;
  new.opening_balance := old.opening_balance;
  if new.status = 'closed' then
    if new.closing_balance is null then
      raise exception 'يجب إدخال رصيد الإغلاق';
    end if;
    new.closed_by := auth.uid();
    new.closed_at := now();
  end if;
  return new;
end $$;
create trigger trg_cash_session_guard before update on public.cash_sessions
  for each row execute function public.cash_session_guard();

-- ===== Orders =====
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  cash_session_id uuid,
  order_number bigint generated always as identity,
  order_type text not null default 'dine_in' check (order_type in ('dine_in','takeaway','delivery')),
  status text not null default 'completed' check (status in ('draft','pending','completed','cancelled','refunded')),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  tax numeric(14,2) not null default 0 check (tax >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  payment_method text check (payment_method in ('cash','card','wallet','other')),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (branch_id, tenant_id) references public.branches(id, tenant_id),
  foreign key (cash_session_id, branch_id, tenant_id) references public.cash_sessions(id, branch_id, tenant_id)
);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders read" on public.orders for select to authenticated
  using (public.has_module(tenant_id, 'pos') or public.has_module(tenant_id, 'reports'));
create policy "orders insert" on public.orders for insert to authenticated
  with check (public.can_write(tenant_id, 'pos') and created_by = auth.uid());
create policy "orders update" on public.orders for update to authenticated
  using (public.can_write(tenant_id, 'pos'))
  with check (public.can_write(tenant_id, 'pos'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  variant_id uuid,
  product_name text not null check (char_length(product_name) between 1 and 200),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  notes text check (notes is null or char_length(notes) <= 300),
  created_at timestamptz not null default now(),
  foreign key (order_id, tenant_id) references public.orders(id, tenant_id) on delete cascade,
  foreign key (product_id, tenant_id) references public.products(id, tenant_id) on delete set null (product_id),
  foreign key (variant_id, tenant_id) references public.product_variants(id, tenant_id) on delete set null (variant_id)
);
grant select, insert, update, delete on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order items read" on public.order_items for select to authenticated
  using (public.has_module(tenant_id, 'pos') or public.has_module(tenant_id, 'reports'));
create policy "order items insert" on public.order_items for insert to authenticated
  with check (public.can_write(tenant_id, 'pos'));
create policy "order items update" on public.order_items for update to authenticated
  using (public.can_write(tenant_id, 'pos'))
  with check (public.can_write(tenant_id, 'pos'));
create policy "order items delete" on public.order_items for delete to authenticated
  using (public.can_write(tenant_id, 'pos'));

-- Finished orders are locked: no item changes once completed/cancelled/refunded.
create or replace function public.order_item_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  select status into v_status from public.orders where id = coalesce(new.order_id, old.order_id);
  if v_status in ('completed','cancelled','refunded') and tg_op <> 'INSERT' then
    raise exception 'لا يمكن تعديل أصناف طلب مكتمل';
  end if;
  if v_status in ('cancelled','refunded') then
    raise exception 'لا يمكن إضافة أصناف لطلب ملغي أو مسترد';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_order_item_guard before insert or update or delete on public.order_items
  for each row execute function public.order_item_guard();

-- ===== Expenses =====
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  category text not null check (char_length(category) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  amount numeric(14,2) not null check (amount > 0),
  payment_method text check (payment_method is null or payment_method in ('cash','card','wallet','bank_transfer','other')),
  spent_at date not null default (now() at time zone 'Africa/Cairo')::date,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (branch_id, tenant_id) references public.branches(id, tenant_id)
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "expenses read" on public.expenses for select to authenticated
  using (public.has_module(tenant_id, 'expenses') or public.has_module(tenant_id, 'reports'));
create policy "expenses insert" on public.expenses for insert to authenticated
  with check (public.can_write(tenant_id, 'expenses'));
create policy "expenses update" on public.expenses for update to authenticated
  using (public.can_write(tenant_id, 'expenses'))
  with check (public.can_write(tenant_id, 'expenses'));
create policy "expenses delete" on public.expenses for delete to authenticated
  using (public.can_write(tenant_id, 'expenses') and public.is_tenant_owner(tenant_id));

-- ===== Current stock per branch (derived from the ledger; respects caller's RLS) =====
create view public.v_ingredient_stock with (security_invoker = true) as
select m.tenant_id, m.branch_id, m.ingredient_id, sum(m.quantity) as quantity, max(m.created_at) as last_movement_at
from public.inventory_movements m
group by m.tenant_id, m.branch_id, m.ingredient_id;
grant select on public.v_ingredient_stock to authenticated;
grant select on public.v_ingredient_stock to service_role;

-- ===== Indexes =====
create index idx_suppliers_tenant on public.suppliers(tenant_id);
create index idx_purchases_branch_date on public.purchases(branch_id, created_at desc);
create index idx_purchases_tenant on public.purchases(tenant_id);
create index idx_purchase_items_purchase on public.purchase_items(purchase_id);
create index idx_inventory_ingredient_date on public.inventory_movements(ingredient_id, created_at desc);
create index idx_inventory_branch on public.inventory_movements(branch_id, ingredient_id);
create index idx_cash_sessions_branch on public.cash_sessions(branch_id, opened_at desc);
create index idx_orders_branch_date on public.orders(branch_id, created_at desc);
create index idx_orders_tenant_date on public.orders(tenant_id, created_at desc);
create index idx_order_items_order on public.order_items(order_id);
create index idx_expenses_branch_date on public.expenses(branch_id, spent_at desc);

-- ===== updated_at + audit =====
create trigger trg_suppliers_updated before update on public.suppliers for each row execute function public.set_updated_at();
create trigger trg_purchases_updated before update on public.purchases for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();
create trigger trg_expenses_updated before update on public.expenses for each row execute function public.set_updated_at();

create trigger trg_audit_suppliers after insert or update or delete on public.suppliers for each row execute function public.audit_row();
create trigger trg_audit_purchases after insert or update or delete on public.purchases for each row execute function public.audit_row();
create trigger trg_audit_cash_sessions after insert or update on public.cash_sessions for each row execute function public.audit_row();
create trigger trg_audit_orders after insert or update on public.orders for each row execute function public.audit_row();
create trigger trg_audit_expenses after insert or update or delete on public.expenses for each row execute function public.audit_row();
