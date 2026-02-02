import { useState } from 'react';

const MY_PROJECT_ID = '30018331732';

function OptimizelySection({ data }) {
  const [collapsed, setCollapsed] = useState(false);

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
  const experimentCount = data.experiments?.length || 0;

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
                {data.loadedVia === 'known_project' && 'Known project ID'}
              </span>
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

        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#374151' }}>
          Experiments ({experimentCount})
        </h4>

        {data.experiments?.length > 0 ? (
          <div className="data-grid">
            {data.experiments.map((exp, idx) => (
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

                {exp.percentageIncluded != null && (
                  <div className="data-row">
                    <span className="data-label">Traffic:</span>
                    <span className="data-value">{exp.percentageIncluded / 100}%</span>
                  </div>
                )}

                {exp.variations?.length > 0 && (
                  <div className="variations-list">
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      Variations ({exp.variations.length}):
                    </div>
                    {exp.variations.map((v, vidx) => (
                      <div key={v.id || vidx} className="variation-item">
                        <div className="variation-indicator"></div>
                        <span className="variation-name">
                          {v.name || v.key || `Variation ${v.id}`}
                        </span>
                        {v.weight != null && (
                          <span className="variation-weight">{v.weight / 100}%</span>
                        )}
                      </div>
                    ))}
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
