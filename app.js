const defaultConfig = {
  fxApiUrl: "https://api.exchangerate.host/latest?base=GBP",
  assumptionsApiUrl: "assumptions.json",
  fxCacheHours: 12,
  assumptionsCacheHours: 168,
};

const config = {
  ...defaultConfig,
  ...(window.POAP_CONFIG || {}),
};

const CASHFLOW_SCENARIOS = [
  "baseline",
  "optimistic",
  "conservative",
  "stress",
  "custom",
];
const DASHBOARD_WIDGET_KEYS = [
  "cashflow",
  "alerts",
  "vulnerabilities",
  "quickwins",
  "spark",
];
const cashflowPresets = {
  baseline: { incomeChange: 0, expenseChange: 0, shock: false },
  optimistic: { incomeChange: 8, expenseChange: -4, shock: false },
  conservative: { incomeChange: -4, expenseChange: 6, shock: false },
  stress: { incomeChange: -12, expenseChange: 12, shock: true },
  custom: { incomeChange: 0, expenseChange: 0, shock: false },
};
const CASHFLOW_CHART = {
  width: 720,
  height: 240,
  padding: 26,
};
const FUTURE_SCENARIOS = {
  pause_investing: {
    monthsLabel: "Pause length (months)",
    amountLabel: "Amount per month (£)",
    usesAmount: false,
  },
  income_drop: {
    monthsLabel: "Duration (months)",
    amountLabel: "Monthly reduction (£)",
    usesAmount: true,
  },
  income_boost: {
    monthsLabel: "Duration (months)",
    amountLabel: "Monthly increase (£)",
    usesAmount: true,
  },
  expense_spike: {
    monthsLabel: "Duration (months)",
    amountLabel: "Monthly increase (£)",
    usesAmount: true,
  },
  one_off: {
    monthsLabel: "Month of expense",
    amountLabel: "One-off amount (£)",
    usesAmount: true,
  },
};

const STORAGE_KEY = "poapyments_state_v1";
const DEVICE_KEY = "poapyments_device_id";
const FX_CACHE_KEY = "poapyments_fx_cache_v1";
const ASSUMPTIONS_CACHE_KEY = "poapyments_assumptions_cache_v1";

const screens = Array.from(document.querySelectorAll("[data-screen]"));
const steps = Array.from(document.querySelectorAll("[data-step]"));
let currentIndex = 0;

const defaultState = {
  name: "",
  focus: "saving",
  horizon: "short",
  persona: "builder",
  income: 0,
  essentials: 0,
  debt: 0,
  savings: 0,
  goals: [],
  dashboardWidgets: [...DASHBOARD_WIDGET_KEYS],
  cashflowScenario: "baseline",
  cashflowMonths: 12,
  cashflowIncomeChange: 0,
  cashflowExpenseChange: 0,
  rewardPoints: 620,
  rewardStreak: 12,
  snapshotSet: false,
  onboardingComplete: false,
  lastScreen: "welcome",
  updatedAt: 0,
};

const state = { ...defaultState };
const deviceId = getDeviceId();

const personaData = {
  builder: {
    title: "Builder",
    copy:
      "You like structure, measurable goals, and automated progress. Poapyments keeps you focused with streaks, dashboards, and reward milestones.",
    tags: ["Goal focused", "Auto save", "Long term clarity"],
  },
  balancer: {
    title: "Balancer",
    copy:
      "You value stability and flexibility. We blend steady saving with an investing plan that adapts when life changes.",
    tags: ["Steady pacing", "Smart buffers", "Flexible goals"],
  },
  protector: {
    title: "Protector",
    copy:
      "You care about security for family and future. We highlight coverage gaps, emergency plans, and confidence milestones.",
    tags: ["Family first", "Safety nets", "Guided support"],
  },
  explorer: {
    title: "Explorer",
    copy:
      "You are motivated by possibility. We surface new income paths and show how bold goals impact your future.",
    tags: ["Opportunity", "Side income", "Scenario planning"],
  },
};

