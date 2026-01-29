// PHASE 2: SPENDING FORECAST
// ============================================================

function calculateSpendingForecast() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const daysRemaining = daysInMonth - currentDay;

  // Current month's spending from transactions
  const transactions = loadTransactions();
  const monthTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getMonth() === now.getMonth() &&
           txnDate.getFullYear() === now.getFullYear() &&
           t.type === "expense";
  });

  const spentSoFar = monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Average daily spending
  const dailyAverage = currentDay > 0 ? spentSoFar / currentDay : 0;

  // Projected remaining spending
  const projectedRemaining = dailyAverage * daysRemaining;

  // Get upcoming bills
  const bills = loadBills();
  const upcomingBills = bills
    .filter(b => !b.isPaid && b.dueDay > currentDay && b.dueDay <= daysInMonth)
    .reduce((sum, b) => sum + (b.amount || 0), 0);

  // Total expected spending
  const expectedSpending = projectedRemaining + upcomingBills;

  // Monthly income
  const sources = loadIncomeSources();
  const primaryIncome = state.income || 0;
  const otherIncome = sources.reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
  const totalIncome = primaryIncome + otherIncome;

  // Budget expenses (fixed monthly)
  const budgetExpenses = Object.values(state.expenses).reduce((sum, val) => sum + (val || 0), 0);

  // Projected balance
  const projectedBalance = totalIncome - budgetExpenses - spentSoFar - projectedRemaining;

  return {
    daysRemaining,
    spentSoFar,
    dailyAverage,
    projectedRemaining,
    upcomingBills,
    expectedSpending,
    totalIncome,
    budgetExpenses,
    projectedBalance
  };
}

function getPaydayStatus(forecast) {
  // Assume payday is on the last day of the month or 25th
  const projectedBalance = forecast.projectedBalance;

  if (projectedBalance > 200) {
    return { status: "positive", text: `Yes, with ${formatCurrency(projectedBalance)} to spare` };
  } else if (projectedBalance > 0) {
    return { status: "warning", text: `Yes, but only ${formatCurrency(projectedBalance)} buffer` };
  } else {
    return { status: "negative", text: `Risk of shortfall by ${formatCurrency(Math.abs(projectedBalance))}` };
  }
}

