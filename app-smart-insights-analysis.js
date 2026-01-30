// SMART INSIGHTS ENGINE - ANALYSIS & TIPS
// ============================================================

// Calculate peer comparison insights
function calculatePeerComparison() {
  const insights = [];
  const annualSalary = state.annualSalary || 0;
  const monthlyIncome = state.income || 0;
  const monthlyExpenses = calculateMonthlyExpenses();
  const savingsAmount = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (savingsAmount / monthlyIncome) * 100 : 0;

  if (annualSalary <= 0 || monthlyIncome <= 0) {
    return [
      {
        type: "info",
        icon: "📊",
        title: "Add your income",
        message: "Enter your salary to see how you compare to UK averages",
        action: null,
      },
    ];
  }

  const bracket = getIncomeBracket(annualSalary);
  const benchmarks = UK_BENCHMARKS.savingsRate[bracket];

  // Savings rate comparison
  let percentile = 0;
  let savingsMessage = "";
  if (savingsRate >= benchmarks.excellent) {
    percentile = 90;
    savingsMessage = `Excellent! You save ${savingsRate.toFixed(0)}% of income - top 10% for your income level`;
  } else if (savingsRate >= benchmarks.good) {
    percentile = 70;
    savingsMessage = `Great! You save ${savingsRate.toFixed(0)}% - better than 70% of UK earners in your bracket`;
  } else if (savingsRate >= benchmarks.fair) {
    percentile = 50;
    savingsMessage = `You save ${savingsRate.toFixed(0)}% - around average for your income level`;
  } else if (savingsRate > 0) {
    percentile = 30;
    savingsMessage = `You save ${savingsRate.toFixed(0)}% - below average. Target: ${benchmarks.good}%+ for your income`;
  } else {
    percentile = 10;
    savingsMessage = `You're spending more than you earn. UK average for your income: ${benchmarks.fair}% savings rate`;
  }

  insights.push({
    type: savingsRate >= benchmarks.good ? "positive" : savingsRate >= benchmarks.fair ? "neutral" : "warning",
    icon: "💰",
    title: "Savings Rate",
    message: savingsMessage,
    percentile,
    metric: `${savingsRate.toFixed(0)}%`,
    benchmark: `UK avg: ${benchmarks.fair}%`,
  });

  // Debt-to-income comparison
  const monthlyDebt =
    (state.expenses.mortgage || 0) +
    (state.expenses.carPayment || 0) +
    (state.expenses.creditCards || 0) +
    (state.expenses.personalLoans || 0) +
    (state.expenses.otherDebt || 0);
  const dti = monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;

  let dtiPercentile = 0;
  let dtiMessage = "";
  if (dti <= UK_BENCHMARKS.debtToIncome.excellent) {
    dtiPercentile = 85;
    dtiMessage = `Only ${dti.toFixed(0)}% of income on debt - you're in great shape`;
  } else if (dti <= UK_BENCHMARKS.debtToIncome.good) {
    dtiPercentile = 65;
    dtiMessage = `${dti.toFixed(0)}% debt-to-income is healthy and manageable`;
  } else if (dti <= UK_BENCHMARKS.debtToIncome.fair) {
    dtiPercentile = 40;
    dtiMessage = `${dti.toFixed(0)}% on debt is workable but limiting your savings potential`;
  } else {
    dtiPercentile = 20;
    dtiMessage = `${dti.toFixed(0)}% on debt is high - focus on paying down balances`;
  }

  insights.push({
    type: dti <= UK_BENCHMARKS.debtToIncome.good ? "positive" : dti <= UK_BENCHMARKS.debtToIncome.fair ? "neutral" : "warning",
    icon: "📊",
    title: "Debt-to-Income",
    message: dtiMessage,
    percentile: dtiPercentile,
    metric: `${dti.toFixed(0)}%`,
    benchmark: `Target: <${UK_BENCHMARKS.debtToIncome.good}%`,
  });

  // Emergency fund comparison
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  let efPercentile = 0;
  let efMessage = "";
  if (monthsCovered >= 6) {
    efPercentile = 80;
    efMessage = `${monthsCovered.toFixed(1)} months of expenses saved - better than 80% of UK adults`;
  } else if (monthsCovered >= 3) {
    efPercentile = 55;
    efMessage = `${monthsCovered.toFixed(1)} months saved - you're ahead of most. Push to 6 months`;
  } else if (monthsCovered >= 1) {
    efPercentile = 35;
    efMessage = `${monthsCovered.toFixed(1)} months buffer. 46% of UK adults have less than £1000 saved`;
  } else {
    efPercentile = 15;
    efMessage = "Building an emergency fund should be priority #1";
  }

  insights.push({
    type: monthsCovered >= 3 ? "positive" : monthsCovered >= 1 ? "neutral" : "warning",
    icon: "🛡️",
    title: "Emergency Buffer",
    message: efMessage,
    percentile: efPercentile,
    metric: `${monthsCovered.toFixed(1)} months`,
    benchmark: "Target: 3-6 months",
  });

  return insights;
}

