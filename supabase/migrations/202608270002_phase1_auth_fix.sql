create or replace function public.user_is_active_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
      and p.account_status = 'ACTIVE'
  );
$$;

create or replace function public.bootstrap_staging_admin(target_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.profiles;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Only a service-role request may bootstrap staging admins';
  end if;

  begin
    alter table public.profiles disable trigger profiles_security_guard;

    update public.profiles
      set role = 'ADMIN', account_status = 'ACTIVE'
      where id = target_user_id
      returning * into updated_row;

    if updated_row.id is null then
      raise exception 'Profile not found for admin bootstrap';
    end if;

    return updated_row;
  exception when others then
    alter table public.profiles enable trigger profiles_security_guard;
    raise;
  end;
exception when others then
  alter table public.profiles enable trigger profiles_security_guard;
  raise;
end;
$$;

create or replace function public.enforce_profile_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Profile id is immutable';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Email ownership is immutable';
    end if;

    if new.role is distinct from old.role then
      if not public.user_is_active_admin() then
        raise exception 'Only an active admin may change profile role';
      end if;
    end if;

    if new.account_status is distinct from old.account_status then
      if not public.user_is_active_admin() then
        raise exception 'Only an active admin may change account status';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "seller_profiles_select_admin" on public.seller_profiles;
drop policy if exists "admins_manage_seller_verification" on public.seller_profiles;

create policy "profiles_select_admin" on public.profiles
for select using (user_is_active_admin());

create policy "profiles_admin_update" on public.profiles
for update using (user_is_active_admin())
with check (
  user_is_active_admin() and
  role in ('SELLER', 'ADMIN') and
  account_status in ('ACTIVE', 'SUSPENDED')
);

create policy "seller_profiles_select_admin" on public.seller_profiles
for select using (user_is_active_admin());

create policy "admins_manage_seller_verification" on public.seller_profiles
for update using (user_is_active_admin())
with check (
  user_is_active_admin() and
  verification_status in ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED')
);
