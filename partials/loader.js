(async () => {
  async function loadInclude(el) {
    const path = el.dataset.include;
    if (!path) return;
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`Failed to load ${path}: ${res.status}`);
    }
    const html = await res.text();
    el.outerHTML = html;
  }

  async function loadAllIncludes() {
    let includes = Array.from(document.querySelectorAll("[data-include]"));
    while (includes.length) {
      await Promise.all(includes.map(loadInclude));
      includes = Array.from(document.querySelectorAll("[data-include]"));
    }
  }

  async function loadScripts(sources) {
    for (const src of sources) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.defer = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
      });
    }
  }

  try {
    await loadAllIncludes();
  } catch (error) {
    console.error("Partial load failed:", error);
  }

  const scripts = [
    "app-config.js",
    "firebase-config.js",
    "firebase-init.js",
    "app.js",
    "app-rewards.js",
    "app-goals.js",
    "app-cashflow.js",
    "app-protection.js",
    "app-alerts.js",
    "app-actions.js",
    "app-simulation.js",
    "app-future.js",
    "app-currency.js",
    "app-onboarding.js",
    "app-firebase.js",
    "app-init.js",
  ];

  try {
    await loadScripts(scripts);
  } catch (error) {
    console.error("Script load failed:", error);
  }
})();
