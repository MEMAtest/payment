// Goal Engine v2
function calculateGoalETA(goal) {
  if (!goal || typeof goal !== "object") {
    return { months: 0, date: null, status: "invalid" };
  }

  const saved = Number(goal.saved) || 0;
  const target = Number(goal.target) || 0;
  const monthly = Number(goal.monthly) || 0;
  const remaining = target - saved;

  if (remaining <= 0) return { months: 0, date: new Date(), status: "complete" };
  if (monthly <= 0) return { months: Infinity, date: null, status: "no-contribution" };

  const months = Math.ceil(remaining / monthly);
  const eta = new Date();
  eta.setMonth(eta.getMonth() + months);

  // Check against target date if set
  if (goal.targetDate) {
    const targetDate = new Date(goal.targetDate);
    const now = new Date();
    const monthsToTarget = Math.max(
      0,
      (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth()
    );
    const requiredMonthly = monthsToTarget > 0 ? Math.ceil(remaining / monthsToTarget) : remaining;

    return {
      months,
      date: eta,
      targetDate,
      monthsToTarget,
      requiredMonthly,
      onTrack: months <= monthsToTarget,
      status: months <= monthsToTarget ? "on-track" : "behind",
    };
  }

  return { months, date: eta, status: "in-progress" };
}

function calculateSuggestedAllocation(goals, surplus) {
  if (!goals.length || surplus <= 0) return [];

  const activeGoals = goals.filter((g) => g.autoAllocate && g.target > g.saved);
  if (!activeGoals.length) return [];

  // Sort by priority
  const sorted = [...activeGoals].sort((a, b) => (a.priority || 99) - (b.priority || 99));

  // Allocate proportionally based on remaining amount
  const totalRemaining = sorted.reduce((sum, g) => sum + (g.target - g.saved), 0);
  if (totalRemaining <= 0) return [];

  return sorted.map((goal) => {
    const remaining = goal.target - goal.saved;
    const share = remaining / totalRemaining;
    const suggested = Math.round(surplus * share);
    return { goalId: goal.id, suggested, remaining };
  });
}

function applyAutoAllocation() {
  const income = state.income || 0;
  const totalExpenses = calculateTotalExpenses();
  const surplus = Math.max(0, income - totalExpenses);

  if (surplus <= 0) return;

  const allocations = calculateSuggestedAllocation(state.goals, surplus);

  allocations.forEach(({ goalId, suggested }) => {
    const goal = state.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.monthly = suggested;
    }
  });

  scheduleSave();
  updateGoalList();
}

