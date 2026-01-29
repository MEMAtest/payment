// Monte Carlo simulation
function randomNormal() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulatePortfolio({ start, monthly, years, mean, vol, growth }) {
  const months = years * 12;
  let value = start;
  let contribution = monthly;
  const monthlyMean = mean / 12;
  const monthlyVol = vol / Math.sqrt(12);
  const growthRate = growth / 100 / 12;

  const history = [value];

  for (let i = 0; i < months; i++) {
    const monthlyReturn = monthlyMean + randomNormal() * monthlyVol;
    value = (value + contribution) * (1 + monthlyReturn);
    contribution *= 1 + growthRate;
    history.push(value);
  }

  return { finalValue: value, history };
}

let riskProfiles = {
  cautious: { mean: 0.045, vol: 0.06 },
  balanced: { mean: 0.06, vol: 0.1 },
  growth: { mean: 0.08, vol: 0.14 },
};

let monteHasRun = false;

function percentile(arr, p) {
  const idx = (arr.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return arr[lower];
  return arr[lower] + (arr[upper] - arr[lower]) * (idx - lower);
}

function getMonteCarloDefaults() {
  const assetSavings = (state.assets?.cashSavings || 0) + (state.assets?.cashISA || 0);
  const start = state.savings > 0 ? state.savings : assetSavings;
  const monthly = Math.max(0, (state.income || 0) - calculateTotalExpenses());
  return { start, monthly };
}

function autoFillMonteCarloFromState() {
  const startEl = document.querySelector("[data-monte-start]");
  const monthlyEl = document.querySelector("[data-monte-monthly]");
  if (!startEl || !monthlyEl) return;

  const { start, monthly } = getMonteCarloDefaults();
  if (startEl.dataset.userEdited !== "true") {
    startEl.value = Math.round(start);
  }
  if (monthlyEl.dataset.userEdited !== "true") {
    monthlyEl.value = Math.round(monthly);
  }

  renderMonteCarloEmptyState();
}

function renderMonteCarloEmptyState() {
  if (monteHasRun) return;
  const outputEl = document.querySelector("[data-monte-output]");
  if (!outputEl) return;

  const { start, monthly } = getMonteCarloDefaults();
  const message = `Click "Run Simulation" to see projected outcomes. Your current savings (${formatCurrency(start)}) and surplus (${formatCurrency(monthly)}/mo) will be used as starting values.`;
  setTextAll("[data-monte-output]", message);
  setTextAll("[data-monte-sims]", "--");
  setTextAll("[data-monte-hit]", "--");
  setTextAll("[data-monte-real]", "--");
  setTextAll("[data-monte-p10]", "10th: --");
  setTextAll("[data-monte-p50]", "50th: --");
  setTextAll("[data-monte-p90]", "90th: --");

  const barsContainer = document.querySelector("[data-monte-bars]");
  if (barsContainer) barsContainer.innerHTML = "";

  const reportEl = document.querySelector("[data-monte-report]");
  if (reportEl) reportEl.style.display = "none";
}

function updateMonteCarlo() {
  monteHasRun = true;
  const startEl = document.querySelector("[data-monte-start]");
  const monthlyEl = document.querySelector("[data-monte-monthly]");
  const growthEl = document.querySelector("[data-monte-growth]");
  const yearsEl = document.querySelector("[data-monte-years]");
  const riskEl = document.querySelector("[data-monte-risk]");
  const returnEl = document.querySelector("[data-monte-return]");
  const volEl = document.querySelector("[data-monte-vol]");
  const inflationEl = document.querySelector("[data-monte-inflation]");
  const feeEl = document.querySelector("[data-monte-fee]");
  const targetEl = document.querySelector("[data-monte-target]");
  const runsEl = document.querySelector("[data-monte-runs]");

  const start = Number(startEl?.value) || 2500;
  const monthly = Number(monthlyEl?.value) || 350;
  const growth = Number(growthEl?.value) || 2;
  const years = Number(yearsEl?.value) || 20;
  const risk = riskEl?.value || "balanced";
  const inflation = Number(inflationEl?.value) || 2.5;
  const fee = Number(feeEl?.value) || 0.6;
  const target = Number(targetEl?.value) || 100000;
  const runs = Math.min(Math.max(Number(runsEl?.value) || 500, 100), 5000);

  let mean, vol;
  if (risk === "custom") {
    mean = (Number(returnEl?.value) || 6) / 100;
    vol = (Number(volEl?.value) || 10) / 100;
  } else {
    const profile = riskProfiles[risk] || riskProfiles.balanced;
    mean = profile.mean;
    vol = profile.vol;
    if (returnEl) returnEl.value = (mean * 100).toFixed(1);
    if (volEl) volEl.value = (vol * 100).toFixed(1);
  }

  const realMean = mean - inflation / 100 - fee / 100;

  const results = [];
  let hits = 0;

  for (let i = 0; i < runs; i++) {
    const { finalValue } = simulatePortfolio({
      start,
      monthly,
      years,
      mean: realMean,
      vol,
      growth,
    });
    results.push(finalValue);
    if (finalValue >= target) hits++;
  }

  results.sort((a, b) => a - b);

  const low = percentile(results, 0.1);
  const mid = percentile(results, 0.5);
  const high = percentile(results, 0.9);
  const hitRate = Math.round((hits / runs) * 100);

  setTextAll("[data-monte-output]", `Projected range: ${formatCurrency(low)} - ${formatCurrency(high)}`);
  setTextAll("[data-monte-sims]", runs);
  setTextAll("[data-monte-hit]", `${hitRate}%`);
  setTextAll("[data-monte-real]", `${(realMean * 100).toFixed(1)}%`);
  setTextAll("[data-monte-p10]", `10th: ${formatCurrency(low)}`);
  setTextAll("[data-monte-p50]", `50th: ${formatCurrency(mid)}`);
  setTextAll("[data-monte-p90]", `90th: ${formatCurrency(high)}`);

  // Histogram
  const buckets = 12;
  const min = results[0];
  const max = results[results.length - 1];
  const bucketSize = (max - min) / buckets;
  const counts = new Array(buckets).fill(0);

  results.forEach((r) => {
    const idx = Math.min(Math.floor((r - min) / bucketSize), buckets - 1);
    counts[idx]++;
  });

  const maxCount = Math.max(...counts, 1);
  const barsContainer = document.querySelector("[data-monte-bars]");
  if (barsContainer) {
    barsContainer.innerHTML = counts
      .map((count, i) => {
        const h = (count / maxCount) * 100;
        const rangeStart = formatCurrency(min + i * bucketSize);
        const rangeEnd = formatCurrency(min + (i + 1) * bucketSize);
        return `<div class="bar" style="--h: ${h}" data-range="${rangeStart} - ${rangeEnd}" data-count="${count}"></div>`;
      })
      .join("");

    // Add tooltips
    barsContainer.querySelectorAll(".bar").forEach((bar) => {
      bar.addEventListener("mouseenter", (e) => {
        const tooltip = document.querySelector(".monte-tooltip") || createMonteTooltip();
        tooltip.textContent = `${bar.dataset.range}: ${bar.dataset.count} runs`;
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 40}px`;
        tooltip.classList.add("is-visible");
      });
      bar.addEventListener("mouseleave", () => {
        const tooltip = document.querySelector(".monte-tooltip");
        if (tooltip) tooltip.classList.remove("is-visible");
      });
    });
  }

  // Generate report
  generateMonteCarloReport({ start, monthly, growth, years, mean, vol, realMean, target, runs, low, mid, high, hitRate, results });
}

function createMonteTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "monte-tooltip";
  document.querySelector(".monte-panel")?.appendChild(tooltip);
  return tooltip;
}

function generateMonteCarloReport(params) {
  const reportEl = document.querySelector("[data-monte-report]");
  const contentEl = document.querySelector("[data-report-content]");
  if (!reportEl || !contentEl) return;

  const { start, monthly, growth, years, mean, realMean, target, runs, low, mid, high, hitRate, results } = params;

  const totalContributions = start + monthly * 12 * years * (1 + (growth / 100 / 2) * years);
  const medianGrowth = mid - totalContributions;
  const shortfallRisk = results.filter((r) => r < target * 0.5).length / runs;

  const report = `
    <p><strong>Simulation Summary</strong></p>
    <p>Based on ${runs.toLocaleString()} Monte Carlo simulations over ${years} years:</p>
    <ul>
      <li><strong>Starting investment:</strong> ${formatCurrency(start)}</li>
      <li><strong>Monthly contribution:</strong> ${formatCurrency(monthly)} (growing ${growth}% annually)</li>
      <li><strong>Expected real return:</strong> ${(realMean * 100).toFixed(1)}% per year</li>
      <li><strong>Target value:</strong> ${formatCurrency(target)}</li>
    </ul>
    <p><strong>Projected Outcomes</strong></p>
    <ul>
      <li><strong>10th percentile (worst case):</strong> ${formatCurrency(low)}</li>
      <li><strong>50th percentile (median):</strong> ${formatCurrency(mid)}</li>
      <li><strong>90th percentile (best case):</strong> ${formatCurrency(high)}</li>
    </ul>
    <p><strong>Key Insights</strong></p>
    <ul>
      <li>There is a <strong>${hitRate}%</strong> probability of reaching your ${formatCurrency(target)} target.</li>
      <li>Your total contributions would be approximately ${formatCurrency(totalContributions)}.</li>
      <li>Median investment growth: ${formatCurrency(medianGrowth)} (${((medianGrowth / totalContributions) * 100).toFixed(0)}% return on contributions).</li>
      <li>Risk of significant shortfall (below 50% of target): ${(shortfallRisk * 100).toFixed(1)}%</li>
    </ul>
    <p><strong>Recommendation</strong></p>
    <p>${hitRate >= 75 ? "Your plan is on track. Consider maintaining your current strategy." : hitRate >= 50 ? "Moderate success probability. Consider increasing contributions or extending your timeline." : "Lower probability of reaching target. Review your risk profile, increase contributions, or adjust your goal."}</p>
  `;

  contentEl.innerHTML = report;
  reportEl.style.display = "block";
}

// Simulator wizard
let simulatorStep = 1;

function initSimulatorWizard() {
  const simulatorPanel = document.querySelector('[data-tab="simulator"]');
  if (!simulatorPanel) return;

  const stepButtons = Array.from(document.querySelectorAll("[data-sim-step]"));
  const panels = Array.from(document.querySelectorAll("[data-sim-panel]"));
  const progress = document.querySelector("[data-sim-progress]");
  const nextButtons = Array.from(document.querySelectorAll("[data-sim-next]")).filter(
    (btn) => !btn.hasAttribute("data-sim-run")
  );
  const backButtons = Array.from(document.querySelectorAll("[data-sim-back]"));
  const runButtons = Array.from(document.querySelectorAll("[data-sim-run]"));

  const yearsInput = document.querySelector("[data-sim-years]");
  const yearsValue = document.querySelector("[data-sim-years-value]");
  const runsInput = document.querySelector("[data-sim-runs-input]");
  const riskInputs = Array.from(document.querySelectorAll("[data-sim-risk]"));
  const returnInput = document.querySelector("[data-sim-return]");
  const volInput = document.querySelector("[data-sim-vol]");

  function setSimulatorStep(step) {
    simulatorStep = Math.min(Math.max(step, 1), 4);
    stepButtons.forEach((btn) => {
      btn.classList.toggle("is-active", Number(btn.dataset.simStep) === simulatorStep);
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", Number(panel.dataset.simPanel) === simulatorStep);
    });
    if (progress) {
      progress.style.width = `${((simulatorStep - 1) / 3) * 100}%`;
    }
  }

  function updateYearsLabel() {
    const years = Math.min(Math.max(Number(yearsInput?.value) || 20, 5), 40);
    if (yearsValue) yearsValue.textContent = `${years} years`;
    setTextAll("[data-sim-years-label]", `${years} yrs`);
  }

  function updateRunsLabel() {
    const runs = Math.min(Math.max(Number(runsInput?.value) || 500, 250), 10000);
    if (runsInput) runsInput.value = runs;
    setTextAll("[data-sim-runs]", runs);
  }

  function updateRiskUI() {
    const selected = document.querySelector("[data-sim-risk]:checked")?.value || "balanced";
    const isCustom = selected === "custom";
    if (returnInput) returnInput.disabled = !isCustom;
    if (volInput) volInput.disabled = !isCustom;

    document.querySelectorAll("[data-sim-risk-card]").forEach((card) => {
      const input = card.querySelector("[data-sim-risk]");
      card.classList.toggle("is-active", input?.checked);
    });
  }

  stepButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setSimulatorStep(Number(btn.dataset.simStep) || 1);
    });
  });

  nextButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = simulatorStep + 1;
      setSimulatorStep(next);
    });
  });

  backButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setSimulatorStep(simulatorStep - 1);
    });
  });

  runButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      runEnhancedSimulation();
      setSimulatorStep(4);
    });
  });

  if (yearsInput) {
    yearsInput.addEventListener("input", updateYearsLabel);
  }
  if (runsInput) {
    runsInput.addEventListener("input", updateRunsLabel);
  }
  riskInputs.forEach((input) => {
    input.addEventListener("change", updateRiskUI);
  });

  updateYearsLabel();
  updateRunsLabel();
  updateRiskUI();
  setSimulatorStep(1);
}

function runEnhancedSimulation() {
  const start = Number(document.querySelector("[data-sim-start]")?.value) || 2500;
  const monthly = Number(document.querySelector("[data-sim-monthly]")?.value) || 350;
  const growth = Number(document.querySelector("[data-sim-growth]")?.value) || 2;
  const years = Math.min(Math.max(Number(document.querySelector("[data-sim-years]")?.value) || 20, 5), 40);
  const target = Number(document.querySelector("[data-sim-target]")?.value) || 100000;
  const inflation = Number(document.querySelector("[data-sim-inflation]")?.value) || 2.5;
  const fee = Number(document.querySelector("[data-sim-fee]")?.value) || 0.6;
  const runs = Math.min(
    Math.max(Number(document.querySelector("[data-sim-runs-input]")?.value) || 500, 250),
    10000
  );

  setTextAll("[data-sim-years-label]", `${years} yrs`);
  setTextAll("[data-sim-runs]", runs);

  const risk = document.querySelector("[data-sim-risk]:checked")?.value || "balanced";
  const returnEl = document.querySelector("[data-sim-return]");
  const volEl = document.querySelector("[data-sim-vol]");

  let mean;
  let vol;
  if (risk === "custom") {
    mean = (Number(returnEl?.value) || 6) / 100;
    vol = (Number(volEl?.value) || 10) / 100;
  } else {
    const profile = riskProfiles[risk] || riskProfiles.balanced;
    mean = profile.mean;
    vol = profile.vol;
    if (returnEl) returnEl.value = (mean * 100).toFixed(1);
    if (volEl) volEl.value = (vol * 100).toFixed(1);
  }

  const realMean = mean - inflation / 100 - fee / 100;
  const results = [];
  const histories = [];
  let hits = 0;

  for (let i = 0; i < runs; i++) {
    const { finalValue, history } = simulatePortfolio({
      start,
      monthly,
      years,
      mean: realMean,
      vol,
      growth,
    });
    results.push(finalValue);
    histories.push(history);
    if (finalValue >= target) hits += 1;
  }

  results.sort((a, b) => a - b);
  const low = percentile(results, 0.1);
  const mid = percentile(results, 0.5);
  const high = percentile(results, 0.9);
  const hitRate = Math.round((hits / runs) * 100);

  setTextAll("[data-sim-p10]", formatCurrency(low));
  setTextAll("[data-sim-p50]", formatCurrency(mid));
  setTextAll("[data-sim-p90]", formatCurrency(high));
  setTextAll("[data-sim-hit]", `${hitRate}%`);

  const totalContributions = start + monthly * 12 * years * (1 + (growth / 100 / 2) * years);
  const expectedGrowth = mid - totalContributions;
  const shortfallRisk = Math.round((results.filter((r) => r < target).length / runs) * 100);

  setTextAll("[data-sim-contrib]", formatCurrency(totalContributions));
  setTextAll("[data-sim-growth]", formatSignedCurrency(expectedGrowth));
  setTextAll("[data-sim-shortfall]", `${shortfallRisk}%`);

  renderProbabilityGauge(hitRate);
  renderEnhancedHistogram(results, target);
  renderFanChart(histories, years, target);
  renderAdvice(hitRate, { low, mid, high }, target, { monthly, years });
}

function renderProbabilityGauge(hitRate) {
  const gauge = document.querySelector("[data-probability-gauge]");
  if (!gauge) return;
  const progressEl = gauge.querySelector("[data-gauge-progress]");
  const valueEl = gauge.querySelector("[data-gauge-value]");
  const clamped = Math.min(Math.max(hitRate, 0), 100);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  if (progressEl) {
    progressEl.style.strokeDasharray = `${circumference}`;
    progressEl.style.strokeDashoffset = `${circumference - (clamped / 100) * circumference}`;
  }

  gauge.classList.remove("is-good", "is-mid", "is-low");
  if (clamped >= 75) gauge.classList.add("is-good");
  else if (clamped >= 50) gauge.classList.add("is-mid");
  else gauge.classList.add("is-low");

  if (valueEl) animateNumber(valueEl, clamped, "%");
}

function renderEnhancedHistogram(results, target) {
  const container = document.querySelector("[data-sim-histogram]");
  if (!container || results.length === 0) return;

  const buckets = 16;
  const min = results[0];
  const max = results[results.length - 1];
  const spread = max - min || 1;
  const bucketSize = spread / buckets || 1;
  const counts = new Array(buckets).fill(0);

  results.forEach((value) => {
    const idx = Math.min(Math.floor((value - min) / bucketSize), buckets - 1);
    counts[idx] += 1;
  });

  const maxCount = Math.max(...counts, 1);
  const targetPos = Math.min(Math.max(((target - min) / spread) * 100, 0), 100);

  container.innerHTML = counts
    .map((count, i) => {
      const height = (count / maxCount) * 100;
      const start = min + i * bucketSize;
      const end = min + (i + 1) * bucketSize;
      const mid = (start + end) / 2;
      const status = mid >= target ? "above" : "below";
      return `<div class="sim-bar ${status}" style="--h: ${height}" data-range="${formatCurrency(
        start
      )} - ${formatCurrency(end)}" data-count="${count}"></div>`;
    })
    .join("");

  const targetLine = document.createElement("div");
  targetLine.className = "histogram-target";
  targetLine.style.left = `${targetPos}%`;
  targetLine.innerHTML = "<span>Target</span>";
  container.appendChild(targetLine);

  container.querySelectorAll(".sim-bar").forEach((bar) => {
    bar.addEventListener("mouseenter", (e) => {
      const tooltip = document.querySelector(".sim-tooltip") || createSimTooltip();
      tooltip.textContent = `${bar.dataset.range} · ${bar.dataset.count} runs`;
      tooltip.style.left = `${e.clientX}px`;
      tooltip.style.top = `${e.clientY - 40}px`;
      tooltip.classList.add("is-visible");
    });
    bar.addEventListener("mouseleave", () => {
      const tooltip = document.querySelector(".sim-tooltip");
      if (tooltip) tooltip.classList.remove("is-visible");
    });
  });
}

function createSimTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "sim-tooltip";
  document.body.appendChild(tooltip);
  return tooltip;
}

