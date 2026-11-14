-- CAFE OS: connected operations (sale -> stock, shift totals, purchase receiving) + management dashboard.

-- ===== New columns (additive) =====
alter table public.ingredients add column reorder_level numeric(14,3)
  check (reorder_level is null or reorder_level >= 0);
comment on column public.ingredients.reorder_level is 'Low-stock alert threshold per branch, in the ingredient base unit.';

alter table public.order_items add column unit_cost numeric(12,4)
  check (unit_cost is null or unit_cost >= 0);
comment on column public.order_items.unit_cost is 'Recipe cost per unit captured at sale time (COGS). Null = product had no recipe.';

-- ===== Ingredient consumption of N portions of a recipe (base units, sub-recipes expanded, optional items excluded) =====
create or replace function public.recipe_consumption(_recipe uuid, _portions numeric)
returns table(ingredient_id uuid, quantity numeric)
language sql stable security definer set search_path = public as $$
  with recursive tree(recipe_id, batches, depth) as (
    select r.id, _portions / r.yield_quantity, 0 from public.recipes r where r.id = _recipe
    union all
    select sr.id, t.batches * ri.quantity * u.factor_to_base / (sr.yield_quantity * su.factor_to_base), t.depth + 1
    from tree t
    join public.recipe_items ri on ri.recipe_id = t.recipe_id and ri.sub_recipe_id is not null and not ri.is_optional
    join public.units u on u.code = ri.unit
    join public.recipes sr on sr.id = ri.sub_recipe_id
    join public.units su on su.code = sr.yield_unit
    where t.depth < 10
  )
  select ri.ingredient_id, sum(t.batches * ri.quantity * u.factor_to_base)
  from tree t
  join public.recipe_items ri on ri.recipe_id = t.recipe_id and ri.ingredient_id is not null and not ri.is_optional
  join public.units u on u.code = ri.unit
  group by ri.ingredient_id
$$;
revoke execute on function public.recipe_consumption(uuid, numeric) from public, anon, authenticated;

