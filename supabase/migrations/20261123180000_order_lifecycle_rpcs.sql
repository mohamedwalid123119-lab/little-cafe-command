
-- Little Cafe Command
-- Order lifecycle RPCs
-- Requires:
--   20261123160000_order_workflow_foundation.sql
--   20261123170000_order_workflow_security_fixes.sql
-- Save only. Do not apply to Supabase until explicitly approved.

begin;

-- =========================================================
-- 1. CREATE AN UNPAID ORDER
-- =========================================================

create or replace function public.create_draft_order(
  _tenant uuid,
  _branch uuid,
  _items jsonb,
  _order_type text default 'dine_in',
  _table_label text default null,
  _discount numeric default 0,
  _notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_session uuid;
  v_t public.tenants%rowtype;
  v_order uuid;
  v_sub numeric := 0;
  v_disc numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_item record;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if not public.can_write(_tenant, 'pos') then
    raise exception 'ليس لديك صلاحية نقطة البيع';
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
    raise exception 'ليس لديك صلاحية فتح طلب في هذا الفرع';
  end if;

  if not exists (
    select 1
    from public.branches b
    where b.id = _branch
      and b.tenant_id = _tenant
      and b.is_active
  ) then
    raise exception 'الفرع غير موجود أو غير نشط';
  end if;

  if coalesce(_order_type, '') not in ('dine_in', 'takeaway', 'delivery') then
    raise exception 'نوع الطلب غير صحيح';
  end if;

  if _order_type = 'dine_in'
     and nullif(trim(coalesce(_table_label, '')), '') is null then
    raise exception 'يجب تحديد رقم الطاولة';
  end if;

  if _table_label is not null and char_length(trim(_table_label)) > 80 then
    raise exception 'اسم الطاولة أو الطلب طويل جداً';
  end if;

  if _notes is not null and char_length(_notes) > 500 then
    raise exception 'ملاحظات الطلب تتجاوز 500 حرف';
  end if;

  if _items is null
     or jsonb_typeof(_items) <> 'array'
     or jsonb_array_length(_items) = 0 then
    raise exception 'أضف صنفاً واحداً على الأقل';
  end if;

  if jsonb_array_length(_items) > 100 then
    raise exception 'عدد أصناف الطلب كبير جداً';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(_items)
      as x(variant_id uuid, quantity numeric, notes text)
    group by x.variant_id
    having count(*) > 1
  ) then
    raise exception 'يوجد صنف مكرر في بيانات الطلب';
  end if;

  select cs.id
  into v_session
  from public.cash_sessions cs
  where cs.tenant_id = _tenant
    and cs.branch_id = _branch
    and cs.status = 'open'
  order by cs.opened_at desc
  limit 1
  for update;

  if v_session is null then
    raise exception 'افتح الوردية أولاً قبل تسجيل الطلب';
  end if;

  select t.*
  into v_t
  from public.tenants t
  where t.id = _tenant;

  if not found then
    raise exception 'بيانات الكافيه غير موجودة';
  end if;

  for v_item in
    select
      x.variant_id,
      x.quantity,
      x.notes,
      v.selling_price,
      p.name as product_name
    from jsonb_to_recordset(_items)
      as x(variant_id uuid, quantity numeric, notes text)
    left join public.product_variants v
      on v.id = x.variant_id
      and v.tenant_id = _tenant
      and v.is_active
    left join public.products p
      on p.id = v.product_id
      and p.tenant_id = _tenant
      and p.is_active
  loop
    if v_item.variant_id is null or v_item.product_name is null then
      raise exception 'يوجد منتج غير متاح للبيع';
    end if;

    if v_item.quantity is null
       or v_item.quantity <= 0
       or v_item.quantity > 1000 then
      raise exception 'كمية أحد الأصناف غير صحيحة';
    end if;

    if v_item.notes is not null and char_length(v_item.notes) > 300 then
      raise exception 'ملاحظة الصنف تتجاوز 300 حرف';
    end if;

    v_sub := v_sub + round(v_item.quantity * v_item.selling_price, 2);
  end loop;

  v_disc := least(greatest(coalesce(_discount, 0), 0), v_sub);

  if coalesce(v_t.prices_include_vat, false) then
    v_total := v_sub - v_disc;
    if coalesce(v_t.vat_percent, 0) > 0 then
      v_tax := round(
        v_total - v_total / (1 + v_t.vat_percent / 100),
        2
      );
    end if;
  else
    v_tax := round(
      (v_sub - v_disc) * coalesce(v_t.vat_percent, 0) / 100,
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
    paid_at,
    table_label,
    barista_status
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
    null,
    nullif(trim(coalesce(_notes, '')), ''),
    v_uid,
    'unpaid',
    null,
    nullif(trim(coalesce(_table_label, '')), ''),
    'not_sent'
  )
  returning id into v_order;

  insert into public.order_items (
    tenant_id,
    order_id,
    product_id,
    variant_id,
    product_name,
    quantity,
    unit_price,
    unit_cost,
    notes
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
    r.cost_per_portion,
    nullif(left(trim(coalesce(x.notes, '')), 300), '')
  from jsonb_to_recordset(_items)
    as x(variant_id uuid, quantity numeric, notes text)
  join public.product_variants v
    on v.id = x.variant_id
    and v.tenant_id = _tenant
    and v.is_active
  join public.products p
    on p.id = v.product_id
    and p.tenant_id = _tenant
    and p.is_active
  left join public.recipes r
    on r.id = v.recipe_id
    and r.tenant_id = _tenant;

  -- No inventory movement before payment.
  return v_order;
end;
$function$;


-- =========================================================
-- 2. UPDATE AN UNPAID ORDER
-- NULL table/notes parameters preserve existing values.
-- =========================================================

create or replace function public.update_draft_order(
  _order uuid,
  _items jsonb,
  _order_type text default null,
  _table_label text default null,
  _discount numeric default null,
  _notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_t public.tenants%rowtype;
  v_sub numeric := 0;
  v_disc numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_type text;
  v_effective_table text;
  v_item record;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = _order
  for update;

  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if not public.can_write(v_order.tenant_id, 'pos') then
    raise exception 'ليس لديك صلاحية تعديل الطلب';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = v_order.tenant_id
      and m.user_id = v_uid
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = v_order.branch_id
      )
  ) then
    raise exception 'ليس لديك صلاحية تعديل هذا الطلب';
  end if;

  if v_order.status <> 'pending'
     or v_order.payment_status is distinct from 'unpaid'
     or v_order.barista_status not in ('not_sent', 'rejected') then
    raise exception 'لا يمكن تعديل الطلب بعد إرساله أو قبوله أو دفعه';
  end if;

  if _items is null
     or jsonb_typeof(_items) <> 'array'
     or jsonb_array_length(_items) = 0 then
    raise exception 'لا يمكن حفظ طلب فارغ';
  end if;

  if jsonb_array_length(_items) > 100 then
    raise exception 'عدد أصناف الطلب كبير جداً';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(_items)
      as x(variant_id uuid, quantity numeric, notes text)
    group by x.variant_id
    having count(*) > 1
  ) then
    raise exception 'يوجد صنف مكرر في بيانات الطلب';
  end if;

  v_type := coalesce(_order_type, v_order.order_type);

  if v_type not in ('dine_in', 'takeaway', 'delivery') then
    raise exception 'نوع الطلب غير صحيح';
  end if;

  v_effective_table := coalesce(
    nullif(trim(_table_label), ''),
    v_order.table_label
  );

  if v_type = 'dine_in'
     and nullif(trim(coalesce(v_effective_table, '')), '') is null then
    raise exception 'يجب تحديد رقم الطاولة';
  end if;

  if _table_label is not null and char_length(trim(_table_label)) > 80 then
    raise exception 'اسم الطاولة أو الطلب طويل جداً';
  end if;

  if _notes is not null and char_length(_notes) > 500 then
    raise exception 'ملاحظات الطلب تتجاوز 500 حرف';
  end if;

  select t.*
  into v_t
  from public.tenants t
  where t.id = v_order.tenant_id;

  if not found then
    raise exception 'بيانات الكافيه غير موجودة';
  end if;

  for v_item in
    select
      x.variant_id,
      x.quantity,
      x.notes,
      v.selling_price,
      p.name as product_name
    from jsonb_to_recordset(_items)
      as x(variant_id uuid, quantity numeric, notes text)
    left join public.product_variants v
      on v.id = x.variant_id
      and v.tenant_id = v_order.tenant_id
      and v.is_active
    left join public.products p
      on p.id = v.product_id
      and p.tenant_id = v_order.tenant_id
      and p.is_active
  loop
    if v_item.variant_id is null or v_item.product_name is null then
      raise exception 'يوجد منتج غير متاح للبيع';
    end if;

    if v_item.quantity is null
       or v_item.quantity <= 0
       or v_item.quantity > 1000 then
      raise exception 'كمية أحد الأصناف غير صحيحة';
    end if;

    if v_item.notes is not null and char_length(v_item.notes) > 300 then
      raise exception 'ملاحظة الصنف تتجاوز 300 حرف';
    end if;

    v_sub := v_sub + round(v_item.quantity * v_item.selling_price, 2);
  end loop;

  v_disc := least(
    greatest(coalesce(_discount, v_order.discount), 0),
    v_sub
  );

  if coalesce(v_t.prices_include_vat, false) then
    v_total := v_sub - v_disc;
    if coalesce(v_t.vat_percent, 0) > 0 then
      v_tax := round(
        v_total - v_total / (1 + v_t.vat_percent / 100),
        2
      );
    end if;
  else
    v_tax := round(
      (v_sub - v_disc) * coalesce(v_t.vat_percent, 0) / 100,
      2
    );
    v_total := v_sub - v_disc + v_tax;
  end if;

  delete from public.order_items
  where order_id = _order
    and tenant_id = v_order.tenant_id;

  insert into public.order_items (
    tenant_id,
    order_id,
    product_id,
    variant_id,
    product_name,
    quantity,
    unit_price,
    unit_cost,
    notes
  )
  select
    v_order.tenant_id,
    _order,
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
    r.cost_per_portion,
    nullif(left(trim(coalesce(x.notes, '')), 300), '')
  from jsonb_to_recordset(_items)
    as x(variant_id uuid, quantity numeric, notes text)
  join public.product_variants v
    on v.id = x.variant_id
    and v.tenant_id = v_order.tenant_id
    and v.is_active
  join public.products p
    on p.id = v.product_id
    and p.tenant_id = v_order.tenant_id
    and p.is_active
  left join public.recipes r
    on r.id = v.recipe_id
    and r.tenant_id = v_order.tenant_id;

  update public.orders
  set
    order_type = v_type,
    table_label = nullif(left(trim(coalesce(v_effective_table, '')), 80), ''),
    subtotal = v_sub,
    discount = v_disc,
    tax = v_tax,
    total = v_total,
    notes = nullif(
      left(trim(coalesce(_notes, v_order.notes, '')), 500),
      ''
    ),
    barista_status = 'not_sent',
    barista_rejection_reason = null,
    barista_responded_at = null,
    sent_to_barista_at = null,
    updated_at = now()
  where id = _order
    and tenant_id = v_order.tenant_id;
