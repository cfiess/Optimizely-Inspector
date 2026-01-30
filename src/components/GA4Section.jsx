import { useState } from 'react';

function GA4Section({ data, networkRequests }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showDataLayer, setShowDataLayer] = useState(false);

  if (!data || !data.detected) {
    return (
      <div className="section-card">
        <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
          <div className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2V18" stroke="#F59E0B" strokeWidth="2"/>
              <path d="M2 10H18" stroke="#F59E0B" strokeWidth="2"/>
              <circle cx="10" cy="10" r="7" stroke="#F59E0B" strokeWidth="2"/>
            </svg>
            GA4 / GTM
            <span className="section-badge badge-neutral">Not Detected</span>
          </div>
        </div>
        <div className="section-content">
          <p className="no-data">No Google Analytics 4 or Google Tag Manager detected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`section-card ${collapsed ? 'section-collapsed' : ''}`}>
      <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="section-title">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2V18" stroke="#F59E0B" strokeWidth="2"/>
            <path d="M2 10H18" stroke="#F59E0B" strokeWidth="2"/>
            <circle cx="10" cy="10" r="7" stroke="#F59E0B" strokeWidth="2"/>
          </svg>
          GA4 / GTM
          <span className="section-badge badge-success">Detected</span>
        </div>
        <svg className="collapse-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="section-content">
        {/* Measurement IDs */}
        {data.measurementIds?.length > 0 && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              GA4 Measurement IDs
            </h4>
            <div className="tag-list" style={{ marginBottom: '1rem' }}>
              {data.measurementIds.map((id) => (
                <span key={id} className="tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                  {id}
                </span>
              ))}
            </div>
          </>
        )}

        {/* GTM Containers */}
        {data.gtmContainers?.length > 0 && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              GTM Containers
            </h4>
            <div className="tag-list" style={{ marginBottom: '1rem' }}>
              {data.gtmContainers.map((id) => (
                <span key={id} className="tag" style={{ background: '#dbeafe', color: '#1e40af' }}>
                  {id}
                </span>
              ))}
            </div>
          </>
        )}

        {/* Network Requests */}
        {networkRequests?.length > 0 && (
          <>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              GA Network Requests ({networkRequests.length})
            </h4>
            <div style={{
              background: '#f9fafb',
              borderRadius: '6px',
              padding: '0.75rem',
              marginBottom: '1rem',
              maxHeight: '150px',
              overflowY: 'auto'
            }}>
              {networkRequests.slice(0, 10).map((req, i) => (
                <div key={i} style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  padding: '0.25rem 0',
                  borderBottom: i < 9 ? '1px solid #e5e7eb' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ color: '#0037ff', marginRight: '0.5rem' }}>{req.method}</span>
                  {new URL(req.url).hostname}
                </div>
              ))}
              {networkRequests.length > 10 && (
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  +{networkRequests.length - 10} more requests
                </div>
              )}
            </div>
          </>
        )}

        {/* DataLayer Contents */}
        {data.dataLayerContents?.length > 0 && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem'
            }}>
              <h4 style={{ fontSize: '0.9rem', color: '#374151' }}>
                DataLayer Events ({data.dataLayerContents.length})
              </h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDataLayer(!showDataLayer);
                }}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  color: '#4b5563'
                }}
              >
                {showDataLayer ? 'Hide' : 'Show'} Raw Data
              </button>
            </div>

            {/* Event summaries */}
            <div style={{ marginBottom: '1rem' }}>
              {data.dataLayerContents.slice(0, 15).map((item, i) => (
                <div key={i} className="datalayer-item">
                  {item.event && (
                    <div className="datalayer-event">
                      {item.event}
                    </div>
                  )}
                  {item['gtm.start'] && (
                    <div style={{ color: '#6b7280' }}>GTM initialized</div>
                  )}
                  {!item.event && !item['gtm.start'] && (
                    <div style={{ color: '#6b7280' }}>
                      {Object.keys(item).slice(0, 3).join(', ')}
                      {Object.keys(item).length > 3 && '...'}
                    </div>
                  )}
                </div>
              ))}
              {data.dataLayerContents.length > 15 && (
                <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  +{data.dataLayerContents.length - 15} more events
                </p>
              )}
            </div>

            {/* Raw JSON display */}
            {showDataLayer && (
              <div className="json-display">
                {JSON.stringify(data.dataLayerContents, null, 2)}
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

export default GA4Section;
