// HEALTH SCORE HISTORY & TRENDS
// ============================================================

const SCORE_HISTORY_KEY = "consumerpay_score_history";
const MAX_HISTORY_MONTHS = 24;

// Get current month key (YYYY-MM format)
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Load score history from storage
function loadScoreHistory() {
  try {
    const stored = localStorage.getItem(SCORE_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) { /* ignore */ }
  return [];
}

// Save score history to storage
function saveScoreHistory(history) {
  try {
    // Keep only last 24 months
    const trimmed = history.slice(-MAX_HISTORY_MONTHS);
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) { /* ignore */ }
}

// Take a monthly snapshot of the health score
function takeScoreSnapshot() {
  const monthKey = getCurrentMonthKey();
  const history = loadScoreHistory();

  // Check if we already have a snapshot for this month
  const existingIndex = history.findIndex(h => h.month === monthKey);

  const healthScore = calculateHealthScore();
  const snapshot = {
    month: monthKey,
    date: new Date().toISOString(),
    total: healthScore.total,
    status: healthScore.status,
    pillars: {
      emergency: healthScore.pillars.emergency.score,
      debt: healthScore.pillars.debt.score,
      savings: healthScore.pillars.savings.score,
      credit: healthScore.pillars.credit.score,
      protection: healthScore.pillars.protection.score,
    },
    netWorth: calculateNetWorth(),
    savingsRate: state.income > 0 ? ((state.income - calculateMonthlyExpenses()) / state.income * 100) : 0,
  };

  if (existingIndex >= 0) {
    // Update existing snapshot for this month
    history[existingIndex] = snapshot;
  } else {
    // Add new snapshot
    history.push(snapshot);
  }

  saveScoreHistory(history);
  return snapshot;
}

// Check if we should auto-snapshot (first visit of the month)
function checkAutoSnapshot() {
  const monthKey = getCurrentMonthKey();
  const lastSnapshotKey = localStorage.getItem("consumerpay_last_snapshot_month");

  if (lastSnapshotKey !== monthKey) {
    // First visit this month - take snapshot
    takeScoreSnapshot();
    localStorage.setItem("consumerpay_last_snapshot_month", monthKey);
  }
}

// Calculate trend for a pillar (comparing last 3 months)
function calculatePillarTrend(pillarKey) {
  const history = loadScoreHistory();
  if (history.length < 2) return { direction: "stable", change: 0 };

  const recent = history.slice(-3);
  if (recent.length < 2) return { direction: "stable", change: 0 };

  const latest = recent[recent.length - 1]?.pillars?.[pillarKey] || 0;
  const previous = recent[0]?.pillars?.[pillarKey] || 0;
  const change = latest - previous;

  if (change > 2) return { direction: "up", change };
  if (change < -2) return { direction: "down", change };
  return { direction: "stable", change };
}

// Calculate overall score trend
function calculateScoreTrend() {
  const history = loadScoreHistory();
  if (history.length < 2) return { direction: "stable", change: 0, message: "Keep tracking to see trends" };

  const recent = history.slice(-3);
  const latest = recent[recent.length - 1].total;
  const previous = recent[0].total;
  const change = latest - previous;

  let direction = "stable";
  let message = "Score is holding steady";

  if (change > 5) {
    direction = "up";
    message = `Up ${change} points from ${recent.length} months ago`;
  } else if (change < -5) {
    direction = "down";
    message = `Down ${Math.abs(change)} points - review your finances`;
  }

  return { direction, change, message };
}

// Get year-on-year comparison
function getYearOnYearComparison() {
  const history = loadScoreHistory();
  const currentMonth = getCurrentMonthKey();
  const [year, month] = currentMonth.split("-").map(Number);
  const lastYearMonth = `${year - 1}-${String(month).padStart(2, '0')}`;

  const current = history.find(h => h.month === currentMonth);
  const lastYear = history.find(h => h.month === lastYearMonth);

  if (!current || !lastYear) {
    return {
      available: false,
      message: "Keep tracking to see year-on-year comparison"
    };
  }

  const scoreDiff = current.total - lastYear.total;
  const netWorthDiff = current.netWorth - lastYear.netWorth;

  return {
    available: true,
    currentScore: current.total,
    lastYearScore: lastYear.total,
    scoreDiff,
    scoreImproved: scoreDiff > 0,
    netWorthDiff,
    message: scoreDiff > 0
      ? `Your score is ${scoreDiff} points higher than last ${getMonthName(month)}`
      : scoreDiff < 0
        ? `Your score is ${Math.abs(scoreDiff)} points lower than last ${getMonthName(month)}`
        : `Same score as last ${getMonthName(month)}`
  };
}

// Get month name
function getMonthName(monthNum) {
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return months[monthNum - 1] || "";
}

// Detect milestone achievements
function detectMilestones() {
  const history = loadScoreHistory();
  const milestones = [];

  if (history.length === 0) return milestones;

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;

  // Score threshold milestones
  const thresholds = [
    { score: 50, name: "Halfway There", icon: "🌟", message: "You've reached 50 points!" },
    { score: 70, name: "Strong Foundation", icon: "💪", message: "70+ means solid financial health" },
    { score: 85, name: "Financial Champion", icon: "🏆", message: "Top tier financial health!" },
    { score: 95, name: "Financial Master", icon: "👑", message: "Near-perfect financial health" },
  ];

  thresholds.forEach(t => {
    if (latest.total >= t.score && (!previous || previous.total < t.score)) {
      milestones.push({
        type: "score",
        ...t,
        achieved: true,
        date: latest.date
      });
    }
  });

  // Net worth milestones
  const netWorthMilestones = [
    { amount: 10000, name: "Five Figures", icon: "💰" },
    { amount: 50000, name: "Halfway to 100K", icon: "📈" },
    { amount: 100000, name: "Six Figures", icon: "🎯" },
    { amount: 250000, name: "Quarter Million", icon: "🚀" },
    { amount: 500000, name: "Half Million", icon: "⭐" },
    { amount: 1000000, name: "Millionaire", icon: "👑" },
  ];

  netWorthMilestones.forEach(m => {
    if (latest.netWorth >= m.amount && (!previous || previous.netWorth < m.amount)) {
      milestones.push({
        type: "netWorth",
        ...m,
        message: `Net worth reached ${formatCurrency(m.amount)}!`,
        achieved: true,
        date: latest.date
      });
    }
  });

  // Streak milestones (consecutive months with score improvement)
  let streak = 0;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i].total > history[i - 1].total) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 3) {
    milestones.push({
      type: "streak",
      name: `${streak}-Month Streak`,
      icon: "🔥",
      message: `${streak} consecutive months of improvement!`,
      achieved: true,
      streak
    });
  }

  return milestones;
}

