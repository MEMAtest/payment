// Consumer Pay - Smart Financial Planning App
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

const CASHFLOW_SCENARIOS = ["baseline", "optimistic", "conservative", "stress", "custom"];
const DASHBOARD_WIDGET_KEYS = ["cashflow", "alerts", "vulnerabilities", "quickwins", "spark"];

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

// UK Tax rates 2024/25
const UK_TAX = {
  personalAllowance: 12570,
  basicRateLimit: 50270,
  higherRateLimit: 125140,
  basicRate: 0.20,
  higherRate: 0.40,
  additionalRate: 0.45,
  niThreshold: 12570,
  niUpperLimit: 50270,
  niRate: 0.08,
  niUpperRate: 0.02,
  studentLoanThreshold: 27295,
  studentLoanRate: 0.09,
};

const STORAGE_KEY = "consumerpay_state_v1";
const DEVICE_KEY = "consumerpay_device_id";
const FX_CACHE_KEY = "consumerpay_fx_cache_v1";
const ASSUMPTIONS_CACHE_KEY = "consumerpay_assumptions_cache_v1";

const screens = Array.from(document.querySelectorAll("[data-screen]"));
const steps = Array.from(document.querySelectorAll("[data-step]"));
let currentIndex = 0;

const defaultState = {
  name: "",
  focus: "saving",
  horizon: "short",
  persona: "builder",
  annualSalary: 0,
  studentLoan: false,
  pensionContrib: false,
  income: 0,
  expenses: {
    mortgage: 0,
    councilTax: 0,
    homeInsurance: 0,
    energy: 0,
    water: 0,
    internet: 0,
    streaming: 0,
    carPayment: 0,
    carInsurance: 0,
    fuel: 0,
    publicTransport: 0,
    groceries: 0,
    diningOut: 0,
    coffeeSnacks: 0,
    childcare: 0,
    kidsActivities: 0,
    schoolCosts: 0,
    kidsClothing: 0,
    gym: 0,
    clothing: 0,
    personalCare: 0,
    entertainment: 0,
    subscriptions: 0,
    creditCards: 0,
    personalLoans: 0,
    otherDebt: 0,
  },
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

  // === NET WORTH: ASSETS ===
  assets: {
    cashSavings: 0,        // Current account + savings accounts
    cashISA: 0,            // Cash ISAs
    stocksISA: 0,          // Stocks & Shares ISA
    generalInvestments: 0, // Non-ISA investments
    crypto: 0,             // Cryptocurrency
    pensionValue: 0,       // Total pension pot value
    propertyValue: 0,      // Primary residence value
    otherPropertyValue: 0, // Buy-to-let or second home
    vehicleValue: 0,       // Car(s) value
    otherAssets: 0,        // Valuables, collectibles, etc.
  },

  // === NET WORTH: LIABILITIES (Balances, not monthly payments) ===
  liabilities: {
    mortgageBalance: 0,    // Outstanding mortgage
    otherMortgages: 0,     // BTL mortgage balance
    personalLoansBalance: 0, // Total personal loans outstanding
    carFinanceBalance: 0,  // PCP/HP outstanding
    creditCardBalance: 0,  // Total credit card debt
    overdraftBalance: 0,   // Overdraft used
    studentLoanBalance: 0, // Student loan outstanding
    otherDebts: 0,         // Any other debts
  },

  // === CREDIT SCORE ===
  creditScore: {
    score: 0,              // 0-999 (Experian scale)
    provider: "",          // "experian", "equifax", "transunion"
    lastUpdated: null,     // ISO date string
    creditLimit: 0,        // Total available credit
    creditUsed: 0,         // Total credit used
  },

  // === INSURANCE COVERAGE ===
  insurance: {
    lifeInsurance: false,
    lifeInsuranceAmount: 0,
    incomeProtection: false,
    incomeProtectionPercent: 0,
    criticalIllness: false,
    criticalIllnessAmount: 0,
    homeContents: false,
    buildings: false,
  },

  // === FINANCIAL HEALTH TRACKING ===
  healthScoreHistory: [],  // Array of {date, score, breakdown}
};

const state = {
  ...defaultState,
  expenses: { ...defaultState.expenses },
  assets: { ...defaultState.assets },
  liabilities: { ...defaultState.liabilities },
  creditScore: { ...defaultState.creditScore },
  insurance: { ...defaultState.insurance },
  healthScoreHistory: [],
};
const deviceId = getDeviceId();

const personaData = {
  builder: {
    title: "Builder",
    copy: "You like structure, measurable goals, and automated progress. Consumer Pay keeps you focused with streaks, dashboards, and reward milestones.",
    tags: ["Goal focused", "Auto save", "Long term clarity"],
  },
  balancer: {
    title: "Balancer",
    copy: "You value stability and flexibility. We blend steady saving with an investing plan that adapts when life changes.",
    tags: ["Steady pacing", "Smart buffers", "Flexible goals"],
  },
  protector: {
    title: "Protector",
    copy: "You care about security for family and future. We highlight coverage gaps, emergency plans, and confidence milestones.",
    tags: ["Family first", "Safety nets", "Guided support"],
  },
  explorer: {
    title: "Explorer",
    copy: "You are motivated by possibility. We surface new income paths and show how bold goals impact your future.",
    tags: ["Opportunity", "Side income", "Scenario planning"],
  },
};

// Utility functions
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

// UK Salary Calculator
function calculateUKTax(annualSalary, hasStudentLoan = false, hasPension = false) {
  let taxableIncome = annualSalary;
  let pensionDeduction = 0;

  // Pension contribution (5% of gross)
  if (hasPension) {
    pensionDeduction = annualSalary * 0.05;
    taxableIncome = annualSalary - pensionDeduction;
  }

  // Personal allowance reduction for high earners
  let personalAllowance = UK_TAX.personalAllowance;
  if (taxableIncome > 100000) {
    const reduction = Math.floor((taxableIncome - 100000) / 2);
    personalAllowance = Math.max(0, personalAllowance - reduction);
  }

  // Income Tax calculation
  let incomeTax = 0;
  const taxableAfterAllowance = Math.max(0, taxableIncome - personalAllowance);

  if (taxableAfterAllowance > 0) {
    // Basic rate
    const basicBand = Math.min(taxableAfterAllowance, UK_TAX.basicRateLimit - UK_TAX.personalAllowance);
    incomeTax += basicBand * UK_TAX.basicRate;

    // Higher rate
    if (taxableAfterAllowance > UK_TAX.basicRateLimit - UK_TAX.personalAllowance) {
      const higherBand = Math.min(
        taxableAfterAllowance - (UK_TAX.basicRateLimit - UK_TAX.personalAllowance),
        UK_TAX.higherRateLimit - UK_TAX.basicRateLimit
      );
      incomeTax += higherBand * UK_TAX.higherRate;
    }

    // Additional rate
    if (taxableAfterAllowance > UK_TAX.higherRateLimit - UK_TAX.personalAllowance) {
      const additionalBand = taxableAfterAllowance - (UK_TAX.higherRateLimit - UK_TAX.personalAllowance);
      incomeTax += additionalBand * UK_TAX.additionalRate;
    }
  }

  // National Insurance
  let nationalInsurance = 0;
  if (annualSalary > UK_TAX.niThreshold) {
    const niBaseBand = Math.min(annualSalary - UK_TAX.niThreshold, UK_TAX.niUpperLimit - UK_TAX.niThreshold);
    nationalInsurance += niBaseBand * UK_TAX.niRate;

    if (annualSalary > UK_TAX.niUpperLimit) {
      nationalInsurance += (annualSalary - UK_TAX.niUpperLimit) * UK_TAX.niUpperRate;
    }
  }

  // Student Loan (Plan 2)
  let studentLoan = 0;
  if (hasStudentLoan && annualSalary > UK_TAX.studentLoanThreshold) {
    studentLoan = (annualSalary - UK_TAX.studentLoanThreshold) * UK_TAX.studentLoanRate;
  }

  const totalDeductions = incomeTax + nationalInsurance + studentLoan + pensionDeduction;
  const netAnnual = annualSalary - totalDeductions;

  // Determine tax band
  let taxBand = "Personal Allowance (0%)";
  if (taxableAfterAllowance > UK_TAX.higherRateLimit - UK_TAX.personalAllowance) {
    taxBand = "Additional Rate (45%)";
  } else if (taxableAfterAllowance > UK_TAX.basicRateLimit - UK_TAX.personalAllowance) {
    taxBand = "Higher Rate (40%)";
  } else if (taxableAfterAllowance > 0) {
    taxBand = "Basic Rate (20%)";
  }

  return {
    gross: annualSalary,
    tax: incomeTax,
    ni: nationalInsurance,
    studentLoan,
    pension: pensionDeduction,
    net: netAnnual,
    monthlyGross: annualSalary / 12,
    monthlyTax: incomeTax / 12,
    monthlyNI: nationalInsurance / 12,
    monthlyStudentLoan: studentLoan / 12,
    monthlyPension: pensionDeduction / 12,
    monthlyNet: netAnnual / 12,
    taxBand,
  };
}

function updateSalaryBreakdown() {
  const salary = state.annualSalary || 0;
  const calc = calculateUKTax(salary, state.studentLoan, state.pensionContrib);

  // Update income in state
  state.income = Math.round(calc.monthlyNet);

  // Update display elements
  setTextAll("[data-monthly-gross]", formatCurrency(calc.monthlyGross));
  setTextAll("[data-monthly-tax]", `-${formatCurrency(calc.monthlyTax)}`);
  setTextAll("[data-monthly-ni]", `-${formatCurrency(calc.monthlyNI)}`);
  setTextAll("[data-monthly-student]", `-${formatCurrency(calc.monthlyStudentLoan)}`);
  setTextAll("[data-monthly-pension]", `-${formatCurrency(calc.monthlyPension)}`);
  setTextAll("[data-monthly-net]", formatCurrency(calc.monthlyNet));
  setTextAll("[data-monthly-takehome]", formatCurrency(calc.monthlyNet));
  setTextAll("[data-band-name]", calc.taxBand);

  // Show/hide student loan and pension rows
  const studentRow = document.querySelector("[data-student-loan-row]");
  const pensionRow = document.querySelector("[data-pension-row]");
  if (studentRow) studentRow.style.display = state.studentLoan ? "flex" : "none";
  if (pensionRow) pensionRow.style.display = state.pensionContrib ? "flex" : "none";

  // Update ring chart
  updateSalaryRing(calc);
}

function updateSalaryRing(calc) {
  const circumference = 2 * Math.PI * 80; // ~502
  const gross = calc.gross || 1;

  const taxPct = calc.tax / gross;
  const niPct = calc.ni / gross;
  const otherPct = (calc.studentLoan + calc.pension) / gross;
  const netPct = calc.net / gross;

  // Ring segments (stroke-dashoffset decreases to show more)
  const taxRing = document.querySelector("[data-ring-tax]");
  const niRing = document.querySelector("[data-ring-ni]");
  const takeHomeRing = document.querySelector("[data-ring-takehome]");

  if (taxRing) {
    taxRing.style.strokeDashoffset = circumference * (1 - taxPct);
  }
  if (niRing) {
    niRing.style.strokeDashoffset = circumference * (1 - taxPct - niPct);
  }
  if (takeHomeRing) {
    takeHomeRing.style.strokeDashoffset = circumference * (1 - netPct);
  }
}

// Expense calculations
function calculateCategoryTotal(category) {
  const categoryMap = {
    housing: ["mortgage", "councilTax", "homeInsurance"],
    utilities: ["energy", "water", "internet", "streaming"],
    transport: ["carPayment", "carInsurance", "fuel", "publicTransport"],
    food: ["groceries", "diningOut", "coffeeSnacks"],
    family: ["childcare", "kidsActivities", "schoolCosts", "kidsClothing"],
    personal: ["gym", "clothing", "personalCare", "entertainment", "subscriptions"],
    debt: ["creditCards", "personalLoans", "otherDebt"],
  };

  const fields = categoryMap[category] || [];
  return fields.reduce((sum, field) => sum + (Number(state.expenses[field]) || 0), 0);
}

function calculateTotalExpenses() {
  return Object.values(state.expenses).reduce((sum, val) => sum + (Number(val) || 0), 0);
}

function updateCategoryTotals() {
  const categories = ["housing", "utilities", "transport", "food", "family", "personal", "debt"];
  categories.forEach((cat) => {
    const total = calculateCategoryTotal(cat);
    const el = document.querySelector(`[data-category-total="${cat}"]`);
    if (el) el.textContent = formatCurrency(total);
  });

  // Savings display
  const savingsEl = document.querySelector('[data-category-total="savings"]');
  if (savingsEl) savingsEl.textContent = formatCurrency(state.savings);
}

function updateBudgetSummary() {
  const income = state.income || 0;
  const totalExpenses = calculateTotalExpenses();
  const remaining = income - totalExpenses;

  setTextAll("[data-budget-income]", formatCurrency(income));
  setTextAll("[data-budget-remaining]", formatCurrency(remaining));

  const remainingEl = document.querySelector("[data-remaining-indicator]");
  if (remainingEl) {
    remainingEl.classList.toggle("positive", remaining >= 0);
    remainingEl.classList.toggle("negative", remaining < 0);
  }

  // Flow chart
  const maxVal = Math.max(income, totalExpenses, 1);
  const incomeFlow = document.querySelector("[data-flow-income]");
  const expensesFlow = document.querySelector("[data-flow-expenses]");
  const surplusFlow = document.querySelector("[data-flow-surplus]");

  if (incomeFlow) incomeFlow.style.setProperty("--fill", `${(income / maxVal) * 100}%`);
  if (expensesFlow) expensesFlow.style.setProperty("--fill", `${(totalExpenses / maxVal) * 100}%`);
  if (surplusFlow) surplusFlow.style.setProperty("--fill", `${(Math.max(0, remaining) / maxVal) * 100}%`);

  setTextAll("[data-flow-income-amount]", formatCurrency(income));
  setTextAll("[data-flow-expenses-amount]", formatCurrency(totalExpenses));
  setTextAll("[data-flow-surplus-amount]", formatCurrency(Math.max(0, remaining)));

  // Goals page surplus
  setTextAll("[data-goals-surplus]", formatCurrency(Math.max(0, remaining)));
}

// State management
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
  safe.creditScore.provider = ["experian", "equifax", "transunion"].includes(safe.creditScore.provider)
    ? safe.creditScore.provider : "";
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

// Screen navigation
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

  // Update budget page when shown
  if (screenId === "budget") {
    updateCategoryTotals();
    updateBudgetSummary();
  }

  // Update goals page
  if (screenId === "goals") {
    updateBudgetSummary();
  }
}

function showInitialScreen() {
  const target = state.onboardingComplete ? "app" : state.lastScreen;
  const index = screens.findIndex((screen) => screen.dataset.screen === target);
  showScreen(index === -1 ? 0 : index);
}

// UI Updates
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

function getFinanceSnapshot() {
  const totalExpenses = calculateTotalExpenses();
  return {
    income: state.income,
    expenses: totalExpenses,
    savings: state.savings,
    surplus: state.income - totalExpenses,
    debt: calculateCategoryTotal("debt"),
  };
}

function updateSummary() {
  const snapshot = getFinanceSnapshot();
  const surplus = snapshot.surplus;
  const surplusLabel = surplus >= 0 ? "surplus" : "deficit";
  const bufferMonths = snapshot.expenses ? snapshot.savings / (snapshot.expenses || 1) : 0;
  const goalsCount = state.goals.length;
  const debtRatio = snapshot.income ? snapshot.debt / snapshot.income : 0;
  const surplusRatio = snapshot.income ? snapshot.surplus / snapshot.income : 0;

  setTextAll("[data-summary-name]", state.name || "Friend");
  setTextAll("[data-user-name]", state.name || "Friend");
  setTextAll("[data-summary-surplus]", formatCurrency(surplus));
  setTextAll("[data-app-surplus]", `${formatCurrency(surplus)} ${surplusLabel}`);
  setTextAll("[data-summary-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-app-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-summary-goals]", `${goalsCount} goal${goalsCount === 1 ? "" : "s"}`);

  const summaryNext = document.querySelector("[data-summary-next]");
  let nextStep = "";
  if (surplus < 0) {
    nextStep = "Reduce expenses to reach break-even.";
  } else if (bufferMonths < 1) {
    nextStep = "Build a 1 month emergency buffer.";
  } else if (bufferMonths < 3) {
    nextStep = "Grow your buffer to 3 months.";
  } else if (goalsCount === 0) {
    nextStep = "Add your first goal to start tracking.";
  } else {
    nextStep = "Automate savings to your top goal.";
  }
  if (summaryNext) summaryNext.textContent = nextStep;

  // Confidence score
  const baseScore = 50;
  const bufferScore = Math.min(25, Math.round(bufferMonths * 6));
  const goalScore = Math.min(15, goalsCount * 3);
  const cashflowScore = Math.min(10, Math.round(Math.max(0, surplusRatio * 40)));
  let debtPenalty = 0;
  if (debtRatio > 0.35) debtPenalty = -12;
  else if (debtRatio > 0.2) debtPenalty = -6;

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
  updateAlertList();
  updateSmartInsights();
}

function updateGoalList() {
  const goalList = document.querySelector("[data-app-goals]");
  if (!goalList) return;

  if (!state.goals.length) {
    goalList.innerHTML = '<p class="muted">No goals yet. Add one to start tracking progress.</p>';
    return;
  }

  const items = state.goals.map((goal, index) => {
    const savedValue = Number(goal.saved) || 0;
    const monthlyValue = Number(goal.monthly) || 0;
    const targetValue = goal.target ? goal.target : "";
    const progress = goal.target ? Math.min(100, Math.round((savedValue / goal.target) * 100)) : 0;

    let timelineLabel = "Set a monthly amount to estimate timing";
    if (!goal.target) {
      timelineLabel = "Set a target to estimate timing";
    } else if (savedValue >= goal.target) {
      timelineLabel = "Goal reached!";
    } else if (monthlyValue > 0) {
      const months = Math.ceil((goal.target - savedValue) / monthlyValue);
      const eta = new Date();
      eta.setMonth(eta.getMonth() + months);
      const etaLabel = eta.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      timelineLabel = `~${months} months (ETA ${etaLabel})`;
    }

    return `
      <div class="goal-item" data-goal-index="${index}">
        <div class="goal-row">
          <div>
            <p class="card-title">${goal.name}</p>
            <p class="muted">${timelineLabel}</p>
          </div>
          <input class="goal-input" type="number" min="0" step="100" placeholder="Target" value="${targetValue}" data-goal-target-input />
        </div>
        <div class="goal-edit-grid">
          <label>
            Saved so far
            <input type="number" min="0" step="50" value="${savedValue || ""}" data-goal-saved-input />
          </label>
          <label>
            Monthly contribution
            <input type="number" min="0" step="25" value="${monthlyValue || ""}" data-goal-monthly-input />
          </label>
        </div>
        <div class="progress"><span style="width: ${progress}%"></span></div>
        <p class="muted">${progress}% funded</p>
      </div>
    `;
  });

  goalList.innerHTML = items.join("");
  attachGoalInputListeners();
}

function attachGoalInputListeners() {
  document.querySelectorAll("[data-goal-index]").forEach((item) => {
    const index = parseInt(item.dataset.goalIndex, 10);
    const targetInput = item.querySelector("[data-goal-target-input]");
    const savedInput = item.querySelector("[data-goal-saved-input]");
    const monthlyInput = item.querySelector("[data-goal-monthly-input]");

    if (targetInput) {
      targetInput.addEventListener("input", () => {
        state.goals[index].target = Number(targetInput.value) || 0;
        scheduleSave();
        updateGoalList();
      });
    }
    if (savedInput) {
      savedInput.addEventListener("input", () => {
        state.goals[index].saved = Number(savedInput.value) || 0;
        scheduleSave();
        updateGoalList();
      });
    }
    if (monthlyInput) {
      monthlyInput.addEventListener("input", () => {
        state.goals[index].monthly = Number(monthlyInput.value) || 0;
        scheduleSave();
        updateGoalList();
      });
    }
  });
}

function updateDashboardVisibility() {
  DASHBOARD_WIDGET_KEYS.forEach((key) => {
    const widget = document.querySelector(`[data-widget="${key}"]`);
    if (widget) {
      widget.classList.toggle("is-hidden", !state.dashboardWidgets.includes(key));
    }
  });
}

function updateIncomeBreakdown() {
  const snapshot = getFinanceSnapshot();
  const max = Math.max(snapshot.income, snapshot.expenses, 1);

  const incomeBar = document.querySelector("[data-income-bar]");
  const expenseBar = document.querySelector("[data-expense-bar]");
  const savingBar = document.querySelector("[data-saving-bar]");

  if (incomeBar) incomeBar.style.setProperty("--fill", snapshot.income / max);
  if (expenseBar) expenseBar.style.setProperty("--fill", snapshot.expenses / max);
  if (savingBar) savingBar.style.setProperty("--fill", Math.max(0, snapshot.surplus) / max);

  setTextAll("[data-income-label]", formatCurrency(snapshot.income));
  setTextAll("[data-expense-label]", formatCurrency(snapshot.expenses));
  setTextAll("[data-saving-label]", formatCurrency(Math.max(0, snapshot.surplus)));
}

// Cash flow chart
function buildCashflowData(months, scenario) {
  const preset = cashflowPresets[scenario] || cashflowPresets.baseline;
  const incomeAdj = scenario === "custom" ? state.cashflowIncomeChange : preset.incomeChange;
  const expenseAdj = scenario === "custom" ? state.cashflowExpenseChange : preset.expenseChange;

  const snapshot = getFinanceSnapshot();
  const baseIncome = snapshot.income;
  const baseExpense = snapshot.expenses;
  const startBalance = snapshot.savings;

  const data = [];
  let balance = startBalance;

  for (let i = 0; i < months; i++) {
    const seasonality = 1 + Math.sin((i / 12) * Math.PI * 2) * 0.03;
    const income = Math.round(baseIncome * (1 + incomeAdj / 100) * seasonality);
    let expense = Math.round(baseExpense * (1 + expenseAdj / 100));

    if (preset.shock && i >= 3 && i <= 5) {
      expense = Math.round(expense * 1.25);
    }

    const net = income - expense;
    balance += net;

    const date = new Date();
    date.setMonth(date.getMonth() + i);

    data.push({
      month: date.toLocaleDateString("en-GB", { month: "short" }),
      income,
      expense,
      net,
      balance,
    });
  }

  return data;
}

