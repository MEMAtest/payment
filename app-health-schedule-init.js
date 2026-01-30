// FINANCIAL HEALTH DASHBOARD - SCHEDULING & INIT
// ============================================================

// Debounced health update to avoid excessive recalculations on rapid input
let healthUpdateTimer = null;

function scheduleHealthUpdate() {
  clearTimeout(healthUpdateTimer);
  healthUpdateTimer = setTimeout(() => {
    updateFinancialHealth();
    updateSmartInsights();
    updateVisualCharts();
    // Update score snapshot (will only save on first visit of month)
    takeScoreSnapshot();
    updateScoreHistoryUI();
    // Update gamification when financial data changes
    checkAchievements();
    updateGamificationUI();
  }, 150);
}

function initFinancialHealthDashboard() {
  // Setup accordion triggers
  document.querySelectorAll("[data-accordion]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const target = trigger.getAttribute("data-accordion");
      const content = document.querySelector(`[data-accordion-content="${target}"]`);

      // Toggle this accordion
      trigger.classList.toggle("active");
      if (content) content.classList.toggle("active");
    });
  });

  // Setup asset inputs
  document.querySelectorAll("[data-asset]").forEach((input) => {
    const key = input.getAttribute("data-asset");
    input.value = state.assets[key] || "";
    input.addEventListener("input", () => {
      state.assets[key] = parseFloat(input.value) || 0;
      if (key === "cashSavings" || key === "cashISA") {
        state.savings = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
        document.querySelectorAll('[data-field="savings"]').forEach((el) => {
          if (el === input) return;
          el.value = state.savings || "";
        });
      }
      if (key === "pensionValue") {
        if (typeof loadRetirementSettings === "function" && typeof saveRetirementSettings === "function") {
          const settings = loadRetirementSettings();
          settings.pensionPot = state.assets.pensionValue || 0;
          saveRetirementSettings(settings);
        }
        if (typeof updateRetirementUI === "function") {
          updateRetirementUI();
        }
      }
      scheduleSave();
      scheduleHealthUpdate();
      if (typeof updateSummary === "function") {
        updateSummary();
      }
    });
  });

  const liquidSavings = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  if (liquidSavings > 0 && state.savings !== liquidSavings) {
    state.savings = liquidSavings;
    document.querySelectorAll('[data-field="savings"]').forEach((el) => {
      el.value = state.savings || "";
    });
  }

  // Setup liability inputs
  document.querySelectorAll("[data-liability]").forEach((input) => {
    const key = input.getAttribute("data-liability");
    input.value = state.liabilities[key] || "";
    input.addEventListener("input", () => {
      state.liabilities[key] = parseFloat(input.value) || 0;
      scheduleSave();
      scheduleHealthUpdate();
      if (typeof updateSummary === "function") {
        updateSummary();
      }
    });
  });

  // Setup credit score inputs
  document.querySelectorAll("[data-credit]").forEach((input) => {
    const key = input.getAttribute("data-credit");
    input.value = state.creditScore[key] || "";

    // Use 'change' for SELECT, 'input' for others to avoid duplicate events
    const eventType = input.tagName === "SELECT" ? "change" : "input";
    input.addEventListener(eventType, () => {
      if (input.tagName === "SELECT") {
        state.creditScore[key] = input.value;
      } else {
        state.creditScore[key] = parseFloat(input.value) || 0;
      }
      state.creditScore.lastUpdated = new Date().toISOString();
      scheduleSave();
      scheduleHealthUpdate();
    });
  });

  // Setup insurance checkboxes and amounts
  document.querySelectorAll("[data-insurance]").forEach((input) => {
    const key = input.getAttribute("data-insurance");
    input.checked = state.insurance[key] || false;
    input.addEventListener("change", () => {
      state.insurance[key] = input.checked;
      scheduleSave();
      scheduleHealthUpdate();
    });
  });

  document.querySelectorAll("[data-insurance-amount]").forEach((input) => {
    const key = input.getAttribute("data-insurance-amount");
    input.value = state.insurance[key] || "";
    input.addEventListener("input", () => {
      state.insurance[key] = parseFloat(input.value) || 0;
      scheduleSave();
      scheduleHealthUpdate();
    });
  });

  // Initial update
  updateFinancialHealth();
}

// Expose health dashboard functions globally
Object.assign(window, {
  initFinancialHealthDashboard,
  scheduleHealthUpdate,
});
