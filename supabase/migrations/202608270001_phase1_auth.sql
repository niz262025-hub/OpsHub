create extension if not exists "pgcrypto";

create type public.user_role as enum ('ADMIN', 'SELLER');
create type public.account_status as enum ('ACTIVE', 'SUSPENDED');
create type public.seller_verification_status as enum ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role public.user_role not null default 'SELLER',
  account_status public.account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  business_name text not null,
  business_registration_number text,
  business_address text not null,
  verification_status public.seller_verification_status not null default 'PENDING',
  verification_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
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
      if not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'ADMIN'
          and p.account_status = 'ACTIVE'
      ) then
        raise exception 'Only an active admin may change profile role';
      end if;
    end if;

    if new.account_status is distinct from old.account_status then
      if not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'ADMIN'
          and p.account_status = 'ACTIVE'
      ) then
        raise exception 'Only an active admin may change account status';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_seller_verification_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.user_role;
  caller_account_status public.account_status;
begin
  if tg_op = 'INSERT' and new.verification_status <> 'PENDING' then
    raise exception 'Seller verification status must start as PENDING';
  end if;

  if tg_op = 'UPDATE' and new.verification_status is not null and new.verification_status <> 'PENDING' then
    select role, account_status
      into caller_role, caller_account_status
      from public.profiles
      where id = auth.uid();

    if caller_role is distinct from 'ADMIN' or caller_account_status is distinct from 'ACTIVE' then
      raise exception 'Only an active admin may change seller verification status';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.update_updated_at();

create trigger profiles_security_guard
before update on public.profiles
for each row execute procedure public.enforce_profile_security();

create trigger seller_profiles_set_updated_at
before update on public.seller_profiles
for each row execute procedure public.update_updated_at();

create trigger seller_profiles_security_guard
before insert or update on public.seller_profiles
for each row execute procedure public.enforce_seller_verification_security();

alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  )
);

create policy "profiles_update_self" on public.profiles
for update using (auth.uid() = id)
with check (
  auth.uid() = id and
  role = 'SELLER' and
  account_status = 'ACTIVE' and
  email = email and
  full_name = full_name
);

create policy "profiles_admin_update" on public.profiles
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  ) and
  role in ('SELLER', 'ADMIN') and
  account_status in ('ACTIVE', 'SUSPENDED')
);

create policy "seller_profiles_select_own" on public.seller_profiles
for select using (auth.uid() = user_id);

create policy "seller_profiles_select_admin" on public.seller_profiles
for select using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  )
);

create policy "seller_profiles_update_own" on public.seller_profiles
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and
  verification_status = 'PENDING' and
  verification_note is null and
  full_name is not null and
  email is not null and
  phone is not null and
  business_name is not null and
  business_address is not null
);

create policy "admins_manage_seller_verification" on public.seller_profiles
for update using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  ) and
  verification_status in ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED')
);

create policy "seller_profiles_insert_own" on public.seller_profiles
for insert with check (
  auth.uid() = user_id and
  verification_status = 'PENDING' and
  verification_note is null and
  full_name is not null and
  email is not null and
  phone is not null and
  business_name is not null and
  business_address is not null
);
