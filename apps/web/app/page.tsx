'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { getCurrentUserProfileRole, getSession } from '@/lib/auth';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type FeaturedProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  sellerName: string;
  stock: number;
};

const categories = ['Fashion', 'Beauty', 'Food', 'Electronics', 'Home', 'Lifestyle'];

export default function HomePage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let active = true;

    async function redirectSignedInUser() {
      try {
        const { data: sessionData, error: sessionError } = await getSession();

        if (!active) {
          return;
        }

        if (sessionError || !sessionData.session) {
          setCheckingAuth(false);
          return;
        }

        const profile = await getCurrentUserProfileRole();
        if (!active) {
          return;
        }

        if (profile.error || !profile.role) {
          setCheckingAuth(false);
          return;
        }

        if (profile.role === 'ADMIN' && profile.accountStatus === 'ACTIVE') {
          router.replace('/admin/review');
          return;
        }

        if (profile.role === 'CUSTOMER') {
          router.replace('/customer/orders');
          return;
        }

        if (profile.role === 'SELLER') {
          if (profile.accountStatus === 'SUSPENDED') {
            router.replace('/account/suspended');
            return;
          }

          if (profile.verificationStatus === 'VERIFIED') {
            router.replace('/marketplace');
            return;
          }

          if (profile.verificationStatus === 'REJECTED') {
            router.replace('/verification/rejected');
            return;
          }

          router.replace('/verification/pending');
          return;
        }

        setCheckingAuth(false);
      } catch {
        if (active) {
          setCheckingAuth(false);
        }
      }
    }

    async function loadFeaturedProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_public', true)
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: false })
          .limit(4);

        if (!active) return;

        if (!error && data) {
          setFeaturedProducts(
            data.map((product) => ({
              id: product.id,
              name: product.name,
              description: product.description || 'Marketplace product from a trusted seller.',
              price: Number(product.price ?? 0),
              imageUrl:
                product.image_url ||
                'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
              sellerName: product.seller_id ? `Seller ${String(product.seller_id).slice(0, 6)}` : 'Verified seller',
              stock: Number(product.quantity ?? 0),
            })),
          );
        }
      } finally {
        if (active) setLoadingProducts(false);
      }
    }

    void redirectSignedInUser();
    void loadFeaturedProducts();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  return (
    <main className="ops-homepage">
      <header className="market-nav">
        <div className="brand-wrap">
          <div className="brand-mark">O</div>
          <span>OpsHub</span>
        </div>

        <nav className="market-links" aria-label="Primary navigation">
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/marketplace">Categories</Link>
          <Link href="/auth/register">Become a Seller</Link>
          <Link href="/marketplace">How It Works</Link>
          <Link href="/marketplace">Pricing</Link>
        </nav>

        <div className="market-actions">
          <button type="button" className="nav-search">Search</button>
          <Link href="/auth/login" className="nav-login">Login</Link>
          <Link href="/auth/register" className="nav-signup">Sign Up</Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow badge">Trusted marketplace</span>
          <h1>Real Products. Real Businesses. Only on OpsHub.</h1>
          <p>
            Discover products from trusted sellers and grow your business with OpsHub.
          </p>

          <div className="hero-actions">
            <Link href="/marketplace" className="primary-btn">Browse Marketplace</Link>
            <Link href="/auth/register" className="secondary-btn">Become a Seller</Link>
          </div>

          <div className="hero-stats">
            <div>
              <strong>4.9/5</strong>
              <span>Buyer rating</span>
            </div>
            <div>
              <strong>12k+</strong>
              <span>Products</span>
            </div>
            <div>
              <strong>1.2k+</strong>
              <span>Verified sellers</span>
            </div>
          </div>
        </div>

        <div className="hero-visual" aria-label="Marketplace illustration">
          <div className="visual-card large-card">
            <div className="mini-tag">Popular now</div>
            <div className="product-visual product-visual-one" />
            <div className="product-caption">
              <strong>Daily essentials</strong>
              <span>RM 49.90</span>
            </div>
          </div>

          <div className="visual-card small-card">
            <div className="product-visual product-visual-two" />
            <div className="product-caption">
              <strong>Local seller</strong>
              <span>Verified</span>
            </div>
          </div>

          <div className="floating-bubble bubble-one">+240 orders</div>
          <div className="floating-bubble bubble-two">Secure shipping</div>
        </div>
      </section>

      <section className="feature-strip">
        <div><span>Verified sellers</span></div>
        <div><span>Secure checkout</span></div>
        <div><span>Fast local shipping</span></div>
        <div><span>Trusted by buyers</span></div>
      </section>

      <section className="marketplace-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Featured products</span>
            <h2>Fresh picks from trusted sellers</h2>
          </div>
          <Link href="/marketplace">View all</Link>
        </div>

        {loadingProducts ? (
          <p className="muted-copy">Loading featured products…</p>
        ) : (
          <div className="product-grid">
            {featuredProducts.length > 0 ? (
              featuredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-image" style={{ backgroundImage: `url(${product.imageUrl})` }} />
                  <div className="product-card-body">
                    <div className="product-badges">
                      <span className="mini-badge">Verified</span>
                      <span className="mini-badge subtle">{product.stock > 0 ? 'In stock' : 'Sold out'}</span>
                    </div>
                    <h3>{product.name}</h3>
                    <p className="seller-name">{product.sellerName}</p>
                    <p className="product-description">{product.description}</p>
                    <div className="product-bottom-row">
                      <strong>RM {product.price.toFixed(2)}</strong>
                      <span>⭐ 4.8</span>
                    </div>
                    <div className="card-actions">
                      <Link href={`/products/${product.id}`} className="primary-link-small">View Product</Link>
                      <Link href={`/products/${product.id}/checkout`} className="secondary-link-small">Buy Now</Link>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">No public products are currently available. Please check back soon.</div>
            )}
          </div>
        )}
      </section>

      <section className="category-section">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Browse categories</span>
            <h2>Shop by what you love</h2>
          </div>
        </div>

        <div className="category-grid">
          {categories.map((category, index) => (
            <div key={category} className="category-pill" style={{ ['--category-accent' as string]: ['#ff7a59', '#cb5ce6', '#ffb067', '#6e7cf5', '#25b5a8', '#ff5f93'][index] }}>
              {category}
            </div>
          ))}
        </div>
      </section>

      <section className="trust-section">
        <div className="section-heading compact">
          <div>
            <span className="eyebrow">Why buy on OpsHub?</span>
            <h2>Marketplace trust, built in</h2>
          </div>
        </div>

        <div className="trust-grid">
          {[
            ['Verified Sellers', 'Shop with businesses that are reviewed and approved.'],
            ['Secure Orders', 'Checkout and transaction steps are protected for real purchases.'],
            ['Real Products', 'Browse actual listings from active marketplace sellers.'],
            ['Easy Payment', 'Support smooth payment flows and clear order status updates.'],
            ['Shipping Support', 'Track and manage order fulfillment from seller to buyer.'],
          ].map(([title, text]) => (
            <div key={title} className="trust-card">
              <div className="trust-icon">✓</div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="seller-cta">
        <div>
          <span className="eyebrow">Start selling</span>
          <h2>Start Selling on OpsHub</h2>
          <p>
            List your products, manage your orders and grow your marketplace business with a platform built for trusted sellers.
          </p>
        </div>
        <Link href="/auth/register" className="primary-btn large-btn">Become a Seller</Link>
      </section>

      <footer className="home-footer">
        {checkingAuth ? (
          <div className="status-pill compact">Checking your session…</div>
        ) : (
          <div className="footer-actions">
            <Link href="/auth/customer/login">Customer login</Link>
            <Link href="/auth/login">Seller login</Link>
            <Link href="/auth/register">Create account</Link>
          </div>
        )}
      </footer>
    </main>
  );
}
