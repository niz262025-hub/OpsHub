create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_status') then
    create type public.product_status as enum ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'product_source') then
    create type public.product_source as enum ('OWNED', 'WHOLESALER', 'MANUFACTURER', 'DROP_SHIP');
  end if;
end $$;

create or replace function public.user_is_verified_seller(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.seller_profiles sp on sp.user_id = p.id
    where p.id = p_user_id
      and p.role = 'SELLER'
      and p.account_status = 'ACTIVE'
      and sp.verification_status = 'VERIFIED'
  );
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

create or replace function public.enforce_product_image_ownership()
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
    raise exception 'Seller can only manage their own product images';
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = new.product_id
      and p.seller_id = auth.uid()
  ) then
    raise exception 'Seller can only manage their own product images';
  end if;

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    raise exception 'Product image attachment is immutable';
  end if;

  return new;
end;
$$;

create or replace function public.generate_product_share_url(p_product_id uuid)
returns text
language sql
stable
as $$
  select '/products/' || p_product_id::text;
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  status public.product_status not null default 'DRAFT',
  source public.product_source not null default 'OWNED',
  is_public boolean not null default false,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  image_url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('marketplace-product-images', 'marketplace-product-images', false)
on conflict (id) do nothing;

create or replace function public.products_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.product_images_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute procedure public.products_set_updated_at();

create trigger product_images_set_updated_at
before update on public.product_images
for each row execute procedure public.product_images_set_updated_at();

create trigger products_security_guard
before insert or update on public.products
for each row execute procedure public.enforce_product_ownership();

create trigger product_images_security_guard
before insert or update on public.product_images
for each row execute procedure public.enforce_product_image_ownership();

alter table public.products enable row level security;
alter table public.product_images enable row level security;

create policy "products_select_public" on public.products
for select using (status = 'PUBLISHED' and is_public = true);

create policy "products_select_own_or_admin" on public.products
for select using (auth.uid() = seller_id or user_is_active_admin());

create policy "products_insert_own" on public.products
for insert with check (
  auth.uid() = seller_id and
  public.user_is_verified_seller(auth.uid()) and
  status in ('DRAFT', 'PUBLISHED', 'ARCHIVED') and
  source in ('OWNED', 'WHOLESALER', 'MANUFACTURER', 'DROP_SHIP')
);

create policy "products_update_own" on public.products
for update using (auth.uid() = seller_id)
with check (
  auth.uid() = seller_id and
  public.user_is_verified_seller(auth.uid())
);

create policy "products_delete_own" on public.products
for delete using (auth.uid() = seller_id);

create policy "product_images_select_public" on public.product_images
for select using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.status = 'PUBLISHED'
      and p.is_public = true
  )
);

create policy "product_images_select_own_or_admin" on public.product_images
for select using (auth.uid() = seller_id or user_is_active_admin());

create policy "product_images_insert_own" on public.product_images
for insert with check (
  auth.uid() = seller_id and
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.seller_id = auth.uid()
  )
);

create policy "product_images_update_own" on public.product_images
for update using (auth.uid() = seller_id)
with check (
  auth.uid() = seller_id and
  exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.seller_id = auth.uid()
  )
);

create policy "product_images_delete_own" on public.product_images
for delete using (auth.uid() = seller_id);

create policy "marketplace_product_images_select_public" on storage.objects
for select using (
  bucket_id = 'marketplace-product-images' and exists (
    select 1
    from public.product_images pi
    join public.products p on p.id = pi.product_id
    where pi.storage_path = storage.objects.name
      and p.status = 'PUBLISHED'
      and p.is_public = true
  )
);

create policy "marketplace_product_images_select_own_or_admin" on storage.objects
for select using (
  bucket_id = 'marketplace-product-images' and (
    split_part(name, '/', 1) = auth.uid()::text
    or user_is_active_admin()
  )
);

create policy "marketplace_product_images_insert_own" on storage.objects
for insert with check (
  bucket_id = 'marketplace-product-images' and
  auth.uid() is not null and
  split_part(name, '/', 1) = auth.uid()::text
);

create policy "marketplace_product_images_update_own" on storage.objects
for update using (
  bucket_id = 'marketplace-product-images' and
  split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'marketplace-product-images' and
  split_part(name, '/', 1) = auth.uid()::text
);

create policy "marketplace_product_images_delete_own" on storage.objects
for delete using (
  bucket_id = 'marketplace-product-images' and
  split_part(name, '/', 1) = auth.uid()::text
);
