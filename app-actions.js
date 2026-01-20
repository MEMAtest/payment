// One-Click Actions System
const QUICK_ACTIONS = {
  "auto-save": {
    name: "Auto-Save Surplus",
    icon: "piggy-bank",
    description: "Distribute your surplus to savings goals",
  },
  "subscription-audit": {
    name: "Subscription Audit",
    icon: "scissors",
    description: "Review subscriptions for potential savings",
  },
  "round-up": {
    name: "Round-Up Savings",
    icon: "trending-up",
    description: "Calculate potential round-up savings",
  },
  "emergency-boost": {
    name: "Emergency Fund Boost",
    icon: "shield-plus",
    description: "Quick top-up your emergency fund",
  },
  "goal-boost": {
    name: "Goal Boost",
    icon: "zap",
    description: "Add a one-time boost to your top goal",
  },
  "debt-snowball": {
    name: "Debt Payoff Plan",
    icon: "trending-down",
    description: "Calculate fastest debt payoff strategy",
  },
};

function executeQuickAction(actionId) {
  // Check cooldown to prevent point farming
  if (!canExecuteAction(actionId)) {
    const remaining = getCooldownRemaining(actionId);
    return {
      success: false,
      title: "Action on Cooldown",
      message: `Please wait ${remaining} seconds before using this action again.`,
      type: "warning",
    };
  }

  const snapshot = getFinanceSnapshot();
  let result;

  switch (actionId) {
    case "auto-save":
      result = executeAutoSave(snapshot);
      break;
    case "subscription-audit":
      result = executeSubscriptionAudit();
      break;
    case "round-up":
      result = executeRoundUpCalculator(snapshot);
      break;
    case "emergency-boost":
      result = executeEmergencyBoost(snapshot);
      break;
    case "goal-boost":
      result = executeGoalBoost(snapshot);
      break;
    case "debt-snowball":
      result = executeDebtSnowball(snapshot);
      break;
    default:
      return { success: false, message: "Unknown action" };
  }

  // Record execution if successful (triggers cooldown)
  if (result.success) {
    recordActionExecution(actionId);
  }

  return result;
}

function executeAutoSave(snapshot) {
  const surplus = snapshot.surplus;
  if (surplus <= 0) {
    return {
      success: false,
      title: "No Surplus Available",
      message: "Your expenses currently match or exceed your income. Try reducing expenses first.",
      type: "warning",
    };
  }

  const activeGoals = (state.goals || []).filter((g) => g.autoAllocate && g.target > g.saved);
  if (activeGoals.length === 0) {
    return {
      success: false,
      title: "No Active Goals",
      message: "Create a goal with auto-allocate enabled to use this feature.",
      type: "info",
    };
  }

  // Calculate and apply allocation
  const allocations = calculateSuggestedAllocation(state.goals, surplus);
  let totalAllocated = 0;
  const allocationDetails = [];

  allocations.forEach((alloc) => {
    const goal = state.goals.find((g) => g.id === alloc.goalId);
    if (goal) {
      goal.monthly = alloc.suggested;
      totalAllocated += alloc.suggested;
      allocationDetails.push({ name: goal.name, amount: alloc.suggested });
    }
  });

  scheduleSave();
  updateGoalList();
  awardPoints(25, "Auto-save action");

  return {
    success: true,
    title: "Surplus Allocated!",
    message: `${formatCurrency(totalAllocated)}/month distributed across ${allocationDetails.length} goal(s).`,
    type: "success",
    details: allocationDetails.map((a) => `${a.name}: ${formatCurrency(a.amount)}/month`),
  };
}

