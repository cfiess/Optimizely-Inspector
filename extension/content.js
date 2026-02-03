// Content script for Optimizely Inspector
// This runs in the context of the web page

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getOptimizelyState') {
    sendResponse(getOptimizelyState());
  }
  return true;
});

function getOptimizelyState() {
  const result = {
    hasOptimizely: false,
    projectId: null,
    activeExperiments: [],
    variationMap: {},
  };

  if (typeof window.optimizely !== 'undefined' && window.optimizely.get) {
    result.hasOptimizely = true;

    try {
      const state = window.optimizely.get('state');
      if (state) {
        result.activeExperiments = state.getActiveExperimentIds ? state.getActiveExperimentIds() : [];
        result.variationMap = state.getVariationMap ? state.getVariationMap() : {};
      }

      const data = window.optimizely.get('data');
      if (data) {
        result.projectId = data.projectId;
        result.accountId = data.accountId;
        result.revision = data.revision;

        if (data.experiments) {
          result.experiments = Object.entries(data.experiments).map(([id, exp]) => ({
            id,
            name: exp.name,
            status: exp.status,
            variations: exp.variations ? Object.entries(exp.variations).map(([vid, v]) => ({
              id: vid,
              name: v.name,
              weight: v.weight,
            })) : [],
          }));
        }
      }

      const visitor = window.optimizely.get('visitor');
      if (visitor) {
        result.visitorId = visitor.visitorId;
      }
    } catch (e) {
      console.error('Optimizely Inspector: Error getting state', e);
    }
  }

  return result;
}
