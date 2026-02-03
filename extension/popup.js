// Popup script for Optimizely Inspector extension

const STORAGE_KEY = 'optimizely_inspector_api_token';
const API_BASE = 'https://api.optimizely.com/v2';

let currentTabId = null;
let currentTabUrl = null;
let cachedExperiments = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;
  currentTabUrl = tab.url;

  // Load data
  await loadOptimizelyData();

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    document.getElementById('content').innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Refreshing...</p>
      </div>
    `;
    await loadOptimizelyData();
  });
});

async function loadOptimizelyData() {
  try {
    // Inject content script and get Optimizely state
    const results = await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: getOptimizelyState,
    });

    const state = results[0]?.result;

    if (!state || !state.hasOptimizely) {
      showNoOptimizely();
      return;
    }

    // Get saved API token
    const storage = await chrome.storage.local.get([STORAGE_KEY]);
    const apiToken = storage[STORAGE_KEY];

    // If we have an API token and project ID, fetch full experiment data
    let apiExperiments = null;
    if (apiToken && state.projectId) {
      apiExperiments = await fetchExperimentsFromAPI(state.projectId, apiToken);
    }

    // Merge API data with page state
    const experiments = mergeExperimentData(state, apiExperiments);

    renderExperiments(experiments, state, apiToken);
  } catch (error) {
    console.error('Error loading Optimizely data:', error);
    showError(error.message);
  }
}

// This function runs in the page context
function getOptimizelyState() {
  const result = {
    hasOptimizely: false,
    projectId: null,
    activeExperiments: [],
    variationMap: {},
    state: null,
  };

  // Check for Optimizely Web
  if (typeof window.optimizely !== 'undefined' && window.optimizely.get) {
    result.hasOptimizely = true;

    try {
      // Get state
      const state = window.optimizely.get('state');
      if (state) {
        result.state = {
          activeExperiments: state.getActiveExperimentIds ? state.getActiveExperimentIds() : [],
          variationMap: state.getVariationMap ? state.getVariationMap() : {},
          pageId: state.getPageStates ? Object.keys(state.getPageStates())[0] : null,
        };
        result.activeExperiments = result.state.activeExperiments || [];
        result.variationMap = result.state.variationMap || {};
      }

      // Get visitor
      const visitor = window.optimizely.get('visitor');
      if (visitor) {
        result.visitorId = visitor.visitorId;
      }

      // Get data (contains project ID)
      const data = window.optimizely.get('data');
      if (data) {
        result.projectId = data.projectId;
        result.accountId = data.accountId;
        result.revision = data.revision;

        // Get experiment data from the page
        if (data.experiments) {
          result.pageExperiments = Object.entries(data.experiments).map(([id, exp]) => ({
            id,
            name: exp.name,
            status: exp.status,
            percentageIncluded: exp.percentageIncluded,
            variations: exp.variations ? Object.entries(exp.variations).map(([vid, v]) => ({
              id: vid,
              name: v.name,
              weight: v.weight,
            })) : [],
          }));
        }

        // Get campaign data
        if (data.campaigns) {
          result.campaigns = Object.entries(data.campaigns).map(([id, camp]) => ({
            id,
            name: camp.name,
            status: camp.status,
            experiments: camp.experiments,
          }));
        }
      }
    } catch (e) {
      console.error('Error getting Optimizely state:', e);
    }
  }

  return result;
}

async function fetchExperimentsFromAPI(projectId, apiToken) {
  try {
    const response = await fetch(
      `${API_BASE}/experiments?project_id=${projectId}&per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('API request failed:', response.status);
      return null;
    }

    return await response.json();
  } catch (e) {
    console.error('Error fetching from API:', e);
    return null;
  }
}

function mergeExperimentData(pageState, apiExperiments) {
  const experiments = [];
  const seenIds = new Set();

  // Use API experiments if available (more detailed)
  if (apiExperiments && Array.isArray(apiExperiments)) {
    apiExperiments.forEach(exp => {
      if (exp.status === 'running') {
        experiments.push({
          id: exp.id.toString(),
          name: exp.name,
          key: exp.key,
          status: exp.status,
          description: exp.description,
          trafficAllocation: exp.traffic_allocation,
          variations: (exp.variations || []).map(v => ({
            id: v.variation_id?.toString(),
            name: v.name,
            key: v.key,
            weight: v.weight,
          })),
          metrics: exp.metrics || [],
          urlTargeting: exp.url_targeting,
          isActive: pageState.activeExperiments?.includes(exp.id.toString()),
          currentVariation: pageState.variationMap?.[exp.id.toString()],
        });
        seenIds.add(exp.id.toString());
      }
    });
  }

  // Add experiments from page that weren't in API
  if (pageState.pageExperiments) {
    pageState.pageExperiments.forEach(exp => {
      if (!seenIds.has(exp.id) && (exp.status === 'Running' || exp.status === 'running')) {
        experiments.push({
          ...exp,
          isActive: pageState.activeExperiments?.includes(exp.id),
          currentVariation: pageState.variationMap?.[exp.id],
        });
      }
    });
  }

  return experiments;
}

