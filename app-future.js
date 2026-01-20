// Future scenario
function getTopPriorityGoal() {
  if (!state.goals.length) return null;
  return [...state.goals].sort((a, b) => (a.priority || 99) - (b.priority || 99))[0];
}

function syncFutureGoalSelect() {
  const goalSelect = document.querySelector("[data-future-goal]");
  if (!goalSelect) return;

  const previous = goalSelect.value;

  if (!state.goals.length) {
    goalSelect.innerHTML = '<option value="none">Add a goal to unlock timing</option>';
    goalSelect.disabled = true;
    return;
  }

  const sorted = [...state.goals].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const options = [
    '<option value="auto">Auto (top priority)</option>',
    ...sorted.map((goal) => `<option value="${goal.id}">${escapeHtml(goal.name)}</option>`),
  ];
  goalSelect.innerHTML = options.join("");
  goalSelect.disabled = false;

  const values = new Set(["auto", ...sorted.map((goal) => goal.id)]);
  goalSelect.value = values.has(previous) ? previous : "auto";
}

function getSelectedFutureGoal() {
  const goalSelect = document.querySelector("[data-future-goal]");
  if (!state.goals.length) return null;
  const value = goalSelect?.value || "auto";
  if (value === "auto") return getTopPriorityGoal();
  return state.goals.find((goal) => goal.id === value) || null;
}

function buildFutureQuestion(type, months, amount, goalName) {
  switch (type) {
    case "pause_investing":
      return `What if I pause contributions to ${goalName} for ${months} months?`;
    case "income_drop":
      return `What if my income drops by ${formatCurrency(amount)} for ${months} months?`;
    case "income_boost":
      return `What if I add ${formatCurrency(amount)} monthly income for ${months} months?`;
    case "expense_spike":
      return `What if expenses rise by ${formatCurrency(amount)} for ${months} months?`;
    case "one_off":
      return `What if I spend ${formatCurrency(amount)} in month ${months}?`;
    default:
      return "What happens if I change my plan?";
  }
}

function simulateBalance(startBalance, months, monthlyNet, oneOff, riskThreshold) {
  let balance = startBalance;
  let riskMonths = 0;
  const threshold = Number(riskThreshold) || 0;
  for (let i = 0; i < months; i += 1) {
    balance += monthlyNet;
    if (oneOff && i === oneOff.monthIndex) {
      balance -= oneOff.amount;
    }
    if (balance < threshold) {
      riskMonths += 1;
    }
  }
  return { balance, riskMonths };
}

function updateFutureFormLabels() {
  const typeEl = document.querySelector("[data-future-type]");
  if (!typeEl) return;
  const scenario = FUTURE_SCENARIOS[typeEl.value];
  const monthsLabel = document.querySelector("[data-future-months-label]");
  const amountLabel = document.querySelector("[data-future-amount-label]");
  const amountInput = document.querySelector("[data-future-amount]");

  if (monthsLabel) monthsLabel.textContent = scenario?.monthsLabel || "Months";
  if (amountLabel) amountLabel.textContent = scenario?.amountLabel || "Amount (£)";
  if (amountInput) {
    amountInput.disabled = scenario?.usesAmount === false;
  }
}

async function requestFutureLabResponse(payload) {
  const functionsClient = window.POAP_FIREBASE?.functions;
  if (!functionsClient || typeof functionsClient.httpsCallable !== "function") {
    return null;
  }

  try {
    const callable = functionsClient.httpsCallable("futureLab");
    const response = await callable(payload);
    return response?.data?.message || null;
  } catch (error) {
    return null;
  }
}

