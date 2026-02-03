const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Hardcoded Optimizely Project ID - always check this
const MY_OPTIMIZELY_PROJECT_ID = '30018331732';

// Optimizely REST API base URL
const OPTIMIZELY_API_BASE = 'https://api.optimizely.com/v2';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, optimizelyApiToken } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL
  let targetUrl;
  try {
    targetUrl = new URL(url);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  try {
    // Fetch the page HTML
    const response = await fetch(targetUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const result = {
      optimizely: null,
      shopify: null,
      ga4: null,
      pageInfo: {
        title: $('title').text() || '',
        url: targetUrl.href,
        description: $('meta[name="description"]').attr('content') || '',
      },
    };

    // ===== OPTIMIZELY DETECTION =====
    const optimizelyData = {
      detected: false,
      projectIds: [],
      snippetUrls: [],
      datafile: null,
      experiments: [],
      audiences: [],
      pages: [],
      events: [],
      isMyProject: false,
      loadedVia: null, // 'direct', 'gtm', or 'known_project'
    };

    // Find Optimizely script tags in HTML
    $('script[src*="optimizely.com"], script[src*="optimizelyCDN"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        optimizelyData.snippetUrls.push(src);
        optimizelyData.detected = true;
        optimizelyData.loadedVia = 'direct';

        const projectMatch = src.match(/\/(\d{10,})\.js/);
        if (projectMatch && !optimizelyData.projectIds.includes(projectMatch[1])) {
          optimizelyData.projectIds.push(projectMatch[1]);
        }
      }
    });

    // Check inline scripts for Optimizely references
    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';

      const projectMatches = content.match(/optimizely\.com\/js\/(\d{10,})\.js/g);
      if (projectMatches) {
        projectMatches.forEach(match => {
          const id = match.match(/(\d{10,})/)?.[1];
          if (id && !optimizelyData.projectIds.includes(id)) {
            optimizelyData.projectIds.push(id);
            optimizelyData.detected = true;
            optimizelyData.loadedVia = optimizelyData.loadedVia || 'direct';
          }
        });
      }

      // Also look for window.optimizely or optimizely.push references
      if (content.includes('window.optimizely') || content.includes('optimizely.push')) {
        optimizelyData.detected = true;
      }
    });

    // Check if GTM is present (Optimizely might be loaded via GTM)
    let hasGTM = false;
    $('script[src*="googletagmanager.com"]').each((i, el) => {
      hasGTM = true;
    });
    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('GTM-') || content.includes('googletagmanager')) {
        hasGTM = true;
      }
    });

    // ALWAYS check the known project ID datafile (in case loaded via GTM)
    if (!optimizelyData.projectIds.includes(MY_OPTIMIZELY_PROJECT_ID)) {
      optimizelyData.projectIds.push(MY_OPTIMIZELY_PROJECT_ID);
    }

    // Helper function to fetch and parse Optimizely datafile
    async function fetchOptimizelyData(projectId) {
      // For Optimizely Web Experimentation, the data is in the JS snippet
      const snippetUrl = `https://cdn.optimizely.com/js/${projectId}.js`;

      try {
        const response = await fetch(snippetUrl, {
          timeout: 10000,
          headers: {
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });

        if (response.ok) {
          const jsContent = await response.text();

          // The Optimizely Web snippet contains experiment data in various formats
          // Look for the main data object
          const parsedData = parseOptimizelySnippet(jsContent);

          if (parsedData && (parsedData.experiments?.length > 0 || parsedData.campaigns?.length > 0)) {
            return { data: parsedData, url: snippetUrl };
          }
        }
      } catch (e) {
        console.error(`Error fetching snippet for ${projectId}:`, e.message);
      }

      // Also try JSON endpoints as fallback (for Full Stack projects)
      const jsonUrls = [
        `https://cdn.optimizely.com/datafiles/${projectId}.json`,
        `https://cdn.optimizely.com/json/${projectId}.json`,
      ];

      for (const dataUrl of jsonUrls) {
        try {
          const dataResponse = await fetch(dataUrl, {
            timeout: 5000,
            headers: {
              'Accept': 'application/json',
            }
          });

          if (dataResponse.ok) {
            const data = await dataResponse.json();
            if (data) {
              return { data, url: dataUrl };
            }
          }
        } catch (e) {
          // Continue to next URL
        }
      }
      return null;
    }

    // Parse Optimizely Web snippet to extract experiment data
    function parseOptimizelySnippet(jsContent) {
      const result = {
        experiments: [],
        campaigns: [],
        audiences: [],
        pages: [],
        events: [],
        dimensions: [],
        projectId: null,
        accountId: null,
        revision: null,
      };

      try {
        // Extract project ID
        const projectIdMatch = jsContent.match(/projectId["']?\s*[=:]\s*["']?(\d+)/);
        if (projectIdMatch) {
          result.projectId = projectIdMatch[1];
        }

        // Extract account ID
        const accountIdMatch = jsContent.match(/accountId["']?\s*[=:]\s*["']?(\d+)/);
        if (accountIdMatch) {
          result.accountId = accountIdMatch[1];
        }

        // Extract revision
        const revisionMatch = jsContent.match(/revision["']?\s*[=:]\s*["']?(\d+)/);
        if (revisionMatch) {
          result.revision = revisionMatch[1];
        }

        // Method 1: Look for experiments array in modern format
        // Pattern: "experiments":[{...},{...}]
        const experimentsArrayMatch = jsContent.match(/"experiments"\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/);
        if (experimentsArrayMatch) {
          try {
            const experimentsJson = `[${experimentsArrayMatch[1]}]`;
            const experiments = JSON.parse(experimentsJson);
            experiments.forEach(exp => {
              result.experiments.push({
                id: exp.id?.toString(),
                name: exp.name || exp.key || `Experiment ${exp.id}`,
                key: exp.key,
                status: exp.status || 'active',
                type: 'experiment',
                percentageIncluded: exp.percentageIncluded || exp.trafficAllocation,
                audienceIds: exp.audienceIds || [],
                variations: (exp.variations || []).map(v => ({
                  id: v.id?.toString(),
                  name: v.name || v.key,
                  weight: v.weight,
                })),
              });
            });
          } catch (e) {
            // JSON parse failed, try regex extraction
          }
        }

        // Method 2: Extract individual experiment objects using regex
        // Pattern: {id:123,name:"...",status:"running",...}
        const expRegex = /\{[^{}]*"?id"?\s*:\s*(\d+)[^{}]*"?name"?\s*:\s*"([^"]+)"[^{}]*"?status"?\s*:\s*"([^"]+)"[^{}]*\}/g;
        let expMatch;
        while ((expMatch = expRegex.exec(jsContent)) !== null) {
          const expId = expMatch[1];
          // Avoid duplicates
          if (!result.experiments.find(e => e.id === expId)) {
            result.experiments.push({
              id: expId,
              name: expMatch[2],
              status: expMatch[3],
              type: 'experiment',
            });
          }
        }

        // Method 3: Look for campaign data
        const campaignRegex = /"?campaigns"?\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/;
        const campaignMatch = jsContent.match(campaignRegex);
        if (campaignMatch) {
          // Extract campaign IDs and names
          const campIdRegex = /"?(\d{8,})"?\s*:\s*\{[^}]*"?name"?\s*:\s*"([^"]+)"/g;
          let campMatch;
          while ((campMatch = campIdRegex.exec(campaignMatch[1])) !== null) {
            result.campaigns.push({
              id: campMatch[1],
              name: campMatch[2],
              type: 'campaign',
            });
          }
        }

        // Method 4: Look for variations data to find experiments
        const variationsRegex = /"?variations"?\s*:\s*\{[^}]*"?(\d+)"?\s*:\s*\{[^}]*"?name"?\s*:\s*"([^"]+)"/g;
        let varMatch;
        while ((varMatch = variationsRegex.exec(jsContent)) !== null) {
          // Variations found indicate experiments exist
        }

        // Method 5: Look for audiences
        const audienceRegex = /"?audiences"?\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/;
        const audienceMatch = jsContent.match(audienceRegex);
        if (audienceMatch) {
          const audIdRegex = /"?(\d+)"?\s*:\s*\{[^}]*"?name"?\s*:\s*"([^"]+)"/g;
          let audMatch;
          while ((audMatch = audIdRegex.exec(audienceMatch[1])) !== null) {
            result.audiences.push({
              id: audMatch[1],
              name: audMatch[2],
            });
          }
        }

        // Method 6: Look for pages
        const pagesRegex = /"?pages"?\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/;
        const pagesMatch = jsContent.match(pagesRegex);
        if (pagesMatch) {
          const pageIdRegex = /"?(\d+)"?\s*:\s*\{[^}]*"?name"?\s*:\s*"([^"]+)"/g;
          let pageMatch;
          while ((pageMatch = pageIdRegex.exec(pagesMatch[1])) !== null) {
            result.pages.push({
              id: pageMatch[1],
              name: pageMatch[2],
            });
          }
        }

        // Method 7: Look for events/goals
        const eventsRegex = /"?events"?\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/;
        const eventsMatch = jsContent.match(eventsRegex);
        if (eventsMatch) {
          const eventIdRegex = /"?(\d+)"?\s*:\s*\{[^}]*"?name"?\s*:\s*"([^"]+)"/g;
          let eventMatch;
          while ((eventMatch = eventIdRegex.exec(eventsMatch[1])) !== null) {
            result.events.push({
              id: eventMatch[1],
              name: eventMatch[2],
            });
          }
        }

        // Method 8: More aggressive experiment extraction
        // Look for any ID with associated name that looks like an experiment
        const genericExpRegex = /["']?id["']?\s*:\s*["']?(\d{10,})["']?[,\s]*["']?name["']?\s*:\s*["']([^"']+)["']/g;
        let genMatch;
        while ((genMatch = genericExpRegex.exec(jsContent)) !== null) {
          const expId = genMatch[1];
          const expName = genMatch[2];
          // Only add if it looks like an experiment name and not a duplicate
          if (!result.experiments.find(e => e.id === expId) &&
              !result.pages.find(p => p.id === expId) &&
              !result.events.find(e => e.id === expId)) {
            // Check if this ID appears in an experiment context
            const contextCheck = jsContent.substring(Math.max(0, genMatch.index - 100), genMatch.index);
            if (contextCheck.includes('experiment') || contextCheck.includes('variation') ||
                contextCheck.includes('campaign') || contextCheck.includes('test')) {
              result.experiments.push({
                id: expId,
                name: expName,
                type: 'experiment',
                status: 'active',
              });
            }
          }
        }

      } catch (e) {
        console.error('Error parsing Optimizely snippet:', e.message);
      }

      return result;
    }

    // Fetch experiments using Optimizely REST API (requires API token)
    async function fetchExperimentsViaAPI(projectId, apiToken) {
      if (!apiToken) return null;

      try {
        // Fetch experiments
        const experimentsResponse = await fetch(
          `${OPTIMIZELY_API_BASE}/experiments?project_id=${projectId}&per_page=100`,
          {
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Accept': 'application/json',
            },
            timeout: 10000,
          }
        );

        if (!experimentsResponse.ok) {
          if (experimentsResponse.status === 401 || experimentsResponse.status === 403) {
            throw new Error('Invalid or unauthorized API token');
          }
          return null;
        }

        const experiments = await experimentsResponse.json();

        // Fetch audiences
        let audiences = [];
        try {
          const audiencesResponse = await fetch(
            `${OPTIMIZELY_API_BASE}/audiences?project_id=${projectId}&per_page=100`,
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Accept': 'application/json',
              },
              timeout: 10000,
            }
          );
          if (audiencesResponse.ok) {
            audiences = await audiencesResponse.json();
          }
        } catch (e) {
          // Audiences fetch failed, continue without them
        }

        // Fetch pages
        let pages = [];
        try {
          const pagesResponse = await fetch(
            `${OPTIMIZELY_API_BASE}/pages?project_id=${projectId}&per_page=100`,
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Accept': 'application/json',
              },
              timeout: 10000,
            }
          );
          if (pagesResponse.ok) {
            pages = await pagesResponse.json();
          }
        } catch (e) {
          // Pages fetch failed, continue without them
        }

        // Fetch events
        let events = [];
        try {
          const eventsResponse = await fetch(
            `${OPTIMIZELY_API_BASE}/events?project_id=${projectId}&per_page=100`,
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Accept': 'application/json',
              },
              timeout: 10000,
            }
          );
          if (eventsResponse.ok) {
            events = await eventsResponse.json();
          }
        } catch (e) {
          // Events fetch failed, continue without them
        }

        // Fetch project info
        let projectInfo = null;
        try {
          const projectResponse = await fetch(
            `${OPTIMIZELY_API_BASE}/projects/${projectId}`,
            {
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Accept': 'application/json',
              },
              timeout: 10000,
            }
          );
          if (projectResponse.ok) {
            projectInfo = await projectResponse.json();
          }
        } catch (e) {
          // Project fetch failed, continue without it
        }

        return {
          experiments: experiments.map(exp => ({
            id: exp.id?.toString(),
            name: exp.name,
            key: exp.key,
            description: exp.description,
            status: exp.status,
            type: exp.type || 'experiment',
            created: exp.created,
            last_modified: exp.last_modified,
            percentageIncluded: exp.traffic_allocation,
            holdback: exp.holdback,
            audienceIds: exp.audience_conditions?.audiences?.map(a => a.audience_id) || [],
            variations: (exp.variations || []).map(v => ({
              id: v.variation_id?.toString(),
              name: v.name,
              key: v.key,
              description: v.description,
              weight: v.weight,
            })),
            metrics: (exp.metrics || []).map(m => ({
              id: m.event_id?.toString(),
              aggregator: m.aggregator,
              field: m.field,
              scope: m.scope,
              winning_direction: m.winning_direction,
            })),
            url_targeting: exp.url_targeting,
          })),
          audiences: audiences.map(aud => ({
            id: aud.id?.toString(),
            name: aud.name,
            description: aud.description,
            conditions: aud.conditions,
            created: aud.created,
            last_modified: aud.last_modified,
          })),
          pages: pages.map(page => ({
            id: page.id?.toString(),
            name: page.name,
            key: page.key,
            edit_url: page.edit_url,
            created: page.created,
            last_modified: page.last_modified,
          })),
          events: events.map(evt => ({
            id: evt.id?.toString(),
            name: evt.name,
            key: evt.key,
            event_type: evt.event_type,
            created: evt.created,
          })),
          project: projectInfo ? {
            id: projectInfo.id?.toString(),
            name: projectInfo.name,
            account_id: projectInfo.account_id?.toString(),
            platform: projectInfo.platform,
            status: projectInfo.status,
            created: projectInfo.created,
          } : null,
          fetchedVia: 'rest_api',
        };
      } catch (e) {
        console.error('Error fetching via Optimizely API:', e.message);
        return { error: e.message };
      }
    }

    // Try REST API first if token is provided
    if (optimizelyApiToken) {
      for (const projectId of optimizelyData.projectIds) {
        const apiResult = await fetchExperimentsViaAPI(projectId, optimizelyApiToken);

        if (apiResult && !apiResult.error) {
          optimizelyData.detected = true;
          optimizelyData.loadedVia = 'rest_api';

          if (projectId === MY_OPTIMIZELY_PROJECT_ID) {
            optimizelyData.isMyProject = true;
          }

          // Store project info
          if (apiResult.project) {
            optimizelyData.datafile = {
              projectId: apiResult.project.id,
              accountId: apiResult.project.account_id,
              projectName: apiResult.project.name,
              platform: apiResult.project.platform,
              status: apiResult.project.status,
            };
          }

          // Add experiments
          optimizelyData.experiments = apiResult.experiments || [];
          optimizelyData.audiences = apiResult.audiences || [];
          optimizelyData.pages = apiResult.pages || [];
          optimizelyData.events = apiResult.events || [];

          // Successfully fetched via API, break the loop
          break;
        } else if (apiResult && apiResult.error) {
          // Store the error but continue trying other methods
          optimizelyData.apiError = apiResult.error;
        }
      }
    }

    // If API didn't work or no token, try CDN datafile
    if (optimizelyData.experiments.length === 0) {
      // Fetch data for all project IDs
      for (const projectId of optimizelyData.projectIds) {
      const fetchResult = await fetchOptimizelyData(projectId);

      if (fetchResult) {
        const { data, url } = fetchResult;

        // Mark as detected
        optimizelyData.detected = true;

        // If this is the known project and wasn't found in HTML, it's loaded via GTM/Shopify
        if (projectId === MY_OPTIMIZELY_PROJECT_ID && !optimizelyData.snippetUrls.length) {
          optimizelyData.loadedVia = hasGTM ? 'gtm' : 'shopify_integration';
          optimizelyData.isMyProject = true;
        }

        // Store datafile info
        optimizelyData.datafile = {
          projectId: data.projectId || projectId,
          accountId: data.accountId,
          revision: data.revision,
          version: data.version,
          datafileUrl: url,
        };

        // Add snippet URL if we got it from the JS endpoint
        if (url.includes('/js/') && !optimizelyData.snippetUrls.includes(url)) {
          optimizelyData.snippetUrls.push(url);
        }

        // Merge experiments from parsed data
        if (data.experiments && Array.isArray(data.experiments)) {
          data.experiments.forEach(exp => {
            // Avoid duplicates
            if (!optimizelyData.experiments.find(e => e.id === exp.id)) {
              optimizelyData.experiments.push({
                id: exp.id,
                name: exp.name || exp.key || `Experiment ${exp.id}`,
                key: exp.key,
                status: exp.status || 'active',
                type: exp.type || 'experiment',
                percentageIncluded: exp.percentageIncluded,
                audienceIds: exp.audienceIds,
                variations: exp.variations || [],
              });
            }
          });
        }

        // Merge campaigns
        if (data.campaigns && Array.isArray(data.campaigns)) {
          data.campaigns.forEach(camp => {
            if (!optimizelyData.experiments.find(e => e.id === camp.id)) {
              optimizelyData.experiments.push({
                id: camp.id,
                name: camp.name,
                type: 'campaign',
                status: camp.status || 'active',
              });
            }
          });
        }

        // Merge audiences
        if (data.audiences && Array.isArray(data.audiences)) {
          data.audiences.forEach(aud => {
            if (!optimizelyData.audiences.find(a => a.id === aud.id)) {
              optimizelyData.audiences.push({
                id: aud.id,
                name: aud.name,
              });
            }
          });
        }

        // Merge pages
        if (data.pages && Array.isArray(data.pages)) {
          data.pages.forEach(page => {
            if (!optimizelyData.pages.find(p => p.id === page.id)) {
              optimizelyData.pages.push({
                id: page.id,
                name: page.name,
              });
            }
          });
        }

        // Merge events
        if (data.events && Array.isArray(data.events)) {
          data.events.forEach(evt => {
            if (!optimizelyData.events.find(e => e.id === evt.id)) {
              optimizelyData.events.push({
                id: evt.id,
                name: evt.name,
              });
            }
          });
        }

        // Merge dimensions
        if (data.dimensions && Array.isArray(data.dimensions)) {
          optimizelyData.dimensions = data.dimensions;
        }

        // If we found experiments, we're done
        if (optimizelyData.experiments.length > 0) {
          break;
        }
      }
      }
    }

    // Check if it's our project
    if (optimizelyData.projectIds.includes(MY_OPTIMIZELY_PROJECT_ID)) {
      optimizelyData.isMyProject = true;
    }

    if (optimizelyData.detected || optimizelyData.experiments.length > 0) {
      result.optimizely = optimizelyData;
    }

    // ===== SHOPIFY DETECTION =====
    const shopifyData = {
      detected: false,
      shop: null,
      theme: null,
      page: null,
    };

    const hasShopifyScript = $('script[src*="cdn.shopify.com"]').length > 0;
    const hasShopifyMeta = $('meta[name="shopify-checkout-api-token"]').length > 0;
    const hasShopifyLink = $('link[href*="cdn.shopify.com"]').length > 0;

    let shopifyInlineDetected = false;
    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('Shopify.') || content.includes('window.Shopify')) {
        shopifyInlineDetected = true;

        const shopMatch = content.match(/Shopify\.shop\s*=\s*["']([^"']+)["']/);
        if (shopMatch) {
          shopifyData.shop = { name: shopMatch[1] };
        }

        const currencyMatch = content.match(/Shopify\.currency\.active\s*=\s*["']([^"']+)["']/);
        if (currencyMatch && shopifyData.shop) {
          shopifyData.shop.currency = currencyMatch[1];
        }

        const localeMatch = content.match(/Shopify\.locale\s*=\s*["']([^"']+)["']/);
        if (localeMatch && shopifyData.shop) {
          shopifyData.shop.locale = localeMatch[1];
        }
      }
    });

    if (hasShopifyScript || hasShopifyMeta || hasShopifyLink || shopifyInlineDetected) {
      shopifyData.detected = true;

      const themeId = $('script[data-theme-id]').attr('data-theme-id');
      if (themeId) {
        shopifyData.theme = { id: themeId };
      }

      const bodyClass = $('body').attr('class') || '';
      if (bodyClass.includes('template-product')) {
        shopifyData.page = { type: 'product' };
      } else if (bodyClass.includes('template-collection')) {
        shopifyData.page = { type: 'collection' };
      } else if (bodyClass.includes('template-cart')) {
        shopifyData.page = { type: 'cart' };
      } else if (bodyClass.includes('template-index')) {
        shopifyData.page = { type: 'home' };
      }

      result.shopify = shopifyData;
    }

    // ===== GA4 / GTM DETECTION =====
    const ga4Data = {
      detected: false,
      measurementIds: [],
      gtmContainers: [],
    };

    $('script[src*="googletagmanager.com"], script[src*="google-analytics.com"]').each((i, el) => {
      const src = $(el).attr('src') || '';

      const ga4Match = src.match(/[?&]id=(G-[A-Z0-9]+)/);
      if (ga4Match && !ga4Data.measurementIds.includes(ga4Match[1])) {
        ga4Data.measurementIds.push(ga4Match[1]);
        ga4Data.detected = true;
      }

      const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (gtmMatch && !ga4Data.gtmContainers.includes(gtmMatch[1])) {
        ga4Data.gtmContainers.push(gtmMatch[1]);
        ga4Data.detected = true;
      }
    });

    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';

      const ga4Matches = content.match(/G-[A-Z0-9]{10,}/g);
      if (ga4Matches) {
        ga4Matches.forEach(id => {
          if (!ga4Data.measurementIds.includes(id)) {
            ga4Data.measurementIds.push(id);
            ga4Data.detected = true;
          }
        });
      }

      const gtmMatches = content.match(/GTM-[A-Z0-9]+/g);
      if (gtmMatches) {
        gtmMatches.forEach(id => {
          if (!ga4Data.gtmContainers.includes(id)) {
            ga4Data.gtmContainers.push(id);
            ga4Data.detected = true;
          }
        });
      }
    });

    if (ga4Data.detected) {
      result.ga4 = ga4Data;
    }

    return res.status(200).json({
      success: true,
      data: result,
      method: 'fetch',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