function renderCashflowChart(data) {
  const container = document.querySelector("[data-cashflow-chart]");
  if (!container) return;

  const { width, height, padding } = CASHFLOW_CHART;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const balances = data.map((d) => d.balance);
  const nets = data.map((d) => d.net);
  const maxBalance = Math.max(...balances, 0);
  const minBalance = Math.min(...balances, 0);
  const maxNet = Math.max(...nets.map(Math.abs), 1);
  const balanceRange = Math.max(maxBalance - minBalance, 1);

  const barWidth = Math.max(8, (chartWidth / data.length) * 0.5);
  const gap = (chartWidth - barWidth * data.length) / (data.length - 1 || 1);

  const scaleY = (val) => padding + chartHeight - ((val - minBalance) / balanceRange) * chartHeight;
  const scaleNetY = (val) => (Math.abs(val) / maxNet) * (chartHeight * 0.3);
  const zeroY = scaleY(0);

  // Build balance line path
  const linePath = data
    .map((d, i) => {
      const x = padding + i * (barWidth + gap) + barWidth / 2;
      const y = scaleY(d.balance);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Build area path
  const firstX = padding + barWidth / 2;
  const lastX = padding + (data.length - 1) * (barWidth + gap) + barWidth / 2;
  const areaPath = `${linePath} L ${lastX} ${height - padding} L ${firstX} ${height - padding} Z`;

  // Build bars
  const bars = data
    .map((d, i) => {
      const x = padding + i * (barWidth + gap);
      const barHeight = scaleNetY(d.net);
      const y = d.net >= 0 ? zeroY - barHeight : zeroY;
      const cls = d.net >= 0 ? "positive" : "negative";
      return `<rect class="net-bar ${cls}" x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" data-index="${i}" />`;
    })
    .join("");

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75]
    .map((pct) => {
      const y = padding + chartHeight * (1 - pct);
      return `<line class="grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
    })
    .join("");

  container.innerHTML = `
    <svg class="cashflow-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      <line class="zero-line" x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" />
      <path class="balance-area" d="${areaPath}" />
      <path class="balance-line" d="${linePath}" />
      ${bars}
      <line class="focus-line" x1="0" y1="0" x2="0" y2="${height}" data-focus-line />
      <circle class="focus-dot" cx="0" cy="0" r="6" data-focus-dot />
    </svg>
    <div class="chart-tooltip" data-chart-tooltip>
      <div class="tooltip-title" data-tooltip-month></div>
      <div><strong>Balance:</strong> <span data-tooltip-balance></span></div>
      <div><strong>Income:</strong> <span data-tooltip-income></span></div>
      <div><strong>Expenses:</strong> <span data-tooltip-expense></span></div>
      <div><strong>Net:</strong> <span data-tooltip-net></span></div>
    </div>
  `;

  currentCashflowData = data;
  attachCashflowInteractions();
}

function attachCashflowInteractions() {
  const container = document.querySelector("[data-cashflow-chart]");
  if (!container || !currentCashflowData) return;

  const svg = container.querySelector("svg");
  const tooltip = container.querySelector("[data-chart-tooltip]");
  const focusLine = container.querySelector("[data-focus-line]");
  const focusDot = container.querySelector("[data-focus-dot]");

  if (!svg || !tooltip) return;

  const { width, height, padding } = CASHFLOW_CHART;
  const data = currentCashflowData;
  const chartWidth = width - padding * 2;
  const barWidth = Math.max(8, (chartWidth / data.length) * 0.5);
  const gap = (chartWidth - barWidth * data.length) / (data.length - 1 || 1);

  const balances = data.map((d) => d.balance);
  const maxBalance = Math.max(...balances, 0);
  const minBalance = Math.min(...balances, 0);
  const balanceRange = Math.max(maxBalance - minBalance, 1);
  const scaleY = (val) => padding + (height - padding * 2) - ((val - minBalance) / balanceRange) * (height - padding * 2);

  function showTooltip(index, clientX) {
    const d = data[index];
    if (!d) return;

    tooltip.querySelector("[data-tooltip-month]").textContent = d.month;
    tooltip.querySelector("[data-tooltip-balance]").textContent = formatCurrency(d.balance);
    tooltip.querySelector("[data-tooltip-income]").textContent = formatCurrency(d.income);
    tooltip.querySelector("[data-tooltip-expense]").textContent = formatCurrency(d.expense);
    tooltip.querySelector("[data-tooltip-net]").textContent = formatSignedCurrency(d.net);

    const x = padding + index * (barWidth + gap) + barWidth / 2;
    const y = scaleY(d.balance);

    if (focusLine) {
      focusLine.setAttribute("x1", x);
      focusLine.setAttribute("x2", x);
      focusLine.style.opacity = 1;
    }
    if (focusDot) {
      focusDot.setAttribute("cx", x);
      focusDot.setAttribute("cy", y);
      focusDot.style.opacity = 1;
    }

    const rect = container.getBoundingClientRect();
    const tooltipX = (x / width) * rect.width;
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${(y / height) * rect.height}px`;
    tooltip.classList.add("is-visible");
  }

  function hideTooltip() {
    tooltip.classList.remove("is-visible");
    if (focusLine) focusLine.style.opacity = 0;
    if (focusDot) focusDot.style.opacity = 0;
  }

  svg.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const index = Math.floor((x - padding) / (barWidth + gap));
    if (index >= 0 && index < data.length) {
      showTooltip(index, e.clientX);
    }
  });

  svg.addEventListener("mouseleave", hideTooltip);
}

function updateCashflowInsights() {
  const data = buildCashflowData(state.cashflowMonths, state.cashflowScenario);
  renderCashflowChart(data);

  const avgNet = data.reduce((sum, d) => sum + d.net, 0) / data.length;
  const lowBalance = Math.min(...data.map((d) => d.balance));
  const riskMonths = data.filter((d) => d.balance < 0).length;

  setTextAll("[data-cashflow-average]", formatCurrency(avgNet));
  setTextAll("[data-cashflow-low]", formatCurrency(lowBalance));
  setTextAll("[data-cashflow-risk]", riskMonths);
}

// Vulnerability panel
function updateVulnerabilityPanel() {
  const vulnList = document.querySelector("[data-vulnerability-list]");
  const vulnScore = document.querySelector("[data-vulnerability-score]");
  if (!vulnList) return;

  const snapshot = getFinanceSnapshot();
  const bufferMonths = snapshot.expenses ? snapshot.savings / snapshot.expenses : 0;
  const debtRatio = snapshot.income ? snapshot.debt / snapshot.income : 0;

  const vulns = [];

  if (bufferMonths < 1) {
    vulns.push({ text: "Emergency buffer below 1 month", severity: "high" });
  } else if (bufferMonths < 3) {
    vulns.push({ text: "Emergency buffer below 3 months", severity: "medium" });
  }

  if (debtRatio > 0.35) {
    vulns.push({ text: "Debt payments exceed 35% of income", severity: "high" });
  } else if (debtRatio > 0.2) {
    vulns.push({ text: "Debt payments above 20% of income", severity: "medium" });
  }

  if (snapshot.surplus < 0) {
    vulns.push({ text: "Monthly expenses exceed income", severity: "high" });
  }

  if (state.goals.length === 0) {
    vulns.push({ text: "No financial goals set", severity: "low" });
  }

  if (vulns.length === 0) {
    vulnList.innerHTML = '<li class="vuln-item"><span>No major vulnerabilities detected</span><span class="severity low">Good</span></li>';
  } else {
    vulnList.innerHTML = vulns
      .map((v) => `<li class="vuln-item"><span>${v.text}</span><span class="severity ${v.severity}">${v.severity}</span></li>`)
      .join("");
  }

  if (vulnScore) {
    const highCount = vulns.filter((v) => v.severity === "high").length;
    const medCount = vulns.filter((v) => v.severity === "medium").length;
    let level = "Low";
    if (highCount > 0) level = "High";
    else if (medCount > 0) level = "Medium";
    vulnScore.textContent = level;
  }
}

// Alert list
function updateAlertList() {
  const alertList = document.querySelector("[data-alert-list]");
  if (!alertList) return;

  const snapshot = getFinanceSnapshot();
  const alerts = [];

  if (snapshot.surplus < 0) {
    alerts.push({ title: "Budget deficit this month", date: "Review expenses", severity: "high" });
  }

  if (snapshot.savings < snapshot.expenses) {
    alerts.push({ title: "Emergency fund low", date: "Build buffer", severity: "medium" });
  }

  const upcomingGoals = state.goals.filter((g) => g.target && g.saved >= g.target * 0.9 && g.saved < g.target);
  upcomingGoals.forEach((g) => {
    alerts.push({ title: `${g.name} almost reached`, date: "Nearly there!", severity: "low" });
  });

  if (alerts.length === 0) {
    alertList.innerHTML = '<li class="alert-item"><div><p class="alert-title">All clear</p><p class="muted">No alerts at this time</p></div></li>';
  } else {
    alertList.innerHTML = alerts
      .map(
        (a) => `
        <li class="alert-item">
          <div>
            <p class="alert-title">${a.title}</p>
            <p class="muted">${a.date}</p>
          </div>
          <span class="severity ${a.severity}">${a.severity}</span>
        </li>
      `
      )
      .join("");
  }
}

// Monte Carlo simulation
function randomNormal() {
  let u = 0,
    v = 0;
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

  const history = [value];

  for (let i = 0; i < months; i++) {
    const monthlyReturn = monthlyMean + randomNormal() * monthlyVol;
    value = (value + contribution) * (1 + monthlyReturn);
    contribution *= 1 + growthRate;
    history.push(value);
  }

  return { finalValue: value, history };
}

let riskProfiles = {
  cautious: { mean: 0.045, vol: 0.06 },
  balanced: { mean: 0.06, vol: 0.1 },
  growth: { mean: 0.08, vol: 0.14 },
};