// Prepare chart data for score history
function getScoreChartData() {
  const history = loadScoreHistory();

  return history.map(h => ({
    month: h.month,
    label: formatMonthLabel(h.month),
    total: h.total,
    emergency: h.pillars.emergency,
    debt: h.pillars.debt,
    savings: h.pillars.savings,
    credit: h.pillars.credit,
    protection: h.pillars.protection,
    netWorth: h.netWorth,
  }));
}

// Format month label (e.g., "2024-01" -> "Jan 24")
function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

// Initialize Score History tracking
function initScoreHistory() {
  // Check for auto-snapshot on first visit of month
  checkAutoSnapshot();

  // Update the history display
  updateScoreHistoryUI();
}

// Update Score History UI elements
function updateScoreHistoryUI() {
  const chartData = getScoreChartData();
  const scoreTrend = calculateScoreTrend();
  const yoyComparison = getYearOnYearComparison();
  const milestones = detectMilestones();

  // Update trend indicator on health score
  const trendEl = document.querySelector("[data-score-trend]");
  if (trendEl) {
    const trendIcon = scoreTrend.direction === "up" ? "↑" :
      scoreTrend.direction === "down" ? "↓" : "→";
    const trendClass = scoreTrend.direction === "up" ? "trend-up" :
      scoreTrend.direction === "down" ? "trend-down" : "trend-stable";

    trendEl.innerHTML = `
      <span class="trend-icon ${trendClass}">${trendIcon}</span>
      <span class="trend-text">${escapeHtml(scoreTrend.message)}</span>
    `;
  }

  // Update pillar trends
  ["emergency", "debt", "savings", "credit", "protection"].forEach(pillar => {
    const trendEl = document.querySelector(`[data-pillar-trend="${pillar}"]`);
    if (trendEl) {
      const trend = calculatePillarTrend(pillar);
      const icon = trend.direction === "up" ? "↑" :
        trend.direction === "down" ? "↓" : "";
      const className = trend.direction === "up" ? "trend-up" :
        trend.direction === "down" ? "trend-down" : "";

      trendEl.textContent = icon;
      trendEl.className = `pillar-trend ${className}`;
    }
  });

  // Update YoY comparison
  const yoyEl = document.querySelector("[data-yoy-comparison]");
  if (yoyEl) {
    if (yoyComparison.available) {
      const diffClass = yoyComparison.scoreImproved ? "positive" : yoyComparison.scoreDiff < 0 ? "negative" : "";
      yoyEl.innerHTML = `
        <div class="yoy-card ${diffClass}">
          <div class="yoy-icon">${yoyComparison.scoreImproved ? "📈" : yoyComparison.scoreDiff < 0 ? "📉" : "➡️"}</div>
          <div class="yoy-content">
            <span class="yoy-label">vs Last Year</span>
            <span class="yoy-message">${escapeHtml(yoyComparison.message)}</span>
          </div>
          <div class="yoy-diff ${diffClass}">
            ${yoyComparison.scoreDiff > 0 ? "+" : ""}${yoyComparison.scoreDiff}
          </div>
        </div>
      `;
    } else {
      yoyEl.innerHTML = `<p class="yoy-pending">${escapeHtml(yoyComparison.message)}</p>`;
    }
  }

  // Update score history chart
  const chartEl = document.querySelector("[data-score-chart]");
  if (chartEl && chartData.length > 0) {
    renderScoreChart(chartEl, chartData);
  } else if (chartEl) {
    chartEl.innerHTML = `<p class="chart-empty">Score history will appear after your first month</p>`;
  }

  // Update milestones display
  const milestonesEl = document.querySelector("[data-milestones]");
  if (milestonesEl) {
    if (milestones.length > 0) {
      milestonesEl.innerHTML = milestones.map(m => `
        <div class="milestone-badge">
          <span class="milestone-icon">${m.icon}</span>
          <span class="milestone-name">${escapeHtml(m.name)}</span>
        </div>
      `).join("");
    } else {
      milestonesEl.innerHTML = "";
    }
  }
}

