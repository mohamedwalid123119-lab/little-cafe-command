
-- =========================================================
-- CAFE OS — Stage 1 foundation
-- =========================================================

create type public.app_role as enum ('platform_admin', 'platform_support');
create type public.tenant_role as enum ('owner', 'manager', 'cashier', 'barista', 'inventory_manager');
create type public.tenant_status as enum ('trial', 'active', 'suspended', 'cancelled');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired');
create type public.unit_dimension as enum ('mass', 'volume', 'count');
create type public.ingredient_kind as enum ('raw', 'packaging');
create type public.recipe_kind as enum ('menu_item', 'sub_recipe');
create type public.drink_temperature as enum ('none', 'hot', 'iced');

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- PLATFORM ROLES ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "users read own platform roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- ---------- UNITS ----------
create table public.units (
  code text primary key,
  name_ar text not null,
  dimension public.unit_dimension not null,
  factor_to_base numeric(18,6) not null check (factor_to_base > 0),
  sort_order int not null default 0
);
grant select on public.units to authenticated;
grant all on public.units to service_role;
alter table public.units enable row level security;
create policy "units readable" on public.units for select to authenticated using (true);

insert into public.units (code, name_ar, dimension, factor_to_base, sort_order) values
  ('g',     'جرام',      'mass',   1,    1),
  ('kg',    'كيلو',      'mass',   1000, 2),
  ('ml',    'مللي',      'volume', 1,    3),
  ('l',     'لتر',       'volume', 1000, 4),
  ('pcs',   'قطعة',      'count',  1,    5),
  ('dozen', 'دستة',      'count',  12,   6);

create or replace function public.unit_dim(_code text)
returns public.unit_dimension language sql stable set search_path = public as $$
  select dimension from public.units where code = _code
$$;

create or replace function public.base_unit_for(_dim public.unit_dimension)
returns text language sql immutable as $$
  select case _dim when 'mass' then 'g' when 'volume' then 'ml' else 'pcs' end
$$;

-- ---------- SUBSCRIPTION PLANS ----------
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  price_monthly_egp numeric(12,2) not null default 0 check (price_monthly_egp >= 0),
  max_branches int,
  max_users int,
  trial_days int not null default 14 check (trial_days >= 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.subscription_plans to authenticated;
grant all on public.subscription_plans to service_role;
alter table public.subscription_plans enable row level security;
create policy "plans readable" on public.subscription_plans
  for select to authenticated using (is_active or public.has_role(auth.uid(), 'platform_admin'));

insert into public.subscription_plans (code, name_ar, price_monthly_egp, max_branches, max_users, trial_days, sort_order, features) values
  ('basic',        'الأساسية',   499,  1,    5,    14, 1, '["recipes","cost","products","pos"]'),
  ('professional', 'الاحترافية', 999,  3,    20,   14, 2, '["recipes","cost","products","pos","inventory","purchasing","reports"]'),
  ('enterprise',   'المؤسسات',   1999, null, null, 14, 3, '["all"]');

-- ---------- TENANTS ----------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  city text check (city is null or char_length(city) <= 80),
  currency text not null default 'EGP',
  locale text not null default 'ar-EG',
  timezone text not null default 'Africa/Cairo',
  status public.tenant_status not null default 'trial',
  is_demo boolean not null default false,
  target_food_cost_percent numeric(5,2) not null default 30 check (target_food_cost_percent > 0 and target_food_cost_percent <= 100),
  vat_percent numeric(5,2) not null default 0 check (vat_percent >= 0 and vat_percent < 100),
  prices_include_vat boolean not null default true,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.tenants to authenticated;
grant all on public.tenants to service_role;
alter table public.tenants enable row level security;
create trigger trg_tenants_updated before update on public.tenants for each row execute function public.set_updated_at();

-- ---------- BRANCHES ----------
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  address text check (address is null or char_length(address) <= 300),
  phone text check (phone is null or char_length(phone) <= 30),
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.branches(tenant_id);
grant select, insert, update, delete on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;
create trigger trg_branches_updated before update on public.branches for each row execute function public.set_updated_at();

-- ---------- MEMBERSHIPS ----------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role public.tenant_role not null,
  branch_id uuid,
  modules text[],
  is_active boolean not null default true,
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  foreign key (branch_id, tenant_id) references public.branches(id, tenant_id) on delete set null (branch_id)
);
create index on public.memberships(user_id);
grant select on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;
create trigger trg_memberships_updated before update on public.memberships for each row execute function public.set_updated_at();

-- ---------- ACCESS HELPERS ----------
create or replace function public.role_default_modules(_role public.tenant_role)
returns text[] language sql immutable as $$
  select case _role
    when 'owner' then array['dashboard','pos','products','recipes','cost','inventory','purchasing','suppliers','expenses','reports','employees','settings']
    when 'manager' then array['dashboard','pos','products','recipes','cost','inventory','purchasing','suppliers','expenses','reports']
    when 'cashier' then array['pos']
    when 'barista' then array['pos']
    when 'inventory_manager' then array['dashboard','inventory','purchasing','suppliers']
  end
$$;

create or replace function public.is_tenant_member(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
    where tenant_id = _tenant and user_id = auth.uid() and is_active)
$$;

create or replace function public.has_module(_tenant uuid, _module text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = _tenant and m.user_id = auth.uid() and m.is_active
      and (m.role = 'owner' or _module = any (coalesce(m.modules, public.role_default_modules(m.role))))
  )
$$;

create or replace function public.tenant_is_writable(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tenants where id = _tenant and status in ('trial','active'))
$$;

