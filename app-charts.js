// VISUAL CHARTS & DASHBOARDS
// ============================================================

// Spending breakdown by category
function getSpendingBreakdown() {
  const categories = [
    { key: "housing", label: "Housing", color: "#1a365d", fields: ["mortgage", "councilTax", "homeInsurance"] },
    { key: "transport", label: "Transport", color: "#2b6cb0", fields: ["carPayment", "carInsurance", "fuel", "publicTransport"] },
    { key: "food", label: "Food & Dining", color: "#259d91", fields: ["groceries", "diningOut", "coffeeSnacks"] },
    { key: "utilities", label: "Utilities", color: "#48bb78", fields: ["energy", "water", "internet"] },
    { key: "family", label: "Family", color: "#ed8936", fields: ["childcare", "kidsActivities", "schoolCosts", "kidsClothing"] },
    { key: "lifestyle", label: "Lifestyle", color: "#9f7aea", fields: ["gym", "clothing", "personalCare", "entertainment", "streaming", "subscriptions"] },
    { key: "debt", label: "Debt Payments", color: "#e53e3e", fields: ["creditCards", "personalLoans", "otherDebt"] },
  ];

  const breakdown = [];
  let total = 0;

  categories.forEach(cat => {
    const amount = cat.fields.reduce((sum, f) => sum + (state.expenses[f] || 0), 0);
    if (amount > 0) {
      breakdown.push({
        ...cat,
        amount,
        percentage: 0 // Will calculate after we have total
      });
      total += amount;
    }
  });

  // Calculate percentages
  breakdown.forEach(item => {
    item.percentage = total > 0 ? (item.amount / total) * 100 : 0;
  });

  return { breakdown, total };
}