function percentile(arr, p) {
  const idx = (arr.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return arr[lower];
  return arr[lower] + (arr[upper] - arr[lower]) * (idx - lower);
}

function updateMonteCarlo() {
  const startEl = document.querySelector("[data-monte-start]");
  const monthlyEl = document.querySelector("[data-monte-monthly]");
  const growthEl = document.querySelector("[data-monte-growth]");
  const yearsEl = document.querySelector("[data-monte-years]");
  const riskEl = document.querySelector("[data-monte-risk]");
  const returnEl = document.querySelector("[data-monte-return]");
  const volEl = document.querySelector("[data-monte-vol]");
  const inflationEl = document.querySelector("[data-monte-inflation]");
  const feeEl = document.querySelector("[data-monte-fee]");
  const targetEl = document.querySelector("[data-monte-target]");
  const runsEl = document.querySelector("[data-monte-runs]");

  const start = Number(startEl?.value) || 2500;
  const monthly = Number(monthlyEl?.value) || 350;
  const growth = Number(growthEl?.value) || 2;
  const years = Number(yearsEl?.value) || 20;
  const risk = riskEl?.value || "balanced";
  const inflation = Number(inflationEl?.value) || 2.5;
  const fee = Number(feeEl?.value) || 0.6;
  const target = Number(targetEl?.value) || 100000;
  const runs = Math.min(Math.max(Number(runsEl?.value) || 500, 100), 5000);

  let mean, vol;
  if (risk === "custom") {
    mean = (Number(returnEl?.value) || 6) / 100;
    vol = (Number(volEl?.value) || 10) / 100;
  } else {
    const profile = riskProfiles[risk] || riskProfiles.balanced;
    mean = profile.mean;
    vol = profile.vol;
    if (returnEl) returnEl.value = (mean * 100).toFixed(1);
    if (volEl) volEl.value = (vol * 100).toFixed(1);
  }

  const realMean = mean - inflation / 100 - fee / 100;

  const results = [];
  let hits = 0;

  for (let i = 0; i < runs; i++) {
    const { finalValue } = simulatePortfolio({
      start,
      monthly,
      years,
      mean: realMean,
      vol,
      growth,
    });
    results.push(finalValue);
    if (finalValue >= target) hits++;
  }

  results.sort((a, b) => a - b);

  const low = percentile(results, 0.1);
  const mid = percentile(results, 0.5);
  const high = percentile(results, 0.9);
  const hitRate = Math.round((hits / runs) * 100);

  setTextAll("[data-monte-output]", `Projected range: ${formatCurrency(low)} - ${formatCurrency(high)}`);
  setTextAll("[data-monte-sims]", runs);
  setTextAll("[data-monte-hit]", `${hitRate}%`);
  setTextAll("[data-monte-real]", `${(realMean * 100).toFixed(1)}%`);
  setTextAll("[data-monte-p10]", `10th: ${formatCurrency(low)}`);
  setTextAll("[data-monte-p50]", `50th: ${formatCurrency(mid)}`);
  setTextAll("[data-monte-p90]", `90th: ${formatCurrency(high)}`);

  // Histogram
  const buckets = 12;
  const min = results[0];
  const max = results[results.length - 1];
  const bucketSize = (max - min) / buckets;
  const counts = new Array(buckets).fill(0);

  results.forEach((r) => {
    const idx = Math.min(Math.floor((r - min) / bucketSize), buckets - 1);
    counts[idx]++;
  });

  const maxCount = Math.max(...counts, 1);
  const barsContainer = document.querySelector("[data-monte-bars]");
  if (barsContainer) {
    barsContainer.innerHTML = counts
      .map((count, i) => {
        const h = (count / maxCount) * 100;
        const rangeStart = formatCurrency(min + i * bucketSize);
        const rangeEnd = formatCurrency(min + (i + 1) * bucketSize);
        return `<div class="bar" style="--h: ${h}" data-range="${rangeStart} - ${rangeEnd}" data-count="${count}"></div>`;
      })
      .join("");

    // Add tooltips
    barsContainer.querySelectorAll(".bar").forEach((bar) => {
      bar.addEventListener("mouseenter", (e) => {
        const tooltip = document.querySelector(".monte-tooltip") || createMonteTooltip();
        tooltip.textContent = `${bar.dataset.range}: ${bar.dataset.count} runs`;
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY - 40}px`;
        tooltip.classList.add("is-visible");
      });
      bar.addEventListener("mouseleave", () => {
        const tooltip = document.querySelector(".monte-tooltip");
        if (tooltip) tooltip.classList.remove("is-visible");
      });
    });
  }

  // Generate report
  generateMonteCarloReport({ start, monthly, growth, years, mean, vol, realMean, target, runs, low, mid, high, hitRate, results });
}

function createMonteTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "monte-tooltip";
  document.querySelector(".monte-panel")?.appendChild(tooltip);
  return tooltip;
}

function generateMonteCarloReport(params) {
  const reportEl = document.querySelector("[data-monte-report]");
  const contentEl = document.querySelector("[data-report-content]");
  if (!reportEl || !contentEl) return;

  const { start, monthly, growth, years, mean, realMean, target, runs, low, mid, high, hitRate, results } = params;

  const totalContributions = start + monthly * 12 * years * (1 + (growth / 100 / 2) * years);
  const medianGrowth = mid - totalContributions;
  const shortfallRisk = results.filter((r) => r < target * 0.5).length / runs;

  const report = `
    <p><strong>Simulation Summary</strong></p>
    <p>Based on ${runs.toLocaleString()} Monte Carlo simulations over ${years} years:</p>
    <ul>
      <li><strong>Starting investment:</strong> ${formatCurrency(start)}</li>
      <li><strong>Monthly contribution:</strong> ${formatCurrency(monthly)} (growing ${growth}% annually)</li>
      <li><strong>Expected real return:</strong> ${(realMean * 100).toFixed(1)}% per year</li>
      <li><strong>Target value:</strong> ${formatCurrency(target)}</li>
    </ul>
    <p><strong>Projected Outcomes</strong></p>
    <ul>
      <li><strong>10th percentile (worst case):</strong> ${formatCurrency(low)}</li>
      <li><strong>50th percentile (median):</strong> ${formatCurrency(mid)}</li>
      <li><strong>90th percentile (best case):</strong> ${formatCurrency(high)}</li>
    </ul>
    <p><strong>Key Insights</strong></p>
    <ul>
      <li>There is a <strong>${hitRate}%</strong> probability of reaching your ${formatCurrency(target)} target.</li>
      <li>Your total contributions would be approximately ${formatCurrency(totalContributions)}.</li>
      <li>Median investment growth: ${formatCurrency(medianGrowth)} (${((medianGrowth / totalContributions) * 100).toFixed(0)}% return on contributions).</li>
      <li>Risk of significant shortfall (below 50% of target): ${(shortfallRisk * 100).toFixed(1)}%</li>
    </ul>
    <p><strong>Recommendation</strong></p>
    <p>${hitRate >= 75 ? "Your plan is on track. Consider maintaining your current strategy." : hitRate >= 50 ? "Moderate success probability. Consider increasing contributions or extending your timeline." : "Lower probability of reaching target. Review your risk profile, increase contributions, or adjust your goal."}</p>
  `;

  contentEl.innerHTML = report;
  reportEl.style.display = "block";
}

// Future scenario
function runFutureScenario() {
  const typeEl = document.querySelector("[data-future-type]");
  const monthsEl = document.querySelector("[data-future-months]");
  const amountEl = document.querySelector("[data-future-amount]");

  if (!typeEl) return;

  const type = typeEl.value;
  const months = Number(monthsEl?.value) || 6;
  const amount = Number(amountEl?.value) || 250;

  const scenario = FUTURE_SCENARIOS[type];
  const monthsLabel = document.querySelector("[data-future-months-label]");
  const amountLabel = document.querySelector("[data-future-amount-label]");

  if (monthsLabel) monthsLabel.textContent = scenario?.monthsLabel || "Months";
  if (amountLabel) amountLabel.textContent = scenario?.amountLabel || "Amount (£)";

  const snapshot = getFinanceSnapshot();
  let balanceImpact = 0;
  let riskMonths = 0;
  let goalDelay = "--";

  switch (type) {
    case "pause_investing":
      balanceImpact = snapshot.surplus * months;
      break;
    case "income_drop":
      balanceImpact = -amount * months;
      break;
    case "income_boost":
      balanceImpact = amount * months;
      break;
    case "expense_spike":
      balanceImpact = -amount * months;
      break;
    case "one_off":
      balanceImpact = -amount;
      break;
  }

  const projectedBalance = snapshot.savings + balanceImpact;
  if (projectedBalance < 0) {
    riskMonths = Math.ceil(Math.abs(projectedBalance) / (snapshot.expenses || 1));
  }

  if (state.goals.length > 0 && snapshot.surplus > 0) {
    const firstGoal = state.goals[0];
    const remaining = (firstGoal.target || 0) - (firstGoal.saved || 0);
    if (remaining > 0) {
      const normalMonths = Math.ceil(remaining / snapshot.surplus);
      const adjustedSurplus = snapshot.surplus + balanceImpact / Math.max(months, 1);
      const adjustedMonths = adjustedSurplus > 0 ? Math.ceil(remaining / adjustedSurplus) : Infinity;
      const delay = adjustedMonths - normalMonths;
      goalDelay = delay > 0 ? `+${delay} months` : delay < 0 ? `${delay} months` : "No change";
    }
  }

  setTextAll("[data-future-balance]", formatSignedCurrency(balanceImpact));
  setTextAll("[data-future-risk]", riskMonths);
  setTextAll("[data-future-delay]", goalDelay);
  setTextAll("[data-future-summary]", `This scenario would ${balanceImpact >= 0 ? "add" : "reduce"} ${formatCurrency(Math.abs(balanceImpact))} from your position.`);
}

// Currency converter
let fxRates = null;

async function loadFxRates() {
  try {
    const cached = localStorage.getItem(FX_CACHE_KEY);
    if (cached) {
      const { rates, timestamp } = JSON.parse(cached);
      const age = (Date.now() - timestamp) / 1000 / 60 / 60;
      if (age < config.fxCacheHours) {
        fxRates = rates;
        setTextAll("[data-fx-updated]", `Rates updated: ${formatTimestamp(timestamp)}`);
        return;
      }
    }

    const res = await fetch(config.fxApiUrl);
    const data = await res.json();
    fxRates = data.rates;
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates: fxRates, timestamp: Date.now() }));
    setTextAll("[data-fx-updated]", `Rates updated: ${formatTimestamp(Date.now())}`);
  } catch (e) {
    fxRates = { GBP: 1, USD: 1.27, EUR: 1.17, NGN: 1800, GHS: 15.5, ZAR: 23.5, KES: 195, CAD: 1.72 };
  }
}

function updateConverter() {
  const amountEl = document.querySelector("[data-converter-amount]");
  const fromEl = document.querySelector("[data-converter-from]");
  const toEl = document.querySelector("[data-converter-to]");
  const outputEl = document.querySelector("[data-converter-output]");

  if (!fxRates || !amountEl || !outputEl) return;

  const amount = Number(amountEl.value) || 0;
  const from = fromEl?.value || "GBP";
  const to = toEl?.value || "USD";

  const inGBP = from === "GBP" ? amount : amount / (fxRates[from] || 1);
  const result = to === "GBP" ? inGBP : inGBP * (fxRates[to] || 1);

  outputEl.textContent = `${amount.toLocaleString()} ${from} = ${result.toFixed(2)} ${to}`;
}

// Goals from onboarding
function updateGoalsFromCards() {
  const cards = document.querySelectorAll("[data-goal-card]");
  const goals = [];

  cards.forEach((card) => {
    const checkbox = card.querySelector("[data-goal-check]");
    const targetInput = card.querySelector("[data-goal-target]");

    if (checkbox?.checked) {
      goals.push({
        name: checkbox.value,
        target: Number(targetInput?.value) || Number(targetInput?.placeholder) || 0,
        saved: 0,
        monthly: 0,
      });
    }

    card.classList.toggle("active", checkbox?.checked);
  });

  state.goals = goals;
  scheduleSave();
}

// Form sync
function syncFormFromState() {
  document.querySelectorAll("[data-field]").forEach((el) => {
    const field = el.dataset.field;
    if (field === "annualSalary") {
      el.value = state.annualSalary || "";
    } else if (field === "studentLoan") {
      el.checked = state.studentLoan;
    } else if (field === "pensionContrib") {
      el.checked = state.pensionContrib;
    } else if (field === "savings") {
      el.value = state.savings || "";
    } else if (field === "name") {
      el.value = state.name || "";
    } else if (field === "rewardPoints") {
      el.value = state.rewardPoints || "";
    } else if (field === "rewardStreak") {
      el.value = state.rewardStreak || "";
    } else if (state[field] !== undefined) {
      el.value = state[field];
    }
  });

  // Sync expense inputs
  document.querySelectorAll("[data-expense]").forEach((el) => {
    const key = el.dataset.expense;
    if (state.expenses[key] !== undefined) {
      el.value = state.expenses[key] || "";
    }
  });

  // Sync choice groups
  document.querySelectorAll("[data-choice-group]").forEach((group) => {
    const field = group.dataset.choiceGroup;
    const val = state[field];
    group.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === val);
    });
  });

  // Sync dashboard toggles
  document.querySelectorAll("[data-dashboard-toggle]").forEach((el) => {
    el.checked = state.dashboardWidgets.includes(el.value);
  });

  updatePersona();
  updateSalaryBreakdown();
  updateCategoryTotals();
  updateBudgetSummary();
}

// Firebase (optional)
async function initFirebase() {
  if (typeof window.initFirebaseClient === "function") {
    try {
      firebaseClient = await window.initFirebaseClient();
      await loadStateFromFirebase();
    } catch (e) {
      console.warn("Firebase initialization failed:", e);
    }
  }
}

async function loadStateFromFirebase() {
  if (!firebaseClient) return;
  try {
    const doc = await firebaseClient.getDoc(firebaseClient.doc(firebaseClient.db, "users", deviceId));
    if (doc.exists()) {
      const remote = doc.data();
      if (remote.updatedAt > state.updatedAt) {
        applyState(remote, remote.updatedAt);
        syncFormFromState();
        updateSummary();
      }
    }
  } catch (e) {
    console.warn("Failed to load from Firebase:", e);
  }
}

async function saveStateToFirebase() {
  if (!firebaseClient) return;
  try {
    const payload = serializeState();
    await firebaseClient.setDoc(firebaseClient.doc(firebaseClient.db, "users", deviceId), payload);
  } catch (e) {
    console.warn("Failed to save to Firebase:", e);
  }
}

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
        state.annualSalary = Number(el.value) || 0;
        updateSalaryBreakdown();
        scheduleHealthUpdate();
      } else if (field === "studentLoan") {
        state.studentLoan = el.checked;
        updateSalaryBreakdown();
      } else if (field === "pensionContrib") {
        state.pensionContrib = el.checked;
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
      scheduleHealthUpdate();
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
    futureRunBtn.addEventListener("click", runFutureScenario);
  }

  document.querySelectorAll("[data-future-type], [data-future-months], [data-future-amount]").forEach((el) => {
    el.addEventListener("change", runFutureScenario);
  });

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
}

// Smart Insights - Expert Advice Database
const EXPERT_ADVICE = {
  martinLewis: {
    name: "Martin Lewis",
    avatar: "ML",
    style: "martin",
    quotes: {
      emergencyFund: "Always aim for at least 3 months' worth of essential spending in an easy-access savings account. This is your financial cushion against life's surprises.",
      highDebt: "If you're paying interest on debts, it's almost always worth paying them off before saving. The interest you save is usually higher than the interest you'd earn.",
      overspending: "Track every penny for a month. You'll be shocked what you're actually spending on. Small daily costs add up to thousands a year.",
      savingsRatio: "The golden rule: save at least 10% of your take-home pay. If you can't, start with what you can and increase it by 1% every few months.",
      mortgageTip: "Overpaying your mortgage, even small amounts, can save you thousands in interest and years off your term. Check if your lender allows this penalty-free.",
      budgeting: "Use the 50/30/20 rule as a starting point: 50% needs, 30% wants, 20% savings. Then adjust to fit your life.",
      subscriptions: "Do a subscription audit every 3 months. Cancel anything you haven't used in the last month. You can always resubscribe.",
    },
  },
  jlCollins: {
    name: "JL Collins",
    avatar: "JL",
    style: "jl",
    quotes: {
      investing: "The stock market is a powerful wealth-building tool. But it doesn't go up in a straight line. You need to stay the course through the rough patches.",
      simplicity: "Don't make investing complicated. A single low-cost index fund covering the total stock market is all you need to build wealth.",
      debtFreedom: "Debt is financial cancer. It drains your wealth and keeps you dependent. Getting rid of it should be a top priority.",
      savings: "Spend less than you earn—invest the surplus—avoid debt. Do this consistently and you'll be wealthy beyond your dreams.",
      longTerm: "Wealth-building is a marathon, not a sprint. The power of compounding means time in the market beats timing the market.",
      lifestyle: "Your money can either buy things or buy freedom. Every pound you spend is a pound that can't work for you.",
      fMotivation: "Financial independence isn't about being rich. It's about having enough so you don't have to worry about money anymore.",
    },
  },
  ramitSethi: {
    name: "Ramit Sethi",
    avatar: "RS",
    style: "ramit",
    quotes: {
      automation: "Automate your money. Set up automatic transfers to savings and investments so you never have to think about it.",
      richLife: "A Rich Life isn't about deprivation. It's about spending extravagantly on the things you love while cutting mercilessly on things you don't.",
      negotiation: "Negotiate your salary. One 15-minute conversation can be worth more than 5 years of lattes. Focus on the big wins.",
      consciousSpending: "There are no bad purchases if you've consciously decided what's worth it to you. Guilt-free spending comes from having a plan.",
      creditCards: "If you pay your credit card in full every month, use it for everything. The rewards add up and you build credit.",
      investing: "Start investing today, even if it's just £50. The best time to start was 10 years ago. The second best time is now.",
      increments: "Increase your investments by 1% every time you get a raise. You won't miss it, but in 10 years, you'll have significantly more.",
    },
  },
};

// Financial concern thresholds and analysis
const CONCERN_THRESHOLDS = {
  emergencyBuffer: { critical: 1, warning: 3, healthy: 6 },
  debtToIncomeRatio: { critical: 0.40, warning: 0.25, healthy: 0.15 },
  savingsRate: { critical: 0, warning: 0.10, healthy: 0.20 },
  housingCostRatio: { critical: 0.40, warning: 0.30, healthy: 0.25 },
};

function analyzeFinances() {
  const snapshot = getFinanceSnapshot();
  const concerns = [];
  const opportunities = [];

  const monthlyExpenses = snapshot.expenses;
  const monthlyIncome = snapshot.income;
  const currentSavings = snapshot.savings;
  const surplus = snapshot.surplus;
  const debtPayments = snapshot.debt;

  // Calculate ratios
  const bufferMonths = monthlyExpenses > 0 ? currentSavings / monthlyExpenses : 0;
  const savingsRate = monthlyIncome > 0 ? surplus / monthlyIncome : 0;
  const debtRatio = monthlyIncome > 0 ? debtPayments / monthlyIncome : 0;

  // Housing costs
  const housingCosts = calculateCategoryTotal("housing");
  const housingRatio = monthlyIncome > 0 ? housingCosts / monthlyIncome : 0;

  // Personal spending
  const personalSpending = calculateCategoryTotal("personal");
  const foodSpending = calculateCategoryTotal("food");
  const subscriptions = state.expenses.subscriptions || 0;
  const streaming = state.expenses.streaming || 0;

  // CONCERNS - Things that need attention

  // 1. Emergency fund check
  if (bufferMonths < CONCERN_THRESHOLDS.emergencyBuffer.critical) {
    concerns.push({
      type: "emergency",
      severity: "critical",
      title: "No emergency cushion",
      description: `You have less than 1 month of expenses saved. This leaves you vulnerable to unexpected costs like car repairs or job loss.`,
      expert: "martinLewis",
      quoteKey: "emergencyFund",
    });
  } else if (bufferMonths < CONCERN_THRESHOLDS.emergencyBuffer.warning) {
    concerns.push({
      type: "emergency",
      severity: "warning",
      title: "Emergency fund needs attention",
      description: `You have ${bufferMonths.toFixed(1)} months of expenses saved. Aim for 3-6 months for security.`,
      expert: "martinLewis",
      quoteKey: "emergencyFund",
    });
  }

  // 2. Overspending check
  if (surplus < 0) {
    concerns.push({
      type: "overspending",
      severity: "critical",
      title: "Spending exceeds income",
      description: `You're spending ${formatCurrency(Math.abs(surplus))} more than you earn each month. This is unsustainable.`,
      expert: "martinLewis",
      quoteKey: "overspending",
    });
  } else if (savingsRate < CONCERN_THRESHOLDS.savingsRate.warning && surplus > 0) {
    concerns.push({
      type: "savingsRate",
      severity: "warning",
      title: "Low savings rate",
      description: `You're only saving ${(savingsRate * 100).toFixed(0)}% of income. Aim for at least 10-20% to build wealth.`,
      expert: "martinLewis",
      quoteKey: "savingsRatio",
    });
  }

  // 3. High debt payments
  if (debtRatio > CONCERN_THRESHOLDS.debtToIncomeRatio.critical) {
    concerns.push({
      type: "debt",
      severity: "critical",
      title: "Debt payments too high",
      description: `${(debtRatio * 100).toFixed(0)}% of your income goes to debt payments. This severely limits your financial flexibility.`,
      expert: "jlCollins",
      quoteKey: "debtFreedom",
    });
  } else if (debtRatio > CONCERN_THRESHOLDS.debtToIncomeRatio.warning) {
    concerns.push({
      type: "debt",
      severity: "warning",
      title: "Debt payments elevated",
      description: `${(debtRatio * 100).toFixed(0)}% of income goes to debt. Work on reducing this below 25%.`,
      expert: "martinLewis",
      quoteKey: "highDebt",
    });
  }

  // 4. High housing costs
  if (housingRatio > CONCERN_THRESHOLDS.housingCostRatio.critical) {
    concerns.push({
      type: "housing",
      severity: "warning",
      title: "High housing costs",
      description: `Housing takes ${(housingRatio * 100).toFixed(0)}% of your income. The recommended maximum is 30%.`,
      expert: "ramitSethi",
      quoteKey: "richLife",
    });
  }

  // 5. No financial goals
  if (state.goals.length === 0) {
    concerns.push({
      type: "goals",
      severity: "info",
      title: "No financial goals set",
      description: "Setting specific goals gives your money purpose and keeps you motivated.",
      expert: "jlCollins",
      quoteKey: "fMotivation",
    });
  }

  // OPPORTUNITIES - Things you could improve

  // 1. Subscription audit
  if (subscriptions + streaming > 100) {
    opportunities.push({
      type: "subscriptions",
      title: "Subscription audit opportunity",
      description: `You're spending ${formatCurrency(subscriptions + streaming)}/month on subscriptions and streaming. Review which ones you actually use.`,
      potentialSaving: Math.round((subscriptions + streaming) * 0.3),
      expert: "martinLewis",
      quoteKey: "subscriptions",
    });
  }

  // 2. High dining out spend
  const diningOut = state.expenses.diningOut || 0;
  const coffeeSnacks = state.expenses.coffeeSnacks || 0;
  if (diningOut + coffeeSnacks > 200) {
    opportunities.push({
      type: "dining",
      title: "Dining spending is high",
      description: `You spend ${formatCurrency(diningOut + coffeeSnacks)}/month on dining out and coffee. Meal planning could save you 30-50%.`,
      potentialSaving: Math.round((diningOut + coffeeSnacks) * 0.35),
      expert: "ramitSethi",
      quoteKey: "consciousSpending",
    });
  }

  // 3. Not investing surplus
  if (surplus > 300 && currentSavings > monthlyExpenses * 3) {
    opportunities.push({
      type: "investing",
      title: "Ready to invest",
      description: `With ${formatCurrency(surplus)} monthly surplus and a solid emergency fund, you're ready to start investing for long-term growth.`,
      potentialGain: Math.round(surplus * 12 * 0.07), // 7% annual return estimate
      expert: "jlCollins",
      quoteKey: "simplicity",
    });
  }

  // 4. Automation opportunity
  if (surplus > 0 && !state.goals.some(g => g.monthly > 0)) {
    opportunities.push({
      type: "automation",
      title: "Automate your savings",
      description: "Set up automatic transfers on payday. Money you don't see, you won't spend.",
      expert: "ramitSethi",
      quoteKey: "automation",
    });
  }

  // 5. Mortgage overpayment opportunity
  const mortgage = state.expenses.mortgage || 0;
  if (mortgage > 0 && surplus > mortgage * 0.1) {
    opportunities.push({
      type: "mortgage",
      title: "Consider mortgage overpayments",
      description: `Even ${formatCurrency(50)}-${formatCurrency(100)} extra per month can knock years off your mortgage term.`,
      expert: "martinLewis",
      quoteKey: "mortgageTip",
    });
  }

  return { concerns, opportunities, metrics: { bufferMonths, savingsRate, debtRatio, housingRatio } };
}

function getRecommendedActions(concerns, opportunities) {
  const actions = [];

  // Priority order based on concerns
  concerns.forEach((concern) => {
    switch (concern.type) {
      case "emergency":
        actions.push({
          priority: 1,
          action: "Build emergency fund",
          steps: [
            "Open a separate easy-access savings account",
            "Set up an automatic transfer of even £50/month",
            "Put any windfalls (tax refunds, bonuses) straight into it",
          ],
        });
        break;
      case "overspending":
        actions.push({
          priority: 1,
          action: "Balance your budget",
          steps: [
            "Track every expense for one month",
            "Identify your top 3 non-essential spending categories",
            "Cut each by 20% and redirect to savings",
          ],
        });
        break;
      case "debt":
        actions.push({
          priority: 2,
          action: "Attack your debt",
          steps: [
            "List all debts with interest rates",
            "Pay minimums on all, extra on highest rate",
            "Consider balance transfer or consolidation",
          ],
        });
        break;
      case "savingsRate":
        actions.push({
          priority: 3,
          action: "Increase savings rate",
          steps: [
            "Aim for 1% increase this month",
            "When you get a raise, save half of it",
            "Challenge yourself to one no-spend week",
          ],
        });
        break;
    }
  });

  // Add opportunities as lower priority actions
  opportunities.slice(0, 2).forEach((opp) => {
    actions.push({
      priority: 4,
      action: opp.title,
      steps: [opp.description],
    });
  });

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function getExpertQuote(expertKey, quoteKey) {
  const expert = EXPERT_ADVICE[expertKey];
  if (!expert || !expert.quotes[quoteKey]) return null;

  return {
    name: expert.name,
    avatar: expert.avatar,
    style: expert.style,
    quote: expert.quotes[quoteKey],
  };
}

function updateSmartInsights() {
  const insightsCard = document.querySelector("[data-widget='insights']");
  const concernsList = document.querySelector("[data-concerns-list]");
  const actionsList = document.querySelector("[data-actions-list]");
  const expertAdvice = document.querySelector("[data-expert-advice]");

  if (!insightsCard) return;

  const { concerns, opportunities, metrics } = analyzeFinances();
  const actions = getRecommendedActions(concerns, opportunities);

  // Show/hide insights based on whether there's data to analyze
  const hasData = state.income > 0 || calculateTotalExpenses() > 0;
  insightsCard.style.display = hasData ? "block" : "none";

  if (!hasData) return;

  // Update concerns
  if (concernsList) {
    if (concerns.length === 0) {
      concernsList.innerHTML = `
        <div class="concern-item healthy">
          <span class="concern-icon">✓</span>
          <div class="concern-content">
            <h5>Looking good!</h5>
            <p>No major financial concerns detected. Keep up the great work!</p>
          </div>
        </div>
      `;
    } else {
      concernsList.innerHTML = concerns
        .map((concern) => `
          <div class="concern-item ${concern.severity}">
            <span class="concern-icon">${concern.severity === "critical" ? "⚠" : concern.severity === "warning" ? "!" : "i"}</span>
            <div class="concern-content">
              <h5>${concern.title}</h5>
              <p>${concern.description}</p>
            </div>
          </div>
        `)
        .join("");
    }
  }

  // Update actions
  if (actionsList) {
    if (actions.length === 0) {
      actionsList.innerHTML = `<p class="muted">Keep doing what you're doing!</p>`;
    } else {
      actionsList.innerHTML = actions
        .map((action) => `
          <div class="action-item">
            <h5>${action.action}</h5>
            <ul>
              ${action.steps.map((step) => `<li>${step}</li>`).join("")}
            </ul>
          </div>
        `)
        .join("");
    }
  }

  // Update expert advice - pick relevant quotes
  if (expertAdvice) {
    const relevantExperts = [];

    // Get quotes based on user's situation
    if (concerns.length > 0) {
      const firstConcern = concerns[0];
      const quote = getExpertQuote(firstConcern.expert, firstConcern.quoteKey);
      if (quote) relevantExperts.push(quote);
    }

    // Add an investing quote if they have surplus
    if (metrics.bufferMonths >= 3 && state.income - calculateTotalExpenses() > 200) {
      const investQuote = getExpertQuote("jlCollins", "investing");
      if (investQuote && !relevantExperts.find((e) => e.name === investQuote.name)) {
        relevantExperts.push(investQuote);
      }
    }

    // Add a lifestyle/mindset quote
    const lifestyleQuote = getExpertQuote("ramitSethi", "richLife");
    if (lifestyleQuote && !relevantExperts.find((e) => e.name === lifestyleQuote.name)) {
      relevantExperts.push(lifestyleQuote);
    }

    expertAdvice.innerHTML = relevantExperts
      .slice(0, 3)
      .map((expert) => `
        <div class="expert-card">
          <div class="expert-avatar ${expert.style}">${expert.avatar}</div>
          <div class="expert-content">
            <h5>${expert.name}</h5>
            <p>"${expert.quote}"</p>
          </div>
        </div>
      `)
      .join("");
  }
}

// =============================================
// ENGAGEMENT FEATURES
// =============================================

// Money Mood Tracker
const MOOD_STORAGE_KEY = "consumerpay_mood_history";

function getMoodHistory() {
  try {
    const data = localStorage.getItem(MOOD_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMoodEntry(mood) {
  const history = getMoodHistory();
  const today = new Date().toISOString().split("T")[0];

  // Remove any existing entry for today
  const filtered = history.filter(entry => entry.date !== today);
  filtered.push({ date: today, mood, timestamp: Date.now() });

  // Keep last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = filtered.filter(entry => entry.timestamp > cutoff);

  localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(recent));

  // Award points for logging mood
  state.rewardPoints += 5;
  scheduleSave();

  return recent;
}

function getTodaysMood() {
  const history = getMoodHistory();
  const today = new Date().toISOString().split("T")[0];
  const todayEntry = history.find(entry => entry.date === today);
  return todayEntry?.mood || null;
}

function updateMoodChart() {
  const chart = document.querySelector("[data-mood-chart]");
  const insight = document.querySelector("[data-mood-insight]");
  if (!chart) return;

  const history = getMoodHistory();
  const last7Days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const entry = history.find(e => e.date === dateStr);
    const dayName = date.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);
    last7Days.push({
      day: dayName,
      mood: entry?.mood || 0,
    });
  }

  chart.innerHTML = last7Days
    .map(d => `<div class="mood-bar ${d.mood ? `level-${d.mood}` : ""}" data-day="${d.day}"></div>`)
    .join("");

  // Calculate insight
  const validMoods = last7Days.filter(d => d.mood > 0);
  if (validMoods.length === 0) {
    if (insight) insight.textContent = "Log your mood to see trends";
  } else {
    const avg = validMoods.reduce((sum, d) => sum + d.mood, 0) / validMoods.length;
    const trend = validMoods.length >= 3
      ? validMoods.slice(-3).reduce((sum, d) => sum + d.mood, 0) / 3 - validMoods.slice(0, 3).reduce((sum, d) => sum + d.mood, 0) / Math.min(3, validMoods.length)
      : 0;

    let insightText = `Average mood: ${avg.toFixed(1)}/5. `;
    if (trend > 0.5) insightText += "You're feeling more confident lately!";
    else if (trend < -0.5) insightText += "Your mood has dipped - check your spending patterns.";
    else insightText += "Staying steady. Keep tracking!";

    if (insight) insight.textContent = insightText;
  }
}

function initMoodTracker() {
  const selector = document.querySelector("[data-mood-selector]");
  if (!selector) return;

  const todaysMood = getTodaysMood();

  selector.querySelectorAll(".mood-btn").forEach(btn => {
    const mood = parseInt(btn.dataset.mood, 10);

    if (mood === todaysMood) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      selector.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      saveMoodEntry(mood);
      updateMoodChart();
      updateRewardsUI();
    });
  });

  updateMoodChart();
}

// Financial Literacy Hub
const LEARN_STORAGE_KEY = "consumerpay_learn_progress";

const LEARNING_MODULES = {
  budgeting: {
    title: "Budgeting Basics",
    lessons: [
      {
        content: "The 50/30/20 rule is a simple way to budget: allocate 50% of your income to needs (rent, utilities, groceries), 30% to wants (entertainment, dining out), and 20% to savings and debt repayment.",
        question: "According to the 50/30/20 rule, what percentage should go to savings?",
        options: ["10%", "20%", "30%", "50%"],
        correct: 1,
        explanation: "20% of your after-tax income should go towards savings and paying off debt.",
      },
      {
        content: "Zero-based budgeting means every pound has a job. You assign all your income to specific categories until you have zero left to allocate. This doesn't mean spending everything - savings is a category too!",
        question: "What does zero-based budgeting mean?",
        options: ["Spending nothing", "Having no savings", "Every pound is assigned a purpose", "Starting fresh each year"],
        correct: 2,
        explanation: "Zero-based budgeting means assigning every pound of income to a specific purpose, including savings.",
      },
      {
        content: "Fixed expenses stay the same each month (rent, insurance), while variable expenses change (groceries, utilities). Track both to understand your true spending patterns.",
        question: "Which is typically a fixed expense?",
        options: ["Groceries", "Electricity", "Rent", "Entertainment"],
        correct: 2,
        explanation: "Rent typically stays the same each month, making it a fixed expense.",
      },
      {
        content: "Pay yourself first! Set up automatic transfers to savings on payday, before you spend on anything else. This makes saving effortless and consistent.",
        question: "When should you transfer money to savings?",
        options: ["End of the month", "When you have spare money", "On payday before spending", "Once a year"],
        correct: 2,
        explanation: "Paying yourself first means transferring to savings immediately on payday, before other spending.",
      },
    ],
  },
  emergency: {
    title: "Emergency Fund Essentials",
    lessons: [
      {
        content: "An emergency fund is money set aside for unexpected expenses - car repairs, medical bills, or job loss. It's your financial safety net that prevents you from going into debt when life happens.",
        question: "What is an emergency fund for?",
        options: ["Holidays", "Unexpected expenses", "Shopping", "Investments"],
        correct: 1,
        explanation: "An emergency fund covers unexpected costs like repairs, medical bills, or job loss.",
      },
      {
        content: "Financial experts recommend saving 3-6 months of essential expenses. Start with a smaller goal of £1,000 to build the habit, then grow from there.",
        question: "How much should your emergency fund ideally cover?",
        options: ["1 week of expenses", "1 month of expenses", "3-6 months of expenses", "1 year of expenses"],
        correct: 2,
        explanation: "Aim for 3-6 months of essential expenses to handle most emergencies.",
      },
      {
        content: "Keep your emergency fund in an easy-access savings account. It should be liquid (quickly accessible) but separate from your current account to avoid temptation.",
        question: "Where should you keep your emergency fund?",
        options: ["Under the mattress", "Invested in stocks", "Easy-access savings account", "Locked term deposit"],
        correct: 2,
        explanation: "An easy-access savings account offers quick access while keeping funds separate from daily spending.",
      },
    ],
  },
  investing: {
    title: "Investing 101",
    lessons: [
      {
        content: "Compound interest is interest on interest. If you invest £1,000 at 7% annually, after 10 years you'd have about £1,967 - nearly double! The earlier you start, the more powerful compounding becomes.",
        question: "What makes compound interest so powerful?",
        options: ["Government guarantees", "Interest earning interest over time", "No risk involved", "Fixed returns"],
        correct: 1,
        explanation: "Compound interest means your earnings generate their own earnings over time.",
      },
      {
        content: "An index fund tracks a market index (like the FTSE 100). Instead of picking individual stocks, you own a small piece of many companies. This provides instant diversification at low cost.",
        question: "What is an index fund?",
        options: ["A single company stock", "A fund tracking a market index", "A savings account", "A type of bond"],
        correct: 1,
        explanation: "Index funds track market indices, giving you exposure to many companies in one investment.",
      },
      {
        content: "Risk and reward are linked. Higher potential returns usually mean higher risk. Young investors can typically take more risk because they have time to recover from market downturns.",
        question: "Why might younger investors take more risk?",
        options: ["They have less to lose", "They have more time to recover from losses", "They're more intelligent", "Markets are less risky for them"],
        correct: 1,
        explanation: "Younger investors have more time before retirement, allowing them to ride out market volatility.",
      },
      {
        content: "Pound-cost averaging means investing a fixed amount regularly (e.g., £200/month) regardless of market conditions. This reduces the impact of market timing and smooths out your purchase price.",
        question: "What is pound-cost averaging?",
        options: ["Timing the market", "Investing the same amount regularly", "Only buying when prices fall", "Selling at the right time"],
        correct: 1,
        explanation: "Pound-cost averaging means investing consistent amounts regularly, regardless of market conditions.",
      },
      {
        content: "Fees matter! A 1% annual fee might seem small, but over 30 years it can reduce your returns by 25% or more. Look for low-cost index funds with fees below 0.25%.",
        question: "Why do investment fees matter so much?",
        options: ["They don't really matter", "They compound and reduce returns significantly", "Higher fees mean better returns", "They're tax deductible"],
        correct: 1,
        explanation: "Fees compound over time and can dramatically reduce your long-term investment returns.",
      },
    ],
  },
  debt: {
    title: "Debt Destruction",
    lessons: [
      {
        content: "Not all debt is equal. 'Good debt' (mortgages, education) can build wealth or income. 'Bad debt' (credit cards, payday loans) has high interest and funds consumption, not assets.",
        question: "Which is typically considered 'good debt'?",
        options: ["Credit card debt", "Payday loans", "A mortgage", "Store credit"],
        correct: 2,
        explanation: "Mortgages are generally considered good debt as they help build home equity.",
      },
      {
        content: "The avalanche method: pay minimum on all debts, then put extra money toward the highest interest rate debt first. This saves the most money mathematically.",
        question: "What debt does the avalanche method target first?",
        options: ["Smallest balance", "Highest interest rate", "Oldest debt", "Largest balance"],
        correct: 1,
        explanation: "The avalanche method targets the highest interest rate debt first to minimize total interest paid.",
      },
      {
        content: "The snowball method: pay minimums on all debts, then put extra money toward the smallest balance first. Quick wins build momentum and motivation, even if it costs more in interest.",
        question: "What's the main benefit of the snowball method?",
        options: ["Saves the most money", "Psychological wins and motivation", "Fastest overall", "Lowest minimum payments"],
        correct: 1,
        explanation: "The snowball method provides quick wins that build motivation to keep paying off debt.",
      },
      {
        content: "Balance transfers can help - move high-interest debt to a 0% card. But watch out for transfer fees (usually 3%) and ensure you can pay off before the promotional rate ends.",
        question: "What should you watch out for with balance transfers?",
        options: ["Nothing, they're risk-free", "Transfer fees and promotional period end", "They improve credit score", "Lower minimum payments"],
        correct: 1,
        explanation: "Balance transfers often have fees and promotional rates that end, potentially leading to high interest.",
      },
    ],
  },
  psychology: {
    title: "Money Psychology",
    lessons: [
      {
        content: "We often spend emotionally - retail therapy when stressed, impulse buys for dopamine hits. Recognizing your emotional spending triggers is the first step to controlling them.",
        question: "What is 'retail therapy'?",
        options: ["Shopping for medicine", "Spending to cope with emotions", "Getting therapy about shopping", "Budget counseling"],
        correct: 1,
        explanation: "Retail therapy refers to spending money to improve mood or cope with negative emotions.",
      },
      {
        content: "The hedonic treadmill: we quickly adapt to new purchases and return to our baseline happiness. That new phone brings joy briefly, then becomes normal. Experiences often bring more lasting happiness than things.",
        question: "What does the hedonic treadmill suggest?",
        options: ["Exercise makes you happy", "We adapt to purchases and need more", "Spending always increases happiness", "Money buys permanent happiness"],
        correct: 1,
        explanation: "The hedonic treadmill shows we adapt to new purchases and return to baseline happiness.",
      },
      {
        content: "Your money mindset often comes from childhood. How your parents talked about (or avoided) money shapes your beliefs. Identifying these beliefs helps you change unhelpful patterns.",
        question: "Where do money mindsets often originate?",
        options: ["School education", "Childhood and family", "Social media", "Banks"],
        correct: 1,
        explanation: "Our attitudes toward money are often shaped by our family and childhood experiences.",
      },
    ],
  },
};

function getLearnProgress() {
  try {
    const data = localStorage.getItem(LEARN_STORAGE_KEY);
    return data ? JSON.parse(data) : { completed: {}, points: 0, lastLearnDate: null };
  } catch {
    return { completed: {}, points: 0, lastLearnDate: null };
  }
}

function saveLearnProgress(progress) {
  localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(progress));
}

