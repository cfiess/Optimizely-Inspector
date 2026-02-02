const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

// Hardcoded Optimizely Project ID for filtering
const MY_OPTIMIZELY_PROJECT_ID = '30018331732';

// Remote Chromium URL - downloaded at runtime to avoid 250MB bundle limit
const CHROMIUM_URL = 'https://github.com/nicholasgriffintn/chromium-for-vercel/releases/download/v119.0.0/chromium-v119.0.0-pack.tar';

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

  let browser = null;

  try {
    // Get executable path - downloads chromium at runtime
    const executablePath = await chromium.executablePath(CHROMIUM_URL);

    // Launch browser
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 720 });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );

    // Navigate to URL
    await page.goto(targetUrl.href, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });

    // Wait for scripts to initialize
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extract all data from the page
    const extractedData = await page.evaluate((projectId) => {
      const result = {
        optimizely: null,
        shopify: null,
        ga4: null,
        pageInfo: {
          title: document.title,
          url: window.location.href,
        },
      };

      // ===== OPTIMIZELY EXTRACTION =====
      if (window.optimizely) {
        const opt = window.optimizely;
        const optimizelyData = {
          projectId: null,
          isMyProject: false,
          experiments: [],
          audiences: [],
          pages: [],
          events: [],
        };

        try {
          if (opt.get) {
            const state = opt.get('state');
            let activeExperiments = [];
            let variationMap = {};

            if (state) {
              activeExperiments = state.getActiveExperimentIds ? state.getActiveExperimentIds() : [];
              variationMap = state.getVariationMap ? state.getVariationMap() : {};
            }

            const data = opt.get('data');
            if (data) {
              optimizelyData.projectId = data.projectId;
              optimizelyData.isMyProject = data.projectId === projectId;
              optimizelyData.revision = data.revision;
              optimizelyData.accountId = data.accountId;

              if (data.experiments) {
                Object.entries(data.experiments).forEach(([id, exp]) => {
                  const experiment = {
                    id,
                    name: exp.name,
                    status: exp.status || 'unknown',
                    variations: [],
                    audiences: exp.audienceIds || [],
                    percentageIncluded: exp.percentageIncluded || null,
                    holdback: exp.holdback || 0,
                    isActive: activeExperiments.includes(id),
                    currentVariation: variationMap[id]?.id || null,
                  };

                  if (exp.variations) {
                    Object.entries(exp.variations).forEach(([varId, variation]) => {
                      experiment.variations.push({
                        id: varId,
                        name: variation.name,
                        weight: variation.weight || null,
                        isCurrent: varId === experiment.currentVariation,
                      });
                    });
                  }

                  optimizelyData.experiments.push(experiment);
                });
              }

              if (data.audiences) {
                Object.entries(data.audiences).forEach(([id, aud]) => {
                  optimizelyData.audiences.push({ id, name: aud.name });
                });
              }

              if (data.pages) {
                Object.entries(data.pages).forEach(([id, pg]) => {
                  optimizelyData.pages.push({ id, name: pg.name, apiName: pg.apiName });
                });
              }

              if (data.events) {
                Object.entries(data.events).forEach(([id, evt]) => {
                  optimizelyData.events.push({ id, name: evt.name, apiName: evt.apiName });
                });
              }
            }

            const visitor = opt.get('visitor');
            if (visitor) {
              optimizelyData.visitor = { visitorId: visitor.visitorId };
            }
          }
        } catch (e) {
          optimizelyData.error = e.message;
        }

        result.optimizely = optimizelyData;
      }

      // ===== SHOPIFY EXTRACTION =====
      if (window.Shopify || window.ShopifyAnalytics) {
        const shopifyData = { detected: true };

        try {
          if (window.Shopify) {
            shopifyData.shop = {
              name: window.Shopify.shop,
              currency: window.Shopify.currency?.active,
              locale: window.Shopify.locale,
              country: window.Shopify.country,
            };

            shopifyData.theme = {
              id: window.Shopify.theme?.id,
              name: window.Shopify.theme?.name,
            };

            if (window.Shopify.Checkout) {
              shopifyData.checkout = {
                step: window.Shopify.Checkout.step,
                page: window.Shopify.Checkout.page,
              };
            }
          }

          if (window.ShopifyAnalytics?.meta) {
            const meta = window.ShopifyAnalytics.meta;
            shopifyData.page = {
              type: meta.page?.pageType,
              resourceType: meta.page?.resourceType,
              resourceId: meta.page?.resourceId,
            };

            if (meta.product) {
              shopifyData.product = {
                id: meta.product.id,
                vendor: meta.product.vendor,
                type: meta.product.type,
              };
            }
          }

          if (window.__st) {
            shopifyData.customer = { loggedIn: !!window.__st.cid };
          }
        } catch (e) {
          shopifyData.error = e.message;
        }

        result.shopify = shopifyData;
      }

      // ===== GA4 EXTRACTION =====
      const ga4Data = {
        detected: false,
        measurementIds: [],
        gtmContainers: [],
        dataLayerContents: [],
      };

      try {
        if (window.gtag || window.dataLayer) {
          ga4Data.detected = true;
        }

        const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
        scripts.forEach((script) => {
          const src = script.src;
          const gMatch = src.match(/[?&]id=(G-[A-Z0-9]+)/);
          const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
          if (gMatch && !ga4Data.measurementIds.includes(gMatch[1])) {
            ga4Data.measurementIds.push(gMatch[1]);
          }
          if (gtmMatch && !ga4Data.gtmContainers.includes(gtmMatch[1])) {
            ga4Data.gtmContainers.push(gtmMatch[1]);
          }
        });

        document.querySelectorAll('script:not([src])').forEach((script) => {
          const content = script.textContent || '';
          const gMatches = content.match(/G-[A-Z0-9]{10,}/g) || [];
          const gtmMatches = content.match(/GTM-[A-Z0-9]+/g) || [];
          gMatches.forEach((id) => {
            if (!ga4Data.measurementIds.includes(id)) ga4Data.measurementIds.push(id);
          });
          gtmMatches.forEach((id) => {
            if (!ga4Data.gtmContainers.includes(id)) ga4Data.gtmContainers.push(id);
          });
        });

        if (ga4Data.measurementIds.length || ga4Data.gtmContainers.length) {
          ga4Data.detected = true;
        }

        if (window.dataLayer && Array.isArray(window.dataLayer)) {
          ga4Data.dataLayerContents = window.dataLayer.slice(0, 15).map((item) => {
            try {
              return JSON.parse(JSON.stringify(item));
            } catch {
              return { event: item.event || 'unknown' };
            }
          });
        }
      } catch (e) {
        ga4Data.error = e.message;
      }

      result.ga4 = ga4Data;

      return result;
    }, MY_OPTIMIZELY_PROJECT_ID);

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 60,
    });
    const screenshotBase64 = screenshot.toString('base64');

    await browser.close();

    return res.status(200).json({
      success: true,
      data: extractedData,
      screenshot: `data:image/jpeg;base64,${screenshotBase64}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
