import { useState } from 'react';

const MY_PROJECT_ID = '30018331732';

function OptimizelySection({ data }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!data) {
    return (
      <div className="section-card">
        <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
          <div className="section-title">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#0037FF" strokeWidth="2"/>
              <circle cx="10" cy="10" r="3" fill="#0037FF"/>
            </svg>
            Optimizely
            <span className="section-badge badge-neutral">Not Detected</span>
          </div>
        </div>
        <div className="section-content">
          <p className="no-data">No Optimizely installation detected on this page.</p>
        </div>
      </div>
    );
  }

  const activeExperiments = data.experiments?.filter(e => e.isActive) || [];
  const isMyProject = data.projectId === MY_PROJECT_ID;

  return (
    <div className={`section-card ${collapsed ? 'section-collapsed' : ''}`}>
      <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="section-title">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#0037FF" strokeWidth="2"/>
            <circle cx="10" cy="10" r="3" fill="#0037FF"/>
          </svg>
          Optimizely
          <span className={`section-badge ${activeExperiments.length > 0 ? 'badge-success' : 'badge-warning'}`}>
            {activeExperiments.length} Active
          </span>
          {isMyProject && (
            <span className="section-badge badge-info">My Project</span>
          )}
        </div>
        <svg className="collapse-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="section-content">
        <div className="kv-table" style={{ marginBottom: '1rem' }}>
          <div className="kv-row">
            <span className="kv-key">Project ID</span>
            <span className="kv-value">{data.projectId || 'Unknown'}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Account ID</span>
            <span className="kv-value">{data.accountId || 'Unknown'}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Revision</span>
            <span className="kv-value">{data.revision || 'Unknown'}</span>
          </div>
          {data.visitor?.visitorId && (
            <div className="kv-row">
              <span className="kv-key">Visitor ID</span>
              <span className="kv-value" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {data.visitor.visitorId}
              </span>
            </div>
          )}
        </div>

        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
          Experiments ({data.experiments?.length || 0})
        </h4>

        {data.experiments?.length > 0 ? (
          <div className="data-grid">
            {data.experiments.map((exp) => (
              <div key={exp.id} className="data-item">
                <div className="data-item-header">
                  <div>
                    <div className="data-item-title">{exp.name}</div>
                    <div className="data-item-id">ID: {exp.id}</div>
                  </div>
                  <span className={`section-badge ${exp.isActive ? 'badge-success' : 'badge-neutral'}`}>
                    {exp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="data-row">
                  <span className="data-label">Status:</span>
                  <span className="data-value">{exp.status}</span>
                </div>

                {exp.percentageIncluded != null && (
                  <div className="data-row">
                    <span className="data-label">Traffic:</span>
                    <span className="data-value">{exp.percentageIncluded / 100}%</span>
                  </div>
                )}

                {exp.holdback > 0 && (
                  <div className="data-row">
                    <span className="data-label">Holdback:</span>
                    <span className="data-value">{exp.holdback / 100}%</span>
                  </div>
                )}

                {exp.variations?.length > 0 && (
                  <div className="variations-list">
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      Variations:
                    </div>
                    {exp.variations.map((v) => (
                      <div key={v.id} className="variation-item">
                        <div className={`variation-indicator ${v.isCurrent ? 'current' : ''}`}></div>
                        <span className="variation-name">
                          {v.name}
                          {v.isControl && <span style={{ color: '#6b7280' }}> (Control)</span>}
                          {v.isCurrent && <span style={{ color: '#0037ff', fontWeight: 500 }}> - You</span>}
                        </span>
                        {v.weight != null && (
                          <span className="variation-weight">{v.weight / 100}%</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {exp.audiences?.length > 0 && (
                  <div className="data-row" style={{ marginTop: '0.5rem' }}>
                    <span className="data-label">Audiences:</span>
                    <span className="data-value">
                      {exp.audiences.map(id => {
                        const aud = data.audiences?.find(a => a.id === id);
                        return aud?.name || id;
                      }).join(', ')}
                    </span>
                  </div>
                )}

                {exp.metrics?.length > 0 && (
                  <div className="data-row">
                    <span className="data-label">Metrics:</span>
                    <span className="data-value">{exp.metrics.length} configured</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No experiments configured.</p>
        )}

        {data.audiences?.length > 0 && (
          <>
            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Audiences ({data.audiences.length})
            </h4>
            <div className="tag-list">
              {data.audiences.map((aud) => (
                <span key={aud.id} className="tag">{aud.name}</span>
              ))}
            </div>
          </>
        )}

        {data.pages?.length > 0 && (
          <>
            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Pages ({data.pages.length})
            </h4>
            <div className="tag-list">
              {data.pages.slice(0, 20).map((pg) => (
                <span key={pg.id} className="tag">{pg.name}</span>
              ))}
              {data.pages.length > 20 && (
                <span className="tag">+{data.pages.length - 20} more</span>
              )}
            </div>
          </>
        )}

        {data.events?.length > 0 && (
          <>
            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Events ({data.events.length})
            </h4>
            <div className="tag-list">
              {data.events.slice(0, 20).map((evt) => (
                <span key={evt.id} className="tag">{evt.name || evt.apiName}</span>
              ))}
              {data.events.length > 20 && (
                <span className="tag">+{data.events.length - 20} more</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default OptimizelySection;
