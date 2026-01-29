// PHASE 1: DEBT PAYOFF PLANNER
// ============================================================

const DEBTS_STORAGE_KEY = "consumerpay_debts_v1";
let currentDebtStrategy = "avalanche";
let extraMonthlyPayment = 0;

const DEBT_ICONS = {
  "credit-card": "💳",
  "personal-loan": "📋",
  "car-finance": "🚗",
  "student-loan": "🎓",
  "overdraft": "🏦",
  "other": "📄"
};

function loadDebts() {
  try {
    const stored = localStorage.getItem(DEBTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveDebts(debts) {
  localStorage.setItem(DEBTS_STORAGE_KEY, JSON.stringify(debts));
  state.debts = debts;
  scheduleSave();
}

function generateDebtId() {
  return generateSecureId('debt');
}

function calculateDebtPayoff(debts, strategy, extraPayment = 0) {
  if (debts.length === 0) return { months: 0, totalInterest: 0, schedule: [] };

  // Deep clone debts for calculation
  let workingDebts = debts.map(d => ({
    ...d,
    currentBalance: d.balance,
    totalInterest: 0,
    paidOff: false,
    payoffMonth: 0
  }));

  // Sort by strategy
  if (strategy === "avalanche") {
    workingDebts.sort((a, b) => b.interestRate - a.interestRate);
  } else {
    workingDebts.sort((a, b) => a.balance - b.balance);
  }

  const schedule = [];
  let month = 0;
  const maxMonths = 360; // 30 years max

  while (workingDebts.some(d => !d.paidOff) && month < maxMonths) {
    month++;
    let extraAvailable = extraPayment;

    // Apply interest and minimum payments
    workingDebts.forEach(debt => {
      if (debt.paidOff) return;

      // Monthly interest
      const monthlyRate = debt.interestRate / 100 / 12;
      const interest = debt.currentBalance * monthlyRate;
      debt.currentBalance += interest;
      debt.totalInterest += interest;

      // Minimum payment
      const payment = Math.min(debt.minPayment, debt.currentBalance);
      debt.currentBalance -= payment;

      if (debt.currentBalance <= 0.01) {
        debt.paidOff = true;
        debt.payoffMonth = month;
        debt.currentBalance = 0;
      }
    });

    // Apply extra payment to first non-paid-off debt
    for (const debt of workingDebts) {
      if (debt.paidOff || extraAvailable <= 0) continue;

      const payment = Math.min(extraAvailable, debt.currentBalance);
      debt.currentBalance -= payment;
      extraAvailable -= payment;

      if (debt.currentBalance <= 0.01) {
        debt.paidOff = true;
        debt.payoffMonth = month;
        debt.currentBalance = 0;
        // Add freed-up minimum payment to extra
        extraAvailable += debt.minPayment;
      }
    }

    schedule.push({
      month,
      debts: workingDebts.map(d => ({
        name: d.name,
        balance: d.currentBalance,
        paidOff: d.paidOff
      }))
    });
  }

  const totalInterest = workingDebts.reduce((sum, d) => sum + d.totalInterest, 0);

  return {
    months: month,
    totalInterest,
    schedule,
    debtDetails: workingDebts
  };
}

function renderDebtSummary() {
  const debts = loadDebts();
  const totalEl = document.querySelector("[data-debt-total]");
  const monthlyEl = document.querySelector("[data-debt-monthly]");
  const dateEl = document.querySelector("[data-debt-free-date]");

  const total = debts.reduce((sum, d) => sum + (d.balance || 0), 0);
  const monthly = debts.reduce((sum, d) => sum + (d.minPayment || 0), 0);

  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (monthlyEl) monthlyEl.textContent = formatCurrency(monthly);

  if (dateEl) {
    if (debts.length === 0) {
      dateEl.textContent = "--";
    } else {
      const payoff = calculateDebtPayoff(debts, currentDebtStrategy, extraMonthlyPayment);
      const freeDate = new Date();
      freeDate.setMonth(freeDate.getMonth() + payoff.months);
      dateEl.textContent = freeDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    }
  }
}

function renderDebtList() {
  const container = document.querySelector("[data-debt-list]");
  if (!container) return;

  const debts = loadDebts();

  if (debts.length === 0) {
    container.innerHTML = '<p class="muted">No debts added. Add your debts to create a payoff plan.</p>';
    return;
  }

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);

  container.innerHTML = debts.map(debt => {
    const paidPercent = totalDebt > 0 ? ((totalDebt - debt.balance) / totalDebt * 100) : 0;
    return `
      <div class="debt-item" data-debt-id="${escapeHtml(debt.id)}">
        <div class="debt-item-icon ${escapeHtml(debt.category)}">${escapeHtml(DEBT_ICONS[debt.category] || "📄")}</div>
        <div class="debt-item-info">
          <h4>${escapeHtml(debt.name)}</h4>
          <div class="debt-item-meta">Min payment: ${formatCurrency(debt.minPayment)}/month</div>
        </div>
        <div class="debt-item-balance">
          <div class="balance">${formatCurrency(debt.balance)}</div>
          <div class="rate">${debt.interestRate}% APR</div>
        </div>
        <div class="debt-item-actions">
          <button class="btn ghost small" type="button" data-edit-debt="${escapeHtml(debt.id)}">Edit</button>
          <button class="btn ghost small" type="button" data-delete-debt="${escapeHtml(debt.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  // Attach event listeners
  container.querySelectorAll("[data-edit-debt]").forEach(btn => {
    btn.addEventListener("click", () => openDebtModal(btn.getAttribute("data-edit-debt")));
  });

  container.querySelectorAll("[data-delete-debt]").forEach(btn => {
    btn.addEventListener("click", () => deleteDebt(btn.getAttribute("data-delete-debt")));
  });
}

function renderDebtChart() {
  const container = document.querySelector("[data-debt-chart]");
  if (!container) return;

  const debts = loadDebts();

  if (debts.length === 0) {
    container.innerHTML = '<p class="muted">Add debts to see your payoff timeline</p>';
    return;
  }

  const payoff = calculateDebtPayoff(debts, currentDebtStrategy, extraMonthlyPayment);

  if (payoff.months === 0) {
    container.innerHTML = '<p class="muted">Unable to calculate payoff timeline</p>';
    return;
  }

  // Create SVG chart
  const width = 600;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const step = Math.max(1, Math.floor(payoff.months / 12));
  const points = payoff.schedule.filter((_, i) => i % step === 0 || i === payoff.schedule.length - 1);

  const xScale = (i) => padding + (i / (points.length - 1)) * chartWidth;
  const yScale = (val) => height - padding - (val / totalDebt) * chartHeight;

  // Create path
  let pathD = `M ${xScale(0)} ${yScale(totalDebt)}`;
  points.forEach((point, i) => {
    const totalRemaining = point.debts.reduce((sum, d) => sum + d.balance, 0);
    pathD += ` L ${xScale(i)} ${yScale(totalRemaining)}`;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}">
      <!-- Grid lines -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="var(--border)" stroke-width="1"/>

      <!-- Debt line -->
      <path d="${pathD}" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Labels -->
      <text x="${padding}" y="${height - 10}" font-size="12" fill="var(--muted)">Now</text>
      <text x="${width - padding}" y="${height - 10}" font-size="12" fill="var(--muted)" text-anchor="end">${payoff.months} months</text>
      <text x="${padding - 10}" y="${padding + 5}" font-size="12" fill="var(--muted)" text-anchor="end">${formatCurrency(totalDebt)}</text>
      <text x="${padding - 10}" y="${height - padding}" font-size="12" fill="var(--muted)" text-anchor="end">£0</text>
    </svg>
  `;
}

function renderStrategyComparison() {
  const container = document.querySelector("[data-strategy-comparison]");
  if (!container) return;

  const debts = loadDebts();

  if (debts.length < 2) {
    container.hidden = true;
    return;
  }

  const avalanche = calculateDebtPayoff(debts, "avalanche", extraMonthlyPayment);
  const snowball = calculateDebtPayoff(debts, "snowball", extraMonthlyPayment);
  const savings = snowball.totalInterest - avalanche.totalInterest;

  document.querySelector("[data-avalanche-interest]").textContent = formatCurrency(avalanche.totalInterest);
  document.querySelector("[data-snowball-interest]").textContent = formatCurrency(snowball.totalInterest);
  document.querySelector("[data-avalanche-time]").textContent = `${avalanche.months} months`;
  document.querySelector("[data-snowball-time]").textContent = `${snowball.months} months`;
  document.querySelector("[data-avalanche-savings]").textContent = savings > 0 ? formatCurrency(savings) : "Best option";
  document.querySelector("[data-snowball-savings]").textContent = savings <= 0 ? formatCurrency(-savings) : "--";

  container.hidden = false;
}

function renderExtraPaymentImpact() {
  const container = document.querySelector("[data-extra-impact]");
  if (!container) return;

  const debts = loadDebts();

  if (debts.length === 0 || extraMonthlyPayment <= 0) {
    container.innerHTML = '<p class="muted">Add an extra payment to see how much faster you\'ll be debt-free</p>';
    return;
  }

  const withoutExtra = calculateDebtPayoff(debts, currentDebtStrategy, 0);
  const withExtra = calculateDebtPayoff(debts, currentDebtStrategy, extraMonthlyPayment);

  const monthsSaved = withoutExtra.months - withExtra.months;
  const interestSaved = withoutExtra.totalInterest - withExtra.totalInterest;

  container.innerHTML = `
    <p>By paying an extra <strong>${formatCurrency(extraMonthlyPayment)}/month</strong>:</p>
    <p>You'll be debt-free <span class="impact-highlight">${monthsSaved} months earlier</span></p>
    <p>You'll save <span class="impact-highlight">${formatCurrency(interestSaved)}</span> in interest</p>
  `;
}

function openDebtModal(debtId = null) {
  const modal = document.querySelector("[data-debt-modal]");
  const title = document.querySelector("[data-debt-modal-title]");
  const form = document.querySelector("[data-debt-form]");
  if (!modal || !form) return;

  form.reset();
  document.querySelector("[data-debt-id]").value = "";

  if (debtId) {
    const debts = loadDebts();
    const debt = debts.find(d => d.id === debtId);
    if (debt) {
      title.textContent = "Edit Debt";
      document.querySelector("[data-debt-id]").value = debt.id;
      document.querySelector("[data-debt-name]").value = debt.name;
      document.querySelector("[data-debt-balance]").value = debt.balance;
      document.querySelector("[data-debt-rate]").value = debt.interestRate;
      document.querySelector("[data-debt-min-payment]").value = debt.minPayment;
      document.querySelector("[data-debt-category]").value = debt.category;
    }
  } else {
    title.textContent = "Add New Debt";
  }

  modal.hidden = false;
}

function closeDebtModal() {
  const modal = document.querySelector("[data-debt-modal]");
  if (modal) modal.hidden = true;
}

function saveDebtFromForm() {
  const id = document.querySelector("[data-debt-id]").value;
  const name = document.querySelector("[data-debt-name]").value.trim();
  const balance = parseFloat(document.querySelector("[data-debt-balance]").value) || 0;
  const interestRate = parseFloat(document.querySelector("[data-debt-rate]").value) || 0;
  const minPayment = parseFloat(document.querySelector("[data-debt-min-payment]").value) || 0;
  const category = document.querySelector("[data-debt-category]").value;

  if (!name || balance <= 0 || minPayment <= 0) {
    showNotification("Please fill in all required fields correctly.", "warning");
    return;
  }

  if (minPayment > balance) {
    showNotification("Minimum payment cannot exceed the balance.", "warning");
    return;
  }

  const debts = loadDebts();

  if (id) {
    const index = debts.findIndex(d => d.id === id);
    if (index !== -1) {
      debts[index] = { ...debts[index], name, balance, interestRate, minPayment, category };
    }
  } else {
    debts.push({
      id: generateDebtId(),
      name,
      balance,
      interestRate,
      minPayment,
      category
    });
  }

  saveDebts(debts);
  closeDebtModal();
  updateDebtsUI();
}

async function deleteDebt(debtId) {
  const confirmed = await showConfirmation("Are you sure you want to delete this debt?", "Delete Debt", "Delete", "Cancel");
  if (!confirmed) return;
  const debts = loadDebts().filter(d => d.id !== debtId);
  saveDebts(debts);
  updateDebtsUI();
  showNotification("Debt deleted successfully", "success");
}

function updateDebtsUI() {
  renderDebtSummary();
  renderDebtList();
  renderDebtChart();
  renderStrategyComparison();
  renderExtraPaymentImpact();
}

function initDebtPayoff() {
  state.debts = loadDebts();

  // Add Debt button
  document.querySelector("[data-add-debt]")?.addEventListener("click", () => openDebtModal());

  // Close modal buttons
  document.querySelectorAll("[data-close-debt-modal]").forEach(btn => {
    btn.addEventListener("click", closeDebtModal);
  });

  // Form submission
  document.querySelector("[data-debt-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveDebtFromForm();
  });

  // Strategy toggle
  document.querySelectorAll("[data-strategy]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-strategy]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentDebtStrategy = btn.getAttribute("data-strategy");
      updateDebtsUI();
    });
  });

  // Extra payment input
  document.querySelector("[data-extra-payment]")?.addEventListener("input", (e) => {
    extraMonthlyPayment = parseFloat(e.target.value) || 0;
    updateDebtsUI();
  });

  // Initial render
  updateDebtsUI();
}

// Expose debt payoff functions globally for cross-module access
Object.assign(window, {
  initDebtPayoff,
});

// ============================================================
