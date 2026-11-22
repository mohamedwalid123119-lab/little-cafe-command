
-- Prevent sales from making ingredient stock negative.
-- Uses transaction-level advisory locks to serialize concurrent sales
-- that consume the same ingredient in the same branch.

create or replace function public.prevent_negative_stock_after_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_balance numeric(14,3);
  v_name text;
begin
  -- Lock every affected ingredient in a stable order to avoid deadlocks.
  for v_row in
    select distinct
      tenant_id,
      branch_id,
      ingredient_id
    from inserted_movements
    where movement_type = 'sale'
    order by tenant_id, branch_id, ingredient_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        v_row.tenant_id::text || ':' ||
        v_row.branch_id::text || ':' ||
        v_row.ingredient_id::text,
        0
      )
    );
  end loop;

  -- Check the final ledger balance after acquiring all locks.
  for v_row in
    select distinct
      tenant_id,
      branch_id,
      ingredient_id
    from inserted_movements
    where movement_type = 'sale'
    order by tenant_id, branch_id, ingredient_id
  loop
    select
      coalesce(sum(m.quantity), 0),
      i.name
    into v_balance, v_name
    from public.inventory_movements m
    join public.ingredients i
      on i.id = m.ingredient_id
     and i.tenant_id = m.tenant_id
    where m.tenant_id = v_row.tenant_id
      and m.branch_id = v_row.branch_id
      and m.ingredient_id = v_row.ingredient_id
    group by i.name;

    if coalesce(v_balance, 0) < 0 then
      raise exception
        'مخزون غير كافٍ: % — الرصيد بعد البيع سيكون %',
        coalesce(v_name, v_row.ingredient_id::text),
        coalesce(v_balance, 0);
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.prevent_negative_stock_after_sale()
from public, anon, authenticated;

drop trigger if exists trg_prevent_negative_stock
on public.inventory_movements;

create trigger trg_prevent_negative_stock
after insert on public.inventory_movements
referencing new table as inserted_movements
for each statement
execute function public.prevent_negative_stock_after_sale();
