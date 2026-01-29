// PHASE 2: SPENDING LIMITS & ALERTS
// ============================================================

const LIMITS_STORAGE_KEY = "consumerpay_limits_v1";

const LIMIT_CATEGORIES = {
  groceries: { icon: "🛒", name: "Groceries" },
  diningOut: { icon: "🍽️", name: "Dining Out" },
  coffeeSnacks: { icon: "☕", name: "Coffee/Snacks" },
  entertainment: { icon: "🎬", name: "Entertainment" },
  clothing: { icon: "👕", name: "Clothing" },
  subscriptions: { icon: "📺", name: "Subscriptions" },
  fuel: { icon: "⛽", name: "Fuel" },
  publicTransport: { icon: "🚌", name: "Transport" }
};

function loadSpendingLimits() {
  try {
    const stored = localStorage.getItem(LIMITS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
}

function saveSpendingLimits(limits) {
  localStorage.setItem(LIMITS_STORAGE_KEY, JSON.stringify(limits));
}

function getCategorySpending(category) {
  // Get spending from transactions this month
  const transactions = loadTransactions();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getMonth() === currentMonth &&
           txnDate.getFullYear() === currentYear &&
           t.type === "expense" &&
           t.category === category;
  });

  // Also include from budget expenses
  const budgetAmount = state.expenses[category] || 0;

  const transactionTotal = monthTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  return transactionTotal + budgetAmount;
}

function calculateSafeToSpend() {
  const limits = loadSpendingLimits();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate() + 1;

  // Calculate total remaining budget across all categories with limits
  let totalRemaining = 0;
  let hasLimits = false;

  Object.keys(limits).forEach(category => {
    const limit = limits[category];
    if (limit > 0) {
      hasLimits = true;
      const spent = getCategorySpending(category);
      const remaining = Math.max(0, limit - spent);
      totalRemaining += remaining;
    }
  });

  if (!hasLimits) {
    // If no limits set, calculate from income - expenses
    const monthlyIncome = state.income || 0;
    const monthlyExpenses = Object.values(state.expenses).reduce((sum, val) => sum + (val || 0), 0);
    totalRemaining = Math.max(0, monthlyIncome - monthlyExpenses);
  }

  return Math.round(totalRemaining / daysRemaining);
}

function getSpendingPace() {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedPace = dayOfMonth / daysInMonth;

  const limits = loadSpendingLimits();
  let totalSpent = 0;
  let totalLimit = 0;

  Object.keys(limits).forEach(category => {
    const limit = limits[category];
    if (limit > 0) {
      totalLimit += limit;
      totalSpent += getCategorySpending(category);
    }
  });

  if (totalLimit === 0) return { status: "on-track", text: "Set limits to track your pace" };

  const actualPace = totalSpent / totalLimit;

  if (actualPace <= expectedPace * 0.9) {
    return { status: "on-track", text: "On track this week" };
  } else if (actualPace <= expectedPace * 1.1) {
    return { status: "warning", text: "Slightly ahead of pace" };
  } else {
    return { status: "over-budget", text: "Over budget pace" };
  }
}

function renderSpendingLimits() {
  const grid = document.querySelector("[data-limits-grid]");
  if (!grid) return;

  const limits = loadSpendingLimits();
  const categoriesWithLimits = Object.entries(limits).filter(([_, limit]) => limit > 0);

  if (categoriesWithLimits.length === 0) {
    grid.innerHTML = '<p class="muted">No spending limits set. Click "Manage Limits" to get started.</p>';
    return;
  }

  grid.innerHTML = categoriesWithLimits.map(([category, limit]) => {
    const spent = getCategorySpending(category);
    const percent = Math.min(100, (spent / limit) * 100);
    const categoryInfo = LIMIT_CATEGORIES[category] || { icon: "📄", name: category };

    let statusClass = "";
    let fillClass = "";
    if (percent >= 100) {
      statusClass = "exceeded";
      fillClass = "exceeded";
    } else if (percent >= 75) {
      statusClass = "warning";
      fillClass = "warning";
    }

    return `
      <div class="limit-item ${statusClass}">
        <div class="limit-header">
          <span class="limit-icon">${escapeHtml(categoryInfo.icon)}</span>
          <span class="limit-name">${escapeHtml(categoryInfo.name)}</span>
          ${percent >= 75 ? `<span class="bill-due-badge ${percent >= 100 ? 'overdue' : 'tomorrow'}">${percent >= 100 ? 'Over limit!' : 'Warning'}</span>` : ''}
        </div>
        <div class="limit-progress">
          <div class="limit-bar">
            <span class="limit-fill ${fillClass}" style="width: ${percent}%"></span>
          </div>
          <div class="limit-values">
            <span class="spent">${formatCurrency(spent)} spent</span>
            <span class="limit">of ${formatCurrency(limit)}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function updateSpendingLimitsUI() {
  // Safe to spend
  const safeEl = document.querySelector("[data-safe-to-spend]");
  if (safeEl) {
    const safe = calculateSafeToSpend();
    safeEl.textContent = formatCurrency(safe);
    safeEl.className = "safe-amount";
    if (safe < 10) safeEl.classList.add("danger");
    else if (safe < 30) safeEl.classList.add("warning");
  }

  // Spending pace
  const paceEl = document.querySelector("[data-spending-pace]");
  if (paceEl) {
    const pace = getSpendingPace();
    paceEl.innerHTML = `
      <div class="pace-indicator ${pace.status}">
        <span class="pace-icon">${pace.status === "on-track" ? "✓" : pace.status === "warning" ? "⚠" : "⚠"}</span>
        <span class="pace-text">${escapeHtml(pace.text)}</span>
      </div>
    `;
  }

  renderSpendingLimits();
}

function openLimitsModal() {
  const modal = document.querySelector("[data-limits-modal]");
  if (!modal) return;

  const limits = loadSpendingLimits();

  // Populate inputs
  Object.keys(LIMIT_CATEGORIES).forEach(category => {
    const input = document.querySelector(`[data-limit-input="${category}"]`);
    if (input) {
      input.value = limits[category] || "";
    }
  });

  modal.hidden = false;
}

function closeLimitsModal() {
  const modal = document.querySelector("[data-limits-modal]");
  if (modal) modal.hidden = true;
}

function saveLimitsFromForm() {
  const limits = {};

  Object.keys(LIMIT_CATEGORIES).forEach(category => {
    const input = document.querySelector(`[data-limit-input="${category}"]`);
    if (input) {
      const value = parseFloat(input.value) || 0;
      if (value > 0) {
        limits[category] = value;
      }
    }
  });

  saveSpendingLimits(limits);
  closeLimitsModal();
  updateSpendingLimitsUI();
}

function initSpendingLimits() {
  document.querySelector("[data-manage-limits]")?.addEventListener("click", openLimitsModal);

  document.querySelectorAll("[data-close-limits-modal]").forEach(btn => {
    btn.addEventListener("click", closeLimitsModal);
  });

  document.querySelector("[data-save-limits]")?.addEventListener("click", saveLimitsFromForm);

  updateSpendingLimitsUI();
}

// Expose spending limits functions globally for cross-module access
Object.assign(window, {
  initSpendingLimits,
});

// ============================================================
