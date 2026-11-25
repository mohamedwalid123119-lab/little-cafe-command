
-- CAFE OS: Use actual FIFO allocations for dashboard profit KPIs.
-- Keep missing or incomplete costing explicitly unavailable.
-- SECURITY INVOKER preserves the caller's RLS visibility.

CREATE OR REPLACE FUNCTION public.period_kpis(
  _tenant uuid,
  _branch uuid,
  _from date,
  _to date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  WITH tz AS (
    SELECT t.timezone AS z
    FROM public.tenants t
    WHERE t.id = _tenant
  ),

  completed_orders AS (
    SELECT
      o.id,
      o.tenant_id,
      o.branch_id,
      o.total,
      o.tax,
      o.discount
    FROM public.orders o
    CROSS JOIN tz
    WHERE o.tenant_id = _tenant
      AND (_branch IS NULL OR o.branch_id = _branch)
      AND o.status = 'completed'
      AND o.created_at >= (_from::timestamp AT TIME ZONE tz.z)
      AND o.created_at < ((_to + 1)::timestamp AT TIME ZONE tz.z)
  ),

  all_orders AS (
    SELECT
      o.id,
      o.total,
      o.tax,
      o.discount,
      o.status
    FROM public.orders o
    CROSS JOIN tz
    WHERE o.tenant_id = _tenant
      AND (_branch IS NULL OR o.branch_id = _branch)
      AND o.created_at >= (_from::timestamp AT TIME ZONE tz.z)
      AND o.created_at < ((_to + 1)::timestamp AT TIME ZONE tz.z)
  ),

  sales_summary AS (
    SELECT
      count(*) AS orders_count,
      coalesce(sum(total), 0) AS sales,
      coalesce(sum(tax), 0) AS tax,
      coalesce(sum(discount), 0) AS discount,
      (
        SELECT count(*)
        FROM all_orders
        WHERE status IN ('cancelled', 'refunded')
      ) AS cancelled
    FROM completed_orders
  ),

  uncosted_items AS (
    SELECT count(*) AS item_count
    FROM public.order_items oi
    JOIN completed_orders o ON o.id = oi.order_id
    WHERE oi.unit_cost IS NULL
  ),

  fifo_movements AS (
    SELECT
      m.id,
      abs(m.quantity) AS required_quantity,
      coalesce(sum(a.quantity), 0) AS allocated_quantity,
      coalesce(sum(a.quantity * a.unit_cost), 0) AS fifo_cost
    FROM public.inventory_movements m
    LEFT JOIN public.inventory_cost_allocations a
      ON a.movement_id = m.id
    JOIN completed_orders o
      ON o.id = m.reference_id
    WHERE m.tenant_id = _tenant
      AND (_branch IS NULL OR m.branch_id = _branch)
      AND m.movement_type = 'sale'
    GROUP BY m.id, m.quantity
  ),

  fifo_summary AS (
    SELECT
      coalesce(sum(fifo_cost), 0) AS fifo_cogs,
      count(*) FILTER (
        WHERE allocated_quantity <> required_quantity
      ) AS incomplete_movements
    FROM fifo_movements
  ),

  uncovered_orders AS (
    SELECT count(DISTINCT o.id) AS order_count
    FROM completed_orders o
    JOIN public.order_items oi
      ON oi.order_id = o.id
    JOIN public.product_variants v
      ON v.id = oi.variant_id
    WHERE v.recipe_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_movements m
        WHERE m.reference_id = o.id
          AND m.tenant_id = _tenant
          AND m.movement_type = 'sale'
          AND (_branch IS NULL OR m.branch_id = _branch)
      )
  ),

  expense_summary AS (
    SELECT coalesce(sum(x.amount), 0) AS total
    FROM public.expenses x
    WHERE x.tenant_id = _tenant
      AND (_branch IS NULL OR x.branch_id = _branch)
      AND x.spent_at BETWEEN _from AND _to
  ),

  costing_status AS (
    SELECT
      (
        f.incomplete_movements = 0
        AND u.item_count = 0
        AND x.order_count = 0
      ) AS is_complete
    FROM fifo_summary f
    CROSS JOIN uncosted_items u
    CROSS JOIN uncovered_orders x
  )

  SELECT jsonb_build_object(
    'orders', s.orders_count,
    'sales', s.sales,
    'tax', s.tax,
    'discount', s.discount,
    'net_sales', s.sales - s.tax,

    'cogs',
      CASE
        WHEN cs.is_complete THEN round(f.fifo_cogs, 2)
        ELSE NULL
      END,

    'gross_profit',
      CASE
        WHEN cs.is_complete
        THEN round(s.sales - s.tax - f.fifo_cogs, 2)
        ELSE NULL
      END,

    'expenses', e.total,

    'net_profit',
      CASE
        WHEN cs.is_complete
        THEN round(s.sales - s.tax - f.fifo_cogs - e.total, 2)
        ELSE NULL
      END,

    'avg_ticket',
      CASE
        WHEN s.orders_count > 0
        THEN round(s.sales / s.orders_count, 2)
        ELSE 0
      END,

    'uncosted_items', u.item_count,
    'incomplete_fifo_movements', f.incomplete_movements,
    'uncovered_orders', x.order_count,
    'cost_complete', cs.is_complete,
    'cancelled', s.cancelled
  )
  FROM sales_summary s
  CROSS JOIN fifo_summary f
  CROSS JOIN uncosted_items u
  CROSS JOIN uncovered_orders x
  CROSS JOIN expense_summary e
  CROSS JOIN costing_status cs;

$function$;

REVOKE EXECUTE ON FUNCTION public.period_kpis(uuid, uuid, date, date)
FROM public, anon;

GRANT EXECUTE ON FUNCTION public.period_kpis(uuid, uuid, date, date)
TO authenticated;