function formatCurrency(value, currency = "GBP", decimals = 0) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatSignedNumber(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value)}`;
}

function formatSignedCurrency(value, currency = "GBP") {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(value), currency, 0)}`;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "--";
  return new Date(timestamp).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setTextAll(selector, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = value;
  });
}

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const generated =
    (window.crypto && window.crypto.randomUUID && window.crypto.randomUUID()) ||
    `device-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_KEY, generated);
  return generated;
}

function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...defaultState };
  }

  const safe = { ...defaultState, ...raw };

  safe.name = typeof safe.name === "string" ? safe.name : "";
  safe.focus = ["saving", "investing", "protection", "income"].includes(
    safe.focus
  )
    ? safe.focus
    : defaultState.focus;
  safe.horizon = ["short", "mid", "long"].includes(safe.horizon)
    ? safe.horizon
    : defaultState.horizon;
  safe.persona = Object.keys(personaData).includes(safe.persona)
    ? safe.persona
    : defaultState.persona;

  safe.income = Number(safe.income) || 0;
  safe.essentials = Number(safe.essentials) || 0;
  safe.debt = Number(safe.debt) || 0;
  safe.savings = Number(safe.savings) || 0;

  safe.goals = Array.isArray(safe.goals)
    ? safe.goals
        .map((goal) => ({
          name: String(goal.name || "").trim(),
          target: Number(goal.target) || 0,
          saved: Number(goal.saved) || 0,
          monthly: Number(goal.monthly) || 0,
        }))
        .filter((goal) => goal.name)
    : [];

  safe.dashboardWidgets = Array.isArray(safe.dashboardWidgets)
    ? safe.dashboardWidgets.filter((key) => DASHBOARD_WIDGET_KEYS.includes(key))
    : [...defaultState.dashboardWidgets];
  if (!safe.dashboardWidgets.length) {
    safe.dashboardWidgets = [...defaultState.dashboardWidgets];
  }

  safe.cashflowScenario = CASHFLOW_SCENARIOS.includes(safe.cashflowScenario)
    ? safe.cashflowScenario
    : defaultState.cashflowScenario;
  safe.cashflowMonths = Number(safe.cashflowMonths) || defaultState.cashflowMonths;
  safe.cashflowMonths = Math.min(Math.max(safe.cashflowMonths, 6), 36);
  safe.cashflowIncomeChange = Number(safe.cashflowIncomeChange) || 0;
  safe.cashflowExpenseChange = Number(safe.cashflowExpenseChange) || 0;
  safe.rewardPoints = Number.isFinite(Number(safe.rewardPoints))
    ? Number(safe.rewardPoints)
    : defaultState.rewardPoints;
  safe.rewardStreak = Number.isFinite(Number(safe.rewardStreak))
    ? Number(safe.rewardStreak)
    : defaultState.rewardStreak;
  safe.snapshotSet = Boolean(safe.snapshotSet);

  safe.onboardingComplete = Boolean(safe.onboardingComplete);
  safe.lastScreen = typeof safe.lastScreen === "string" && safe.lastScreen
    ? safe.lastScreen
    : defaultState.lastScreen;
  safe.updatedAt = Number(safe.updatedAt) || 0;

  return safe;
}

function applyState(raw, updatedAtOverride) {
  const safe = sanitizeState(raw);
  Object.assign(state, safe);
  if (updatedAtOverride) state.updatedAt = updatedAtOverride;
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function serializeState() {
  const payload = {
    ...state,
    updatedAt: Date.now(),
  };
  state.updatedAt = payload.updatedAt;
  return payload;
}

function saveLocalState() {
  try {
    const payload = serializeState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage failures.
  }
}

let saveTimer = null;
let firebaseSaveTimer = null;
let firebaseClient = null;
let currentCashflowData = null;
let cashflowMeta = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocalState, 250);

  if (firebaseClient) {
    clearTimeout(firebaseSaveTimer);
    firebaseSaveTimer = setTimeout(saveStateToFirebase, 800);
  }
}

function showScreen(index) {
  currentIndex = Math.max(0, Math.min(index, screens.length - 1));
  screens.forEach((screen, idx) => {
    screen.classList.toggle("is-active", idx === currentIndex);
  });
  steps.forEach((step, idx) => {
    step.classList.toggle("is-active", idx === currentIndex);
    step.classList.toggle("is-complete", idx < currentIndex);
  });

  const screenId = screens[currentIndex]?.dataset.screen;
  if (screenId) {
    state.lastScreen = screenId;
    scheduleSave();
  }
}

function showInitialScreen() {
  const target = state.onboardingComplete ? "app" : state.lastScreen;
  const index = screens.findIndex(
    (screen) => screen.dataset.screen === target
  );
  showScreen(index === -1 ? 0 : index);
}

function updatePersona() {
  const data = personaData[state.persona] || personaData.builder;
  setTextAll("[data-persona-title]", data.title);
  setTextAll("[data-persona-copy]", data.copy);
  setTextAll("[data-profile-persona]", data.title);
  setTextAll("[data-profile-copy]", data.copy);

  document.querySelectorAll("[data-persona-tags]").forEach((el) => {
    el.innerHTML = data.tags.map((tag) => `<span>${tag}</span>`).join("");
  });

  const profileTags = document.querySelector("[data-profile-tags]");
  if (profileTags) {
    profileTags.innerHTML = data.tags.map((tag) => `<span>${tag}</span>`).join("");
  }
}

function updateRewardsUI() {
  setTextAll("[data-rewards-points]", state.rewardPoints);
  setTextAll("[data-rewards-streak]", state.rewardStreak);
}

function updateSummary() {
  const snapshot = getFinanceSnapshot();
  const surplus = snapshot.surplus;
  const surplusLabel = surplus >= 0 ? "surplus" : "deficit";
  const bufferMonths = snapshot.essentials
    ? snapshot.savings / snapshot.essentials
    : 0;
  const goalsCount = state.goals.length;
  const debtRatio = snapshot.income ? snapshot.debt / snapshot.income : 0;
  const surplusRatio = snapshot.income ? snapshot.surplus / snapshot.income : 0;

  const focusLabels = {
    saving: "Focused on saving",
    investing: "Focused on investing",
    protection: "Focused on protection",
    income: "Focused on income growth",
  };

  setTextAll("[data-summary-name]", state.name || "Friend");
  setTextAll("[data-user-name]", state.name || "Friend");
  setTextAll(
    "[data-summary-focus]",
    focusLabels[state.focus] || "Balanced focus"
  );
  setTextAll("[data-summary-persona]", personaData[state.persona].title);
  setTextAll("[data-summary-surplus]", `${formatCurrency(surplus)}`);
  setTextAll("[data-snapshot-surplus]", `${formatCurrency(surplus)}`);
  setTextAll(
    "[data-app-surplus]",
    `${formatCurrency(surplus)} ${surplusLabel}`
  );
  setTextAll("[data-summary-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-app-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll(
    "[data-summary-goals]",
    `${goalsCount} goal${goalsCount === 1 ? "" : "s"}`
  );

  const summaryNext = document.querySelector("[data-summary-next]");
  let nextStep = "";
  if (surplus < 0) {
    nextStep = "Reduce expenses to reach break-even before investing.";
  } else if (bufferMonths < 1) {
    nextStep = "Start a 1 month buffer before investing.";
  } else if (bufferMonths < 3) {
    nextStep = "Grow your buffer to 3 months for confidence.";
  } else if (goalsCount === 0) {
    nextStep = "Add your first goal to unlock rewards.";
  } else {
    nextStep = "Automate your top goal and review investing readiness.";
  }
  if (summaryNext) summaryNext.textContent = nextStep;

  const actionsEl = document.querySelector("[data-summary-actions]");
  if (actionsEl) {
    const firstAction =
      surplus < 0
        ? "Trim expenses to close the monthly gap."
        : bufferMonths < 3
        ? "Activate round-ups to build your buffer."
        : "Boost your top goal by 1% today.";
    const actions = [
      firstAction,
      "Find lost balances in 60 seconds.",
      state.focus === "income"
        ? "Unlock income booster ideas matched to your skills."
        : "Unlock your next reward with a 7-day streak.",
    ];
    actionsEl.innerHTML = actions.map((item) => `<li>${item}</li>`).join("");
  }

  const baseScore = 50;
  const bufferScore = Math.min(25, Math.round(bufferMonths * 6));
  const goalScore = Math.min(15, goalsCount * 3);
  const cashflowScore = Math.min(10, Math.round(Math.max(0, surplusRatio * 40)));
  let debtPenalty = 0;
  if (debtRatio > 0.35) {
    debtPenalty = -12;
  } else if (debtRatio > 0.2) {
    debtPenalty = -6;
  }

  let score = baseScore + bufferScore + goalScore + cashflowScore + debtPenalty;
  score = Math.max(35, Math.min(95, score));
  setTextAll("[data-app-confidence]", score);
  setTextAll("[data-confidence-total]", score);
  setTextAll("[data-confidence-base]", baseScore);
  setTextAll("[data-confidence-buffer]", formatSignedNumber(bufferScore));
  setTextAll("[data-confidence-goals]", formatSignedNumber(goalScore));
  setTextAll("[data-confidence-cashflow]", formatSignedNumber(cashflowScore));
  setTextAll("[data-confidence-debt]", formatSignedNumber(debtPenalty));

  updateRewardsUI();
  updateGoalList();
  updateDashboardVisibility();
  updateIncomeBreakdown();
  updateCashflowInsights();
  updateVulnerabilityPanel();
  runFutureScenario();
}

function updateGoalList() {
  const goalList = document.querySelector("[data-app-goals]");
  if (!goalList) return;

  if (!state.goals.length) {
    goalList.innerHTML =
      "<p class=\"muted\">No goals yet. Add one to start tracking progress.</p>";
    return;
  }

  const items = state.goals.map((goal, index) => {
    const savedValue = Number(goal.saved) || 0;
    const monthlyValue = Number(goal.monthly) || 0;
    const targetValue = goal.target ? goal.target : "";
    const progress = goal.target
      ? Math.min(100, Math.round((savedValue / goal.target) * 100))
      : 0;
    const progressLabel = goal.target
      ? `${progress}% funded`
      : "Set a target to calculate progress";
    let timelineLabel = "Set a monthly amount to estimate timing";
    if (!goal.target) {
      timelineLabel = "Set a target to estimate timing";
    } else if (savedValue >= goal.target) {
      timelineLabel = "Goal met";
    } else if (monthlyValue > 0) {
      const months = Math.ceil((goal.target - savedValue) / monthlyValue);
      const eta = new Date();
      eta.setMonth(eta.getMonth() + months);
      const etaLabel = eta.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      timelineLabel = `~${months} months (ETA ${etaLabel})`;
    }
    return `
      <div class="goal-item" data-goal-index="${index}">
        <div class="goal-row">
          <div>
            <p class="card-title">${goal.name}</p>
            <p class="muted">Target</p>
          </div>
          <input
            class="goal-input"
            type="number"
            min="0"
            step="100"
            placeholder="Set target"
            value="${targetValue}"
            data-goal-target-input
          />
        </div>
        <div class="goal-edit-grid">
          <label>
            Saved so far
            <input
              type="number"
              min="0"
              step="50"
              value="${savedValue || ""}"
              data-goal-saved-input
            />
          </label>
          <label>
            Monthly contribution
            <input
              type="number"
              min="0"
              step="25"
              value="${monthlyValue || ""}"
              data-goal-monthly-input
            />
          </label>
        </div>
        <div class="goal-meta">
          <span class="muted" data-goal-progress-label>${progressLabel}</span>
          <span class="muted" data-goal-timeline>${timelineLabel}</span>
        </div>
        <div class="progress"><span style="width: ${progress}%"></span></div>
      </div>
    `;
  });

  goalList.innerHTML = items.join("");

  goalList.querySelectorAll("[data-goal-target-input]").forEach((input) => {
    const row = input.closest("[data-goal-index]");
    if (!row) return;
    const index = Number(row.dataset.goalIndex);
    input.addEventListener("input", () => {
      const value = Number(input.value) || 0;
      if (state.goals[index]) {
        state.goals[index].target = value;
      }
      updateGoalRowUI(row, state.goals[index]);
      scheduleSave();
    });
    input.addEventListener("change", updateSummary);
  });

  goalList.querySelectorAll("[data-goal-saved-input]").forEach((input) => {
    const row = input.closest("[data-goal-index]");
    if (!row) return;
    const index = Number(row.dataset.goalIndex);
    input.addEventListener("input", () => {
      const value = Number(input.value) || 0;
      if (state.goals[index]) {
        state.goals[index].saved = value;
      }
      updateGoalRowUI(row, state.goals[index]);
      scheduleSave();
    });
    input.addEventListener("change", updateSummary);
  });

  goalList.querySelectorAll("[data-goal-monthly-input]").forEach((input) => {
    const row = input.closest("[data-goal-index]");
    if (!row) return;
    const index = Number(row.dataset.goalIndex);
    input.addEventListener("input", () => {
      const value = Number(input.value) || 0;
      if (state.goals[index]) {
        state.goals[index].monthly = value;
      }
      updateGoalRowUI(row, state.goals[index]);
      scheduleSave();
    });
    input.addEventListener("change", updateSummary);
  });
}

function updateGoalRowUI(row, goal) {
  if (!row || !goal) return;
  const savedValue = Number(goal.saved) || 0;
  const monthlyValue = Number(goal.monthly) || 0;
  const targetValue = Number(goal.target) || 0;
  const progress = targetValue
    ? Math.min(100, Math.round((savedValue / targetValue) * 100))
    : 0;
  const progressEl = row.querySelector(".progress span");
  const progressLabel = row.querySelector("[data-goal-progress-label]");
  const timelineLabel = row.querySelector("[data-goal-timeline]");
  if (progressEl) progressEl.style.width = `${progress}%`;
  if (progressLabel) {
    progressLabel.textContent = targetValue
      ? `${progress}% funded`
      : "Set a target to calculate progress";
  }
  if (timelineLabel) {
    let label = "Set a monthly amount to estimate timing";
    if (!targetValue) {
      label = "Set a target to estimate timing";
    } else if (savedValue >= targetValue) {
      label = "Goal met";
    } else if (monthlyValue > 0) {
      const months = Math.ceil((targetValue - savedValue) / monthlyValue);
      const eta = new Date();
      eta.setMonth(eta.getMonth() + months);
      const etaLabel = eta.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      label = `~${months} months (ETA ${etaLabel})`;
    }
    timelineLabel.textContent = label;
  }
}

function getFinanceSnapshot() {
  const fallbackIncome = 3200;
  const fallbackEssentials = 2100;
  const fallbackDebt = 220;
  const fallbackSavings = 1200;

  const useFallbacks = !state.snapshotSet;
  const income = useFallbacks ? fallbackIncome : Number(state.income) || 0;
  const essentials = useFallbacks ? fallbackEssentials : Number(state.essentials) || 0;
  const debt = useFallbacks ? fallbackDebt : Number(state.debt) || 0;
  const savings = useFallbacks ? fallbackSavings : Number(state.savings) || 0;
  const surplus = income - essentials - debt;
  const explicitContribution = state.goals.reduce(
    (total, goal) => total + (Number(goal.monthly) || 0),
    0
  );
  const fallbackContribution = Math.max(0, surplus * 0.45);
  const goalContribution =
    explicitContribution > 0 ? explicitContribution : fallbackContribution;

  return {
    income,
    essentials,
    debt,
    savings,
    surplus,
    goalContribution,
  };
}

function updateIncomeBreakdown() {
  if (!incomeBar || !expenseBar || !savingBar) return;
  const snapshot = getFinanceSnapshot();
  const expenses = snapshot.essentials + snapshot.debt;
  const maxValue = Math.max(snapshot.income, expenses + snapshot.goalContribution, 1);
  const incomeFill = snapshot.income / maxValue;
  const expenseFill = expenses / maxValue;
  const savingFill = snapshot.goalContribution / maxValue;

  incomeBar.style.setProperty("--fill", incomeFill.toFixed(3));
  expenseBar.style.setProperty("--fill", expenseFill.toFixed(3));
  savingBar.style.setProperty("--fill", savingFill.toFixed(3));

  if (incomeLabel) incomeLabel.textContent = formatCurrency(snapshot.income);
  if (expenseLabel) expenseLabel.textContent = formatCurrency(expenses);
  if (savingLabel) savingLabel.textContent = formatCurrency(snapshot.goalContribution);

  if (incomeSummary) {
    const fixedRatio = expenses / snapshot.income;
    const ratioText = Math.round(fixedRatio * 100);
    incomeSummary.textContent =
      fixedRatio >= 0.7
        ? `Fixed costs are ${ratioText}% of income. Consider trimming essentials.`
        : `Fixed costs are ${ratioText}% of income. You have room to invest.`;
  }
}

function updateDashboardVisibility() {
  if (!dashboardWidgets.length) return;
  const selected = new Set(state.dashboardWidgets);
  dashboardWidgets.forEach((widget) => {
    widget.classList.toggle("is-hidden", !selected.has(widget.dataset.widget));
  });
}

function updateVulnerabilityPanel() {
  if (!vulnerabilityList) return;
  const snapshot = getFinanceSnapshot();
  const bufferMonths = snapshot.essentials
    ? snapshot.savings / snapshot.essentials
    : 0;
  const debtRatio = snapshot.debt / snapshot.income;
  const fixedCostRatio = (snapshot.essentials + snapshot.debt) / snapshot.income;
  const surplusRatio = snapshot.surplus / snapshot.income;

  const items = [
    {
      title: "Emergency buffer",
      level: bufferMonths < 1 ? "high" : bufferMonths < 3 ? "medium" : "low",
      detail: `${bufferMonths.toFixed(1)} months`,
    },
    {
      title: "Debt load",
      level: debtRatio > 0.35 ? "high" : debtRatio > 0.2 ? "medium" : "low",
      detail: `${Math.round(debtRatio * 100)}% of income`,
    },
    {
      title: "Fixed cost exposure",
      level:
        fixedCostRatio > 0.75 ? "high" : fixedCostRatio > 0.6 ? "medium" : "low",
      detail: `${Math.round(fixedCostRatio * 100)}% of income`,
    },
    {
      title: "Income resilience",
      level: surplusRatio < 0 ? "high" : surplusRatio < 0.1 ? "medium" : "low",
      detail: `${formatCurrency(snapshot.surplus)} net`,
    },
  ];

  vulnerabilityList.innerHTML = items
    .map(
      (item) => `
        <li class="vuln-item">
          <div>
            <p class="alert-title">${item.title}</p>
            <p class="muted">${item.detail}</p>
          </div>
          <span class="severity ${item.level}">${item.level}</span>
        </li>
      `
    )
    .join("");

  const highCount = items.filter((item) => item.level === "high").length;
  const mediumCount = items.filter((item) => item.level === "medium").length;
  let scoreLabel = "Low";
  if (highCount >= 2 || (highCount === 1 && mediumCount >= 2)) {
    scoreLabel = "High";
  } else if (highCount === 1 || mediumCount >= 2) {
    scoreLabel = "Moderate";
  }
  if (vulnerabilityScore) vulnerabilityScore.textContent = scoreLabel;
}

function buildCashflowData(months, scenario) {
  const snapshot = getFinanceSnapshot();
  const results = [];
  let balance = snapshot.savings;
  const netValues = [];
  const balanceValues = [];
  const incomeValues = [];
  const expenseValues = [];

  for (let i = 0; i < months; i += 1) {
    const seasonality = 1 + Math.sin((i / 12) * Math.PI * 2) * 0.03;
    const income =
      snapshot.income * (1 + scenario.incomeChange / 100) * seasonality;
    let expenses =
      (snapshot.essentials + snapshot.debt + snapshot.goalContribution) *
      (1 + scenario.expenseChange / 100);
    if (scenario.shock && i === 2) {
      expenses += snapshot.essentials * 0.6;
    }

    const net = income - expenses;
    balance += net;

    results.push(i + 1);
    netValues.push(net);
    balanceValues.push(balance);
    incomeValues.push(income);
    expenseValues.push(expenses);
  }

  return {
    months: results,
    net: netValues,
    balance: balanceValues,
    income: incomeValues,
    expenses: expenseValues,
  };
}

function buildCashflowMeta(data) {
  const { width, height, padding } = CASHFLOW_CHART;
  const values = [...data.balance, ...data.net, 0];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const step =
    data.months.length > 1
      ? (width - padding * 2) / (data.months.length - 1)
      : 1;
  const zeroY =
    padding + ((maxValue - 0) / range) * (height - padding * 2);
  return {
    width,
    height,
    padding,
    minValue,
    maxValue,
    range,
    step,
    zeroY,
  };
}

function renderCashflowChart(data, meta) {
  const {
    width,
    height,
    padding,
    minValue,
    maxValue,
    range,
    step,
    zeroY,
  } = meta;

  const y = (value) =>
    padding + ((maxValue - value) / range) * (height - padding * 2);

  const barWidth = Math.max(8, step * 0.45);

  const bars = data.net
    .map((value, index) => {
      const x = padding + index * step - barWidth / 2;
      const barHeight = Math.abs(y(value) - zeroY);
      const yPos = value >= 0 ? y(value) : zeroY;
      const barClass = value >= 0 ? "positive" : "negative";
      return `<rect class="net-bar ${barClass}" x="${x.toFixed(
        1
      )}" y="${yPos.toFixed(1)}" width="${barWidth.toFixed(
        1
      )}" height="${Math.max(barHeight, 2).toFixed(1)}" />`;
    })
    .join("");

  const points = data.balance
    .map((value, index) => `${(padding + index * step).toFixed(1)},${y(value).toFixed(1)}`)
    .join(" ");

  const areaPath = `M ${padding} ${y(data.balance[0]).toFixed(1)} ${data.balance
    .map((value, index) => `L ${(padding + index * step).toFixed(1)} ${y(value).toFixed(1)}`)
    .join(" ")} L ${(padding + (data.months.length - 1) * step).toFixed(
    1
  )} ${zeroY.toFixed(1)} L ${padding} ${zeroY.toFixed(1)} Z`;

  const gridLines = [0.25, 0.5, 0.75]
    .map((ratio) => {
      const yPos = padding + ratio * (height - padding * 2);
      return `<line class="grid-line" x1="${padding}" x2="${
        width - padding
      }" y1="${yPos.toFixed(1)}" y2="${yPos.toFixed(1)}" />`;
    })
    .join("");

  return `
    <svg class="cashflow-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cashflow chart">
      ${gridLines}
      <line class="zero-line" x1="${padding}" x2="${width - padding}" y1="${zeroY.toFixed(
        1
      )}" y2="${zeroY.toFixed(1)}" />
      <path class="balance-area" d="${areaPath}" />
      ${bars}
      <polyline class="balance-line" points="${points}" />
      <line class="focus-line" x1="${padding}" x2="${padding}" y1="${padding}" y2="${height - padding}" />
      <circle class="focus-dot" cx="${padding}" cy="${zeroY.toFixed(1)}" r="4" />
    </svg>
    <div class="chart-tooltip" data-cashflow-tooltip></div>
  `;
}