end;
$function$;


-- =========================================================
-- 3. SEND ORDER TO BARISTA
-- =========================================================

create or replace function public.send_order_to_barista(
  _order uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = _order
  for update;

  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if not public.can_write(v_order.tenant_id, 'pos') then
    raise exception 'ليس لديك صلاحية نقطة البيع';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = v_order.tenant_id
      and m.user_id = v_uid
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = v_order.branch_id
      )
  ) then
    raise exception 'ليس لديك صلاحية إرسال هذا الطلب';
  end if;

  if v_order.status <> 'pending'
     or v_order.payment_status is distinct from 'unpaid' then
    raise exception 'لا يمكن إرسال طلب مغلق أو مدفوع';
  end if;

  if v_order.barista_status not in ('not_sent', 'rejected') then
    raise exception 'الطلب مرسل بالفعل أو تم قبوله';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    where oi.order_id = _order
      and oi.tenant_id = v_order.tenant_id
  ) then
    raise exception 'لا يمكن إرسال طلب بدون أصناف';
  end if;

  update public.orders
  set
    barista_status = 'sent',
    sent_to_barista_at = now(),
    barista_rejection_reason = null,
    barista_responded_at = null,
    updated_at = now()
  where id = _order
    and tenant_id = v_order.tenant_id;
