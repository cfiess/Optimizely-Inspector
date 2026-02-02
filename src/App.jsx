import { useState } from 'react';
import OptimizelySection from './components/OptimizelySection';
import ShopifySection from './components/ShopifySection';
import GA4Section from './components/GA4Section';
import ScreenshotSection from './components/ScreenshotSection';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Ensure URL has protocol
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const response = await fetch('/api/inspect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to inspect URL');
      }

      if (!data.success) {
        throw new Error(data.error || 'Inspection failed');
      }

      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <span className="version">v1.4</span>
          <div className="logo">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="32" height="32" rx="8" fill="#0037FF"/>
              <path d="M8 16C8 11.5817 11.5817 8 16 8V8C20.4183 8 24 11.5817 24 16V16C24 20.4183 20.4183 24 16 24V24C11.5817 24 8 20.4183 8 16V16Z" stroke="white" strokeWidth="2"/>
              <circle cx="16" cy="16" r="4" fill="white"/>
              <path d="M16 8V12" stroke="white" strokeWidth="2"/>
              <path d="M16 20V24" stroke="white" strokeWidth="2"/>
              <path d="M8 16H12" stroke="white" strokeWidth="2"/>
              <path d="M20 16H24" stroke="white" strokeWidth="2"/>
            </svg>
            Optimizely Inspector
          </div>
          <form className="search-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="search-input"
              placeholder="Enter URL to inspect (e.g., example.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="search-btn" disabled={loading || !url.trim()}>
              {loading ? 'Inspecting...' : 'Inspect'}
            </button>
          </form>
        </div>
      </header>

      <main className="main">
        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p className="loading-text">
              Loading page and extracting data...<br/>
              <small>This may take up to 30 seconds</small>
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && !results && (
          <div className="welcome">
            <h2>Analyze any webpage for tracking & experiments</h2>
            <p>Enter a URL above to inspect Optimizely tests, Shopify data, and GA4 tracking.</p>
            <div className="features">
              <div className="feature-card">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="8" stroke="#0037FF" strokeWidth="2"/>
                    <circle cx="10" cy="10" r="3" fill="#0037FF"/>
                  </svg>
                  Optimizely
                </h3>
                <p>Active experiments, variants, audiences, and traffic allocation</p>
              </div>
              <div className="feature-card">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2L2 7L10 12L18 7L10 2Z" fill="#95BF47"/>
                    <path d="M2 13L10 18L18 13" stroke="#95BF47" strokeWidth="2"/>
                  </svg>
                  Shopify
                </h3>
                <p>Cart state, products, customer info, and checkout data</p>
              </div>
              <div className="feature-card">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2V18" stroke="#F59E0B" strokeWidth="2"/>
                    <path d="M2 10H18" stroke="#F59E0B" strokeWidth="2"/>
                    <circle cx="10" cy="10" r="7" stroke="#F59E0B" strokeWidth="2"/>
                  </svg>
                  GA4
                </h3>
                <p>Measurement IDs, GTM containers, and dataLayer events</p>
              </div>
            </div>
          </div>
        )}

        {!loading && results && (
          <div className="results-grid">
            <div className="results-header">
              <h2>Results for {results.data.pageInfo.title || 'Inspected Page'}</h2>
              <span className="results-meta">
                {new Date(results.timestamp).toLocaleString()}
              </span>
            </div>

            <ScreenshotSection screenshot={results.screenshot} url={results.data.pageInfo.url} />

            <div className="two-col">
              <div>
                <OptimizelySection data={results.data.optimizely} />
              </div>
              <div>
                <ShopifySection data={results.data.shopify} />
                <div style={{ marginTop: '1.5rem' }}>
                  <GA4Section data={results.data.ga4} networkRequests={results.ga4NetworkRequests} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