function attachCashflowInteractions() {
  if (!cashflowChart || !currentCashflowData || !cashflowMeta) return;
  const cashflowSvg = cashflowChart.querySelector("svg");
  const tooltip = cashflowChart.querySelector("[data-cashflow-tooltip]");
  if (!cashflowSvg || !tooltip) return;

  const focusLine = cashflowSvg.querySelector(".focus-line");
  const focusDot = cashflowSvg.querySelector(".focus-dot");
  const { width, height, padding, maxValue, range, step } = cashflowMeta;

  const y = (value) =>
    padding + ((maxValue - value) / range) * (height - padding * 2);

  const showPoint = (index, event) => {
    const safeIndex = Math.max(0, Math.min(index, currentCashflowData.months.length - 1));
    const xPos = padding + safeIndex * step;
    const balance = currentCashflowData.balance[safeIndex];
    const net = currentCashflowData.net[safeIndex];
    const income = currentCashflowData.income[safeIndex];
    const expenses = currentCashflowData.expenses[safeIndex];
    const yPos = y(balance);

    if (focusLine) {
      focusLine.setAttribute("x1", xPos.toFixed(1));
      focusLine.setAttribute("x2", xPos.toFixed(1));
      focusLine.style.opacity = "1";
    }
    if (focusDot) {
      focusDot.setAttribute("cx", xPos.toFixed(1));
      focusDot.setAttribute("cy", yPos.toFixed(1));
      focusDot.style.opacity = "1";
    }

    tooltip.innerHTML = `
      <div class="tooltip-title">Month ${safeIndex + 1}</div>
      <div>Balance: ${formatCurrency(balance)}</div>
      <div>Net: ${formatSignedCurrency(net)}</div>
      <div>Income: ${formatCurrency(income)}</div>
      <div>Expenses: ${formatCurrency(expenses)}</div>
    `;

    const svgRect = cashflowSvg.getBoundingClientRect();
    const wrapRect = cashflowChart.getBoundingClientRect();
    const left = (xPos / width) * svgRect.width;
    const top = (yPos / height) * svgRect.height;
    const offsetX = svgRect.left - wrapRect.left;
    const offsetY = svgRect.top - wrapRect.top;
    tooltip.style.left = `${offsetX + left}px`;
    tooltip.style.top = `${offsetY + top}px`;
    tooltip.classList.add("is-visible");
  };

  cashflowSvg.onmousemove = (event) => {
    const rect = cashflowSvg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(padding, Math.min(x, width - padding));
    const index = Math.round((clamped - padding) / step);
    showPoint(index, event);
  };

  cashflowSvg.onmouseenter = (event) => {
    const rect = cashflowSvg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const clamped = Math.max(padding, Math.min(x, width - padding));
    const index = Math.round((clamped - padding) / step);
    showPoint(index, event);
  };

  cashflowSvg.onmouseleave = () => {
    if (focusLine) focusLine.style.opacity = "0";
    if (focusDot) focusDot.style.opacity = "0";
    tooltip.classList.remove("is-visible");
  };
}