function executeSubscriptionAudit() {
  const subscriptions = (state.bills || []).filter((b) => b.category === "subscription" && b.active);

  if (subscriptions.length === 0) {
    return {
      success: false,
      title: "No Subscriptions Found",
      message: "Add your subscriptions to the Bills section to audit them.",
      type: "info",
    };
  }

  const totalMonthly = subscriptions.reduce((sum, s) => sum + s.amount, 0);
  const annualCost = totalMonthly * 12;

  // Find potential savings (subscriptions that might be duplicates or unused)
  const suggestions = [];
  const categories = {};

  subscriptions.forEach((sub) => {
    const key = sub.name.toLowerCase();
    if (!categories[key]) categories[key] = [];
    categories[key].push(sub);
  });

  // Suggest review for high-cost subscriptions
  subscriptions.forEach((sub) => {
    if (sub.amount > 20) {
      suggestions.push({
        name: sub.name,
        amount: sub.amount,
        suggestion: "Review if still needed - high monthly cost",
      });
    }
  });

  // Calculate potential if cancelled
  const potentialSavings = Math.round(totalMonthly * 0.2); // Assume 20% could be cut

  awardPoints(15, "Subscription audit");

  return {
    success: true,
    title: "Subscription Audit Complete",
    message: `You spend ${formatCurrency(totalMonthly)}/month (${formatCurrency(annualCost)}/year) on ${subscriptions.length} subscription(s).`,
    type: "info",
    details: [
      `Potential annual savings: ${formatCurrency(potentialSavings * 12)} (if you cut 20%)`,
      ...subscriptions.map((s) => `${s.name}: ${formatCurrency(s.amount)}/month`),
    ],
    suggestions,
  };
}

function executeRoundUpCalculator(snapshot) {
  // Calculate potential round-up savings based on expenses
  const monthlyExpenses = snapshot.expenses;
  const estimatedTransactions = Math.round(monthlyExpenses / 25); // Assume avg £25 per transaction

  // Average round-up is about 50p per transaction
  const avgRoundUp = 0.5;
  const monthlyRoundUp = Math.round(estimatedTransactions * avgRoundUp);
  const yearlyRoundUp = monthlyRoundUp * 12;

  awardPoints(10, "Round-up calculator");

  return {
    success: true,
    title: "Round-Up Potential",
    message: `Based on your spending, round-ups could save you ${formatCurrency(monthlyRoundUp)}/month.`,
    type: "success",
    details: [
      `Estimated transactions: ~${estimatedTransactions}/month`,
      `Average round-up: ~50p per transaction`,
      `Monthly round-up savings: ${formatCurrency(monthlyRoundUp)}`,
      `Annual round-up savings: ${formatCurrency(yearlyRoundUp)}`,
    ],
  };
}

function executeEmergencyBoost(snapshot) {
  const surplus = snapshot.surplus;
  const suggestedBoost = Math.max(50, Math.round(surplus * 0.1)); // 10% of surplus or £50 min

  if (surplus <= 0) {
    return {
      success: false,
      title: "No Surplus for Boost",
      message: "You need positive surplus to boost your emergency fund.",
      type: "warning",
    };
  }

  const boostAmount = prompt(`Add to emergency fund (suggested: £${suggestedBoost}):`);
  if (boostAmount === null) {
    return { success: false, title: "Cancelled", message: "Action cancelled.", type: "info" };
  }

  const amount = parseFloat(boostAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, title: "Invalid Amount", message: "Please enter a valid positive number.", type: "warning" };
  }

  // Cap at reasonable maximum (10x monthly expenses or £100k)
  const maxBoost = Math.max(100000, (snapshot.expenses || 0) * 10);
  const safeAmount = Math.min(amount, maxBoost);

  state.savings = (state.savings || 0) + safeAmount;
  scheduleSave();
  refreshUI();
  awardPoints(20, "Emergency fund boost");
  checkAllBadges();

  const newBuffer = snapshot.expenses > 0 ? state.savings / snapshot.expenses : 0;

  return {
    success: true,
    title: "Emergency Fund Boosted!",
    message: `Added ${formatCurrency(safeAmount)} to your emergency fund.`,
    type: "success",
    details: [
      `New total: ${formatCurrency(state.savings)}`,
      `Buffer: ${newBuffer.toFixed(1)} months of expenses`,
    ],
  };
}