function calculateLearnStreak() {
  const progress = getLearnProgress();
  if (!progress.lastLearnDate) return 0;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (progress.lastLearnDate === today || progress.lastLearnDate === yesterday) {
    return progress.streak || 1;
  }
  return 0;
}

function updateLearnUI() {
  const progress = getLearnProgress();
  const completedCount = Object.values(progress.completed).reduce((sum, lessons) => sum + lessons.length, 0);

  setTextAll("[data-learn-completed]", completedCount);
  setTextAll("[data-learn-streak]", calculateLearnStreak());
  setTextAll("[data-learn-points]", progress.points || 0);

  // Update module progress
  Object.keys(LEARNING_MODULES).forEach(moduleId => {
    const module = LEARNING_MODULES[moduleId];
    const completed = progress.completed[moduleId]?.length || 0;
    const total = module.lessons.length;
    const pct = Math.round((completed / total) * 100);

    const progressBar = document.querySelector(`[data-module-progress="${moduleId}"]`);
    if (progressBar) progressBar.style.width = `${pct}%`;

    const moduleEl = document.querySelector(`[data-module="${moduleId}"]`);
    if (moduleEl) {
      const label = moduleEl.querySelector(".module-progress .muted");
      if (label) label.textContent = `${completed}/${total} lessons`;

      const btn = moduleEl.querySelector("[data-start-module]");
      if (btn) btn.textContent = completed === 0 ? "Start" : completed === total ? "Review" : "Continue";
    }
  });
}

let currentQuiz = null;
let currentQuestionIndex = 0;

function startModule(moduleId) {
  const module = LEARNING_MODULES[moduleId];
  if (!module) return;

  const progress = getLearnProgress();
  const completedLessons = progress.completed[moduleId] || [];

  // Find first incomplete lesson, or start from beginning for review
  let lessonIndex = completedLessons.length;
  if (lessonIndex >= module.lessons.length) lessonIndex = 0;

  currentQuiz = { moduleId, module, lessonIndex };
  currentQuestionIndex = 0;

  showLesson(module.lessons[lessonIndex]);

  const modal = document.querySelector("[data-quiz-modal]");
  if (modal) {
    modal.hidden = false;
    document.querySelector("[data-quiz-title]").textContent = module.title;
    document.querySelector("[data-quiz-current]").textContent = lessonIndex + 1;
    document.querySelector("[data-quiz-total]").textContent = module.lessons.length;
  }
}

function showLesson(lesson) {
  const lessonEl = document.querySelector("[data-quiz-lesson]");
  const questionEl = document.querySelector("[data-quiz-question]");
  const feedbackEl = document.querySelector("[data-quiz-feedback]");
  const nextBtn = document.querySelector("[data-quiz-next]");
  const finishBtn = document.querySelector("[data-quiz-finish]");

  if (lessonEl) lessonEl.innerHTML = `<p>${lesson.content}</p>`;
  if (questionEl) questionEl.hidden = false;
  if (feedbackEl) feedbackEl.hidden = true;
  if (nextBtn) nextBtn.hidden = true;
  if (finishBtn) finishBtn.hidden = true;

  document.querySelector("[data-question-text]").textContent = lesson.question;

  const optionsEl = document.querySelector("[data-quiz-options]");
  if (optionsEl) {
    optionsEl.innerHTML = lesson.options
      .map((opt, i) => `<button class="quiz-option" type="button" data-option="${i}">${opt}</button>`)
      .join("");

    optionsEl.querySelectorAll(".quiz-option").forEach(btn => {
      btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.option, 10), lesson));
    });
  }
}

function handleAnswer(selectedIndex, lesson) {
  const isCorrect = selectedIndex === lesson.correct;
  const optionsEl = document.querySelector("[data-quiz-options]");
  const feedbackEl = document.querySelector("[data-quiz-feedback]");
  const questionEl = document.querySelector("[data-quiz-question]");

  // Disable all options and show result
  optionsEl.querySelectorAll(".quiz-option").forEach((btn, i) => {
    btn.disabled = true;
    if (i === lesson.correct) btn.classList.add("correct");
    else if (i === selectedIndex && !isCorrect) btn.classList.add("incorrect");
  });

  // Award points
  const progress = getLearnProgress();
  if (isCorrect) {
    progress.points = (progress.points || 0) + 25;
    state.rewardPoints += 25;
  } else {
    progress.points = (progress.points || 0) + 5; // Participation points
    state.rewardPoints += 5;
  }

  // Update last learn date and streak
  const today = new Date().toISOString().split("T")[0];
  if (progress.lastLearnDate !== today) {
    progress.streak = progress.lastLearnDate === new Date(Date.now() - 86400000).toISOString().split("T")[0]
      ? (progress.streak || 0) + 1
      : 1;
    progress.lastLearnDate = today;
  }

  saveLearnProgress(progress);
  scheduleSave();

  // Show feedback
  setTimeout(() => {
    if (questionEl) questionEl.hidden = true;
    if (feedbackEl) {
      feedbackEl.hidden = false;
      document.querySelector("[data-feedback-icon]").textContent = isCorrect ? "🎉" : "📚";
      document.querySelector("[data-feedback-text]").textContent = isCorrect ? "Correct! +25 points" : "Not quite, but +5 points for learning!";
      document.querySelector("[data-feedback-explanation]").textContent = lesson.explanation;
    }

    const module = currentQuiz.module;
    const isLastLesson = currentQuiz.lessonIndex >= module.lessons.length - 1;

    if (isLastLesson) {
      document.querySelector("[data-quiz-finish]").hidden = false;
    } else {
      document.querySelector("[data-quiz-next]").hidden = false;
    }
  }, 800);
}

function nextLesson() {
  const progress = getLearnProgress();
  if (!progress.completed[currentQuiz.moduleId]) {
    progress.completed[currentQuiz.moduleId] = [];
  }
  if (!progress.completed[currentQuiz.moduleId].includes(currentQuiz.lessonIndex)) {
    progress.completed[currentQuiz.moduleId].push(currentQuiz.lessonIndex);
  }
  saveLearnProgress(progress);

  currentQuiz.lessonIndex++;
  const lesson = currentQuiz.module.lessons[currentQuiz.lessonIndex];

  document.querySelector("[data-quiz-current]").textContent = currentQuiz.lessonIndex + 1;
  showLesson(lesson);
}

function finishModule() {
  const progress = getLearnProgress();
  if (!progress.completed[currentQuiz.moduleId]) {
    progress.completed[currentQuiz.moduleId] = [];
  }
  if (!progress.completed[currentQuiz.moduleId].includes(currentQuiz.lessonIndex)) {
    progress.completed[currentQuiz.moduleId].push(currentQuiz.lessonIndex);
  }
  saveLearnProgress(progress);

  closeQuizModal();
  updateLearnUI();
  updateRewardsUI();

  // Trigger celebration for completing a module
  const completedCount = progress.completed[currentQuiz.moduleId]?.length || 0;
  if (completedCount === currentQuiz.module.lessons.length) {
    triggerCelebration({
      icon: "🎓",
      title: "Module Complete!",
      message: `You've finished ${currentQuiz.module.title}!`,
      badge: "Knowledge Seeker",
      badgeDesc: "Completed a learning module",
    });
  }
}

function closeQuizModal() {
  const modal = document.querySelector("[data-quiz-modal]");
  if (modal) modal.hidden = true;
  currentQuiz = null;
}

function initLearnTab() {
  // Module start buttons
  document.querySelectorAll("[data-start-module]").forEach(btn => {
    btn.addEventListener("click", () => startModule(btn.dataset.startModule));
  });

  // Quiz close button
  document.querySelector("[data-quiz-close]")?.addEventListener("click", closeQuizModal);
  document.querySelector("[data-quiz-next]")?.addEventListener("click", nextLesson);
  document.querySelector("[data-quiz-finish]")?.addEventListener("click", finishModule);

  updateLearnUI();
}

// Goal Celebrations & Confetti
const MILESTONE_THRESHOLDS = [25, 50, 75, 100];
const CELEBRATION_STORAGE_KEY = "consumerpay_celebrated_milestones";

function getCelebratedMilestones() {
  try {
    const data = localStorage.getItem(CELEBRATION_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveCelebratedMilestone(goalName, milestone) {
  const celebrated = getCelebratedMilestones();
  if (!celebrated[goalName]) celebrated[goalName] = [];
  if (!celebrated[goalName].includes(milestone)) {
    celebrated[goalName].push(milestone);
  }
  localStorage.setItem(CELEBRATION_STORAGE_KEY, JSON.stringify(celebrated));
}

function checkGoalMilestones() {
  const celebrated = getCelebratedMilestones();

  state.goals.forEach(goal => {
    if (!goal.target || goal.target === 0) return;

    const progress = Math.round((goal.saved / goal.target) * 100);
    const goalCelebrated = celebrated[goal.name] || [];

    for (const threshold of MILESTONE_THRESHOLDS) {
      if (progress >= threshold && !goalCelebrated.includes(threshold)) {
        saveCelebratedMilestone(goal.name, threshold);

        const badges = {
          25: { icon: "🌱", badge: "Getting Started", desc: "25% of the way there!" },
          50: { icon: "🔥", badge: "Halfway Hero", desc: "50% complete - amazing!" },
          75: { icon: "⭐", badge: "Almost There", desc: "75% - the finish line is in sight!" },
          100: { icon: "🏆", badge: "Goal Crusher", desc: "100% - You did it!" },
        };

        const badgeInfo = badges[threshold];
        triggerCelebration({
          icon: badgeInfo.icon,
          title: threshold === 100 ? "Goal Achieved!" : "Milestone Reached!",
          message: `${goal.name}: ${threshold}% complete!`,
          badge: badgeInfo.badge,
          badgeDesc: badgeInfo.desc,
          progress: `${progress}%`,
          saved: formatCurrency(goal.saved),
          remaining: formatCurrency(Math.max(0, goal.target - goal.saved)),
        });

        // Award bonus points
        const bonusPoints = threshold === 100 ? 100 : threshold === 75 ? 50 : 25;
        state.rewardPoints += bonusPoints;
        scheduleSave();

        break; // Only trigger one celebration at a time
      }
    }
  });
}

function triggerCelebration(data) {
  launchConfetti();

  const modal = document.querySelector("[data-celebration-modal]");
  if (!modal) return;

  document.querySelector("[data-celebration-icon]").textContent = data.icon || "🎉";
  document.querySelector("[data-celebration-title]").textContent = data.title || "Congratulations!";
  document.querySelector("[data-celebration-message]").textContent = data.message || "You're making progress!";
  document.querySelector("[data-badge-name]").textContent = data.badge || "Achievement";
  document.querySelector("[data-badge-desc]").textContent = data.badgeDesc || "Keep going!";

  if (data.progress) {
    document.querySelector("[data-celebration-progress]").textContent = data.progress;
    document.querySelector("[data-celebration-saved]").textContent = data.saved || "£0";
    document.querySelector("[data-celebration-remaining]").textContent = data.remaining || "£0";
    document.querySelector("[data-celebration-stats]").style.display = "flex";
  } else {
    document.querySelector("[data-celebration-stats]").style.display = "none";
  }

  modal.hidden = false;
}

function closeCelebration() {
  const modal = document.querySelector("[data-celebration-modal]");
  if (modal) modal.hidden = true;
}

function launchConfetti() {
  const container = document.querySelector("[data-confetti-container]");
  if (!container) return;

  const colors = ["#fbbf24", "#2dd4bf", "#1d3557", "#ef4444", "#a855f7", "#22c55e"];
  const shapes = ["square", "circle"];

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)] === "circle" ? "50%" : "2px";
    confetti.style.width = `${Math.random() * 10 + 5}px`;
    confetti.style.height = confetti.style.width;
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;

    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 4000);
  }
}

function initCelebrations() {
  document.querySelector("[data-celebration-close]")?.addEventListener("click", closeCelebration);
  document.querySelector("[data-celebration-share]")?.addEventListener("click", () => {
    // Simple share functionality
    if (navigator.share) {
      navigator.share({
        title: "I reached a financial milestone!",
        text: "Making progress on my financial goals with Consumer Pay!",
        url: window.location.href,
      });
    } else {
      closeCelebration();
    }
  });
}

// Budget Planner
let plannerOriginalExpenses = {};

function openBudgetPlanner() {
  const modal = document.querySelector("[data-budget-planner-modal]");
  if (!modal) return;

  plannerOriginalExpenses = { ...state.expenses };
  renderPlannerCategories();
  updatePlannerImpact();
  modal.hidden = false;
}

function closeBudgetPlanner() {
  const modal = document.querySelector("[data-budget-planner-modal]");
  if (modal) modal.hidden = true;
}

function resetPlannerChanges() {
  state.expenses = { ...plannerOriginalExpenses };
  renderPlannerCategories();
  updatePlannerImpact();
}

function applyPlannerChanges() {
  scheduleSave();
  updateCategoryTotals();
  updateBudgetSummary();
  updateSummary();
  closeBudgetPlanner();
}

function renderPlannerCategories() {
  const container = document.querySelector("[data-planner-categories]");
  if (!container) return;

  const categories = [
    { id: "housing", name: "Housing", fields: ["mortgage", "councilTax", "homeInsurance"] },
    { id: "utilities", name: "Utilities", fields: ["energy", "water", "internet", "streaming"] },
    { id: "transport", name: "Transport", fields: ["carPayment", "carInsurance", "fuel", "publicTransport"] },
    { id: "food", name: "Food & Dining", fields: ["groceries", "diningOut", "coffeeSnacks"] },
    { id: "personal", name: "Personal", fields: ["gym", "clothing", "personalCare", "entertainment", "subscriptions"] },
  ];

  container.innerHTML = categories.map(cat => {
    const total = cat.fields.reduce((sum, f) => sum + (state.expenses[f] || 0), 0);
    const originalTotal = cat.fields.reduce((sum, f) => sum + (plannerOriginalExpenses[f] || 0), 0);
    const maxValue = Math.max(originalTotal * 2, 1000);

    return `
      <div class="planner-category">
        <div class="planner-category-header">
          <h4>${cat.name}</h4>
          <span class="planner-category-value">${formatCurrency(total)}</span>
        </div>
        <input type="range" class="planner-slider" min="0" max="${maxValue}" value="${total}" data-planner-cat="${cat.id}" data-fields="${cat.fields.join(",")}" />
      </div>
    `;
  }).join("");

  // Attach slider events
  container.querySelectorAll(".planner-slider").forEach(slider => {
    slider.addEventListener("input", () => {
      const fields = slider.dataset.fields.split(",");
      const originalTotal = fields.reduce((sum, f) => sum + (plannerOriginalExpenses[f] || 0), 0);
      const newTotal = parseInt(slider.value, 10);
      const ratio = originalTotal > 0 ? newTotal / originalTotal : 0;

      fields.forEach(field => {
        state.expenses[field] = Math.round((plannerOriginalExpenses[field] || 0) * ratio);
      });

      // Update displayed value
      const valueEl = slider.parentElement.querySelector(".planner-category-value");
      if (valueEl) valueEl.textContent = formatCurrency(newTotal);

      updatePlannerImpact();
    });
  });
}

function updatePlannerImpact() {
  const originalExpenses = Object.values(plannerOriginalExpenses).reduce((sum, v) => sum + v, 0);
  const newExpenses = calculateTotalExpenses();
  const savingsDiff = originalExpenses - newExpenses;

  const savingsEl = document.querySelector("[data-impact-savings]");
  if (savingsEl) {
    savingsEl.textContent = `${savingsDiff >= 0 ? "+" : ""}${formatCurrency(savingsDiff)}`;
    savingsEl.className = `impact-value ${savingsDiff > 0 ? "positive" : savingsDiff < 0 ? "negative" : ""}`;
  }

  // Calculate timeline impact
  const timelineEl = document.querySelector("[data-impact-timeline]");
  if (timelineEl && state.goals.length > 0) {
    const goal = state.goals[0];
    const remaining = (goal.target || 0) - (goal.saved || 0);
    const originalSurplus = state.income - originalExpenses;
    const newSurplus = state.income - newExpenses;

    if (remaining > 0 && originalSurplus > 0 && newSurplus > 0) {
      const originalMonths = Math.ceil(remaining / originalSurplus);
      const newMonths = Math.ceil(remaining / newSurplus);
      const diff = originalMonths - newMonths;

      if (diff > 0) timelineEl.textContent = `${diff} months faster`;
      else if (diff < 0) timelineEl.textContent = `${Math.abs(diff)} months slower`;
      else timelineEl.textContent = "No change";
    } else {
      timelineEl.textContent = "Set a goal to see impact";
    }
  }

  // Emergency fund impact
  const emergencyEl = document.querySelector("[data-impact-emergency]");
  if (emergencyEl) {
    const monthlyDiff = savingsDiff;
    const monthsGained = newExpenses > 0 ? (monthlyDiff / newExpenses).toFixed(1) : 0;
    emergencyEl.textContent = monthlyDiff >= 0 ? `+${monthsGained} months/year` : `${monthsGained} months/year`;
  }

  // Render impact chart
  renderImpactChart(originalExpenses, newExpenses);
}

