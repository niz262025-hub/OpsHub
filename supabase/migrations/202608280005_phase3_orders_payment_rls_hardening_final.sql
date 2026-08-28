drop policy if exists "orders_select_own_or_seller_or_admin" on public.orders;
drop policy if exists "orders_insert_own" on public.orders;
drop policy if exists "orders_update_own_or_admin" on public.orders;
drop policy if exists "orders_update_admin_only" on public.orders;
drop policy if exists "orders_delete_own_or_admin" on public.orders;
drop policy if exists "orders_delete_admin_only" on public.orders;

drop trigger if exists orders_hardened_insert_guard on public.orders;
drop trigger if exists orders_client_mutation_guard on public.orders;
drop trigger if exists orders_security_guard on public.orders;

create or replace function public.validate_order_insert_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products;
  computed_total numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if new.buyer_id is distinct from auth.uid() then
    raise exception 'Buyer mismatch';
  end if;

  if new.product_id is null then
    raise exception 'Product is required';
  end if;

  select *
    into product_row
    from public.products
    where id = new.product_id
    for update;

  if product_row.id is null then
    raise exception 'Product not found';
  end if;

  if product_row.seller_id is distinct from new.seller_id then
    raise exception 'Seller ownership mismatch';
  end if;

  if product_row.status <> 'PUBLISHED' or product_row.is_public = false then
    raise exception 'Product is not available for purchase';
  end if;

  if new.quantity <= 0 then
    raise exception 'Order quantity must be greater than zero';
  end if;

  if product_row.quantity < new.quantity then
    raise exception 'Insufficient inventory for this product';
  end if;

  if new.unit_price is distinct from product_row.price then
    raise exception 'Unit price is server-controlled';
  end if;

  computed_total := product_row.price * new.quantity;

  if new.subtotal is distinct from computed_total then
    raise exception 'Subtotal is server-controlled';
  end if;

  if new.total is distinct from computed_total then
    raise exception 'Total is server-controlled';
  end if;

  if new.currency is distinct from 'USD' then
    raise exception 'Currency is immutable';
  end if;

  if new.order_status is distinct from 'PENDING_PAYMENT' then
    raise exception 'Order status is server-controlled';
  end if;

  if new.payment_status is distinct from 'PENDING' then
    raise exception 'Payment status is server-controlled';
  end if;

  return new;
end;
$$;

create trigger orders_hardened_insert_guard
before insert on public.orders
for each row execute procedure public.validate_order_insert_security();

create or replace function public.block_client_order_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.user_is_active_admin() then
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
      raise exception 'Client payment updates are not permitted';
    end if;

    if new.order_status is distinct from old.order_status then
      raise exception 'Client order-state updates are not permitted';
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_client_mutation_guard
before update on public.orders
for each row execute procedure public.block_client_order_mutation();

alter table public.orders enable row level security;

create policy "orders_select_own_or_seller_or_admin" on public.orders
for select using (
  auth.uid() = buyer_id
  or auth.uid() = seller_id
  or user_is_active_admin()
);

create policy "orders_insert_own" on public.orders
for insert with check (
  auth.uid() = buyer_id and
  seller_id = (select p.seller_id from public.products p where p.id = product_id) and
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'PUBLISHED'
      and p.is_public = true
      and p.quantity >= quantity
      and p.price = unit_price
  ) and
  subtotal = (select p.price from public.products p where p.id = product_id) * quantity and
  total = subtotal and
  currency = 'USD' and
  order_status = 'PENDING_PAYMENT' and
  payment_status = 'PENDING'
);

create policy "orders_update_admin_only" on public.orders
for update using (user_is_active_admin())
with check (user_is_active_admin());

create policy "orders_delete_admin_only" on public.orders
for delete using (user_is_active_admin());