function executeGoalBoost(snapshot) {
  const goals = (state.goals || []).filter((g) => g.target > g.saved);

  if (goals.length === 0) {
    return {
      success: false,
      title: "No Active Goals",
      message: "Create a goal to use this feature.",
      type: "info",
    };
  }

  // Find highest priority goal
  const topGoal = [...goals].sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
  const remaining = topGoal.target - topGoal.saved;
  const suggestedBoost = Math.min(remaining, Math.max(25, Math.round(snapshot.surplus * 0.1)));

  const boostAmount = prompt(
    `Boost "${topGoal.name}" (${formatCurrency(remaining)} remaining).\nSuggested: £${suggestedBoost}`
  );
  if (boostAmount === null) {
    return { success: false, title: "Cancelled", message: "Action cancelled.", type: "info" };
  }

  const amount = parseFloat(boostAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, title: "Invalid Amount", message: "Please enter a valid positive number.", type: "warning" };
  }

  // Cap at remaining amount needed for goal
  const safeAmount = Math.min(amount, remaining);

  topGoal.saved = topGoal.saved + safeAmount;
  scheduleSave();
  updateGoalList();
  awardPoints(20, "Goal boost");
  checkAllBadges();

  const progress = Math.round((topGoal.saved / topGoal.target) * 100);

  return {
    success: true,
    title: "Goal Boosted!",
    message: `Added ${formatCurrency(safeAmount)} to "${topGoal.name}".`,
    type: "success",
    details: [
      `New saved: ${formatCurrency(topGoal.saved)} / ${formatCurrency(topGoal.target)}`,
      `Progress: ${progress}%`,
      topGoal.saved >= topGoal.target ? "Goal completed!" : `${formatCurrency(topGoal.target - topGoal.saved)} remaining`,
    ],
  };
}

function executeDebtSnowball(snapshot) {
  const debtFields = ["creditCards", "personalLoans", "otherDebt"];
  const debts = debtFields
    .map((field) => ({
      name: field.replace(/([A-Z])/g, " $1").trim(),
      amount: state.expenses[field] || 0,
    }))
    .filter((d) => d.amount > 0);

  if (debts.length === 0) {
    return {
      success: true,
      title: "No Debt Payments Found",
      message: "You have no debt payments recorded. Great job staying debt-free!",
      type: "success",
    };
  }

  const totalMonthlyDebt = debts.reduce((sum, d) => sum + d.amount, 0);
  const surplus = Math.max(0, snapshot.surplus);

  // Snowball: smallest payment first (since we only have monthly payments, not balances)
  const snowball = [...debts].sort((a, b) => a.amount - b.amount);

  // Suggest putting 30% of surplus toward extra debt payments
  const extraPayment = Math.round(surplus * 0.3);

  awardPoints(15, "Debt analysis");

  return {
    success: true,
    title: "Debt Snowball Plan",
    message: `Focus on smallest debt first while paying minimums on others.`,
    type: "info",
    details: [
      `Total monthly debt payments: ${formatCurrency(totalMonthlyDebt)}`,
      extraPayment > 0 ? `Suggested extra payment: ${formatCurrency(extraPayment)}/month (30% of surplus)` : null,
      `Attack order (smallest first):`,
      ...snowball.map((d, i) => `${i + 1}. ${d.name}: ${formatCurrency(d.amount)}/month`),
      surplus > 0
        ? `Tip: Add extra payments to your smallest debt first for quick wins!`
        : "Tip: Find ways to increase income or cut expenses to free up debt payoff funds.",
    ].filter(Boolean),
  };
}

