const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Hardcoded Optimizely Project ID for filtering
const MY_OPTIMIZELY_PROJECT_ID = '30018331732';

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

  const { url } = req.body;

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
    };

    // Find Optimizely script tags
    $('script[src*="optimizely.com"], script[src*="optimizelyCDN"]').each((i, el) => {
      const src = $(el).attr('src');
      if (src) {
        optimizelyData.snippetUrls.push(src);
        optimizelyData.detected = true;

        // Extract project ID from URL
        const projectMatch = src.match(/\/(\d{10,})\.js/);
        if (projectMatch && !optimizelyData.projectIds.includes(projectMatch[1])) {
          optimizelyData.projectIds.push(projectMatch[1]);
        }
      }
    });

    // Also check inline scripts for Optimizely
    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';

      // Look for Optimizely project IDs in inline scripts
      const projectMatches = content.match(/optimizely\.com\/js\/(\d{10,})\.js/g);
      if (projectMatches) {
        projectMatches.forEach(match => {
          const id = match.match(/(\d{10,})/)?.[1];
          if (id && !optimizelyData.projectIds.includes(id)) {
            optimizelyData.projectIds.push(id);
            optimizelyData.detected = true;
          }
        });
      }
    });

    // Check if it's our project
    if (optimizelyData.projectIds.includes(MY_OPTIMIZELY_PROJECT_ID)) {
      optimizelyData.isMyProject = true;
    }

    // Fetch Optimizely datafile for each project
    for (const projectId of optimizelyData.projectIds) {
      try {
        // Try to fetch the datafile from Optimizely CDN
        const datafileUrl = `https://cdn.optimizely.com/datafiles/${projectId}.json`;
        const datafileResponse = await fetch(datafileUrl, { timeout: 5000 });

        if (datafileResponse.ok) {
          const datafile = await datafileResponse.json();
          optimizelyData.datafile = {
            projectId: datafile.projectId || projectId,
            revision: datafile.revision,
            version: datafile.version,
          };

          // Extract experiments
          if (datafile.experiments) {
            datafile.experiments.forEach(exp => {
              optimizelyData.experiments.push({
                id: exp.id,
                key: exp.key,
                status: exp.status,
                variations: exp.variations?.map(v => ({
                  id: v.id,
                  key: v.key,
                })) || [],
                trafficAllocation: exp.trafficAllocation,
              });
            });
          }

          // Extract feature flags
          if (datafile.featureFlags) {
            datafile.featureFlags.forEach(ff => {
              optimizelyData.experiments.push({
                id: ff.id,
                key: ff.key,
                type: 'feature_flag',
                variables: ff.variables?.map(v => ({ key: v.key, type: v.type })) || [],
              });
            });
          }

          // Extract audiences
          if (datafile.audiences) {
            datafile.audiences.forEach(aud => {
              optimizelyData.audiences.push({
                id: aud.id,
                name: aud.name,
              });
            });
          }

          // Extract events
          if (datafile.events) {
            datafile.events.forEach(evt => {
              optimizelyData.events.push({
                id: evt.id,
                key: evt.key,
              });
            });
          }
        }
      } catch (e) {
        // Datafile fetch failed, continue with what we have
        console.log(`Could not fetch datafile for project ${projectId}`);
      }

      // Also try the Web snippet datafile format
      try {
        const snippetDataUrl = `https://cdn.optimizely.com/json/${projectId}.json`;
        const snippetResponse = await fetch(snippetDataUrl, { timeout: 5000 });

        if (snippetResponse.ok) {
          const snippetData = await snippetResponse.json();

          if (snippetData.experiments && !optimizelyData.experiments.length) {
            Object.entries(snippetData.experiments).forEach(([id, exp]) => {
              optimizelyData.experiments.push({
                id,
                name: exp.name,
                status: exp.status,
                percentageIncluded: exp.percentageIncluded,
                variations: exp.variations ? Object.entries(exp.variations).map(([vid, v]) => ({
                  id: vid,
                  name: v.name,
                  weight: v.weight,
                })) : [],
              });
            });
          }

          if (snippetData.audiences && !optimizelyData.audiences.length) {
            Object.entries(snippetData.audiences).forEach(([id, aud]) => {
              optimizelyData.audiences.push({
                id,
                name: aud.name,
              });
            });
          }

          if (snippetData.pages) {
            Object.entries(snippetData.pages).forEach(([id, page]) => {
              optimizelyData.pages.push({
                id,
                name: page.name,
                apiName: page.apiName,
              });
            });
          }

          if (snippetData.events) {
            Object.entries(snippetData.events).forEach(([id, evt]) => {
              optimizelyData.events.push({
                id,
                name: evt.name,
                apiName: evt.apiName,
              });
            });
          }

          optimizelyData.datafile = {
            projectId,
            accountId: snippetData.accountId,
            revision: snippetData.revision,
          };
        }
      } catch (e) {
        // Snippet data fetch failed
      }
    }

    if (optimizelyData.detected) {
      result.optimizely = optimizelyData;
    }

    // ===== SHOPIFY DETECTION =====
    const shopifyData = {
      detected: false,
      shop: null,
      theme: null,
      page: null,
    };

    // Check for Shopify indicators
    const hasShopifyScript = $('script[src*="cdn.shopify.com"]').length > 0;
    const hasShopifyMeta = $('meta[name="shopify-checkout-api-token"]').length > 0;
    const hasShopifyLink = $('link[href*="cdn.shopify.com"]').length > 0;

    // Check inline scripts for Shopify object
    let shopifyInlineDetected = false;
    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';
      if (content.includes('Shopify.') || content.includes('window.Shopify')) {
        shopifyInlineDetected = true;

        // Try to extract shop name
        const shopMatch = content.match(/Shopify\.shop\s*=\s*["']([^"']+)["']/);
        if (shopMatch) {
          shopifyData.shop = { name: shopMatch[1] };
        }

        // Try to extract currency
        const currencyMatch = content.match(/Shopify\.currency\.active\s*=\s*["']([^"']+)["']/);
        if (currencyMatch && shopifyData.shop) {
          shopifyData.shop.currency = currencyMatch[1];
        }

        // Try to extract locale
        const localeMatch = content.match(/Shopify\.locale\s*=\s*["']([^"']+)["']/);
        if (localeMatch && shopifyData.shop) {
          shopifyData.shop.locale = localeMatch[1];
        }
      }
    });

    if (hasShopifyScript || hasShopifyMeta || hasShopifyLink || shopifyInlineDetected) {
      shopifyData.detected = true;

      // Try to get theme info from meta
      const themeId = $('script[data-theme-id]').attr('data-theme-id');
      if (themeId) {
        shopifyData.theme = { id: themeId };
      }

      // Detect page type
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

    // Find GA4 and GTM in script tags
    $('script[src*="googletagmanager.com"], script[src*="google-analytics.com"]').each((i, el) => {
      const src = $(el).attr('src') || '';

      // GA4 measurement IDs
      const ga4Match = src.match(/[?&]id=(G-[A-Z0-9]+)/);
      if (ga4Match && !ga4Data.measurementIds.includes(ga4Match[1])) {
        ga4Data.measurementIds.push(ga4Match[1]);
        ga4Data.detected = true;
      }

      // GTM container IDs
      const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
      if (gtmMatch && !ga4Data.gtmContainers.includes(gtmMatch[1])) {
        ga4Data.gtmContainers.push(gtmMatch[1]);
        ga4Data.detected = true;
      }
    });

    // Check inline scripts for GA4/GTM
    $('script:not([src])').each((i, el) => {
      const content = $(el).html() || '';

      // Find GA4 measurement IDs
      const ga4Matches = content.match(/G-[A-Z0-9]{10,}/g);
      if (ga4Matches) {
        ga4Matches.forEach(id => {
          if (!ga4Data.measurementIds.includes(id)) {
            ga4Data.measurementIds.push(id);
            ga4Data.detected = true;
          }
        });
      }

      // Find GTM container IDs
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
      method: 'fetch', // Indicate this is fetch-based, no screenshot
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