end;
$function$;


-- =========================================================
-- 4. PAY ORDER AND CONSUME FIFO INVENTORY
-- No stock is consumed before this function is called.
-- =========================================================

create or replace function public.pay_order(
  _order uuid,
  _payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_number bigint;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  if coalesce(_payment_method, '') not in ('cash', 'card', 'wallet', 'other') then
    raise exception 'طريقة الدفع غير صحيحة';
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = _order
  for update;

  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if not public.can_write(v_order.tenant_id, 'pos') then
    raise exception 'ليس لديك صلاحية إتمام البيع';
  end if;

  if not exists (
    select 1
    from public.memberships m
    where m.tenant_id = v_order.tenant_id
      and m.user_id = v_uid
      and m.is_active
      and m.role::text in ('owner', 'manager', 'cashier')
      and (
        m.role::text = 'owner'
        or m.branch_id is null
        or m.branch_id = v_order.branch_id
      )
  ) then
    raise exception 'ليس لديك صلاحية تحصيل هذا الطلب';
  end if;

  if v_order.status <> 'pending'
     or v_order.payment_status is distinct from 'unpaid' then
    raise exception 'الطلب مدفوع أو مغلق بالفعل';
  end if;

  if v_order.barista_status in ('sent', 'rejected') then
    raise exception 'لا يمكن الدفع قبل قبول الباريستا للطلب المرسل';
  end if;

  if v_order.cash_session_id is null or not exists (
    select 1
    from public.cash_sessions cs
    where cs.id = v_order.cash_session_id
      and cs.tenant_id = v_order.tenant_id
      and cs.branch_id = v_order.branch_id
      and cs.status = 'open'
  ) then
    raise exception 'وردية الطلب مغلقة؛ لا يمكن تحصيله على هذه الوردية';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    where oi.order_id = _order
      and oi.tenant_id = v_order.tenant_id
  ) then
    raise exception 'لا يمكن تحصيل طلب بدون أصناف';
  end if;

  v_number := v_order.order_number;

  -- Existing inventory triggers handle FIFO costing and stock validation.
  -- Any inventory error rolls back the payment transaction.
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
    v_order.tenant_id,
    v_order.branch_id,
    c.ingredient_id,
    'sale',
    -round(sum(c.quantity), 3),
    i.cost_per_base_unit,
    _order,
    'بيع طلب #' || v_number,
    v_uid
  from public.order_items oi
  join public.product_variants v
    on v.id = oi.variant_id
    and v.tenant_id = v_order.tenant_id
  cross join lateral public.recipe_consumption(
    v.recipe_id,
    oi.quantity
  ) c
  join public.ingredients i
    on i.id = c.ingredient_id
    and i.tenant_id = v_order.tenant_id
  where oi.order_id = _order
    and oi.tenant_id = v_order.tenant_id
    and v.recipe_id is not null
  group by c.ingredient_id, i.cost_per_base_unit
  having round(sum(c.quantity), 3) > 0;

  update public.orders
  set
    status = 'completed',
    payment_status = 'paid',
    payment_method = _payment_method,
    paid_at = now(),
    updated_at = now()
  where id = _order
    and tenant_id = v_order.tenant_id
    and status = 'pending'
    and payment_status = 'unpaid';

  if not found then
    raise exception 'تعذر إتمام عملية الدفع';
  end if;

  return _order;
