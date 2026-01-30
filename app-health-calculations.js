// FINANCIAL HEALTH DASHBOARD - CALCULATIONS
// ============================================================

// Calculate total assets
function calculateTotalAssets() {
  return Object.values(state.assets).reduce((sum, val) => sum + (val || 0), 0);
}

// Calculate total liabilities
function calculateTotalLiabilities() {
  return Object.values(state.liabilities).reduce((sum, val) => sum + (val || 0), 0);
}

// Calculate net worth
function calculateNetWorth() {
  return calculateTotalAssets() - calculateTotalLiabilities();
}

// Calculate monthly expenses total
function calculateMonthlyExpenses() {
  return Object.values(state.expenses).reduce((sum, val) => sum + (val || 0), 0);
}

// Calculate Emergency Buffer Score (25 points max)
// Based on months of expenses covered by liquid savings
function calculateEmergencyScore() {
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthlyExpenses = calculateMonthlyExpenses();

  if (monthlyExpenses <= 0) {
    if (liquidAssets > 0) {
      return {
        score: 15,
        months: 0,
        tip: "You have savings! Add your expenses to calculate full emergency cover",
      };
    }
    return { score: 0, months: 0, tip: "Enter your monthly expenses to calculate emergency cover" };
  }

  const monthsCovered = liquidAssets / monthlyExpenses;

  // Score: 6+ months = 25, scaled down for less
  let score = 0;
  let tip = "";

  if (monthsCovered >= 6) {
    score = 25;
    tip = `Excellent! ${monthsCovered.toFixed(1)} months of expenses covered`;
  } else if (monthsCovered >= 3) {
    score = Math.round(15 + ((monthsCovered - 3) / 3) * 10);
    tip = `Good: ${monthsCovered.toFixed(1)} months covered. Aim for 6 months`;
  } else if (monthsCovered > 0) {
    score = Math.round((monthsCovered / 3) * 15);
    tip = `${monthsCovered.toFixed(1)} months covered. Build towards 3-6 months`;
  } else {
    tip = "Start building an emergency fund for unexpected expenses";
  }

  return { score, months: monthsCovered, tip };
}

// Calculate Debt-to-Income Score (25 points max)
// Based on monthly debt payments vs income
function calculateDebtScore() {
  const monthlyIncome = state.income || 0;
  const monthlyDebtPayments =
    (state.expenses.mortgage || 0) +
    (state.expenses.carPayment || 0) +
    (state.expenses.creditCards || 0) +
    (state.expenses.personalLoans || 0) +
    (state.expenses.otherDebt || 0);

  if (monthlyIncome <= 0) {
    return { score: 0, ratio: 0, tip: "Enter your income to calculate debt ratio" };
  }

  const ratio = (monthlyDebtPayments / monthlyIncome) * 100;

  let score = 0;
  let tip = "";

  if (ratio <= 20) {
    score = 25;
    tip = `Excellent debt ratio: ${ratio.toFixed(0)}% of income`;
  } else if (ratio <= 35) {
    score = Math.round(15 + ((35 - ratio) / 15) * 10);
    tip = `Good: ${ratio.toFixed(0)}% debt-to-income. Under 20% is ideal`;
  } else if (ratio <= 50) {
    score = Math.round(5 + ((50 - ratio) / 15) * 10);
    tip = `${ratio.toFixed(0)}% debt-to-income is manageable but high`;
  } else {
    score = Math.max(0, Math.round(5 - ((ratio - 50) / 20) * 5));
    tip = `${ratio.toFixed(0)}% is high. Focus on reducing debt payments`;
  }

  return { score, ratio, tip };
}

// Calculate Savings Rate Score (20 points max)
// Based on surplus as percentage of income
function calculateSavingsScore() {
  const monthlyIncome = state.income || 0;
  const monthlyExpenses = calculateMonthlyExpenses();
  const surplus = monthlyIncome - monthlyExpenses;

  if (monthlyIncome <= 0) {
    return { score: 0, rate: 0, tip: "Enter your income to calculate savings rate" };
  }

  const rate = (surplus / monthlyIncome) * 100;

  let score = 0;
  let tip = "";

  if (rate >= 20) {
    score = 20;
    tip = `Excellent! Saving ${rate.toFixed(0)}% of income`;
  } else if (rate >= 10) {
    score = Math.round(10 + ((rate - 10) / 10) * 10);
    tip = `Good: ${rate.toFixed(0)}% savings rate. 20%+ is ideal`;
  } else if (rate > 0) {
    score = Math.round((rate / 10) * 10);
    tip = `${rate.toFixed(0)}% savings rate. Look for ways to increase`;
  } else {
    tip = "You're spending more than you earn. Review expenses";
  }

  return { score, rate, tip };
}

