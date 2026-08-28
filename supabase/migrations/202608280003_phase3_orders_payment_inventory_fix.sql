create or replace function public.adjust_product_inventory_for_order(p_product_id uuid, p_quantity integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_quantity <= 0 then
    raise exception 'Order quantity must be greater than zero';
  end if;

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Product not found';
  end if;

  perform set_config('app.allow_product_inventory_adjustment', 'true', true);

  update public.products
    set quantity = quantity - p_quantity,
        updated_at = now()
    where id = p_product_id;

  perform set_config('app.allow_product_inventory_adjustment', 'false', true);
exception when others then
  perform set_config('app.allow_product_inventory_adjustment', 'false', true);
  raise;
end;
$$;

create or replace function public.create_order_for_product(p_buyer_id uuid, p_product_id uuid, p_quantity integer)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products;
  created_order public.orders;
  order_total numeric(12,2);
begin
  if p_buyer_id is null then
    raise exception 'Buyer is required';
  end if;

  if auth.uid() is not null and auth.uid() <> p_buyer_id then
    raise exception 'Buyer mismatch';
  end if;

  select *
    into product_row
    from public.products
    where id = p_product_id
    for update;

  if product_row.id is null then
    raise exception 'Product not found';
  end if;

  if product_row.status <> 'PUBLISHED' or product_row.is_public = false then
    raise exception 'Product is not available for purchase';
  end if;

  if p_quantity <= 0 then
    raise exception 'Order quantity must be greater than zero';
  end if;

  if product_row.quantity < p_quantity then
    raise exception 'Insufficient inventory for this product';
  end if;

  order_total = public.calculate_order_total(product_row.price, p_quantity);

  insert into public.orders (
    buyer_id,
    seller_id,
    product_id,
    quantity,
    unit_price,
    subtotal,
    total,
    currency,
    order_status,
    payment_status
  ) values (
    p_buyer_id,
    product_row.seller_id,
    product_row.id,
    p_quantity,
    product_row.price,
    order_total,
    order_total,
    'USD',
    'PENDING_PAYMENT',
    'PENDING'
  ) returning * into created_order;

  perform public.adjust_product_inventory_for_order(product_row.id, p_quantity);

  return created_order;
end;
$$;
