// Budget Planner
let plannerOriginalExpenses = {};
let plannerDelegationAttached = false;

function openBudgetPlanner() {
  const modal = document.querySelector("[data-budget-planner-modal]");
  if (!modal) return;

  plannerOriginalExpenses = { ...state.expenses };
  renderPlannerCategories();
  updatePlannerImpact();
  modal.hidden = false;
}

function closeBudgetPlanner() {
  const modal = document.querySelector("[data-budget-planner-modal]");
  if (modal) modal.hidden = true;
}

function resetPlannerChanges() {
  state.expenses = { ...plannerOriginalExpenses };
  renderPlannerCategories();
  updatePlannerImpact();
}

function applyPlannerChanges() {
  scheduleSave();
  updateCategoryTotals();
  updateBudgetSummary();
  updateSummary();
  closeBudgetPlanner();
}

function renderPlannerCategories() {
  const container = document.querySelector("[data-planner-categories]");
  if (!container) return;

  const categories = [
    { id: "housing", name: "Housing", fields: ["mortgage", "councilTax", "homeInsurance"] },
    { id: "utilities", name: "Utilities", fields: ["energy", "water", "internet", "streaming"] },
    { id: "transport", name: "Transport", fields: ["carPayment", "carInsurance", "fuel", "publicTransport"] },
    { id: "food", name: "Food & Dining", fields: ["groceries", "diningOut", "coffeeSnacks"] },
    { id: "personal", name: "Personal", fields: ["gym", "clothing", "personalCare", "entertainment", "subscriptions"] },
  ];

  container.innerHTML = categories.map(cat => {
    const total = cat.fields.reduce((sum, f) => sum + (state.expenses[f] || 0), 0);
    const originalTotal = cat.fields.reduce((sum, f) => sum + (plannerOriginalExpenses[f] || 0), 0);
    const maxValue = Math.max(originalTotal * 2, 1000);

    return `
      <div class="planner-category">
        <div class="planner-category-header">
          <h4>${cat.name}</h4>
          <span class="planner-category-value">${formatCurrency(total)}</span>
        </div>
        <input type="range" class="planner-slider" min="0" max="${maxValue}" value="${total}" data-planner-cat="${cat.id}" data-fields="${cat.fields.join(",")}" />
      </div>
    `;
  }).join("");
  ensurePlannerDelegation(container);
}

function ensurePlannerDelegation(container) {
  if (plannerDelegationAttached || !container) return;

  container.addEventListener("input", (event) => {
    const slider = event.target.closest(".planner-slider");
    if (!slider) return;

    const fields = slider.dataset.fields.split(",");
    const originalTotal = fields.reduce((sum, f) => sum + (plannerOriginalExpenses[f] || 0), 0);
    const newTotal = parseInt(slider.value, 10);
    const ratio = originalTotal > 0 ? newTotal / originalTotal : 0;

    fields.forEach((field) => {
      state.expenses[field] = Math.round((plannerOriginalExpenses[field] || 0) * ratio);
    });

    const valueEl = slider.parentElement.querySelector(".planner-category-value");
    if (valueEl) {
      valueEl.textContent = formatCurrency(newTotal);
    }

    updatePlannerImpact();
  });

  plannerDelegationAttached = true;
}

function updatePlannerImpact() {
  const originalExpenses = Object.values(plannerOriginalExpenses).reduce((sum, v) => sum + v, 0);
  const newExpenses = calculateTotalExpenses();
  const savingsDiff = originalExpenses - newExpenses;

  const savingsEl = document.querySelector("[data-impact-savings]");
  if (savingsEl) {
    savingsEl.textContent = `${savingsDiff >= 0 ? "+" : ""}${formatCurrency(savingsDiff)}`;
    savingsEl.className = `impact-value ${savingsDiff > 0 ? "positive" : savingsDiff < 0 ? "negative" : ""}`;
  }

  // Calculate timeline impact
  const timelineEl = document.querySelector("[data-impact-timeline]");
  if (timelineEl && state.goals.length > 0) {
    const goal = state.goals[0];
    const remaining = (goal.target || 0) - (goal.saved || 0);
    const originalSurplus = state.income - originalExpenses;
    const newSurplus = state.income - newExpenses;

    if (remaining > 0 && originalSurplus > 0 && newSurplus > 0) {
      const originalMonths = Math.ceil(remaining / originalSurplus);
      const newMonths = Math.ceil(remaining / newSurplus);
      const diff = originalMonths - newMonths;

      if (diff > 0) timelineEl.textContent = `${diff} months faster`;
      else if (diff < 0) timelineEl.textContent = `${Math.abs(diff)} months slower`;
      else timelineEl.textContent = "No change";
    } else {
      timelineEl.textContent = "Set a goal to see impact";
    }
  }

  // Emergency fund impact
  const emergencyEl = document.querySelector("[data-impact-emergency]");
  if (emergencyEl) {
    const monthlyDiff = savingsDiff;
    const monthsGained = newExpenses > 0 ? (monthlyDiff / newExpenses).toFixed(1) : 0;
    emergencyEl.textContent = monthlyDiff >= 0 ? `+${monthsGained} months/year` : `${monthsGained} months/year`;
  }

  // Render impact chart
  renderImpactChart(originalExpenses, newExpenses);
}

function renderImpactChart(original, newVal) {
  const chartEl = document.querySelector("[data-impact-chart]");
  if (!chartEl) return;

  const max = Math.max(original, newVal, 1);
  const originalPct = (original / max) * 100;
  const newPct = (newVal / max) * 100;

  chartEl.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
      <div style="width: 40px; height: ${originalPct}%; background: var(--ink-muted); border-radius: 4px;"></div>
      <span style="font-size: 0.7rem; color: var(--ink-muted);">Before</span>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
      <div style="width: 40px; height: ${newPct}%; background: ${newVal < original ? 'var(--mint)' : 'var(--coral)'}; border-radius: 4px;"></div>
      <span style="font-size: 0.7rem; color: var(--ink-muted);">After</span>
    </div>
  `;
}

function initBudgetPlanner() {
  document.querySelector("[data-open-planner]")?.addEventListener("click", openBudgetPlanner);
  document.querySelector("[data-planner-close]")?.addEventListener("click", closeBudgetPlanner);
  document.querySelector("[data-planner-reset]")?.addEventListener("click", resetPlannerChanges);
  document.querySelector("[data-planner-apply]")?.addEventListener("click", applyPlannerChanges);
}

// Expose budget planner functions globally
Object.assign(window, {
  initBudgetPlanner,
});
