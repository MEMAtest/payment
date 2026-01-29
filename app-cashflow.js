// Cash flow chart
function buildCashflowData(months, scenario) {
  const preset = cashflowPresets[scenario] || cashflowPresets.baseline;
  const incomeAdj = scenario === "custom" ? state.cashflowIncomeChange : preset.incomeChange;
  const expenseAdj = scenario === "custom" ? state.cashflowExpenseChange : preset.expenseChange;

  const snapshot = getFinanceSnapshot();
  const baseIncome = snapshot.income;
  const baseExpense = snapshot.expenses;
  const startBalance = snapshot.savings;

  const data = [];
  let balance = startBalance;

  for (let i = 0; i < months; i++) {
    const seasonality = 1 + Math.sin((i / 12) * Math.PI * 2) * 0.03;
    const income = Math.round(baseIncome * (1 + incomeAdj / 100) * seasonality);
    let expense = Math.round(baseExpense * (1 + expenseAdj / 100));

    if (preset.shock && i >= 3 && i <= 5) {
      expense = Math.round(expense * 1.25);
    }

    const net = income - expense;
    balance += net;

    const date = new Date();
    date.setMonth(date.getMonth() + i);

    data.push({
      month: date.toLocaleDateString("en-GB", { month: "short" }),
      income,
      expense,
      net,
      balance,
    });
  }

  return data;
}