function updateGoalList() {
  const goalList = document.querySelector("[data-app-goals]");
  if (!goalList) return;

  // Calculate total allocated and surplus
  const income = state.income || 0;
  const totalExpenses = calculateTotalExpenses();
  const surplus = Math.max(0, income - totalExpenses);
  const totalAllocated = state.goals.reduce((sum, g) => sum + (Number(g.monthly) || 0), 0);
  const unallocated = surplus - totalAllocated;

  if (!state.goals.length) {
    goalList.innerHTML = `
      <div class="goal-empty-state">
        <p class="muted">No goals yet. Add one to start tracking progress.</p>
        <button class="btn secondary" type="button" data-add-goal>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add your first goal
        </button>
      </div>
    `;
    attachAddGoalListener();
    return;
  }

  // Summary header
  const summaryHtml = `
    <div class="goals-summary">
      <div class="summary-item">
        <span class="summary-label">Monthly surplus</span>
        <span class="summary-value">${formatCurrency(surplus)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Allocated to goals</span>
        <span class="summary-value">${formatCurrency(totalAllocated)}</span>
      </div>
      <div class="summary-item ${unallocated > 0 ? "highlight" : ""}">
        <span class="summary-label">Unallocated</span>
        <span class="summary-value">${formatCurrency(unallocated)}</span>
      </div>
      ${unallocated > 0 ? `<button class="btn small" type="button" data-auto-allocate>Auto-allocate</button>` : ""}
    </div>
  `;

  // Sort goals by priority
  const sortedGoals = [...state.goals].sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const items = sortedGoals.map((goal, displayIdx) => {
    const index = state.goals.findIndex((g) => g.id === goal.id);
    const saved = Number(goal.saved) || 0;
    const target = Number(goal.target) || 0;
    const monthly = Number(goal.monthly) || 0;
    const progress = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const eta = calculateGoalETA(goal);
    const color = safeColor(goal.color || GOAL_COLORS[displayIdx % GOAL_COLORS.length]);

    let statusHtml = "";
    let etaLabel = "";

    if (!target) {
      etaLabel = "Set a target amount";
      statusHtml = '<span class="goal-status needs-target">Needs target</span>';
    } else if (eta.status === "complete") {
      etaLabel = "Goal reached!";
      statusHtml = '<span class="goal-status complete">Complete</span>';
    } else if (eta.status === "no-contribution") {
      etaLabel = "Set monthly amount to see ETA";
      statusHtml = '<span class="goal-status needs-contribution">No contribution</span>';
    } else if (eta.targetDate) {
      const dateStr = eta.targetDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (eta.onTrack) {
        etaLabel = `On track for ${dateStr}`;
        statusHtml = '<span class="goal-status on-track">On track</span>';
      } else {
        etaLabel = `Behind schedule (need ${formatCurrency(eta.requiredMonthly)}/mo)`;
        statusHtml = '<span class="goal-status behind">Behind</span>';
      }
    } else {
      const dateStr = eta.date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      etaLabel = `ETA: ${dateStr} (~${eta.months} months)`;
      statusHtml = '<span class="goal-status in-progress">In progress</span>';
    }

    return `
      <div class="goal-pot" data-goal-index="${index}" style="--goal-color: ${color}">
        <div class="goal-pot-header">
          <div class="goal-pot-color" style="background: ${color}"></div>
          <div class="goal-pot-info">
            <h4>${escapeHtml(goal.name)}</h4>
            <p class="goal-eta">${etaLabel}</p>
          </div>
          ${statusHtml}
          <button class="goal-menu-btn" type="button" data-goal-menu="${index}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>

        <div class="goal-pot-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%; background: ${color}"></div>
          </div>
          <div class="progress-labels">
            <span>${formatCurrency(saved)} saved</span>
            <span>${formatCurrency(target)} target</span>
          </div>
        </div>

        <div class="goal-pot-controls">
          <div class="control-group">
            <label>Monthly contribution</label>
            <div class="slider-input-group">
              <input type="range" min="0" max="${Math.max(surplus, monthly, 500)}" step="25" value="${monthly}" data-goal-monthly-slider class="goal-slider" style="--slider-color: ${color}" />
              <div class="input-with-prefix">
                <span>£</span>
                <input type="number" min="0" step="25" value="${monthly || ""}" data-goal-monthly-input />
              </div>
            </div>
          </div>

          <div class="control-row">
            <div class="control-group small">
              <label>Saved so far</label>
              <div class="input-with-prefix">
                <span>£</span>
                <input type="number" min="0" step="50" value="${saved || ""}" data-goal-saved-input />
              </div>
            </div>
            <div class="control-group small">
              <label>Target</label>
              <div class="input-with-prefix">
                <span>£</span>
                <input type="number" min="0" step="100" value="${target || ""}" data-goal-target-input />
              </div>
            </div>
            <div class="control-group small">
              <label>Target date</label>
              <input type="month" value="${goal.targetDate || ""}" data-goal-date-input />
            </div>
          </div>
        </div>

        <div class="goal-pot-footer">
          <label class="toggle-small">
            <input type="checkbox" ${goal.autoAllocate !== false ? "checked" : ""} data-goal-auto-allocate />
            <span>Auto-allocate surplus</span>
          </label>
          <span class="goal-priority">Priority ${goal.priority || index + 1}</span>
        </div>
      </div>
    `;
  });

  // Add goal button
  const addButtonHtml = `
    <button class="add-goal-btn" type="button" data-add-goal>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add new goal
    </button>
  `;

  goalList.innerHTML = summaryHtml + items.join("") + addButtonHtml;
  attachGoalInputListeners();
  attachAddGoalListener();
  attachAutoAllocateListener();
  syncFutureGoalSelect();
}

