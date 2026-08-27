const sellers = [
  {
    id: 'seller-1',
    fullName: 'Ada Stone',
    businessName: 'Stone Labs',
    email: 'ada@stone.example',
    status: 'PENDING',
  },
  {
    id: 'seller-2',
    fullName: 'Milo Reed',
    businessName: 'Reed Supply',
    email: 'milo@reedsupply.example',
    status: 'PENDING',
  },
];

export default function AdminReviewPage() {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">ADMIN / SELLER REVIEW</p>
          <h1>Pending seller applications</h1>
        </div>
      </header>
      <section className="admin-list">
        {sellers.map((seller) => (
          <article key={seller.id} className="review-card">
            <div>
              <h2>{seller.fullName}</h2>
              <p>{seller.businessName}</p>
              <p>{seller.email}</p>
            </div>
            <div className="status-badge">{seller.status}</div>
            <div className="review-actions">
              <button type="button">Approve</button>
              <button type="button" className="secondary-button">Reject</button>
              <button type="button" className="secondary-button">Suspend</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
