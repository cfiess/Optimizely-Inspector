import { useState } from 'react';

function ShopifySection({ data }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!data || !data.detected) {
    return (
      <div className="section-card">
        <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
          <div className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L2 7L10 12L18 7L10 2Z" fill="#95BF47"/>
              <path d="M2 13L10 18L18 13" stroke="#95BF47" strokeWidth="2"/>
            </svg>
            Shopify
            <span className="section-badge badge-neutral">Not Detected</span>
          </div>
        </div>
        <div className="section-content">
          <p className="no-data">This page does not appear to be a Shopify store.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`section-card ${collapsed ? 'section-collapsed' : ''}`}>
      <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="section-title">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L2 7L10 12L18 7L10 2Z" fill="#95BF47"/>
            <path d="M2 13L10 18L18 13" stroke="#95BF47" strokeWidth="2"/>
          </svg>
          Shopify
          <span className="section-badge badge-success">Detected</span>
        </div>
        <svg className="collapse-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="section-content">
        {/* Shop Info */}
        {data.shop && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Shop Info
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              {data.shop.name && (
                <div className="kv-row">
                  <span className="kv-key">Shop</span>
                  <span className="kv-value">{data.shop.name}</span>
                </div>
              )}
              {data.shop.currency && (
                <div className="kv-row">
                  <span className="kv-key">Currency</span>
                  <span className="kv-value">{data.shop.currency}</span>
                </div>
              )}
              {data.shop.locale && (
                <div className="kv-row">
                  <span className="kv-key">Locale</span>
                  <span className="kv-value">{data.shop.locale}</span>
                </div>
              )}
              {data.shop.country && (
                <div className="kv-row">
                  <span className="kv-key">Country</span>
                  <span className="kv-value">{data.shop.country}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Theme Info */}
        {data.theme && (data.theme.name || data.theme.id) && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Theme
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              {data.theme.name && (
                <div className="kv-row">
                  <span className="kv-key">Name</span>
                  <span className="kv-value">{data.theme.name}</span>
                </div>
              )}
              {data.theme.id && (
                <div className="kv-row">
                  <span className="kv-key">ID</span>
                  <span className="kv-value">{data.theme.id}</span>
                </div>
              )}
              {data.theme.role && (
                <div className="kv-row">
                  <span className="kv-key">Role</span>
                  <span className="kv-value">{data.theme.role}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Page Type */}
        {data.page && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Page Context
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              {data.page.type && (
                <div className="kv-row">
                  <span className="kv-key">Page Type</span>
                  <span className="kv-value">{data.page.type}</span>
                </div>
              )}
              {data.page.resourceType && (
                <div className="kv-row">
                  <span className="kv-key">Resource Type</span>
                  <span className="kv-value">{data.page.resourceType}</span>
                </div>
              )}
              {data.page.resourceId && (
                <div className="kv-row">
                  <span className="kv-key">Resource ID</span>
                  <span className="kv-value">{data.page.resourceId}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Customer State */}
        {data.customer && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Customer
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              <div className="kv-row">
                <span className="kv-key">Logged In</span>
                <span className={`kv-value ${data.customer.loggedIn ? 'active' : ''}`}>
                  {data.customer.loggedIn ? 'Yes' : 'No'}
                </span>
              </div>
              {data.customer.customerId && (
                <div className="kv-row">
                  <span className="kv-key">Customer ID</span>
                  <span className="kv-value">{data.customer.customerId}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Checkout Info */}
        {data.checkout && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Checkout
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              {data.checkout.step && (
                <div className="kv-row">
                  <span className="kv-key">Step</span>
                  <span className="kv-value">{data.checkout.step}</span>
                </div>
              )}
              {data.checkout.page && (
                <div className="kv-row">
                  <span className="kv-key">Page</span>
                  <span className="kv-value">{data.checkout.page}</span>
                </div>
              )}
              {data.checkout.token && (
                <div className="kv-row">
                  <span className="kv-key">Token</span>
                  <span className="kv-value">{data.checkout.token}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Product Info */}
        {data.product && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Product
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              {data.product.id && (
                <div className="kv-row">
                  <span className="kv-key">Product ID</span>
                  <span className="kv-value">{data.product.id}</span>
                </div>
              )}
              {data.product.vendor && (
                <div className="kv-row">
                  <span className="kv-key">Vendor</span>
                  <span className="kv-value">{data.product.vendor}</span>
                </div>
              )}
              {data.product.type && (
                <div className="kv-row">
                  <span className="kv-key">Type</span>
                  <span className="kv-value">{data.product.type}</span>
                </div>
              )}
            </div>

            {data.product.variants?.length > 0 && (
              <>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  Variants ({data.product.variants.length}):
                </div>
                <div className="data-grid">
                  {data.product.variants.slice(0, 5).map((v, i) => (
                    <div key={v.id || i} className="data-item" style={{ padding: '0.75rem' }}>
                      <div className="data-row">
                        <span className="data-label">Name:</span>
                        <span className="data-value">{v.name || 'Default'}</span>
                      </div>
                      {v.price && (
                        <div className="data-row">
                          <span className="data-label">Price:</span>
                          <span className="data-value">{v.price}</span>
                        </div>
                      )}
                      {v.sku && (
                        <div className="data-row">
                          <span className="data-label">SKU:</span>
                          <span className="data-value">{v.sku}</span>
                        </div>
                      )}
                      <div className="data-row">
                        <span className="data-label">Available:</span>
                        <span className={`data-value ${v.available ? 'active' : ''}`}>
                          {v.available ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {data.product.variants.length > 5 && (
                    <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      +{data.product.variants.length - 5} more variants
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Cart Info */}
        {data.cart && (
          <>
            <h4 style={{ marginTop: '1rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Cart
            </h4>
            <div className="kv-table" style={{ marginBottom: '1rem' }}>
              <div className="kv-row">
                <span className="kv-key">Items</span>
                <span className="kv-value">{data.cart.itemCount || 0}</span>
              </div>
              {data.cart.totalPrice && (
                <div className="kv-row">
                  <span className="kv-key">Total</span>
                  <span className="kv-value">
                    {(data.cart.totalPrice / 100).toFixed(2)} {data.cart.currency || ''}
                  </span>
                </div>
              )}
            </div>

            {data.cart.items?.length > 0 && (
              <div className="data-grid">
                {data.cart.items.map((item, i) => (
                  <div key={i} className="data-item" style={{ padding: '0.75rem' }}>
                    <div className="data-row">
                      <span className="data-label">Title:</span>
                      <span className="data-value">{item.title}</span>
                    </div>
                    <div className="data-row">
                      <span className="data-label">Quantity:</span>
                      <span className="data-value">{item.quantity}</span>
                    </div>
                    {item.variant && (
                      <div className="data-row">
                        <span className="data-label">Variant:</span>
                        <span className="data-value">{item.variant}</span>
                      </div>
                    )}
                    <div className="data-row">
                      <span className="data-label">Price:</span>
                      <span className="data-value">{(item.price / 100).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {data.error && (
          <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '1rem' }}>
            Error extracting some data: {data.error}
          </p>
        )}
      </div>
    </div>
  );
}

export default ShopifySection;
