// SMART INSIGHTS ENGINE - WHAT-IF SCENARIOS
// ============================================================

// What-If scenario calculations
function calculateWhatIf(scenario) {
  const monthlyIncome = state.income || 0;
  const monthlyExpenses = calculateMonthlyExpenses();
  const currentSurplus = monthlyIncome - monthlyExpenses;
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);

  const results = {};

  switch (scenario.type) {
    case "extraSavings": {
      const extraAmount = scenario.amount || 100;
      const months = scenario.months || 12;
      const totalExtra = extraAmount * months;
      const newEmergencyMonths = monthlyExpenses > 0 ? (liquidAssets + totalExtra) / monthlyExpenses : 0;

      results.title = `Save £${extraAmount} more per month`;
      results.projections = [
        { label: "Extra saved in 1 year", value: formatCurrency(extraAmount * 12) },
        { label: "Extra saved in 5 years", value: formatCurrency(extraAmount * 60) },
        { label: "Emergency fund grows to", value: `${newEmergencyMonths.toFixed(1)} months` },
      ];
      results.impact = `+${Math.round((extraAmount / (monthlyIncome || 1)) * 100)}% savings rate boost`;
      break;
    }

    case "debtPayoff": {
      const extraPayment = scenario.amount || 100;
      const totalDebt =
        (state.liabilities.creditCardBalance || 0) +
        (state.liabilities.personalLoansBalance || 0) +
        (state.liabilities.carFinanceBalance || 0);

      if (totalDebt > 0) {
        const currentMonthlyDebt =
          (state.expenses.creditCards || 0) +
          (state.expenses.personalLoans || 0) +
          (state.expenses.carPayment || 0);
        const avgInterest = 0.18; // Assume 18% APR average
        const monthlyRate = avgInterest / 12;

        // Simplified payoff calculation
        const monthsWithExtra = totalDebt / (currentMonthlyDebt + extraPayment);
        const monthsWithout = currentMonthlyDebt > 0 ? totalDebt / currentMonthlyDebt : 999;
        const monthsSaved = Math.max(0, monthsWithout - monthsWithExtra);
        const interestSaved = monthsSaved * (totalDebt * monthlyRate);

        results.title = `Pay £${extraPayment} extra on debt`;
        results.projections = [
          { label: "Months faster debt-free", value: `${monthsSaved.toFixed(0)} months` },
          { label: "Interest saved (est.)", value: formatCurrency(interestSaved) },
          {
            label: "Debt-free date moves from",
            value: `${Math.ceil(monthsWithout)} to ${Math.ceil(monthsWithExtra)} months`,
          },
        ];
        results.impact = `Save ~${formatCurrency(interestSaved)} in interest`;
      } else {
        results.title = "No debt to pay off";
        results.projections = [{ label: "Status", value: "Debt-free!" }];
        results.impact = "Already debt-free - focus on growing savings";
      }
      break;
    }

    case "emergencyRunway": {
      const monthsRunway = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
      const reducedExpenses = monthlyExpenses * 0.7; // Assume 30% cut in emergency
      const extendedRunway = reducedExpenses > 0 ? liquidAssets / reducedExpenses : 0;

      results.title = "If you lost your income";
      results.projections = [
        { label: "Current runway", value: `${monthsRunway.toFixed(1)} months` },
        { label: "With 30% expense cut", value: `${extendedRunway.toFixed(1)} months` },
        { label: "Recommended buffer", value: "6+ months" },
      ];

      if (monthsRunway < 3) {
        results.impact = "Priority: Build emergency fund to 3+ months";
      } else if (monthsRunway < 6) {
        results.impact = "Good start - keep building to 6 months";
      } else {
        results.impact = "Strong position - you have breathing room";
      }
      break;
    }

    case "goalAcceleration": {
      const extraAmount = scenario.amount || 100;
      const goals = state.goals || [];
      const projections = [];

      goals.slice(0, 3).forEach((goal) => {
        const remaining = goal.target - goal.saved;
        const currentMonthly = goal.monthly || 0;
        const currentMonths = currentMonthly > 0 ? remaining / currentMonthly : 999;
        const newMonths = currentMonthly + extraAmount > 0 ? remaining / (currentMonthly + extraAmount) : 999;
        const monthsSaved = Math.max(0, currentMonths - newMonths);

        if (remaining > 0) {
          projections.push({
            label: goal.name,
            value: `${monthsSaved.toFixed(0)} months faster`,
          });
        }
      });

      results.title = `Add £${extraAmount}/month to goals`;
      results.projections =
        projections.length > 0
          ? projections
          : [{ label: "No active goals", value: "Set a goal first" }];
      results.impact = "Reach your goals sooner";
      break;
    }

    default:
      results.title = "What-if";
      results.projections = [];
      results.impact = "";
  }

  return results;
}

// Update What-If results display
function updateWhatIfResults() {
  const slider = document.querySelector("[data-whatif-slider]");
  const scenarioSelect = document.querySelector("[data-whatif-scenario]");
  const resultsEl = document.querySelector("[data-whatif-results]");

  if (!slider || !scenarioSelect || !resultsEl) return;

  const amount = parseInt(slider.value, 10) || 100;
  const scenarioType = scenarioSelect.value || "extraSavings";

  const results = calculateWhatIf({ type: scenarioType, amount });

  resultsEl.innerHTML = `
    <h4>${escapeHtml(results.title)}</h4>
    <div class="whatif-projections">
      ${results.projections
        .map(
          (p) => `
        <div class="whatif-row">
          <span class="whatif-label">${escapeHtml(p.label)}</span>
          <span class="whatif-value">${escapeHtml(p.value)}</span>
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="whatif-impact">${escapeHtml(results.impact)}</div>
  `;
}