function updateAlertList(data) {
  if (!alertList) return;
  const snapshot = getFinanceSnapshot();
  const alerts = [];

  const firstDeficitMonth = data.net.findIndex((value) => value < 0);
  if (firstDeficitMonth >= 0) {
    alerts.push({
      title: "Projected monthly deficit",
      detail: `Month ${firstDeficitMonth + 1} shows a shortfall.`,
      level: "high",
    });
  }

  const lowestBalance = Math.min(...data.balance);
  if (lowestBalance < 0) {
    alerts.push({
      title: "Balance drops below zero",
      detail: `Lowest balance ${formatCurrency(lowestBalance)}.`,
      level: "high",
    });
  } else if (lowestBalance < snapshot.essentials) {
    alerts.push({
      title: "Buffer dips below one month",
      detail: `Lowest balance ${formatCurrency(lowestBalance)}.`,
      level: "medium",
    });
  }

  if (snapshot.debt > snapshot.income * 0.35) {
    alerts.push({
      title: "Debt payments feel heavy",
      detail: "Debt is above 35% of income.",
      level: "medium",
    });
  }

  if (!alerts.length) {
    alerts.push({
      title: "All clear",
      detail: "No upcoming risks detected in this scenario.",
      level: "low",
    });
  }

  alertList.innerHTML = alerts
    .map(
      (alert) => `
        <li class="alert-item">
          <div>
            <p class="alert-title">${alert.title}</p>
            <p class="muted">${alert.detail}</p>
          </div>
          <span class="severity ${alert.level}">${alert.level}</span>
        </li>
      `
    )
    .join("");
}

