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

const GOAL_COLORS = [
  "#2a9d8f", // sea
  "#e76f51", // coral
  "#f4b83f", // sun
  "#7c3aed", // purple
  "#6a994e", // leaf
  "#1d3557", // navy
  "#e63946", // red
  "#457b9d", // blue
];

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

// Scottish tax rates 2024/25
const SCOTTISH_TAX = {
  starterRate: 0.19,
  starterLimit: 14876,
  basicRate: 0.20,
  basicLimit: 26561,
  intermediateRate: 0.21,
  intermediateLimit: 43662,
  higherRate: 0.42,
  higherLimit: 75000,
  advancedRate: 0.45,
  advancedLimit: 125140,
  topRate: 0.48,
};

// Parse UK tax code to extract allowance and flags
function parseTaxCode(code) {
  if (!code) return { allowance: UK_TAX.personalAllowance, isScottish: false, isWelsh: false, isEmergency: false, specialCode: null };

  const cleaned = code.toUpperCase().replace(/\s+/g, "").replace(/W1$|M1$|X$/i, "");
  const isEmergency = /W1$|M1$|X$/i.test(code.toUpperCase());
  const isScottish = cleaned.startsWith("S");
  const isWelsh = cleaned.startsWith("C");
  const taxCode = cleaned.replace(/^[SC]/, "");

  // Special codes with no personal allowance
  if (taxCode === "BR") return { allowance: 0, isScottish, isWelsh, isEmergency, specialCode: "BR", description: "Basic rate on all income" };
  if (taxCode === "D0") return { allowance: 0, isScottish, isWelsh, isEmergency, specialCode: "D0", description: "Higher rate (40%) on all income" };
  if (taxCode === "D1") return { allowance: 0, isScottish, isWelsh, isEmergency, specialCode: "D1", description: "Additional rate (45%) on all income" };
  if (taxCode === "NT") return { allowance: Infinity, isScottish, isWelsh, isEmergency, specialCode: "NT", description: "No tax deducted" };
  if (taxCode === "0T") return { allowance: 0, isScottish, isWelsh, isEmergency, specialCode: "0T", description: "No personal allowance" };

  // K codes (negative allowance - you owe tax on benefits)
  const kMatch = taxCode.match(/^K(\d+)$/);
  if (kMatch) {
    const negativeAllowance = parseInt(kMatch[1], 10) * 10 * -1;
    return { allowance: negativeAllowance, isScottish, isWelsh, isEmergency, specialCode: "K", description: "Tax code includes benefits/debts" };
  }

  // Standard codes (1257L, 1185L, etc.)
  const standardMatch = taxCode.match(/^(\d+)[LMNPTY]$/);
  if (standardMatch) {
    const allowance = parseInt(standardMatch[1], 10) * 10;
    return { allowance, isScottish, isWelsh, isEmergency, specialCode: null, description: null };
  }

  // Default to standard allowance if code not recognized
  return { allowance: UK_TAX.personalAllowance, isScottish, isWelsh, isEmergency, specialCode: null, description: "Code not recognized, using default" };
}

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
  taxCode: "",
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
};