function renderImpactChart(original, newVal) {
  const chartEl = document.querySelector("[data-impact-chart]");
  if (!chartEl) return;

  const max = Math.max(original, newVal, 1);
  const originalPct = (original / max) * 100;
  const newPct = (newVal / max) * 100;

  chartEl.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
      <div style="width: 40px; height: ${originalPct}%; background: var(--ink-muted); border-radius: 4px;"></div>
      <span style="font-size: 0.7rem; color: var(--ink-muted);">Before</span>
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
      <div style="width: 40px; height: ${newPct}%; background: ${newVal < original ? 'var(--mint)' : 'var(--coral)'}; border-radius: 4px;"></div>
      <span style="font-size: 0.7rem; color: var(--ink-muted);">After</span>
    </div>
  `;
}

function initBudgetPlanner() {
  document.querySelector("[data-open-planner]")?.addEventListener("click", openBudgetPlanner);
  document.querySelector("[data-planner-close]")?.addEventListener("click", closeBudgetPlanner);
  document.querySelector("[data-planner-reset]")?.addEventListener("click", resetPlannerChanges);
  document.querySelector("[data-planner-apply]")?.addEventListener("click", applyPlannerChanges);
}

// Hook goal updates to check milestones
const originalUpdateGoalList = updateGoalList;
updateGoalList = function() {
  originalUpdateGoalList();
  checkGoalMilestones();
};

// Initialize
async function init() {
  const localData = loadLocalState();
  if (localData) {
    applyState(localData);
  }

  syncFormFromState();
  showInitialScreen();
  updateSummary();
  updateSmartInsights();

  // Initialize engagement features
  initMoodTracker();
  initLearnTab();
  initCelebrations();
  initBudgetPlanner();

  await loadFxRates();
  updateConverter();

  await initFirebase();

  // Initial Monte Carlo
  setTimeout(updateMonteCarlo, 500);

  // Initialize Financial Health Dashboard
  initFinancialHealthDashboard();

  // Initialize Smart Insights
  initSmartInsights();

  // Initialize Score History tracking
  initScoreHistory();

  // Initialize Visual Charts
  initVisualCharts();

  // Initialize Gamification
  initGamification();
}

// ============================================================
// FINANCIAL HEALTH DASHBOARD
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
  }, 150);
}

function initFinancialHealthDashboard() {
  // Setup accordion triggers
  document.querySelectorAll("[data-accordion]").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const target = trigger.getAttribute("data-accordion");
      const content = document.querySelector(`[data-accordion-content="${target}"]`);
      const isActive = trigger.classList.contains("active");

      // Toggle this accordion
      trigger.classList.toggle("active");
      if (content) content.classList.toggle("active");
    });
  });

  // Setup asset inputs
  document.querySelectorAll("[data-asset]").forEach(input => {
    const key = input.getAttribute("data-asset");
    input.value = state.assets[key] || "";
    input.addEventListener("input", () => {
      state.assets[key] = parseFloat(input.value) || 0;
      scheduleSave();
      scheduleHealthUpdate();
    });
  });

  // Setup liability inputs
  document.querySelectorAll("[data-liability]").forEach(input => {
    const key = input.getAttribute("data-liability");
    input.value = state.liabilities[key] || "";
    input.addEventListener("input", () => {
      state.liabilities[key] = parseFloat(input.value) || 0;
      scheduleSave();
      scheduleHealthUpdate();
    });
  });

  // Setup credit score inputs
  document.querySelectorAll("[data-credit]").forEach(input => {
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
  document.querySelectorAll("[data-insurance]").forEach(input => {
    const key = input.getAttribute("data-insurance");
    input.checked = state.insurance[key] || false;
    input.addEventListener("change", () => {
      state.insurance[key] = input.checked;
      scheduleSave();
      scheduleHealthUpdate();
    });
  });

  document.querySelectorAll("[data-insurance-amount]").forEach(input => {
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

  if (monthlyExpenses <= 0) return { score: 0, months: 0, tip: "Enter your monthly expenses to calculate emergency cover" };

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
  const monthlyDebtPayments = (state.expenses.mortgage || 0) +
    (state.expenses.carPayment || 0) +
    (state.expenses.creditCards || 0) +
    (state.expenses.personalLoans || 0) +
    (state.expenses.otherDebt || 0);

  if (monthlyIncome <= 0) return { score: 0, ratio: 0, tip: "Enter your income to calculate debt ratio" };

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

  if (monthlyIncome <= 0) return { score: 0, rate: 0, tip: "Enter your income to calculate savings rate" };

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

    return { score, band, tip, utilization: creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0 };
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

  return { score: 0, band: "Not set", tip: "Add your credit score to track this pillar", utilization: 0 };
}

// Calculate Protection Score (15 points max)
// Based on insurance coverage
function calculateProtectionScore() {
  const { lifeInsurance, incomeProtection, criticalIllness, homeContents, buildings } = state.insurance;

  let score = 0;
  let covered = [];
  let missing = [];

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

  const total = emergency.score + debt.score + savings.score + credit.score + protection.score;

  let status = "Getting started";
  if (total >= 85) status = "Excellent financial health";
  else if (total >= 70) status = "Strong financial position";
  else if (total >= 50) status = "Good foundation, room to grow";
  else if (total >= 30) status = "Building momentum";
  else if (total > 0) status = "Just getting started";

  return {
    total,
    status,
    pillars: { emergency, debt, savings, credit, protection }
  };
}

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
      resolved: false
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
        resolved: false
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
      resolved: false
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
      resolved: false
    });
  }

  // No life insurance (if has dependents - we'll assume if mortgage or kids expenses)
  const hasDependents = (state.expenses.childcare || 0) > 0 ||
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
      resolved: false
    });
  }

  // High debt-to-income
  const monthlyDebt = (state.expenses.mortgage || 0) +
    (state.expenses.carPayment || 0) +
    (state.expenses.creditCards || 0) +
    (state.expenses.personalLoans || 0);
  if (monthlyIncome > 0 && (monthlyDebt / monthlyIncome) > 0.5) {
    vulnerabilities.push({
      id: "high-dti",
      severity: "warning",
      icon: "⚖️",
      title: "High Debt-to-Income Ratio",
      description: `${((monthlyDebt / monthlyIncome) * 100).toFixed(0)}% of income goes to debt payments`,
      action: "Consider debt consolidation or snowball method",
      resolved: false
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
  vulnerabilities.filter(v => v.severity === "critical").forEach((v, i) => {
    roadmap.push({
      step: roadmap.length + 1,
      title: v.title,
      description: v.action,
      impact: "+10-15 pts",
      completed: false
    });
  });

  // Priority 2: Build emergency fund if under 3 months
  if (monthsCovered < 3 && !vulnerabilities.find(v => v.id === "no-emergency")) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Build Emergency Fund",
      description: `Save £${(monthlyExpenses * 3 - liquidAssets).toFixed(0)} more for 3-month buffer`,
      impact: "+5-10 pts",
      completed: false
    });
  }

  // Priority 3: Improve savings rate
  if (healthScore.pillars.savings.score < 15) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Increase Savings Rate",
      description: "Aim to save at least 15-20% of your income each month",
      impact: "+5-8 pts",
      completed: false
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
        completed: false
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
      completed: false
    });
  }

  // Priority 6: Build towards 6-month emergency fund
  if (monthsCovered >= 3 && monthsCovered < 6) {
    roadmap.push({
      step: roadmap.length + 1,
      title: "Extend Emergency Fund",
      description: `Save £${(monthlyExpenses * 6 - liquidAssets).toFixed(0)} more for 6-month buffer`,
      impact: "+5 pts",
      completed: false
    });
  }

  // Limit to 6 items
  return roadmap.slice(0, 6);
}

// Update all Financial Health UI
function updateFinancialHealth() {
  const healthScore = calculateHealthScore();
  const totalAssets = calculateTotalAssets();
  const totalLiabilities = calculateTotalLiabilities();
  const netWorth = calculateNetWorth();
  const vulnerabilities = detectVulnerabilities();
  const roadmap = generateRoadmap(healthScore, vulnerabilities);

  // Update health score hero
  const scoreEl = document.querySelector("[data-health-score]");
  const statusEl = document.querySelector("[data-health-status]");
  const ringEl = document.querySelector("[data-health-ring]");

  if (scoreEl) scoreEl.textContent = healthScore.total;
  if (statusEl) statusEl.textContent = healthScore.status;

  // Update ring SVG
  if (ringEl) {
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (healthScore.total / 100) * circumference;
    ringEl.style.strokeDashoffset = offset;

    // Color based on score
    ringEl.classList.remove("good", "warning", "danger");
    if (healthScore.total >= 70) ringEl.classList.add("good");
    else if (healthScore.total >= 40) ringEl.classList.add("warning");
    else ringEl.classList.add("danger");
  }

  // Update pillars
  Object.entries(healthScore.pillars).forEach(([key, data]) => {
    const scoreEl = document.querySelector(`[data-pillar-score="${key}"]`);
    const fillEl = document.querySelector(`[data-pillar-fill="${key}"]`);
    const tipEl = document.querySelector(`[data-pillar-tip="${key}"]`);

    const maxScores = { emergency: 25, debt: 25, savings: 20, credit: 15, protection: 15 };
    const max = maxScores[key];

    if (scoreEl) scoreEl.textContent = `${data.score}/${max}`;
    if (fillEl) {
      const percent = (data.score / max) * 100;
      fillEl.style.width = `${percent}%`;
      fillEl.classList.remove("warning", "danger");
      if (percent < 40) fillEl.classList.add("danger");
      else if (percent < 70) fillEl.classList.add("warning");
    }
    if (tipEl) tipEl.textContent = data.tip;
  });

  // Update net worth
  const networthTotalEl = document.querySelector("[data-networth-total]");
  const assetsTotalEl = document.querySelector("[data-assets-total]");
  const assetsTotalSmallEl = document.querySelector("[data-assets-total-small]");
  const liabilitiesTotalEl = document.querySelector("[data-liabilities-total]");
  const liabilitiesTotalSmallEl = document.querySelector("[data-liabilities-total-small]");
  const assetsFillEl = document.querySelector("[data-assets-fill]");
  const liabilitiesFillEl = document.querySelector("[data-liabilities-fill]");

  const formatLarge = (val) => {
    if (Math.abs(val) >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `£${(val / 1000).toFixed(0)}K`;
    return formatCurrency(val);
  };

  if (networthTotalEl) {
    networthTotalEl.textContent = formatLarge(netWorth);
    networthTotalEl.classList.remove("positive", "negative");
    if (netWorth > 0) networthTotalEl.classList.add("positive");
    else if (netWorth < 0) networthTotalEl.classList.add("negative");
  }

  if (assetsTotalEl) assetsTotalEl.textContent = formatLarge(totalAssets);
  if (assetsTotalSmallEl) assetsTotalSmallEl.textContent = formatLarge(totalAssets);
  if (liabilitiesTotalEl) liabilitiesTotalEl.textContent = formatLarge(totalLiabilities);
  if (liabilitiesTotalSmallEl) liabilitiesTotalSmallEl.textContent = formatLarge(totalLiabilities);

  // Net worth bars - scale relative to max of assets or liabilities
  const maxBar = Math.max(totalAssets, totalLiabilities, 1);
  if (assetsFillEl) assetsFillEl.style.width = `${(totalAssets / maxBar) * 100}%`;
  if (liabilitiesFillEl) liabilitiesFillEl.style.width = `${(totalLiabilities / maxBar) * 100}%`;

  // Update credit score display
  const creditScoreDisplayEl = document.querySelector("[data-credit-score-display]");
  const creditBandEl = document.querySelector("[data-credit-band]");
  const utilizationFillEl = document.querySelector("[data-utilization-fill]");
  const utilizationPercentEl = document.querySelector("[data-utilization-percent]");

  if (creditScoreDisplayEl) {
    creditScoreDisplayEl.textContent = state.creditScore.score || "---";
  }
  if (creditBandEl) {
    const creditData = healthScore.pillars.credit;
    creditBandEl.textContent = creditData.band || "Not set";
    creditBandEl.classList.remove("excellent", "good", "fair", "poor");
    if (creditData.band === "Excellent") creditBandEl.classList.add("excellent");
    else if (creditData.band === "Good") creditBandEl.classList.add("good");
    else if (creditData.band === "Fair") creditBandEl.classList.add("fair");
    else if (creditData.band === "Poor") creditBandEl.classList.add("poor");
  }

  // Credit utilization bar
  if (state.creditScore.creditLimit > 0) {
    const utilization = (state.creditScore.creditUsed / state.creditScore.creditLimit) * 100;
    if (utilizationFillEl) {
      utilizationFillEl.style.width = `${Math.min(utilization, 100)}%`;
      utilizationFillEl.classList.remove("warning", "danger");
      if (utilization > 50) utilizationFillEl.classList.add("danger");
      else if (utilization > 30) utilizationFillEl.classList.add("warning");
    }
    if (utilizationPercentEl) utilizationPercentEl.textContent = `${utilization.toFixed(0)}%`;
  } else {
    if (utilizationFillEl) utilizationFillEl.style.width = "0%";
    if (utilizationPercentEl) utilizationPercentEl.textContent = "0%";
  }

  // Update vulnerabilities
  const vulnListEl = document.querySelector("[data-vulnerability-list]");
  if (vulnListEl) {
    if (vulnerabilities.length === 0) {
      vulnListEl.innerHTML = `
        <div class="vulnerability-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <p>No vulnerabilities detected. Great job!</p>
        </div>
      `;
    } else {
      vulnListEl.innerHTML = vulnerabilities.map(v => {
        const severityClass = ['critical', 'warning'].includes(v.severity) ? v.severity : '';
        return `
        <div class="vulnerability-item ${severityClass}">
          <span class="vulnerability-icon">${escapeHtml(v.icon)}</span>
          <div class="vulnerability-content">
            <h4>${escapeHtml(v.title)}</h4>
            <p>${escapeHtml(v.description)}</p>
            <button class="vulnerability-action" type="button">
              ${escapeHtml(v.action)}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      `}).join("");
    }
  }

  // Update roadmap
  const roadmapListEl = document.querySelector("[data-roadmap-list]");
  if (roadmapListEl) {
    if (roadmap.length === 0) {
      roadmapListEl.innerHTML = `
        <div class="roadmap-empty">
          <p>Complete your profile to get personalized recommendations</p>
        </div>
      `;
    } else {
      roadmapListEl.innerHTML = roadmap.map(item => `
        <div class="roadmap-item ${item.completed ? 'completed' : ''}">
          <div class="roadmap-step">${escapeHtml(String(item.step))}</div>
          <div class="roadmap-content">
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.description)}</p>
          </div>
          <div class="roadmap-impact">
            <span class="impact-label">Impact</span>
            <span class="impact-value">${escapeHtml(item.impact)}</span>
          </div>
        </div>
      `).join("");
    }
  }
}

// ============================================================
// SMART INSIGHTS ENGINE
// ============================================================

// UK Financial Benchmarks (Source: ONS, Money Helper, FCA)
const UK_BENCHMARKS = {
  // Savings rate by gross income bracket (% of income saved)
  savingsRate: {
    under20k: { poor: 0, fair: 3, good: 8, excellent: 12 },
    "20k-30k": { poor: 0, fair: 5, good: 10, excellent: 15 },
    "30k-50k": { poor: 2, fair: 8, good: 15, excellent: 20 },
    "50k-80k": { poor: 5, fair: 12, good: 20, excellent: 25 },
    over80k: { poor: 8, fair: 15, good: 25, excellent: 30 },
  },
  // Emergency fund months by age (recommended)
  emergencyFund: {
    under30: { minimum: 2, good: 3, excellent: 6 },
    "30-50": { minimum: 3, good: 6, excellent: 9 },
    over50: { minimum: 6, good: 9, excellent: 12 },
  },
  // Debt-to-income ratio benchmarks
  debtToIncome: {
    excellent: 15, // Under 15% is excellent
    good: 25,      // 15-25% is good
    fair: 35,      // 25-35% is fair
    poor: 50,      // 35-50% is concerning
  },
  // UK median spending by category (% of take-home pay)
  spendingByCategory: {
    housing: 28,      // Rent/mortgage
    transport: 12,    // Car, fuel, public transport
    food: 11,         // Groceries + dining
    utilities: 6,     // Energy, water, internet
    insurance: 4,     // All insurance
    entertainment: 5, // Subscriptions, leisure
    clothing: 3,
    childcare: 8,     // For those with children
  },
  // Credit utilization
  creditUtilization: {
    excellent: 10,
    good: 30,
    fair: 50,
    poor: 75,
  }
};

// Get income bracket for benchmarks
function getIncomeBracket(annualSalary) {
  if (annualSalary < 20000) return "under20k";
  if (annualSalary < 30000) return "20k-30k";
  if (annualSalary < 50000) return "30k-50k";
  if (annualSalary < 80000) return "50k-80k";
  return "over80k";
}

// Calculate peer comparison insights
function calculatePeerComparison() {
  const insights = [];
  const annualSalary = state.annualSalary || 0;
  const monthlyIncome = state.income || 0;
  const monthlyExpenses = calculateMonthlyExpenses();
  const savingsAmount = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (savingsAmount / monthlyIncome) * 100 : 0;

  if (annualSalary <= 0 || monthlyIncome <= 0) {
    return [{ type: "info", icon: "📊", title: "Add your income", message: "Enter your salary to see how you compare to UK averages", action: null }];
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
    percentile: percentile,
    metric: `${savingsRate.toFixed(0)}%`,
    benchmark: `UK avg: ${benchmarks.fair}%`
  });

  // Debt-to-income comparison
  const monthlyDebt = (state.expenses.mortgage || 0) + (state.expenses.carPayment || 0) +
    (state.expenses.creditCards || 0) + (state.expenses.personalLoans || 0) + (state.expenses.otherDebt || 0);
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
    benchmark: `Target: <${UK_BENCHMARKS.debtToIncome.good}%`
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
    efMessage = `Building an emergency fund should be priority #1`;
  }

  insights.push({
    type: monthsCovered >= 3 ? "positive" : monthsCovered >= 1 ? "neutral" : "warning",
    icon: "🛡️",
    title: "Emergency Buffer",
    message: efMessage,
    percentile: efPercentile,
    metric: `${monthsCovered.toFixed(1)} months`,
    benchmark: "Target: 3-6 months"
  });

  return insights;
}

