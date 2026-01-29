// PHASE 3: HOUSEHOLD & SHARING - SHARED GOALS
// ============================================================

function renderSharedGoals() {
  const container = document.querySelector("[data-shared-goals]");
  if (!container) return;

  const goals = loadSharedGoals();

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="shared-goal-placeholder">
        <div class="goal-icon">🎯</div>
        <p>Create shared goals like holiday funds, home improvements, or emergency savings</p>
        <button class="btn secondary" type="button" data-add-shared-goal>Create First Goal</button>
      </div>
    `;

    container.querySelector("[data-add-shared-goal]")?.addEventListener("click", openSharedGoalModal);
    return;
  }

  container.innerHTML = goals
    .map((goal) => {
      const totalContrib = (goal.yourContrib || 0) + (goal.partnerContrib || 0);
      const monthsToGoal =
        totalContrib > 0 ? Math.ceil((goal.target - (goal.saved || 0)) / totalContrib) : 0;
      const progress = goal.target > 0 ? Math.min(100, ((goal.saved || 0) / goal.target) * 100) : 0;

      return `
      <div class="shared-goal-item" data-goal-id="${escapeHtml(goal.id)}">
        <div class="goal-header">
          <div class="goal-title">
            <span class="goal-emoji">🎯</span>
            <h4>${escapeHtml(goal.name)}</h4>
          </div>
          <div class="goal-target">
            <span class="target-amount">${formatCurrency(goal.target)}</span>
            ${
              goal.targetDate
                ? `<span class="target-date">by ${new Date(goal.targetDate).toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric",
                  })}</span>`
                : ""
            }
          </div>
        </div>
        <div class="goal-progress-bar">
          <span class="progress-fill" style="width: ${progress}%"></span>
        </div>
        <div class="goal-contributions">
          <div class="contribution">
            <span class="contribution-avatar">👤</span>
            <span class="contribution-amount">${formatCurrency(goal.yourContrib || 0)}/month</span>
          </div>
          <div class="contribution">
            <span class="contribution-avatar">💑</span>
            <span class="contribution-amount">${formatCurrency(goal.partnerContrib || 0)}/month</span>
          </div>
          <span class="muted">${monthsToGoal > 0 ? `${monthsToGoal} months to go` : ""}</span>
        </div>
        <button class="btn ghost small" type="button" data-delete-goal="${escapeHtml(goal.id)}" style="margin-top:12px">Remove Goal</button>
      </div>
    `;
    })
    .join("");

  // Attach delete handlers
  container.querySelectorAll("[data-delete-goal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirmation(
        "Are you sure you want to remove this shared goal?",
        "Remove Goal",
        "Remove",
        "Cancel",
      );
      if (confirmed) {
        deleteSharedGoal(btn.getAttribute("data-delete-goal"));
        showNotification("Shared goal removed", "success");
      }
    });
  });
}

function openSharedGoalModal() {
  const modal = document.querySelector("[data-shared-goal-modal]");
  if (modal) {
    document.querySelector("[data-shared-goal-form]")?.reset();
    modal.hidden = false;
  }
}

function closeSharedGoalModal() {
  const modal = document.querySelector("[data-shared-goal-modal]");
  if (modal) modal.hidden = true;
}

function saveSharedGoalFromForm() {
  const name = document.querySelector("[data-goal-name]")?.value?.trim();
  const target = parseFloat(document.querySelector("[data-goal-target]")?.value) || 0;
  const targetDate = document.querySelector("[data-goal-date]")?.value || null;
  const yourContrib = parseFloat(document.querySelector("[data-goal-your-contrib]")?.value) || 0;
  const partnerContrib = parseFloat(document.querySelector("[data-goal-partner-contrib]")?.value) || 0;

  if (!name || target <= 0) {
    showNotification("Please enter a goal name and target amount", "warning");
    return;
  }

  const goals = loadSharedGoals();
  goals.push({
    id: generateSharedGoalId(),
    name,
    target,
    targetDate,
    yourContrib,
    partnerContrib,
    saved: 0,
    createdAt: new Date().toISOString(),
  });

  saveSharedGoals(goals);
  closeSharedGoalModal();
  renderSharedGoals();
}

function deleteSharedGoal(id) {
  const goals = loadSharedGoals().filter((g) => g.id !== id);
  saveSharedGoals(goals);
  renderSharedGoals();
}
