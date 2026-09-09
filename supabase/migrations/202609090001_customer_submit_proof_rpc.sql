create or replace function public.submit_order_payment_proof(
  p_order_id uuid,
  p_buyer_id uuid,
  p_proof_url text,
  p_payment_reference text,
  p_transfer_date timestamptz
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders;
  normalized_proof_url text;
  normalized_reference text;
  normalized_transfer_date timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_order_id is null then
    raise exception 'Order is required';
  end if;

  if p_buyer_id is null then
    raise exception 'Buyer is required';
  end if;

  if auth.uid() is distinct from p_buyer_id then
    raise exception 'Only the buyer may submit payment proof for this order';
  end if;

  normalized_proof_url := trim(p_proof_url);
  normalized_reference := trim(p_payment_reference);
  normalized_transfer_date := p_transfer_date;

  if normalized_proof_url = '' then
    raise exception 'Payment proof image is required';
  end if;

  if normalized_reference = '' then
    raise exception 'Transfer reference is required';
  end if;

  if normalized_transfer_date is null then
    raise exception 'Transfer date is required';
  end if;

  select *
    into order_row
    from public.orders
    where id = p_order_id
      and buyer_id = p_buyer_id
    for update;

  if order_row.id is null then
    raise exception 'Order not found for this buyer';
  end if;

  if order_row.payment_status = 'PAID' or order_row.order_status = 'PAID' then
    raise exception 'Payment proof cannot be submitted for a paid order';
  end if;

  if order_row.order_status = 'CANCELLED' or order_row.payment_status = 'CANCELLED' then
    raise exception 'Payment proof cannot be submitted for a cancelled order';
  end if;

  if order_row.seller_id is null or order_row.product_id is null or order_row.total is null then
    raise exception 'Order is missing required seller or product details';
  end if;

  update public.orders
     set payment_proof_url = normalized_proof_url,
         payment_reference = normalized_reference,
         payment_transfer_date = normalized_transfer_date,
         updated_at = now()
   where id = p_order_id
     and buyer_id = p_buyer_id
   returning * into order_row;

  return order_row;
end;
$$;