// Analyze spending trends from import history
function analyzeSpendingTrends() {
  const trends = [];
  const monthlyExpenses = calculateMonthlyExpenses();
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

  categories.forEach(cat => {
    const total = cat.fields.reduce((sum, f) => sum + (state.expenses[f] || 0), 0);
    const percentOfIncome = (total / monthlyIncome) * 100;
    const ukAvg = UK_BENCHMARKS.spendingByCategory[cat.key] || 10;
    const diff = percentOfIncome - ukAvg;

    if (Math.abs(diff) > 5) { // Only flag significant differences
      trends.push({
        category: cat.label,
        amount: total,
        percentOfIncome: percentOfIncome,
        ukAverage: ukAvg,
        difference: diff,
        status: diff > 0 ? "above" : "below",
        icon: diff > 5 ? "📈" : "📉",
        message: diff > 0
          ? `${cat.label} is ${diff.toFixed(0)}% above UK average`
          : `${cat.label} is ${Math.abs(diff).toFixed(0)}% below UK average - great!`
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
  } catch (e) { /* ignore */ }

  // Also analyze current expense fields that are likely subscriptions
  const subFields = [
    { field: "streaming", label: "Streaming Services", icon: "📺" },
    { field: "subscriptions", label: "Other Subscriptions", icon: "📦" },
    { field: "gym", label: "Gym Membership", icon: "💪" },
    { field: "internet", label: "Internet/Broadband", icon: "🌐" },
  ];

  let totalMonthly = 0;
  subFields.forEach(sub => {
    const amount = state.expenses[sub.field] || 0;
    if (amount > 0) {
      subscriptions.push({
        name: sub.label,
        amount: amount,
        annual: amount * 12,
        icon: sub.icon,
        source: "manual"
      });
      totalMonthly += amount;
    }
  });

  // Check imported recurring payments
  if (importHistory.length > 0) {
    const latestImport = importHistory[importHistory.length - 1];
    if (latestImport.recurring && latestImport.recurring.length > 0) {
      latestImport.recurring.forEach(rec => {
        // Avoid duplicates with manual entries
        const isDuplicate = subscriptions.some(s =>
          s.name.toLowerCase().includes(rec.description.toLowerCase().split(" ")[0])
        );
        if (!isDuplicate && rec.avgAmount > 0) {
          subscriptions.push({
            name: rec.description,
            amount: Math.abs(rec.avgAmount),
            annual: Math.abs(rec.avgAmount) * 12,
            icon: "🔄",
            source: "imported",
            count: rec.count
          });
          totalMonthly += Math.abs(rec.avgAmount);
        }
      });
    }
  }

  return {
    subscriptions: subscriptions.sort((a, b) => b.amount - a.amount),
    totalMonthly,
    totalAnnual: totalMonthly * 12
  };
}

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
      const newEmergencyMonths = monthlyExpenses > 0
        ? (liquidAssets + totalExtra) / monthlyExpenses
        : 0;

      results.title = `Save £${extraAmount} more per month`;
      results.projections = [
        { label: "Extra saved in 1 year", value: formatCurrency(extraAmount * 12) },
        { label: "Extra saved in 5 years", value: formatCurrency(extraAmount * 60) },
        { label: "Emergency fund grows to", value: `${newEmergencyMonths.toFixed(1)} months` },
      ];
      results.impact = `+${Math.round(extraAmount / (monthlyIncome || 1) * 100)}% savings rate boost`;
      break;
    }

    case "debtPayoff": {
      const extraPayment = scenario.amount || 100;
      const totalDebt = (state.liabilities.creditCardBalance || 0) +
        (state.liabilities.personalLoansBalance || 0) +
        (state.liabilities.carFinanceBalance || 0);

      if (totalDebt > 0) {
        const currentMonthlyDebt = (state.expenses.creditCards || 0) +
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
          { label: "Debt-free date moves from", value: `${Math.ceil(monthsWithout)} to ${Math.ceil(monthsWithExtra)} months` },
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

      goals.slice(0, 3).forEach(goal => {
        const remaining = goal.target - goal.saved;
        const currentMonthly = goal.monthly || 0;
        const currentMonths = currentMonthly > 0 ? remaining / currentMonthly : 999;
        const newMonths = (currentMonthly + extraAmount) > 0 ? remaining / (currentMonthly + extraAmount) : 999;
        const monthsSaved = Math.max(0, currentMonths - newMonths);

        if (remaining > 0) {
          projections.push({
            label: goal.name,
            value: `${monthsSaved.toFixed(0)} months faster`
          });
        }
      });

      results.title = `Add £${extraAmount}/month to goals`;
      results.projections = projections.length > 0 ? projections : [{ label: "No active goals", value: "Set a goal first" }];
      results.impact = "Reach your goals sooner";
      break;
    }
  }

  return results;
}

// Generate personalized smart tips
function generateSmartTips() {
  const tips = [];
  const monthlyIncome = state.income || 0;
  const monthlyExpenses = calculateMonthlyExpenses();
  const surplus = monthlyIncome - monthlyExpenses;
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  // Priority 1: Critical issues
  if (surplus < 0) {
    tips.push({
      priority: 1,
      icon: "🚨",
      title: "Spending exceeds income",
      tip: `You're spending £${Math.abs(surplus).toFixed(0)} more than you earn. Review your largest expenses first.`,
      action: "Review expenses",
      category: "urgent"
    });
  }

  if (monthsCovered < 1 && monthlyExpenses > 0) {
    tips.push({
      priority: 1,
      icon: "⚠️",
      title: "Build an emergency buffer",
      tip: "46% of UK adults have less than £1,000 saved. Start with £1,000, then build to 3 months of expenses.",
      action: "Set savings goal",
      category: "urgent"
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
      tip: `Cutting dining/coffee by 30% could save £${potential.toFixed(0)}/month (£${(potential * 12).toFixed(0)}/year)`,
      action: "Track spending",
      category: "savings"
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
      category: "savings"
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
      category: "protection"
    });
  }

  if (state.assets.stocksISA === 0 && state.assets.cashISA > 10000) {
    tips.push({
      priority: 3,
      icon: "📈",
      title: "Consider investing",
      tip: "With a solid cash buffer, a Stocks & Shares ISA could help your money grow faster over 5+ years.",
      action: "Learn about ISAs",
      category: "growth"
    });
  }

  if (monthsCovered >= 6 && surplus > 500) {
    tips.push({
      priority: 3,
      icon: "🎯",
      title: "Max out your ISA",
      tip: `You can put up to £20,000/year in ISAs tax-free. Consider increasing your monthly contributions.`,
      action: "Review ISA allowance",
      category: "growth"
    });
  }

  // Priority 4: Quick wins
  if (state.expenses.energy > 150) {
    tips.push({
      priority: 4,
      icon: "⚡",
      title: "Energy bill check",
      tip: "Compare energy tariffs - switching could save £200-400/year. Check MSE's Cheap Energy Club.",
      action: "Compare tariffs",
      category: "savings"
    });
  }

  // Sort by priority
  return tips.sort((a, b) => a.priority - b.priority).slice(0, 5);
}

// Initialize Smart Insights Panel
function initSmartInsights() {
  // Initial render
  updateSmartInsights();

  // Setup What-If calculator sliders
  const whatIfSlider = document.querySelector("[data-whatif-slider]");
  const whatIfAmount = document.querySelector("[data-whatif-amount]");
  const whatIfScenario = document.querySelector("[data-whatif-scenario]");

  if (whatIfSlider && whatIfAmount) {
    whatIfSlider.addEventListener("input", () => {
      whatIfAmount.textContent = `£${whatIfSlider.value}`;
      updateWhatIfResults();
    });
  }

  if (whatIfScenario) {
    whatIfScenario.addEventListener("change", () => {
      updateWhatIfResults();
    });
  }
}

// Update What-If results display
function updateWhatIfResults() {
  const slider = document.querySelector("[data-whatif-slider]");
  const scenarioSelect = document.querySelector("[data-whatif-scenario]");
  const resultsEl = document.querySelector("[data-whatif-results]");

  if (!slider || !scenarioSelect || !resultsEl) return;

  const amount = parseInt(slider.value) || 100;
  const scenarioType = scenarioSelect.value || "extraSavings";

  const results = calculateWhatIf({ type: scenarioType, amount });

  resultsEl.innerHTML = `
    <h4>${escapeHtml(results.title)}</h4>
    <div class="whatif-projections">
      ${results.projections.map(p => `
        <div class="whatif-row">
          <span class="whatif-label">${escapeHtml(p.label)}</span>
          <span class="whatif-value">${escapeHtml(p.value)}</span>
        </div>
      `).join("")}
    </div>
    <div class="whatif-impact">${escapeHtml(results.impact)}</div>
  `;
}

// Update Smart Insights UI
function updateSmartInsights() {
  // Peer comparisons
  const peerInsights = calculatePeerComparison();
  const peerListEl = document.querySelector("[data-peer-insights]");

  if (peerListEl) {
    peerListEl.innerHTML = peerInsights.map(insight => `
      <div class="insight-card ${insight.type}">
        <div class="insight-header">
          <span class="insight-icon">${insight.icon}</span>
          <span class="insight-title">${escapeHtml(insight.title)}</span>
          ${insight.percentile ? `<span class="insight-percentile">Top ${100 - insight.percentile}%</span>` : ""}
        </div>
        <p class="insight-message">${escapeHtml(insight.message)}</p>
        ${insight.metric ? `
          <div class="insight-metrics">
            <span class="insight-metric">${escapeHtml(insight.metric)}</span>
            <span class="insight-benchmark">${escapeHtml(insight.benchmark)}</span>
          </div>
        ` : ""}
      </div>
    `).join("");
  }

  // Spending trends
  const trends = analyzeSpendingTrends();
  const trendsListEl = document.querySelector("[data-spending-trends]");

  if (trendsListEl) {
    if (trends.length === 0) {
      trendsListEl.innerHTML = `<p class="no-trends">Your spending is close to UK averages across categories</p>`;
    } else {
      trendsListEl.innerHTML = trends.map(trend => `
        <div class="trend-item ${trend.status}">
          <span class="trend-icon">${trend.icon}</span>
          <div class="trend-info">
            <span class="trend-category">${escapeHtml(trend.category)}</span>
            <span class="trend-message">${escapeHtml(trend.message)}</span>
          </div>
          <div class="trend-values">
            <span class="trend-yours">${trend.percentOfIncome.toFixed(0)}%</span>
            <span class="trend-avg">UK: ${trend.ukAverage}%</span>
          </div>
        </div>
      `).join("");
    }
  }

  // Subscription audit
  const subAudit = auditSubscriptions();
  const subListEl = document.querySelector("[data-subscription-audit]");
  const subTotalEl = document.querySelector("[data-subscription-total]");

  if (subListEl) {
    if (subAudit.subscriptions.length === 0) {
      subListEl.innerHTML = `<p class="no-subs">No subscriptions detected. Import a statement to find recurring payments.</p>`;
    } else {
      subListEl.innerHTML = subAudit.subscriptions.slice(0, 6).map(sub => `
        <div class="sub-item">
          <span class="sub-icon">${sub.icon}</span>
          <span class="sub-name">${escapeHtml(sub.name)}</span>
          <span class="sub-amount">${formatCurrency(sub.amount)}/mo</span>
        </div>
      `).join("");
    }
  }

  if (subTotalEl) {
    subTotalEl.innerHTML = `
      <span class="sub-total-label">Total subscriptions:</span>
      <span class="sub-total-monthly">${formatCurrency(subAudit.totalMonthly)}/mo</span>
      <span class="sub-total-annual">(${formatCurrency(subAudit.totalAnnual)}/year)</span>
    `;
  }

  // Smart tips
  const tips = generateSmartTips();
  const tipsListEl = document.querySelector("[data-smart-tips]");

  if (tipsListEl) {
    if (tips.length === 0) {
      tipsListEl.innerHTML = `<p class="no-tips">Add your financial details to get personalized tips</p>`;
    } else {
      tipsListEl.innerHTML = tips.map(tip => `
        <div class="tip-card ${tip.category}">
          <span class="tip-icon">${tip.icon}</span>
          <div class="tip-content">
            <h4>${escapeHtml(tip.title)}</h4>
            <p>${escapeHtml(tip.tip)}</p>
          </div>
        </div>
      `).join("");
    }
  }

  // What-If calculator
  updateWhatIfResults();
}

// ============================================================
// HEALTH SCORE HISTORY & TRENDS
// ============================================================

const SCORE_HISTORY_KEY = "consumerpay_score_history";
const MAX_HISTORY_MONTHS = 24;

// Get current month key (YYYY-MM format)
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Load score history from storage
function loadScoreHistory() {
  try {
    const stored = localStorage.getItem(SCORE_HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) { /* ignore */ }
  return [];
}

// Save score history to storage
function saveScoreHistory(history) {
  try {
    // Keep only last 24 months
    const trimmed = history.slice(-MAX_HISTORY_MONTHS);
    localStorage.setItem(SCORE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) { /* ignore */ }
}

// Take a monthly snapshot of the health score
function takeScoreSnapshot() {
  const monthKey = getCurrentMonthKey();
  const history = loadScoreHistory();

  // Check if we already have a snapshot for this month
  const existingIndex = history.findIndex(h => h.month === monthKey);

  const healthScore = calculateHealthScore();
  const snapshot = {
    month: monthKey,
    date: new Date().toISOString(),
    total: healthScore.total,
    status: healthScore.status,
    pillars: {
      emergency: healthScore.pillars.emergency.score,
      debt: healthScore.pillars.debt.score,
      savings: healthScore.pillars.savings.score,
      credit: healthScore.pillars.credit.score,
      protection: healthScore.pillars.protection.score,
    },
    netWorth: calculateNetWorth(),
    savingsRate: state.income > 0 ? ((state.income - calculateMonthlyExpenses()) / state.income * 100) : 0,
  };

  if (existingIndex >= 0) {
    // Update existing snapshot for this month
    history[existingIndex] = snapshot;
  } else {
    // Add new snapshot
    history.push(snapshot);
  }

  saveScoreHistory(history);
  return snapshot;
}

// Check if we should auto-snapshot (first visit of the month)
function checkAutoSnapshot() {
  const monthKey = getCurrentMonthKey();
  const lastSnapshotKey = localStorage.getItem("consumerpay_last_snapshot_month");

  if (lastSnapshotKey !== monthKey) {
    // First visit this month - take snapshot
    takeScoreSnapshot();
    localStorage.setItem("consumerpay_last_snapshot_month", monthKey);
  }
}

// Calculate trend for a pillar (comparing last 3 months)
function calculatePillarTrend(pillarKey) {
  const history = loadScoreHistory();
  if (history.length < 2) return { direction: "stable", change: 0 };

  const recent = history.slice(-3);
  if (recent.length < 2) return { direction: "stable", change: 0 };

  const latest = recent[recent.length - 1].pillars[pillarKey] || 0;
  const previous = recent[0].pillars[pillarKey] || 0;
  const change = latest - previous;

  if (change > 2) return { direction: "up", change };
  if (change < -2) return { direction: "down", change };
  return { direction: "stable", change };
}

// Calculate overall score trend
function calculateScoreTrend() {
  const history = loadScoreHistory();
  if (history.length < 2) return { direction: "stable", change: 0, message: "Keep tracking to see trends" };

  const recent = history.slice(-3);
  const latest = recent[recent.length - 1].total;
  const previous = recent[0].total;
  const change = latest - previous;

  let direction = "stable";
  let message = "Score is holding steady";

  if (change > 5) {
    direction = "up";
    message = `Up ${change} points from ${recent.length} months ago`;
  } else if (change < -5) {
    direction = "down";
    message = `Down ${Math.abs(change)} points - review your finances`;
  }

  return { direction, change, message };
}

// Get year-on-year comparison
function getYearOnYearComparison() {
  const history = loadScoreHistory();
  const currentMonth = getCurrentMonthKey();
  const [year, month] = currentMonth.split("-").map(Number);
  const lastYearMonth = `${year - 1}-${String(month).padStart(2, '0')}`;

  const current = history.find(h => h.month === currentMonth);
  const lastYear = history.find(h => h.month === lastYearMonth);

  if (!current || !lastYear) {
    return {
      available: false,
      message: "Keep tracking to see year-on-year comparison"
    };
  }

  const scoreDiff = current.total - lastYear.total;
  const netWorthDiff = current.netWorth - lastYear.netWorth;

  return {
    available: true,
    currentScore: current.total,
    lastYearScore: lastYear.total,
    scoreDiff,
    scoreImproved: scoreDiff > 0,
    netWorthDiff,
    message: scoreDiff > 0
      ? `Your score is ${scoreDiff} points higher than last ${getMonthName(month)}`
      : scoreDiff < 0
        ? `Your score is ${Math.abs(scoreDiff)} points lower than last ${getMonthName(month)}`
        : `Same score as last ${getMonthName(month)}`
  };
}

// Get month name
function getMonthName(monthNum) {
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return months[monthNum - 1] || "";
}

// Detect milestone achievements
function detectMilestones() {
  const history = loadScoreHistory();
  const milestones = [];

  if (history.length === 0) return milestones;

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;

  // Score threshold milestones
  const thresholds = [
    { score: 50, name: "Halfway There", icon: "🌟", message: "You've reached 50 points!" },
    { score: 70, name: "Strong Foundation", icon: "💪", message: "70+ means solid financial health" },
    { score: 85, name: "Financial Champion", icon: "🏆", message: "Top tier financial health!" },
    { score: 95, name: "Financial Master", icon: "👑", message: "Near-perfect financial health" },
  ];

  thresholds.forEach(t => {
    if (latest.total >= t.score && (!previous || previous.total < t.score)) {
      milestones.push({
        type: "score",
        ...t,
        achieved: true,
        date: latest.date
      });
    }
  });

  // Net worth milestones
  const netWorthMilestones = [
    { amount: 10000, name: "Five Figures", icon: "💰" },
    { amount: 50000, name: "Halfway to 100K", icon: "📈" },
    { amount: 100000, name: "Six Figures", icon: "🎯" },
    { amount: 250000, name: "Quarter Million", icon: "🚀" },
    { amount: 500000, name: "Half Million", icon: "⭐" },
    { amount: 1000000, name: "Millionaire", icon: "👑" },
  ];

  netWorthMilestones.forEach(m => {
    if (latest.netWorth >= m.amount && (!previous || previous.netWorth < m.amount)) {
      milestones.push({
        type: "netWorth",
        ...m,
        message: `Net worth reached ${formatCurrency(m.amount)}!`,
        achieved: true,
        date: latest.date
      });
    }
  });

  // Streak milestones (consecutive months with score improvement)
  let streak = 0;
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i].total > history[i - 1].total) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 3) {
    milestones.push({
      type: "streak",
      name: `${streak}-Month Streak`,
      icon: "🔥",
      message: `${streak} consecutive months of improvement!`,
      achieved: true,
      streak
    });
  }

  return milestones;
}

// Prepare chart data for score history
function getScoreChartData() {
  const history = loadScoreHistory();

  return history.map(h => ({
    month: h.month,
    label: formatMonthLabel(h.month),
    total: h.total,
    emergency: h.pillars.emergency,
    debt: h.pillars.debt,
    savings: h.pillars.savings,
    credit: h.pillars.credit,
    protection: h.pillars.protection,
    netWorth: h.netWorth,
  }));
}

// Format month label (e.g., "2024-01" -> "Jan 24")
function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
}

// Initialize Score History tracking
function initScoreHistory() {
  // Check for auto-snapshot on first visit of month
  checkAutoSnapshot();

  // Update the history display
  updateScoreHistoryUI();
}

// Update Score History UI elements
function updateScoreHistoryUI() {
  const chartData = getScoreChartData();
  const scoreTrend = calculateScoreTrend();
  const yoyComparison = getYearOnYearComparison();
  const milestones = detectMilestones();

  // Update trend indicator on health score
  const trendEl = document.querySelector("[data-score-trend]");
  if (trendEl) {
    const trendIcon = scoreTrend.direction === "up" ? "↑" :
      scoreTrend.direction === "down" ? "↓" : "→";
    const trendClass = scoreTrend.direction === "up" ? "trend-up" :
      scoreTrend.direction === "down" ? "trend-down" : "trend-stable";

    trendEl.innerHTML = `
      <span class="trend-icon ${trendClass}">${trendIcon}</span>
      <span class="trend-text">${escapeHtml(scoreTrend.message)}</span>
    `;
  }

  // Update pillar trends
  ["emergency", "debt", "savings", "credit", "protection"].forEach(pillar => {
    const trendEl = document.querySelector(`[data-pillar-trend="${pillar}"]`);
    if (trendEl) {
      const trend = calculatePillarTrend(pillar);
      const icon = trend.direction === "up" ? "↑" :
        trend.direction === "down" ? "↓" : "";
      const className = trend.direction === "up" ? "trend-up" :
        trend.direction === "down" ? "trend-down" : "";

      trendEl.textContent = icon;
      trendEl.className = `pillar-trend ${className}`;
    }
  });

  // Update YoY comparison
  const yoyEl = document.querySelector("[data-yoy-comparison]");
  if (yoyEl) {
    if (yoyComparison.available) {
      const diffClass = yoyComparison.scoreImproved ? "positive" : yoyComparison.scoreDiff < 0 ? "negative" : "";
      yoyEl.innerHTML = `
        <div class="yoy-card ${diffClass}">
          <div class="yoy-icon">${yoyComparison.scoreImproved ? "📈" : yoyComparison.scoreDiff < 0 ? "📉" : "➡️"}</div>
          <div class="yoy-content">
            <span class="yoy-label">vs Last Year</span>
            <span class="yoy-message">${escapeHtml(yoyComparison.message)}</span>
          </div>
          <div class="yoy-diff ${diffClass}">
            ${yoyComparison.scoreDiff > 0 ? "+" : ""}${yoyComparison.scoreDiff}
          </div>
        </div>
      `;
    } else {
      yoyEl.innerHTML = `<p class="yoy-pending">${escapeHtml(yoyComparison.message)}</p>`;
    }
  }

  // Update score history chart
  const chartEl = document.querySelector("[data-score-chart]");
  if (chartEl && chartData.length > 0) {
    renderScoreChart(chartEl, chartData);
  } else if (chartEl) {
    chartEl.innerHTML = `<p class="chart-empty">Score history will appear after your first month</p>`;
  }

  // Update milestones display
  const milestonesEl = document.querySelector("[data-milestones]");
  if (milestonesEl) {
    if (milestones.length > 0) {
      milestonesEl.innerHTML = milestones.map(m => `
        <div class="milestone-badge">
          <span class="milestone-icon">${m.icon}</span>
          <span class="milestone-name">${escapeHtml(m.name)}</span>
        </div>
      `).join("");
    } else {
      milestonesEl.innerHTML = "";
    }
  }
}

