create or replace function public.enforce_order_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.user_is_active_admin() then
    return new;
  end if;

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

    if new.quantity is distinct from old.quantity then
      raise exception 'Order quantity is immutable after creation';
    end if;

    if new.unit_price is distinct from old.unit_price then
      raise exception 'Unit price is server-controlled';
    end if;

    if new.subtotal is distinct from old.subtotal then
      raise exception 'Subtotal is server-controlled';
    end if;

    if new.total is distinct from old.total then
      raise exception 'Order totals are server-controlled';
    end if;

    if new.currency is distinct from old.currency then
      raise exception 'Currency is immutable';
    end if;

    if new.payment_status is distinct from old.payment_status then
      if current_setting('app.allow_manual_transfer_payment', true) = 'true' then
        null;
      elsif auth.uid() = old.seller_id then
        raise exception 'Client payment updates are not permitted';
      else
        raise exception 'Client payment updates are not permitted';
      end if;
    end if;

    if new.order_status is distinct from old.order_status then
      if current_setting('app.allow_manual_transfer_payment', true) = 'true' then
        null;
      else
        raise exception 'Client order-state updates are not permitted';
      end if;
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
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_order_id is null then
    raise exception 'Order is required';
  end if;

  if p_seller_id is null then
    raise exception 'Seller is required';
  end if;

  if p_verifier_id is null then
    raise exception 'Verifier is required';
  end if;

  if p_verifier_id is distinct from auth.uid() and not public.user_is_active_admin() then
    raise exception 'Only the active verifier may confirm manual transfer payment';
  end if;

  if p_seller_id is distinct from auth.uid() and not public.user_is_active_admin() then
    raise exception 'Only the seller or an active admin may verify manual transfer payment';
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

  if updated_order.payment_proof_url is null or updated_order.payment_proof_url = '' then
    raise exception 'Payment proof is required before manual verification';
  end if;

  perform set_config('app.allow_manual_transfer_payment', 'true', true);

  update public.orders
     set order_status = 'PAID',
         payment_status = 'PAID',
         payment_verified_by = auth.uid(),
         payment_verified_at = now()
   where id = p_order_id
     and seller_id = p_seller_id
   returning * into updated_order;

  perform set_config('app.allow_manual_transfer_payment', 'false', true);

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
  ) on conflict (order_id, direction, transaction_reference) do nothing;

  return updated_order;
end;
$$;
