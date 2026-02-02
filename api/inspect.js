const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Hardcoded Optimizely Project ID - always check this
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
      // Try the Web snippet JSON format first (more common for Web Experimentation)
      const urls = [
        `https://cdn.optimizely.com/json/${projectId}.json`,
        `https://cdn.optimizely.com/datafiles/${projectId}.json`,
        `https://cdn.optimizely.com/public/${projectId}/snippet.js`,
      ];

      for (const dataUrl of urls) {
        try {
          const dataResponse = await fetch(dataUrl, {
            timeout: 5000,
            headers: {
              'Accept': 'application/json, text/javascript, */*',
            }
          });

          if (dataResponse.ok) {
            const contentType = dataResponse.headers.get('content-type') || '';
            let data;

            if (contentType.includes('javascript') || dataUrl.includes('snippet.js')) {
              // Parse JavaScript snippet to extract data
              const jsContent = await dataResponse.text();
              // Look for JSON data in the snippet
              const jsonMatch = jsContent.match(/var defined_cdn_json\s*=\s*(\{[\s\S]*?\});/);
              if (jsonMatch) {
                data = JSON.parse(jsonMatch[1]);
              }
            } else {
              data = await dataResponse.json();
            }

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

    // Fetch data for all project IDs
    for (const projectId of optimizelyData.projectIds) {
      const result = await fetchOptimizelyData(projectId);

      if (result) {
        const { data, url } = result;

        // Mark as detected
        optimizelyData.detected = true;

        // If this is the known project and wasn't found in HTML, it's loaded via GTM
        if (projectId === MY_OPTIMIZELY_PROJECT_ID && !optimizelyData.snippetUrls.length) {
          optimizelyData.loadedVia = hasGTM ? 'gtm' : 'known_project';
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

        // Extract experiments (Web Experimentation format)
        if (data.experiments && typeof data.experiments === 'object') {
          if (Array.isArray(data.experiments)) {
            // Full Stack format
            data.experiments.forEach(exp => {
              optimizelyData.experiments.push({
                id: exp.id,
                key: exp.key,
                name: exp.key,
                status: exp.status,
                variations: exp.variations?.map(v => ({
                  id: v.id,
                  key: v.key,
                  name: v.key,
                })) || [],
              });
            });
          } else {
            // Web format (object with experiment IDs as keys)
            Object.entries(data.experiments).forEach(([id, exp]) => {
              optimizelyData.experiments.push({
                id,
                name: exp.name,
                status: exp.status || 'unknown',
                percentageIncluded: exp.percentageIncluded,
                audienceIds: exp.audienceIds,
                variations: exp.variations ? Object.entries(exp.variations).map(([vid, v]) => ({
                  id: vid,
                  name: v.name,
                  weight: v.weight,
                })) : [],
              });
            });
          }
        }

        // Extract campaigns (Web Experimentation)
        if (data.campaigns && typeof data.campaigns === 'object') {
          Object.entries(data.campaigns).forEach(([id, campaign]) => {
            optimizelyData.experiments.push({
              id,
              name: campaign.name,
              type: 'campaign',
              status: campaign.status || 'unknown',
              percentageIncluded: campaign.percentageIncluded,
            });
          });
        }

        // Extract feature flags
        if (data.featureFlags && Array.isArray(data.featureFlags)) {
          data.featureFlags.forEach(ff => {
            optimizelyData.experiments.push({
              id: ff.id,
              key: ff.key,
              name: ff.key,
              type: 'feature_flag',
              variables: ff.variables?.map(v => ({ key: v.key, type: v.type })) || [],
            });
          });
        }

        // Extract audiences
        if (data.audiences) {
          if (Array.isArray(data.audiences)) {
            data.audiences.forEach(aud => {
              optimizelyData.audiences.push({ id: aud.id, name: aud.name });
            });
          } else {
            Object.entries(data.audiences).forEach(([id, aud]) => {
              optimizelyData.audiences.push({ id, name: aud.name });
            });
          }
        }

        // Extract pages
        if (data.pages) {
          Object.entries(data.pages).forEach(([id, page]) => {
            optimizelyData.pages.push({
              id,
              name: page.name,
              apiName: page.apiName,
              category: page.category,
            });
          });
        }

        // Extract events
        if (data.events) {
          if (Array.isArray(data.events)) {
            data.events.forEach(evt => {
              optimizelyData.events.push({ id: evt.id, key: evt.key, name: evt.key });
            });
          } else {
            Object.entries(data.events).forEach(([id, evt]) => {
              optimizelyData.events.push({
                id,
                name: evt.name,
                apiName: evt.apiName,
                category: evt.category,
              });
            });
          }
        }

        // Extract dimensions
        if (data.dimensions) {
          optimizelyData.dimensions = Object.entries(data.dimensions).map(([id, dim]) => ({
            id,
            name: dim.name,
            apiName: dim.apiName,
          }));
        }

        // We found data, no need to check other project IDs
        break;
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
