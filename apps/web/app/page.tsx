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
  imageUrl?: string | null;
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
          const validPublicProducts = data
            .filter((product) => typeof product.image_url === 'string' && product.image_url.trim().length > 0)
            .map((product) => ({
              id: product.id,
              name: product.name,
              description: product.description || 'Marketplace product listing.',
              price: Number(product.price ?? 0),
              imageUrl: product.image_url,
              sellerName: product.seller_id ? `Seller ${String(product.seller_id).slice(0, 6)}` : 'Seller',
              stock: Number(product.quantity ?? 0),
            }));

          setFeaturedProducts(validPublicProducts);
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
          <Link href="/marketplace">Catalog</Link>
          <Link href="/auth/register">Seller tools</Link>
          <Link href="/marketplace">How it works</Link>
          <Link href="/marketplace">Support</Link>
        </nav>

        <div className="market-actions">
          <button type="button" className="nav-search">Search</button>
          <Link href="/auth/login" className="nav-login">Log in</Link>
          <Link href="/auth/register" className="nav-signup">Create account</Link>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow badge">OpsHub platform</span>
          <h1>Built for modern commerce operations.</h1>
          <p>
            Manage listings, orders and seller workflows from one operational workspace designed for local commerce.
          </p>

          <div className="hero-actions">
            <Link href="/marketplace" className="primary-btn">Browse Marketplace</Link>
            <Link href="/auth/register" className="secondary-btn">Start selling</Link>
          </div>
        </div>

        <div className="hero-visual" aria-label="Marketplace illustration">
          <div className="visual-card large-card">
            <div className="mini-tag">Marketplace preview</div>
            <div className="product-visual product-visual-one" />
            <div className="product-caption">
              <strong>Catalog layout</strong>
              <span>Preview</span>
            </div>
          </div>

          <div className="visual-card small-card">
            <div className="product-visual product-visual-two" />
            <div className="product-caption">
              <strong>Seller tools</strong>
              <span>Operations</span>
            </div>
          </div>

          <div className="floating-bubble bubble-one">Order tracking</div>
          <div className="floating-bubble bubble-two">Seller onboarding</div>
        </div>
      </section>

      <section className="feature-strip">
        <div><span>Seller onboarding</span></div>
        <div><span>Order workflows</span></div>
        <div><span>Catalog tools</span></div>
        <div><span>Commerce dashboards</span></div>
      </section>

      <section className="marketplace-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Marketplace</span>
            <h2>Live listings, when available</h2>
          </div>
          <Link href="/marketplace">Open marketplace</Link>
        </div>

        {loadingProducts ? (
          <p className="muted-copy">Loading marketplace listings…</p>
        ) : (
          <div className="product-grid">
            {featuredProducts.length > 0 ? (
              featuredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  {product.imageUrl ? (
                    <div className="product-image" style={{ backgroundImage: `url(${product.imageUrl})` }} />
                  ) : (
                    <div className="product-image product-image-preview">
                      <span>Listing preview</span>
                    </div>
                  )}
                  <div className="product-card-body">
                    <div className="product-badges">
                      <span className="mini-badge">Marketplace</span>
                      <span className="mini-badge subtle">{product.stock > 0 ? 'Available' : 'Unavailable'}</span>
                    </div>
                    <h3>{product.name}</h3>
                    <p className="seller-name">{product.sellerName}</p>
                    <p className="product-description">{product.description}</p>
                    <div className="product-bottom-row">
                      <strong>RM {product.price.toFixed(2)}</strong>
                      <span>Listing</span>
                    </div>
                    <div className="card-actions">
                      <Link href={`/products/${product.id}`} className="primary-link-small">View Product</Link>
                      <Link href={`/products/${product.id}/checkout`} className="secondary-link-small">Buy Now</Link>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state preview-state">
                <div className="preview-illustration" aria-hidden="true">
                  <div className="preview-window" />
                  <div className="preview-card" />
                  <div className="preview-dot" />
                </div>
                <strong>Marketplace preview</strong>
                <p>No public marketplace listings are currently available.</p>
              </div>
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
            <span className="eyebrow">Why OpsHub?</span>
            <h2>Operational tools for commerce teams</h2>
          </div>
        </div>

        <div className="trust-grid">
          {[
            ['Seller onboarding', 'Guide businesses through setup, verification and account readiness.'],
            ['Order workflows', 'Coordinate transactions, fulfillment updates and status tracking.'],
            ['Catalog management', 'Organize listings and product information in a central workspace.'],
            ['Payments', 'Support account-ready checkout flows and payment coordination.'],
            ['Operations dashboards', 'Track key business activity with clear, role-based views.'],
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
          <h2>Launch your OpsHub seller account</h2>
          <p>
            Set up your business profile, publish your listings and manage your operations in a single commerce workspace.
          </p>
        </div>
        <Link href="/auth/register" className="primary-btn large-btn">Start selling</Link>
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