function renderExperiments(experiments, state, apiToken) {
  const content = document.getElementById('content');

  let html = '<div class="content">';

  // Project info section
  html += `
    <div class="section">
      <div class="section-header">
        Project Info
        ${state.projectId ? `<span class="badge badge-info">${state.projectId}</span>` : ''}
      </div>
      <div style="padding: 12px;">
        <div class="info-row">
          <span class="info-label">Visitor ID</span>
          <span class="info-value" style="font-family: monospace; font-size: 10px;">${state.visitorId || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Active Experiments</span>
          <span class="info-value">${state.activeExperiments?.length || 0}</span>
        </div>
        ${state.revision ? `
        <div class="info-row">
          <span class="info-label">Revision</span>
          <span class="info-value">${state.revision}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  // API Token section
  html += `
    <div class="section">
      <div class="section-header">
        API Token
        ${apiToken ? '<span class="badge badge-success">Configured</span>' : '<span class="badge badge-warning">Not Set</span>'}
      </div>
      <div class="api-token-section">
        <label>Enter your Optimizely API token for full experiment details & metrics</label>
        <div class="api-token-row">
          <input type="password" class="api-token-input" id="apiTokenInput"
            value="${apiToken || ''}"
            placeholder="Paste your API token here">
          <button class="save-btn" id="saveTokenBtn">Save</button>
        </div>
      </div>
    </div>
  `;

  // Experiments section
  if (experiments.length === 0) {
    html += `
      <div class="section">
        <div class="section-header">
          Running Experiments
          <span class="badge badge-warning">0</span>
        </div>
        <div style="padding: 20px; text-align: center; color: #6b7280;">
          No running experiments found on this page.
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="section">
        <div class="section-header">
          Running Experiments
          <span class="badge badge-success">${experiments.length}</span>
        </div>
    `;

    experiments.forEach(exp => {
      const currentVar = exp.variations?.find(v => v.id === exp.currentVariation?.id);

      html += `
        <div class="experiment" data-exp-id="${exp.id}">
          <div class="exp-header">
            <div>
              <div class="exp-name">${exp.name || exp.key || 'Unnamed'}</div>
              <div class="exp-id">ID: ${exp.id}</div>
            </div>
            ${exp.isActive
              ? '<span class="badge badge-success">Active</span>'
              : '<span class="badge badge-warning">Not Active</span>'}
          </div>
      `;

      // Show current variation if in experiment
      if (exp.isActive && currentVar) {
        html += `
          <div class="current-variation">
            <strong>You are seeing: ${currentVar.name || currentVar.key}</strong>
            Variation ID: ${currentVar.id}
          </div>
        `;
      }

      // Variations
      if (exp.variations && exp.variations.length > 0) {
        html += `<div class="variations-label">Click to force a variation:</div>`;
        exp.variations.forEach(v => {
          const isActive = exp.currentVariation?.id === v.id;
          html += `
            <button class="variation-btn ${isActive ? 'active' : ''}"
              data-exp-id="${exp.id}"
              data-var-id="${v.id}">
              ${v.name || v.key || `Variation ${v.id}`}
              ${v.weight != null ? `<span class="weight">${v.weight}%</span>` : ''}
            </button>
          `;
        });
      }

      // Metrics
      if (exp.metrics && exp.metrics.length > 0) {
        html += `
          <div class="metrics-section">
            <div class="metrics-label">Metrics (${exp.metrics.length}):</div>
        `;
        exp.metrics.forEach(m => {
          const direction = m.winning_direction === 'increasing' ? '↑' : m.winning_direction === 'decreasing' ? '↓' : '';
          html += `<span class="metric-tag">${m.aggregator || 'count'}${m.field ? ` (${m.field})` : ''} ${direction}</span>`;
        });
        html += `</div>`;
      }

      html += `</div>`; // end experiment
    });

    html += `</div>`; // end section
  }

  html += '</div>';
  content.innerHTML = html;

  // Add event listeners
  document.getElementById('saveTokenBtn')?.addEventListener('click', async () => {
    const token = document.getElementById('apiTokenInput').value.trim();
    if (token) {
      await chrome.storage.local.set({ [STORAGE_KEY]: token });
      await loadOptimizelyData();
    }
  });

  // Variation buttons
  document.querySelectorAll('.variation-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const expId = btn.dataset.expId;
      const varId = btn.dataset.varId;
      await forceVariation(expId, varId);
    });
  });
}

async function forceVariation(experimentId, variationId) {
  // Build the force URL
  const url = new URL(currentTabUrl);
  url.searchParams.set(`optimizely_x${experimentId}`, variationId);

  // Navigate to the URL with the force parameter
  await chrome.tabs.update(currentTabId, { url: url.toString() });

  // Close popup (page will reload)
  window.close();
}

function showNoOptimizely() {
  document.getElementById('content').innerHTML = `
    <div class="no-optimizely">
      <svg viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="#d1d5db" stroke-width="2"/>
        <path d="M16 16L32 32M32 16L16 32" stroke="#d1d5db" stroke-width="2"/>
      </svg>
      <p><strong>No Optimizely detected</strong></p>
      <p style="font-size: 11px; margin-top: 8px;">
        This page doesn't appear to have Optimizely Web installed,
        or it hasn't loaded yet.
      </p>
    </div>
  `;
}

function showError(message) {
  document.getElementById('content').innerHTML = `
    <div class="no-optimizely">
      <p><strong>Error</strong></p>
      <p style="font-size: 11px; margin-top: 8px;">${message}</p>
    </div>
  `;
}