create or replace function public.can_write(_tenant uuid, _module text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_module(_tenant, _module) and public.tenant_is_writable(_tenant)
$$;

create or replace function public.is_tenant_owner(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships
    where tenant_id = _tenant and user_id = auth.uid() and is_active and role = 'owner')
$$;

create or replace function public.shares_tenant_with(_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b on a.tenant_id = b.tenant_id
    where a.user_id = auth.uid() and a.is_active and b.user_id = _other
  )
$$;

create policy "read own or teammates profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_tenant_with(id));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

create policy "members read tenant" on public.tenants
  for select to authenticated using (public.is_tenant_member(id) or public.has_role(auth.uid(), 'platform_admin'));
create policy "settings managers update tenant" on public.tenants
  for update to authenticated using (public.has_module(id, 'settings')) with check (public.has_module(id, 'settings'));

create or replace function public.protect_tenant_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'platform_admin') then
    if new.status is distinct from old.status
       or new.is_demo is distinct from old.is_demo
       or new.created_by is distinct from old.created_by
       or new.currency is distinct from old.currency then
      raise exception 'غير مسموح بتعديل حالة الحساب أو بياناته الأساسية';
    end if;
  end if;
  return new;
end $$;
create trigger trg_tenants_protect before update on public.tenants for each row execute function public.protect_tenant_columns();

create policy "members read branches" on public.branches
  for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "settings write branches" on public.branches
  for insert to authenticated with check (public.can_write(tenant_id, 'settings'));
create policy "settings update branches" on public.branches
  for update to authenticated using (public.can_write(tenant_id, 'settings')) with check (public.can_write(tenant_id, 'settings'));
create policy "settings delete branches" on public.branches
  for delete to authenticated using (public.can_write(tenant_id, 'settings') and not is_main);

create policy "members read memberships" on public.memberships
  for select to authenticated using (user_id = auth.uid() or public.is_tenant_member(tenant_id));

-- ---------- SUBSCRIPTIONS ----------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.subscriptions(tenant_id);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create trigger trg_subscriptions_updated before update on public.subscriptions for each row execute function public.set_updated_at();
create policy "owners read subscription" on public.subscriptions
  for select to authenticated using (public.has_module(tenant_id, 'settings') or public.has_role(auth.uid(), 'platform_admin'));

create table public.subscription_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  event text not null,
  from_status public.subscription_status,
  to_status public.subscription_status,
  plan_id uuid references public.subscription_plans(id),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.subscription_history(tenant_id);
grant select on public.subscription_history to authenticated;
grant all on public.subscription_history to service_role;
alter table public.subscription_history enable row level security;
create policy "owners read subscription history" on public.subscription_history
  for select to authenticated using (public.has_module(tenant_id, 'settings') or public.has_role(auth.uid(), 'platform_admin'));

-- ---------- AUDIT LOG ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(tenant_id, created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "owners managers read audit" on public.audit_logs
  for select to authenticated using (
    (tenant_id is not null and (public.is_tenant_owner(tenant_id) or public.has_module(tenant_id, 'employees')))
    or (tenant_id is null and public.has_role(auth.uid(), 'platform_admin'))
  );

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_tenant uuid;
  v_details jsonb := '{}'::jsonb;
begin
  v_tenant := case when tg_table_name = 'tenants' then (v_row->>'id')::uuid else (v_row->>'tenant_id')::uuid end;
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', v_old->n.key, 'to', n.value)), '{}'::jsonb)
      into v_details
    from jsonb_each(v_new) n
    where n.key not in ('updated_at') and (v_old->n.key) is distinct from n.value;
    if v_details = '{}'::jsonb then return null; end if;
  end if;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, summary, details)
  values (v_tenant, auth.uid(), lower(tg_op), tg_table_name, (v_row->>'id')::uuid, v_row->>'name', v_details);
  return null;
end $$;

create trigger trg_audit_tenants after update on public.tenants for each row execute function public.audit_row();
create trigger trg_audit_branches after insert or update or delete on public.branches for each row execute function public.audit_row();

-- ---------- CATEGORIES ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, name)
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create trigger trg_categories_updated before update on public.categories for each row execute function public.set_updated_at();
create policy "members read categories" on public.categories for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "products module insert categories" on public.categories for insert to authenticated with check (public.can_write(tenant_id, 'products'));
create policy "products module update categories" on public.categories for update to authenticated using (public.can_write(tenant_id, 'products')) with check (public.can_write(tenant_id, 'products'));
create policy "products module delete categories" on public.categories for delete to authenticated using (public.can_write(tenant_id, 'products'));
create trigger trg_audit_categories after insert or update or delete on public.categories for each row execute function public.audit_row();

-- ---------- INGREDIENTS ----------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind public.ingredient_kind not null default 'raw',
  group_name text check (group_name is null or char_length(group_name) <= 60),
  purchase_unit text not null references public.units(code),
  purchase_quantity numeric(14,4) not null check (purchase_quantity > 0),
  purchase_price numeric(14,4) not null check (purchase_price >= 0),
  base_unit text not null default 'g' references public.units(code),
  cost_per_base_unit numeric(20,8) not null default 0,
  sku text check (sku is null or char_length(sku) <= 60),
  notes text check (notes is null or char_length(notes) <= 500),
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, name)
);
create index on public.ingredients(tenant_id);
grant select, insert, update, delete on public.ingredients to authenticated;
grant all on public.ingredients to service_role;
alter table public.ingredients enable row level security;
create trigger trg_ingredients_updated before update on public.ingredients for each row execute function public.set_updated_at();

create policy "cost modules read ingredients" on public.ingredients for select to authenticated using (
  public.has_module(tenant_id, 'recipes') or public.has_module(tenant_id, 'cost')
  or public.has_module(tenant_id, 'inventory') or public.has_module(tenant_id, 'purchasing'));
