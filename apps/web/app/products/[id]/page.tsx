'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCurrentUserProfileRole } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type PublicProductRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  source: 'OWNED' | 'WHOLESALER' | 'MANUFACTURER' | 'DROP_SHIP';
  is_public: boolean;
  image_url: string | null;
};

export default function PublicProductPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProductRow | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setProduct(null);
        setLoading(false);
        return;
      }

      setProduct(data as PublicProductRow);
      const profile = await getCurrentUserProfileRole();
      if (active) {
        setRole(profile.role ?? null);
      }
      setLoading(false);
    }

    void loadProduct();

    return () => {
      active = false;
    };
  }, [params.id, supabase]);

  if (loading) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="muted">Loading product…</p></article></main>;
  }

  if (!product || product.status !== 'PUBLISHED' || product.is_public !== true) {
    return <main className="marketplace-shell narrow"><article className="panel"><p className="muted">This product is not available for purchase.</p></article></main>;
  }

  const imageUrl = product.image_url ?? 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80';

  return (
    <main className="marketplace-shell narrow">
      <article className="panel product-detail public-product">
        <div className="product-detail-image-wrap">
          <img src={imageUrl} alt={product.name} className="product-detail-image" />
        </div>
        <div>
          <p className="eyebrow">OPSHUB</p>
          <h1>{product.name}</h1>
          <p className="price-row">${Number(product.price).toFixed(2)}</p>
          <p className="status-row">{product.quantity} available · {product.source}</p>
          <p className="description">{product.description ?? 'No description provided.'}</p>
          <div className="product-detail-actions">
            {role === 'CUSTOMER' ? (
              <Link href={`/products/${product.id}/checkout`}>Buy now</Link>
            ) : (
              <>
                <Link href="/auth/customer/login">Customer login</Link>
                <Link href="/auth/customer/register">Customer register</Link>
              </>
            )}
            <Link href="/auth/register">Become a seller</Link>
            <Link href="/auth/login">Seller login</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
