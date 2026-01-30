const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

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

  let browser = null;

  try {
    // Launch browser with Chromium optimized for serverless
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Collect network requests for GA4 detection
    const ga4Requests = [];
    page.on('request', (request) => {
      const reqUrl = request.url();
      if (
        reqUrl.includes('google-analytics.com') ||
        reqUrl.includes('googletagmanager.com') ||
        reqUrl.includes('analytics.google.com')
      ) {
        ga4Requests.push({
          url: reqUrl,
          method: request.method(),
        });
      }
    });

    // Navigate to URL with timeout
    await page.goto(targetUrl.href, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait a bit for any lazy-loaded scripts
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extract all data from the page
    const extractedData = await page.evaluate((projectId) => {
      const result = {
        optimizely: null,
        shopify: null,
        ga4: null,
        dataLayer: null,
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
          state: null,
          experiments: [],
          audiences: [],
          pages: [],
          events: [],
        };

        try {
          // Get project ID
          if (opt.get) {
            const state = opt.get('state');
            if (state) {
              optimizelyData.state = {
                activeExperiments: state.getActiveExperimentIds
                  ? state.getActiveExperimentIds()
                  : [],
                variationMap: state.getVariationMap ? state.getVariationMap() : {},
              };
            }

            const data = opt.get('data');
            if (data) {
              optimizelyData.projectId = data.projectId;
              optimizelyData.isMyProject = data.projectId === projectId;
              optimizelyData.revision = data.revision;
              optimizelyData.accountId = data.accountId;

              // Get experiments
              if (data.experiments) {
                Object.entries(data.experiments).forEach(([id, exp]) => {
                  const experiment = {
                    id,
                    name: exp.name,
                    status: exp.status || 'unknown',
                    variations: [],
                    audiences: exp.audienceIds || [],
                    trafficAllocation: exp.trafficAllocation || null,
                    percentageIncluded: exp.percentageIncluded || null,
                    metrics: exp.metrics || [],
                    holdback: exp.holdback || 0,
                    isActive:
                      optimizelyData.state?.activeExperiments?.includes(id),
                    currentVariation:
                      optimizelyData.state?.variationMap?.[id]?.id || null,
                  };

                  // Get variations
                  if (exp.variations) {
                    Object.entries(exp.variations).forEach(([varId, variation]) => {
                      experiment.variations.push({
                        id: varId,
                        name: variation.name,
                        weight: variation.weight || null,
                        isControl: variation.isControl || false,
                        isCurrent: varId === experiment.currentVariation,
                      });
                    });
                  }

                  optimizelyData.experiments.push(experiment);
                });
              }

              // Get audiences
              if (data.audiences) {
                Object.entries(data.audiences).forEach(([id, aud]) => {
                  optimizelyData.audiences.push({
                    id,
                    name: aud.name,
                    conditions: aud.conditions || null,
                  });
                });
              }

              // Get pages
              if (data.pages) {
                Object.entries(data.pages).forEach(([id, pg]) => {
                  optimizelyData.pages.push({
                    id,
                    name: pg.name,
                    apiName: pg.apiName,
                    category: pg.category,
                    activationCode: pg.activationCode ? 'present' : null,
                  });
                });
              }

              // Get events
              if (data.events) {
                Object.entries(data.events).forEach(([id, evt]) => {
                  optimizelyData.events.push({
                    id,
                    name: evt.name,
                    apiName: evt.apiName,
                    category: evt.category,
                    eventType: evt.eventType,
                  });
                });
              }
            }

            // Get visitor data
            const visitor = opt.get('visitor');
            if (visitor) {
              optimizelyData.visitor = {
                visitorId: visitor.visitorId,
                attributes: visitor.custom || {},
              };
            }
          }
        } catch (e) {
          optimizelyData.error = e.message;
        }

        result.optimizely = optimizelyData;
      }

      // ===== SHOPIFY EXTRACTION =====
      if (window.Shopify || window.ShopifyAnalytics) {
        const shopifyData = {
          detected: true,
          shop: null,
          cart: null,
          customer: null,
          product: null,
          checkout: null,
          theme: null,
        };

        try {
          // Basic Shopify object
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
              role: window.Shopify.theme?.role,
            };

            // Check for checkout
            if (window.Shopify.Checkout) {
              shopifyData.checkout = {
                step: window.Shopify.Checkout.step,
                page: window.Shopify.Checkout.page,
                token: window.Shopify.Checkout.token ? 'present' : null,
              };
            }
          }

          // ShopifyAnalytics meta
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
                gid: meta.product.gid,
                vendor: meta.product.vendor,
                type: meta.product.type,
                variants:
                  meta.product.variants?.map((v) => ({
                    id: v.id,
                    name: v.name,
                    price: v.price,
                    sku: v.sku,
                    available: v.available,
                  })) || [],
              };
            }
          }

          // Cart data (if available)
          if (window.theme?.cart || window.cart) {
            const cart = window.theme?.cart || window.cart;
            shopifyData.cart = {
              itemCount: cart.item_count,
              totalPrice: cart.total_price,
              currency: cart.currency,
              items:
                cart.items?.map((item) => ({
                  title: item.title,
                  quantity: item.quantity,
                  price: item.price,
                  variant: item.variant_title,
                })) || [],
            };
          }

          // Customer state
          if (window.__st) {
            shopifyData.customer = {
              loggedIn: window.__st.cid ? true : false,
              customerId: window.__st.cid || null,
            };
          }
        } catch (e) {
          shopifyData.error = e.message;
        }

        result.shopify = shopifyData;
      }

      // ===== GA4 / GOOGLE TAG MANAGER EXTRACTION =====
      const ga4Data = {
        detected: false,
        measurementIds: [],
        gtmContainers: [],
        dataLayerContents: [],
      };

      try {
        // Check for gtag
        if (window.gtag || window.dataLayer) {
          ga4Data.detected = true;
        }

        // Find measurement IDs from various sources
        if (window.google_tag_data?.uach) {
          ga4Data.detected = true;
        }

        // Check for GA4 in scripts
        const scripts = document.querySelectorAll(
          'script[src*="googletagmanager"], script[src*="google-analytics"]'
        );
        scripts.forEach((script) => {
          const src = script.src;
          const gMatch = src.match(/[?&]id=(G-[A-Z0-9]+)/);
          const gtmMatch = src.match(/[?&]id=(GTM-[A-Z0-9]+)/);
          if (gMatch && !ga4Data.measurementIds.includes(gMatch[1])) {
            ga4Data.measurementIds.push(gMatch[1]);
            ga4Data.detected = true;
          }
          if (gtmMatch && !ga4Data.gtmContainers.includes(gtmMatch[1])) {
            ga4Data.gtmContainers.push(gtmMatch[1]);
            ga4Data.detected = true;
          }
        });

        // Check inline scripts for measurement IDs
        document.querySelectorAll('script:not([src])').forEach((script) => {
          const content = script.textContent;
          const matches = content.match(/G-[A-Z0-9]{10,}/g);
          if (matches) {
            matches.forEach((id) => {
              if (!ga4Data.measurementIds.includes(id)) {
                ga4Data.measurementIds.push(id);
                ga4Data.detected = true;
              }
            });
          }
          const gtmMatches = content.match(/GTM-[A-Z0-9]+/g);
          if (gtmMatches) {
            gtmMatches.forEach((id) => {
              if (!ga4Data.gtmContainers.includes(id)) {
                ga4Data.gtmContainers.push(id);
                ga4Data.detected = true;
              }
            });
          }
        });

        // Get dataLayer contents
        if (window.dataLayer && Array.isArray(window.dataLayer)) {
          ga4Data.dataLayerContents = window.dataLayer.slice(0, 50).map((item) => {
            // Safely stringify, handling circular references
            try {
              return JSON.parse(JSON.stringify(item));
            } catch {
              return { event: item.event || 'unknown', error: 'Could not serialize' };
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
      type: 'png',
      fullPage: false,
    });
    const screenshotBase64 = screenshot.toString('base64');

    await browser.close();

    return res.status(200).json({
      success: true,
      data: extractedData,
      screenshot: `data:image/png;base64,${screenshotBase64}`,
      ga4NetworkRequests: ga4Requests.slice(0, 20),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack,
    });
  }
};