function renderForecastChart(forecast) {
  const container = document.querySelector("[data-forecast-chart]");
  if (!container) return;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();

  // Generate daily balance projection
  const width = 600;
  const height = 180;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const startBalance = forecast.totalIncome - forecast.budgetExpenses;
  const dailySpend = forecast.dailyAverage;

  const points = [];
  let balance = startBalance;

  for (let day = 1; day <= daysInMonth; day++) {
    if (day <= currentDay) {
      // Actual (calculated backwards from spent so far)
      balance = startBalance - (forecast.spentSoFar * (day / currentDay));
    } else {
      // Projected
      balance = startBalance - forecast.spentSoFar - (dailySpend * (day - currentDay));
    }
    points.push({ day, balance, isProjected: day > currentDay });
  }

  const maxBalance = Math.max(...points.map(p => p.balance), 0);
  const minBalance = Math.min(...points.map(p => p.balance), 0);
  const range = maxBalance - minBalance || 1;

  const xScale = (day) => padding + ((day - 1) / (daysInMonth - 1)) * chartWidth;
  const yScale = (val) => height - padding - ((val - minBalance) / range) * chartHeight;

  // Create paths
  let actualPath = `M ${xScale(1)} ${yScale(points[0].balance)}`;
  let projectedPath = "";

  points.forEach((point, i) => {
    if (!point.isProjected) {
      actualPath += ` L ${xScale(point.day)} ${yScale(point.balance)}`;
    } else if (i > 0 && !points[i - 1].isProjected) {
      projectedPath = `M ${xScale(points[i - 1].day)} ${yScale(points[i - 1].balance)}`;
      projectedPath += ` L ${xScale(point.day)} ${yScale(point.balance)}`;
    } else {
      projectedPath += ` L ${xScale(point.day)} ${yScale(point.balance)}`;
    }
  });

  // Zero line
  const zeroY = yScale(0);

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}">
      <!-- Grid -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>

      <!-- Actual spending line -->
      <path d="${actualPath}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"/>

      <!-- Projected line -->
      <path d="${projectedPath}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-dasharray="6,4" stroke-linecap="round" opacity="0.6"/>

      <!-- Today marker -->
      <line x1="${xScale(currentDay)}" y1="${padding}" x2="${xScale(currentDay)}" y2="${height - padding}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${xScale(currentDay)}" y="${padding - 8}" font-size="11" fill="var(--muted)" text-anchor="middle">Today</text>

      <!-- Labels -->
      <text x="${padding}" y="${height - 10}" font-size="11" fill="var(--muted)">1</text>
      <text x="${width - padding}" y="${height - 10}" font-size="11" fill="var(--muted)" text-anchor="end">${daysInMonth}</text>
      <text x="${padding - 5}" y="${yScale(maxBalance) + 4}" font-size="11" fill="var(--muted)" text-anchor="end">${formatCurrency(maxBalance)}</text>
      <text x="${padding - 5}" y="${zeroY + 4}" font-size="11" fill="var(--muted)" text-anchor="end">£0</text>
    </svg>
  `;
}

function updateForecastUI() {
  const forecast = calculateSpendingForecast();

  // Projected balance
  const balanceEl = document.querySelector("[data-forecast-balance]");
  if (balanceEl) {
    balanceEl.textContent = formatCurrency(forecast.projectedBalance);
    balanceEl.className = "forecast-value";
    if (forecast.projectedBalance > 0) balanceEl.classList.add("positive");
    else if (forecast.projectedBalance < -100) balanceEl.classList.add("negative");
    else balanceEl.classList.add("warning");
  }

  // Forecast indicator
  const indicatorEl = document.querySelector("[data-forecast-indicator]");
  if (indicatorEl) {
    let status, icon, text;
    if (forecast.projectedBalance > 200) {
      status = "positive";
      icon = "✓";
      text = "You're on track for a surplus";
    } else if (forecast.projectedBalance > 0) {
      status = "warning";
      icon = "⚠";
      text = "Tight but manageable";
    } else {
      status = "negative";
      icon = "⚠";
      text = "Projected shortfall this month";
    }
    indicatorEl.className = `forecast-indicator ${status}`;
    indicatorEl.innerHTML = `
      <span class="indicator-icon">${icon}</span>
      <span class="indicator-text">${text}</span>
    `;
  }

  // Breakdown values
  const daysEl = document.querySelector("[data-days-remaining]");
  const spendingEl = document.querySelector("[data-expected-spending]");
  const billsEl = document.querySelector("[data-upcoming-bills]");

  if (daysEl) daysEl.textContent = forecast.daysRemaining;
  if (spendingEl) spendingEl.textContent = formatCurrency(forecast.projectedRemaining);
  if (billsEl) billsEl.textContent = formatCurrency(forecast.upcomingBills);

  // Payday check
  const paydayAnswer = document.querySelector("[data-payday-answer]");
  if (paydayAnswer) {
    const payday = getPaydayStatus(forecast);
    paydayAnswer.className = `payday-answer ${payday.status}`;
    paydayAnswer.innerHTML = `
      <span class="answer-icon">${payday.status === "positive" ? "✓" : payday.status === "warning" ? "⚠" : "✗"}</span>
      <span class="answer-text">${payday.text}</span>
    `;
  }

  // Chart
  renderForecastChart(forecast);
}

function initSpendingForecast() {
  updateForecastUI();
}

// Expose forecast functions globally for cross-module access
Object.assign(window, {
  initSpendingForecast,
});

// ============================================================