const state = { ...defaultState, expenses: { ...defaultState.expenses } };
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
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
function calculateUKTax(annualSalary, hasStudentLoan = false, hasPension = false, taxCode = "") {
  let taxableIncome = annualSalary;
  let pensionDeduction = 0;

  // Parse tax code
  const parsed = parseTaxCode(taxCode);
  const isScottish = parsed.isScottish;

  // Pension contribution (5% of gross)
  if (hasPension) {
    pensionDeduction = annualSalary * 0.05;
    taxableIncome = annualSalary - pensionDeduction;
  }

  // Personal allowance - use from tax code or calculate with taper
  let personalAllowance = parsed.allowance;

  // If no tax code provided, apply standard taper for high earners
  if (!taxCode && annualSalary > 100000) {
    const reduction = Math.floor((annualSalary - 100000) / 2);
    personalAllowance = Math.max(0, UK_TAX.personalAllowance - reduction);
  }

  // Handle special codes
  let incomeTax = 0;
  let taxBand = "Personal Allowance (0%)";

  if (parsed.specialCode === "NT") {
    // No tax
    incomeTax = 0;
    taxBand = "NT (No Tax)";
  } else if (parsed.specialCode === "BR") {
    // All income at basic rate
    incomeTax = taxableIncome * UK_TAX.basicRate;
    taxBand = "BR (Basic Rate Only)";
  } else if (parsed.specialCode === "D0") {
    // All income at higher rate
    incomeTax = taxableIncome * UK_TAX.higherRate;
    taxBand = "D0 (Higher Rate Only)";
  } else if (parsed.specialCode === "D1") {
    // All income at additional rate
    incomeTax = taxableIncome * UK_TAX.additionalRate;
    taxBand = "D1 (Additional Rate Only)";
  } else if (isScottish) {
    // Scottish tax calculation
    const taxableAfterAllowance = Math.max(0, taxableIncome - personalAllowance);
    incomeTax = calculateScottishTax(taxableAfterAllowance);
    taxBand = getScottishTaxBand(taxableAfterAllowance);
  } else {
    // Standard UK tax calculation
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

      // Determine tax band
      if (taxableAfterAllowance > UK_TAX.higherRateLimit - UK_TAX.personalAllowance) {
        taxBand = "Additional Rate (45%)";
      } else if (taxableAfterAllowance > UK_TAX.basicRateLimit - UK_TAX.personalAllowance) {
        taxBand = "Higher Rate (40%)";
      } else {
        taxBand = "Basic Rate (20%)";
      }
    }
  }

  // National Insurance (same for all UK)
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

  // Add Scottish/Welsh indicator to band
  if (isScottish && !parsed.specialCode) {
    taxBand = "Scottish " + taxBand;
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
    taxCodeInfo: parsed.description,
    personalAllowance,
  };
}

// Calculate Scottish income tax
function calculateScottishTax(taxableIncome) {
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let remaining = taxableIncome;

  // Starter rate (19%)
  const starterBand = Math.min(remaining, SCOTTISH_TAX.starterLimit);
  tax += starterBand * SCOTTISH_TAX.starterRate;
  remaining -= starterBand;
  if (remaining <= 0) return tax;

  // Basic rate (20%)
  const basicBand = Math.min(remaining, SCOTTISH_TAX.basicLimit - SCOTTISH_TAX.starterLimit);
  tax += basicBand * SCOTTISH_TAX.basicRate;
  remaining -= basicBand;
  if (remaining <= 0) return tax;

  // Intermediate rate (21%)
  const intermediateBand = Math.min(remaining, SCOTTISH_TAX.intermediateLimit - SCOTTISH_TAX.basicLimit);
  tax += intermediateBand * SCOTTISH_TAX.intermediateRate;
  remaining -= intermediateBand;
  if (remaining <= 0) return tax;

  // Higher rate (42%)
  const higherBand = Math.min(remaining, SCOTTISH_TAX.higherLimit - SCOTTISH_TAX.intermediateLimit);
  tax += higherBand * SCOTTISH_TAX.higherRate;
  remaining -= higherBand;
  if (remaining <= 0) return tax;

  // Advanced rate (45%)
  const advancedBand = Math.min(remaining, SCOTTISH_TAX.advancedLimit - SCOTTISH_TAX.higherLimit);
  tax += advancedBand * SCOTTISH_TAX.advancedRate;
  remaining -= advancedBand;
  if (remaining <= 0) return tax;

  // Top rate (48%)
  tax += remaining * SCOTTISH_TAX.topRate;

  return tax;
}

// Get Scottish tax band label
function getScottishTaxBand(taxableIncome) {
  if (taxableIncome <= 0) return "Personal Allowance (0%)";
  if (taxableIncome <= SCOTTISH_TAX.starterLimit) return "Starter Rate (19%)";
  if (taxableIncome <= SCOTTISH_TAX.basicLimit) return "Basic Rate (20%)";
  if (taxableIncome <= SCOTTISH_TAX.intermediateLimit) return "Intermediate Rate (21%)";
  if (taxableIncome <= SCOTTISH_TAX.higherLimit) return "Higher Rate (42%)";
  if (taxableIncome <= SCOTTISH_TAX.advancedLimit) return "Advanced Rate (45%)";
  return "Top Rate (48%)";
}

