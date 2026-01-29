#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { URL } = require("url");

const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const baseOrigin = "http://local.poapyments";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

function getContentType(filePath) {
  const ext = path.extname(filePath);
  return MIME[ext] || "application/octet-stream";
}

async function readFileSafe(filePath) {
  try {
    const data = await fs.promises.readFile(filePath);
    return { ok: true, data };
  } catch (err) {
    return { ok: false };
  }
}

function stubFxRates() {
  return JSON.stringify({
    amount: 1.0,
    base: "GBP",
    date: new Date().toISOString().slice(0, 10),
    rates: { GBP: 1, USD: 1.27, EUR: 1.17, NGN: 1800, GHS: 15.5, ZAR: 23.5, KES: 195, CAD: 1.72 },
  });
}

async function run() {
  let browser;
  const errors = [];

  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();

    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore CDN integrity errors (third-party resources)
        if (text.includes("integrity") && text.includes("cdnjs.cloudflare.com")) return;
        errors.push(`console: ${text}`);
      }
    });

    await page.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());

      if (requestUrl.origin === baseOrigin) {
        const urlPath = decodeURIComponent(requestUrl.pathname);
        // Use dist/index.html for the main page (pre-compiled partials)
        const safePath = urlPath === "/" || urlPath === "/index.html" ? "/dist/index.html" : urlPath;
        const filePath = path.normalize(path.join(root, safePath));

        if (!filePath.startsWith(root)) {
          await route.fulfill({ status: 403, body: "Forbidden" });
          return;
        }

        const result = await readFileSafe(filePath);
        if (!result.ok) {
          await route.fulfill({ status: 404, body: "Not found" });
          return;
        }

        await route.fulfill({
          status: 200,
          body: result.data,
          headers: { "content-type": getContentType(filePath) },
        });
        return;
      }

      if (requestUrl.hostname === "api.frankfurter.app" || requestUrl.hostname === "api.exchangerate.host") {
        await route.fulfill({
          status: 200,
          body: stubFxRates(),
          headers: { "content-type": "application/json" },
        });
        return;
      }

      if (requestUrl.hostname === "fonts.googleapis.com") {
        await route.fulfill({
          status: 200,
          body: "",
          headers: { "content-type": "text/css" },
        });
        return;
      }

      await route.fulfill({
        status: 204,
        body: "",
      });
    });

    await page.goto(`${baseOrigin}/index.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".top-bar", { timeout: 10000 });
    await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 10000 });
    await page.waitForFunction(() => window.appInitialized === true, { timeout: 15000 });

    await page.evaluate(() => {
      const screens = Array.from(document.querySelectorAll(".screen"));
      const idx = screens.findIndex((screen) => screen.dataset.screen === "app");
      if (idx >= 0 && typeof window.showScreen === "function") {
        window.showScreen(idx);
      }
    });

    // Close any modals that might be blocking (e.g., celebration modal)
    await page.evaluate(() => {
      const celebrationModal = document.querySelector("[data-celebration-modal]");
      if (celebrationModal) {
        celebrationModal.hidden = true;
        celebrationModal.style.display = "none";
      }
      // Also close any other open modals
      document.querySelectorAll(".modal-overlay, .celebration-modal").forEach(el => {
        el.hidden = true;
        el.style.display = "none";
      });
    });
    await page.waitForTimeout(200);

    // Navigate to Simulate tab (Monte Carlo - now its own top-level tab)
    await page.click('[data-tab-target="simulate"]');
    await page.waitForSelector('[data-tab="simulate"].is-active', { timeout: 10000 });

    // Run Monte Carlo simulation
    await page.evaluate(() => {
      if (typeof window.updateMonteCarlo === "function") {
        window.updateMonteCarlo();
      }
    });

    // Wait for Monte Carlo results (check for p50 percentile value)
    await page.waitForFunction(() => {
      const p50El = document.querySelector("[data-monte-p50]");
      return p50El && p50El.textContent && !p50El.textContent.includes("£0");
    }, { timeout: 15000 });

    // Navigate to Plan tab for currency converter
    await page.click('[data-tab-target="plan"]');
    await page.waitForSelector('[data-tab="plan"].is-active', { timeout: 10000 });

    // Click Currency subtab
    await page.click('[data-subtab-target="currency"]');
    await page.waitForSelector('[data-subtab="currency"].is-active', { timeout: 10000 });

    // Test currency converter
    await page.fill("[data-converter-amount]", "200");
    await page.waitForFunction(() => {
      const outputEl = document.querySelector("[data-converter-output]");
      return outputEl && outputEl.textContent && outputEl.textContent.trim() !== "";
    }, { timeout: 10000 });

    // Navigate to Cash Flow tab (Future Lab - now its own top-level tab)
    await page.click('[data-tab-target="cashflow"]');
    await page.waitForSelector('[data-tab="cashflow"].is-active', { timeout: 10000 });

    if (errors.length) {
      throw new Error(`Smoke test collected ${errors.length} errors:\n${errors.join("\n")}`);
    }

    console.log("Smoke test passed.");
  } catch (error) {
    console.error("Smoke test failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

run();
