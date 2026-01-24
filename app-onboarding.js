// Goals from onboarding
function updateGoalsFromCards() {
  const cards = document.querySelectorAll("[data-goal-card]");
  const goals = [];

  cards.forEach((card) => {
    const checkbox = card.querySelector("[data-goal-check]");
    const targetInput = card.querySelector("[data-goal-target]");

    if (checkbox?.checked) {
      goals.push({
        name: checkbox.value,
        target: Number(targetInput?.value) || Number(targetInput?.placeholder) || 0,
        saved: 0,
        monthly: 0,
      });
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
