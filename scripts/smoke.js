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
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
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

      if (requestUrl.hostname === "api.frankfurter.app") {
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

    await page.click('[data-tab-target="simulator"]');
    await page.waitForSelector('[data-tab="simulator"].is-active', { timeout: 10000 });

    // Run simulation with default values (250 runs minimum)
    await page.evaluate(() => {
      // Set runs input value directly (it's in a collapsed details)
      const runsInput = document.querySelector("[data-sim-runs-input]");
      if (runsInput) runsInput.value = "250";
      if (typeof window.runEnhancedSimulation === "function") {
        window.runEnhancedSimulation();
      }
    });

    await page.waitForFunction(() => {
      const value = document.querySelector("[data-sim-p50]")?.textContent || "";
      return value && value.trim() !== "£0";
    }, { timeout: 10000 });

    await page.waitForFunction(() => {
      return document.querySelectorAll("[data-sim-histogram] .sim-bar").length === 16;
    }, { timeout: 10000 });

    await page.waitForFunction(() => {
      return document.querySelectorAll("[data-sim-fan] .fan-band").length >= 1;
    }, { timeout: 10000 });

    await page.click('[data-tab-target="currency"]');
    await page.waitForSelector('[data-tab="currency"].is-active', { timeout: 10000 });

    await page.fill("[data-currency-amount]", "200");
    await page.waitForFunction(() => {
      const value = document.querySelector("[data-currency-result]")?.textContent || "";
      return value && value.trim() !== "--";
    }, { timeout: 10000 });

    await page.waitForFunction(() => {
      return document.querySelectorAll("[data-currency-quick] .quick-card").length >= 5;
    }, { timeout: 10000 });

    await page.waitForFunction(() => {
      return document.querySelectorAll("[data-currency-compare] .comparison-row").length >= 7;
    }, { timeout: 10000 });

    await page.click('[data-tab-target="plan"]');
    await page.waitForSelector('[data-tab="plan"].is-active', { timeout: 10000 });

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