function renderFanChart(histories, years, target) {
  const svg = document.querySelector("[data-sim-fan]");
  if (!svg || histories.length === 0) return;

  const width = 700;
  const height = 240;
  const padding = 28;
  const points = [];

  for (let year = 0; year <= years; year += 1) {
    const idx = Math.min(year * 12, histories[0].length - 1);
    const values = histories.map((h) => h[idx]).sort((a, b) => a - b);
    points.push({
      year,
      p10: percentile(values, 0.1),
      p25: percentile(values, 0.25),
      p50: percentile(values, 0.5),
      p75: percentile(values, 0.75),
      p90: percentile(values, 0.9),
    });
  }

  const minValue = Math.min(0, ...points.map((p) => p.p10));
  const maxValue = Math.max(target || 0, ...points.map((p) => p.p90));
  const range = maxValue - minValue || 1;
  const xStep = (width - padding * 2) / years;

  const xPos = (idx) => padding + idx * xStep;
  const yPos = (value) => height - padding - ((value - minValue) / range) * (height - padding * 2);

  const buildArea = (upperKey, lowerKey) => {
    const top = points.map((p, i) => `${xPos(i)} ${yPos(p[upperKey])}`).join(" L ");
    const bottom = points
      .slice()
      .reverse()
      .map((p, i) => `${xPos(points.length - 1 - i)} ${yPos(p[lowerKey])}`)
      .join(" L ");
    return `M ${top} L ${bottom} Z`;
  };

  const buildLine = (key) =>
    points.map((p, i) => `${xPos(i)} ${yPos(p[key])}`).join(" L ");

  const yearTicks = [];
  for (let year = 0; year <= years; year += 5) {
    const x = xPos(year);
    yearTicks.push(
      `<line x1="${x}" y1="${height - padding}" x2="${x}" y2="${height - padding + 6}" class="fan-tick" />`
    );
    yearTicks.push(
      `<text x="${x}" y="${height - padding + 18}" class="fan-label">${year}y</text>`
    );
  }

  const targetY = yPos(target);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <path class="fan-band band-wide" d="${buildArea("p90", "p10")}"></path>
    <path class="fan-band band-mid" d="${buildArea("p75", "p25")}"></path>
    <path class="fan-median" d="M ${buildLine("p50")}"></path>
    ${target ? `<line class="fan-target" x1="${padding}" y1="${targetY}" x2="${width - padding}" y2="${targetY}" />` : ""}
    <line class="fan-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />
    ${yearTicks.join("")}
  `;
}

function renderAdvice(hitRate, results, target, context) {
  const card = document.querySelector("[data-sim-advice]");
  const titleEl = document.querySelector("[data-sim-advice-title]");
  const bodyEl = document.querySelector("[data-sim-advice-body]");
  if (!card || !titleEl || !bodyEl) return;

  const gap = Math.max(0, target - results.mid);
  const extraMonthly = context.years > 0 ? Math.ceil(gap / (context.years * 12)) : 0;

  card.classList.remove("advice-success", "advice-warning", "advice-alert");

  if (hitRate >= 75) {
    card.classList.add("advice-success");
    titleEl.textContent = "On track for your target";
    bodyEl.textContent = extraMonthly
      ? `You are in a strong position. Adding about ${formatCurrency(extraMonthly)} per month would build extra cushion.`
      : "You are in a strong position. Keep your current contributions steady to stay ahead.";
  } else if (hitRate >= 50) {
    card.classList.add("advice-warning");
    titleEl.textContent = "Within reach, but needs a push";
    bodyEl.textContent = extraMonthly
      ? `Consider increasing contributions by roughly ${formatCurrency(extraMonthly)} per month or extend the timeline.`
      : "Consider increasing contributions or adjusting the timeline for more certainty.";
  } else {
    card.classList.add("advice-alert");
    titleEl.textContent = "Low probability of success";
    bodyEl.textContent = extraMonthly
      ? `Boost contributions by about ${formatCurrency(extraMonthly)} per month and revisit your risk profile.`
      : "Review your risk profile, contributions, or goal target to improve success odds.";
  }
}

function animateNumber(el, target, suffix) {
  const start = 0;
  const duration = 800;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const value = Math.round(start + (target - start) * progress);
    el.textContent = `${value}${suffix}`;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
