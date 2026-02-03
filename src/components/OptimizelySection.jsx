import { useState } from 'react';

const MY_PROJECT_ID = '30018331732';

function OptimizelySection({ data, pageUrl }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showAllExperiments, setShowAllExperiments] = useState(false);

  if (!data || !data.detected) {
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

  const projectId = data.datafile?.projectId || data.projectIds?.[0] || 'Unknown';
  const isMyProject = data.isMyProject || data.projectIds?.includes(MY_PROJECT_ID);

  // Filter to running experiments
  const allExperiments = data.experiments || [];
  const runningExperiments = allExperiments.filter(exp =>
    exp.status?.toLowerCase() === 'running' || exp.status?.toLowerCase() === 'active'
  );
  const displayExperiments = showAllExperiments ? allExperiments : runningExperiments;
  const experimentCount = runningExperiments.length;
  const totalCount = allExperiments.length;

  // Helper to build force variation URL
  const buildForceUrl = (experimentId, variationId) => {
    if (!pageUrl) return null;
    try {
      const url = new URL(pageUrl);
      url.searchParams.set(`optimizely_x${experimentId}`, variationId);
      return url.toString();
    } catch {
      return null;
    }
  };

  return (
    <div className={`section-card ${collapsed ? 'section-collapsed' : ''}`}>
      <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="section-title">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#0037FF" strokeWidth="2"/>
            <circle cx="10" cy="10" r="3" fill="#0037FF"/>
          </svg>
          Optimizely
          <span className="section-badge badge-success">
            {experimentCount} Experiment{experimentCount !== 1 ? 's' : ''}
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
            <span className="kv-value">{projectId}</span>
          </div>
          {data.datafile?.accountId && (
            <div className="kv-row">
              <span className="kv-key">Account ID</span>
              <span className="kv-value">{data.datafile.accountId}</span>
            </div>
          )}
          {data.datafile?.revision && (
            <div className="kv-row">
              <span className="kv-key">Revision</span>
              <span className="kv-value">{data.datafile.revision}</span>
            </div>
          )}
          {data.loadedVia && (
            <div className="kv-row">
              <span className="kv-key">Loaded Via</span>
              <span className="kv-value">
                {data.loadedVia === 'direct' && 'Direct script tag'}
                {data.loadedVia === 'gtm' && 'Google Tag Manager'}
                {data.loadedVia === 'shopify_integration' && 'Shopify Integration'}
                {data.loadedVia === 'known_project' && 'Known project ID'}
                {data.loadedVia === 'rest_api' && 'REST API (token provided)'}
              </span>
            </div>
          )}
          {data.datafile?.projectName && (
            <div className="kv-row">
              <span className="kv-key">Project Name</span>
              <span className="kv-value">{data.datafile.projectName}</span>
            </div>
          )}
          {data.datafile?.platform && (
            <div className="kv-row">
              <span className="kv-key">Platform</span>
              <span className="kv-value">{data.datafile.platform}</span>
            </div>
          )}
          {data.apiError && (
            <div className="kv-row">
              <span className="kv-key" style={{ color: '#ef4444' }}>API Error</span>
              <span className="kv-value" style={{ color: '#ef4444' }}>{data.apiError}</span>
            </div>
          )}
          {data.snippetUrls?.length > 0 && (
            <div className="kv-row">
              <span className="kv-key">Snippet</span>
              <span className="kv-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                {data.snippetUrls[0]}
              </span>
            </div>
          )}
          {data.datafile?.datafileUrl && (
            <div className="kv-row">
              <span className="kv-key">Datafile</span>
              <span className="kv-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                {data.datafile.datafileUrl}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.9rem', color: '#374151', margin: 0 }}>
            Running Experiments ({experimentCount})
            {totalCount > experimentCount && (
              <span style={{ color: '#9ca3af', fontWeight: 'normal' }}> / {totalCount} total</span>
            )}
          </h4>
          {totalCount > experimentCount && (
            <button
              type="button"
              onClick={() => setShowAllExperiments(!showAllExperiments)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0037ff',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showAllExperiments ? 'Show running only' : 'Show all'}
            </button>
          )}
        </div>

        {displayExperiments.length > 0 ? (
          <div className="data-grid">
            {displayExperiments.map((exp, idx) => (
              <div key={exp.id || idx} className="data-item">
                <div className="data-item-header">
                  <div>
                    <div className="data-item-title">{exp.name || exp.key || `Experiment ${exp.id}`}</div>
                    <div className="data-item-id">ID: {exp.id}</div>
                  </div>
                  {exp.type === 'feature_flag' ? (
                    <span className="section-badge badge-info">Feature Flag</span>
                  ) : (
                    <span className={`section-badge ${exp.status === 'Running' || exp.status === 'running' ? 'badge-success' : 'badge-neutral'}`}>
                      {exp.status || 'Unknown'}
                    </span>
                  )}
                </div>

                {exp.description && (
                  <div className="data-row">
                    <span className="data-label">Description:</span>
                    <span className="data-value">{exp.description}</span>
                  </div>
                )}

                {exp.percentageIncluded != null && (
                  <div className="data-row">
                    <span className="data-label">Traffic:</span>
                    <span className="data-value">{typeof exp.percentageIncluded === 'number' && exp.percentageIncluded > 100 ? exp.percentageIncluded / 100 : exp.percentageIncluded}%</span>
                  </div>
                )}

                {exp.holdback != null && exp.holdback > 0 && (
                  <div className="data-row">
                    <span className="data-label">Holdback:</span>
                    <span className="data-value">{exp.holdback}%</span>
                  </div>
                )}

                {exp.url_targeting && (
                  <div className="data-row">
                    <span className="data-label">URL Targeting:</span>
                    <span className="data-value" style={{ fontSize: '0.75rem' }}>
                      {exp.url_targeting.edit_url || JSON.stringify(exp.url_targeting.conditions)}
                    </span>
                  </div>
                )}

                {exp.metrics?.length > 0 && (
                  <div className="metrics-section" style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Metrics ({exp.metrics.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {exp.metrics.map((m, midx) => (
                        <span key={m.id || midx} style={{
                          background: '#dbeafe',
                          color: '#1e40af',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                        }}>
                          {m.aggregator || 'count'} {m.field ? `(${m.field})` : ''} {m.winning_direction === 'increasing' ? '↑' : m.winning_direction === 'decreasing' ? '↓' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {exp.variations?.length > 0 && (
                  <div className="variations-list">
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      Variations ({exp.variations.length}): <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Click to force</span>
                    </div>
                    {exp.variations.map((v, vidx) => {
                      const forceUrl = buildForceUrl(exp.id, v.id);
                      return (
                        <div key={v.id || vidx} className="variation-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="variation-indicator"></div>
                          {forceUrl ? (
                            <a
                              href={forceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="variation-link"
                              style={{
                                flex: 1,
                                color: '#0037ff',
                                textDecoration: 'none',
                              }}
                              title={`Open page with ${v.name || v.key} forced`}
                            >
                              {v.name || v.key || `Variation ${v.id}`}
                              <span style={{ marginLeft: '0.25rem', fontSize: '0.7rem' }}>↗</span>
                            </a>
                          ) : (
                            <span className="variation-name" style={{ flex: 1 }}>
                              {v.name || v.key || `Variation ${v.id}`}
                            </span>
                          )}
                          {v.weight != null && (
                            <span className="variation-weight">{typeof v.weight === 'number' && v.weight > 100 ? v.weight / 100 : v.weight}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {exp.variables?.length > 0 && (
                  <div className="data-row" style={{ marginTop: '0.5rem' }}>
                    <span className="data-label">Variables:</span>
                    <span className="data-value">
                      {exp.variables.map(v => v.key).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No experiments found in datafile.</p>
        )}

        {data.audiences?.length > 0 && (
          <>
            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Audiences ({data.audiences.length})
            </h4>
            <div className="tag-list">
              {data.audiences.slice(0, 20).map((aud, idx) => (
                <span key={aud.id || idx} className="tag">{aud.name || aud.id}</span>
              ))}
              {data.audiences.length > 20 && (
                <span className="tag">+{data.audiences.length - 20} more</span>
              )}
            </div>
          </>
        )}

        {data.pages?.length > 0 && (
          <>
            <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
              Pages ({data.pages.length})
            </h4>
            <div className="tag-list">
              {data.pages.slice(0, 20).map((pg, idx) => (
                <span key={pg.id || idx} className="tag">{pg.name || pg.apiName || pg.id}</span>
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
              {data.events.slice(0, 20).map((evt, idx) => (
                <span key={evt.id || idx} className="tag">{evt.name || evt.key || evt.apiName || evt.id}</span>
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
