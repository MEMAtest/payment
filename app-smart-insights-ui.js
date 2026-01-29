// SMART INSIGHTS ENGINE - UI + INIT
// ============================================================

// Initialize Smart Insights Panel
function initSmartInsights() {
  // Initial render
  updateSmartInsights();

  // Setup What-If calculator sliders
  const whatIfSlider = document.querySelector("[data-whatif-slider]");
  const whatIfAmount = document.querySelector("[data-whatif-amount]");
  const whatIfScenario = document.querySelector("[data-whatif-scenario]");

  if (whatIfSlider && whatIfAmount) {
    whatIfSlider.addEventListener("input", () => {
      whatIfAmount.textContent = `£${whatIfSlider.value}`;
      updateWhatIfResults();
    });
  }

  if (whatIfScenario) {
    whatIfScenario.addEventListener("change", () => {
      updateWhatIfResults();
    });
  }
}

// Update Smart Insights UI
function updateSmartInsights() {
  // Peer comparisons
  const peerInsights = calculatePeerComparison();
  const peerListEl = document.querySelector("[data-peer-insights]");

  if (peerListEl) {
    peerListEl.innerHTML = peerInsights
      .map(
        (insight) => `
      <div class="insight-card ${insight.type}">
        <div class="insight-header">
          <span class="insight-icon">${insight.icon}</span>
          <span class="insight-title">${escapeHtml(insight.title)}</span>
          ${insight.percentile ? `<span class="insight-percentile">Top ${100 - insight.percentile}%</span>` : ""}
        </div>
        <p class="insight-message">${escapeHtml(insight.message)}</p>
        ${
          insight.metric
            ? `
          <div class="insight-metrics">
            <span class="insight-metric">${escapeHtml(insight.metric)}</span>
            <span class="insight-benchmark">${escapeHtml(insight.benchmark)}</span>
          </div>
        `
            : ""
        }
      </div>
    `,
      )
      .join("");
  }

  // Spending trends
  const trends = analyzeSpendingTrends();
  const trendsListEl = document.querySelector("[data-spending-trends]");

  if (trendsListEl) {
    if (trends.length === 0) {
      trendsListEl.innerHTML =
        '<p class="no-trends">Your spending is close to UK averages across categories</p>';
    } else {
      trendsListEl.innerHTML = trends
        .map(
          (trend) => `
        <div class="trend-item ${trend.status}">
          <span class="trend-icon">${trend.icon}</span>
          <div class="trend-info">
            <span class="trend-category">${escapeHtml(trend.category)}</span>
            <span class="trend-message">${escapeHtml(trend.message)}</span>
          </div>
          <div class="trend-values">
            <span class="trend-yours">${trend.percentOfIncome.toFixed(0)}%</span>
            <span class="trend-avg">UK: ${trend.ukAverage}%</span>
          </div>
        </div>
      `,
        )
        .join("");
    }
  }

  // Subscription audit
  const subAudit = auditSubscriptions();
  const subListEl = document.querySelector("[data-subscription-audit]");
  const subTotalEl = document.querySelector("[data-subscription-total]");

  if (subListEl) {
    if (subAudit.subscriptions.length === 0) {
      subListEl.innerHTML =
        '<p class="no-subs">No subscriptions detected. Import a statement to find recurring payments.</p>';
    } else {
      subListEl.innerHTML = subAudit.subscriptions
        .slice(0, 6)
        .map(
          (sub) => `
        <div class="sub-item">
          <span class="sub-icon">${sub.icon}</span>
          <span class="sub-name">${escapeHtml(sub.name)}</span>
          <span class="sub-amount">${formatCurrency(sub.amount)}/mo</span>
        </div>
      `,
        )
        .join("");
    }
  }

  if (subTotalEl) {
    subTotalEl.innerHTML = `
      <span class="sub-total-label">Total subscriptions:</span>
      <span class="sub-total-monthly">${formatCurrency(subAudit.totalMonthly)}/mo</span>
      <span class="sub-total-annual">(${formatCurrency(subAudit.totalAnnual)}/year)</span>
    `;
  }

  // Smart tips
  const tips = generateSmartTips();
  const tipsListEl = document.querySelector("[data-smart-tips]");

  if (tipsListEl) {
    if (tips.length === 0) {
      tipsListEl.innerHTML =
        '<p class="no-tips">Add your financial details to get personalized tips</p>';
    } else {
      tipsListEl.innerHTML = tips
        .map(
          (tip) => `
        <div class="tip-card ${tip.category}">
          <span class="tip-icon">${tip.icon}</span>
          <div class="tip-content">
            <h4>${escapeHtml(tip.title)}</h4>
            <p>${escapeHtml(tip.tip)}</p>
          </div>
        </div>
      `,
        )
        .join("");
    }
  }

  // What-If calculator
  updateWhatIfResults();
}

// Expose smart insights functions globally
Object.assign(window, {
  initSmartInsights,
  updateSmartInsights,
});