function getQuickActionIcon(iconName) {
  const icons = {
    "piggy-bank": `
      <defs>
        <linearGradient id="qa-pink-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="qa-gold-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <ellipse cx="11" cy="14" rx="7" ry="5" fill="url(#qa-pink-${iconName})"/>
      <circle cx="16" cy="11" r="3.5" fill="url(#qa-pink-${iconName})"/>
      <ellipse cx="19" cy="12" rx="1.8" ry="1.2" fill="#fda4af"/>
      <circle cx="16.5" cy="9.5" r="0.8" fill="#1d3557"/>
      <rect x="8" y="10" width="3" height="1" rx="0.5" fill="#db2777"/>
      <circle cx="5" cy="6" r="2" fill="url(#qa-gold-${iconName})"/>
      <path d="M6 8l3 3" stroke="#2a9d8f" stroke-width="0.8" stroke-linecap="round" stroke-dasharray="1 1"/>`,
    scissors: `
      <defs>
        <linearGradient id="qa-teal-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="qa-navy-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
      </defs>
      <rect x="3" y="4" width="12" height="16" rx="2" fill="url(#qa-navy-${iconName})" opacity="0.2"/>
      <path d="M6 8h6M6 11h4M6 14h5" stroke="url(#qa-navy-${iconName})" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="16" cy="12" r="4" fill="none" stroke="url(#qa-teal-${iconName})" stroke-width="2"/>
      <path d="M19 15l3 3" stroke="url(#qa-teal-${iconName})" stroke-width="2.5" stroke-linecap="round"/>`,
    "trending-up": `
      <defs>
        <linearGradient id="qa-gold2-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="qa-teal2-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <circle cx="6" cy="18" r="3" fill="url(#qa-gold2-${iconName})"/>
      <circle cx="12" cy="14" r="3" fill="url(#qa-gold2-${iconName})" opacity="0.9"/>
      <circle cx="18" cy="10" r="3" fill="url(#qa-gold2-${iconName})" opacity="0.8"/>
      <path d="M4 12c0-4 3-8 8-8s8 4 8 8" fill="none" stroke="url(#qa-teal2-${iconName})" stroke-width="2" stroke-linecap="round"/>
      <path d="M17 4l3 0-1 3" fill="url(#qa-teal2-${iconName})"/>`,
    "shield-plus": `
      <defs>
        <linearGradient id="qa-teal3-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="qa-pink2-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <path d="M12 2l8 4v6c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V6l8-4z" fill="url(#qa-teal3-${iconName})"/>
      <path d="M12 7c-1 0-2 1-2 2v4l2 3 2-3V9c0-1-1-2-2-2z" fill="url(#qa-pink2-${iconName})"/>
      <ellipse cx="12" cy="17" rx="1.5" ry="2" fill="#fcd34d"/>`,
    zap: `
      <defs>
        <linearGradient id="qa-gold3-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="qa-pink3-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" fill="url(#qa-pink3-${iconName})" opacity="0.2"/>
      <circle cx="12" cy="12" r="3" fill="url(#qa-pink3-${iconName})" opacity="0.6"/>
      <path d="M13 2l-3 8h4l-3 10 7-11h-5l4-7h-4z" fill="url(#qa-gold3-${iconName})"/>`,
    "trending-down": `
      <defs>
        <linearGradient id="qa-teal4-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="qa-navy2-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
      </defs>
      <path d="M2 18l20-8" stroke="url(#qa-navy2-${iconName})" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
      <circle cx="18" cy="12" r="2.5" fill="url(#qa-teal4-${iconName})" opacity="0.5"/>
      <circle cx="13" cy="14" r="3.5" fill="url(#qa-teal4-${iconName})" opacity="0.7"/>
      <circle cx="6" cy="17" r="5" fill="url(#qa-teal4-${iconName})"/>
      <circle cx="5" cy="15" r="1" fill="#fff" opacity="0.5"/>`,
  };
  return icons[iconName] || icons.zap;
}