// Analyze spending trends from import history
function analyzeSpendingTrends() {
  const trends = [];
  const monthlyIncome = state.income || 0;

  if (monthlyIncome <= 0) return trends;

  // Category analysis vs UK benchmarks
  const categories = [
    { key: "housing", label: "Housing", fields: ["mortgage", "councilTax", "homeInsurance"] },
    { key: "transport", label: "Transport", fields: ["carPayment", "carInsurance", "fuel", "publicTransport"] },
    { key: "food", label: "Food", fields: ["groceries", "diningOut", "coffeeSnacks"] },
    { key: "utilities", label: "Utilities", fields: ["energy", "water", "internet"] },
    { key: "entertainment", label: "Entertainment", fields: ["streaming", "entertainment", "subscriptions", "gym"] },
  ];

  categories.forEach((cat) => {
    const total = cat.fields.reduce((sum, f) => sum + (state.expenses[f] || 0), 0);
    const percentOfIncome = (total / monthlyIncome) * 100;
    const ukAvg = UK_BENCHMARKS.spendingByCategory[cat.key] || 10;
    const diff = percentOfIncome - ukAvg;

    if (Math.abs(diff) > 5) {
      trends.push({
        category: cat.label,
        amount: total,
        percentOfIncome,
        ukAverage: ukAvg,
        difference: diff,
        status: diff > 0 ? "above" : "below",
        icon: diff > 5 ? "📈" : "📉",
        message:
          diff > 0
            ? `${cat.label} is ${diff.toFixed(0)}% above UK average`
            : `${cat.label} is ${Math.abs(diff).toFixed(0)}% below UK average - great!`,
      });
    }
  });

  // Sort by largest overspend first
  trends.sort((a, b) => b.difference - a.difference);

  return trends;
}

// Detect recurring subscriptions from imported transactions
function auditSubscriptions() {
  const subscriptions = [];

  // Get recurring payments detected from imports
  let importHistory = [];
  try {
    const stored = localStorage.getItem(IMPORT_STORAGE_KEY);
    if (stored) importHistory = JSON.parse(stored);
  } catch (e) {
    // ignore
  }

  // Also analyze current expense fields that are likely subscriptions
  const subFields = [
    { field: "streaming", label: "Streaming Services", icon: "📺" },
    { field: "subscriptions", label: "Other Subscriptions", icon: "📦" },
    { field: "gym", label: "Gym Membership", icon: "💪" },
    { field: "internet", label: "Internet/Broadband", icon: "🌐" },
  ];

  let totalMonthly = 0;
  subFields.forEach((sub) => {
    const amount = state.expenses[sub.field] || 0;
    if (amount > 0) {
      subscriptions.push({
        name: sub.label,
        amount,
        annual: amount * 12,
        icon: sub.icon,
        source: "manual",
      });
      totalMonthly += amount;
    }
  });

  // Check imported recurring payments
  if (importHistory.length > 0) {
    const latestImport = importHistory[importHistory.length - 1];
    if (latestImport.recurring && latestImport.recurring.length > 0) {
      latestImport.recurring.forEach((rec) => {
        // Avoid duplicates with manual entries
        const isDuplicate = subscriptions.some((s) =>
          s.name.toLowerCase().includes(rec.description.toLowerCase().split(" ")[0]),
        );
        if (!isDuplicate && rec.avgAmount > 0) {
          subscriptions.push({
            name: rec.description,
            amount: Math.abs(rec.avgAmount),
            annual: Math.abs(rec.avgAmount) * 12,
            icon: "🔄",
            source: "imported",
            count: rec.count,
          });
          totalMonthly += Math.abs(rec.avgAmount);
        }
      });
    }
  }

  return {
    subscriptions: subscriptions.sort((a, b) => b.amount - a.amount),
    totalMonthly,
    totalAnnual: totalMonthly * 12,
  };
}