create policy "recipe or inventory insert ingredients" on public.ingredients for insert to authenticated with check (
  public.can_write(tenant_id, 'recipes') or public.can_write(tenant_id, 'inventory'));
create policy "recipe or inventory update ingredients" on public.ingredients for update to authenticated
  using (public.can_write(tenant_id, 'recipes') or public.can_write(tenant_id, 'inventory'))
  with check (public.can_write(tenant_id, 'recipes') or public.can_write(tenant_id, 'inventory'));
create policy "recipe or inventory delete ingredients" on public.ingredients for delete to authenticated using (
  public.can_write(tenant_id, 'recipes') or public.can_write(tenant_id, 'inventory'));

create table public.ingredient_cost_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  old_purchase_price numeric(14,4),
  new_purchase_price numeric(14,4) not null,
  old_purchase_quantity numeric(14,4),
  new_purchase_quantity numeric(14,4) not null,
  old_purchase_unit text,
  new_purchase_unit text not null,
  old_cost_per_base_unit numeric(20,8),
  new_cost_per_base_unit numeric(20,8) not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index on public.ingredient_cost_history(tenant_id, created_at desc);
create index on public.ingredient_cost_history(ingredient_id, created_at desc);
grant select on public.ingredient_cost_history to authenticated;
grant all on public.ingredient_cost_history to service_role;
alter table public.ingredient_cost_history enable row level security;
create policy "cost modules read ingredient history" on public.ingredient_cost_history for select to authenticated using (
  public.has_module(tenant_id, 'recipes') or public.has_module(tenant_id, 'cost')
  or public.has_module(tenant_id, 'inventory') or public.has_module(tenant_id, 'purchasing'));

-- ---------- RECIPES ----------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  kind public.recipe_kind not null default 'menu_item',
  yield_quantity numeric(14,4) not null default 1 check (yield_quantity > 0),
  yield_unit text not null default 'pcs' references public.units(code),
  waste_percent numeric(5,2) not null default 0 check (waste_percent >= 0 and waste_percent < 100),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  ingredient_cost numeric(16,4) not null default 0,
  packaging_cost numeric(16,4) not null default 0,
  optional_cost numeric(16,4) not null default 0,
  waste_cost numeric(16,4) not null default 0,
  total_cost numeric(16,4) not null default 0,
  cost_per_unit numeric(20,8) not null default 0,
  cost_per_portion numeric(16,4) not null default 0,
  cost_updated_at timestamptz,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.recipes(tenant_id);
grant select, insert, update, delete on public.recipes to authenticated;
grant all on public.recipes to service_role;
alter table public.recipes enable row level security;
create trigger trg_recipes_updated before update on public.recipes for each row execute function public.set_updated_at();
create policy "recipe modules read recipes" on public.recipes for select to authenticated using (
  public.has_module(tenant_id, 'recipes') or public.has_module(tenant_id, 'cost'));
create policy "recipes module insert recipes" on public.recipes for insert to authenticated with check (public.can_write(tenant_id, 'recipes'));
create policy "recipes module update recipes" on public.recipes for update to authenticated using (public.can_write(tenant_id, 'recipes')) with check (public.can_write(tenant_id, 'recipes'));
create policy "recipes module delete recipes" on public.recipes for delete to authenticated using (public.can_write(tenant_id, 'recipes'));

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipe_id uuid not null,
  ingredient_id uuid,
  sub_recipe_id uuid,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null references public.units(code),
  is_optional boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 300),
  sort_order int not null default 0,
  line_cost numeric(16,4) not null default 0,
  created_at timestamptz not null default now(),
  check ((ingredient_id is null) <> (sub_recipe_id is null)),
  check (sub_recipe_id is null or sub_recipe_id <> recipe_id),
  foreign key (recipe_id, tenant_id) references public.recipes(id, tenant_id) on delete cascade,
  foreign key (ingredient_id, tenant_id) references public.ingredients(id, tenant_id) on delete restrict,
  foreign key (sub_recipe_id, tenant_id) references public.recipes(id, tenant_id) on delete restrict
);
create index on public.recipe_items(recipe_id);
create index on public.recipe_items(ingredient_id);
create index on public.recipe_items(sub_recipe_id);
grant select, insert, update, delete on public.recipe_items to authenticated;
grant all on public.recipe_items to service_role;
alter table public.recipe_items enable row level security;
create policy "recipe modules read items" on public.recipe_items for select to authenticated using (
  public.has_module(tenant_id, 'recipes') or public.has_module(tenant_id, 'cost'));
create policy "recipes module insert items" on public.recipe_items for insert to authenticated with check (public.can_write(tenant_id, 'recipes'));
create policy "recipes module update items" on public.recipe_items for update to authenticated using (public.can_write(tenant_id, 'recipes')) with check (public.can_write(tenant_id, 'recipes'));
create policy "recipes module delete items" on public.recipe_items for delete to authenticated using (public.can_write(tenant_id, 'recipes'));

create table public.recipe_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_cost numeric(16,4) not null,
  packaging_cost numeric(16,4) not null,
  waste_cost numeric(16,4) not null,
  total_cost numeric(16,4) not null,
  cost_per_portion numeric(16,4) not null,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.recipe_cost_snapshots(recipe_id, created_at desc);
create index on public.recipe_cost_snapshots(tenant_id, created_at desc);
grant select on public.recipe_cost_snapshots to authenticated;
grant all on public.recipe_cost_snapshots to service_role;
alter table public.recipe_cost_snapshots enable row level security;
create policy "recipe modules read snapshots" on public.recipe_cost_snapshots for select to authenticated using (
  public.has_module(tenant_id, 'recipes') or public.has_module(tenant_id, 'cost'));

