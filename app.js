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
  height: 360,
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

let screens = [];
let steps = [];
let currentIndex = 0;

const defaultState = {
  name: "",
  currentAge: 0,
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

  // === PHASE 1: BILL CALENDAR ===
  bills: [],  // Array of {id, name, amount, category, dueDay, frequency, isPaid, lastPaidDate}

  // === PHASE 1: MANUAL TRANSACTIONS ===
  transactions: [],  // Array of {id, date, amount, category, description, type, paymentMethod}

  // === PHASE 1: DEBT PAYOFF ===
  debts: [],  // Array of {id, name, balance, interestRate, minPayment, category}
};

const state = {
  ...defaultState,
  expenses: { ...defaultState.expenses },
  assets: { ...defaultState.assets },
  liabilities: { ...defaultState.liabilities },
  creditScore: { ...defaultState.creditScore },
  insurance: { ...defaultState.insurance },
  healthScoreHistory: [],
  bills: [],
  transactions: [],
  debts: [],
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

// Core utility helpers (formatCurrency, escapeHtml, setTextAll, etc.)
// are defined in app-core.js and attached to window.

// Notifications live in app-notifications.js.
// Validation and accessibility helpers live in app-validation-a11y.js.

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  try {
    const generated = generateSecureId('device');
    localStorage.setItem(DEVICE_KEY, generated);
    return generated;
  } catch (e) {
    console.error('Failed to generate secure device ID:', e);
    return 'device-unknown';
  }
}

// Budget and tax helpers live in app-budget.js.
// State sanitization and persistence live in app-state.js.

// Screen navigation, summary, and form sync live in app-ui-core.js.
// App-level event wiring lives in app-events.js.

// Goal list, dashboard visibility, and income breakdown have been extracted
// to app-goals.js.

// Cashflow, vulnerability panel, and alert list have been extracted to
// app-cashflow.js, app-protection.js, and app-alerts.js.

// Monte Carlo simulation has been extracted to app-simulation.js.

// Future scenario and currency conversion have been extracted to
// app-future.js and app-currency.js.

// Firebase helpers live in app-firebase.js.

// Smart insights now live in app-smart-insights.js.

// =============================================
// ENGAGEMENT FEATURES
// =============================================

// Money Mood Tracker
// Mood tracker extracted to app-mood.js.
// Learn hub extracted to app-learn.js.
// Celebrations extracted to app-celebrations.js.
// Budget planner extracted to app-planner.js.
let __goalListHooked = false;
function hookUpdateGoalList() {
  if (__goalListHooked || typeof updateGoalList !== "function") return;
  const baseUpdateGoalList = updateGoalList;
  updateGoalList = function wrappedUpdateGoalList(...args) {
    const result = baseUpdateGoalList.apply(this, args);
    if (typeof checkGoalMilestones === "function") {
      checkGoalMilestones();
    }
    return result;
  };
  __goalListHooked = true;
}

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
// Financial health extracted to app-health.js.
// Smart insights extracted to app-smart-insights.js.
// Score history extracted to app-score-history.js.
// Visual charts extracted to app-charts.js.
// Gamification extracted to app-gamification.js.
// Statement import extracted to app-import-parse.js and app-import.js.
// ============================================================

// ============================================================
// Bill calendar extracted to app-bills.js.
// Debt payoff extracted to app-debts.js.
// Manual transactions extracted to app-transactions.js.
// END PHASE 1 FEATURES
// ============================================================

// ============================================================
// Spending limits extracted to app-spending-limits.js.
// Income sources extracted to app-income.js.
// Spending forecast extracted to app-spending-forecast.js.
// END PHASE 2 FEATURES
// ============================================================

// ============================================================
// Household features extracted to app-household.js.
// END PHASE 3 FEATURES
// ============================================================

// ============================================================
// Tax and retirement extracted to app-tax-retirement.js.
// END PHASE 4 FEATURES
// ============================================================