function updateSalaryBreakdown() {
  const salary = state.annualSalary || 0;
  const calc = calculateUKTax(salary, state.studentLoan, state.pensionContrib, state.taxCode);

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

  // Update tax code hint
  const taxCodeHint = document.querySelector("[data-tax-code-hint]");
  if (taxCodeHint) {
    const parsed = parseTaxCode(state.taxCode);
    taxCodeHint.classList.remove("is-scottish", "is-special");

    if (!state.taxCode) {
      taxCodeHint.textContent = "Found on your payslip";
    } else if (parsed.description) {
      taxCodeHint.textContent = parsed.description;
      if (parsed.specialCode) taxCodeHint.classList.add("is-special");
    } else if (parsed.isScottish) {
      taxCodeHint.textContent = `Scottish taxpayer • £${parsed.allowance.toLocaleString()} allowance`;
      taxCodeHint.classList.add("is-scottish");
    } else {
      taxCodeHint.textContent = `£${parsed.allowance.toLocaleString()} personal allowance`;
    }
  }

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

  safe.annualSalary = Math.max(0, Math.min(Number(safe.annualSalary) || 0, 10000000));
  safe.taxCode = typeof safe.taxCode === "string" ? safe.taxCode.toUpperCase().trim() : "";
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
        .map((goal, idx) => ({
          id: goal.id || `goal-${Date.now()}-${idx}`,
          name: String(goal.name || "").trim(),
          target: Number(goal.target) || 0,
          saved: Number(goal.saved) || 0,
          monthly: Number(goal.monthly) || 0,
          targetDate: goal.targetDate || null,
          priority: Number(goal.priority) || idx + 1,
          autoAllocate: goal.autoAllocate !== false,
          color: goal.color || GOAL_COLORS[idx % GOAL_COLORS.length],
          createdAt: goal.createdAt || Date.now(),
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

  return safe;
}

function applyState(raw, updatedAtOverride) {
  const safe = sanitizeState(raw);
  Object.assign(state, safe);
  state.expenses = { ...safe.expenses };
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
    console.warn("Failed to save to localStorage:", error.message);
    // Show user notification if storage is full
    if (error.name === "QuotaExceededError" || error.code === 22) {
      const notification = document.querySelector("[data-storage-warning]");
      if (notification) notification.classList.remove("is-hidden");
    }
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
}

// Goal Engine v2
function calculateGoalETA(goal) {
  const saved = Number(goal.saved) || 0;
  const target = Number(goal.target) || 0;
  const monthly = Number(goal.monthly) || 0;
  const remaining = target - saved;

  if (remaining <= 0) return { months: 0, date: new Date(), status: "complete" };
  if (monthly <= 0) return { months: Infinity, date: null, status: "no-contribution" };

  const months = Math.ceil(remaining / monthly);
  const eta = new Date();
  eta.setMonth(eta.getMonth() + months);

  // Check against target date if set
  if (goal.targetDate) {
    const targetDate = new Date(goal.targetDate);
    const monthsToTarget = Math.max(0, Math.ceil((targetDate - new Date()) / (30 * 24 * 60 * 60 * 1000)));
    const requiredMonthly = monthsToTarget > 0 ? Math.ceil(remaining / monthsToTarget) : remaining;

    return {
      months,
      date: eta,
      targetDate,
      monthsToTarget,
      requiredMonthly,
      onTrack: months <= monthsToTarget,
      status: months <= monthsToTarget ? "on-track" : "behind",
    };
  }

  return { months, date: eta, status: "in-progress" };
}

function calculateSuggestedAllocation(goals, surplus) {
  if (!goals.length || surplus <= 0) return [];

  const activeGoals = goals.filter((g) => g.autoAllocate && g.target > g.saved);
  if (!activeGoals.length) return [];

  // Sort by priority
  const sorted = [...activeGoals].sort((a, b) => (a.priority || 99) - (b.priority || 99));

  // Allocate proportionally based on remaining amount
  const totalRemaining = sorted.reduce((sum, g) => sum + (g.target - g.saved), 0);
  if (totalRemaining <= 0) return [];

  return sorted.map((goal) => {
    const remaining = goal.target - goal.saved;
    const share = remaining / totalRemaining;
    const suggested = Math.round(surplus * share);
    return { goalId: goal.id, suggested, remaining };
  });
}

function applyAutoAllocation() {
  const income = state.income || 0;
  const totalExpenses = calculateTotalExpenses();
  const surplus = Math.max(0, income - totalExpenses);

  if (surplus <= 0) return;

  const allocations = calculateSuggestedAllocation(state.goals, surplus);

  allocations.forEach(({ goalId, suggested }) => {
    const goal = state.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.monthly = suggested;
    }
  });

  scheduleSave();
  updateGoalList();
}

function updateGoalList() {
  const goalList = document.querySelector("[data-app-goals]");
  if (!goalList) return;

  // Calculate total allocated and surplus
  const income = state.income || 0;
  const totalExpenses = calculateTotalExpenses();
  const surplus = Math.max(0, income - totalExpenses);
  const totalAllocated = state.goals.reduce((sum, g) => sum + (Number(g.monthly) || 0), 0);
  const unallocated = surplus - totalAllocated;

  if (!state.goals.length) {
    goalList.innerHTML = `
      <div class="goal-empty-state">
        <p class="muted">No goals yet. Add one to start tracking progress.</p>
        <button class="btn secondary" type="button" data-add-goal>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add your first goal
        </button>
      </div>
    `;
    attachAddGoalListener();
    return;
  }

  // Summary header
  const summaryHtml = `
    <div class="goals-summary">
      <div class="summary-item">
        <span class="summary-label">Monthly surplus</span>
        <span class="summary-value">${formatCurrency(surplus)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Allocated to goals</span>
        <span class="summary-value">${formatCurrency(totalAllocated)}</span>
      </div>
      <div class="summary-item ${unallocated > 0 ? "highlight" : ""}">
        <span class="summary-label">Unallocated</span>
        <span class="summary-value">${formatCurrency(unallocated)}</span>
      </div>
      ${unallocated > 0 ? `<button class="btn small" type="button" data-auto-allocate>Auto-allocate</button>` : ""}
    </div>
  `;

  // Sort goals by priority
  const sortedGoals = [...state.goals].sort((a, b) => (a.priority || 99) - (b.priority || 99));

  const items = sortedGoals.map((goal, displayIdx) => {
    const index = state.goals.findIndex((g) => g.id === goal.id);
    const saved = Number(goal.saved) || 0;
    const target = Number(goal.target) || 0;
    const monthly = Number(goal.monthly) || 0;
    const progress = target ? Math.min(100, Math.round((saved / target) * 100)) : 0;
    const eta = calculateGoalETA(goal);
    const color = goal.color || GOAL_COLORS[displayIdx % GOAL_COLORS.length];

    let statusHtml = "";
    let etaLabel = "";

    if (!target) {
      etaLabel = "Set a target amount";
      statusHtml = '<span class="goal-status needs-target">Needs target</span>';
    } else if (eta.status === "complete") {
      etaLabel = "Goal reached!";
      statusHtml = '<span class="goal-status complete">Complete</span>';
    } else if (eta.status === "no-contribution") {
      etaLabel = "Set monthly amount to see ETA";
      statusHtml = '<span class="goal-status needs-contribution">No contribution</span>';
    } else if (eta.targetDate) {
      const dateStr = eta.targetDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (eta.onTrack) {
        etaLabel = `On track for ${dateStr}`;
        statusHtml = '<span class="goal-status on-track">On track</span>';
      } else {
        etaLabel = `Behind schedule (need ${formatCurrency(eta.requiredMonthly)}/mo)`;
        statusHtml = '<span class="goal-status behind">Behind</span>';
      }
    } else {
      const dateStr = eta.date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      etaLabel = `ETA: ${dateStr} (~${eta.months} months)`;
      statusHtml = '<span class="goal-status in-progress">In progress</span>';
    }

    return `
      <div class="goal-pot" data-goal-index="${index}" style="--goal-color: ${color}">
        <div class="goal-pot-header">
          <div class="goal-pot-color" style="background: ${color}"></div>
          <div class="goal-pot-info">
            <h4>${escapeHtml(goal.name)}</h4>
            <p class="goal-eta">${etaLabel}</p>
          </div>
          ${statusHtml}
          <button class="goal-menu-btn" type="button" data-goal-menu="${index}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
        </div>

        <div class="goal-pot-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%; background: ${color}"></div>
          </div>
          <div class="progress-labels">
            <span>${formatCurrency(saved)} saved</span>
            <span>${formatCurrency(target)} target</span>
          </div>
        </div>

        <div class="goal-pot-controls">
          <div class="control-group">
            <label>Monthly contribution</label>
            <div class="slider-input-group">
              <input type="range" min="0" max="${Math.max(surplus, monthly, 500)}" step="25" value="${monthly}" data-goal-monthly-slider class="goal-slider" style="--slider-color: ${color}" />
              <div class="input-with-prefix">
                <span>£</span>
                <input type="number" min="0" step="25" value="${monthly || ""}" data-goal-monthly-input />
              </div>
            </div>
          </div>

          <div class="control-row">
            <div class="control-group small">
              <label>Saved so far</label>
              <div class="input-with-prefix">
                <span>£</span>
                <input type="number" min="0" step="50" value="${saved || ""}" data-goal-saved-input />
              </div>
            </div>
            <div class="control-group small">
              <label>Target</label>
              <div class="input-with-prefix">
                <span>£</span>
                <input type="number" min="0" step="100" value="${target || ""}" data-goal-target-input />
              </div>
            </div>
            <div class="control-group small">
              <label>Target date</label>
              <input type="month" value="${goal.targetDate || ""}" data-goal-date-input />
            </div>
          </div>
        </div>

        <div class="goal-pot-footer">
          <label class="toggle-small">
            <input type="checkbox" ${goal.autoAllocate !== false ? "checked" : ""} data-goal-auto-allocate />
            <span>Auto-allocate surplus</span>
          </label>
          <span class="goal-priority">Priority ${goal.priority || index + 1}</span>
        </div>
      </div>
    `;
  });

  // Add goal button
  const addButtonHtml = `
    <button class="add-goal-btn" type="button" data-add-goal>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      Add new goal
    </button>
  `;

  goalList.innerHTML = summaryHtml + items.join("") + addButtonHtml;
  attachGoalInputListeners();
  attachAddGoalListener();
  attachAutoAllocateListener();
}

function attachGoalInputListeners() {
  document.querySelectorAll("[data-goal-index]").forEach((item) => {
    const index = parseInt(item.dataset.goalIndex, 10);
    const targetInput = item.querySelector("[data-goal-target-input]");
    const savedInput = item.querySelector("[data-goal-saved-input]");
    const monthlyInput = item.querySelector("[data-goal-monthly-input]");
    const monthlySlider = item.querySelector("[data-goal-monthly-slider]");
    const dateInput = item.querySelector("[data-goal-date-input]");
    const autoAllocateCheckbox = item.querySelector("[data-goal-auto-allocate]");

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
        const value = Number(monthlyInput.value) || 0;
        state.goals[index].monthly = value;
        if (monthlySlider) monthlySlider.value = value;
        scheduleSave();
        updateGoalList();
      });
    }
    if (monthlySlider) {
      monthlySlider.addEventListener("input", () => {
        const value = Number(monthlySlider.value) || 0;
        state.goals[index].monthly = value;
        if (monthlyInput) monthlyInput.value = value;
        scheduleSave();
      });
      monthlySlider.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (dateInput) {
      dateInput.addEventListener("change", () => {
        state.goals[index].targetDate = dateInput.value || null;
        scheduleSave();
        updateGoalList();
      });
    }
    if (autoAllocateCheckbox) {
      autoAllocateCheckbox.addEventListener("change", () => {
        state.goals[index].autoAllocate = autoAllocateCheckbox.checked;
        scheduleSave();
      });
    }
  });
}

