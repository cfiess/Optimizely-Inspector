import { useState } from 'react';

function ScreenshotSection({ screenshot, url }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!screenshot) {
    return null;
  }

  return (
    <div className={`section-card ${collapsed ? 'section-collapsed' : ''}`}>
      <div className="section-header" onClick={() => setCollapsed(!collapsed)}>
        <div className="section-title">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="4" width="16" height="12" rx="2" stroke="#6b7280" strokeWidth="2"/>
            <circle cx="7" cy="10" r="2" fill="#6b7280"/>
            <path d="M12 8L16 12" stroke="#6b7280" strokeWidth="2"/>
          </svg>
          Page Screenshot
        </div>
        <svg className="collapse-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="section-content">
        {url && (
          <p style={{
            fontSize: '0.8rem',
            color: '#6b7280',
            marginBottom: '0.75rem',
            wordBreak: 'break-all'
          }}>
            {url}
          </p>
        )}
        <div className="screenshot-container">
          <img src={screenshot} alt="Page screenshot" />
        </div>
      </div>
    </div>
  );
}

export default ScreenshotSection;
