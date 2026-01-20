// Event listeners
function attachEventListeners() {
  // Navigation buttons
  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (screens[currentIndex]?.dataset.screen === "goals") {
        updateGoalsFromCards();
      }
      if (screens[currentIndex]?.dataset.screen === "plan") {
        state.onboardingComplete = true;
        state.snapshotSet = true;
        scheduleSave();
      }
      showScreen(currentIndex + 1);
      updateSummary();
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showScreen(currentIndex - 1));
  });

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.go;
      const index = screens.findIndex((s) => s.dataset.screen === target);
      if (index !== -1) {
        if (target === "app") {
          state.onboardingComplete = true;
          scheduleSave();
        }
        showScreen(index);
        updateSummary();
      }
    });
  });

  // Restart button
  const restartBtn = document.querySelector("[data-restart]");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      Object.assign(state, { ...defaultState, expenses: { ...defaultState.expenses } });
      state.snapshotSet = false;
      state.onboardingComplete = false;
      showScreen(0);
      syncFormFromState();
      saveLocalState();
    });
  }

  // Form fields
  document.querySelectorAll("[data-field]").forEach((el) => {
    const field = el.dataset.field;
    const event = el.type === "checkbox" ? "change" : "input";

    el.addEventListener(event, () => {
      if (field === "annualSalary") {
        state.annualSalary = Math.max(0, Math.min(Number(el.value) || 0, 10000000));
        updateSalaryBreakdown();
      } else if (field === "studentLoan") {
        state.studentLoan = el.checked;
        updateSalaryBreakdown();
      } else if (field === "pensionContrib") {
        state.pensionContrib = el.checked;
        updateSalaryBreakdown();
      } else if (field === "taxCode") {
        state.taxCode = el.value.toUpperCase().trim();
        updateSalaryBreakdown();
      } else if (field === "savings") {
        state.savings = Number(el.value) || 0;
      } else if (field === "name") {
        state.name = el.value;
      } else if (field === "rewardPoints") {
        state.rewardPoints = Number(el.value) || 0;
        updateRewardsUI();
      } else if (field === "rewardStreak") {
        state.rewardStreak = Number(el.value) || 0;
        updateRewardsUI();
      } else {
        state[field] = el.type === "checkbox" ? el.checked : el.value;
      }
      scheduleSave();
    });
  });

  // Expense inputs
  document.querySelectorAll("[data-expense]").forEach((el) => {
    el.addEventListener("input", () => {
      const key = el.dataset.expense;
      state.expenses[key] = Number(el.value) || 0;
      updateCategoryTotals();
      updateBudgetSummary();
      scheduleSave();
    });
  });

  // Choice groups
  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    const field = group.dataset.choiceGroup;
    group.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        group.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state[field] = btn.dataset.value;
        if (field === "persona") updatePersona();
        scheduleSave();
      });
    });
  });

  // Category toggles
  document.querySelectorAll("[data-toggle-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.toggleCategory;
      const container = btn.closest(".expense-category");
      container?.classList.toggle("expanded");
    });
  });

  // Goal card checkboxes
  document.querySelectorAll("[data-goal-card]").forEach((card) => {
    const checkbox = card.querySelector("[data-goal-check]");
    card.addEventListener("click", (e) => {
      if (e.target.tagName !== "INPUT") {
        checkbox.checked = !checkbox.checked;
      }
      card.classList.toggle("active", checkbox.checked);
    });
  });

  // App tabs
  document.querySelectorAll("[data-tab-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tabTarget;
      document.querySelectorAll("[data-tab-target]").forEach((b) => b.classList.remove("is-active"));
      document.querySelectorAll("[data-tab]").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.querySelector(`[data-tab="${target}"]`)?.classList.add("is-active");

      if (target === "plan") {
        updateCashflowInsights();
      }
    });
  });

  // Dashboard toggles
  document.querySelectorAll("[data-dashboard-toggle]").forEach((el) => {
    el.addEventListener("change", () => {
      if (el.checked) {
        if (!state.dashboardWidgets.includes(el.value)) {
          state.dashboardWidgets.push(el.value);
        }
      } else {
        state.dashboardWidgets = state.dashboardWidgets.filter((k) => k !== el.value);
      }
      updateDashboardVisibility();
      scheduleSave();
    });
  });

  // Cashflow controls
  const scenarioSelect = document.querySelector("[data-scenario-select]");
  const cashflowMonthsInput = document.querySelector("[data-cashflow-months]");
  const scenarioCustom = document.querySelector("[data-scenario-custom]");
  const scenarioIncomeInput = document.querySelector("[data-scenario-income]");
  const scenarioExpenseInput = document.querySelector("[data-scenario-expense]");

  if (scenarioSelect) {
    scenarioSelect.addEventListener("change", () => {
      state.cashflowScenario = scenarioSelect.value;
      if (scenarioCustom) {
        scenarioCustom.style.display = state.cashflowScenario === "custom" ? "grid" : "none";
      }
      updateCashflowInsights();
      scheduleSave();
    });
  }

  if (cashflowMonthsInput) {
    cashflowMonthsInput.addEventListener("input", () => {
      state.cashflowMonths = Math.min(Math.max(Number(cashflowMonthsInput.value) || 12, 6), 36);
      updateCashflowInsights();
      scheduleSave();
    });
  }

  if (scenarioIncomeInput) {
    scenarioIncomeInput.addEventListener("input", () => {
      state.cashflowIncomeChange = Number(scenarioIncomeInput.value) || 0;
      updateCashflowInsights();
      scheduleSave();
    });
  }

  if (scenarioExpenseInput) {
    scenarioExpenseInput.addEventListener("input", () => {
      state.cashflowExpenseChange = Number(scenarioExpenseInput.value) || 0;
      updateCashflowInsights();
      scheduleSave();
    });
  }

  // Monte Carlo
  const monteRunBtn = document.querySelector("[data-monte-run]");
  if (monteRunBtn) {
    monteRunBtn.addEventListener("click", updateMonteCarlo);
  }

  const monteRiskSelect = document.querySelector("[data-monte-risk]");
  if (monteRiskSelect) {
    monteRiskSelect.addEventListener("change", () => {
      const returnEl = document.querySelector("[data-monte-return]");
      const volEl = document.querySelector("[data-monte-vol]");
      if (monteRiskSelect.value !== "custom" && returnEl && volEl) {
        returnEl.disabled = true;
        volEl.disabled = true;
      } else {
        returnEl.disabled = false;
        volEl.disabled = false;
      }
    });
  }

  const downloadReportBtn = document.querySelector("[data-download-report]");
  if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", () => {
      const content = document.querySelector("[data-report-content]")?.innerText || "";
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "monte-carlo-report.txt";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Future scenario
  const futureRunBtn = document.querySelector("[data-future-run]");
  if (futureRunBtn) {
    futureRunBtn.addEventListener("click", () => runFutureScenario({ useAI: true }));
  }

  const futureTypeSelect = document.querySelector("[data-future-type]");
  if (futureTypeSelect) {
    futureTypeSelect.addEventListener("change", updateFutureFormLabels);
  }
  updateFutureFormLabels();

  // Currency converter
  const converterInputs = document.querySelectorAll("[data-converter-amount], [data-converter-from], [data-converter-to]");
  converterInputs.forEach((el) => {
    el.addEventListener("input", updateConverter);
    el.addEventListener("change", updateConverter);
  });

  const swapBtn = document.querySelector("[data-converter-swap]");
  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const fromEl = document.querySelector("[data-converter-from]");
      const toEl = document.querySelector("[data-converter-to]");
      if (fromEl && toEl) {
        const temp = fromEl.value;
        fromEl.value = toEl.value;
        toEl.value = temp;
        updateConverter();
      }
    });
  }

  // Statement import handlers
  const statementDropzone = document.querySelector("[data-statement-dropzone]");
  const statementFileInput = document.querySelector("[data-statement-file]");
  const statementApply = document.querySelector("[data-statement-apply]");
  const statementClear = document.querySelector("[data-statement-clear]");

  if (statementDropzone) {
    statementDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      statementDropzone.classList.add("drag-over");
    });

    statementDropzone.addEventListener("dragleave", () => {
      statementDropzone.classList.remove("drag-over");
    });

    statementDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      statementDropzone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) handleStatementFile(file);
    });

    statementDropzone.addEventListener("click", () => {
      statementFileInput?.click();
    });
  }

  if (statementFileInput) {
    statementFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleStatementFile(file);
    });
  }

  if (statementApply) {
    statementApply.addEventListener("click", applyStatementToBudget);
  }

  if (statementClear) {
    statementClear.addEventListener("click", clearStatementImport);
  }

  // Beforeunload handler to prevent data loss
  window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges) {
      saveLocalState();
    }
  });
}

// Initialize
async function init() {
  const localData = loadLocalState();
  if (localData) {
    applyState(localData);
  }

  syncFormFromState();
  showInitialScreen();
  updateSummary();
  updateQuickActions();
  handleDailyCheckIn();
  updateRewardsUI();

  await loadFxRates();
  updateConverter();
  initEnhancedConverter();
  initSimulatorWizard();

  await initFirebase();

  // Initial Monte Carlo
  setTimeout(updateMonteCarlo, 500);
}

attachEventListeners();
init().then(() => {
  window.appInitialized = true;
});