function renderCashflowChart(data) {
  const container = document.querySelector("[data-cashflow-chart]");
  if (!container) return;

  const { width, height, padding } = CASHFLOW_CHART;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const balances = data.map((d) => d.balance);
  const nets = data.map((d) => d.net);
  const maxBalance = Math.max(...balances, 0);
  const minBalance = Math.min(...balances, 0);
  const maxNet = Math.max(...nets.map(Math.abs), 1);
  const balanceRange = Math.max(maxBalance - minBalance, 1);

  const barWidth = Math.max(8, (chartWidth / data.length) * 0.5);
  const gap = (chartWidth - barWidth * data.length) / (data.length - 1 || 1);

  const scaleY = (val) => padding + chartHeight - ((val - minBalance) / balanceRange) * chartHeight;
  const scaleNetY = (val) => (Math.abs(val) / maxNet) * (chartHeight * 0.3);
  const zeroY = scaleY(0);

  // Build balance line path
  const linePath = data
    .map((d, i) => {
      const x = padding + i * (barWidth + gap) + barWidth / 2;
      const y = scaleY(d.balance);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Build area path
  const firstX = padding + barWidth / 2;
  const lastX = padding + (data.length - 1) * (barWidth + gap) + barWidth / 2;
  const areaPath = `${linePath} L ${lastX} ${height - padding} L ${firstX} ${height - padding} Z`;

  // Build bars
  const bars = data
    .map((d, i) => {
      const x = padding + i * (barWidth + gap);
      const barHeight = scaleNetY(d.net);
      const y = d.net >= 0 ? zeroY - barHeight : zeroY;
      const cls = d.net >= 0 ? "positive" : "negative";
      return `<rect class="net-bar ${cls}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" data-index="${i}" />`;
    })
    .join("");

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75]
    .map((pct) => {
      const y = padding + chartHeight * (1 - pct);
      return `<line class="grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
    })
    .join("");

  container.innerHTML = `
    <svg class="cashflow-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      <line class="zero-line" x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" />
      <path class="balance-area" d="${areaPath}" />
      <path class="balance-line" d="${linePath}" />
      ${bars}
      <line class="focus-line" x1="0" y1="0" x2="0" y2="${height}" data-focus-line />
      <circle class="focus-dot" cx="0" cy="0" r="6" data-focus-dot />
    </svg>
    <div class="chart-tooltip" data-chart-tooltip>
      <div class="tooltip-title" data-tooltip-month></div>
      <div><strong>Balance:</strong> <span data-tooltip-balance></span></div>
      <div><strong>Income:</strong> <span data-tooltip-income></span></div>
      <div><strong>Expenses:</strong> <span data-tooltip-expense></span></div>
      <div><strong>Net:</strong> <span data-tooltip-net></span></div>
    </div>
  `;

  currentCashflowData = data;
  attachCashflowInteractions();
}

function attachCashflowInteractions() {
  const container = document.querySelector("[data-cashflow-chart]");
  if (!container || !currentCashflowData) return;

  const svg = container.querySelector("svg");
  const tooltip = container.querySelector("[data-chart-tooltip]");
  const focusLine = container.querySelector("[data-focus-line]");
  const focusDot = container.querySelector("[data-focus-dot]");

  if (!svg || !tooltip) return;

  const { width, height, padding } = CASHFLOW_CHART;
  const data = currentCashflowData;
  const chartWidth = width - padding * 2;
  const barWidth = Math.max(8, (chartWidth / data.length) * 0.5);
  const gap = (chartWidth - barWidth * data.length) / (data.length - 1 || 1);

  const balances = data.map((d) => d.balance);
  const maxBalance = Math.max(...balances, 0);
  const minBalance = Math.min(...balances, 0);
  const balanceRange = Math.max(maxBalance - minBalance, 1);
  const scaleY = (val) => padding + (height - padding * 2) - ((val - minBalance) / balanceRange) * (height - padding * 2);

  function showTooltip(index, clientX) {
    const d = data[index];
    if (!d) return;

    tooltip.querySelector("[data-tooltip-month]").textContent = d.month;
    tooltip.querySelector("[data-tooltip-balance]").textContent = formatCurrency(d.balance);
    tooltip.querySelector("[data-tooltip-income]").textContent = formatCurrency(d.income);
    tooltip.querySelector("[data-tooltip-expense]").textContent = formatCurrency(d.expense);
    tooltip.querySelector("[data-tooltip-net]").textContent = formatSignedCurrency(d.net);

    const x = padding + index * (barWidth + gap) + barWidth / 2;
    const y = scaleY(d.balance);

    if (focusLine) {
      focusLine.setAttribute("x1", x);
      focusLine.setAttribute("x2", x);
      focusLine.style.opacity = 1;
    }
    if (focusDot) {
      focusDot.setAttribute("cx", x);
      focusDot.setAttribute("cy", y);
      focusDot.style.opacity = 1;
    }

    const rect = container.getBoundingClientRect();
    const tooltipX = (x / width) * rect.width;
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${(y / height) * rect.height}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
    if (focusLine) focusLine.style.opacity = 0;
    if (focusDot) focusDot.style.opacity = 0;
  }

  svg.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const index = Math.floor((x - padding) / (barWidth + gap));
    if (index >= 0 && index < data.length) {
      showTooltip(index, e.clientX);
    }
  });

  svg.addEventListener("mouseleave", hideTooltip);
}

function updateCashflowInsights() {
  const snapshot = getFinanceSnapshot();
  const chartEl = document.querySelector("[data-cashflow-chart]");

  if (snapshot.income === 0 && snapshot.expenses === 0) {
    if (chartEl) {
      chartEl.innerHTML = `
        <div class="chart-empty">
          <p>Enter your income and expenses to see your cash flow forecast.</p>
          <button class="btn secondary" type="button" data-goto-budget>Go to Budget</button>
        </div>
      `;
    }
    setTextAll("[data-cashflow-average]", "--");
    setTextAll("[data-cashflow-low]", "--");
    setTextAll("[data-cashflow-risk]", "--");
    return;
  }

  const data = buildCashflowData(state.cashflowMonths, state.cashflowScenario);
  renderCashflowChart(data);

  const avgNet = data.reduce((sum, d) => sum + d.net, 0) / data.length;
  const lowBalance = Math.min(...data.map((d) => d.balance));
  const riskMonths = data.filter((d) => d.balance < 0).length;

  setTextAll("[data-cashflow-average]", formatCurrency(avgNet));
  setTextAll("[data-cashflow-low]", formatCurrency(lowBalance));
  setTextAll("[data-cashflow-risk]", riskMonths);
}

// Navigate from cashflow empty state to home → budget subtab
document.addEventListener("click", (e) => {
  if (!e.target.closest("[data-goto-budget]")) return;
  document.querySelector('[data-tab-target="home"]')?.click();
  requestAnimationFrame(() => {
    const homePanel = document.querySelector('[data-tab="home"]');
    const budgetBtn = homePanel?.querySelector('[data-subtab-target="budget"]');
    if (budgetBtn) budgetBtn.click();
  });
});

// Expose cashflow functions globally for cross-module access
Object.assign(window, {
  updateCashflowInsights,
});
