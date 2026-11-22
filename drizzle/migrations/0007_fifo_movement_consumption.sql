
-- CAFE OS: FIFO movement consumption and exact cancellation restoration.
-- Requires 0006_fifo_inventory_costing.sql.

-- Consume outgoing stock from the oldest available cost layers.
create or replace function public.consume_inventory_cost_layers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_layer record;
  v_need numeric(14,3);
  v_take numeric(14,3);
  v_total_cost numeric := 0;
  v_total_quantity numeric := 0;
begin
  if new.quantity >= 0 then
    return new;
  end if;

  -- Serialize movements for this ingredient.
  perform 1
  from public.ingredients i
  where i.id = new.ingredient_id
    and i.tenant_id = new.tenant_id
  for update;

  if not found then
    raise exception 'المكوّن غير موجود';
  end if;

  v_need := abs(new.quantity);

  for v_layer in
    select
      l.id,
      l.remaining_quantity,
      l.unit_cost
    from public.inventory_cost_layers l
    where l.tenant_id = new.tenant_id
      and l.branch_id = new.branch_id
      and l.ingredient_id = new.ingredient_id
      and l.remaining_quantity > 0
    order by l.received_at, l.source_movement_id
    for update
  loop
    exit when v_need <= 0;

    v_take := least(v_need, v_layer.remaining_quantity);

    insert into public.inventory_cost_allocations (
      tenant_id,
      branch_id,
      ingredient_id,
      movement_id,
      cost_layer_id,
      quantity,
      unit_cost
    )
    values (
      new.tenant_id,
      new.branch_id,
      new.ingredient_id,
      new.id,
      v_layer.id,
      v_take,
      v_layer.unit_cost
    );

    update public.inventory_cost_layers
    set remaining_quantity = remaining_quantity - v_take
    where id = v_layer.id;

    v_total_cost := v_total_cost + (v_take * v_layer.unit_cost);
    v_total_quantity := v_total_quantity + v_take;
    v_need := v_need - v_take;
  end loop;

  if v_need > 0 then
    raise exception
      'طبقات تكلفة المخزون غير كافية للصنف %، الكمية الناقصة %',
      new.ingredient_id,
      v_need;
  end if;

  if v_total_quantity > 0 then
    update public.inventory_movements
    set unit_cost = round(v_total_cost / v_total_quantity, 4)
    where id = new.id;
  end if;

  return new;
end;
$function$;

revoke all on function public.consume_inventory_cost_layers()
from public, anon, authenticated;

drop trigger if exists trg_consume_inventory_cost_layers
on public.inventory_movements;

create trigger trg_consume_inventory_cost_layers
after insert on public.inventory_movements
for each row
when (new.quantity < 0)
execute function public.consume_inventory_cost_layers();


-- Restore cancelled sales to their exact original FIFO layers.
create or replace function public.void_order(
  _order uuid,
  _reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  o public.orders%rowtype;
  v_move record;
  v_alloc record;
  v_allocated numeric(14,3);
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول أولاً';
  end if;

  select *
  into o
  from public.orders
  where id = _order
  for update;

  if not found then
    raise exception 'الطلب غير موجود';
  end if;

  if not exists (
    select 1
    from public.memberships
    where tenant_id = o.tenant_id
      and user_id = v_uid
      and is_active
      and role in ('owner', 'manager')
  ) or not public.tenant_is_writable(o.tenant_id) then
    raise exception 'إلغاء الطلبات متاح للمالك أو المدير فقط';
  end if;

  if o.status <> 'completed' then
    raise exception 'الطلب ليس مكتملاً';
  end if;

  if o.cash_session_id is not null
     and exists (
       select 1
       from public.cash_sessions
       where id = o.cash_session_id
         and status = 'closed'
     ) then
    raise exception 'لا يمكن إلغاء طلب في وردية مغلقة';
  end if;

  if _reason is null or char_length(trim(_reason)) < 2 then
    raise exception 'اكتب سبب الإلغاء';
  end if;

  -- Verify that every historical sale movement has complete FIFO allocations.
  for v_move in
    select m.id, m.quantity
    from public.inventory_movements m
    where m.reference_id = _order
      and m.movement_type = 'sale'
    order by m.created_at, m.id
  loop
    select coalesce(sum(a.quantity), 0)
    into v_allocated
    from public.inventory_cost_allocations a
    where a.movement_id = v_move.id;

    if v_allocated <> abs(v_move.quantity) then
      raise exception
        'لا يمكن إلغاء الطلب: تخصيصات FIFO غير مكتملة لحركة المخزون %',
        v_move.id;
    end if;
  end loop;

  -- Restore each allocation to the same source layer.
  for v_move in
    select m.id
    from public.inventory_movements m
    where m.reference_id = _order
      and m.movement_type = 'sale'
    order by m.created_at, m.id
  loop
    for v_alloc in
      select a.cost_layer_id, a.quantity
      from public.inventory_cost_allocations a
      where a.movement_id = v_move.id
      order by a.cost_layer_id
    loop
      update public.inventory_cost_layers
      set remaining_quantity = remaining_quantity + v_alloc.quantity
      where id = v_alloc.cost_layer_id
        and remaining_quantity + v_alloc.quantity <= original_quantity;

      if not found then
        raise exception 'تعذر استعادة طبقة تكلفة المخزون';
      end if;
    end loop;
  end loop;

  update public.orders
  set status = 'cancelled',
      notes = left(
        concat_ws(' | ', notes, 'إلغاء: ' || trim(_reason)),
        500
      )
  where id = _order;

  -- Restore physical stock without creating duplicate cost layers.
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
    m.tenant_id,
    m.branch_id,
    m.ingredient_id,
    'adjustment',
    -m.quantity,
    m.unit_cost,
    _order,
    'إرجاع مخزون لإلغاء طلب #' || o.order_number,
    v_uid
  from public.inventory_movements m
  where m.reference_id = _order
    and m.movement_type = 'sale';

end;
$function$;
revoke all on function public.void_order(uuid, text)
from public, anon, authenticated;

grant execute on function public.void_order(uuid, text)
to authenticated;