-- ---------- PRODUCTS / VARIANTS / MODIFIERS ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  image_path text check (image_path is null or char_length(image_path) <= 500),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (category_id, tenant_id) references public.categories(id, tenant_id) on delete set null (category_id)
);
create index on public.products(tenant_id);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create policy "members read products" on public.products for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "products module insert products" on public.products for insert to authenticated with check (public.can_write(tenant_id, 'products'));
create policy "products module update products" on public.products for update to authenticated using (public.can_write(tenant_id, 'products')) with check (public.can_write(tenant_id, 'products'));
create policy "products module delete products" on public.products for delete to authenticated using (public.can_write(tenant_id, 'products'));

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  temperature public.drink_temperature not null default 'none',
  selling_price numeric(12,2) not null check (selling_price >= 0),
  recipe_id uuid,
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (product_id, tenant_id) references public.products(id, tenant_id) on delete cascade,
  foreign key (recipe_id, tenant_id) references public.recipes(id, tenant_id) on delete set null (recipe_id)
);
create index on public.product_variants(product_id);
create index on public.product_variants(recipe_id);
grant select, insert, update, delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create trigger trg_variants_updated before update on public.product_variants for each row execute function public.set_updated_at();
create policy "members read variants" on public.product_variants for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "products module insert variants" on public.product_variants for insert to authenticated with check (public.can_write(tenant_id, 'products'));
create policy "products module update variants" on public.product_variants for update to authenticated using (public.can_write(tenant_id, 'products')) with check (public.can_write(tenant_id, 'products'));
create policy "products module delete variants" on public.product_variants for delete to authenticated using (public.can_write(tenant_id, 'products'));

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  price_delta numeric(12,2) not null default 0 check (price_delta >= 0),
  ingredient_id uuid,
  quantity numeric(14,4) check (quantity is null or quantity > 0),
  unit text references public.units(code),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  check ((ingredient_id is null and quantity is null and unit is null) or (ingredient_id is not null and quantity is not null and unit is not null)),
  foreign key (ingredient_id, tenant_id) references public.ingredients(id, tenant_id) on delete restrict
);
create index on public.modifiers(tenant_id);
grant select, insert, update, delete on public.modifiers to authenticated;
grant all on public.modifiers to service_role;
alter table public.modifiers enable row level security;
create trigger trg_modifiers_updated before update on public.modifiers for each row execute function public.set_updated_at();
create policy "members read modifiers" on public.modifiers for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "products module insert modifiers" on public.modifiers for insert to authenticated with check (public.can_write(tenant_id, 'products'));
create policy "products module update modifiers" on public.modifiers for update to authenticated using (public.can_write(tenant_id, 'products')) with check (public.can_write(tenant_id, 'products'));
create policy "products module delete modifiers" on public.modifiers for delete to authenticated using (public.can_write(tenant_id, 'products'));

create table public.product_modifiers (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null,
  modifier_id uuid not null,
  primary key (product_id, modifier_id),
  foreign key (product_id, tenant_id) references public.products(id, tenant_id) on delete cascade,
  foreign key (modifier_id, tenant_id) references public.modifiers(id, tenant_id) on delete cascade
);
grant select, insert, update, delete on public.product_modifiers to authenticated;
grant all on public.product_modifiers to service_role;
alter table public.product_modifiers enable row level security;
create policy "members read product modifiers" on public.product_modifiers for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "products module insert product modifiers" on public.product_modifiers for insert to authenticated with check (public.can_write(tenant_id, 'products'));
create policy "products module delete product modifiers" on public.product_modifiers for delete to authenticated using (public.can_write(tenant_id, 'products'));

create trigger trg_audit_products after insert or update or delete on public.products for each row execute function public.audit_row();
create trigger trg_audit_variants after insert or update or delete on public.product_variants for each row execute function public.audit_row();
create trigger trg_audit_ingredients after insert or update or delete on public.ingredients for each row execute function public.audit_row();
create trigger trg_audit_recipes after insert or delete or update of name, kind, yield_quantity, yield_unit, waste_percent, instructions on public.recipes for each row execute function public.audit_row();
create trigger trg_audit_modifiers after insert or update or delete on public.modifiers for each row execute function public.audit_row();

-- =========================================================
-- COSTING ENGINE
-- =========================================================
create or replace function public.ingredient_compute_cost()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dim public.unit_dimension;
  v_factor numeric;
begin
  select dimension, factor_to_base into v_dim, v_factor from public.units where code = new.purchase_unit;
  if v_dim is null then raise exception 'وحدة الشراء غير معروفة'; end if;
  if tg_op = 'UPDATE' and public.unit_dim(old.base_unit) is distinct from v_dim then
    if exists (select 1 from public.recipe_items where ingredient_id = new.id)
       or exists (select 1 from public.modifiers where ingredient_id = new.id) then
      raise exception 'لا يمكن تغيير نوع وحدة الخامة (وزن/حجم/عدد) لأنها مستخدمة في ريسبي';
    end if;
  end if;
  new.base_unit := public.base_unit_for(v_dim);
  new.cost_per_base_unit := new.purchase_price / (new.purchase_quantity * v_factor);
  return new;
end $$;
create trigger trg_ingredient_compute before insert or update on public.ingredients
  for each row execute function public.ingredient_compute_cost();

create or replace function public.recalc_recipe(_recipe uuid, _reason text default 'recalc')
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.recipes%rowtype;
  v_ing numeric := 0; v_pack numeric := 0; v_opt numeric := 0;
  v_waste numeric; v_total numeric; v_yield_base numeric; v_cpu numeric; v_cpp numeric;
  v_parent uuid;
