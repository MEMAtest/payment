const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const baseOrigin = 'http://local.poapyments';

async function run() {
  let browser;
  const errors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push('console: ' + msg.text());
    });

    await page.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());

      if (requestUrl.origin === baseOrigin) {
        const urlPath = decodeURIComponent(requestUrl.pathname);
        const safePath = urlPath === '/' || urlPath === '/index.html' ? '/dist/index.html' : urlPath;
        const filePath = path.normalize(path.join(root, safePath));

        try {
          const data = await fs.promises.readFile(filePath);
          const ext = path.extname(filePath);
          const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
          await route.fulfill({
            status: 200,
            body: data,
            headers: { 'content-type': MIME[ext] || 'application/octet-stream' },
          });
        } catch (err) {
          await route.fulfill({ status: 404, body: 'Not found' });
        }
        return;
      }

      if (requestUrl.hostname.includes('exchangerate') || requestUrl.hostname.includes('frankfurter')) {
        await route.fulfill({
          status: 200,
          body: JSON.stringify({ amount: 1, base: 'GBP', date: '2024-01-29', rates: { GBP: 1, USD: 1.27, EUR: 1.17 } }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      await route.fulfill({ status: 204, body: '' });
    });

    console.log('Loading page...');
    await page.goto(baseOrigin + '/index.html', { waitUntil: 'domcontentloaded' });

    console.log('Waiting for app init...');
    await page.waitForFunction(() => window.appInitialized === true, { timeout: 15000 });
    console.log('App initialized');

    // Navigate to app screen
    await page.evaluate(() => {
      const screens = Array.from(document.querySelectorAll('.screen'));
      const idx = screens.findIndex(s => s.dataset.screen === 'app');
      if (idx >= 0) window.showScreen(idx);
    });

    // Close modals
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay, .celebration-modal, [data-celebration-modal]').forEach(el => {
        el.hidden = true;
        el.style.display = 'none';
      });
    });
    await page.waitForTimeout(200);

    // Click Simulate tab (Monte Carlo - now standalone)
    console.log('Clicking Simulate tab...');
    await page.click('[data-tab-target="simulate"]');
    await page.waitForSelector('[data-tab="simulate"].is-active', { timeout: 5000 });
    console.log('Simulate tab active');

    // Check if Monte Carlo function exists
    const funcs = await page.evaluate(() => ({
      updateMonteCarlo: typeof window.updateMonteCarlo === 'function',
      runMonteCarlo: typeof window.runMonteCarlo === 'function',
    }));
    console.log('Monte Carlo funcs:', JSON.stringify(funcs));

    // Run simulation
    await page.evaluate(() => {
      if (typeof window.updateMonteCarlo === 'function') window.updateMonteCarlo();
    });
    console.log('Monte Carlo called');

    await page.waitForTimeout(2000);

    // Check result
    const result = await page.evaluate(() => {
      return document.querySelector('[data-monte-p50]')?.textContent || 'no result element';
    });
    console.log('Monte Carlo result:', result);

    // Click Cash Flow tab (Future Lab - now standalone)
    console.log('Clicking Cash Flow tab...');
    await page.click('[data-tab-target="cashflow"]');
    await page.waitForSelector('[data-tab="cashflow"].is-active', { timeout: 5000 });
    console.log('Cash Flow tab active');

    // Click Plan tab for Currency subtab
    console.log('Clicking Plan tab...');
    await page.click('[data-tab-target="plan"]');
    await page.waitForSelector('[data-tab="plan"].is-active', { timeout: 5000 });
    console.log('Plan tab active');

    // Check Plan subtabs
    const subtabs = await page.evaluate(() => {
      const panel = document.querySelector('[data-tab="plan"]');
      return Array.from(panel.querySelectorAll('[data-subtab-target]')).map(b => b.dataset.subtabTarget);
    });
    console.log('Plan subtabs:', subtabs.join(', '));

    // Click Currency subtab
    console.log('Clicking Currency subtab...');
    await page.click('[data-subtab-target="currency"]');
    await page.waitForSelector('[data-subtab="currency"].is-active', { timeout: 5000 });
    console.log('Currency subtab active');

    console.log('SMOKE TEST PASSED');

  } catch (error) {
    console.error('Test error:', error.message);
    if (errors.length) console.log('Errors:', errors.slice(0, 3).join('\n'));
  } finally {
    if (browser) await browser.close();
  }
}

run();