// Calculate Credit Utilization Score (15 points max)
// Based on credit used vs credit limit
function calculateCreditScore() {
  const { score: creditScore, creditLimit, creditUsed, provider } = state.creditScore;

  // If they have a credit score entered
  if (creditScore > 0 && provider) {
    let maxScore = 999;
    if (provider === "equifax") maxScore = 700;
    else if (provider === "transunion") maxScore = 710;

    // Cap at 100% to handle invalid scores
    const normalized = Math.min(100, (creditScore / maxScore) * 100);

    let score = 0;
    let band = "Not set";
    let tip = "";

    if (normalized >= 90) {
      score = 15;
      band = "Excellent";
      tip = "Excellent credit score";
    } else if (normalized >= 70) {
      score = 12;
      band = "Good";
      tip = "Good credit score - keep it up";
    } else if (normalized >= 50) {
      score = 8;
      band = "Fair";
      tip = "Fair credit - look for ways to improve";
    } else {
      score = 4;
      band = "Poor";
      tip = "Work on improving your credit score";
    }

    // Adjust for utilization if provided
    if (creditLimit > 0) {
      const utilization = (creditUsed / creditLimit) * 100;
      if (utilization <= 30) {
        // Good utilization - bonus
      } else if (utilization <= 50) {
        score = Math.max(0, score - 2);
        tip = `${utilization.toFixed(0)}% credit utilization - aim for under 30%`;
      } else {
        score = Math.max(0, score - 5);
        tip = `${utilization.toFixed(0)}% utilization is high - pay down balances`;
      }
    }

    return {
      score,
      band,
      tip,
      utilization: creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0,
    };
  }

  // Just utilization without credit score
  if (creditLimit > 0) {
    const utilization = (creditUsed / creditLimit) * 100;
    let score = 0;
    let tip = "";

    if (utilization <= 10) {
      score = 15;
      tip = "Excellent credit utilization";
    } else if (utilization <= 30) {
      score = 12;
      tip = `Good: ${utilization.toFixed(0)}% utilization`;
    } else if (utilization <= 50) {
      score = 6;
      tip = `${utilization.toFixed(0)}% - aim for under 30%`;
    } else {
      score = 2;
      tip = `${utilization.toFixed(0)}% is high - pay down balances`;
    }

    return { score, band: "Unknown", tip, utilization };
  }

  return {
    score: 0,
    band: "Not set",
    tip: "Add your credit score to track this pillar",
    utilization: 0,
  };
}

// Calculate Protection Score (15 points max)
// Based on insurance coverage
function calculateProtectionScore() {
  const { lifeInsurance, incomeProtection, criticalIllness, homeContents, buildings } = state.insurance;

  let score = 0;
  const covered = [];
  const missing = [];

  // Life insurance (3 points)
  if (lifeInsurance) {
    score += 3;
    covered.push("Life");
  } else {
    missing.push("Life insurance");
  }

  // Income protection (5 points - most important)
  if (incomeProtection) {
    score += 5;
    covered.push("Income");
  } else {
    missing.push("Income protection");
  }

  // Critical illness (3 points)
  if (criticalIllness) {
    score += 3;
    covered.push("Critical illness");
  } else {
    missing.push("Critical illness");
  }

  // Home insurance (2 points each)
  if (homeContents) {
    score += 2;
    covered.push("Contents");
  }
  if (buildings) {
    score += 2;
    covered.push("Buildings");
  }

  let tip = "";
  if (missing.length === 0) {
    tip = "Great coverage across all protection types";
  } else if (missing.length <= 2) {
    tip = `Consider: ${missing.slice(0, 2).join(", ")}`;
  } else {
    tip = "Review your protection needs";
  }

  return { score, covered, missing, tip };
}

// Calculate overall health score
function calculateHealthScore() {
  const emergency = calculateEmergencyScore();
  const debt = calculateDebtScore();
  const savings = calculateSavingsScore();
  const credit = calculateCreditScore();
  const protection = calculateProtectionScore();

  const safeScore = (value) => (Number.isFinite(value) ? value : 0);
  const total =
    safeScore(emergency.score) +
    safeScore(debt.score) +
    safeScore(savings.score) +
    safeScore(credit.score) +
    safeScore(protection.score);

  let status = "Getting started";
  if (total >= 85) status = "Excellent financial health";
  else if (total >= 70) status = "Strong financial position";
  else if (total >= 50) status = "Good foundation, room to grow";
  else if (total >= 30) status = "Building momentum";
  else if (total > 0) status = "Just getting started";

  return {
    total,
    status,
    pillars: { emergency, debt, savings, credit, protection },
  };
}