function updateQuickActions() {
  const container = document.querySelector("[data-quick-actions]");
  if (!container) return;

  container.innerHTML = Object.entries(QUICK_ACTIONS)
    .map(
      ([id, action]) => `
      <button type="button" class="quick-action-btn" data-action="${escapeHtml(id)}">
        <div class="quick-action-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${getQuickActionIcon(action.icon)}
          </svg>
        </div>
        <div class="quick-action-info">
          <span class="quick-action-name">${escapeHtml(action.name)}</span>
          <span class="quick-action-desc">${escapeHtml(action.description)}</span>
        </div>
        <svg class="quick-action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    `
    )
    .join("");

  // Attach click handlers
  container.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const actionId = btn.dataset.action;
      const result = executeQuickAction(actionId);
      showActionResult(result);
    });
  });
}

function showActionResult(result) {
  const modal = document.querySelector("[data-action-modal]");
  if (!modal) {
    // Fallback to alert if modal doesn't exist
    let message = `${result.title}\n\n${result.message}`;
    if (result.details) {
      message += "\n\n" + result.details.join("\n");
    }
    alert(message);
    return;
  }

  const titleEl = modal.querySelector("[data-action-modal-title]");
  const messageEl = modal.querySelector("[data-action-modal-message]");
  const detailsEl = modal.querySelector("[data-action-modal-details]");
  const iconEl = modal.querySelector("[data-action-modal-icon]");

  if (titleEl) titleEl.textContent = result.title;
  if (messageEl) messageEl.textContent = result.message;

  if (iconEl) {
    iconEl.className = `action-modal-icon ${result.type || "info"}`;
  }

  if (detailsEl && result.details && result.details.length > 0) {
    detailsEl.innerHTML = result.details
      .map((d) => {
        // Handle both string and object formats
        if (typeof d === "string") {
          return `<div class="action-detail-item"><span class="action-detail-label">${escapeHtml(d)}</span></div>`;
        }
        return `
          <div class="action-detail-item">
            <span class="action-detail-label">${escapeHtml(d.label)}</span>
            <span class="action-detail-value ${d.positive ? "positive" : d.negative ? "negative" : ""}">${escapeHtml(d.value)}</span>
          </div>
        `;
      })
      .join("");
    detailsEl.style.display = "block";
  } else if (detailsEl) {
    detailsEl.innerHTML = "";
  }

  modal.style.display = "flex";

  // Close handler
  const closeBtn = modal.querySelector("[data-action-modal-close]");
  if (closeBtn) {
    closeBtn.onclick = () => (modal.style.display = "none");
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.style.display = "none";
  };
}

// ============================================
// BANK STATEMENT IMPORT
// ============================================

const TRANSACTION_CATEGORIES = {
  groceries: {
    name: "Groceries",
    color: "#22c55e",
    keywords: ["tesco", "sainsbury", "asda", "aldi", "lidl", "morrisons", "waitrose", "co-op", "ocado", "grocery"],
    expenseKey: "groceries",
  },
  utilities: {
    name: "Utilities",
    color: "#3b82f6",
    keywords: ["british gas", "edf", "eon", "octopus", "bulb", "scottish power", "water", "electric", "gas bill", "thames"],
    expenseKey: "utilities",
  },
  transport: {
    name: "Transport",
    color: "#f59e0b",
    keywords: ["tfl", "uber", "bolt", "shell", "bp", "esso", "petrol", "fuel", "train", "rail", "bus", "parking"],
    expenseKey: "transport",
  },
  entertainment: {
    name: "Entertainment",
    color: "#8b5cf6",
    keywords: ["netflix", "spotify", "amazon prime", "disney", "cinema", "theatre", "pub", "bar", "restaurant", "deliveroo", "uber eats", "just eat"],
    expenseKey: "entertainment",
  },
  shopping: {
    name: "Shopping",
    color: "#ec4899",
    keywords: ["amazon", "ebay", "asos", "primark", "h&m", "zara", "next", "john lewis", "argos", "currys"],
    expenseKey: "clothing",
  },
  subscriptions: {
    name: "Subscriptions",
    color: "#06b6d4",
    keywords: ["subscription", "membership", "gym", "apple", "google", "microsoft", "adobe"],
    expenseKey: "subscriptions",
  },
  housing: {
    name: "Housing",
    color: "#64748b",
    keywords: ["rent", "mortgage", "council tax", "landlord", "letting"],
    expenseKey: "rent",
  },
  insurance: {
    name: "Insurance",
    color: "#14b8a6",
    keywords: ["insurance", "aviva", "direct line", "admiral", "compare the market"],
    expenseKey: "insurance",
  },
  income: {
    name: "Income",
    color: "#16a34a",
    keywords: ["salary", "wages", "payroll", "refund", "transfer in", "interest"],
    isIncome: true,
  },
  other: {
    name: "Other",
    color: "#94a3b8",
    keywords: [],
    expenseKey: "miscellaneous",
  },
};

