// ============================================================
// UI CORE: SCREEN NAVIGATION, SUMMARY, AND FORM SYNC
// ============================================================

// Screen navigation
function showScreen(index) {
  currentIndex = Math.max(0, Math.min(index, screens.length - 1));
  screens.forEach((screen, idx) => {
    screen.classList.toggle("is-active", idx === currentIndex);
  });
  steps.forEach((step, idx) => {
    step.classList.toggle("is-active", idx === currentIndex);
    step.classList.toggle("is-complete", idx < currentIndex);
  });

  const screenId = screens[currentIndex]?.dataset.screen;
  if (screenId) {
    state.lastScreen = screenId;
    scheduleSave();
  }

  // Update budget page when shown
  if (screenId === "budget") {
    updateCategoryTotals();
    updateBudgetSummary();
  }

  // Update goals page
  if (screenId === "goals") {
    updateBudgetSummary();
  }
}

function showInitialScreen() {
  const target = state.onboardingComplete ? "app" : state.lastScreen;
  const index = screens.findIndex((screen) => screen.dataset.screen === target);
  showScreen(index === -1 ? 0 : index);
}

// UI updates
function updatePersona() {
  const data = personaData[state.persona] || personaData.builder;
  setTextAll("[data-persona-title]", data.title);
  setTextAll("[data-persona-copy]", data.copy);
  setTextAll("[data-profile-persona]", data.title);
  setTextAll("[data-profile-copy]", data.copy);

  document.querySelectorAll("[data-persona-tags]").forEach((el) => {
    el.innerHTML = data.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  });

  const profileTags = document.querySelector("[data-profile-tags]");
  if (profileTags) {
    profileTags.innerHTML = data.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  }
}

// Rewards UI updates live in app-rewards.js.