// Generate personalized smart tips
function generateSmartTips() {
  const tips = [];
  const monthlyIncome = state.income || 0;
  const monthlyExpenses = calculateMonthlyExpenses();
  const surplus = monthlyIncome - monthlyExpenses;
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  const totalAssets = Object.values(state.assets || {}).reduce((sum, val) => sum + (val || 0), 0);
  const totalLiabilities = Object.values(state.liabilities || {}).reduce((sum, val) => sum + (val || 0), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Priority 1: Critical issues
  if (surplus < 0) {
    tips.push({
      priority: 1,
      icon: "🚨",
      title: "Spending exceeds income",
      tip: `You're spending £${Math.abs(surplus).toFixed(0)} more than you earn. Review your largest expenses first.`,
      action: "Review expenses",
      category: "urgent",
    });
  }

  if (monthsCovered < 1 && monthlyExpenses > 0) {
    tips.push({
      priority: 1,
      icon: "⚠️",
      title: "Build an emergency buffer",
      tip: "46% of UK adults have less than £1,000 saved. Start with £1,000, then build to 3 months of expenses.",
      action: "Set savings goal",
      category: "urgent",
    });
  }

  if (monthlyIncome > 0 && monthlyExpenses > 0) {
    const savingsRate = (surplus / monthlyIncome) * 100;
    if (savingsRate >= 20) {
      tips.push({
        priority: 2,
        icon: "✅",
        title: "Strong savings rate",
        tip: `You're saving about ${savingsRate.toFixed(0)}% of your income (£${Math.max(0, surplus).toFixed(0)}/mo). Keep this momentum.`,
        action: "Review goals",
        category: "growth",
      });
    } else if (savingsRate > 0) {
      tips.push({
        priority: 2,
        icon: "📊",
        title: "Boost your savings rate",
        tip: `You're saving ${savingsRate.toFixed(0)}% of income. A target of 20% would add roughly £${(
          (monthlyIncome * 0.2) - surplus
        ).toFixed(0)}/mo.`,
        action: "Trim expenses",
        category: "savings",
      });
    }
  }

  if (netWorth !== 0 && monthlyExpenses > 0) {
    const monthsOfSpending = Math.abs(netWorth) / monthlyExpenses;
    tips.push({
      priority: 3,
      icon: "🧮",
      title: "Net worth snapshot",
      tip: `Your net worth is ${formatCurrency(netWorth)}. That's roughly ${monthsOfSpending.toFixed(1)} months of your current spending ${netWorth >= 0 ? "covered" : "below zero"}.`,
      action: "Update net worth",
      category: "insight",
    });
  }

  // Priority 2: Optimization opportunities
  const diningOut = state.expenses.diningOut || 0;
  const coffeeSnacks = state.expenses.coffeeSnacks || 0;
  if (diningOut + coffeeSnacks > 200) {
    const potential = (diningOut + coffeeSnacks) * 0.3;
    tips.push({
      priority: 2,
      icon: "🍽️",
      title: "Dining out opportunity",
      tip: `Cutting dining/coffee by 30% could save £${potential.toFixed(0)}/month (£${(
        potential * 12
      ).toFixed(0)}/year)`,
      action: "Track spending",
      category: "savings",
    });
  }

  const subscriptions = auditSubscriptions();
  if (subscriptions.totalMonthly > 100) {
    tips.push({
      priority: 2,
      icon: "📺",
      title: "Subscription audit",
      tip: `You spend £${subscriptions.totalMonthly.toFixed(0)}/month on subscriptions (£${subscriptions.totalAnnual.toFixed(0)}/year). Review for unused services.`,
      action: "Audit subscriptions",
      category: "savings",
    });
  }

  // Priority 3: Growth opportunities
  if (!state.insurance.incomeProtection && monthlyIncome > 2500) {
    tips.push({
      priority: 3,
      icon: "🏥",
      title: "Protect your income",
      tip: "Income protection insurance replaces your salary if you can't work. Essential for anyone without 12+ months saved.",
      action: "Research options",
      category: "protection",
    });
  }

  if (state.assets.stocksISA === 0 && state.assets.cashISA > 10000) {
    tips.push({
      priority: 3,
      icon: "📈",
      title: "Consider investing",
      tip: "With a solid cash buffer, a Stocks & Shares ISA could help your money grow faster over 5+ years.",
      action: "Learn about ISAs",
      category: "growth",
    });
  }

  if (monthsCovered >= 6 && surplus > 500) {
    tips.push({
      priority: 3,
      icon: "🎯",
      title: "Max out your ISA",
      tip: "You can put up to £20,000/year in ISAs tax-free. Consider increasing your monthly contributions.",
      action: "Review ISA allowance",
      category: "growth",
    });
  }

  if (typeof loadRetirementSettings === "function") {
    const retireSettings = loadRetirementSettings();
    const yearsToRetirement = Math.max(0, (retireSettings.retireAge || 65) - (retireSettings.currentAge || 0));
    if (yearsToRetirement > 0) {
      tips.push({
        priority: 3,
        icon: "🕒",
        title: "Retirement timeline",
        tip: `You have about ${yearsToRetirement} years to your target age ${retireSettings.retireAge || 65}. Review contributions to stay on track.`,
        action: "Adjust retirement plan",
        category: "retirement",
      });
    }
  }

  // Priority 4: Quick wins
  if (state.expenses.energy > 150) {
    tips.push({
      priority: 4,
      icon: "⚡",
      title: "Energy bill check",
      tip: "Compare energy tariffs - switching could save £200-400/year. Check MSE's Cheap Energy Club.",
      action: "Compare tariffs",
      category: "savings",
    });
  }

  // Sort by priority
  return tips.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
