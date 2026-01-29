// Goal Engine v2
let goalsDelegationAttached = false;

// Goal colors palette
const GOAL_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
];

// Ensure color is a valid CSS color string
function safeColor(color) {
  if (!color || typeof color !== "string") return GOAL_COLORS[0];
  // Basic validation - starts with # or is a named color
  if (color.startsWith("#") || /^[a-z]+$/i.test(color)) return color;
  return GOAL_COLORS[0];
}

// Attach listener for "Add Goal" button when goals list is empty
function attachAddGoalListener() {
  const goalList = document.querySelector("[data-app-goals]");
  if (!goalList) return;
  ensureGoalsDelegation(goalList);
}

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
  const emergencyMin = totalExpenses * 3;
  const emergencyMax = totalExpenses * 6;
  const hasEmergencyGoal = state.goals.some((goal) => /emergency/i.test(goal.name || ""));

  if (!state.goals.length) {
    const emergencyRange = `${formatCurrency(emergencyMin)} - ${formatCurrency(emergencyMax)}`;
    const showEmergencyButton = surplus > 0 && !hasEmergencyGoal;
    goalList.innerHTML = `
      <div class="goal-empty-state">
        <p class="muted">Based on your ${formatCurrency(surplus)} monthly surplus, you could save for: Emergency Fund (3-6 months = ${emergencyRange}), or start a custom goal.</p>
        <div class="goal-empty-actions">
          ${
            showEmergencyButton
              ? `<button class="btn secondary" type="button" data-create-emergency-goal>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Create Emergency Fund goal
          </button>`
              : ""
          }
          <button class="btn secondary" type="button" data-add-goal>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add your first goal
          </button>
        </div>
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
  const unfundedGoals = sortedGoals.filter(
    (goal) => (Number(goal.target) || 0) > 0 && (Number(goal.monthly) || 0) === 0,
  );
  const suggestedMonthly =
    unfundedGoals.length > 0 && surplus > 0 ? Math.floor(surplus / unfundedGoals.length) : 0;

  const items = sortedGoals.map((goal, displayIdx) => {
    const index = state.goals.findIndex((g) => g.id === goal.id);
    const saved = Number(goal.saved) || 0;
    const target = Number(goal.target) || 0;
    const monthly = Number(goal.monthly) || 0;
    const progress = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const eta = calculateGoalETA(goal);
    const color = safeColor(goal.color || GOAL_COLORS[displayIdx % GOAL_COLORS.length]);
    const shouldSuggest = suggestedMonthly > 0 && target > 0 && monthly === 0;
    const suggestionHtml = shouldSuggest
      ? `<button class="btn ghost small goal-suggestion" type="button" data-goal-suggest="${suggestedMonthly}">
          Suggested: ${formatCurrency(suggestedMonthly)}/mo
        </button>`
      : "";

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
            ${suggestionHtml}
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
  ensureGoalsDelegation(goalList);
  syncFutureGoalSelect();
}

function getGoalContext(target) {
  const item = target.closest("[data-goal-index]");
  if (!item) return null;
  const index = Number(item.dataset.goalIndex);
  if (!Number.isFinite(index) || !state.goals[index]) return null;
  return { item, index, goal: state.goals[index] };
}

function ensureGoalsDelegation(goalList) {
  if (!goalList) return;
  if (goalList.dataset.delegationAttached === "true") return;

  goalList.addEventListener("input", (event) => {
    const ctx = getGoalContext(event.target);
    if (!ctx) return;
    const { item, index } = ctx;

    if (event.target.matches("[data-goal-target-input]")) {
      state.goals[index].target = Math.max(0, Number(event.target.value) || 0);
      scheduleSave();
      return;
    }

    if (event.target.matches("[data-goal-saved-input]")) {
      state.goals[index].saved = Math.max(0, Number(event.target.value) || 0);
      scheduleSave();
      return;
    }

    if (event.target.matches("[data-goal-monthly-input]")) {
      const value = Math.max(0, Number(event.target.value) || 0);
      state.goals[index].monthly = value;
      const slider = item.querySelector("[data-goal-monthly-slider]");
      if (slider && slider.value !== String(value)) {
        slider.value = value;
      }
      scheduleSave();
      return;
    }

    if (event.target.matches("[data-goal-monthly-slider]")) {
      const value = Math.max(0, Number(event.target.value) || 0);
      state.goals[index].monthly = value;
      const input = item.querySelector("[data-goal-monthly-input]");
      if (input && input.value !== String(value)) {
        input.value = value;
      }
      scheduleSave();
    }
  });

  goalList.addEventListener("change", (event) => {
    const ctx = getGoalContext(event.target);
    if (!ctx) {
      if (event.target.closest("[data-add-goal]")) {
        // Clicks are handled in the delegated click listener below.
      }
      return;
    }
    const { index } = ctx;

    if (
      event.target.matches("[data-goal-target-input]") ||
      event.target.matches("[data-goal-saved-input]") ||
      event.target.matches("[data-goal-monthly-input]") ||
      event.target.matches("[data-goal-monthly-slider]")
    ) {
      updateGoalList();
      return;
    }

    if (event.target.matches("[data-goal-date-input]")) {
      state.goals[index].targetDate = event.target.value || null;
      scheduleSave();
      updateGoalList();
      return;
    }

    if (event.target.matches("[data-goal-auto-allocate]")) {
      state.goals[index].autoAllocate = event.target.checked;
      scheduleSave();
    }
  });

  goalList.addEventListener("click", (event) => {
    const emergencyBtn = event.target.closest("[data-create-emergency-goal]");
    if (emergencyBtn) {
      const alreadyExists = state.goals.some((goal) => /emergency/i.test(goal.name || ""));
      if (alreadyExists) return;

      const monthlyExpenses = calculateTotalExpenses();
      const target = Math.max(0, Math.round(monthlyExpenses * 3));
      const newGoal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: "Emergency Fund",
        target,
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
      return;
    }

    const suggestBtn = event.target.closest("[data-goal-suggest]");
    if (suggestBtn) {
      const ctx = getGoalContext(suggestBtn);
      if (!ctx) return;
      const { index } = ctx;
      const suggested = Math.max(0, Number(suggestBtn.dataset.goalSuggest) || 0);
      state.goals[index].monthly = suggested;
      scheduleSave();
      updateGoalList();
      return;
    }

    // Auto-allocate button (delegated — button is re-created on each render)
    if (event.target.closest("[data-auto-allocate]")) {
      applyAutoAllocation();
      return;
    }

    const addGoalBtn = event.target.closest("[data-add-goal]");
    if (!addGoalBtn) return;

    const name = prompt("Enter goal name:");
    if (!name || !name.trim()) return;

    const newGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

  goalList.dataset.delegationAttached = "true";
  goalsDelegationAttached = true;
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

// Expose goals functions globally for cross-module access
Object.assign(window, {
  GOAL_COLORS,
  safeColor,
  calculateGoalETA,
  updateGoalList,
  updateDashboardVisibility,
  updateIncomeBreakdown,
  attachAddGoalListener,
});