begin
  select * into r from public.recipes where id = _recipe for update;
  if not found then return; end if;

  update public.recipe_items ri
     set line_cost = round(s.c, 4)
    from (
      select ri2.id,
             ri2.quantity * u.factor_to_base * coalesce(i.cost_per_base_unit, sr.cost_per_unit, 0) as c
        from public.recipe_items ri2
        join public.units u on u.code = ri2.unit
        left join public.ingredients i on i.id = ri2.ingredient_id
        left join public.recipes sr on sr.id = ri2.sub_recipe_id
       where ri2.recipe_id = _recipe
    ) s
   where ri.id = s.id and ri.line_cost is distinct from round(s.c, 4);

  select
    coalesce(sum(ri.line_cost) filter (where not ri.is_optional and (ri.sub_recipe_id is not null or i.kind = 'raw')), 0),
    coalesce(sum(ri.line_cost) filter (where not ri.is_optional and i.kind = 'packaging'), 0),
    coalesce(sum(ri.line_cost) filter (where ri.is_optional), 0)
    into v_ing, v_pack, v_opt
  from public.recipe_items ri
  left join public.ingredients i on i.id = ri.ingredient_id
  where ri.recipe_id = _recipe;

  v_waste := round(v_ing * r.waste_percent / 100, 4);
  v_total := round(v_ing + v_pack + v_waste, 4);
  select r.yield_quantity * factor_to_base into v_yield_base from public.units where code = r.yield_unit;
  v_cpu := v_total / v_yield_base;
  v_cpp := round(v_total / r.yield_quantity, 4);

  update public.recipes set
    ingredient_cost = round(v_ing, 4), packaging_cost = round(v_pack, 4), optional_cost = round(v_opt, 4),
    waste_cost = v_waste, total_cost = v_total, cost_per_unit = v_cpu, cost_per_portion = v_cpp,
    cost_updated_at = now()
  where id = _recipe;

  if r.cost_updated_at is null or r.total_cost is distinct from v_total or r.cost_per_portion is distinct from v_cpp then
    insert into public.recipe_cost_snapshots (tenant_id, recipe_id, ingredient_cost, packaging_cost, waste_cost, total_cost, cost_per_portion, reason)
    values (r.tenant_id, _recipe, round(v_ing, 4), round(v_pack, 4), v_waste, v_total, v_cpp, _reason);
  end if;

  if r.cost_per_unit is distinct from v_cpu then
    for v_parent in select distinct recipe_id from public.recipe_items where sub_recipe_id = _recipe loop
      perform public.recalc_recipe(v_parent, 'sub_recipe_changed');
    end loop;
  end if;
end $$;
revoke execute on function public.recalc_recipe(uuid, text) from public, anon, authenticated;

create or replace function public.ingredient_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_recipe uuid;
begin
  if new.cost_per_base_unit is distinct from old.cost_per_base_unit then
    insert into public.ingredient_cost_history (
      tenant_id, ingredient_id, old_purchase_price, new_purchase_price, old_purchase_quantity, new_purchase_quantity,
      old_purchase_unit, new_purchase_unit, old_cost_per_base_unit, new_cost_per_base_unit, changed_by)
    values (new.tenant_id, new.id, old.purchase_price, new.purchase_price, old.purchase_quantity, new.purchase_quantity,
      old.purchase_unit, new.purchase_unit, old.cost_per_base_unit, new.cost_per_base_unit, auth.uid());
    for v_recipe in select distinct recipe_id from public.recipe_items where ingredient_id = new.id loop
      perform public.recalc_recipe(v_recipe, 'ingredient_price_changed');
    end loop;
  end if;
  return null;
end $$;
create trigger trg_ingredient_after_change after update on public.ingredients
  for each row execute function public.ingredient_after_change();

create or replace function public.recipe_item_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_item_dim public.unit_dimension := public.unit_dim(new.unit);
  v_target_dim public.unit_dimension;
  v_kind public.recipe_kind;
  v_cycle boolean;
begin
  if new.ingredient_id is not null then
    select public.unit_dim(base_unit) into v_target_dim from public.ingredients where id = new.ingredient_id;
  else
    select public.unit_dim(yield_unit), kind into v_target_dim, v_kind from public.recipes where id = new.sub_recipe_id;
    if v_kind is distinct from 'sub_recipe' then
      raise exception 'يمكن إضافة ريسبي فرعي (تحضير مسبق) فقط داخل ريسبي آخر';
    end if;
    with recursive descendants(id) as (
      select new.sub_recipe_id
      union
      select ri.sub_recipe_id from public.recipe_items ri join descendants d on ri.recipe_id = d.id
      where ri.sub_recipe_id is not null
    )
    select exists (select 1 from descendants where id = new.recipe_id) into v_cycle;
    if v_cycle then raise exception 'لا يمكن إضافة هذا التحضير لأنه يسبب دائرة (ريسبي يحتوي نفسه)'; end if;
  end if;
  if v_target_dim is null then raise exception 'المكون غير موجود'; end if;
  if v_item_dim is distinct from v_target_dim then
    raise exception 'وحدة غير متوافقة: لا يمكن تحويل % إلى وحدة المكون', new.unit;
  end if;
  return new;
end $$;
create trigger trg_recipe_item_validate before insert or update of quantity, unit, ingredient_id, sub_recipe_id
  on public.recipe_items for each row execute function public.recipe_item_validate();

create or replace function public.recipe_item_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_recipe(old.recipe_id, 'recipe_edited');
  else
    perform public.recalc_recipe(new.recipe_id, 'recipe_edited');
    if tg_op = 'UPDATE' and old.recipe_id <> new.recipe_id then
      perform public.recalc_recipe(old.recipe_id, 'recipe_edited');
    end if;
  end if;
  return null;