// Render simple SVG line chart for score history
function renderScoreChart(container, data) {
  if (data.length < 2) {
    container.innerHTML = `<p class="chart-empty">Need at least 2 months of data for chart</p>`;
    return;
  }

  const width = container.clientWidth || 300;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxScore = 100;
  const minScore = 0;
  const xStep = chartWidth / (data.length - 1);

  // Generate path points
  const points = data.map((d, i) => ({
    x: padding.left + (i * xStep),
    y: padding.top + chartHeight - ((d.total - minScore) / (maxScore - minScore)) * chartHeight,
    label: d.label,
    value: d.total
  }));

  // Create path string
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Create area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Generate y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // Generate x-axis labels (show every other if too many)
  const showEvery = data.length > 6 ? 2 : 1;

  container.innerHTML = `
    <svg width="${width}" height="${height}" class="score-chart-svg">
      <!-- Grid lines -->
      ${yLabels.map(v => {
    const y = padding.top + chartHeight - (v / 100) * chartHeight;
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid" />`;
  }).join('')}

      <!-- Y-axis labels -->
      ${yLabels.map(v => {
    const y = padding.top + chartHeight - (v / 100) * chartHeight;
    return `<text x="${padding.left - 8}" y="${y + 4}" class="chart-label-y">${v}</text>`;
  }).join('')}

      <!-- Area fill -->
      <path d="${areaD}" class="chart-area" />

      <!-- Line -->
      <path d="${pathD}" class="chart-line" />

      <!-- Data points -->
      ${points.map((p, i) => `
        <circle cx="${p.x}" cy="${p.y}" r="5" class="chart-point" />
        <title>${p.label}: ${p.value}</title>
      `).join('')}

      <!-- X-axis labels -->
      ${points.filter((_, i) => i % showEvery === 0 || i === points.length - 1).map(p => `
        <text x="${p.x}" y="${height - 8}" class="chart-label-x">${escapeHtml(p.label)}</text>
      `).join('')}
    </svg>
  `;
}

// Expose score history functions globally
Object.assign(window, {
  initScoreHistory,
});

// ============================================================