// Render simple SVG line chart for score history
function renderScoreChart(container, data) {
  if (data.length < 2) {
    container.innerHTML = `<p class="chart-empty">Need at least 2 months of data for chart</p>`;
    return;
  }

  const width = container.clientWidth || 300;
  const height = 180;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxScore = 100;
  const minScore = 0;
  const xStep = chartWidth / (data.length - 1);

  // Generate path points
  const points = data.map((d, i) => ({
    x: padding.left + (i * xStep),
    y: padding.top + chartHeight - ((d.total - minScore) / (maxScore - minScore)) * chartHeight,
    label: d.label,
    value: d.total
  }));

  // Create path string
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Create area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Generate y-axis labels
  const yLabels = [0, 25, 50, 75, 100];

  // Generate x-axis labels (show every other if too many)
  const showEvery = data.length > 6 ? 2 : 1;

  container.innerHTML = `
    <svg width="${width}" height="${height}" class="score-chart-svg">
      <!-- Grid lines -->
      ${yLabels.map(v => {
    const y = padding.top + chartHeight - (v / 100) * chartHeight;
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid" />`;
  }).join('')}

      <!-- Y-axis labels -->
      ${yLabels.map(v => {
    const y = padding.top + chartHeight - (v / 100) * chartHeight;
    return `<text x="${padding.left - 8}" y="${y + 4}" class="chart-label-y">${v}</text>`;
  }).join('')}

      <!-- Area fill -->
      <path d="${areaD}" class="chart-area" />

      <!-- Line -->
      <path d="${pathD}" class="chart-line" />

      <!-- Data points -->
      ${points.map((p, i) => `
        <circle cx="${p.x}" cy="${p.y}" r="5" class="chart-point" />
        <title>${p.label}: ${p.value}</title>
      `).join('')}

      <!-- X-axis labels -->
      ${points.filter((_, i) => i % showEvery === 0 || i === points.length - 1).map(p => `
        <text x="${p.x}" y="${height - 8}" class="chart-label-x">${escapeHtml(p.label)}</text>
      `).join('')}
    </svg>
  `;
}

// ============================================================
// VISUAL CHARTS & DASHBOARDS
// ============================================================

// Spending breakdown by category
function getSpendingBreakdown() {
  const categories = [
    { key: "housing", label: "Housing", color: "#1a365d", fields: ["mortgage", "councilTax", "homeInsurance"] },
    { key: "transport", label: "Transport", color: "#2b6cb0", fields: ["carPayment", "carInsurance", "fuel", "publicTransport"] },
    { key: "food", label: "Food & Dining", color: "#259d91", fields: ["groceries", "diningOut", "coffeeSnacks"] },
    { key: "utilities", label: "Utilities", color: "#48bb78", fields: ["energy", "water", "internet"] },
    { key: "family", label: "Family", color: "#ed8936", fields: ["childcare", "kidsActivities", "schoolCosts", "kidsClothing"] },
    { key: "lifestyle", label: "Lifestyle", color: "#9f7aea", fields: ["gym", "clothing", "personalCare", "entertainment", "streaming", "subscriptions"] },
    { key: "debt", label: "Debt Payments", color: "#e53e3e", fields: ["creditCards", "personalLoans", "otherDebt"] },
  ];

  const breakdown = [];
  let total = 0;

  categories.forEach(cat => {
    const amount = cat.fields.reduce((sum, f) => sum + (state.expenses[f] || 0), 0);
    if (amount > 0) {
      breakdown.push({
        ...cat,
        amount,
        percentage: 0 // Will calculate after we have total
      });
      total += amount;
    }
  });

  // Calculate percentages
  breakdown.forEach(item => {
    item.percentage = total > 0 ? (item.amount / total) * 100 : 0;
  });

  return { breakdown, total };
}

// Render spending donut chart
function renderSpendingDonut(container) {
  const { breakdown, total } = getSpendingBreakdown();

  if (breakdown.length === 0 || total === 0) {
    container.innerHTML = `<p class="chart-empty">Add your expenses to see breakdown</p>`;
    return;
  }

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const innerRadius = 50;

  let currentAngle = -90; // Start from top

  const paths = breakdown.map(item => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
    const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const d = [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
      'Z'
    ].join(' ');

    return { ...item, d };
  });

  container.innerHTML = `
    <div class="donut-chart-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="donut-chart-svg">
        ${paths.map(p => `
          <path d="${p.d}" fill="${p.color}" class="donut-segment">
            <title>${escapeHtml(p.label)}: ${formatCurrency(p.amount)} (${p.percentage.toFixed(0)}%)</title>
          </path>
        `).join('')}
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="donut-total-label">Total</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="donut-total-value">${formatCurrency(total)}</text>
      </svg>
      <div class="donut-legend">
        ${breakdown.slice(0, 5).map(item => `
          <div class="legend-item">
            <span class="legend-color" style="background: ${item.color}"></span>
            <span class="legend-label">${escapeHtml(item.label)}</span>
            <span class="legend-value">${item.percentage.toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Convert polar to cartesian coordinates
function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

// Get asset allocation breakdown
function getAssetAllocation() {
  const categories = [
    { key: "cash", label: "Cash & Savings", color: "#259d91", amount: (state.assets.cashSavings || 0) + (state.assets.cashISA || 0) },
    { key: "investments", label: "Investments", color: "#2b6cb0", amount: (state.assets.stocksISA || 0) + (state.assets.generalInvestments || 0) + (state.assets.crypto || 0) },
    { key: "pension", label: "Pension", color: "#9f7aea", amount: state.assets.pensionValue || 0 },
    { key: "property", label: "Property", color: "#ed8936", amount: (state.assets.propertyValue || 0) + (state.assets.otherPropertyValue || 0) },
    { key: "other", label: "Other", color: "#718096", amount: (state.assets.vehicleValue || 0) + (state.assets.otherAssets || 0) },
  ];

  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const allocation = categories
    .filter(c => c.amount > 0)
    .map(c => ({
      ...c,
      percentage: total > 0 ? (c.amount / total) * 100 : 0
    }));

  return { allocation, total };
}

// Render asset allocation pie chart
function renderAssetAllocation(container) {
  const { allocation, total } = getAssetAllocation();

  if (allocation.length === 0 || total === 0) {
    container.innerHTML = `<p class="chart-empty">Add your assets to see allocation</p>`;
    return;
  }

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 70;

  let currentAngle = -90;

  const paths = allocation.map(item => {
    const angle = (item.percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // For full circle (single item), draw a circle instead
    if (angle >= 359.99) {
      return {
        ...item,
        d: `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
      };
    }

    const start = polarToCartesian(cx, cy, radius, startAngle);
    const end = polarToCartesian(cx, cy, radius, endAngle);
    const largeArcFlag = angle > 180 ? 1 : 0;

    const d = [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
      'Z'
    ].join(' ');

    return { ...item, d };
  });

  container.innerHTML = `
    <div class="pie-chart-wrap">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="pie-chart-svg">
        ${paths.map(p => `
          <path d="${p.d}" fill="${p.color}" class="pie-segment">
            <title>${escapeHtml(p.label)}: ${formatCurrency(p.amount)} (${p.percentage.toFixed(0)}%)</title>
          </path>
        `).join('')}
      </svg>
      <div class="pie-legend">
        ${allocation.map(item => `
          <div class="legend-item">
            <span class="legend-color" style="background: ${item.color}"></span>
            <span class="legend-label">${escapeHtml(item.label)}</span>
            <span class="legend-pct">${item.percentage.toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Render emergency fund runway gauge
function renderEmergencyGauge(container) {
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  const monthlyExpenses = calculateMonthlyExpenses();
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

  const maxMonths = 12;
  const percentage = Math.min(100, (monthsCovered / maxMonths) * 100);

  let status = "critical";
  let statusText = "Build emergency fund";
  if (monthsCovered >= 6) {
    status = "excellent";
    statusText = "Excellent buffer";
  } else if (monthsCovered >= 3) {
    status = "good";
    statusText = "Good buffer";
  } else if (monthsCovered >= 1) {
    status = "fair";
    statusText = "Building up";
  }

  const colors = {
    critical: "#e53e3e",
    fair: "#ed8936",
    good: "#48bb78",
    excellent: "#259d91"
  };

  container.innerHTML = `
    <div class="gauge-wrap">
      <div class="gauge-visual">
        <svg width="140" height="80" viewBox="0 0 140 80">
          <!-- Background arc -->
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round"/>
          <!-- Filled arc -->
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="${colors[status]}" stroke-width="12" stroke-linecap="round"
            stroke-dasharray="${percentage * 1.88} 188" class="gauge-fill"/>
          <!-- Target markers -->
          <line x1="50" y1="25" x2="50" y2="35" stroke="#718096" stroke-width="2"/>
          <text x="50" y="20" text-anchor="middle" class="gauge-marker">3mo</text>
          <line x1="90" y1="25" x2="90" y2="35" stroke="#718096" stroke-width="2"/>
          <text x="90" y="20" text-anchor="middle" class="gauge-marker">6mo</text>
        </svg>
        <div class="gauge-value-wrap">
          <span class="gauge-value" style="color: ${colors[status]}">${monthsCovered.toFixed(1)}</span>
          <span class="gauge-unit">months</span>
        </div>
      </div>
      <div class="gauge-info">
        <span class="gauge-status ${status}">${statusText}</span>
        <span class="gauge-detail">${formatCurrency(liquidAssets)} in accessible savings</span>
      </div>
    </div>
  `;
}

// Render income vs expenses comparison
function renderIncomeVsExpenses(container) {
  const income = state.income || 0;
  const expenses = calculateMonthlyExpenses();
  const surplus = income - expenses;
  const maxValue = Math.max(income, expenses, 1);

  const incomePercent = (income / maxValue) * 100;
  const expensesPercent = (expenses / maxValue) * 100;

  container.innerHTML = `
    <div class="income-expense-compare">
      <div class="compare-bar">
        <div class="compare-label">
          <span class="compare-icon">💰</span>
          <span>Income</span>
        </div>
        <div class="compare-track">
          <div class="compare-fill income" style="width: ${incomePercent}%"></div>
        </div>
        <span class="compare-value">${formatCurrency(income)}</span>
      </div>
      <div class="compare-bar">
        <div class="compare-label">
          <span class="compare-icon">💸</span>
          <span>Expenses</span>
        </div>
        <div class="compare-track">
          <div class="compare-fill expenses" style="width: ${expensesPercent}%"></div>
        </div>
        <span class="compare-value">${formatCurrency(expenses)}</span>
      </div>
      <div class="compare-surplus ${surplus >= 0 ? 'positive' : 'negative'}">
        <span>${surplus >= 0 ? 'Monthly Surplus' : 'Monthly Deficit'}</span>
        <span class="surplus-value">${surplus >= 0 ? '+' : ''}${formatCurrency(surplus)}</span>
      </div>
    </div>
  `;
}

// Render net worth over time chart
function renderNetWorthChart(container) {
  const history = loadScoreHistory();

  if (history.length < 2) {
    container.innerHTML = `<p class="chart-empty">Track for 2+ months to see net worth trend</p>`;
    return;
  }

  const data = history.map(h => ({
    month: h.month,
    label: formatMonthLabel(h.month),
    value: h.netWorth
  }));

  const width = container.clientWidth || 300;
  const height = 150;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const xStep = chartWidth / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padding.left + (i * xStep),
    y: padding.top + chartHeight - ((d.value - minValue) / range) * chartHeight,
    label: d.label,
    value: d.value
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Format large numbers for y-axis
  const formatAxisValue = (val) => {
    if (Math.abs(val) >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `£${(val / 1000).toFixed(0)}K`;
    return `£${val}`;
  };

  container.innerHTML = `
    <svg width="${width}" height="${height}" class="networth-chart-svg">
      <!-- Zero line if applicable -->
      ${minValue < 0 && maxValue > 0 ? `
        <line x1="${padding.left}" y1="${padding.top + chartHeight - ((0 - minValue) / range) * chartHeight}"
              x2="${width - padding.right}" y2="${padding.top + chartHeight - ((0 - minValue) / range) * chartHeight}"
              stroke="#e53e3e" stroke-width="1" stroke-dasharray="4"/>
      ` : ''}

      <!-- Area fill -->
      <path d="${areaD}" class="networth-area" />

      <!-- Line -->
      <path d="${pathD}" class="networth-line" />

      <!-- Data points -->
      ${points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" class="networth-point">
          <title>${p.label}: ${formatCurrency(p.value)}</title>
        </circle>
      `).join('')}

      <!-- Y-axis labels -->
      <text x="${padding.left - 8}" y="${padding.top + 4}" class="chart-label-y">${formatAxisValue(maxValue)}</text>
      <text x="${padding.left - 8}" y="${padding.top + chartHeight}" class="chart-label-y">${formatAxisValue(minValue)}</text>

      <!-- X-axis labels -->
      ${points.filter((_, i) => i === 0 || i === points.length - 1).map(p => `
        <text x="${p.x}" y="${height - 8}" class="chart-label-x">${escapeHtml(p.label)}</text>
      `).join('')}
    </svg>
  `;
}

// Initialize visual charts
function initVisualCharts() {
  updateVisualCharts();
}

// Update all visual charts
function updateVisualCharts() {
  const spendingDonutEl = document.querySelector("[data-spending-donut]");
  const assetPieEl = document.querySelector("[data-asset-pie]");
  const emergencyGaugeEl = document.querySelector("[data-emergency-gauge]");
  const incomeExpenseEl = document.querySelector("[data-income-expense]");
  const netWorthChartEl = document.querySelector("[data-networth-chart]");

  if (spendingDonutEl) renderSpendingDonut(spendingDonutEl);
  if (assetPieEl) renderAssetAllocation(assetPieEl);
  if (emergencyGaugeEl) renderEmergencyGauge(emergencyGaugeEl);
  if (incomeExpenseEl) renderIncomeVsExpenses(incomeExpenseEl);
  if (netWorthChartEl) renderNetWorthChart(netWorthChartEl);
}

// ============================================================
// GAMIFICATION & ACHIEVEMENTS
// ============================================================

const ACHIEVEMENTS_KEY = "consumerpay_achievements";
const CHALLENGES_KEY = "consumerpay_challenges";

// Badge definitions
const BADGES = {
  // Getting Started
  profileComplete: {
    id: "profileComplete",
    name: "Profile Complete",
    icon: "🎯",
    description: "Filled in all your basic financial details",
    category: "getting-started",
    tier: "bronze"
  },
  firstImport: {
    id: "firstImport",
    name: "Statement Imported",
    icon: "📄",
    description: "Imported your first bank statement",
    category: "getting-started",
    tier: "bronze"
  },
  firstGoal: {
    id: "firstGoal",
    name: "Goal Setter",
    icon: "🎯",
    description: "Created your first savings goal",
    category: "getting-started",
    tier: "bronze"
  },

  // Savings Milestones
  saved1k: {
    id: "saved1k",
    name: "First £1,000",
    icon: "💰",
    description: "Reached £1,000 in savings",
    category: "savings",
    tier: "bronze"
  },
  saved5k: {
    id: "saved5k",
    name: "£5K Saver",
    icon: "💰",
    description: "Reached £5,000 in savings",
    category: "savings",
    tier: "silver"
  },
  saved10k: {
    id: "saved10k",
    name: "Five Figures",
    icon: "🌟",
    description: "Reached £10,000 in savings",
    category: "savings",
    tier: "gold"
  },
  emergencyFund3: {
    id: "emergencyFund3",
    name: "Safety Net",
    icon: "🛡️",
    description: "Built 3 months of emergency savings",
    category: "savings",
    tier: "silver"
  },
  emergencyFund6: {
    id: "emergencyFund6",
    name: "Fully Protected",
    icon: "🏰",
    description: "Built 6 months of emergency savings",
    category: "savings",
    tier: "gold"
  },

  // Net Worth
  netWorth10k: {
    id: "netWorth10k",
    name: "£10K Club",
    icon: "📈",
    description: "Net worth reached £10,000",
    category: "networth",
    tier: "bronze"
  },
  netWorth50k: {
    id: "netWorth50k",
    name: "Halfway to 100K",
    icon: "🚀",
    description: "Net worth reached £50,000",
    category: "networth",
    tier: "silver"
  },
  netWorth100k: {
    id: "netWorth100k",
    name: "Six Figures",
    icon: "⭐",
    description: "Net worth reached £100,000",
    category: "networth",
    tier: "gold"
  },
  netWorthPositive: {
    id: "netWorthPositive",
    name: "In The Black",
    icon: "✅",
    description: "Achieved positive net worth",
    category: "networth",
    tier: "bronze"
  },

  // Debt Freedom
  creditCardFree: {
    id: "creditCardFree",
    name: "Card Crusher",
    icon: "💳",
    description: "Paid off all credit card debt",
    category: "debt",
    tier: "silver"
  },
  debtFree: {
    id: "debtFree",
    name: "Debt Free",
    icon: "🎊",
    description: "Paid off all consumer debt",
    category: "debt",
    tier: "gold"
  },

  // Health Score
  score50: {
    id: "score50",
    name: "Halfway There",
    icon: "📊",
    description: "Reached a health score of 50",
    category: "health",
    tier: "bronze"
  },
  score70: {
    id: "score70",
    name: "Strong Foundation",
    icon: "💪",
    description: "Reached a health score of 70",
    category: "health",
    tier: "silver"
  },
  score85: {
    id: "score85",
    name: "Financial Champion",
    icon: "🏆",
    description: "Reached a health score of 85",
    category: "health",
    tier: "gold"
  },

  // Streaks
  streak7: {
    id: "streak7",
    name: "Week Warrior",
    icon: "🔥",
    description: "7 consecutive days of tracking",
    category: "consistency",
    tier: "bronze"
  },
  streak30: {
    id: "streak30",
    name: "Monthly Master",
    icon: "🔥",
    description: "30 consecutive days of tracking",
    category: "consistency",
    tier: "silver"
  },
  streak90: {
    id: "streak90",
    name: "Quarter Champion",
    icon: "🔥",
    description: "90 consecutive days of tracking",
    category: "consistency",
    tier: "gold"
  },

  // Challenges
  challengeComplete: {
    id: "challengeComplete",
    name: "Challenge Accepted",
    icon: "🎮",
    description: "Completed your first monthly challenge",
    category: "challenges",
    tier: "bronze"
  },
  challenges5: {
    id: "challenges5",
    name: "Challenge Pro",
    icon: "🎖️",
    description: "Completed 5 monthly challenges",
    category: "challenges",
    tier: "silver"
  }
};

// Monthly challenges
const MONTHLY_CHALLENGES = [
  {
    id: "noSpendWeekend",
    name: "No-Spend Weekend",
    description: "Go a full weekend without spending money",
    icon: "🏠",
    points: 50,
    difficulty: "easy"
  },
  {
    id: "packLunchWeek",
    name: "Pack Lunch Week",
    description: "Bring lunch from home for 5 workdays",
    icon: "🥪",
    points: 75,
    difficulty: "easy"
  },
  {
    id: "subscriptionAudit",
    name: "Subscription Audit",
    description: "Review and cancel at least one unused subscription",
    icon: "📺",
    points: 100,
    difficulty: "medium"
  },
  {
    id: "savingsBoost",
    name: "Savings Boost",
    description: "Save 10% more than usual this month",
    icon: "📈",
    points: 150,
    difficulty: "medium"
  },
  {
    id: "cashOnlyWeek",
    name: "Cash Only Week",
    description: "Use only cash for all purchases for one week",
    icon: "💵",
    points: 100,
    difficulty: "medium"
  },
  {
    id: "billNegotiator",
    name: "Bill Negotiator",
    description: "Call a provider and negotiate a better rate",
    icon: "📞",
    points: 150,
    difficulty: "medium"
  },
  {
    id: "mealPrepSunday",
    name: "Meal Prep Master",
    description: "Prep all your weekday meals on Sunday",
    icon: "🍳",
    points: 75,
    difficulty: "easy"
  },
  {
    id: "financialCheckup",
    name: "Financial Checkup",
    description: "Review all your accounts and update balances",
    icon: "🔍",
    points: 100,
    difficulty: "medium"
  }
];

// Load achievements from storage
function loadAchievements() {
  try {
    const stored = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) { /* ignore */ }
  return {
    unlocked: [],
    streak: 0,
    lastVisit: null,
    totalPoints: 0,
    challengesCompleted: 0
  };
}

// Save achievements to storage
function saveAchievements(data) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

// Load active challenges
function loadChallenges() {
  try {
    const stored = localStorage.getItem(CHALLENGES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) { /* ignore */ }
  return {
    active: [],
    completed: [],
    month: null
  };
}

// Save challenges
function saveChallenges(data) {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

// Check and unlock achievements
function checkAchievements() {
  const achievements = loadAchievements();
  const newUnlocks = [];

  // Helper to unlock a badge
  const unlock = (badgeId) => {
    if (!achievements.unlocked.includes(badgeId) && BADGES[badgeId]) {
      achievements.unlocked.push(badgeId);
      achievements.totalPoints += getBadgePoints(BADGES[badgeId].tier);
      newUnlocks.push(BADGES[badgeId]);
    }
  };

  // Profile complete check
  if (state.annualSalary > 0 && state.income > 0 && calculateMonthlyExpenses() > 0) {
    unlock("profileComplete");
  }

  // First goal check
  if (state.goals && state.goals.length > 0) {
    unlock("firstGoal");
  }

  // Savings milestones
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  if (liquidAssets >= 1000) unlock("saved1k");
  if (liquidAssets >= 5000) unlock("saved5k");
  if (liquidAssets >= 10000) unlock("saved10k");

  // Emergency fund milestones
  const monthlyExpenses = calculateMonthlyExpenses();
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  if (monthsCovered >= 3) unlock("emergencyFund3");
  if (monthsCovered >= 6) unlock("emergencyFund6");

  // Net worth milestones
  const netWorth = calculateNetWorth();
  if (netWorth > 0) unlock("netWorthPositive");
  if (netWorth >= 10000) unlock("netWorth10k");
  if (netWorth >= 50000) unlock("netWorth50k");
  if (netWorth >= 100000) unlock("netWorth100k");

  // Debt freedom
  const creditCardDebt = state.liabilities.creditCardBalance || 0;
  const consumerDebt = creditCardDebt +
    (state.liabilities.personalLoansBalance || 0) +
    (state.liabilities.carFinanceBalance || 0) +
    (state.liabilities.overdraftBalance || 0);

  if (creditCardDebt === 0 && state.expenses.creditCards === 0) {
    unlock("creditCardFree");
  }
  if (consumerDebt === 0) {
    unlock("debtFree");
  }

  // Health score milestones
  const healthScore = calculateHealthScore();
  if (healthScore.total >= 50) unlock("score50");
  if (healthScore.total >= 70) unlock("score70");
  if (healthScore.total >= 85) unlock("score85");

  // Streak milestones
  if (achievements.streak >= 7) unlock("streak7");
  if (achievements.streak >= 30) unlock("streak30");
  if (achievements.streak >= 90) unlock("streak90");

  // Challenge milestones
  if (achievements.challengesCompleted >= 1) unlock("challengeComplete");
  if (achievements.challengesCompleted >= 5) unlock("challenges5");

  // Save and return new unlocks
  saveAchievements(achievements);
  return newUnlocks;
}

// Get points for badge tier
function getBadgePoints(tier) {
  const points = { bronze: 50, silver: 100, gold: 200 };
  return points[tier] || 50;
}

// Update streak tracking
function updateStreak() {
  const achievements = loadAchievements();
  const today = new Date().toDateString();

  if (achievements.lastVisit === today) {
    // Already visited today
    return achievements.streak;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (achievements.lastVisit === yesterday.toDateString()) {
    // Consecutive day - increase streak
    achievements.streak++;
  } else if (achievements.lastVisit !== today) {
    // Streak broken - reset
    achievements.streak = 1;
  }

  achievements.lastVisit = today;
  saveAchievements(achievements);

  return achievements.streak;
}

// Get current month's challenges
function getCurrentChallenges() {
  const currentMonth = getCurrentMonthKey();
  let challenges = loadChallenges();

  // Reset challenges for new month
  if (challenges.month !== currentMonth) {
    // Pick 3 random challenges for this month
    const shuffled = [...MONTHLY_CHALLENGES].sort(() => 0.5 - Math.random());
    challenges = {
      active: shuffled.slice(0, 3).map(c => ({
        ...c,
        status: "active",
        acceptedAt: null
      })),
      completed: [],
      month: currentMonth
    };
    saveChallenges(challenges);
  }

  return challenges;
}

// Accept a challenge
function acceptChallenge(challengeId) {
  const challenges = getCurrentChallenges();
  const challenge = challenges.active.find(c => c.id === challengeId);

  if (challenge && !challenge.acceptedAt) {
    challenge.acceptedAt = new Date().toISOString();
    challenge.status = "in-progress";
    saveChallenges(challenges);
    updateGamificationUI();
  }
}

// Complete a challenge
function completeChallenge(challengeId) {
  const challenges = getCurrentChallenges();
  const challengeIndex = challenges.active.findIndex(c => c.id === challengeId);

  if (challengeIndex >= 0) {
    const challenge = challenges.active[challengeIndex];
    challenge.status = "completed";
    challenge.completedAt = new Date().toISOString();

    challenges.active.splice(challengeIndex, 1);
    challenges.completed.push(challenge);
    saveChallenges(challenges);

    // Update achievements
    const achievements = loadAchievements();
    achievements.challengesCompleted++;
    achievements.totalPoints += challenge.points;
    saveAchievements(achievements);

    // Check for new badges
    const newBadges = checkAchievements();
    if (newBadges.length > 0) {
      showBadgeUnlock(newBadges[0]);
    }

    updateGamificationUI();
  }
}

// Show badge unlock celebration
function showBadgeUnlock(badge) {
  const modal = document.querySelector("[data-celebration-modal]");
  if (!modal) return;

  const iconEl = modal.querySelector("[data-celebration-icon]");
  const titleEl = modal.querySelector("[data-celebration-title]");
  const messageEl = modal.querySelector("[data-celebration-message]");
  const badgeNameEl = modal.querySelector("[data-badge-name]");
  const badgeDescEl = modal.querySelector("[data-badge-desc]");
  const badgeIconEl = modal.querySelector(".badge-icon");

  if (iconEl) iconEl.textContent = badge.icon;
  if (titleEl) titleEl.textContent = "Badge Unlocked!";
  if (messageEl) messageEl.textContent = badge.name;
  if (badgeNameEl) badgeNameEl.textContent = badge.name;
  if (badgeDescEl) badgeDescEl.textContent = badge.description;
  if (badgeIconEl) badgeIconEl.textContent = badge.icon;

  // Hide stats for badge unlock
  const statsEl = modal.querySelector("[data-celebration-stats]");
  if (statsEl) statsEl.style.display = "none";

  modal.hidden = false;

  // Trigger confetti
  triggerConfetti();
}

// Trigger confetti animation
function triggerConfetti() {
  const container = document.querySelector("[data-confetti-container]");
  if (!container) return;

  // Create confetti pieces
  const colors = ["#259d91", "#f4c542", "#e86c5f", "#9f7aea", "#48bb78"];
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti-piece";
    confetti.style.left = Math.random() * 100 + "%";
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + "s";
    confetti.style.animationDuration = (Math.random() * 2 + 2) + "s";
    container.appendChild(confetti);

    // Remove after animation
    setTimeout(() => confetti.remove(), 4000);
  }
}

// Initialize gamification
function initGamification() {
  // Update streak
  const streak = updateStreak();

  // Check for achievements
  const newBadges = checkAchievements();

  // Show first new badge if any
  if (newBadges.length > 0) {
    setTimeout(() => showBadgeUnlock(newBadges[0]), 1000);
  }

  // Load challenges
  getCurrentChallenges();

  // Update UI
  updateGamificationUI();

  // Setup challenge buttons
  document.querySelectorAll("[data-accept-challenge]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-accept-challenge");
      acceptChallenge(id);
    });
  });

  document.querySelectorAll("[data-complete-challenge]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-complete-challenge");
      completeChallenge(id);
    });
  });
}

// Update gamification UI elements
function updateGamificationUI() {
  const achievements = loadAchievements();
  const challenges = getCurrentChallenges();

  // Update streak display
  const streakEl = document.querySelector("[data-streak-count]");
  if (streakEl) {
    streakEl.textContent = achievements.streak;
  }

  // Update points display
  const pointsEl = document.querySelector("[data-total-points]");
  if (pointsEl) {
    pointsEl.textContent = achievements.totalPoints;
  }

  // Update badges display
  const badgesListEl = document.querySelector("[data-badges-list]");
  if (badgesListEl) {
    const unlockedBadges = achievements.unlocked
      .map(id => BADGES[id])
      .filter(Boolean)
      .slice(-8); // Show last 8

    if (unlockedBadges.length === 0) {
      badgesListEl.innerHTML = `<p class="no-badges">Complete actions to unlock badges</p>`;
    } else {
      badgesListEl.innerHTML = unlockedBadges.map(badge => `
        <div class="badge-item ${badge.tier}">
          <span class="badge-icon">${badge.icon}</span>
          <span class="badge-name">${escapeHtml(badge.name)}</span>
        </div>
      `).join("");
    }
  }

  // Update badges count
  const badgesCountEl = document.querySelector("[data-badges-count]");
  if (badgesCountEl) {
    badgesCountEl.textContent = `${achievements.unlocked.length}/${Object.keys(BADGES).length}`;
  }

  // Update challenges display
  const challengesListEl = document.querySelector("[data-challenges-list]");
  if (challengesListEl) {
    challengesListEl.innerHTML = challenges.active.map(challenge => `
      <div class="challenge-card ${challenge.status}">
        <span class="challenge-icon">${challenge.icon}</span>
        <div class="challenge-info">
          <h4>${escapeHtml(challenge.name)}</h4>
          <p>${escapeHtml(challenge.description)}</p>
          <span class="challenge-points">+${challenge.points} pts</span>
        </div>
        <div class="challenge-actions">
          ${challenge.status === "active" ? `
            <button class="btn small" type="button" onclick="acceptChallenge('${challenge.id}')">Accept</button>
          ` : challenge.status === "in-progress" ? `
            <button class="btn small primary" type="button" onclick="completeChallenge('${challenge.id}')">Complete</button>
          ` : ""}
        </div>
      </div>
    `).join("");
  }
}

// ============================================================
// STATEMENT IMPORT FEATURE
// ============================================================

const IMPORT_STORAGE_KEY = "consumerpay_import_history";
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

// HTML escape function to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Merchant to category mapping for smart categorization
const MERCHANT_CATEGORIES = {
  // Groceries
  tesco: "groceries", sainsburys: "groceries", asda: "groceries", aldi: "groceries",
  lidl: "groceries", morrisons: "groceries", waitrose: "groceries", coop: "groceries",
  iceland: "groceries", ocado: "groceries", marks: "groceries",

  // Dining
  mcdonalds: "diningOut", "mcdonald's": "diningOut", "burger king": "diningOut",
  kfc: "diningOut", subway: "diningOut", nandos: "diningOut", "nando's": "diningOut",
  starbucks: "coffeeSnacks", costa: "coffeeSnacks", pret: "coffeeSnacks",
  greggs: "coffeeSnacks", deliveroo: "diningOut", "uber eats": "diningOut",
  "just eat": "diningOut",

  // Transport
  uber: "publicTransport", bolt: "publicTransport", tfl: "publicTransport",
  oyster: "publicTransport", trainline: "publicTransport", national: "publicTransport",
  shell: "fuel", bp: "fuel", esso: "fuel", texaco: "fuel", "ev charging": "fuel",
  tesla: "fuel", gridserve: "fuel", ionity: "fuel",

  // Utilities
  british: "energy", edf: "energy", octopus: "energy", ovo: "energy",
  bulb: "energy", scottish: "energy", sse: "energy", "e.on": "energy",
  thames: "water", severn: "water", united: "water", anglian: "water",
  bt: "internet", sky: "internet", virgin: "internet", ee: "internet",
  vodafone: "internet", three: "internet", o2: "internet", plusnet: "internet",
  netflix: "streaming", spotify: "streaming", apple: "streaming", disney: "streaming",
  "prime video": "streaming", youtube: "streaming",

  // Housing
  rightmove: "mortgage", zoopla: "mortgage", "direct debit": "mortgage",
  council: "councilTax", aviva: "homeInsurance", "direct line": "homeInsurance",

  // Personal & Shopping
  amazon: "entertainment", ebay: "entertainment", argos: "entertainment",
  john: "clothing", next: "clothing", primark: "clothing", asos: "clothing",
  zara: "clothing", "h&m": "clothing", boots: "personalCare", superdrug: "personalCare",
  gym: "gym", puregym: "gym", "the gym": "gym", nuffield: "gym", david: "gym",

  // Subscriptions
  subscription: "subscriptions", membership: "subscriptions", monthly: "subscriptions",

  // Family
  nursery: "childcare", childminder: "childcare", childcare: "childcare",
  school: "schoolCosts", uniform: "schoolCosts",

  // Debt
  loan: "personalLoans", credit: "creditCards", barclaycard: "creditCards",
  amex: "creditCards", "american express": "creditCards",
};

// UK Bank CSV formats
const BANK_FORMATS = {
  monzo: {
    dateCol: "Date",
    descCol: "Name",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  starling: {
    dateCol: "Date",
    descCol: "Counter Party",
    amountCol: "Amount (GBP)",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  hsbc: {
    dateCol: "Date",
    descCol: "Description",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  barclays: {
    dateCol: "Date",
    descCol: "Memo",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  natwest: {
    dateCol: "Date",
    descCol: "Description",
    amountCol: "Value",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  lloyds: {
    dateCol: "Transaction Date",
    descCol: "Transaction Description",
    debitCol: "Debit Amount",
    creditCol: "Credit Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  santander: {
    dateCol: "Date",
    descCol: "Description",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  revolut: {
    dateCol: "Started Date",
    descCol: "Description",
    amountCol: "Amount",
    dateFormat: "YYYY-MM-DD",
    delimiter: ","
  }
};

// Current import state
let importedTransactions = [];
let currentFilter = "all";

// Initialize import functionality
function initStatementImport() {
  const dropzone = document.querySelector("[data-import-dropzone]");
  const fileInput = document.querySelector("[data-import-file]");
  const modal = document.querySelector("[data-import-modal]");

  if (!dropzone || !fileInput) return;

  // Click to upload
  dropzone.addEventListener("click", () => fileInput.click());

  // File selection
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  // Drag and drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Modal controls
  document.querySelector("[data-import-close]")?.addEventListener("click", closeImportModal);
  document.querySelector("[data-import-cancel]")?.addEventListener("click", closeImportModal);
  document.querySelector("[data-import-apply]")?.addEventListener("click", applyImportedTransactions);
  document.querySelector("[data-import-select-all]")?.addEventListener("click", selectAllTransactions);
  document.querySelector("[data-import-deselect-all]")?.addEventListener("click", deselectAllTransactions);

  // Filter buttons
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTransactions();
    });
  });

  // Load import history
  renderImportHistory();
}

// Handle uploaded files
async function handleFiles(files) {
  const modal = document.querySelector("[data-import-modal]");
  const progressEl = document.querySelector("[data-import-progress]");
  const summaryEl = document.querySelector("[data-import-summary]");
  const transactionsEl = document.querySelector("[data-import-transactions]");

  modal.hidden = false;
  progressEl.hidden = false;
  summaryEl.hidden = true;
  transactionsEl.style.display = "none";

  importedTransactions = [];

  for (const file of files) {
    const filenameEl = document.querySelector("[data-import-filename]");
    if (filenameEl) filenameEl.textContent = file.name;
    updateProgress(0, `Processing ${escapeHtml(file.name)}...`);

    // File size validation
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      updateProgress(100, `File ${escapeHtml(file.name)} exceeds 10MB limit. Please use a smaller file.`);
      continue;
    }

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      let transactions = [];

      if (ext === "csv") {
        transactions = await parseCSV(file);
      } else if (ext === "xlsx" || ext === "xls") {
        transactions = await parseExcel(file);
      } else if (ext === "pdf") {
        transactions = await parsePDF(file);
      }

      importedTransactions = importedTransactions.concat(transactions);

    } catch (error) {
      console.error("Error parsing file:", error);
      updateProgress(100, `Error parsing ${escapeHtml(file.name)}: ${escapeHtml(error.message)}`);
    }
  }

  // Categorize and detect recurring
  importedTransactions = categorizeTransactions(importedTransactions);
  importedTransactions = detectRecurringPayments(importedTransactions);

  // Update UI
  progressEl.hidden = true;
  summaryEl.hidden = false;
  transactionsEl.style.display = "flex";

  updateImportSummary();
  renderTransactions();
}

// Update progress bar
function updateProgress(percent, text) {
  const fill = document.querySelector("[data-progress-fill]");
  const textEl = document.querySelector("[data-progress-text]");
  if (fill) fill.style.width = `${percent}%`;
  if (textEl) textEl.textContent = text;
}

// Parse CSV file
async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          resolve([]);
          return;
        }

        // Detect bank format from headers
        const headers = parseCSVLine(lines[0]);
        const format = detectBankFormat(headers);

        updateProgress(20, "Detected format, parsing transactions...");

        const transactions = [];
        for (let i = 1; i < lines.length; i++) {
          // Throttle progress updates (every 50 rows) to prevent UI freeze
          if (i % 50 === 0 || i === lines.length - 1) {
            updateProgress(20 + (i / lines.length) * 60, `Parsing row ${i} of ${lines.length - 1}...`);
          }

          const values = parseCSVLine(lines[i]);
          if (values.length < headers.length) continue;

          const row = {};
          headers.forEach((h, idx) => {
            row[h.trim()] = values[idx]?.trim() || "";
          });

          const tx = extractTransaction(row, format);
          if (tx && tx.amount !== 0) {
            transactions.push(tx);
          }
        }

        updateProgress(90, "Finalizing...");
        resolve(transactions);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Detect bank format from CSV headers
function detectBankFormat(headers) {
  const headerStr = headers.join(",").toLowerCase();

  if (headerStr.includes("counter party")) return BANK_FORMATS.starling;
  if (headerStr.includes("started date")) return BANK_FORMATS.revolut;
  if (headerStr.includes("transaction description") && headerStr.includes("debit amount")) return BANK_FORMATS.lloyds;
  if (headerStr.includes("memo")) return BANK_FORMATS.barclays;
  if (headerStr.includes("value") && headerStr.includes("date")) return BANK_FORMATS.natwest;

  // Default generic format
  return {
    dateCol: headers.find((h) => h.toLowerCase().includes("date")) || headers[0],
    descCol: headers.find((h) => h.toLowerCase().includes("desc") || h.toLowerCase().includes("name") || h.toLowerCase().includes("memo")) || headers[1],
    amountCol: headers.find((h) => h.toLowerCase().includes("amount") || h.toLowerCase().includes("value")) || headers[2],
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  };
}

// Extract transaction from row
function extractTransaction(row, format) {
  let date = row[format.dateCol] || Object.values(row)[0];
  let desc = row[format.descCol] || Object.values(row)[1];
  let amount = 0;

  // Handle separate debit/credit columns (Lloyds)
  if (format.creditCol && format.debitCol) {
    const credit = parseFloat((row[format.creditCol] || "0").replace(/[£,]/g, "")) || 0;
    const debit = parseFloat((row[format.debitCol] || "0").replace(/[£,]/g, "")) || 0;
    amount = credit - debit;
  } else if (format.debitCol) {
    const debit = parseFloat((row[format.debitCol] || "0").replace(/[£,]/g, "")) || 0;
    const credit = parseFloat((row[format.creditCol] || "0").replace(/[£,]/g, "")) || 0;
    amount = credit > 0 ? credit : -debit;
  } else {
    amount = parseFloat((row[format.amountCol] || "0").replace(/[£,]/g, "")) || 0;
  }

  // Parse date
  const parsedDate = parseDate(date);

  return {
    id: Math.random().toString(36).substr(2, 9),
    date: parsedDate,
    description: desc,
    amount: amount,
    type: amount >= 0 ? "income" : "expense",
    category: null,
    isRecurring: false,
    selected: true
  };
}

// Parse date from various formats
function parseDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split("T")[0];

  // Try common UK format DD/MM/YYYY
  const ukMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    let year = ukMatch[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }

  // Try ISO format YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  // Fallback
  const d = new Date(dateStr);
  return isNaN(d) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
}

// Parse Excel file
async function parseExcel(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === "undefined") {
      reject(new Error("Excel parsing library not loaded"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        updateProgress(20, "Reading Excel file...");

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        updateProgress(40, "Parsing sheets...");

        const transactions = [];
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        const headers = rows[0].map((h) => String(h || ""));
        const format = detectBankFormat(headers);

        for (let i = 1; i < rows.length; i++) {
          updateProgress(40 + (i / rows.length) * 50, `Processing row ${i}...`);

          const row = {};
          headers.forEach((h, idx) => {
            row[h] = rows[i][idx] !== undefined ? String(rows[i][idx]) : "";
          });

          const tx = extractTransaction(row, format);
          if (tx && tx.amount !== 0) {
            transactions.push(tx);
          }
        }

        resolve(transactions);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read Excel file"));
    reader.readAsArrayBuffer(file);
  });
}

// Parse PDF file (handles unstructured PDFs like Virgin Media bills)
async function parsePDF(file) {
  return new Promise(async (resolve, reject) => {
    if (typeof pdfjsLib === "undefined") {
      reject(new Error("PDF parsing library not loaded"));
      return;
    }

    try {
      updateProgress(10, "Loading PDF...");

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      updateProgress(30, "Extracting text...");

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        updateProgress(30 + (i / pdf.numPages) * 40, `Reading page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      updateProgress(75, "Extracting transactions...");

      // Extract transactions using pattern matching
      const transactions = extractTransactionsFromText(fullText);

      updateProgress(95, "Finalizing...");
      resolve(transactions);

    } catch (err) {
      reject(err);
    }
  });
}