end $$;
create trigger trg_recipe_item_after after insert or delete or update of quantity, unit, ingredient_id, sub_recipe_id, is_optional, recipe_id
  on public.recipe_items for each row execute function public.recipe_item_after_change();

create or replace function public.recipe_validate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'menu_item' and public.unit_dim(new.yield_unit) <> 'count' then
    raise exception 'ريسبي المنتج يجب أن يكون إنتاجه بعدد حصص (قطعة)';
  end if;
  if tg_op = 'UPDATE' then
    if public.unit_dim(old.yield_unit) is distinct from public.unit_dim(new.yield_unit)
       and exists (select 1 from public.recipe_items where sub_recipe_id = new.id) then
      raise exception 'لا يمكن تغيير نوع وحدة الإنتاج لأن هذا التحضير مستخدم في ريسبي آخر';
    end if;
    if old.kind = 'sub_recipe' and new.kind = 'menu_item' and exists (select 1 from public.recipe_items where sub_recipe_id = new.id) then
      raise exception 'لا يمكن تحويل التحضير لمنتج لأنه مستخدم في ريسبي آخر';
    end if;
  end if;
  return new;
end $$;
create trigger trg_recipe_validate before insert or update of kind, yield_unit on public.recipes
  for each row execute function public.recipe_validate();

create or replace function public.recipe_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalc_recipe(new.id, 'created');
  else
    perform public.recalc_recipe(new.id, 'yield_or_waste_changed');
  end if;
  return null;
end $$;
create trigger trg_recipe_after_insert after insert on public.recipes for each row execute function public.recipe_after_change();
create trigger trg_recipe_after_update after update of yield_quantity, yield_unit, waste_percent on public.recipes
  for each row execute function public.recipe_after_change();

create or replace function public.modifier_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dim public.unit_dimension;
begin
  if new.ingredient_id is not null then
    select public.unit_dim(base_unit) into v_dim from public.ingredients where id = new.ingredient_id;
    if v_dim is distinct from public.unit_dim(new.unit) then
      raise exception 'وحدة الإضافة غير متوافقة مع وحدة الخامة';
    end if;
  end if;
  return new;
end $$;
create trigger trg_modifier_validate before insert or update on public.modifiers for each row execute function public.modifier_validate();

-- ---------- COSTING VIEWS ----------
create view public.v_variant_costing with (security_invoker = on) as
select
  v.id as variant_id, v.tenant_id, v.product_id, p.name as product_name, p.image_path, p.is_active as product_active,
  p.category_id, c.name as category_name, v.name as variant_name, v.temperature, v.is_active,
  v.selling_price,
  round(case when t.prices_include_vat then v.selling_price / (1 + t.vat_percent / 100) else v.selling_price end, 4) as net_price,
  t.target_food_cost_percent,
  r.id as recipe_id, r.name as recipe_name,
  round(r.ingredient_cost / r.yield_quantity, 4) as ingredient_cost,
  round(r.packaging_cost / r.yield_quantity, 4) as packaging_cost,
  round(r.waste_cost / r.yield_quantity, 4) as waste_cost,
  r.cost_per_portion as total_cost,
  r.cost_updated_at,
  prev.cost_per_portion as previous_total_cost,
  prev.created_at as previous_cost_at
from public.product_variants v
join public.products p on p.id = v.product_id
join public.tenants t on t.id = v.tenant_id
left join public.categories c on c.id = p.category_id
left join public.recipes r on r.id = v.recipe_id
left join lateral (
  select s.cost_per_portion, s.created_at from public.recipe_cost_snapshots s
  where s.recipe_id = r.id order by s.created_at desc offset 1 limit 1
) prev on true;
grant select on public.v_variant_costing to authenticated;

create view public.v_modifier_costing with (security_invoker = on) as
select m.id as modifier_id, m.tenant_id, m.name, m.price_delta, m.ingredient_id, i.name as ingredient_name,
  m.quantity, m.unit, m.is_active,
  round(m.quantity * u.factor_to_base * i.cost_per_base_unit, 4) as cost
from public.modifiers m
left join public.ingredients i on i.id = m.ingredient_id
left join public.units u on u.code = m.unit;
grant select on public.v_modifier_costing to authenticated;

