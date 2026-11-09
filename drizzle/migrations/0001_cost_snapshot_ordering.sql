alter table public.recipe_cost_snapshots alter column created_at set default clock_timestamp();
alter table public.ingredient_cost_history alter column created_at set default clock_timestamp();

create or replace function public.recalc_recipe(_recipe uuid, _reason text default 'recalc')
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.recipes%rowtype;
  v_ing numeric := 0; v_pack numeric := 0; v_opt numeric := 0;
  v_waste numeric; v_total numeric; v_yield_base numeric; v_cpu numeric; v_cpp numeric;
  v_parent uuid;
  v_last record;
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
    cost_updated_at = clock_timestamp()
  where id = _recipe;

  if r.cost_updated_at is null or r.total_cost is distinct from v_total or r.cost_per_portion is distinct from v_cpp then
    select id, reason, created_at into v_last from public.recipe_cost_snapshots
      where recipe_id = _recipe order by created_at desc limit 1;
    -- Merge rapid consecutive edits while a recipe is being built, so history shows meaningful versions.
    if v_last.id is not null and v_last.reason in ('created', 'recipe_edited')
       and _reason in ('created', 'recipe_edited')
       and v_last.created_at > clock_timestamp() - interval '10 minutes' then
      update public.recipe_cost_snapshots set
        ingredient_cost = round(v_ing, 4), packaging_cost = round(v_pack, 4), waste_cost = v_waste,
        total_cost = v_total, cost_per_portion = v_cpp, created_at = clock_timestamp()
      where id = v_last.id;
    else
      insert into public.recipe_cost_snapshots (tenant_id, recipe_id, ingredient_cost, packaging_cost, waste_cost, total_cost, cost_per_portion, reason)
      values (r.tenant_id, _recipe, round(v_ing, 4), round(v_pack, 4), v_waste, v_total, v_cpp, _reason);
    end if;
  end if;

  if r.cost_per_unit is distinct from v_cpu then
    for v_parent in select distinct recipe_id from public.recipe_items where sub_recipe_id = _recipe loop
      perform public.recalc_recipe(v_parent, 'sub_recipe_changed');
    end loop;
  end if;
end $$;
revoke execute on function public.recalc_recipe(uuid, text) from public, anon, authenticated;