let parsedStatement = null;

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function categorizeTransaction(description) {
  const descLower = description.toLowerCase();

  for (const [key, category] of Object.entries(TRANSACTION_CATEGORIES)) {
    if (key === "other") continue;
    if (category.keywords.some((kw) => descLower.includes(kw))) {
      return key;
    }
  }
  return "other";
}

function parseStatementCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;

  // Try to detect header row and column positions
  const header = lines[0].toLowerCase();
  const columns = parseCSVLine(lines[0]);

  let dateCol = columns.findIndex((c) => /date/i.test(c));
  let descCol = columns.findIndex((c) => /description|narrative|details|reference/i.test(c));
  let amountCol = columns.findIndex((c) => /amount|value|sum/i.test(c));
  let creditCol = columns.findIndex((c) => /credit|paid in|money in/i.test(c));
  let debitCol = columns.findIndex((c) => /debit|paid out|money out/i.test(c));

  // Fallback defaults for common UK bank formats
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = columns.length > 3 ? 1 : 0;
  if (amountCol === -1 && creditCol === -1 && debitCol === -1) {
    amountCol = columns.length - 1;
  }

  const transactions = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;

    const description = row[descCol] || "";
    let amount = 0;

    if (creditCol !== -1 && debitCol !== -1) {
      const credit = parseFloat((row[creditCol] || "").replace(/[^0-9.-]/g, "")) || 0;
      const debit = parseFloat((row[debitCol] || "").replace(/[^0-9.-]/g, "")) || 0;
      amount = credit - debit;
    } else if (amountCol !== -1) {
      amount = parseFloat((row[amountCol] || "").replace(/[^0-9.-]/g, "")) || 0;
    }

    if (description && amount !== 0) {
      const category = categorizeTransaction(description);
      transactions.push({
        date: row[dateCol] || "",
        description: description.slice(0, 100),
        amount,
        category,
        isIncome: amount > 0,
      });
    }
  }

  return transactions;
}

function analyzeStatement(transactions) {
  const summary = {
    totalIncome: 0,
    totalSpending: 0,
    count: transactions.length,
    categories: {},
  };

  transactions.forEach((t) => {
    if (t.isIncome) {
      summary.totalIncome += t.amount;
    } else {
      summary.totalSpending += Math.abs(t.amount);
    }

    if (!summary.categories[t.category]) {
      summary.categories[t.category] = 0;
    }
    summary.categories[t.category] += Math.abs(t.amount);
  });

  return summary;
}