-- =========================================================
-- RPCs
-- =========================================================
create or replace function public.seed_demo_data(_tenant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c_hot uuid; c_iced uuid; c_tea uuid;
  i_beans uuid; i_milk uuid; i_cond uuid; i_caramel uuid; i_choc uuid; i_matcha uuid; i_sugar uuid; i_ice uuid;
  i_cup8 uuid; i_cup12 uuid; i_cupiced uuid; i_lid uuid; i_straw uuid; i_tea uuid;
  r_esp uuid; r_sl_hot uuid; r_sl_iced uuid; r_cap uuid; r_matcha uuid; r_single uuid; r_tea uuid;
  p_esp uuid; p_sl uuid; p_cap uuid; p_matcha uuid; p_tea uuid;
begin
  if not exists (select 1 from public.tenants where id = _tenant and is_demo) then
    raise exception 'البيانات التجريبية متاحة فقط في الحساب التجريبي';
  end if;

  insert into public.categories (tenant_id, name, sort_order) values (_tenant, 'قهوة ساخنة', 1) returning id into c_hot;
  insert into public.categories (tenant_id, name, sort_order) values (_tenant, 'قهوة مثلجة', 2) returning id into c_iced;
  insert into public.categories (tenant_id, name, sort_order) values (_tenant, 'شاي ومشروبات', 3) returning id into c_tea;

  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'بن إسبريسو', 'raw', 'بن', 'kg', 1, 950) returning id into i_beans;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'لبن كامل الدسم', 'raw', 'ألبان', 'l', 1, 42) returning id into i_milk;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'لبن مكثف محلى', 'raw', 'ألبان', 'g', 370, 48) returning id into i_cond;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'سيروب كراميل', 'raw', 'سيروب', 'ml', 750, 380) returning id into i_caramel;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'صوص شوكولاتة', 'raw', 'صوصات', 'kg', 1, 300) returning id into i_choc;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'ماتشا', 'raw', 'شاي', 'g', 100, 480) returning id into i_matcha;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'شاي أسود', 'raw', 'شاي', 'g', 250, 95) returning id into i_tea;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'سكر', 'raw', 'جاف', 'kg', 1, 38) returning id into i_sugar;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'ثلج', 'raw', 'ثلج', 'kg', 10, 40) returning id into i_ice;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'كوب ورق 8 أونص', 'packaging', 'تغليف', 'pcs', 50, 125) returning id into i_cup8;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'كوب ورق 12 أونص', 'packaging', 'تغليف', 'pcs', 50, 160) returning id into i_cup12;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'كوب بلاستيك مثلج 16 أونص', 'packaging', 'تغليف', 'pcs', 50, 185) returning id into i_cupiced;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'غطاء كوب', 'packaging', 'تغليف', 'pcs', 100, 95) returning id into i_lid;
  insert into public.ingredients (tenant_id, name, kind, group_name, purchase_unit, purchase_quantity, purchase_price) values (_tenant, 'شفاط', 'packaging', 'تغليف', 'pcs', 100, 45) returning id into i_straw;

  insert into public.recipes (tenant_id, name, kind, yield_quantity, yield_unit, waste_percent, instructions)
  values (_tenant, 'دبل شوت إسبريسو', 'sub_recipe', 60, 'ml', 0, '18 جم بن مطحون — استخلاص 28 ثانية') returning id into r_esp;
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values (_tenant, r_esp, i_beans, 18, 'g');

  insert into public.recipes (tenant_id, name, kind, waste_percent) values (_tenant, 'إسبريسو - دبل', 'menu_item', 2) returning id into r_single;
  insert into public.recipe_items (tenant_id, recipe_id, sub_recipe_id, quantity, unit) values (_tenant, r_single, r_esp, 60, 'ml');
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values (_tenant, r_single, i_cup8, 1, 'pcs');
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit, is_optional) values (_tenant, r_single, i_sugar, 10, 'g', true);

  insert into public.recipes (tenant_id, name, kind, waste_percent) values (_tenant, 'سبانش لاتيه - وسط ساخن', 'menu_item', 3) returning id into r_sl_hot;
  insert into public.recipe_items (tenant_id, recipe_id, sub_recipe_id, quantity, unit) values (_tenant, r_sl_hot, r_esp, 60, 'ml');
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values
    (_tenant, r_sl_hot, i_milk, 220, 'ml'), (_tenant, r_sl_hot, i_cond, 30, 'g'),
    (_tenant, r_sl_hot, i_cup12, 1, 'pcs'), (_tenant, r_sl_hot, i_lid, 1, 'pcs');

  insert into public.recipes (tenant_id, name, kind, waste_percent) values (_tenant, 'سبانش لاتيه - وسط مثلج', 'menu_item', 3) returning id into r_sl_iced;
  insert into public.recipe_items (tenant_id, recipe_id, sub_recipe_id, quantity, unit) values (_tenant, r_sl_iced, r_esp, 60, 'ml');
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values
    (_tenant, r_sl_iced, i_milk, 180, 'ml'), (_tenant, r_sl_iced, i_cond, 30, 'g'), (_tenant, r_sl_iced, i_ice, 150, 'g'),
    (_tenant, r_sl_iced, i_cupiced, 1, 'pcs'), (_tenant, r_sl_iced, i_lid, 1, 'pcs'), (_tenant, r_sl_iced, i_straw, 1, 'pcs');

  insert into public.recipes (tenant_id, name, kind, waste_percent) values (_tenant, 'كابتشينو - وسط', 'menu_item', 3) returning id into r_cap;
  insert into public.recipe_items (tenant_id, recipe_id, sub_recipe_id, quantity, unit) values (_tenant, r_cap, r_esp, 60, 'ml');
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values
    (_tenant, r_cap, i_milk, 180, 'ml'), (_tenant, r_cap, i_cup12, 1, 'pcs'), (_tenant, r_cap, i_lid, 1, 'pcs');
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit, is_optional) values (_tenant, r_cap, i_choc, 5, 'g', true);

  insert into public.recipes (tenant_id, name, kind, waste_percent) values (_tenant, 'ماتشا لاتيه مثلج', 'menu_item', 5) returning id into r_matcha;
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values
    (_tenant, r_matcha, i_matcha, 4, 'g'), (_tenant, r_matcha, i_milk, 220, 'ml'), (_tenant, r_matcha, i_ice, 150, 'g'),
    (_tenant, r_matcha, i_caramel, 15, 'ml'),
    (_tenant, r_matcha, i_cupiced, 1, 'pcs'), (_tenant, r_matcha, i_lid, 1, 'pcs'), (_tenant, r_matcha, i_straw, 1, 'pcs');

  insert into public.recipes (tenant_id, name, kind, waste_percent) values (_tenant, 'شاي - كوب', 'menu_item', 0) returning id into r_tea;
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, quantity, unit) values
    (_tenant, r_tea, i_tea, 3, 'g'), (_tenant, r_tea, i_sugar, 10, 'g'), (_tenant, r_tea, i_cup8, 1, 'pcs');

  insert into public.products (tenant_id, category_id, name, sort_order) values (_tenant, c_hot, 'إسبريسو', 1) returning id into p_esp;
  insert into public.products (tenant_id, category_id, name, sort_order) values (_tenant, c_hot, 'سبانش لاتيه', 2) returning id into p_sl;
  insert into public.products (tenant_id, category_id, name, sort_order) values (_tenant, c_hot, 'كابتشينو', 3) returning id into p_cap;
  insert into public.products (tenant_id, category_id, name, sort_order) values (_tenant, c_iced, 'ماتشا لاتيه', 1) returning id into p_matcha;
  insert into public.products (tenant_id, category_id, name, sort_order) values (_tenant, c_tea, 'شاي', 1) returning id into p_tea;

  insert into public.product_variants (tenant_id, product_id, name, temperature, selling_price, recipe_id, is_default) values
    (_tenant, p_esp, 'دبل', 'hot', 55, r_single, true),
    (_tenant, p_sl, 'وسط', 'hot', 95, r_sl_hot, true),
    (_tenant, p_sl, 'وسط', 'iced', 105, r_sl_iced, false),
    (_tenant, p_cap, 'وسط', 'hot', 75, r_cap, true),
    (_tenant, p_matcha, 'وسط', 'iced', 120, r_matcha, true),
    (_tenant, p_tea, 'كوب', 'hot', 25, r_tea, true);

  insert into public.modifiers (tenant_id, name, price_delta, ingredient_id, quantity, unit) values
    (_tenant, 'شوت كراميل إضافي', 15, i_caramel, 15, 'ml'),
    (_tenant, 'صوص شوكولاتة إضافي', 15, i_choc, 20, 'g');