function updateCashflowInsights() {
  if (!cashflowChart) return;
  const scenarioKey = scenarioSelect ? scenarioSelect.value : state.cashflowScenario;
  const preset = cashflowPresets[scenarioKey] || cashflowPresets.baseline;
  const isCustom = scenarioKey === "custom";
  const incomeChange = isCustom
    ? Number(scenarioIncomeInput?.value) || 0
    : preset.incomeChange;
  const expenseChange = isCustom
    ? Number(scenarioExpenseInput?.value) || 0
    : preset.expenseChange;
  const months = Number(cashflowMonthsInput?.value) || state.cashflowMonths;
  const scenario = {
    ...preset,
    incomeChange,
    expenseChange,
  };

  state.cashflowScenario = scenarioKey;
  state.cashflowMonths = months;
  state.cashflowIncomeChange = incomeChange;
  state.cashflowExpenseChange = expenseChange;

  const data = buildCashflowData(months, scenario);
  currentCashflowData = data;
  cashflowMeta = buildCashflowMeta(data);
  cashflowChart.innerHTML = renderCashflowChart(data, cashflowMeta);
  attachCashflowInteractions();

  const avgNet =
    data.net.reduce((total, value) => total + value, 0) / data.net.length;
  const lowBalance = Math.min(...data.balance);
  const snapshot = getFinanceSnapshot();
  const riskMonths = data.balance.filter(
    (value) => value < snapshot.essentials
  ).length;

  if (cashflowAverage) {
    cashflowAverage.textContent = formatCurrency(avgNet);
  }
  if (cashflowLow) {
    cashflowLow.textContent = formatCurrency(lowBalance);
  }
  if (cashflowRisk) {
    cashflowRisk.textContent = `${riskMonths}`;
  }

  updateAlertList(data);
}

function simulateScenarioCashflow(snapshot, horizon, type, amount, effectMonths) {
  const results = [];
  const netValues = [];
  const balanceValues = [];
  const incomeValues = [];
  const expenseValues = [];
  let balance = snapshot.savings;
  const effectSpan = Math.min(Math.max(effectMonths, 1), horizon);
  const oneOffMonth = Math.min(Math.max(effectMonths, 1), horizon) - 1;

  for (let i = 0; i < horizon; i += 1) {
    let income = snapshot.income;
    let expenses = snapshot.essentials + snapshot.debt + snapshot.goalContribution;
    const withinEffect = i < effectSpan;

    if (type === "pause_investing" && withinEffect) {
      expenses -= snapshot.goalContribution;
    } else if (type === "income_drop" && withinEffect) {
      income -= amount;
    } else if (type === "income_boost" && withinEffect) {
      income += amount;
    } else if (type === "expense_spike" && withinEffect) {
      expenses += amount;
    } else if (type === "one_off" && i === oneOffMonth) {
      expenses += amount;
    }

    expenses = Math.max(0, expenses);
    const net = income - expenses;
    balance += net;

    results.push(i + 1);
    netValues.push(net);
    balanceValues.push(balance);
    incomeValues.push(income);
    expenseValues.push(expenses);
  }

  return {
    months: results,
    net: netValues,
    balance: balanceValues,
    income: incomeValues,
    expenses: expenseValues,
  };
}

function getPrimaryGoal() {
  if (!state.goals.length) return null;
  return state.goals.reduce((best, goal) => {
    const bestMonthly = Number(best.monthly) || 0;
    const currentMonthly = Number(goal.monthly) || 0;
    if (currentMonthly !== bestMonthly) {
      return currentMonthly > bestMonthly ? goal : best;
    }
    const bestTarget = Number(best.target) || 0;
    const currentTarget = Number(goal.target) || 0;
    return currentTarget > bestTarget ? goal : best;
  }, state.goals[0]);
}

function estimateGoalDelay(type, effectMonths, amount, snapshot) {
  const goal = getPrimaryGoal();
  if (!goal || !goal.target) {
    return "Set a target to estimate timing.";
  }

  const remaining = Math.max(goal.target - (Number(goal.saved) || 0), 0);
  const totalMonthly = state.goals.reduce(
    (total, item) => total + (Number(item.monthly) || 0),
    0
  );
  const baseContribution =
    Number(goal.monthly) ||
    (totalMonthly > 0 ? 0 : snapshot.goalContribution / state.goals.length);
  if (!baseContribution) {
    return "No monthly contribution set.";
  }

  if (totalMonthly > 0 && !Number(goal.monthly)) {
    return "Set a monthly contribution for this goal.";
  }

  if (type === "pause_investing") {
    return effectMonths > 0 ? `~${effectMonths} month delay` : "No change";
  }

  if (type === "one_off") {
    const delay = Math.ceil(amount / baseContribution);
    return delay > 0 ? `~${delay} month delay` : "No change";
  }

  let scenarioSurplus = snapshot.surplus;
  if (type === "income_drop") {
    scenarioSurplus -= amount;
  } else if (type === "income_boost") {
    scenarioSurplus += amount;
  } else if (type === "expense_spike") {
    scenarioSurplus -= amount;
  }

  const scenarioContribution =
    totalMonthly > 0 && Number(goal.monthly)
      ? Math.max(0, baseContribution)
      : Math.max(0, (scenarioSurplus * 0.45) / state.goals.length);
  if (!scenarioContribution) {
    return "Goal stalls while contributions are £0.";
  }

  const baseMonths = remaining / baseContribution;
  const scenarioMonths = remaining / scenarioContribution;
  const delay = Math.round(scenarioMonths - baseMonths);
  if (delay > 0) return `~${delay} month delay`;
  if (delay < 0) return `~${Math.abs(delay)} months faster`;
  return "No change";
}

function updateFutureInputs() {
  if (!futureType) return;
  const config = FUTURE_SCENARIOS[futureType.value] || FUTURE_SCENARIOS.pause_investing;
  if (futureMonthsLabel) futureMonthsLabel.textContent = config.monthsLabel;
  if (futureAmountLabel) futureAmountLabel.textContent = config.amountLabel;
  if (futureAmount) {
    futureAmount.disabled = !config.usesAmount;
    if (!config.usesAmount) futureAmount.value = "0";
  }
}

function getDefaultFutureQuestion(type, months, amount) {
  if (type === "pause_investing") {
    return `Can we pause goal contributions for ${months} months?`;
  }
  if (type === "income_drop") {
    return `What if my income drops by ${formatCurrency(amount)} for ${months} months?`;
  }
  if (type === "income_boost") {
    return `What if I add ${formatCurrency(amount)} monthly income for ${months} months?`;
  }
  if (type === "expense_spike") {
    return `What if expenses rise by ${formatCurrency(amount)} for ${months} months?`;
  }
  return `What if I spend ${formatCurrency(amount)} in month ${months}?`;
}

function runFutureScenario(options = {}) {
  if (!futureType || !futureMonths) return;
  const type = futureType.value;
  const months = Math.min(Math.max(Number(futureMonths.value) || 6, 1), 36);
  if (futureMonths) futureMonths.value = months;
  const amount = Math.max(Number(futureAmount?.value) || 0, 0);
  const snapshot = getFinanceSnapshot();
  const horizon = Math.max(12, months);

  const baseline = buildCashflowData(horizon, cashflowPresets.baseline);
  const scenario = simulateScenarioCashflow(snapshot, horizon, type, amount, months);
  const endDelta = scenario.balance[horizon - 1] - baseline.balance[horizon - 1];
  const baselineRisk = baseline.balance.filter(
    (value) => value < snapshot.essentials
  ).length;
  const scenarioRisk = scenario.balance.filter(
    (value) => value < snapshot.essentials
  ).length;
  const riskDelta = scenarioRisk - baselineRisk;

  const questionText =
    futureQuestion?.value?.trim() || getDefaultFutureQuestion(type, months, amount);
  if (futureUser) futureUser.textContent = questionText;

  const delayLabel = estimateGoalDelay(type, months, amount, snapshot);
  const fallbackResponse = `Over ${horizon} months, you would be ${formatSignedCurrency(
    endDelta
  )} versus baseline with ${scenarioRisk} risk month${
    scenarioRisk === 1 ? "" : "s"
  }.`;
  if (futureResponse) futureResponse.textContent = fallbackResponse;
  if (futureSummary) {
    futureSummary.textContent = `Scenario impact vs baseline: ${formatSignedCurrency(
      endDelta
    )} balance change, ${formatSignedNumber(riskDelta)} risk months, ${delayLabel.toLowerCase()}.`;
  }
  if (futureBalance) futureBalance.textContent = formatSignedCurrency(endDelta);
  if (futureRisk) {
    futureRisk.textContent = `${scenarioRisk} (${formatSignedNumber(
      riskDelta
    )} vs baseline)`;
  }
  if (futureDelay) futureDelay.textContent = delayLabel;

  if (options.useAI) {
    if (futureResponse) futureResponse.textContent = "Thinking...";
    requestFutureLabResponse({
      question: questionText,
      type,
      months,
      amount,
      snapshot,
      baseline: {
        balance: baseline.balance[horizon - 1],
        riskMonths: baselineRisk,
      },
      scenario: {
        balance: scenario.balance[horizon - 1],
        riskMonths: scenarioRisk,
        delta: endDelta,
        delay: delayLabel,
      },
    }).then((message) => {
      if (futureResponse) {
        futureResponse.textContent = message || fallbackResponse;
      }
    });
  }
}

