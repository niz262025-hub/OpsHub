create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'PENDING_PAYMENT',
      'PAID',
      'PROCESSING',
      'SHIPPED',
      'COMPLETED',
      'CANCELLED'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'PENDING',
      'AUTHORIZED',
      'PAID',
      'FAILED',
      'CANCELLED',
      'REFUNDED'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_direction') then
    create type public.finance_direction as enum (
      'SALE',
      'REFUND',
      'PAYOUT',
      'ADJUSTMENT'
    );
  end if;
end $$;

create or replace function public.calculate_order_total(p_unit_price numeric(12,2), p_quantity integer)
returns numeric(12,2)
language sql
stable
as $$
  select (p_unit_price * p_quantity)::numeric(12,2);
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  total numeric(12,2) not null check (total >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  order_status public.order_status not null default 'PENDING_PAYMENT',
  payment_status public.payment_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.user_is_order_buyer(p_order_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.buyer_id = p_user_id
  );
$$;

create or replace function public.user_owns_order_product(p_order_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.products p on p.id = o.product_id
    where o.id = p_order_id
      and p.seller_id = p_user_id
  );
$$;

create or replace function public.order_inventory_locked(p_product_id uuid, p_quantity integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_quantity integer;
begin
  select quantity
    into current_quantity
    from public.products
    where id = p_product_id
    for update;

  if current_quantity is null then
    raise exception 'Product not found';
  end if;

  if p_quantity <= 0 then
    raise exception 'Order quantity must be greater than zero';
  end if;

  if current_quantity < p_quantity then
    raise exception 'Insufficient inventory for this product';
  end if;

  return true;
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

  if p_buyer_id = auth.uid() then
    null;
  elsif auth.uid() is not null and auth.uid() <> p_buyer_id then
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

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'UNSPECIFIED',
  provider_reference text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_status public.payment_status not null default 'PENDING',
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  direction public.finance_direction not null,
  payment_status public.payment_status not null default 'PENDING',
  transaction_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
before update on public.orders
for each row execute procedure public.set_updated_at();

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute procedure public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute procedure public.set_updated_at();

create trigger finance_records_set_updated_at
before update on public.finance_records
for each row execute procedure public.set_updated_at();

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

    if new.payment_status is distinct from old.payment_status and auth.uid() is distinct from old.buyer_id and not public.user_is_active_admin() then
      raise exception 'Only the buyer or an active admin may update payment status';
    end if;

    if new.order_status is distinct from old.order_status and new.order_status not in ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED') then
      raise exception 'Invalid order state transition';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_payment_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.order_id is distinct from old.order_id then
      raise exception 'Payment order is immutable';
    end if;

    if new.amount is distinct from old.amount then
      raise exception 'Payment amount is server-controlled';
    end if;

    if new.currency is distinct from old.currency then
      raise exception 'Payment currency is immutable';
    end if;

    if new.payment_status is distinct from old.payment_status and not public.user_is_active_admin() then
      raise exception 'Client payment updates are not permitted';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_finance_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.seller_id is distinct from old.seller_id then
      raise exception 'Finance seller is immutable';
    end if;

    if new.order_id is distinct from old.order_id then
      raise exception 'Finance order is immutable';
    end if;

    if new.amount is distinct from old.amount then
      raise exception 'Finance amount is server-controlled';
    end if;

    if new.payment_status is distinct from old.payment_status and not public.user_is_active_admin() then
      raise exception 'Finance status may only be updated by the server or admin';
    end if;
  end if;

  return new;
end;
$$;

create trigger orders_security_guard
before insert or update on public.orders
for each row execute procedure public.enforce_order_security();

create trigger payments_security_guard
before insert or update on public.payments
for each row execute procedure public.enforce_payment_security();

create trigger finance_records_security_guard
before insert or update on public.finance_records
for each row execute procedure public.enforce_finance_security();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.finance_records enable row level security;

create policy "orders_select_own_or_seller_or_admin" on public.orders
for select using (
  auth.uid() = buyer_id
  or auth.uid() = seller_id
  or user_is_active_admin()
);

create policy "orders_insert_own" on public.orders
for insert with check (
  auth.uid() = buyer_id
  and seller_id is not null
  and product_id is not null
  and quantity > 0
  and total = subtotal
  and order_status = 'PENDING_PAYMENT'
  and payment_status = 'PENDING'
);

create policy "orders_update_own_or_admin" on public.orders
for update using (
  auth.uid() = buyer_id
  or auth.uid() = seller_id
  or user_is_active_admin()
)
with check (
  auth.uid() = buyer_id or auth.uid() = seller_id or user_is_active_admin()
);

create policy "orders_delete_own_or_admin" on public.orders
for delete using (
  auth.uid() = buyer_id
  or auth.uid() = seller_id
  or user_is_active_admin()
);

create policy "order_items_select_own_or_seller_or_admin" on public.order_items
for select using (
  auth.uid() = seller_id
  or exists (select 1 from public.orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
  or user_is_active_admin()
);

create policy "order_items_insert_own" on public.order_items
for insert with check (
  auth.uid() = seller_id
  and exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid())
);

create policy "order_items_update_own_or_admin" on public.order_items
for update using (
  auth.uid() = seller_id
  or user_is_active_admin()
)
with check (
  auth.uid() = seller_id or user_is_active_admin()
);

create policy "payments_select_own_or_seller_or_admin" on public.payments
for select using (
  exists (select 1 from public.orders o where o.id = payments.order_id and o.buyer_id = auth.uid())
  or exists (select 1 from public.orders o where o.id = payments.order_id and o.seller_id = auth.uid())
  or user_is_active_admin()
);

create policy "payments_insert_own" on public.payments
for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  and payment_status = 'PENDING'
);

create policy "payments_update_admin_only" on public.payments
for update using (user_is_active_admin())
with check (user_is_active_admin());

create policy "finance_records_select_own_or_admin" on public.finance_records
for select using (
  auth.uid() = seller_id
  or exists (select 1 from public.orders o where o.id = finance_records.order_id and o.buyer_id = auth.uid())
  or user_is_active_admin()
);

create policy "finance_records_insert_own" on public.finance_records
for insert with check (
  auth.uid() = seller_id and payment_status in ('PENDING', 'PAID', 'REFUNDED')
);

create policy "finance_records_update_admin_only" on public.finance_records
for update using (user_is_active_admin())
with check (user_is_active_admin());
