alter table public.seller_profiles
  add column if not exists bank_name text,
  add column if not exists account_holder_name text,
  add column if not exists account_number text,
  add column if not exists payment_instructions text,
  add column if not exists qr_image_url text;

alter table public.orders
  add column if not exists payment_proof_url text,
  add column if not exists payment_reference text,
  add column if not exists payment_transfer_date timestamptz,
  add column if not exists payment_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists payment_verified_at timestamptz;

create or replace function public.enforce_order_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.buyer_id is distinct from old.buyer_id then
      raise exception 'Order buyer is immutable';
    end if;

    if new.seller_id is distinct from old.seller_id then
      raise exception 'Order seller is immutable';
    end if;

    if new.product_id is distinct from old.product_id then
      raise exception 'Order product is immutable';
    end if;

    if new.total is distinct from old.total then
      raise exception 'Order totals are server-controlled';
    end if;

    if new.unit_price is distinct from old.unit_price then
      raise exception 'Unit price is server-controlled';
    end if;

    if new.currency is distinct from old.currency then
      raise exception 'Currency is immutable';
    end if;

    if new.payment_status is distinct from old.payment_status then
      if auth.uid() is not distinct from old.buyer_id then
        null;
      elsif auth.uid() is not distinct from old.seller_id then
        null;
      elsif not public.user_is_active_admin() then
        raise exception 'Only the buyer, seller, or an active admin may update payment status';
      end if;
    end if;

    if new.order_status is distinct from old.order_status and new.order_status not in ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED') then
      raise exception 'Invalid order state transition';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.mark_order_paid_by_manual_transfer(p_order_id uuid, p_seller_id uuid, p_verifier_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_order public.orders;
begin
  if p_order_id is null then
    raise exception 'Order is required';
  end if;

  if p_seller_id is null then
    raise exception 'Seller is required';
  end if;

  if p_verifier_id is null then
    raise exception 'Verifier is required';
  end if;

  select *
    into updated_order
    from public.orders
    where id = p_order_id
      and seller_id = p_seller_id
    for update;

  if updated_order.id is null then
    raise exception 'Order not found for this seller';
  end if;

  if updated_order.payment_status = 'PAID' then
    return updated_order;
  end if;

  update public.orders
     set order_status = 'PAID',
         payment_status = 'PAID',
         payment_verified_by = p_verifier_id,
         payment_verified_at = now()
   where id = p_order_id
     and seller_id = p_seller_id
   returning * into updated_order;

  insert into public.finance_records (
    seller_id,
    order_id,
    amount,
    currency,
    direction,
    payment_status,
    transaction_reference
  ) values (
    updated_order.seller_id,
    updated_order.id,
    updated_order.total,
    updated_order.currency,
    'SALE',
    'PAID',
    'MANUAL_TRANSFER_' || updated_order.id::text
  ) on conflict do nothing;

  return updated_order;
end;
$$;

create policy "seller_profiles_select_order_buyer" on public.seller_profiles
for select using (
  auth.uid() = user_id
  or user_is_active_admin()
  or exists (
    select 1 from public.orders o
    where o.seller_id = seller_profiles.user_id
      and o.buyer_id = auth.uid()
  )
);

create policy "seller_profiles_update_own_bank_details" on public.seller_profiles
for update using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and
  full_name is not null and
  email is not null and
  phone is not null and
  business_name is not null and
  business_address is not null
);
