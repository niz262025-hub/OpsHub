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

  alter table public.products disable trigger products_security_guard;

  update public.products
    set quantity = quantity - p_quantity,
        updated_at = now()
    where id = p_product_id;

  alter table public.products enable trigger products_security_guard;
end;
$$;

create or replace function public.enforce_product_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if new.seller_id is distinct from auth.uid() then
    raise exception 'Seller can only manage their own products';
  end if;

  if not public.user_is_verified_seller(auth.uid()) then
    raise exception 'Only verified sellers may manage marketplace products';
  end if;

  if tg_op = 'UPDATE' and old.id is distinct from new.id then
    raise exception 'Product id is immutable';
  end if;

  if tg_op = 'UPDATE' and old.seller_id is distinct from new.seller_id then
    raise exception 'Product ownership is immutable';
  end if;

  return new;
end;
$$;
