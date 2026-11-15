-- Onboarding: create the signed-in user's cafe with phone, main-branch address and currency in one step.
-- Currency is locked after creation (protect_tenant_columns), so it must be set at insert time here.
create or replace function public.create_cafe(_name text, _phone text default null, _address text default null, _currency text default 'EGP')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid; v_branch uuid; v_plan uuid; v_trial int; v_sub uuid;
  v_currency text := upper(coalesce(nullif(trim(_currency), ''), 'EGP'));
begin
  if v_uid is null then raise exception 'يجب تسجيل الدخول أولاً'; end if;
  if _name is null or char_length(trim(_name)) < 2 or char_length(trim(_name)) > 120 then
    raise exception 'اسم الكافيه يجب أن يكون من 2 إلى 120 حرف';
  end if;
  if _phone is not null and char_length(trim(_phone)) > 30 then
    raise exception 'رقم الهاتف طويل جداً';
  end if;
  if _address is not null and char_length(trim(_address)) > 200 then
    raise exception 'العنوان يجب ألا يزيد عن 200 حرف';
  end if;
  if v_currency not in ('EGP', 'SAR', 'AED', 'KWD', 'QAR', 'USD', 'EUR') then
    raise exception 'العملة غير مدعومة';
  end if;
  if (select count(*) from public.memberships where user_id = v_uid and role = 'owner') >= 5 then
    raise exception 'وصلت للحد الأقصى من الحسابات (5)';
  end if;

  insert into public.tenants (name, phone, currency, is_demo, created_by)
  values (trim(_name), nullif(trim(_phone), ''), v_currency, false, v_uid)
  returning id into v_tenant;

  insert into public.branches (tenant_id, name, address, phone, is_main)
  values (v_tenant, 'الفرع الرئيسي', nullif(trim(_address), ''), nullif(trim(_phone), ''), true)
  returning id into v_branch;

  insert into public.memberships (tenant_id, user_id, role, branch_id) values (v_tenant, v_uid, 'owner', v_branch);

  select id, trial_days into v_plan, v_trial from public.subscription_plans where code = 'professional';
  if v_plan is not null then
    insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start)
    values (v_tenant, v_plan, 'trialing', now() + make_interval(days => v_trial), now()) returning id into v_sub;
    insert into public.subscription_history (tenant_id, subscription_id, event, to_status, plan_id, created_by, note)
    values (v_tenant, v_sub, 'trial_started', 'trialing', v_plan, v_uid, 'بداية الفترة التجريبية');
  end if;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, summary)
  values (v_tenant, v_uid, 'insert', 'tenants', v_tenant, trim(_name));

  return v_tenant;
end $function$;

revoke all on function public.create_cafe(text, text, text, text) from public, anon;
grant execute on function public.create_cafe(text, text, text, text) to authenticated;