function getFinanceSnapshot() {
  const totalExpenses = calculateTotalExpenses();
  const liquidSavings =
    Number.isFinite(state.savings) && state.savings > 0
      ? state.savings
      : (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  return {
    income: state.income,
    expenses: totalExpenses,
    savings: liquidSavings,
    surplus: state.income - totalExpenses,
    debt: calculateCategoryTotal("debt"),
  };
}

function updateSummary() {
  const snapshot = getFinanceSnapshot();
  const surplus = snapshot.surplus;
  const surplusLabel = surplus >= 0 ? "surplus" : "deficit";
  const bufferMonths = snapshot.expenses ? snapshot.savings / (snapshot.expenses || 1) : 0;
  const goalsCount = state.goals.length;
  const debtRatio = snapshot.income ? snapshot.debt / snapshot.income : 0;
  const surplusRatio = snapshot.income ? snapshot.surplus / snapshot.income : 0;

  setTextAll("[data-summary-name]", state.name || "Friend");
  setTextAll("[data-user-name]", state.name || "Friend");
  setTextAll("[data-summary-surplus]", formatCurrency(surplus));
  setTextAll("[data-app-surplus]", `${formatCurrency(surplus)} ${surplusLabel}`);
  setTextAll("[data-summary-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-app-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-summary-goals]", `${goalsCount} goal${goalsCount === 1 ? "" : "s"}`);

  const summaryNext = document.querySelector("[data-summary-next]");
  let nextStep = "";
  if (surplus < 0) {
    nextStep = "Reduce expenses to reach break-even.";
  } else if (bufferMonths < 1) {
    nextStep = "Build a 1 month emergency buffer.";
  } else if (bufferMonths < 3) {
    nextStep = "Grow your buffer to 3 months.";
  } else if (goalsCount === 0) {
    nextStep = "Add your first goal to start tracking.";
  } else {
    nextStep = "Automate savings to your top goal.";
  }
  if (summaryNext) summaryNext.textContent = nextStep;

  // Confidence score
  const baseScore = 50;
  const bufferScore = Math.min(25, Math.round(bufferMonths * 6));
  const goalScore = Math.min(15, goalsCount * 3);
  const cashflowScore = Math.min(10, Math.round(Math.max(0, surplusRatio * 40)));
  let debtPenalty = 0;
  if (debtRatio > 0.35) debtPenalty = -12;
  else if (debtRatio > 0.2) debtPenalty = -6;

  let score = baseScore + bufferScore + goalScore + cashflowScore + debtPenalty;
  score = Math.max(35, Math.min(95, score));

  setTextAll("[data-app-confidence]", score);
  setTextAll("[data-confidence-total]", score);
  setTextAll("[data-confidence-base]", baseScore);
  setTextAll("[data-confidence-buffer]", formatSignedNumber(bufferScore));
  setTextAll("[data-confidence-goals]", formatSignedNumber(goalScore));
  setTextAll("[data-confidence-cashflow]", formatSignedNumber(cashflowScore));
  setTextAll("[data-confidence-debt]", formatSignedNumber(debtPenalty));

  updateRewardsUI();
  updateGoalList();
  updateDashboardVisibility();
  updateIncomeBreakdown();
  updateCashflowInsights();
  updateVulnerabilityPanel();
  updateAlertList();
  updateSmartInsights();
}

// Goals from onboarding
function updateGoalsFromCards() {
  const cards = document.querySelectorAll("[data-goal-card]");
  const goals = [];

  cards.forEach((card) => {
    const checkbox = card.querySelector("[data-goal-check]");
    const targetInput = card.querySelector("[data-goal-target]");
    const customNameInput = card.querySelector("[data-goal-custom-name]");
    const customName = customNameInput?.value?.trim();

    if (checkbox?.checked) {
      const goalName = customNameInput ? customName : checkbox.value;
      if (goalName) {
        goals.push({
          name: goalName,
          target: Number(targetInput?.value) || Number(targetInput?.placeholder) || 0,
          saved: 0,
          monthly: 0,
        });
      }
    }

    card.classList.toggle("active", checkbox?.checked);
  });

  state.goals = goals;
  scheduleSave();
}

// Form sync
function syncFormFromState() {
  document.querySelectorAll("[data-field]").forEach((el) => {
    const field = el.dataset.field;
    if (field === "annualSalary") {
      el.value = state.annualSalary || "";
    } else if (field === "studentLoan") {
      el.checked = state.studentLoan;
    } else if (field === "pensionContrib") {
      el.checked = state.pensionContrib;
    } else if (field === "savings") {
      el.value = state.savings || "";
    } else if (field === "name") {
      el.value = state.name || "";
    } else if (field === "currentAge") {
      el.value = state.currentAge || "";
    } else if (field === "rewardPoints") {
      el.value = state.rewardPoints || "";
    } else if (field === "rewardStreak") {
      el.value = state.rewardStreak || "";
    } else if (state[field] !== undefined) {
      el.value = state[field];
    }
  });

  // Sync expense inputs
  document.querySelectorAll("[data-expense]").forEach((el) => {
    const key = el.dataset.expense;
    if (state.expenses[key] !== undefined) {
      el.value = state.expenses[key] || "";
    }
  });

  // Sync choice groups
  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    const field = group.dataset.choiceGroup;
    const val = state[field];
    group.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === val);
    });
  });

  // Sync dashboard toggles
  document.querySelectorAll("[data-dashboard-toggle]").forEach((el) => {
    el.checked = state.dashboardWidgets.includes(el.value);
  });

  updatePersona();
  updateSalaryBreakdown();
  updateCategoryTotals();
  updateBudgetSummary();
}

// Convenience refresh used by actions and other feature flows.
function refreshUI() {
  updateCategoryTotals();
  updateBudgetSummary();
  updateSummary();
}

// Expose UI core functions globally for cross-module access
Object.assign(window, {
  showScreen,
  showInitialScreen,
  updatePersona,
  getFinanceSnapshot,
  updateSummary,
  updateGoalsFromCards,
  syncFormFromState,
  refreshUI,
});