// Render spending donut chart
function renderSpendingDonut(container) {
  const { breakdown, total } = getSpendingBreakdown();

  if (breakdown.length === 0 || total === 0) {
    container.innerHTML = `<p class="chart-empty">Add your expenses to see breakdown</p>`;
    return;
  }

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const innerRadius = 50;

  let currentAngle = -90; // Start from top

  const paths = breakdown.map(item => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const d = [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
      'Z'
    ].join(' ');

    return { ...item, d };
  });

  container.innerHTML = `
    <div class="donut-chart-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart-svg">
        ${paths.map(p => `
          <path d="${p.d}" fill="${p.color}" class="donut-segment">
            <title>${escapeHtml(p.label)}: ${formatCurrency(p.amount)} (${p.percentage.toFixed(0)}%)</title>
          </path>
        `).join('')}
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="donut-total-label">Total</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="donut-total-value">${formatCurrency(total)}</text>
      </svg>
      <div class="donut-legend">
        ${breakdown.slice(0, 5).map(item => `
          <div class="legend-item">
            <span class="legend-color" style="background: ${item.color}"></span>
            <span class="legend-label">${escapeHtml(item.label)}</span>
            <span class="legend-value">${item.percentage.toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Convert polar to cartesian coordinates
function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

// Get asset allocation breakdown
function getAssetAllocation() {
  const categories = [
    { key: "cash", label: "Cash & Savings", color: "#259d91", amount: (state.assets.cashSavings || 0) + (state.assets.cashISA || 0) },
    { key: "investments", label: "Investments", color: "#2b6cb0", amount: (state.assets.stocksISA || 0) + (state.assets.generalInvestments || 0) + (state.assets.crypto || 0) },
    { key: "pension", label: "Pension", color: "#9f7aea", amount: state.assets.pensionValue || 0 },
    { key: "property", label: "Property", color: "#ed8936", amount: (state.assets.propertyValue || 0) + (state.assets.otherPropertyValue || 0) },
    { key: "other", label: "Other", color: "#718096", amount: (state.assets.vehicleValue || 0) + (state.assets.otherAssets || 0) },
  ];

  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const allocation = categories
    .filter(c => c.amount > 0)
    .map(c => ({
      ...c,
      percentage: total > 0 ? (c.amount / total) * 100 : 0
    }));

  return { allocation, total };
}

// Render asset allocation pie chart
function renderAssetAllocation(container) {
  const { allocation, total } = getAssetAllocation();

  if (allocation.length === 0 || total === 0) {
    container.innerHTML = `<p class="chart-empty">Add your assets to see allocation</p>`;
    return;
  }

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 70;

  let currentAngle = -90;

  const paths = allocation.map(item => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // For full circle (single item), draw a circle instead
    if (angle >= 359.99) {
      return {
        ...item,
        d: `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
      };
    }

    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = angle > 180 ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z'
    ].join(' ');

    return { ...item, d };
  });

  container.innerHTML = `
    <div class="pie-chart-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="pie-chart-svg">
        ${paths.map(p => `
          <path d="${p.d}" fill="${p.color}" class="pie-segment">
            <title>${escapeHtml(p.label)}: ${formatCurrency(p.amount)} (${p.percentage.toFixed(0)}%)</title>
          </path>
        `).join('')}
      </svg>
      <div class="pie-legend">
        ${allocation.map(item => `
          <div class="legend-item">
            <span class="legend-color" style="background: ${item.color}"></span>
            <span class="legend-label">${escapeHtml(item.label)}</span>
            <span class="legend-pct">${item.percentage.toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render emergency fund runway gauge
function renderEmergencyGauge(container) {
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthlyExpenses = calculateMonthlyExpenses();
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  const maxMonths = 12;
  const percentage = Math.min(100, (monthsCovered / maxMonths) * 100);

  let status = "critical";
  let statusText = "Build emergency fund";
  if (monthsCovered >= 6) {
    status = "excellent";
    statusText = "Excellent buffer";
  } else if (monthsCovered >= 3) {
    status = "good";
    statusText = "Good buffer";
  } else if (monthsCovered >= 1) {
    status = "fair";
    statusText = "Building up";
  }

  const colors = {
    critical: "#e53e3e",
    fair: "#ed8936",
    good: "#48bb78",
    excellent: "#259d91"
  };

  container.innerHTML = `
    <div class="gauge-wrap">
      <div class="gauge-visual">
        <svg width="140" height="80" viewBox="0 0 140 80">
          <!-- Background arc -->
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round"/>
          <!-- Filled arc -->
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="${colors[status]}" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="${percentage * 1.88} 188" class="gauge-fill"/>
          <!-- Target markers -->
          <line x1="50" y1="25" x2="50" y2="35" stroke="#718096" stroke-width="2"/>
          <text x="50" y="20" text-anchor="middle" class="gauge-marker">3mo</text>
          <line x1="90" y1="25" x2="90" y2="35" stroke="#718096" stroke-width="2"/>
          <text x="90" y="20" text-anchor="middle" class="gauge-marker">6mo</text>
        </svg>
        <div class="gauge-value-wrap">
          <span class="gauge-value" style="color: ${colors[status]}">${monthsCovered.toFixed(1)}</span>
          <span class="gauge-unit">months</span>
        </div>
      </div>
      <div class="gauge-info">
        <span class="gauge-status ${status}">${statusText}</span>
        <span class="gauge-detail">${formatCurrency(liquidAssets)} in accessible savings</span>
      </div>
    </div>
  `;
}

// Render income vs expenses comparison
function renderIncomeVsExpenses(container) {
  const income = state.income || 0;
  const expenses = calculateMonthlyExpenses();
  const surplus = income - expenses;
  const maxValue = Math.max(income, expenses, 1);

  const incomePercent = (income / maxValue) * 100;
  const expensesPercent = (expenses / maxValue) * 100;

  container.innerHTML = `
    <div class="income-expense-compare">
      <div class="compare-bar">
        <div class="compare-label">
          <span class="compare-icon">💰</span>
          <span>Income</span>
        </div>
        <div class="compare-track">
          <div class="compare-fill income" style="width: ${incomePercent}%"></div>
        </div>
        <span class="compare-value">${formatCurrency(income)}</span>
      </div>
      <div class="compare-bar">
        <div class="compare-label">
          <span class="compare-icon">💸</span>
          <span>Expenses</span>
        </div>
        <div class="compare-track">
          <div class="compare-fill expenses" style="width: ${expensesPercent}%"></div>
        </div>
        <span class="compare-value">${formatCurrency(expenses)}</span>
      </div>
      <div class="compare-surplus ${surplus >= 0 ? 'positive' : 'negative'}">
        <span>${surplus >= 0 ? 'Monthly Surplus' : 'Monthly Deficit'}</span>
        <span class="surplus-value">${surplus >= 0 ? '+' : ''}${formatCurrency(surplus)}</span>
      </div>
    </div>
  `;
}

// Render net worth over time chart
function renderNetWorthChart(container) {
  const history = loadScoreHistory();

  if (history.length < 2) {
    container.innerHTML = `<p class="chart-empty">Track for 2+ months to see net worth trend</p>`;
    return;
  }

  const data = history.map(h => ({
    month: h.month,
    label: formatMonthLabel(h.month),
    value: h.netWorth
  }));

  const width = container.clientWidth || 300;
  const height = 150;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const xStep = chartWidth / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padding.left + (i * xStep),
    y: padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight,
    label: d.label,
    value: d.value
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Format large numbers for y-axis
  const formatAxisValue = (val) => {
    if (Math.abs(val) >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `£${(val / 1000).toFixed(0)}K`;
    return `£${val}`;
  };

  container.innerHTML = `
    <svg width="${width}" height="${height}" class="networth-chart-svg">
      <!-- Zero line if applicable -->
      ${minValue < 0 && maxValue > 0 ? `
        <line x1="${padding.left}" y1="${padding.top + chartHeight - ((0 - minValue) / range) * chartHeight}"
              x2="${width - padding.right}" y2="${padding.top + chartHeight - ((0 - minValue) / range) * chartHeight}"
              stroke="#e53e3e" stroke-width="1" stroke-dasharray="4"/>
      ` : ''}

      <!-- Area fill -->
      <path d="${areaD}" class="networth-area" />

      <!-- Line -->
      <path d="${pathD}" class="networth-line" />

      <!-- Data points -->
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" class="networth-point">
          <title>${p.label}: ${formatCurrency(p.value)}</title>
        </circle>
      `).join('')}

      <!-- Y-axis labels -->
      <text x="${padding.left - 8}" y="${padding.top + 4}" class="chart-label-y">${formatAxisValue(maxValue)}</text>
      <text x="${padding.left - 8}" y="${padding.top + chartHeight}" class="chart-label-y">${formatAxisValue(minValue)}</text>

      <!-- X-axis labels -->
      ${points.filter((_, i) => i === 0 || i === points.length - 1).map(p => `
        <text x="${p.x}" y="${height - 8}" class="chart-label-x">${escapeHtml(p.label)}</text>
      `).join('')}
    </svg>
  `;
}

// Initialize visual charts
function initVisualCharts() {
  updateVisualCharts();
}

// Update all visual charts
function updateVisualCharts() {
  const spendingDonutEl = document.querySelector("[data-spending-donut]");
  const assetPieEl = document.querySelector("[data-asset-pie]");
  const emergencyGaugeEl = document.querySelector("[data-emergency-gauge]");
  const incomeExpenseEl = document.querySelector("[data-income-expense]");
  const netWorthChartEl = document.querySelector("[data-networth-chart]");

  if (spendingDonutEl) renderSpendingDonut(spendingDonutEl);
  if (assetPieEl) renderAssetAllocation(assetPieEl);
  if (emergencyGaugeEl) renderEmergencyGauge(emergencyGaugeEl);
  if (incomeExpenseEl) renderIncomeVsExpenses(incomeExpenseEl);
  if (netWorthChartEl) renderNetWorthChart(netWorthChartEl);
}

// Expose visual charts functions globally
Object.assign(window, {
  initVisualCharts,
});

// ============================================================
