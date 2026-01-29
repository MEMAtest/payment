// FINANCIAL HEALTH DASHBOARD - UI UPDATE
// ============================================================

// Update all Financial Health UI
function updateFinancialHealth() {
  const healthScore = calculateHealthScore();
  const totalAssets = calculateTotalAssets();
  const totalLiabilities = calculateTotalLiabilities();
  const netWorth = calculateNetWorth();
  const vulnerabilities = detectVulnerabilities();
  const roadmap = generateRoadmap(healthScore, vulnerabilities);
  const showGuidedSetup = healthScore.total === 0;
  const displayScore = showGuidedSetup ? 0 : healthScore.total;

  // Update health score hero
  const scoreEl = document.querySelector("[data-health-score]");
  const statusEl = document.querySelector("[data-health-status]");
  const ringEl = document.querySelector("[data-health-ring]");

  if (scoreEl) scoreEl.textContent = showGuidedSetup ? "--" : healthScore.total;
  if (statusEl) {
    statusEl.textContent = showGuidedSetup
      ? "Complete these to build your score: 1) Add savings (Assets tab), 2) Enter expenses (Budget tab), 3) Set up protection (Protection tab)"
      : healthScore.status;
  }

  // Update ring SVG
  if (ringEl) {
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (displayScore / 100) * circumference;
    ringEl.style.strokeDashoffset = offset;

    // Color based on score
    ringEl.classList.remove("good", "warning", "danger");
    if (displayScore >= 70) ringEl.classList.add("good");
    else if (displayScore >= 40) ringEl.classList.add("warning");
    else ringEl.classList.add("danger");
  }

  // Update pillars
  Object.entries(healthScore.pillars).forEach(([key, data]) => {
    const pillarScoreEl = document.querySelector(`[data-pillar-score="${key}"]`);
    const fillEl = document.querySelector(`[data-pillar-fill="${key}"]`);
    const tipEl = document.querySelector(`[data-pillar-tip="${key}"]`);

    const maxScores = { emergency: 25, debt: 25, savings: 20, credit: 15, protection: 15 };
    const max = maxScores[key];

    if (pillarScoreEl) pillarScoreEl.textContent = `${data.score}/${max}`;
    if (fillEl) {
      const percent = (data.score / max) * 100;
      fillEl.style.width = `${percent}%`;
      fillEl.classList.remove("warning", "danger");
      if (percent < 40) fillEl.classList.add("danger");
      else if (percent < 70) fillEl.classList.add("warning");
    }
    if (tipEl) tipEl.textContent = data.tip;
  });

  // Update net worth
  const networthTotalEl = document.querySelector("[data-networth-total]");
  const assetsTotalEl = document.querySelector("[data-assets-total]");
  const assetsTotalSmallEl = document.querySelector("[data-assets-total-small]");
  const liabilitiesTotalEl = document.querySelector("[data-liabilities-total]");
  const liabilitiesTotalSmallEl = document.querySelector("[data-liabilities-total-small]");
  const assetsFillEl = document.querySelector("[data-assets-fill]");
  const liabilitiesFillEl = document.querySelector("[data-liabilities-fill]");

  const formatLarge = (val) => {
    if (Math.abs(val) >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `£${(val / 1000).toFixed(0)}K`;
    return formatCurrency(val);
  };

  if (networthTotalEl) {
    networthTotalEl.textContent = formatLarge(netWorth);
    networthTotalEl.classList.remove("positive", "negative");
    if (netWorth > 0) networthTotalEl.classList.add("positive");
    else if (netWorth < 0) networthTotalEl.classList.add("negative");
  }

  if (assetsTotalEl) assetsTotalEl.textContent = formatLarge(totalAssets);
  if (assetsTotalSmallEl) assetsTotalSmallEl.textContent = formatLarge(totalAssets);
  if (liabilitiesTotalEl) liabilitiesTotalEl.textContent = formatLarge(totalLiabilities);
  if (liabilitiesTotalSmallEl) liabilitiesTotalSmallEl.textContent = formatLarge(totalLiabilities);

  // Net worth bars - scale relative to max of assets or liabilities
  const maxBar = Math.max(totalAssets, totalLiabilities, 1);
  if (assetsFillEl) assetsFillEl.style.width = `${(totalAssets / maxBar) * 100}%`;
  if (liabilitiesFillEl) liabilitiesFillEl.style.width = `${(totalLiabilities / maxBar) * 100}%`;

  // Update credit score display
  const creditScoreDisplayEl = document.querySelector("[data-credit-score-display]");
  const creditBandEl = document.querySelector("[data-credit-band]");
  const utilizationFillEl = document.querySelector("[data-utilization-fill]");
  const utilizationPercentEl = document.querySelector("[data-utilization-percent]");

  if (creditScoreDisplayEl) {
    creditScoreDisplayEl.textContent = state.creditScore.score || "---";
  }
  if (creditBandEl) {
    const creditData = healthScore.pillars.credit;
    creditBandEl.textContent = creditData.band || "Not set";
    creditBandEl.classList.remove("excellent", "good", "fair", "poor");
    if (creditData.band === "Excellent") creditBandEl.classList.add("excellent");
    else if (creditData.band === "Good") creditBandEl.classList.add("good");
    else if (creditData.band === "Fair") creditBandEl.classList.add("fair");
    else if (creditData.band === "Poor") creditBandEl.classList.add("poor");
  }

  // Credit utilization bar
  if (state.creditScore.creditLimit > 0) {
    const utilization = (state.creditScore.creditUsed / state.creditScore.creditLimit) * 100;
    if (utilizationFillEl) {
      utilizationFillEl.style.width = `${Math.min(utilization, 100)}%`;
      utilizationFillEl.classList.remove("warning", "danger");
      if (utilization > 50) utilizationFillEl.classList.add("danger");
      else if (utilization > 30) utilizationFillEl.classList.add("warning");
    }
    if (utilizationPercentEl) utilizationPercentEl.textContent = `${utilization.toFixed(0)}%`;
  } else {
    if (utilizationFillEl) utilizationFillEl.style.width = "0%";
    if (utilizationPercentEl) utilizationPercentEl.textContent = "0%";
  }

  // Update vulnerabilities
  const vulnListEl = document.querySelector("[data-vulnerability-list]");
  if (vulnListEl) {
    if (vulnerabilities.length === 0) {
      vulnListEl.innerHTML = `
        <div class="vulnerability-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>No vulnerabilities detected. Great job!</p>
        </div>
      `;
    } else {
      vulnListEl.innerHTML = vulnerabilities
        .map((v) => {
          const severityClass = ["critical", "warning"].includes(v.severity) ? v.severity : "";
          return `
        <div class="vulnerability-item ${severityClass}">
          <span class="vulnerability-icon">${escapeHtml(v.icon)}</span>
          <div class="vulnerability-content">
            <h4>${escapeHtml(v.title)}</h4>
            <p>${escapeHtml(v.description)}</p>
            <button class="vulnerability-action" type="button">
              ${escapeHtml(v.action)}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      `;
        })
        .join("");
    }
  }

  // Update roadmap
  const roadmapListEl = document.querySelector("[data-roadmap-list]");
  if (roadmapListEl) {
    if (roadmap.length === 0) {
      roadmapListEl.innerHTML = `
        <div class="roadmap-empty">
          <p>Complete your profile to get personalized recommendations</p>
        </div>
      `;
    } else {
      roadmapListEl.innerHTML = roadmap
        .map(
          (item) => `
        <div class="roadmap-item ${item.completed ? "completed" : ""}">
          <div class="roadmap-step">${escapeHtml(String(item.step))}</div>
          <div class="roadmap-content">
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.description)}</p>
          </div>
          <div class="roadmap-impact">
            <span class="impact-label">Impact</span>
            <span class="impact-value">${escapeHtml(item.impact)}</span>
          </div>
        </div>
      `,
        )
        .join("");
    }
  }
}
