import { useState } from 'react';

function GA4Section({ data }) {
  const [collapsed, setCollapsed] = useState(false);

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

  const totalIds = (data.measurementIds?.length || 0) + (data.gtmContainers?.length || 0);

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
          <span className="section-badge badge-success">{totalIds} ID{totalIds !== 1 ? 's' : ''}</span>
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
