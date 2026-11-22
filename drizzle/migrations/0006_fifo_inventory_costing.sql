
-- CAFE OS: FIFO inventory cost layers.
-- Preserve the cost of each received stock batch separately.

create table public.inventory_cost_layers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  ingredient_id uuid not null,
  source_movement_id uuid not null unique,
  received_at timestamptz not null,
  original_quantity numeric(14,3) not null check (original_quantity > 0),
  remaining_quantity numeric(14,3) not null
    check (remaining_quantity >= 0 and remaining_quantity <= original_quantity),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),

  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id),
  foreign key (ingredient_id, tenant_id)
    references public.ingredients(id, tenant_id),
  foreign key (source_movement_id)
    references public.inventory_movements(id)
);

create index idx_inventory_cost_layers_fifo
  on public.inventory_cost_layers(
    tenant_id, branch_id, ingredient_id, received_at, id
  )
  where remaining_quantity > 0;

create table public.inventory_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null,
  ingredient_id uuid not null,
  movement_id uuid not null,
  cost_layer_id uuid not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,4) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),

  foreign key (branch_id, tenant_id)
    references public.branches(id, tenant_id),
  foreign key (ingredient_id, tenant_id)
    references public.ingredients(id, tenant_id),
  foreign key (movement_id)
    references public.inventory_movements(id),
  foreign key (cost_layer_id)
    references public.inventory_cost_layers(id),

  unique (movement_id, cost_layer_id)
);

create index idx_inventory_cost_allocations_movement
  on public.inventory_cost_allocations(movement_id);

create index idx_inventory_cost_allocations_layer
  on public.inventory_cost_allocations(cost_layer_id);

-- Protect the new tables.
alter table public.inventory_cost_layers enable row level security;
alter table public.inventory_cost_allocations enable row level security;

revoke all on public.inventory_cost_layers from anon, authenticated;
revoke all on public.inventory_cost_allocations from anon, authenticated;

grant select on public.inventory_cost_layers to authenticated;
grant select on public.inventory_cost_allocations to authenticated;

create policy "members read inventory cost layers"
  on public.inventory_cost_layers
  for select to authenticated
  using (
    public.has_module(tenant_id, 'inventory')
    or public.has_module(tenant_id, 'purchasing')
  );

create policy "members read inventory cost allocations"
  on public.inventory_cost_allocations
  for select to authenticated
  using (
    public.has_module(tenant_id, 'inventory')
    or public.has_module(tenant_id, 'purchasing')
  );

-- Create a separate cost layer for every existing positive movement.
insert into public.inventory_cost_layers (
  tenant_id,
  branch_id,
  ingredient_id,
  source_movement_id,
  received_at,
  original_quantity,
  remaining_quantity,
  unit_cost
)
select
  m.tenant_id,
  m.branch_id,
  m.ingredient_id,
  m.id,
  m.created_at,
  m.quantity,
  m.quantity,
  m.unit_cost
from public.inventory_movements m
where m.quantity > 0
order by m.created_at, m.id;

-- Reconstruct historical FIFO consumption.
do $$
declare
  v_move record;
  v_layer record;
  v_need numeric(14,3);
  v_take numeric(14,3);
begin
  for v_move in
    select
      m.id,
      m.tenant_id,
      m.branch_id,
      m.ingredient_id,
      m.quantity,
      m.created_at
    from public.inventory_movements m
    where m.quantity < 0
    order by m.created_at, m.id
  loop
    v_need := abs(v_move.quantity);

    for v_layer in
      select
        l.id,
        l.remaining_quantity,
        l.unit_cost
      from public.inventory_cost_layers l
      where l.tenant_id = v_move.tenant_id
        and l.branch_id = v_move.branch_id
        and l.ingredient_id = v_move.ingredient_id
        and l.remaining_quantity > 0
        and (l.received_at, l.source_movement_id)
            < (v_move.created_at, v_move.id)
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
        v_move.tenant_id,
        v_move.branch_id,
        v_move.ingredient_id,
        v_move.id,
        v_layer.id,
        v_take,
        v_layer.unit_cost
      )
      on conflict (movement_id, cost_layer_id) do nothing;

      update public.inventory_cost_layers
      set remaining_quantity = remaining_quantity - v_take
      where id = v_layer.id;

      v_need := v_need - v_take;
    end loop;

    -- Legacy shortages are not fabricated into cost layers.
  end loop;
end;
$$;

-- Every new positive purchase/transfer/adjustment creates a new cost layer.
create or replace function public.create_inventory_cost_layer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quantity > 0
     and new.movement_type in (
       'purchase',
       'transfer_in',
       'adjustment'
     )
     and coalesce(new.notes, '')
         not like 'إرجاع مخزون لإلغاء طلب%' then

    insert into public.inventory_cost_layers (
      tenant_id,
      branch_id,
      ingredient_id,
      source_movement_id,
      received_at,
      original_quantity,
      remaining_quantity,
      unit_cost
    )
    values (
      new.tenant_id,
      new.branch_id,
      new.ingredient_id,
      new.id,
      new.created_at,
      new.quantity,
      new.quantity,
      new.unit_cost
    );
  end if;

  return new;
end;
$$;

revoke all on function public.create_inventory_cost_layer()
  from public, anon, authenticated;

create trigger trg_create_inventory_cost_layer
after insert on public.inventory_movements
for each row
execute function public.create_inventory_cost_layer();
