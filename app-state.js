// ============================================================
// STATE SANITIZATION & PERSISTENCE
// ============================================================

function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...defaultState, expenses: { ...defaultState.expenses } };
  }

  const safe = { ...defaultState, ...raw };
  safe.expenses = { ...defaultState.expenses, ...(raw.expenses || {}) };

  safe.name = typeof safe.name === "string" ? safe.name : "";
  safe.focus = ["saving", "investing", "protection", "income"].includes(safe.focus)
    ? safe.focus
    : defaultState.focus;
  safe.horizon = ["short", "mid", "long"].includes(safe.horizon)
    ? safe.horizon
    : defaultState.horizon;
  safe.persona = Object.keys(personaData).includes(safe.persona)
    ? safe.persona
    : defaultState.persona;

  safe.annualSalary = Number(safe.annualSalary) || 0;
  safe.studentLoan = Boolean(safe.studentLoan);
  safe.pensionContrib = Boolean(safe.pensionContrib);
  safe.income = Number(safe.income) || 0;
  safe.savings = Number(safe.savings) || 0;

  // Sanitize expenses
  Object.keys(defaultState.expenses).forEach((key) => {
    safe.expenses[key] = Number(safe.expenses[key]) || 0;
  });

  safe.goals = Array.isArray(safe.goals)
    ? safe.goals
        .map((goal) => ({
          id: typeof goal.id === "string" && goal.id ? goal.id : `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: String(goal.name || "").trim(),
          target: Number(goal.target) || 0,
          saved: Number(goal.saved) || 0,
          monthly: Number(goal.monthly) || 0,
          targetDate: (typeof goal.targetDate === "string" && /^\d{4}-\d{2}$/.test(goal.targetDate)) ? goal.targetDate : null,
          priority: Math.max(1, Number(goal.priority) || 1),
          autoAllocate: goal.autoAllocate !== false,
          color: (typeof goal.color === "string" && /^(#[0-9A-Fa-f]{3,8}|[a-z]+)$/i.test(goal.color)) ? goal.color : null,
          createdAt: Number(goal.createdAt) || 0,
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
  safe.lastScreen =
    typeof safe.lastScreen === "string" && safe.lastScreen
      ? safe.lastScreen
      : defaultState.lastScreen;
  safe.updatedAt = Number(safe.updatedAt) || 0;

  // Sanitize assets
  safe.assets = { ...defaultState.assets, ...(raw.assets || {}) };
  Object.keys(defaultState.assets).forEach((key) => {
    safe.assets[key] = Number(safe.assets[key]) || 0;
  });

  // Sanitize liabilities
  safe.liabilities = { ...defaultState.liabilities, ...(raw.liabilities || {}) };
  Object.keys(defaultState.liabilities).forEach((key) => {
    safe.liabilities[key] = Number(safe.liabilities[key]) || 0;
  });

  // Sanitize credit score
  safe.creditScore = { ...defaultState.creditScore, ...(raw.creditScore || {}) };
  safe.creditScore.score = Number(safe.creditScore.score) || 0;
  safe.creditScore.provider = ["experian", "equifax", "transunion"].includes(
    safe.creditScore.provider,
  )
    ? safe.creditScore.provider
    : "";
  safe.creditScore.creditLimit = Number(safe.creditScore.creditLimit) || 0;
  safe.creditScore.creditUsed = Number(safe.creditScore.creditUsed) || 0;

  // Sanitize insurance
  safe.insurance = { ...defaultState.insurance, ...(raw.insurance || {}) };
  safe.insurance.lifeInsurance = Boolean(safe.insurance.lifeInsurance);
  safe.insurance.lifeInsuranceAmount = Number(safe.insurance.lifeInsuranceAmount) || 0;
  safe.insurance.incomeProtection = Boolean(safe.insurance.incomeProtection);
  safe.insurance.incomeProtectionPercent = Number(safe.insurance.incomeProtectionPercent) || 0;
  safe.insurance.criticalIllness = Boolean(safe.insurance.criticalIllness);
  safe.insurance.criticalIllnessAmount = Number(safe.insurance.criticalIllnessAmount) || 0;
  safe.insurance.homeContents = Boolean(safe.insurance.homeContents);
  safe.insurance.buildings = Boolean(safe.insurance.buildings);

  // Sanitize health score history
  safe.healthScoreHistory = Array.isArray(raw.healthScoreHistory) ? raw.healthScoreHistory : [];

  return safe;
}

function applyState(raw, updatedAtOverride) {
  const safe = sanitizeState(raw);
  Object.assign(state, safe);
  state.expenses = { ...safe.expenses };
  state.assets = { ...safe.assets };
  state.liabilities = { ...safe.liabilities };
  state.creditScore = { ...safe.creditScore };
  state.insurance = { ...safe.insurance };
  state.healthScoreHistory = [...safe.healthScoreHistory];
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
    // Ignore storage failures
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

// Expose state functions globally for cross-module access
Object.assign(window, {
  sanitizeState,
  applyState,
  loadLocalState,
  serializeState,
  saveLocalState,
  scheduleSave,
});