function displayStatementPreview(transactions) {
  const dropzone = document.querySelector("[data-statement-dropzone]");
  const preview = document.querySelector("[data-statement-preview]");
  if (!dropzone || !preview) return;

  const summary = analyzeStatement(transactions);

  dropzone.style.display = "none";
  preview.style.display = "block";

  const countEl = document.querySelector("[data-statement-count]");
  const incomeEl = document.querySelector("[data-statement-income]");
  const spendingEl = document.querySelector("[data-statement-spending]");
  const categoriesEl = document.querySelector("[data-statement-categories]");

  if (countEl) countEl.textContent = summary.count;
  if (incomeEl) incomeEl.textContent = formatCurrency(summary.totalIncome);
  if (spendingEl) spendingEl.textContent = formatCurrency(summary.totalSpending);

  if (categoriesEl) {
    const sortedCats = Object.entries(summary.categories)
      .filter(([k]) => k !== "income")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    categoriesEl.innerHTML = sortedCats
      .map(
        ([key, amount]) => `
        <div class="statement-category">
          <span class="statement-category-name">
            <span class="statement-category-dot" style="background: ${TRANSACTION_CATEGORIES[key]?.color || "#94a3b8"}"></span>
            ${escapeHtml(TRANSACTION_CATEGORIES[key]?.name || key)}
          </span>
          <span class="statement-category-amount">${formatCurrency(amount)}</span>
        </div>
      `
      )
      .join("");
  }

  parsedStatement = { transactions, summary };
}

function applyStatementToBudget() {
  if (!parsedStatement) return;

  const { summary } = parsedStatement;
  let appliedCount = 0;

  // Apply spending categories to expenses
  Object.entries(summary.categories).forEach(([catKey, amount]) => {
    const cat = TRANSACTION_CATEGORIES[catKey];
    if (cat && cat.expenseKey && state.expenses.hasOwnProperty(cat.expenseKey)) {
      // Average monthly (assume statement is ~1 month)
      state.expenses[cat.expenseKey] = Math.round(amount);
      appliedCount++;
    }
  });

  scheduleSave();
  refreshUI();
  awardPoints(50, "Statement import");

  showActionResult({
    success: true,
    title: "Budget Updated!",
    message: `Applied ${appliedCount} spending categories from your statement.`,
    type: "success",
    details: [
      `Total income detected: ${formatCurrency(summary.totalIncome)}`,
      `Total spending: ${formatCurrency(summary.totalSpending)}`,
      "Review your budget breakdown to fine-tune.",
    ],
  });

  clearStatementImport();
}

function clearStatementImport() {
  parsedStatement = null;
  const dropzone = document.querySelector("[data-statement-dropzone]");
  const preview = document.querySelector("[data-statement-preview]");
  const fileInput = document.querySelector("[data-statement-file]");

  if (dropzone) dropzone.style.display = "block";
  if (preview) preview.style.display = "none";
  if (fileInput) fileInput.value = "";
}

function handleStatementFile(file) {
  if (!file || !file.name.endsWith(".csv")) {
    alert("Please upload a CSV file");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("File too large. Maximum 5MB allowed.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const transactions = parseStatementCSV(text);

    if (!transactions || transactions.length === 0) {
      alert("Could not parse transactions from this file. Please check the format.");
      return;
    }

    displayStatementPreview(transactions);
  };
  reader.onerror = () => alert("Error reading file");
  reader.readAsText(file);
}

// ============================================
// SECURITY: Action Cooldowns
// ============================================

const actionCooldowns = {};
const ACTION_COOLDOWN_MS = 60000; // 1 minute cooldown

function canExecuteAction(actionId) {
  const lastExec = actionCooldowns[actionId];
  if (!lastExec) return true;
  return Date.now() - lastExec >= ACTION_COOLDOWN_MS;
}

function recordActionExecution(actionId) {
  actionCooldowns[actionId] = Date.now();
}

function getCooldownRemaining(actionId) {
  const lastExec = actionCooldowns[actionId];
  if (!lastExec) return 0;
  const remaining = ACTION_COOLDOWN_MS - (Date.now() - lastExec);
  return Math.max(0, Math.ceil(remaining / 1000));
}

// ============================================
// SECURITY: Beforeunload Save Handler
// ============================================