// Extract transactions from unstructured text (for PDFs like Virgin Media)
function extractTransactionsFromText(text) {
  const transactions = [];

  // Pattern for amounts: £X,XXX.XX or £X.XX or -£X.XX
  const amountPattern = /[-]?£[\d,]+\.?\d{0,2}/g;

  // Pattern for dates
  const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g;

  // Find all amounts
  const amounts = text.match(amountPattern) || [];
  const dates = text.match(datePattern) || [];

  // Extract lines that contain amounts
  const lines = text.split(/\n|\r/).filter((line) => amountPattern.test(line));

  lines.forEach((line, idx) => {
    const lineAmounts = line.match(amountPattern);
    if (!lineAmounts || lineAmounts.length === 0) return;

    // Get the primary amount (usually the last one on the line)
    const amountStr = lineAmounts[lineAmounts.length - 1];
    const amount = parseFloat(amountStr.replace(/[£,]/g, "")) || 0;

    if (amount === 0) return;

    // Extract description (text before the amount)
    let desc = line.replace(amountPattern, "").trim();
    desc = desc.replace(datePattern, "").trim();
    desc = desc.replace(/\s+/g, " ").trim();

    // Skip very short or numeric-only descriptions
    if (desc.length < 3 || /^\d+$/.test(desc)) {
      desc = "Unknown Transaction";
    }

    // Try to find a date in this line or nearby
    const lineDates = line.match(datePattern);
    const dateStr = lineDates ? lineDates[0] : (dates[idx] || null);

    transactions.push({
      id: Math.random().toString(36).substr(2, 9),
      date: parseDate(dateStr),
      description: desc.substring(0, 100),
      amount: amount,
      type: amount >= 0 ? "income" : "expense",
      category: null,
      isRecurring: false,
      selected: true
    });
  });

  // Remove duplicates
  const seen = new Set();
  return transactions.filter((tx) => {
    const key = `${tx.date}-${tx.amount}-${tx.description.substring(0, 20)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Categorize transactions using merchant mapping
function categorizeTransactions(transactions) {
  return transactions.map((tx) => {
    const descLower = tx.description.toLowerCase();

    for (const [keyword, category] of Object.entries(MERCHANT_CATEGORIES)) {
      if (descLower.includes(keyword)) {
        tx.category = category;
        break;
      }
    }

    return tx;
  });
}

// Detect recurring payments
function detectRecurringPayments(transactions) {
  // Group by similar descriptions
  const groups = {};

  transactions.forEach((tx) => {
    // Normalize description for grouping
    const normalized = tx.description.toLowerCase()
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 30);

    if (!groups[normalized]) {
      groups[normalized] = [];
    }
    groups[normalized].push(tx);
  });

  // Mark as recurring if similar transaction appears 2+ times with similar amounts
  Object.values(groups).forEach((group) => {
    if (group.length >= 2) {
      // Check if amounts are similar (within 10%)
      const amounts = group.map((tx) => Math.abs(tx.amount));
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      // Guard against division by zero
      const allSimilar = avg > 0 && amounts.every((a) => Math.abs(a - avg) / avg < 0.1);

      if (allSimilar) {
        group.forEach((tx) => {
          tx.isRecurring = true;
        });
      }
    }
  });

  return transactions;
}

// Update import summary stats
function updateImportSummary() {
  const total = importedTransactions.length;
  const income = importedTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expense = importedTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const recurring = importedTransactions.filter((tx) => tx.isRecurring).length;

  document.querySelector("[data-import-total]").textContent = total;
  document.querySelector("[data-import-income]").textContent = formatCurrency(income);
  document.querySelector("[data-import-expense]").textContent = formatCurrency(expense);
  document.querySelector("[data-import-recurring]").textContent = recurring;
}

// Render transactions in the modal
function renderTransactions() {
  const list = document.querySelector("[data-transaction-list]");
  if (!list) return;

  // Filter transactions
  let filtered = importedTransactions;
  if (currentFilter === "income") {
    filtered = importedTransactions.filter((tx) => tx.type === "income");
  } else if (currentFilter === "expense") {
    filtered = importedTransactions.filter((tx) => tx.type === "expense");
  } else if (currentFilter === "recurring") {
    filtered = importedTransactions.filter((tx) => tx.isRecurring);
  } else if (currentFilter === "uncategorized") {
    filtered = importedTransactions.filter((tx) => !tx.category);
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="import-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>No transactions match this filter</p>
      </div>
    `;
    return;
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = filtered.map((tx) => {
    const categoryOptions = Object.keys(state.expenses).map((key) =>
      `<option value="${key}" ${tx.category === key ? "selected" : ""}>${escapeHtml(formatExpenseLabel(key))}</option>`
    ).join("");

    return `
      <div class="transaction-item ${tx.type} ${tx.isRecurring ? "recurring" : ""}" data-tx-id="${escapeHtml(tx.id)}">
        <input type="checkbox" class="transaction-checkbox" ${tx.selected ? "checked" : ""} data-tx-checkbox="${escapeHtml(tx.id)}">
        <div class="transaction-details">
          <span class="transaction-name">${escapeHtml(tx.description)}</span>
          <div class="transaction-meta">
            <span>${escapeHtml(formatDateDisplay(tx.date))}</span>
            ${tx.isRecurring ? '<span class="recurring-badge">Recurring</span>' : ""}
          </div>
        </div>
        <div class="transaction-category">
          <select data-tx-category="${escapeHtml(tx.id)}">
            <option value="">Uncategorized</option>
            ${categoryOptions}
          </select>
        </div>
        <span class="transaction-amount ${tx.amount >= 0 ? "positive" : "negative"}">
          ${tx.amount >= 0 ? "+" : ""}${formatCurrency(tx.amount)}
        </span>
      </div>
    `;
  }).join("");

  // Attach event listeners
  list.querySelectorAll("[data-tx-checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const txId = e.target.dataset.txCheckbox;
      const tx = importedTransactions.find((t) => t.id === txId);
      if (tx) tx.selected = e.target.checked;
    });
  });

  list.querySelectorAll("[data-tx-category]").forEach((select) => {
    select.addEventListener("change", (e) => {
      const txId = e.target.dataset.txCategory;
      const tx = importedTransactions.find((t) => t.id === txId);
      if (tx) tx.category = e.target.value || null;
    });
  });
}

// Format expense key as label
function formatExpenseLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}

// Format date for display
function formatDateDisplay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Select/deselect all transactions
function selectAllTransactions() {
  importedTransactions.forEach((tx) => tx.selected = true);
  renderTransactions();
}

function deselectAllTransactions() {
  importedTransactions.forEach((tx) => tx.selected = false);
  renderTransactions();
}

// Apply imported transactions to the app's expenses
function applyImportedTransactions() {
  const selectedTx = importedTransactions.filter((tx) => tx.selected && tx.category && tx.type === "expense");

  if (selectedTx.length === 0) {
    alert("Please select transactions with categories to apply.");
    return;
  }

  // Aggregate expenses by category
  const categoryTotals = {};
  selectedTx.forEach((tx) => {
    if (!categoryTotals[tx.category]) {
      categoryTotals[tx.category] = 0;
    }
    categoryTotals[tx.category] += Math.abs(tx.amount);
  });

  // Calculate monthly averages if we have multiple months
  const dates = selectedTx.map((tx) => new Date(tx.date));
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const monthSpan = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));

  // Apply to state
  Object.entries(categoryTotals).forEach(([category, total]) => {
    const monthlyAvg = Math.round(total / monthSpan);
    if (state.expenses[category] !== undefined) {
      state.expenses[category] = monthlyAvg;
      // Update the form input
      const input = document.querySelector(`[data-expense="${category}"]`);
      if (input) input.value = monthlyAvg;
    }
  });

  // Save import to history
  saveImportHistory({
    filename: document.querySelector("[data-import-filename]").textContent,
    date: new Date().toISOString(),
    transactionCount: selectedTx.length,
    totalAmount: Object.values(categoryTotals).reduce((a, b) => a + b, 0)
  });

  // Update app
  saveLocalState();
  updateSummary();
  updateSmartInsights();

  closeImportModal();

  // Show confirmation
  alert(`Successfully imported ${selectedTx.length} transactions into your budget!`);
}

// Close import modal
function closeImportModal() {
  const modal = document.querySelector("[data-import-modal]");
  if (modal) modal.hidden = true;
  importedTransactions = [];
  currentFilter = "all";
}

// Save import to history
function saveImportHistory(entry) {
  const history = JSON.parse(localStorage.getItem(IMPORT_STORAGE_KEY) || "[]");
  history.unshift(entry);
  // Keep only last 10 imports
  localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
  renderImportHistory();
}

// Render import history
function renderImportHistory() {
  const list = document.querySelector("[data-import-history-list]");
  if (!list) return;

  let history = [];
  try {
    const stored = localStorage.getItem(IMPORT_STORAGE_KEY);
    const parsed = JSON.parse(stored || "[]");
    if (Array.isArray(parsed)) history = parsed;
  } catch (e) {
    console.warn("Invalid import history, resetting");
    localStorage.removeItem(IMPORT_STORAGE_KEY);
  }

  if (history.length === 0) {
    list.innerHTML = '<p class="muted">No imports yet. Upload a file to get started.</p>';
    return;
  }

  list.innerHTML = history.map((entry) => `
    <div class="import-history-item">
      <div class="import-history-info">
        <strong>${escapeHtml(entry.filename || 'Unknown')}</strong>
        <span class="muted">${escapeHtml(formatDateDisplay(entry.date))}</span>
      </div>
      <div class="import-history-stats">
        <span>${entry.transactionCount} transactions</span>
        <span>${formatCurrency(entry.totalAmount)}</span>
      </div>
    </div>
  `).join("");
}

// ============================================================
// END STATEMENT IMPORT FEATURE
// ============================================================

attachEventListeners();
init();

// Initialize statement import after DOM is ready
document.addEventListener("DOMContentLoaded", initStatementImport);