function attachAddGoalListener() {
  document.querySelectorAll("[data-add-goal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = prompt("Enter goal name:");
      if (!name || !name.trim()) return;

      const newGoal = {
        id: `goal-${Date.now()}`,
        name: name.trim(),
        target: 0,
        saved: 0,
        monthly: 0,
        targetDate: null,
        priority: state.goals.length + 1,
        autoAllocate: true,
        color: GOAL_COLORS[state.goals.length % GOAL_COLORS.length],
        createdAt: Date.now(),
      };

      state.goals.push(newGoal);
      scheduleSave();
      updateGoalList();
    });
  });
}

function attachAutoAllocateListener() {
  const btn = document.querySelector("[data-auto-allocate]");
  if (btn) {
    btn.addEventListener("click", applyAutoAllocation);
  }
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
        state.annualSalary = Math.max(0, Math.min(Number(el.value) || 0, 10000000));
        updateSalaryBreakdown();
      } else if (field === "studentLoan") {
        state.studentLoan = el.checked;
        updateSalaryBreakdown();
      } else if (field === "pensionContrib") {
        state.pensionContrib = el.checked;
        updateSalaryBreakdown();
      } else if (field === "taxCode") {
        state.taxCode = el.value.toUpperCase().trim();
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

// Initialize
async function init() {
  const localData = loadLocalState();
  if (localData) {
    applyState(localData);
  }

  syncFormFromState();
  showInitialScreen();
  updateSummary();

  await loadFxRates();
  updateConverter();

  await initFirebase();

  // Initial Monte Carlo
  setTimeout(updateMonteCarlo, 500);
}

attachEventListeners();
init();
