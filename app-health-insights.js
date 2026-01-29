// FINANCIAL HEALTH DASHBOARD - VULNERABILITIES & ROADMAP
// ============================================================

// Detect financial vulnerabilities
function detectVulnerabilities() {
  const vulnerabilities = [];
  const monthlyExpenses = calculateMonthlyExpenses();
  const monthlyIncome = state.income || 0;
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);

  // No emergency fund
  if (monthlyExpenses > 0 && liquidAssets < monthlyExpenses) {
    vulnerabilities.push({
      id: "no-emergency",
      severity: "critical",
      icon: "🚨",
      title: "No Emergency Fund",
      description: "You have less than 1 month of expenses in accessible savings",
      action: "Set up automatic transfers to savings",
      resolved: false,
    });
  }

  // High credit utilization
  if (state.creditScore.creditLimit > 0) {
    const utilization = (state.creditScore.creditUsed / state.creditScore.creditLimit) * 100;
    if (utilization > 50) {
      vulnerabilities.push({
        id: "high-credit",
        severity: "critical",
        icon: "💳",
        title: "High Credit Utilization",
        description: `Using ${utilization.toFixed(0)}% of available credit. This hurts your credit score.`,
        action: "Focus on paying down credit card balances",
        resolved: false,
      });
    }
  }

  // Spending more than earning
  if (monthlyIncome > 0 && monthlyExpenses > monthlyIncome) {
    vulnerabilities.push({
      id: "overspending",
      severity: "critical",
      icon: "📉",
      title: "Spending Exceeds Income",
      description: `Spending £${(monthlyExpenses - monthlyIncome).toFixed(0)} more than you earn each month`,
      action: "Review expenses and identify cuts",
      resolved: false,
    });
  }

  // No income protection
  if (!state.insurance.incomeProtection && monthlyIncome > 2000) {
    vulnerabilities.push({
      id: "no-income-protection",
      severity: "warning",
      icon: "🏥",
      title: "No Income Protection",
      description: "If you couldn't work due to illness, you'd lose your income",
      action: "Research income protection insurance options",
      resolved: false,
    });
  }

  // No life insurance (if has dependents - we'll assume if mortgage or kids expenses)
  const hasDependents =
    (state.expenses.childcare || 0) > 0 ||
    (state.expenses.kidsActivities || 0) > 0 ||
    (state.assets.propertyValue || 0) > 0;
  if (!state.insurance.lifeInsurance && hasDependents) {
    vulnerabilities.push({
      id: "no-life-insurance",
      severity: "warning",
      icon: "👨‍👩‍👧",
      title: "No Life Insurance",
      description: "Your family would be financially vulnerable if something happened to you",
      action: "Get life insurance quotes to protect your family",
      resolved: false,
    });
  }

  // High debt-to-income
  const monthlyDebt =
    (state.expenses.mortgage || 0) +
    (state.expenses.carPayment || 0) +
    (state.expenses.creditCards || 0) +
    (state.expenses.personalLoans || 0);
  if (monthlyIncome > 0 && monthlyDebt / monthlyIncome > 0.5) {
    vulnerabilities.push({
      id: "high-dti",
      severity: "warning",
      icon: "⚖️",
      title: "High Debt-to-Income Ratio",
      description: `${((monthlyDebt / monthlyIncome) * 100).toFixed(0)}% of income goes to debt payments`,
      action: "Consider debt consolidation or snowball method",
      resolved: false,
    });
  }

  return vulnerabilities;
}

// Generate improvement roadmap
function generateRoadmap(healthScore, vulnerabilities) {
  const roadmap = [];
  const monthlyExpenses = calculateMonthlyExpenses();
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  // Priority 1: Fix critical vulnerabilities
  vulnerabilities
    .filter((v) => v.severity === "critical")
    .forEach((v) => {
      roadmap.push({
        step: roadmap.length + 1,
        title: v.title,
        description: v.action,
        impact: "+10-15 pts",
        completed: false,
      });
    });

  // Priority 2: Build emergency fund if under 3 months
  if (monthsCovered < 3 && !vulnerabilities.find((v) => v.id === "no-emergency")) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Build Emergency Fund",
      description: `Save £${(monthlyExpenses * 3 - liquidAssets).toFixed(0)} more for 3-month buffer`,
      impact: "+5-10 pts",
      completed: false,
    });
  }

  // Priority 3: Improve savings rate
  if (healthScore.pillars.savings.score < 15) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Increase Savings Rate",
      description: "Aim to save at least 15-20% of your income each month",
      impact: "+5-8 pts",
      completed: false,
    });
  }

  // Priority 4: Get protection in place
  if (healthScore.pillars.protection.score < 10) {
    const missing = healthScore.pillars.protection.missing;
    if (missing.includes("Income protection")) {
      roadmap.push({
        step: roadmap.length + 1,
        title: "Get Income Protection",
        description: "Protects your income if you can't work due to illness",
        impact: "+5 pts",
        completed: false,
      });
    }
  }

  // Priority 5: Credit score improvement
  if (healthScore.pillars.credit.score < 10 && state.creditScore.score === 0) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Check Your Credit Score",
      description: "Get a free score from ClearScore, Credit Karma, or MSE Credit Club",
      impact: "+3-5 pts",
      completed: false,
    });
  }

  // Priority 6: Build towards 6-month emergency fund
  if (monthsCovered >= 3 && monthsCovered < 6) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Extend Emergency Fund",
      description: `Save £${(monthlyExpenses * 6 - liquidAssets).toFixed(0)} more for 6-month buffer`,
      impact: "+5 pts",
      completed: false,
    });
  }

  // Limit to 6 items
  return roadmap.slice(0, 6);
}
