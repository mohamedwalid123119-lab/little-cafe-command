
-- CAFE OS: Detailed financial and operational reports.
-- FIFO-based sales COGS, expenses, product quantities and waste.

-- Allow report users to read FIFO cost data through RLS.
create policy "reports read inventory cost layers"
on public.inventory_cost_layers
for select to authenticated
using (public.has_module(tenant_id, 'reports'));

create policy "reports read inventory cost allocations"
on public.inventory_cost_allocations
for select to authenticated
using (public.has_module(tenant_id, 'reports'));

create policy "reports read inventory movements"
on public.inventory_movements
for select to authenticated
using (public.has_module(tenant_id, 'reports'));

create index if not exists idx_inventory_movements_reference_type
on public.inventory_movements(reference_id, movement_type);

-- Detailed report for a date range or one cash shift.
create or replace function public.detailed_profit_report(
  _tenant uuid,
  _branch uuid,
  _from date,
  _to date,
  _cash_session uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_tz text;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if not public.has_module(_tenant, 'reports') then
    raise exception 'ليس لديك صلاحية عرض التقارير';
  end if;

  if _from is null or _to is null or _from > _to then
    raise exception 'فترة التقرير غير صحيحة';
  end if;

  if _to - _from > 366 then
    raise exception 'أقصى مدة للتقرير سنة واحدة';
  end if;

  select t.timezone into v_tz
  from public.tenants t
  where t.id = _tenant;

  if v_tz is null then
    raise exception 'المنشأة غير موجودة';
  end if;

  if _cash_session is not null and not exists (
    select 1
    from public.cash_sessions cs
    where cs.id = _cash_session
      and cs.tenant_id = _tenant
      and (_branch is null or cs.branch_id = _branch)
  ) then
    raise exception 'الوردية غير موجودة أو لا تتبع هذا الفرع';
  end if;

  v_from := _from::timestamp at time zone v_tz;
  v_to := (_to + 1)::timestamp at time zone v_tz;

  with report_orders as (
    select o.*
    from public.orders o
    where o.tenant_id = _tenant
      and (_branch is null or o.branch_id = _branch)
      and o.created_at >= v_from
      and o.created_at < v_to
      and (_cash_session is null or o.cash_session_id = _cash_session)
  ),

  completed_orders as (
    select * from report_orders
    where status = 'completed'
  ),

  sales_summary as (
    select
      count(*) as orders_count,
      coalesce(sum(subtotal), 0) as subtotal,
      coalesce(sum(discount), 0) as discounts,
      coalesce(sum(tax), 0) as taxes,
      coalesce(sum(total), 0) as total_sales,
      coalesce(sum(total - tax), 0) as net_sales
    from completed_orders
  ),

  fifo_movements as (
    select
      m.id,
      m.reference_id as order_id,
      abs(m.quantity) as required_quantity,
      coalesce(sum(a.quantity), 0) as allocated_quantity,
      coalesce(sum(a.quantity * a.unit_cost), 0) as fifo_cost
    from public.inventory_movements m
    left join public.inventory_cost_allocations a
      on a.movement_id = m.id
    join completed_orders o
      on o.id = m.reference_id
    where m.tenant_id = _tenant
      and m.movement_type = 'sale'
      and (_branch is null or m.branch_id = _branch)
    group by m.id, m.reference_id, m.quantity
  ),

  fifo_summary as (
    select
      coalesce(sum(fifo_cost), 0) as fifo_cogs,
      count(*) filter (
        where allocated_quantity <> required_quantity
      ) as incomplete_movements
    from fifo_movements
  ),

  waste_summary as (
    select
      coalesce(sum(abs(m.quantity) * m.unit_cost), 0) as estimated_waste_cost,
      count(*) as waste_movements
    from public.inventory_movements m
    where m.tenant_id = _tenant
      and (_branch is null or m.branch_id = _branch)
      and m.movement_type = 'waste'
      and m.created_at >= v_from
      and m.created_at < v_to
  ),

  expense_summary as (
    select
      coalesce(sum(e.amount), 0) as total_expenses,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'category', e.category,
            'description', e.description,
            'amount', e.amount,
            'date', e.spent_at,
            'payment_method', e.payment_method
          )
          order by e.spent_at desc, e.created_at desc
        ),
        '[]'::jsonb
      ) as expense_details
    from public.expenses e
    where e.tenant_id = _tenant
      and (_branch is null or e.branch_id = _branch)
      and e.spent_at between _from and _to
  ),

  product_summary as (
    select
      oi.product_name,
      sum(oi.quantity) as quantity_sold,
      sum(oi.line_total) as revenue,
      sum(oi.quantity * coalesce(oi.unit_cost, 0)) as estimated_cost,
      count(distinct oi.order_id) as orders_count,
      bool_and(oi.unit_cost is not null) as has_cost
    from public.order_items oi
    join completed_orders o on o.id = oi.order_id
    group by oi.product_name
  ),

  order_types as (
    select
      order_type,
      count(*) as orders_count,
      coalesce(sum(total), 0) as sales
    from completed_orders
    group by order_type
  ),

  payment_types as (
    select
      coalesce(payment_method, 'other') as payment_method,
      count(*) as orders_count,
      coalesce(sum(total), 0) as total
    from completed_orders
    group by payment_method
  ),

  shift_details as (
    select
      count(*) as shifts_count,
      coalesce(sum(opening_balance), 0) as opening_balance,
      coalesce(sum(closing_balance), 0) as closing_balance,
      coalesce(sum(expected_balance), 0) as expected_balance
    from public.cash_sessions cs
    where cs.tenant_id = _tenant
      and (_branch is null or cs.branch_id = _branch)
      and (
        (_cash_session is not null and cs.id = _cash_session)
        or
        (_cash_session is null
          and cs.opened_at < v_to
          and coalesce(cs.closed_at, now()) >= v_from)
      )
  )

  select jsonb_build_object(
    'period', jsonb_build_object(
      'from', _from,
      'to', _to,
      'timezone', v_tz,
      'cash_session_id', _cash_session
    ),

    'sales', jsonb_build_object(
      'orders_count', s.orders_count,
      'subtotal', round(s.subtotal, 2),
      'discounts', round(s.discounts, 2),
      'taxes', round(s.taxes, 2),
      'total_sales', round(s.total_sales, 2),
      'net_sales', round(s.net_sales, 2)
    ),

    'costs', jsonb_build_object(
      'fifo_cogs', round(f.fifo_cogs, 2),
      'incomplete_fifo_movements', f.incomplete_movements,
      'fifo_complete', f.incomplete_movements = 0,
      'waste_cost_estimate', round(w.estimated_waste_cost, 2),
      'waste_movements', w.waste_movements
    ),

    'profit', jsonb_build_object(
      'gross_profit',
        case when f.incomplete_movements = 0
          then round(s.net_sales - f.fifo_cogs, 2)
          else null end,
      'net_profit',
        case when f.incomplete_movements = 0
          then round(s.net_sales - f.fifo_cogs - e.total_expenses, 2)
          else null end,
      'profit_status',
        case when f.incomplete_movements = 0
          then 'complete_fifo'
          else 'incomplete_fifo' end
    ),

    'expenses', jsonb_build_object(
      'total', round(e.total_expenses, 2),
      'details', e.expense_details
    ),

    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', p.product_name,
          'quantity_sold', p.quantity_sold,
          'orders_count', p.orders_count,
          'revenue', round(p.revenue, 2),
          'estimated_cost', round(p.estimated_cost, 2),
          'estimated_profit', round(p.revenue - p.estimated_cost, 2),
          'cost_status',
            case when p.has_cost then 'recipe_estimate'
            else 'uncosted' end
        )
        order by p.quantity_sold desc
      )
      from product_summary p
    ), '[]'::jsonb),

    'order_types', coalesce((
      select jsonb_agg(to_jsonb(x))
      from order_types x
    ), '[]'::jsonb),

    'payments', coalesce((
      select jsonb_agg(to_jsonb(x))
      from payment_types x
    ), '[]'::jsonb),

    'shifts', to_jsonb(sd)
  )
  into v_result
  from sales_summary s
  cross join fifo_summary f
  cross join waste_summary w
  cross join expense_summary e
  cross join shift_details sd;

  return v_result;
end;
$function$;

revoke all on function public.detailed_profit_report(uuid, uuid, date, date, uuid)
from public, anon;

grant execute on function public.detailed_profit_report(uuid, uuid, date, date, uuid)
to authenticated;