let __poapymentsDomReady = false;
let __poapymentsScriptsReady = false;
let __poapymentsInitStarted = false;

function runInitializer(fn, name) {
  if (typeof fn !== "function") {
    console.warn(`Initializer missing: ${name}`);
    return;
  }
  try {
    fn();
  } catch (error) {
    console.error(`Initializer failed: ${name}`, error);
  }
}

// Critical functions that must be available before initialization
const CRITICAL_DEPENDENCIES = [
  'formatCurrency',
  'escapeHtml',
  'loadLocalState',
  'saveLocalState',
  'applyState',
  'attachEventListeners',
  'syncFormFromState',
  'showInitialScreen',
  'updateSummary',
  'updateCashflowInsights',
];

let __dependencyRetryCount = 0;
const MAX_DEPENDENCY_RETRIES = 50; // 50 * 50ms = 2.5s max wait

function checkDependencies() {
  const missing = CRITICAL_DEPENDENCIES.filter(fn => typeof window[fn] !== 'function');
  return { ready: missing.length === 0, missing };
}

function initializePoapyments() {
  if (__poapymentsInitStarted) return;

  const loaderActive = Boolean(window.__poapymentsLoaderActive);
  const canInit = loaderActive ? __poapymentsScriptsReady : (__poapymentsScriptsReady || __poapymentsDomReady);
  if (!canInit) return;

  // Check that all critical dependencies are loaded
  const { ready, missing } = checkDependencies();
  if (!ready) {
    __dependencyRetryCount++;
    if (__dependencyRetryCount < MAX_DEPENDENCY_RETRIES) {
      console.debug(`Waiting for modules: ${missing.join(', ')} (attempt ${__dependencyRetryCount})`);
      setTimeout(initializePoapyments, 50);
      return;
    }
    console.error(`Initialization timeout: missing dependencies - ${missing.join(', ')}`);
    const errorHost = document.querySelector('[data-screen="app"]') || document.body;
    const errorBanner = document.createElement('div');
    errorBanner.style.cssText = 'background:#fef2f2;color:#991b1b;padding:12px 16px;border-radius:8px;margin:8px;font-size:14px;';
    errorBanner.textContent = `Some features may not work. Missing modules: ${missing.join(', ')}`;
    errorHost.prepend(errorBanner);
  }

  __poapymentsInitStarted = true;

  // Populate DOM references now that the document is fully parsed.
  screens = Array.from(document.querySelectorAll("[data-screen]"));
  steps = Array.from(document.querySelectorAll("[data-step]"));

  // Apply hooks after all feature scripts have loaded.
  hookUpdateGoalList();

  attachEventListeners();
  init()
    .then(() => {
      window.appInitialized = true;
    })
    .catch((error) => {
      console.error("App initialization failed:", error);
      window.appInitialized = false;
    });

  // Core widgets
  runInitializer(initQuickActionsWidget, "initQuickActionsWidget");
  runInitializer(initStatementActionsWidget, "initStatementActionsWidget");

  // Phase 1
  runInitializer(initStatementImport, "initStatementImport");
  runInitializer(initBillCalendar, "initBillCalendar");
  runInitializer(initDebtPayoff, "initDebtPayoff");
  runInitializer(initTransactions, "initTransactions");
  // Phase 2
  runInitializer(initSpendingLimits, "initSpendingLimits");
  runInitializer(initIncomeSources, "initIncomeSources");
  runInitializer(initSpendingForecast, "initSpendingForecast");
  // Phase 3
  runInitializer(initHousehold, "initHousehold");
  // Phase 4
  runInitializer(initPhase4, "initPhase4");

  // Ensure one full refresh after all initializers run.
  updateSummary();
}

document.addEventListener("DOMContentLoaded", () => {
  __poapymentsDomReady = true;
  initializePoapyments();
});

document.addEventListener("poapyments:scripts-ready", () => {
  __poapymentsScriptsReady = true;
  initializePoapyments();
});