async function requestFutureLabResponse(payload) {
  try {
    const response = await fetch("/.netlify/functions/future-lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.message || null;
  } catch (error) {
    return null;
  }
}

function updateGoalsFromCards(goalCards, options = {}) {
  state.goals = goalCards
    .filter((card) => card.checkbox.checked)
    .map((card) => {
      const existing = state.goals.find((goal) => goal.name === card.checkbox.value);
      return {
        name: card.checkbox.value,
        target: Number(card.amount.value) || 0,
        saved: existing ? Number(existing.saved) || 0 : 0,
        monthly: existing ? Number(existing.monthly) || 0 : 0,
      };
    });

  goalCards.forEach((card) => {
    card.element.classList.toggle("active", card.checkbox.checked);
  });

  if (!options.silent) {
    updateSummary();
    scheduleSave();
  }
}

function applyGoalsFromState(goalCards) {
  goalCards.forEach((card) => {
    const stored = state.goals.find((goal) => goal.name === card.checkbox.value);
    card.checkbox.checked = Boolean(stored);
    card.amount.value = stored && stored.target ? stored.target : "";
    card.element.classList.toggle("active", card.checkbox.checked);
  });
}

const savedState = loadLocalState();
if (savedState) {
  applyState(savedState);
}

const choiceGroupMap = {};
const choiceGroups = document.querySelectorAll("[data-choice-group]");
choiceGroups.forEach((group) => {
  const key = group.dataset.choiceGroup;
  const buttons = Array.from(group.querySelectorAll("button"));

  function selectChoice(value, options = {}) {
    const chosen = buttons.find((btn) => btn.dataset.value === value) || buttons[0];
    if (!chosen) return;

    buttons.forEach((btn) => {
      btn.classList.toggle("active", btn === chosen);
    });

    const selectedValue = chosen.dataset.value;
    if (key === "persona") {
      state.persona = selectedValue;
      updatePersona();
    } else {
      state[key] = selectedValue;
    }

    if (!options.silent) {
      updateSummary();
      scheduleSave();
    }
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => selectChoice(button.dataset.value));
  });

  choiceGroupMap[key] = { selectChoice };
});

const fields = document.querySelectorAll("[data-field]");
fields.forEach((field) => {
  field.addEventListener("input", () => {
    const key = field.dataset.field;
    if (key === "name") {
      state.name = field.value.trim();
    } else {
      state[key] = Number(field.value) || 0;
      if (["income", "essentials", "debt", "savings"].includes(key)) {
        state.snapshotSet = true;
      }
    }
    updateSummary();
    scheduleSave();
  });
});

const goalCards = Array.from(document.querySelectorAll("[data-goal-card]")).map(
  (card) => ({
    element: card,
    checkbox: card.querySelector("[data-goal-check]"),
    amount: card.querySelector("[data-goal-target]"),
  })
);

goalCards.forEach((card) => {
  card.checkbox.addEventListener("change", () =>
    updateGoalsFromCards(goalCards)
  );
  card.amount.addEventListener("input", () => updateGoalsFromCards(goalCards));
});

function syncFormFromState() {
  document.querySelectorAll("[data-field]").forEach((field) => {
    const key = field.dataset.field;
    if (key === "name") {
      field.value = state.name || "";
    } else {
      field.value = state[key] ? state[key] : "";
    }
  });

  Object.keys(choiceGroupMap).forEach((key) => {
    const group = choiceGroupMap[key];
    group.selectChoice(state[key], { silent: true });
  });

  applyGoalsFromState(goalCards);
  updateGoalsFromCards(goalCards, { silent: true });
  syncDashboardToggles();
  syncScenarioControls();
  updatePersona();
  updateSummary();
}

const dashboardToggles = Array.from(
  document.querySelectorAll("[data-dashboard-toggle]")
);
const dashboardWidgets = Array.from(document.querySelectorAll("[data-widget]"));
const incomeBar = document.querySelector("[data-income-bar]");
const expenseBar = document.querySelector("[data-expense-bar]");
const savingBar = document.querySelector("[data-saving-bar]");
const incomeLabel = document.querySelector("[data-income-label]");
const expenseLabel = document.querySelector("[data-expense-label]");
const savingLabel = document.querySelector("[data-saving-label]");
const incomeSummary = document.querySelector("[data-income-summary]");
const cashflowChart = document.querySelector("[data-cashflow-chart]");
const cashflowAverage = document.querySelector("[data-cashflow-average]");
const cashflowLow = document.querySelector("[data-cashflow-low]");
const cashflowRisk = document.querySelector("[data-cashflow-risk]");
const alertList = document.querySelector("[data-alert-list]");
const vulnerabilityList = document.querySelector("[data-vulnerability-list]");
const vulnerabilityScore = document.querySelector("[data-vulnerability-score]");
const scenarioSelect = document.querySelector("[data-scenario-select]");
const scenarioIncomeInput = document.querySelector("[data-scenario-income]");
const scenarioExpenseInput = document.querySelector("[data-scenario-expense]");
const scenarioCustom = document.querySelector("[data-scenario-custom]");
const cashflowMonthsInput = document.querySelector("[data-cashflow-months]");
const futureQuestion = document.querySelector("[data-future-question]");
const futureType = document.querySelector("[data-future-type]");
const futureMonths = document.querySelector("[data-future-months]");
const futureAmount = document.querySelector("[data-future-amount]");
const futureRun = document.querySelector("[data-future-run]");
const futureUser = document.querySelector("[data-future-user]");
const futureResponse = document.querySelector("[data-future-response]");
const futureSummary = document.querySelector("[data-future-summary]");
const futureBalance = document.querySelector("[data-future-balance]");
const futureRisk = document.querySelector("[data-future-risk]");
const futureDelay = document.querySelector("[data-future-delay]");
const futureMonthsLabel = document.querySelector("[data-future-months-label]");
const futureAmountLabel = document.querySelector("[data-future-amount-label]");

function syncDashboardToggles() {
  if (!dashboardToggles.length) return;
  dashboardToggles.forEach((toggle) => {
    toggle.checked = state.dashboardWidgets.includes(toggle.value);
  });
  updateDashboardVisibility();
}

function updateScenarioInputs() {
  if (!scenarioSelect || !scenarioIncomeInput || !scenarioExpenseInput) return;
  const preset = cashflowPresets[scenarioSelect.value] || cashflowPresets.baseline;
  const isCustom = scenarioSelect.value === "custom";
  scenarioIncomeInput.disabled = !isCustom;
  scenarioExpenseInput.disabled = !isCustom;
  if (!isCustom) {
    scenarioIncomeInput.value = preset.incomeChange;
    scenarioExpenseInput.value = preset.expenseChange;
  }
  if (scenarioCustom) {
    scenarioCustom.classList.toggle("is-hidden", !isCustom);
  }
}