end $$;
revoke execute on function public.seed_demo_data(uuid) from public, anon, authenticated;

create or replace function public.create_tenant(
  _name text, _phone text default null, _city text default null,
  _branch_name text default null, _is_demo boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid; v_branch uuid; v_plan uuid; v_trial int; v_sub uuid;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if _name is null or char_length(trim(_name)) < 2 or char_length(_name) > 120 then
    raise exception 'اسم الكافيه يجب أن يكون من 2 إلى 120 حرف';
  end if;
  if (select count(*) from public.memberships where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'وصلت للحد الأقصى من الحسابات (5)';
  end if;

  insert into public.tenants (name, phone, city, is_demo, created_by)
  values (trim(_name), nullif(trim(_phone), ''), nullif(trim(_city), ''), coalesce(_is_demo, false), v_uid)
  returning id into v_tenant;

  insert into public.branches (tenant_id, name, is_main)
  values (v_tenant, coalesce(nullif(trim(_branch_name), ''), 'الفرع الرئيسي'), true) returning id into v_branch;

  insert into public.memberships (tenant_id, user_id, role, branch_id) values (v_tenant, v_uid, 'owner', v_branch);

  select id, trial_days into v_plan, v_trial from public.subscription_plans where code = 'professional';
  insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start)
  values (v_tenant, v_plan, 'trialing', now() + make_interval(days => v_trial), now()) returning id into v_sub;
  insert into public.subscription_history (tenant_id, subscription_id, event, to_status, plan_id, created_by, note)
  values (v_tenant, v_sub, 'trial_started', 'trialing', v_plan, v_uid, 'بداية الفترة التجريبية');

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, summary)
  values (v_tenant, v_uid, 'insert', 'tenants', v_tenant, trim(_name));

  if coalesce(_is_demo, false) then
    perform public.seed_demo_data(v_tenant);
  end if;
  return v_tenant;
end $$;
revoke execute on function public.create_tenant(text, text, text, text, boolean) from public, anon;
grant execute on function public.create_tenant(text, text, text, text, boolean) to authenticated;

create or replace function public.recalc_tenant_recipes(_tenant uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_count int := 0;
begin
  if not public.can_write(_tenant, 'recipes') then raise exception 'غير مصرح'; end if;
  for v_id in select id from public.recipes where tenant_id = _tenant order by (kind = 'menu_item'), created_at loop
    perform public.recalc_recipe(v_id, 'manual_recalc');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke execute on function public.recalc_tenant_recipes(uuid) from public, anon;
grant execute on function public.recalc_tenant_recipes(uuid) to authenticated;

create or replace function public.duplicate_recipe(_source uuid, _name text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare r public.recipes%rowtype; v_new uuid;
begin
  select * into r from public.recipes where id = _source;
  if not found then raise exception 'الريسبي غير موجود'; end if;
  insert into public.recipes (tenant_id, name, kind, yield_quantity, yield_unit, waste_percent, instructions)
  values (r.tenant_id, coalesce(nullif(trim(_name), ''), r.name || ' (نسخة)'), r.kind, r.yield_quantity, r.yield_unit, r.waste_percent, r.instructions)
  returning id into v_new;
  insert into public.recipe_items (tenant_id, recipe_id, ingredient_id, sub_recipe_id, quantity, unit, is_optional, notes, sort_order)
  select tenant_id, v_new, ingredient_id, sub_recipe_id, quantity, unit, is_optional, notes, sort_order
  from public.recipe_items where recipe_id = _source;
  return v_new;
end $$;
revoke execute on function public.duplicate_recipe(uuid, text) from public, anon;
grant execute on function public.duplicate_recipe(uuid, text) to authenticated;

-- ---------- STORAGE POLICIES (private bucket product-images, path: <tenant_id>/<file>) ----------
create policy "members read product images" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_tenant_member(((storage.foldername(name))[1])::uuid));
create policy "members upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.can_write(((storage.foldername(name))[1])::uuid, 'products'));
create policy "members update product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.can_write(((storage.foldername(name))[1])::uuid, 'products'));
create policy "members delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.can_write(((storage.foldername(name))[1])::uuid, 'products'));
