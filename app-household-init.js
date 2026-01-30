// PHASE 3: HOUSEHOLD & SHARING - INIT & ORCHESTRATION
// ============================================================

function updateHouseholdUI() {
  renderHouseholdMembers();
  updateHouseholdSummary();
  updateSharedExpensesUI();
  renderSharedGoals();
  renderSettlementHistory();
}

function initHousehold() {
  // Member modal
  document.querySelector("[data-add-member]")?.addEventListener("click", openMemberModal);
  document.querySelectorAll("[data-close-member-modal]").forEach((btn) => {
    btn.addEventListener("click", closeMemberModal);
  });
  document.querySelector("[data-member-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveMemberFromForm();
  });

  // Shared expense modal
  document.querySelector("[data-add-shared-expense]")?.addEventListener("click", () =>
    openSharedExpenseModal(),
  );
  document.querySelectorAll("[data-close-shared-modal]").forEach((btn) => {
    btn.addEventListener("click", closeSharedExpenseModal);
  });
  document.querySelector("[data-shared-expense-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveSharedExpenseFromForm();
  });

  // Preset buttons
  document.querySelectorAll("[data-preset-expense]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openSharedExpenseModal(btn.getAttribute("data-preset-expense"));
    });
  });

  // Shared goals
  document.querySelectorAll("[data-add-shared-goal]").forEach((btn) => {
    btn.addEventListener("click", openSharedGoalModal);
  });
  document.querySelectorAll("[data-close-goal-modal]").forEach((btn) => {
    btn.addEventListener("click", closeSharedGoalModal);
  });
  document.querySelector("[data-shared-goal-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveSharedGoalFromForm();
  });

  // Settle up
  document.querySelector("[data-settle-up]")?.addEventListener("click", settleUp);

  // Reports
  document.querySelectorAll("[data-generate-report]").forEach((option) => {
    option.querySelector("button")?.addEventListener("click", () => {
      generateReport(option.getAttribute("data-generate-report"));
    });
  });
  document.querySelectorAll("[data-close-report-modal]").forEach((btn) => {
    btn.addEventListener("click", closeReportModal);
  });
  document.querySelector("[data-copy-report]")?.addEventListener("click", copyReport);
  document.querySelector("[data-download-household-report]")?.addEventListener("click", downloadReport);

  // Initial render
  updateHouseholdUI();
}

// Expose household functions globally for cross-module access
Object.assign(window, {
  updateHouseholdUI,
  initHousehold,
});