-- ===== POS sale: prices from the database, cost captured, stock deducted, linked to the open shift =====
create or replace function public.create_sale(
  _tenant uuid, _branch uuid, _items jsonb,
  _payment_method text default 'cash', _order_type text default 'dine_in',
  _discount numeric default 0, _notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_t public.tenants%rowtype;
  v_session uuid; v_order uuid; v_number bigint;
  v_sub numeric := 0; v_disc numeric; v_tax numeric; v_total numeric;
  it record;
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if not public.can_write(_tenant, 'pos') then raise exception 'ليس لديك صلاحية تسجيل المبيعات'; end if;
  if not exists (select 1 from public.branches where id = _branch and tenant_id = _tenant and is_active) then
    raise exception 'الفرع غير موجود';
  end if;
  if not exists (select 1 from public.memberships m where m.tenant_id = _tenant and m.user_id = v_uid and m.is_active
                 and (m.role in ('owner','manager') or m.branch_id is null or m.branch_id = _branch)) then
    raise exception 'غير مسموح لك بالبيع في هذا الفرع';
  end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'الطلب فارغ';
  end if;
  if jsonb_array_length(_items) > 100 then raise exception 'عدد أصناف الطلب كبير جداً'; end if;
  if coalesce(_payment_method, '') not in ('cash','card','wallet','other') then raise exception 'طريقة دفع غير صحيحة'; end if;
  if coalesce(_order_type, '') not in ('dine_in','takeaway','delivery') then raise exception 'نوع طلب غير صحيح'; end if;

  select id into v_session from public.cash_sessions where branch_id = _branch and tenant_id = _tenant and status = 'open';
  if v_session is null then raise exception 'افتح وردية أولاً قبل تسجيل المبيعات'; end if;

  select * into v_t from public.tenants where id = _tenant;

  for it in
    select x.quantity, v.selling_price, p.name as pname
    from jsonb_to_recordset(_items) as x(variant_id uuid, quantity numeric)
    left join public.product_variants v on v.id = x.variant_id and v.tenant_id = _tenant and v.is_active
    left join public.products p on p.id = v.product_id and p.is_active
  loop
    if it.pname is null then raise exception 'منتج غير متاح للبيع'; end if;
    if it.quantity is null or it.quantity <= 0 or it.quantity > 1000 then raise exception 'كمية غير صحيحة'; end if;
    v_sub := v_sub + round(it.quantity * it.selling_price, 2);
  end loop;

  v_disc := least(greatest(coalesce(_discount, 0), 0), v_sub);
  if v_t.prices_include_vat then
    v_total := v_sub - v_disc;
    v_tax := round(v_total - v_total / (1 + v_t.vat_percent / 100), 2);
  else
    v_tax := round((v_sub - v_disc) * v_t.vat_percent / 100, 2);
    v_total := v_sub - v_disc + v_tax;
  end if;

  insert into public.orders (tenant_id, branch_id, cash_session_id, order_type, status, subtotal, discount, tax, total, payment_method, notes, created_by)
  values (_tenant, _branch, v_session, _order_type, 'completed', v_sub, v_disc, v_tax, v_total, _payment_method,
          nullif(left(trim(coalesce(_notes, '')), 500), ''), v_uid)
  returning id, order_number into v_order, v_number;

  insert into public.order_items (tenant_id, order_id, product_id, variant_id, product_name, quantity, unit_price, unit_cost)
  select _tenant, v_order, p.id, v.id,
         left(p.name || case when count(*) over (partition by p.id) > 0 and v.name <> '' and v.name <> p.name then ' - ' || v.name else '' end, 200),
         x.quantity, v.selling_price, r.cost_per_portion
  from jsonb_to_recordset(_items) as x(variant_id uuid, quantity numeric)
  join public.product_variants v on v.id = x.variant_id and v.tenant_id = _tenant
  join public.products p on p.id = v.product_id
  left join public.recipes r on r.id = v.recipe_id;

  insert into public.inventory_movements (tenant_id, branch_id, ingredient_id, movement_type, quantity, unit_cost, reference_id, notes, created_by)
  select _tenant, _branch, c.ingredient_id, 'sale', -round(sum(c.quantity), 3), i.cost_per_base_unit, v_order,
         'بيع طلب #' || v_number, v_uid
  from public.order_items oi
  join public.product_variants v on v.id = oi.variant_id
  cross join lateral public.recipe_consumption(v.recipe_id, oi.quantity) c
  join public.ingredients i on i.id = c.ingredient_id
  where oi.order_id = v_order and v.recipe_id is not null
  group by c.ingredient_id, i.cost_per_base_unit
  having round(sum(c.quantity), 3) > 0;

  return v_order;
end $$;
revoke execute on function public.create_sale(uuid, uuid, jsonb, text, text, numeric, text) from public, anon;
grant execute on function public.create_sale(uuid, uuid, jsonb, text, text, numeric, text) to authenticated;

-- ===== Cancel a completed sale (owner/manager, open shift only): status + stock returned =====
create or replace function public.void_order(_order uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  o public.orders%rowtype;
begin
  select * into o from public.orders where id = _order for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if not exists (select 1 from public.memberships where tenant_id = o.tenant_id and user_id = v_uid and is_active
                 and role in ('owner','manager')) or not public.tenant_is_writable(o.tenant_id) then
    raise exception 'إلغاء الطلبات متاح للمالك أو المدير فقط';
  end if;
  if o.status <> 'completed' then raise exception 'الطلب ليس مكتملاً'; end if;
  if o.cash_session_id is not null and exists (select 1 from public.cash_sessions where id = o.cash_session_id and status = 'closed') then
    raise exception 'لا يمكن إلغاء طلب في وردية مغلقة';
  end if;
  if _reason is null or char_length(trim(_reason)) < 2 then raise exception 'اكتب سبب الإلغاء'; end if;

  update public.orders set status = 'cancelled',
    notes = left(concat_ws(' | ', notes, 'إلغاء: ' || trim(_reason)), 500)
  where id = _order;

  insert into public.inventory_movements (tenant_id, branch_id, ingredient_id, movement_type, quantity, unit_cost, reference_id, notes, created_by)
  select m.tenant_id, m.branch_id, m.ingredient_id, 'adjustment', -m.quantity, m.unit_cost, _order,
         'إرجاع مخزون لإلغاء طلب #' || o.order_number, v_uid
  from public.inventory_movements m
  where m.reference_id = _order and m.movement_type = 'sale';
end $$;
revoke execute on function public.void_order(uuid, text) from public, anon;
grant execute on function public.void_order(uuid, text) to authenticated;

-- ===== Shift close computes expected drawer cash from the shift's cash sales =====
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
    new.expected_balance := old.opening_balance + coalesce((
      select sum(o.total) from public.orders o
      where o.cash_session_id = old.id and o.status = 'completed' and o.payment_method = 'cash'), 0);
    new.closed_by := auth.uid();
    new.closed_at := now();
  else
    new.expected_balance := old.expected_balance;
  end if;
  return new;
end $$;

-- ===== Purchases: receiving adds stock; received/cancelled invoices are locked =====
create or replace function public.purchase_status_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status <> 'draft' and (new.status is distinct from old.status or new.total_amount is distinct from old.total_amount
      or new.branch_id is distinct from old.branch_id) then
    raise exception 'لا يمكن تعديل فاتورة شراء بعد استلامها أو إلغائها';
  end if;
  if new.status = 'received' and old.status = 'draft' then
    if not exists (select 1 from public.purchase_items where purchase_id = new.id) then
      raise exception 'لا يمكن استلام فاتورة بدون أصناف';
    end if;
    new.received_at := coalesce(new.received_at, now());
  end if;
  return new;
end $$;
create trigger trg_purchase_status_guard before update on public.purchases
  for each row execute function public.purchase_status_guard();

create or replace function public.purchase_after_receive()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'received' and old.status = 'draft' then
    insert into public.inventory_movements (tenant_id, branch_id, ingredient_id, movement_type, quantity, unit_cost, reference_id, notes, created_by)
    select new.tenant_id, new.branch_id, pi.ingredient_id, 'purchase', pi.quantity, pi.unit_cost, new.id,
           'استلام فاتورة شراء' || coalesce(' ' || new.reference_number, ''), auth.uid()
    from public.purchase_items pi where pi.purchase_id = new.id;
  end if;
  return null;
end $$;
create trigger trg_purchase_after_receive after update on public.purchases
  for each row execute function public.purchase_after_receive();

-- ===== Dashboard (security invoker: every number respects the caller's row-level access) =====
create or replace function public.period_kpis(_tenant uuid, _branch uuid, _from date, _to date)
returns jsonb language sql stable security invoker set search_path = public as $$
  with tz as (select timezone as z from public.tenants where id = _tenant),
  o as (
    select o.id, o.total, o.tax, o.discount, o.status from public.orders o, tz
    where o.tenant_id = _tenant and (_branch is null or o.branch_id = _branch)
      and o.created_at >= (_from::timestamp at time zone tz.z) and o.created_at < ((_to + 1)::timestamp at time zone tz.z)
  ),
  s as (select count(*) filter (where status = 'completed') as n,
               coalesce(sum(total) filter (where status = 'completed'), 0) as sales,
               coalesce(sum(tax) filter (where status = 'completed'), 0) as tax,
               coalesce(sum(discount) filter (where status = 'completed'), 0) as disc,
               count(*) filter (where status in ('cancelled','refunded')) as cancelled
        from o),
  c as (select coalesce(sum(oi.quantity * coalesce(oi.unit_cost, 0)), 0) as cogs,
               count(*) filter (where oi.unit_cost is null) as uncosted
        from public.order_items oi join o on o.id = oi.order_id where o.status = 'completed'),
  e as (select coalesce(sum(x.amount), 0) as amt from public.expenses x
        where x.tenant_id = _tenant and (_branch is null or x.branch_id = _branch) and x.spent_at between _from and _to)
  select jsonb_build_object(
    'orders', s.n, 'sales', s.sales, 'tax', s.tax, 'discount', s.disc, 'net_sales', s.sales - s.tax,
    'cogs', round(c.cogs, 2), 'gross_profit', round(s.sales - s.tax - c.cogs, 2),
    'expenses', e.amt, 'net_profit', round(s.sales - s.tax - c.cogs - e.amt, 2),
    'avg_ticket', case when s.n > 0 then round(s.sales / s.n, 2) else 0 end,
    'uncosted_items', c.uncosted, 'cancelled', s.cancelled)
  from s, c, e
$$;
revoke execute on function public.period_kpis(uuid, uuid, date, date) from public, anon;
grant execute on function public.period_kpis(uuid, uuid, date, date) to authenticated;

create or replace function public.dashboard_overview(_tenant uuid, _branch uuid default null, _from date default null, _to date default null)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_tz text; v_today date; v_from date; v_to date; v_days int; v_ts_from timestamptz; v_ts_to timestamptz;
  v_res jsonb;
begin
  if not public.has_module(_tenant, 'dashboard') then raise exception 'ليس لديك صلاحية عرض لوحة التحكم'; end if;
  select timezone into v_tz from public.tenants where id = _tenant;
  v_today := (now() at time zone v_tz)::date;
  v_to := coalesce(_to, v_today);
  v_from := coalesce(_from, v_to - 6);
  if v_from > v_to then raise exception 'تاريخ البداية بعد تاريخ النهاية'; end if;
  if v_to - v_from > 366 then raise exception 'أقصى مدة للتقرير سنة واحدة'; end if;
  v_days := v_to - v_from + 1;
  v_ts_from := v_from::timestamp at time zone v_tz;
  v_ts_to := (v_to + 1)::timestamp at time zone v_tz;

  with ord as (
    select o.id, o.total, o.tax, o.subtotal, o.payment_method, o.created_by,
           (o.created_at at time zone v_tz) as local_at,
           coalesce((select sum(oi.quantity * coalesce(oi.unit_cost, 0)) from public.order_items oi where oi.order_id = o.id), 0) as cogs
    from public.orders o
    where o.tenant_id = _tenant and (_branch is null or o.branch_id = _branch) and o.status = 'completed'
      and o.created_at >= v_ts_from and o.created_at < v_ts_to
  ),
  itm as (
    select oi.product_name, oi.quantity, oi.unit_cost,
           case when ord.subtotal > 0 then oi.line_total * (ord.total - ord.tax) / ord.subtotal else 0 end as net_rev
    from public.order_items oi join ord on ord.id = oi.order_id
  ),
  ex as (
    select x.category, x.amount, x.spent_at from public.expenses x
    where x.tenant_id = _tenant and (_branch is null or x.branch_id = _branch) and x.spent_at between v_from and v_to
  ),
  br as (
    select b.id, b.name from public.branches b
    where b.tenant_id = _tenant and b.is_active and (_branch is null or b.id = _branch)
  ),
  stk as (
    select i.id, i.name, i.kind, i.base_unit, i.reorder_level, i.cost_per_base_unit, br.id as branch_id, br.name as branch_name,
           coalesce((select sum(m.quantity) from public.inventory_movements m
                     where m.ingredient_id = i.id and m.branch_id = br.id), 0) as qty
    from public.ingredients i cross join br
    where i.tenant_id = _tenant and i.is_active
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to, 'days', v_days, 'today', v_today, 'timezone', v_tz),
    'current', public.period_kpis(_tenant, _branch, v_from, v_to),
    'previous', public.period_kpis(_tenant, _branch, v_from - v_days, v_from - 1),
    'today', public.period_kpis(_tenant, _branch, v_today, v_today),
    'month', public.period_kpis(_tenant, _branch, date_trunc('month', v_today)::date, v_today),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'date', g.d::date, 'orders', coalesce(s.cnt, 0), 'sales', coalesce(s.sales, 0),
               'net_sales', coalesce(s.net, 0), 'cogs', round(coalesce(s.cogs, 0), 2), 'expenses', coalesce(e.amt, 0),
               'net_profit', round(coalesce(s.net, 0) - coalesce(s.cogs, 0) - coalesce(e.amt, 0), 2)) order by g.d), '[]'::jsonb)
      from generate_series(v_from::timestamp, v_to::timestamp, interval '1 day') g(d)
      left join (select local_at::date as d, count(*) as cnt, sum(total) as sales, sum(total - tax) as net, sum(cogs) as cogs
                 from ord group by 1) s on s.d = g.d::date
      left join (select spent_at as d, sum(amount) as amt from ex group by 1) e on e.d = g.d::date
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h.hr, 'orders', h.cnt, 'sales', h.sales) order by h.hr), '[]'::jsonb)
      from (select extract(hour from local_at)::int as hr, count(*) as cnt, sum(total) as sales from ord group by 1) h
    ),
    'top_products', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.quantity desc, t.revenue desc), '[]'::jsonb) from (
        select itm.product_name as name, sum(itm.quantity) as quantity, round(sum(itm.net_rev), 2) as revenue,
               round(sum(itm.quantity * coalesce(itm.unit_cost, 0)), 2) as cost,
               round(sum(itm.net_rev) - sum(itm.quantity * coalesce(itm.unit_cost, 0)), 2) as profit,
               bool_or(itm.unit_cost is null) as uncosted
        from itm group by itm.product_name order by sum(itm.quantity) desc, sum(itm.net_rev) desc limit 10) t
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'orders', p.cnt, 'total', p.total) order by p.total desc), '[]'::jsonb)
      from (select coalesce(payment_method, 'other') as method, count(*) as cnt, sum(total) as total from ord group by 1) p
    ),
    'expense_categories', (
      select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'total', c.total) order by c.total desc), '[]'::jsonb)
      from (select category, sum(amount) as total from ex group by 1) c
    ),
    'staff', (
      select coalesce(jsonb_agg(to_jsonb(z) order by z.sales desc nulls last), '[]'::jsonb) from (
        select a.user_id, pr.full_name, mb.role, coalesce(a.orders, 0) as orders, coalesce(a.sales, 0) as sales,
               coalesce(a.avg_ticket, 0) as avg_ticket, coalesce(a.shifts, 0) as shifts, a.cash_variance
        from (
          select coalesce(st.uid, sh.uid) as user_id, st.orders, st.sales, st.avg_ticket, sh.shifts, sh.cash_variance
          from (select created_by as uid, count(*) as orders, sum(total) as sales, round(avg(total), 2) as avg_ticket
                from ord where created_by is not null group by created_by) st
          full join (select cs.opened_by as uid, count(*) as shifts,
                            sum(cs.closing_balance - cs.expected_balance) filter (where cs.status = 'closed') as cash_variance
                     from public.cash_sessions cs
                     where cs.tenant_id = _tenant and (_branch is null or cs.branch_id = _branch)
                       and cs.opened_at >= v_ts_from and cs.opened_at < v_ts_to
                     group by cs.opened_by) sh on sh.uid = st.uid
        ) a
        left join public.profiles pr on pr.id = a.user_id
        left join public.memberships mb on mb.user_id = a.user_id and mb.tenant_id = _tenant
      ) z
    ),
    'shifts', (
      select coalesce(jsonb_agg(to_jsonb(z) order by z.opened_at desc), '[]'::jsonb) from (
        select cs.id, cs.status, cs.opened_at, cs.closed_at, cs.opening_balance, cs.closing_balance, cs.expected_balance,
               cs.closing_balance - cs.expected_balance as variance, b.name as branch_name, pr.full_name as opened_by_name,
               (select count(*) from public.orders o where o.cash_session_id = cs.id and o.status = 'completed') as orders,
               (select coalesce(sum(o.total), 0) from public.orders o where o.cash_session_id = cs.id and o.status = 'completed') as sales,
               (select coalesce(sum(o.total), 0) from public.orders o where o.cash_session_id = cs.id and o.status = 'completed' and o.payment_method = 'cash') as cash_sales
        from public.cash_sessions cs
        join public.branches b on b.id = cs.branch_id
        left join public.profiles pr on pr.id = cs.opened_by
        where cs.tenant_id = _tenant and (_branch is null or cs.branch_id = _branch)
          and (cs.status = 'open' or (cs.opened_at < v_ts_to and cs.closed_at >= v_ts_from))
        order by cs.opened_at desc limit 15
      ) z
    ),
    'stock', jsonb_build_object(
      'items', (select count(distinct id) from stk),
      'tracked', (select count(distinct id) from stk where reorder_level is not null),
      'value', (select round(coalesce(sum(greatest(qty, 0) * cost_per_base_unit), 0), 2) from stk),
      'low_count', (select count(*) from stk where reorder_level is not null and qty <= reorder_level and qty > 0),
      'out_count', (select count(*) from stk where qty <= 0 and (reorder_level is not null or exists (
                      select 1 from public.inventory_movements m where m.ingredient_id = stk.id and m.branch_id = stk.branch_id))),
      'alerts', (
        select coalesce(jsonb_agg(to_jsonb(a) order by a.ratio nulls first, a.name), '[]'::jsonb) from (
          select s.id, s.name, s.base_unit, s.branch_name, round(s.qty, 3) as quantity, s.reorder_level,
                 case when s.reorder_level > 0 then round(greatest(s.qty, 0) / s.reorder_level, 3) end as ratio
          from stk s
          where (s.reorder_level is not null and s.qty <= s.reorder_level)
             or (s.qty < 0)
          order by 7 nulls first, s.name limit 30) a
      ),
      'consumption', (
        select coalesce(jsonb_agg(to_jsonb(c) order by c.cost desc), '[]'::jsonb) from (
          select i.name, i.base_unit, round(sum(-m.quantity), 3) as quantity, round(sum(-m.quantity * m.unit_cost), 2) as cost
          from public.inventory_movements m join public.ingredients i on i.id = m.ingredient_id
          where m.tenant_id = _tenant and (_branch is null or m.branch_id = _branch) and m.movement_type in ('sale','waste')
            and m.created_at >= v_ts_from and m.created_at < v_ts_to
          group by i.name, i.base_unit order by 4 desc limit 8) c
      ),
      'waste_cost', (
        select round(coalesce(sum(-m.quantity * m.unit_cost), 0), 2) from public.inventory_movements m
        where m.tenant_id = _tenant and (_branch is null or m.branch_id = _branch) and m.movement_type = 'waste'
          and m.created_at >= v_ts_from and m.created_at < v_ts_to
      )
    )
  ) into v_res;
  return v_res;
end $$;
revoke execute on function public.dashboard_overview(uuid, uuid, date, date) from public, anon;
grant execute on function public.dashboard_overview(uuid, uuid, date, date) to authenticated;

create index if not exists idx_orders_session on public.orders(cash_session_id) where cash_session_id is not null;
create index if not exists idx_inventory_reference on public.inventory_movements(reference_id) where reference_id is not null;
create index if not exists idx_inventory_tenant_date on public.inventory_movements(tenant_id, created_at desc);