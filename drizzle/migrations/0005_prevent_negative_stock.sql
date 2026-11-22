
-- Prevent negative ingredient stock before recording a sale.
-- Lock the ingredient row to serialize concurrent sales.

create or replace function public.prevent_negative_stock_before_sale()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_balance numeric(14,3);
  v_name text;
begin
  if new.movement_type <> 'sale' then
    return new;
  end if;

  -- Serialize sales consuming the same ingredient.
  perform 1
  from public.ingredients i
  where i.id = new.ingredient_id
    and i.tenant_id = new.tenant_id
  for update;

  if not found then
    raise exception 'المكوّن غير موجود';
  end if;

  -- Check the current stock after obtaining the lock.
  select
    coalesce(sum(m.quantity), 0),
    i.name
  into v_balance, v_name
  from public.inventory_movements m
  join public.ingredients i
    on i.id = m.ingredient_id
   and i.tenant_id = m.tenant_id
  where m.tenant_id = new.tenant_id
    and m.branch_id = new.branch_id
    and m.ingredient_id = new.ingredient_id
  group by i.name;

  if coalesce(v_balance, 0) + new.quantity < 0 then
    raise exception
      'مخزون غير كافٍ: % — الرصيد المتاح %',
      coalesce(v_name, new.ingredient_id::text),
      coalesce(v_balance, 0);
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_negative_stock_before_sale()
from public, anon, authenticated;

drop trigger if exists trg_prevent_negative_stock
on public.inventory_movements;

create trigger trg_prevent_negative_stock
before insert on public.inventory_movements
for each row
execute function public.prevent_negative_stock_before_sale();