function syncScenarioControls() {
  if (!scenarioSelect) return;
  scenarioSelect.value = state.cashflowScenario;
  if (cashflowMonthsInput) cashflowMonthsInput.value = state.cashflowMonths;
  if (scenarioIncomeInput) scenarioIncomeInput.value = state.cashflowIncomeChange;
  if (scenarioExpenseInput) scenarioExpenseInput.value = state.cashflowExpenseChange;
  updateScenarioInputs();
}

syncFormFromState();
showInitialScreen();
updateFutureInputs();
runFutureScenario();

const restartButton = document.querySelector("[data-restart]");
if (restartButton) {
  restartButton.addEventListener("click", () => {
    Object.assign(state, { ...defaultState });
    syncFormFromState();
    showScreen(0);
    saveLocalState();
  });
}

dashboardToggles.forEach((toggle) => {
  toggle.addEventListener("change", () => {
    state.dashboardWidgets = dashboardToggles
      .filter((item) => item.checked)
      .map((item) => item.value);
    updateDashboardVisibility();
    scheduleSave();
  });
});

if (scenarioSelect) {
  scenarioSelect.addEventListener("change", () => {
    state.cashflowScenario = scenarioSelect.value;
    updateScenarioInputs();
    updateCashflowInsights();
    scheduleSave();
  });
}

if (cashflowMonthsInput) {
  cashflowMonthsInput.addEventListener("input", () => {
    const months = Number(cashflowMonthsInput.value) || 12;
    state.cashflowMonths = Math.min(Math.max(months, 6), 36);
    cashflowMonthsInput.value = state.cashflowMonths;
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

if (futureType) {
  updateFutureInputs();
  futureType.addEventListener("change", () => {
    updateFutureInputs();
    runFutureScenario();
  });
}

if (futureRun) {
  futureRun.addEventListener("click", () => runFutureScenario({ useAI: true }));
}

if (futureQuestion) {
  futureQuestion.addEventListener("input", () => {
    if (futureUser) {
      const text = futureQuestion.value.trim();
      futureUser.textContent = text || futureUser.textContent;
    }
  });
}

if (futureMonths) {
  futureMonths.addEventListener("input", runFutureScenario);
}

if (futureAmount) {
  futureAmount.addEventListener("input", runFutureScenario);
}

document.querySelectorAll("[data-next]").forEach((button) => {
  button.addEventListener("click", () => showScreen(currentIndex + 1));
});

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => showScreen(currentIndex - 1));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.go;
    const index = screens.findIndex(
      (screen) => screen.dataset.screen === target
    );
    if (target === "app") {
      state.onboardingComplete = true;
      state.lastScreen = "app";
      scheduleSave();
    }
    if (index !== -1) showScreen(index);
  });
});

const tabButtons = document.querySelectorAll("[data-tab-target]");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.tabTarget;
    tabButtons.forEach((btn) =>
      btn.classList.toggle("is-active", btn === button)
    );
    tabPanels.forEach((panel) =>
      panel.classList.toggle("is-active", panel.dataset.tab === target)
    );
  });
});

let fxBase = "GBP";
let converterRates = {
  GBP: 1,
  USD: 1.27,
  EUR: 1.16,
  NGN: 1962,
  GHS: 18.5,
  ZAR: 23.3,
  KES: 163,
  CAD: 1.7,
};

const converterAmount = document.querySelector("[data-converter-amount]");
const converterFrom = document.querySelector("[data-converter-from]");
const converterTo = document.querySelector("[data-converter-to]");
const converterOutput = document.querySelector("[data-converter-output]");
const converterSwap = document.querySelector("[data-converter-swap]");
const fxUpdatedLabel = document.querySelector("[data-fx-updated]");

function updateConverter() {
  if (!converterOutput) return;
  const amount = Number(converterAmount.value) || 0;
  const from = converterFrom.value;
  const to = converterTo.value;
  const fromRate = converterRates[from] || 1;
  const toRate = converterRates[to] || 1;
  const baseAmount = from === fxBase ? amount : amount / fromRate;
  const converted = to === fxBase ? baseAmount : baseAmount * toRate;
  converterOutput.textContent = `${formatCurrency(converted, to, 2)} ${to}`;
}

function updateFxLabel(timestamp) {
  if (fxUpdatedLabel) {
    fxUpdatedLabel.textContent = `Rates updated: ${formatTimestamp(timestamp)}`;
  }
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeCache(key, payload) {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    // Ignore cache failures.
  }
}

async function loadFxRates() {
  const cached = readCache(FX_CACHE_KEY);
  const cacheDuration = config.fxCacheHours * 60 * 60 * 1000;
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    converterRates = cached.rates || converterRates;
    fxBase = cached.base || fxBase;
    updateFxLabel(cached.timestamp);
    updateConverter();
  }

  if (!config.fxApiUrl) return;

  try {
    const response = await fetch(config.fxApiUrl);
    if (!response.ok) return;
    const data = await response.json();
    if (!data || !data.rates) return;

    converterRates = data.rates;
    fxBase = data.base || fxBase;
    const timestamp = Date.now();
    writeCache(FX_CACHE_KEY, {
      timestamp,
      base: fxBase,
      rates: converterRates,
    });
    updateFxLabel(timestamp);
    updateConverter();
  } catch (error) {
    // Keep fallback rates.
  }
}

if (converterAmount) {
  [converterAmount, converterFrom, converterTo].forEach((input) => {
    input.addEventListener("input", updateConverter);
    input.addEventListener("change", updateConverter);
  });

  converterSwap.addEventListener("click", () => {
    const currentFrom = converterFrom.value;
    converterFrom.value = converterTo.value;
    converterTo.value = currentFrom;
    updateConverter();
  });

  updateConverter();
  loadFxRates();
}

let riskProfiles = {
  cautious: { mean: 0.045, vol: 0.06 },
  balanced: { mean: 0.06, vol: 0.1 },
  growth: { mean: 0.08, vol: 0.14 },
};

const assumptionsUpdatedLabel = document.querySelector(
  "[data-assumptions-updated]"
);

function updateAssumptionsLabel(timestamp) {
  if (assumptionsUpdatedLabel) {
    assumptionsUpdatedLabel.textContent = `Assumptions updated: ${formatTimestamp(
      timestamp
    )}`;
  }
}

async function loadAssumptions() {
  const cached = readCache(ASSUMPTIONS_CACHE_KEY);
  const cacheDuration = config.assumptionsCacheHours * 60 * 60 * 1000;
  if (cached && Date.now() - cached.timestamp < cacheDuration) {
    if (cached.riskProfiles) riskProfiles = cached.riskProfiles;
    updateAssumptionsLabel(cached.timestamp);
    if (monteRisk && monteRisk.value !== "custom") {
      setRiskInputs(monteRisk.value);
    }
  }

  if (!config.assumptionsApiUrl) return;

  try {
    const response = await fetch(config.assumptionsApiUrl);
    if (!response.ok) return;
    const data = await response.json();
    if (!data || !data.riskProfiles) return;

    riskProfiles = data.riskProfiles;
    const timestamp = Date.now();
    writeCache(ASSUMPTIONS_CACHE_KEY, {
      timestamp,
      riskProfiles,
    });
    updateAssumptionsLabel(timestamp);
    if (monteRisk && monteRisk.value !== "custom") {
      setRiskInputs(monteRisk.value);
    }
  } catch (error) {
    // Keep fallback assumptions.
  }
}

const monteStart = document.querySelector("[data-monte-start]");
const monteMonthly = document.querySelector("[data-monte-monthly]");
const monteGrowth = document.querySelector("[data-monte-growth]");
const monteYears = document.querySelector("[data-monte-years]");
const monteRisk = document.querySelector("[data-monte-risk]");
const monteReturn = document.querySelector("[data-monte-return]");
const monteVol = document.querySelector("[data-monte-vol]");
const monteInflation = document.querySelector("[data-monte-inflation]");
const monteFee = document.querySelector("[data-monte-fee]");
const monteTarget = document.querySelector("[data-monte-target]");
const monteRuns = document.querySelector("[data-monte-runs]");
const monteRun = document.querySelector("[data-monte-run]");
const monteOutput = document.querySelector("[data-monte-output]");
const monteBars = document.querySelector("[data-monte-bars]");
const monteSims = document.querySelector("[data-monte-sims]");
const monteHit = document.querySelector("[data-monte-hit]");
const monteReal = document.querySelector("[data-monte-real]");

