// Currency converter
let fxRates = null;
let fxLastUpdated = null;

async function loadFxRates() {
  try {
    const cached = localStorage.getItem(FX_CACHE_KEY);
    if (cached) {
      const { rates, timestamp } = JSON.parse(cached);
      const age = (Date.now() - timestamp) / 1000 / 60 / 60;
      if (age < config.fxCacheHours) {
        fxRates = rates;
        fxLastUpdated = timestamp;
        setTextAll("[data-fx-updated]", `Rates updated: ${formatTimestamp(timestamp)}`);
        return;
      }
    }

    const res = await fetch(config.fxApiUrl);
    const data = await res.json();
    fxRates = data.rates;
    fxLastUpdated = Date.now();
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates: fxRates, timestamp: fxLastUpdated }));
    setTextAll("[data-fx-updated]", `Rates updated: ${formatTimestamp(fxLastUpdated)}`);
  } catch (e) {
    fxRates = { GBP: 1, USD: 1.27, EUR: 1.17, NGN: 1800, GHS: 15.5, ZAR: 23.5, KES: 195, CAD: 1.72 };
    fxLastUpdated = Date.now();
  }
}

function updateConverter() {
  const amountEl = document.querySelector("[data-converter-amount]");
  const fromEl = document.querySelector("[data-converter-from]");
  const toEl = document.querySelector("[data-converter-to]");
  const outputEl = document.querySelector("[data-converter-output]");

  if (!fxRates || !amountEl || !outputEl) return;

  const amount = Number(amountEl.value) || 0;
  const from = fromEl?.value || "GBP";
  const to = toEl?.value || "USD";

  const inGBP = from === "GBP" ? amount : amount / (fxRates[from] || 1);
  const result = to === "GBP" ? inGBP : inGBP * (fxRates[to] || 1);

  outputEl.textContent = `${amount.toLocaleString()} ${from} = ${result.toFixed(2)} ${to}`;
}

function getFxRate(from, to) {
  if (!fxRates) return null;
  if (from === to) return 1;
  const fromRate = from === "GBP" ? 1 : fxRates[from];
  const toRate = to === "GBP" ? 1 : fxRates[to];
  if (!fromRate || !toRate) return null;
  return (1 / fromRate) * toRate;
}

function populateCurrencyDropdowns() {
  const fromEl = document.querySelector("[data-currency-from]");
  const toEl = document.querySelector("[data-currency-to]");
  if (!fromEl || !toEl) return;

  const options = Object.entries(CURRENCIES)
    .map(([code, data]) => `<option value="${code}">${code} · ${data.name}</option>`)
    .join("");

  fromEl.innerHTML = options;
  toEl.innerHTML = options;

  fromEl.value = "GBP";
  toEl.value = "USD";
}

function updateEnhancedConverter() {
  const amountEl = document.querySelector("[data-currency-amount]");
  const fromEl = document.querySelector("[data-currency-from]");
  const toEl = document.querySelector("[data-currency-to]");
  const resultEl = document.querySelector("[data-currency-result]");
  const rateEl = document.querySelector("[data-currency-rate]");
  const updatedEl = document.querySelector("[data-currency-updated]");
  const flagFrom = document.querySelector("[data-currency-flag-from]");
  const flagTo = document.querySelector("[data-currency-flag-to]");

  if (!amountEl || !fromEl || !toEl) return;
  const amount = Number(amountEl.value) || 0;
  const from = fromEl.value || "GBP";
  const to = toEl.value || "USD";

  if (flagFrom) flagFrom.textContent = CURRENCIES[from]?.flag || from;
  if (flagTo) flagTo.textContent = CURRENCIES[to]?.flag || to;

  const rate = getFxRate(from, to);
  if (!rate) {
    if (resultEl) resultEl.textContent = "--";
    if (rateEl) rateEl.textContent = "Rates unavailable";
    if (updatedEl) updatedEl.textContent = "Rates updated: --";
    return;
  }

  const result = amount * rate;
  if (resultEl) resultEl.textContent = formatCurrency(result, to, 2);
  if (rateEl) rateEl.textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
  if (updatedEl) updatedEl.textContent = `Rates updated: ${formatTimestamp(fxLastUpdated)}`;

  updateQuickConversions(from, to, rate);
  updateComparisonTable(amount, from);
}

function updateQuickConversions(from, to, rate) {
  const container = document.querySelector("[data-currency-quick]");
  if (!container || !rate) return;
  const amounts = [100, 500, 1000, 5000, 10000];

  container.innerHTML = amounts
    .map((amount) => {
      const converted = amount * rate;
      return `
        <div class="quick-card">
          <p>${formatCurrency(amount, from, 0)}</p>
          <span>${formatCurrency(converted, to, 0)}</span>
        </div>
      `;
    })
    .join("");
}

function updateComparisonTable(amount, from) {
  const container = document.querySelector("[data-currency-compare]");
  if (!container || !fxRates) return;

  const rows = Object.keys(CURRENCIES)
    .filter((code) => code !== from)
    .map((code) => {
      const rate = getFxRate(from, code);
      const converted = rate ? amount * rate : 0;
      const flag = CURRENCIES[code]?.flag || code;
      const name = CURRENCIES[code]?.name || code;
      return `
        <div class="comparison-row">
          <div class="comparison-meta">
            <span class="flag-pill small">${flag}</span>
            <div>
              <p>${code}</p>
              <span>${name}</span>
            </div>
          </div>
          <p class="comparison-value">${formatCurrency(converted, code, 2)}</p>
        </div>
      `;
    })
    .join("");

  container.innerHTML = rows;
}

function initEnhancedConverter() {
  const amountEl = document.querySelector("[data-currency-amount]");
  const fromEl = document.querySelector("[data-currency-from]");
  const toEl = document.querySelector("[data-currency-to]");
  const swapBtn = document.querySelector("[data-currency-swap]");

  if (!amountEl || !fromEl || !toEl) return;

  populateCurrencyDropdowns();
  updateEnhancedConverter();

  amountEl.addEventListener("input", updateEnhancedConverter);
  fromEl.addEventListener("change", updateEnhancedConverter);
  toEl.addEventListener("change", updateEnhancedConverter);

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const temp = fromEl.value;
      fromEl.value = toEl.value;
      toEl.value = temp;
      swapBtn.classList.add("is-rotating");
      setTimeout(() => swapBtn.classList.remove("is-rotating"), 500);
      updateEnhancedConverter();
    });
  }
}