function attachGoalInputListeners() {
  document.querySelectorAll("[data-goal-index]").forEach((item) => {
    const index = parseInt(item.dataset.goalIndex, 10);
    const targetInput = item.querySelector("[data-goal-target-input]");
    const savedInput = item.querySelector("[data-goal-saved-input]");
    const monthlyInput = item.querySelector("[data-goal-monthly-input]");
    const monthlySlider = item.querySelector("[data-goal-monthly-slider]");
    const dateInput = item.querySelector("[data-goal-date-input]");
    const autoAllocateCheckbox = item.querySelector("[data-goal-auto-allocate]");

    if (targetInput) {
      targetInput.addEventListener("input", () => {
        state.goals[index].target = Math.max(0, Number(targetInput.value) || 0);
        scheduleSave();
      });
      targetInput.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (savedInput) {
      savedInput.addEventListener("input", () => {
        state.goals[index].saved = Math.max(0, Number(savedInput.value) || 0);
        scheduleSave();
      });
      savedInput.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (monthlyInput) {
      monthlyInput.addEventListener("input", () => {
        const value = Math.max(0, Number(monthlyInput.value) || 0);
        state.goals[index].monthly = value;
        if (monthlySlider) monthlySlider.value = value;
        scheduleSave();
      });
      monthlyInput.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (monthlySlider) {
      monthlySlider.addEventListener("input", () => {
        const value = Math.max(0, Number(monthlySlider.value) || 0);
        state.goals[index].monthly = value;
        if (monthlyInput) monthlyInput.value = value;
        scheduleSave();
      });
      monthlySlider.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (dateInput) {
      dateInput.addEventListener("change", () => {
        state.goals[index].targetDate = dateInput.value || null;
        scheduleSave();
        updateGoalList();
      });
    }
    if (autoAllocateCheckbox) {
      autoAllocateCheckbox.addEventListener("change", () => {
        state.goals[index].autoAllocate = autoAllocateCheckbox.checked;
        scheduleSave();
      });
    }
  });
}

function attachAddGoalListener() {
  document.querySelectorAll("[data-add-goal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = prompt("Enter goal name:");
      if (!name || !name.trim()) return;

      const newGoal = {
        id: `goal-${Date.now()}`,
        name: name.trim(),
        target: 0,
        saved: 0,
        monthly: 0,
        targetDate: null,
        priority: state.goals.length + 1,
        autoAllocate: true,
        color: GOAL_COLORS[state.goals.length % GOAL_COLORS.length],
        createdAt: Date.now(),
      };

      state.goals.push(newGoal);
      scheduleSave();
      updateGoalList();
    });
  });
}

function attachAutoAllocateListener() {
  const btn = document.querySelector("[data-auto-allocate]");
  if (btn) {
    btn.addEventListener("click", applyAutoAllocation);
  }
}

function updateDashboardVisibility() {
  DASHBOARD_WIDGET_KEYS.forEach((key) => {
    const widget = document.querySelector(`[data-widget="${key}"]`);
    if (widget) {
      widget.classList.toggle("is-hidden", !state.dashboardWidgets.includes(key));
    }
  });
}

function updateIncomeBreakdown() {
  const snapshot = getFinanceSnapshot();
  const max = Math.max(snapshot.income, snapshot.expenses, 1);

  const incomeBar = document.querySelector("[data-income-bar]");
  const expenseBar = document.querySelector("[data-expense-bar]");
  const savingBar = document.querySelector("[data-saving-bar]");

  if (incomeBar) incomeBar.style.setProperty("--fill", snapshot.income / max);
  if (expenseBar) expenseBar.style.setProperty("--fill", snapshot.expenses / max);
  if (savingBar) savingBar.style.setProperty("--fill", Math.max(0, snapshot.surplus) / max);

  setTextAll("[data-income-label]", formatCurrency(snapshot.income));
  setTextAll("[data-expense-label]", formatCurrency(snapshot.expenses));
  setTextAll("[data-saving-label]", formatCurrency(Math.max(0, snapshot.surplus)));
}