function setRiskInputs(profileKey) {
  const profile = riskProfiles[profileKey];
  if (!profile || !monteReturn || !monteVol) return;
  monteReturn.value = (profile.mean * 100).toFixed(1);
  monteVol.value = (profile.vol * 100).toFixed(1);
}

function randomNormal() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function simulatePortfolio({ start, monthly, years, mean, vol, growth }) {
  const months = years * 12;
  let value = start;
  let contribution = monthly;
  const monthlyMean = mean / 12;
  const monthlyVol = vol / Math.sqrt(12);
  const growthRate = growth / 100 / 12;
  for (let i = 0; i < months; i += 1) {
    const monthlyReturn = monthlyMean + randomNormal() * monthlyVol;
    value = (value + contribution) * (1 + monthlyReturn);
    contribution *= 1 + growthRate;
  }
  return value;
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function updateMonteCarlo() {
  if (!monteOutput) return;
  const start = Math.max(Number(monteStart?.value) || 0, 0);
  const monthly = Math.max(Number(monteMonthly?.value) || 0, 0);
  const growth = Number(monteGrowth?.value) || 0;
  const years = Math.min(Math.max(Number(monteYears?.value) || 1, 1), 40);
  const returnPct = Number(monteReturn?.value) || 0;
  const volPct = Number(monteVol?.value) || 0;
  const inflationPct = Number(monteInflation?.value) || 0;
  const feePct = Number(monteFee?.value) || 0;
  const target = Math.max(Number(monteTarget?.value) || 0, 0);
  const runs = Math.min(Math.max(Number(monteRuns?.value) || 500, 100), 5000);

  if (monteRuns) monteRuns.value = runs;

  const mean =
    Math.max(returnPct, 0) / 100 -
    Math.max(inflationPct, 0) / 100 -
    Math.max(feePct, 0) / 100;
  const vol = Math.max(volPct, 0) / 100;

  const results = [];
  for (let i = 0; i < runs; i += 1) {
    results.push(
      simulatePortfolio({
        start,
        monthly,
        years,
        mean,
        vol,
        growth,
      })
    );
  }

  results.sort((a, b) => a - b);
  const low = percentile(results, 0.1);
  const mid = percentile(results, 0.5);
  const high = percentile(results, 0.9);
  const hits = target
    ? results.filter((value) => value >= target).length
    : 0;
  const hitRate = target ? Math.round((hits / runs) * 100) : 0;

  monteOutput.textContent = `Projected range (${runs} sims): ${formatCurrency(
    low,
    "GBP",
    0
  )} - ${formatCurrency(high, "GBP", 0)} (median ${formatCurrency(
    mid,
    "GBP",
    0
  )})`;

  if (monteSims) monteSims.textContent = `${runs}`;
  if (monteHit) {
    monteHit.textContent = target ? `${hitRate}%` : "n/a";
  }
  if (monteReal) {
    monteReal.textContent = `${(mean * 100).toFixed(1)}%`;
  }

  const min = results[0] || 0;
  const max = results[results.length - 1] || 1;
  const buckets = new Array(12).fill(0);
  const range = max - min || 1;
  const step = range / buckets.length;

  results.forEach((value) => {
    const idx = Math.min(
      buckets.length - 1,
      Math.floor((value - min) / step)
    );
    buckets[idx] += 1;
  });

  const maxCount = Math.max(...buckets, 1);
  const bars = buckets
    .map((count, index) => {
      const height = Math.round((count / maxCount) * 100);
      const bucketStart = min + step * index;
      const bucketEnd = bucketStart + step;
      const rangeLabel = `${formatCurrency(bucketStart, "GBP", 0)} - ${formatCurrency(
        bucketEnd,
        "GBP",
        0
      )}`;
      return `<div class="bar" style="--h: ${height};" data-count="${count}" data-range="${rangeLabel}"></div>`;
    })
    .join("");
  monteBars.innerHTML = `${bars}<div class="monte-tooltip" data-monte-tooltip></div>`;
  attachMonteInteractions();
}

function attachMonteInteractions() {
  if (!monteBars) return;
  const tooltip = monteBars.querySelector("[data-monte-tooltip]");
  if (!tooltip) return;

  let activeBar = null;

  const hideTooltip = () => {
    if (activeBar) {
      activeBar.classList.remove("is-active");
      activeBar = null;
    }
    tooltip.classList.remove("is-visible");
  };

  monteBars.onmousemove = (event) => {
    const bar = event.target.closest(".bar");
    if (!bar || !monteBars.contains(bar)) {
      hideTooltip();
      return;
    }

    if (activeBar && activeBar !== bar) {
      activeBar.classList.remove("is-active");
    }
    activeBar = bar;
    activeBar.classList.add("is-active");

    const count = Number(bar.dataset.count) || 0;
    const range = bar.dataset.range || "";
    tooltip.innerHTML = `
      <div class="tooltip-title">${range}</div>
      <div>${count} simulations</div>
    `;

    const barRect = bar.getBoundingClientRect();
    const containerRect = monteBars.getBoundingClientRect();
    tooltip.style.left = `${barRect.left - containerRect.left + barRect.width / 2}px`;
    tooltip.style.top = `${barRect.top - containerRect.top}px`;
    tooltip.classList.add("is-visible");
  };

  monteBars.onmouseleave = hideTooltip;
}

if (monteRun) {
  monteRun.addEventListener("click", updateMonteCarlo);
  if (monteRisk && monteRisk.value !== "custom") {
    setRiskInputs(monteRisk.value);
  }
  updateMonteCarlo();
  loadAssumptions().then(() => {
    if (monteRisk && monteRisk.value !== "custom") {
      setRiskInputs(monteRisk.value);
    }
    updateMonteCarlo();
  });
}

if (monteRisk) {
  monteRisk.addEventListener("change", () => {
    if (monteRisk.value !== "custom") {
      setRiskInputs(monteRisk.value);
    }
  });
}

if (monteReturn) {
  monteReturn.addEventListener("input", () => {
    if (monteRisk) monteRisk.value = "custom";
  });
}

if (monteVol) {
  monteVol.addEventListener("input", () => {
    if (monteRisk) monteRisk.value = "custom";
  });
}

async function loadStateFromFirebase() {
  if (!firebaseClient?.db) return;

  try {
    const doc = await firebaseClient.db
      .collection("profiles")
      .doc(deviceId)
      .get();
    if (!doc.exists) return;

    const data = doc.data();
    const remoteState = data?.state;
    const remoteUpdatedAt = data?.updatedAt?.toMillis
      ? data.updatedAt.toMillis()
      : Number(data?.updatedAt) || 0;

    if (remoteState && remoteUpdatedAt > state.updatedAt) {
      applyState(remoteState, remoteUpdatedAt);
      syncFormFromState();
      showInitialScreen();
    }
  } catch (error) {
    // Ignore Firebase load failures.
  }
}

async function saveStateToFirebase() {
  if (!firebaseClient?.db) return;
  try {
    const payload = serializeState();
    await firebaseClient.db
      .collection("profiles")
      .doc(deviceId)
      .set(
        {
          state: payload,
          updatedAt: firebaseClient.firebase.firestore.FieldValue.serverTimestamp(),
          deviceId,
        },
        { merge: true }
      );
  } catch (error) {
    // Ignore Firebase save failures.
  }
}

if (window.POAP_FIREBASE?.db) {
  firebaseClient = window.POAP_FIREBASE;
  loadStateFromFirebase();
}

window.addEventListener("poap:firebase-ready", () => {
  firebaseClient = window.POAP_FIREBASE;
  loadStateFromFirebase();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