async function runFutureScenario(options = {}) {
  const typeEl = document.querySelector("[data-future-type]");
  const monthsEl = document.querySelector("[data-future-months]");
  const amountEl = document.querySelector("[data-future-amount]");
  const questionEl = document.querySelector("[data-future-question]");

  if (!typeEl) return;

  const type = typeEl.value;
  const months = Math.min(Math.max(Number(monthsEl?.value) || 6, 1), 24);
  const amount = Math.max(Number(amountEl?.value) || 0, 0);

  updateFutureFormLabels();

  const goal = getSelectedFutureGoal();
  const goalName = goal?.name ? goal.name : "your goal";
  const question = questionEl?.value?.trim() || buildFutureQuestion(type, months, amount, goalName);
  setTextAll("[data-future-user]", question);

  const snapshot = getFinanceSnapshot();
  const income = snapshot.income || 0;
  const expenses = snapshot.expenses || 0;
  const totalGoalMonthly = state.goals.reduce((sum, g) => sum + (Number(g.monthly) || 0), 0);
  const baselineMonthlyNet = income - expenses - totalGoalMonthly;

  const incomeDelta = type === "income_drop" ? -amount : type === "income_boost" ? amount : 0;
  const expenseDelta = type === "expense_spike" ? amount : 0;
  const scenarioIncome = income + incomeDelta;
  const scenarioExpenses = expenses + expenseDelta;

  const scenarioSurplus = Math.max(0, scenarioIncome - scenarioExpenses);
  const autoAllocations = calculateSuggestedAllocation(state.goals, scenarioSurplus);
  const autoMap = new Map(autoAllocations.map((item) => [item.goalId, item.suggested]));

  let scenarioGoalMonthlyTotal = 0;
  let selectedMonthly = goal ? Number(goal.monthly) || 0 : 0;
  let scenarioSelectedMonthly = selectedMonthly;

  state.goals.forEach((g) => {
    const suggested = autoMap.has(g.id) ? autoMap.get(g.id) : Number(g.monthly) || 0;
    let monthly = suggested;
    if (type === "pause_investing" && goal && g.id === goal.id) {
      monthly = 0;
    }
    scenarioGoalMonthlyTotal += monthly;
    if (goal && g.id === goal.id) {
      scenarioSelectedMonthly = monthly;
    }
  });

  const scenarioMonthlyNet = scenarioIncome - scenarioExpenses - scenarioGoalMonthlyTotal;

  const horizon = Math.max(1, months);
  const baselineResult = simulateBalance(
    snapshot.savings,
    horizon,
    baselineMonthlyNet,
    null,
    expenses
  );

  const oneOff = type === "one_off" ? { monthIndex: horizon - 1, amount } : null;
  const scenarioResult = simulateBalance(
    snapshot.savings,
    horizon,
    scenarioMonthlyNet,
    oneOff,
    scenarioExpenses
  );

  const balanceImpact = scenarioResult.balance - baselineResult.balance;
  const riskDelta = scenarioResult.riskMonths - baselineResult.riskMonths;

  let goalDelay = "--";
  if (!goal) {
    goalDelay = "Add a goal to see timing";
  } else if (!goal.target) {
    goalDelay = "Set a target to see timing";
  } else {
    const baselineEta = calculateGoalETA(goal);
    if (baselineEta.status === "complete") {
      goalDelay = "Goal met";
    } else if (baselineEta.status === "no-contribution") {
      goalDelay = "Set monthly contribution";
    } else if (type === "pause_investing") {
      goalDelay = selectedMonthly > 0 ? `+${months} months` : "No contributions to pause";
    } else {
      const scenarioEta = calculateGoalETA({ ...goal, monthly: scenarioSelectedMonthly });
      if (scenarioEta.status === "no-contribution") {
        goalDelay = "Goal stalls while contributions are £0";
      } else if (Number.isFinite(baselineEta.months) && Number.isFinite(scenarioEta.months)) {
        const delay = scenarioEta.months - baselineEta.months;
        goalDelay = delay > 0 ? `+${delay} months` : delay < 0 ? `${delay} months` : "No change";
      } else {
        goalDelay = "No change";
      }
    }
  }

  const fallbackResponse = `Over ${horizon} months, you would be ${formatSignedCurrency(
    balanceImpact
  )} versus baseline with ${scenarioResult.riskMonths} risk month${
    scenarioResult.riskMonths === 1 ? "" : "s"
  }.`;

  setTextAll("[data-future-balance]", formatSignedCurrency(balanceImpact));
  setTextAll(
    "[data-future-risk]",
    `${scenarioResult.riskMonths} (${formatSignedNumber(riskDelta)} vs baseline)`
  );
  setTextAll("[data-future-delay]", goalDelay);
  setTextAll(
    "[data-future-summary]",
    `${goalName}: ${formatSignedCurrency(balanceImpact)} balance impact, ${formatSignedNumber(
      riskDelta
    )} risk months, timing ${goalDelay.toLowerCase()}.`
  );

  if (options.useAI) {
    setTextAll("[data-future-response]", "Thinking...");
    const message = await requestFutureLabResponse({
      question,
      type,
      months: horizon,
      amount,
      goal: goal
        ? {
            id: goal.id,
            name: goal.name,
            target: goal.target,
            saved: goal.saved,
            monthly: goal.monthly,
            autoAllocate: goal.autoAllocate !== false,
            targetDate: goal.targetDate || null,
          }
        : null,
      snapshot: {
        income,
        expenses,
        savings: snapshot.savings,
        surplus: snapshot.surplus,
      },
      baseline: {
        balance: baselineResult.balance,
        riskMonths: baselineResult.riskMonths,
      },
      scenario: {
        balance: scenarioResult.balance,
        riskMonths: scenarioResult.riskMonths,
        delta: balanceImpact,
        delay: goalDelay,
      },
    });
    setTextAll("[data-future-response]", message || fallbackResponse);
  } else {
    setTextAll("[data-future-response]", fallbackResponse);
  }
}