end;
$function$;


-- =========================================================
-- 5. ONE ACTIVE UNPAID DINE-IN ORDER PER TABLE
-- Takeaway and delivery orders are not restricted by this index.
-- =========================================================

create unique index if not exists
  uq_orders_one_unpaid_order_per_table
on public.orders (
  tenant_id,
  branch_id,
  lower(btrim(table_label))
)
where order_type = 'dine_in'
  and table_label is not null
  and status in ('draft', 'pending')
  and payment_status = 'unpaid'
  and deleted_at is null;


-- =========================================================
-- 6. RPC PERMISSIONS
-- =========================================================

revoke all on function public.create_draft_order(
  uuid, uuid, jsonb, text, text, numeric, text
) from public, anon;

grant execute on function public.create_draft_order(
  uuid, uuid, jsonb, text, text, numeric, text
) to authenticated;

revoke all on function public.update_draft_order(
  uuid, jsonb, text, text, numeric, text
) from public, anon;

grant execute on function public.update_draft_order(
  uuid, jsonb, text, text, numeric, text
) to authenticated;

revoke all on function public.send_order_to_barista(uuid)
  from public, anon;

grant execute on function public.send_order_to_barista(uuid)
  to authenticated;

revoke all on function public.pay_order(uuid, text)
  from public, anon;

grant execute on function public.pay_order(uuid, text)
  to authenticated;

commit;
