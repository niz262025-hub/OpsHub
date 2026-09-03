create or replace function public.create_customer_profile_for_user(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_preferred_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, account_status)
  values (
    p_user_id,
    p_email,
    coalesce(p_full_name, 'Customer'),
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
    p_user_id,
    coalesce(p_full_name, 'Customer'),
    p_email,
    p_phone,
    coalesce(p_preferred_name, '')
  )
  on conflict (user_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone,
    preferred_name = excluded.preferred_name,
    updated_at = now();
end;
$$;

create or replace function public.handle_new_customer_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_customer_profile_for_user(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'first_name', 'Customer')),
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'preferred_name', new.raw_user_meta_data ->> 'first_name', '')
  );

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
    perform public.create_customer_profile_for_user(
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', coalesce(new.raw_user_meta_data ->> 'first_name', 'Customer')),
      new.raw_user_meta_data ->> 'phone',
      coalesce(new.raw_user_meta_data ->> 'preferred_name', new.raw_user_meta_data ->> 'first_name', '')
    );
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
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  if tg_op = 'INSERT' then
    if current_user_id is null then
      if new.user_id is null then
        raise exception 'Customer profile user_id is required';
      end if;

      if not exists (
        select 1
        from auth.users u
        where u.id = new.user_id
      ) then
        raise exception 'Customer profile must reference an existing auth user';
      end if;

      return new;
    end if;

    if new.user_id is distinct from current_user_id then
      raise exception 'Customer profile must belong to the signed-in user';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if current_user_id is null then
      raise exception 'Only a signed-in user may update customer profile';
    end if;

    if new.user_id is distinct from old.user_id then
      raise exception 'Customer profile ownership is immutable';
    end if;

    if new.user_id is distinct from current_user_id then
      raise exception 'Customer profile must belong to the signed-in user';
    end if;
  end if;

  return new;
end;
$$;
