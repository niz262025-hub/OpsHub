create extension if not exists "pgcrypto";

-- Extend the existing user_role enum without altering the seller/admin architecture.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'CUSTOMER'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';
  END IF;
END $$;

create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  preferred_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_customer_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'first_name', 'Customer')),
    'CUSTOMER',
    'ACTIVE'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = 'CUSTOMER',
    account_status = 'ACTIVE',
    updated_at = now();

  insert into public.customer_profiles (user_id, full_name, email, phone, preferred_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'first_name', 'Customer')),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'preferred_name', new.raw_user_meta_data ->> 'first_name', '')
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    preferred_name = excluded.preferred_name,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'customer_registration', 'false') = 'true' then
    perform public.handle_new_customer_user();
    return new;
  end if;

  insert into public.profiles (id, email, full_name, role, account_status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'SELLER',
    'ACTIVE'
  )
  on conflict (id) do nothing;

  insert into public.seller_profiles (
    user_id,
    full_name,
    email,
    phone,
    business_name,
    business_registration_number,
    business_address,
    verification_status,
    verification_note
  )
  select
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'business_name', ''),
    new.raw_user_meta_data ->> 'business_registration_number',
    coalesce(new.raw_user_meta_data ->> 'business_address', ''),
    'PENDING',
    null
  where coalesce(new.raw_user_meta_data ->> 'seller_registration', 'false') = 'true'
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    business_name = excluded.business_name,
    business_registration_number = excluded.business_registration_number,
    business_address = excluded.business_address,
    verification_status = 'PENDING',
    verification_note = null,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.enforce_customer_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'Customer profile must belong to the signed-in user';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Customer profile ownership is immutable';
    end if;
  end if;

  return new;
end;
$$;

create trigger customer_profiles_set_updated_at
before update on public.customer_profiles
for each row execute procedure public.update_updated_at();

create trigger customer_profiles_security_guard
before insert or update on public.customer_profiles
for each row execute procedure public.enforce_customer_security();

alter table public.customer_profiles enable row level security;

create policy "customer_profiles_select_own" on public.customer_profiles
for select using (auth.uid() = user_id);

create policy "customer_profiles_select_admin" on public.customer_profiles
for select using (user_is_active_admin());

create policy "customer_profiles_update_own" on public.customer_profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "customer_profiles_insert_own" on public.customer_profiles
for insert with check (auth.uid() = user_id);

create policy "customer_profiles_delete_own" on public.customer_profiles
for delete using (auth.uid() = user_id);

create or replace function public.user_is_customer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'CUSTOMER'
      and p.account_status = 'ACTIVE'
  );
$$;

create or replace function public.user_is_customer_or_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_is_customer(p_user_id) or public.user_is_active_admin();
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
