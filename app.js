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

// Validate color is safe for inline styles (prevent CSS injection)
function safeColor(color) {
  if (!color) return GOAL_COLORS[0];
  if (GOAL_COLORS.includes(color)) return color;
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : GOAL_COLORS[0];
}

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
  bills: [],
  dashboardWidgets: [...DASHBOARD_WIDGET_KEYS],
  cashflowScenario: "baseline",
  cashflowMonths: 12,
  cashflowIncomeChange: 0,
  cashflowExpenseChange: 0,
  rewardPoints: 0,
  rewardStreak: 0,
  rewardLevel: 1,
  rewardLastCheckIn: null,
  unlockedBadges: [],
  claimedOffers: [],
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

  // Sanitize bills (recurring payments/subscriptions)
  const BILL_CATEGORIES = ["subscription", "utility", "insurance", "loan", "rent", "other"];
  const BILL_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"];
  safe.bills = Array.isArray(safe.bills)
    ? safe.bills
        .map((bill, idx) => ({
          id: bill.id || `bill-${Date.now()}-${idx}`,
          name: String(bill.name || "").trim().slice(0, 50),
          amount: Math.max(0, Number(bill.amount) || 0),
          dueDay: Math.max(1, Math.min(31, Number(bill.dueDay) || 1)),
          category: BILL_CATEGORIES.includes(bill.category) ? bill.category : "other",
          frequency: BILL_FREQUENCIES.includes(bill.frequency) ? bill.frequency : "monthly",
          autoPay: Boolean(bill.autoPay),
          reminderDays: Math.max(0, Math.min(14, Number(bill.reminderDays) || 3)),
          active: bill.active !== false,
          createdAt: bill.createdAt || Date.now(),
        }))
        .filter((bill) => bill.name && bill.amount > 0)
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
    ? Math.max(0, Number(safe.rewardPoints))
    : defaultState.rewardPoints;
  safe.rewardStreak = Number.isFinite(Number(safe.rewardStreak))
    ? Math.max(0, Number(safe.rewardStreak))
    : defaultState.rewardStreak;
  safe.rewardLevel = Math.max(1, Math.min(10, Number(safe.rewardLevel) || 1));
  safe.rewardLastCheckIn = safe.rewardLastCheckIn || null;
  safe.unlockedBadges = Array.isArray(safe.unlockedBadges)
    ? safe.unlockedBadges.filter((b) => typeof b === "string")
    : [];
  safe.claimedOffers = Array.isArray(safe.claimedOffers)
    ? safe.claimedOffers.filter((o) => typeof o === "string")
    : [];
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
    clearUnsavedChanges();
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
  markUnsavedChanges();
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

// Rewards v2 System
const REWARD_BADGES = {
  "first-goal": { name: "Goal Setter", description: "Create your first savings goal", icon: "target", points: 50 },
  "budget-master": { name: "Budget Master", description: "Set up your full budget", icon: "pie-chart", points: 100 },
  "emergency-starter": { name: "Safety Net", description: "Save 1 month of expenses", icon: "shield", points: 150 },
  "emergency-pro": { name: "Fully Protected", description: "Save 3 months of expenses", icon: "shield-check", points: 300 },
  "streak-7": { name: "Week Warrior", description: "Maintain a 7-day streak", icon: "flame", points: 75 },
  "streak-30": { name: "Monthly Master", description: "Maintain a 30-day streak", icon: "fire", points: 200 },
  "streak-100": { name: "Centurion", description: "Maintain a 100-day streak", icon: "crown", points: 500 },
  "goal-complete": { name: "Goal Crusher", description: "Complete your first goal", icon: "trophy", points: 200 },
  "debt-free": { name: "Debt Destroyer", description: "Reduce debt to under 10% of income", icon: "broken-chain", points: 250 },
  "saver-10": { name: "Smart Saver", description: "Achieve 10% savings rate", icon: "piggy-bank", points: 100 },
  "saver-20": { name: "Super Saver", description: "Achieve 20% savings rate", icon: "rocket", points: 200 },
  "bill-tracker": { name: "Bill Boss", description: "Track 5 recurring bills", icon: "calendar-check", points: 75 },
  "protection-80": { name: "Well Protected", description: "Reach 80+ protection score", icon: "award", points: 300 },
};

const REWARD_LEVELS = [
  { level: 1, name: "Starter", minPoints: 0, color: "#94a3b8" },
  { level: 2, name: "Bronze", minPoints: 200, color: "#cd7f32" },
  { level: 3, name: "Silver", minPoints: 500, color: "#c0c0c0" },
  { level: 4, name: "Gold", minPoints: 1000, color: "#ffd700" },
  { level: 5, name: "Platinum", minPoints: 2000, color: "#e5e4e2" },
  { level: 6, name: "Diamond", minPoints: 3500, color: "#b9f2ff" },
  { level: 7, name: "Master", minPoints: 5000, color: "#9333ea" },
  { level: 8, name: "Legend", minPoints: 7500, color: "#dc2626" },
  { level: 9, name: "Champion", minPoints: 10000, color: "#f59e0b" },
  { level: 10, name: "Elite", minPoints: 15000, color: "#059669" },
];

const PARTNER_OFFERS = [
  { id: "travel-5", name: "5% off Holiday Bookings", partner: "TravelSave", cost: 500, category: "travel", icon: "plane" },
  { id: "groceries-10", name: "£10 Supermarket Voucher", partner: "FreshMart", cost: 300, category: "groceries", icon: "shopping-cart" },
  { id: "fitness-month", name: "Free Month Gym Pass", partner: "FitLife", cost: 400, category: "wellness", icon: "dumbbell" },
  { id: "coffee-free", name: "Free Coffee Bundle", partner: "BeanBrew", cost: 150, category: "food", icon: "coffee" },
  { id: "streaming-month", name: "1 Month Streaming Free", partner: "StreamPlus", cost: 250, category: "entertainment", icon: "tv" },
  { id: "home-discount", name: "£20 Home Insurance Discount", partner: "SafeHome", cost: 600, category: "insurance", icon: "home" },
  { id: "book-credit", name: "£5 Book Credit", partner: "ReadMore", cost: 200, category: "education", icon: "book" },
  { id: "restaurant-deal", name: "25% off Dining", partner: "TastyEats", cost: 350, category: "food", icon: "utensils" },
];

function getCurrentLevel() {
  const points = state.rewardPoints || 0;
  let currentLevel = REWARD_LEVELS[0];
  for (const level of REWARD_LEVELS) {
    if (points >= level.minPoints) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

function getNextLevel() {
  const current = getCurrentLevel();
  const nextIdx = REWARD_LEVELS.findIndex((l) => l.level === current.level) + 1;
  return nextIdx < REWARD_LEVELS.length ? REWARD_LEVELS[nextIdx] : null;
}

function getLevelProgress() {
  const points = state.rewardPoints || 0;
  const current = getCurrentLevel();
  const next = getNextLevel();
  if (!next) return 100;
  const levelPoints = points - current.minPoints;
  const levelRange = next.minPoints - current.minPoints;
  return Math.min(100, Math.round((levelPoints / levelRange) * 100));
}

function awardPoints(amount, reason) {
  state.rewardPoints = (state.rewardPoints || 0) + amount;

  // Check for level up
  const newLevel = getCurrentLevel();
  if (newLevel.level > (state.rewardLevel || 1)) {
    state.rewardLevel = newLevel.level;
  }

  scheduleSave();
  updateRewardsUI();
}

function checkAndAwardBadge(badgeId) {
  if (!REWARD_BADGES[badgeId]) return false;
  if ((state.unlockedBadges || []).includes(badgeId)) return false;

  state.unlockedBadges = [...(state.unlockedBadges || []), badgeId];
  awardPoints(REWARD_BADGES[badgeId].points, `Badge: ${REWARD_BADGES[badgeId].name}`);
  return true;
}

function checkAllBadges() {
  const snapshot = getFinanceSnapshot();
  const bufferMonths = snapshot.expenses > 0 ? snapshot.savings / snapshot.expenses : 0;
  const debtRatio = snapshot.income > 0 ? snapshot.debt / snapshot.income : 0;
  const savingsRate = snapshot.income > 0 ? snapshot.surplus / snapshot.income : 0;
  const protectionScore = typeof calculateProtectionScore === "function" ? calculateProtectionScore().total : 0;

  // Check badge conditions
  if (state.goals && state.goals.length >= 1) checkAndAwardBadge("first-goal");
  if (state.snapshotSet) checkAndAwardBadge("budget-master");
  if (bufferMonths >= 1) checkAndAwardBadge("emergency-starter");
  if (bufferMonths >= 3) checkAndAwardBadge("emergency-pro");
  if (state.rewardStreak >= 7) checkAndAwardBadge("streak-7");
  if (state.rewardStreak >= 30) checkAndAwardBadge("streak-30");
  if (state.rewardStreak >= 100) checkAndAwardBadge("streak-100");
  if (state.goals && state.goals.some((g) => g.target > 0 && g.saved >= g.target)) checkAndAwardBadge("goal-complete");
  if (debtRatio <= 0.1 && snapshot.debt > 0) checkAndAwardBadge("debt-free");
  if (savingsRate >= 0.1) checkAndAwardBadge("saver-10");
  if (savingsRate >= 0.2) checkAndAwardBadge("saver-20");
  if (state.bills && state.bills.length >= 5) checkAndAwardBadge("bill-tracker");
  if (protectionScore >= 80) checkAndAwardBadge("protection-80");
}

function handleDailyCheckIn() {
  const today = new Date().toDateString();
  const lastCheckIn = state.rewardLastCheckIn;

  if (lastCheckIn === today) return; // Already checked in today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastCheckIn === yesterday.toDateString()) {
    // Continue streak
    state.rewardStreak = (state.rewardStreak || 0) + 1;
  } else if (lastCheckIn) {
    // Streak broken
    state.rewardStreak = 1;
  } else {
    // First check-in
    state.rewardStreak = 1;
  }

  state.rewardLastCheckIn = today;

  // Award daily points (base + streak bonus)
  const streakBonus = Math.min(state.rewardStreak, 30); // Cap bonus at 30
  awardPoints(5 + streakBonus, "Daily check-in");

  checkAllBadges();
}

function claimOffer(offerId) {
  const offer = PARTNER_OFFERS.find((o) => o.id === offerId);
  if (!offer) return false;
  if ((state.claimedOffers || []).includes(offerId)) return false;
  if ((state.rewardPoints || 0) < offer.cost) return false;

  state.rewardPoints -= offer.cost;
  state.claimedOffers = [...(state.claimedOffers || []), offerId];
  scheduleSave();
  updateRewardsUI();
  return true;
}

function getBadgeIcon(iconName) {
  const icons = {
    target: `
      <defs>
        <linearGradient id="bdg-pink-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-gold-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-teal-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#bdg-pink-${iconName})" opacity="0.2"/>
      <circle cx="12" cy="12" r="7" fill="#fff" opacity="0.4"/>
      <circle cx="12" cy="12" r="4" fill="url(#bdg-pink-${iconName})" opacity="0.6"/>
      <circle cx="12" cy="12" r="1.5" fill="url(#bdg-pink-${iconName})"/>
      <path d="M18 4l-5 7" stroke="url(#bdg-teal-${iconName})" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 4l2-2M20 4l-2 2M18 2l2 2" stroke="url(#bdg-gold-${iconName})" stroke-width="1.5" stroke-linecap="round"/>`,
    "pie-chart": `
      <defs>
        <linearGradient id="bdg-teal-pie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-gold-pie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-pie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="14" r="8" fill="url(#bdg-teal-pie)" opacity="0.3"/>
      <path d="M12 6v8l6 4" fill="url(#bdg-teal-pie)"/>
      <path d="M12 6a8 8 0 00-6.9 4" fill="url(#bdg-pink-pie)"/>
      <path d="M5.1 10A8 8 0 0012 22a8 8 0 006.9-12" fill="url(#bdg-gold-pie)" opacity="0.7"/>
      <path d="M7 4l2 3h6l2-3-2.5 2L12 2l-2.5 4L7 4z" fill="url(#bdg-gold-pie)"/>`,
    shield: `
      <defs>
        <linearGradient id="bdg-teal-sh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-gold-sh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M3 8c3 0 4 4 9 4s6-4 9-4v10c-3 0-4 2-9 2s-6-2-9-2V8z" fill="none" stroke="url(#bdg-teal-sh)" stroke-width="2"/>
      <path d="M3 12h18M6 8v10M12 8v10M18 8v10" stroke="url(#bdg-teal-sh)" stroke-width="1" opacity="0.5"/>
      <circle cx="8" cy="6" r="2" fill="url(#bdg-gold-sh)"/>
      <circle cx="14" cy="4" r="2" fill="url(#bdg-gold-sh)"/>`,
    "shield-check": `
      <defs>
        <linearGradient id="bdg-gold-shc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M12 2l9 4v6c0 6-4 10-9 12-5-2-9-6-9-12V6l9-4z" fill="url(#bdg-gold-shc)"/>
      <path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="8" cy="7" r="0.8" fill="#fff" opacity="0.5"/>`,
    flame: `
      <defs>
        <linearGradient id="bdg-gold-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <path d="M12 2c-4 4-6 6-6 10a6 6 0 0012 0c0-4-2-6-6-10z" fill="url(#bdg-gold-fl)"/>
      <path d="M12 6c-2 2-3 3-3 5a3 3 0 006 0c0-2-1-3-3-5z" fill="url(#bdg-pink-fl)" opacity="0.7"/>
      <text x="12" y="16" font-family="Arial" font-size="8" font-weight="bold" fill="#fff" text-anchor="middle">7</text>`,
    fire: `
      <defs>
        <linearGradient id="bdg-pink-fr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-gold-fr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M12 1c-5 5-7 7-7 12a7 7 0 0014 0c0-5-2-7-7-12z" fill="url(#bdg-pink-fr)"/>
      <path d="M12 5c-2.5 2.5-4 4-4 7a4 4 0 008 0c0-3-1.5-4.5-4-7z" fill="url(#bdg-gold-fr)"/>
      <text x="12" y="16" font-family="Arial" font-size="6" font-weight="bold" fill="#1d3557" text-anchor="middle">30</text>`,
    crown: `
      <defs>
        <linearGradient id="bdg-gold-cr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-cr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="16" rx="7" ry="5" fill="url(#bdg-gold-cr)"/>
      <path d="M5 16V11a7 7 0 0114 0v5" fill="url(#bdg-gold-cr)" opacity="0.9"/>
      <path d="M8 4c0 0 4-3 8 0" stroke="url(#bdg-pink-cr)" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 1v5" stroke="url(#bdg-pink-cr)" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="12" cy="1" rx="2" ry="1" fill="url(#bdg-pink-cr)"/>`,
    trophy: `
      <defs>
        <linearGradient id="bdg-gold-tr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-teal-tr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <path d="M7 4h10v7a5 5 0 01-10 0V4z" fill="url(#bdg-gold-tr)"/>
      <path d="M7 6H5a2 2 0 000 4h2M17 6h2a2 2 0 010 4h-2" fill="url(#bdg-gold-tr)" opacity="0.7"/>
      <path d="M10 15v3h4v-3" fill="url(#bdg-gold-tr)"/>
      <rect x="8" y="18" width="8" height="3" rx="1" fill="url(#bdg-teal-tr)"/>
      <circle cx="9" cy="7" r="1" fill="#fff" opacity="0.5"/>`,
    "broken-chain": `
      <defs>
        <linearGradient id="bdg-navy-bc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
        <linearGradient id="bdg-gold-bc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-bc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <ellipse cx="6" cy="14" rx="3" ry="4" fill="none" stroke="url(#bdg-navy-bc)" stroke-width="2.5"/>
      <ellipse cx="18" cy="14" rx="3" ry="4" fill="none" stroke="url(#bdg-navy-bc)" stroke-width="2.5"/>
      <path d="M12 4v12" stroke="url(#bdg-gold-bc)" stroke-width="2.5"/>
      <path d="M10 4l2-2 2 2" fill="url(#bdg-gold-bc)"/>
      <path d="M9 12l6 4M9 16l6-4" stroke="url(#bdg-pink-bc)" stroke-width="2" stroke-linecap="round"/>`,
    "piggy-bank": `
      <defs>
        <linearGradient id="bdg-pink-pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-navy-pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
      </defs>
      <ellipse cx="11" cy="14" rx="7" ry="5" fill="url(#bdg-pink-pg)"/>
      <circle cx="16" cy="11" r="3.5" fill="url(#bdg-pink-pg)"/>
      <ellipse cx="19" cy="12" rx="1.8" ry="1.2" fill="#fda4af"/>
      <circle cx="18.5" cy="11.8" r="0.4" fill="#db2777"/>
      <circle cx="19.8" cy="11.8" r="0.4" fill="#db2777"/>
      <ellipse cx="15" cy="8" rx="1" ry="1.3" fill="#db2777" transform="rotate(-15 15 8)"/>
      <rect x="8" y="10" width="3" height="1" rx="0.5" fill="#db2777"/>
      <circle cx="14" cy="9.5" r="2" fill="none" stroke="url(#bdg-navy-pg)" stroke-width="1"/>
      <circle cx="18" cy="9.5" r="2" fill="none" stroke="url(#bdg-navy-pg)" stroke-width="1"/>
      <path d="M16 9.5h-2M12 10h-1" stroke="url(#bdg-navy-pg)" stroke-width="0.8"/>`,
    rocket: `
      <defs>
        <linearGradient id="bdg-teal-rk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-pink-rk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-gold-rk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M12 2l7 3.5v5.5c0 5-3 9-7 11-4-2-7-6-7-11V5.5L12 2z" fill="url(#bdg-teal-rk)"/>
      <path d="M12 7c-1 0-2 1-2 2v4l2 3 2-3V9c0-1-1-2-2-2z" fill="url(#bdg-pink-rk)"/>
      <path d="M10 13l-1.5 2M14 13l1.5 2" stroke="url(#bdg-gold-rk)" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="12" cy="17" rx="1.5" ry="2" fill="url(#bdg-gold-rk)"/>
      <circle cx="12" cy="9" r="1" fill="#fff" opacity="0.7"/>`,
    "calendar-check": `
      <defs>
        <linearGradient id="bdg-teal-cc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-gold-cc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect x="4" y="5" width="16" height="16" rx="2" fill="url(#bdg-teal-cc)"/>
      <path d="M4 10h16" stroke="#fff" stroke-width="1" opacity="0.3"/>
      <path d="M8 3v4M16 3v4" stroke="url(#bdg-teal-cc)" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 1l1.5 2h5l1.5-2-2 1.5L12 0l-2 2.5L8 1z" fill="url(#bdg-gold-cc)"/>
      <path d="M8 14l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    award: `
      <defs>
        <linearGradient id="bdg-gold-aw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-aw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-teal-aw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <path d="M8 21l4-3 4 3V10H8v11z" fill="url(#bdg-pink-aw)"/>
      <circle cx="12" cy="9" r="7" fill="url(#bdg-gold-aw)"/>
      <path d="M12 4l5 2.5v3.5c0 3-2 5-5 6-3-1-5-3-5-6V6.5L12 4z" fill="url(#bdg-teal-aw)"/>
      <path d="M10 9l1.5 1.5 3-3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  return icons[iconName] || icons.target;
}

function getOfferIcon(iconName) {
  const icons = {
    plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    "shopping-cart": '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>',
    dumbbell: '<path d="M6.5 6.5h11M6.5 17.5h11M17.5 6.5a1 1 0 011 1v9a1 1 0 01-1 1M6.5 6.5a1 1 0 00-1 1v9a1 1 0 001 1M20.5 8a1 1 0 011 1v6a1 1 0 01-1 1M3.5 8a1 1 0 00-1 1v6a1 1 0 001 1"/>',
    coffee: '<path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>',
    tv: '<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  };
  return icons[iconName] || icons.plane;
}

function updateRewardsUI() {
  // Update basic displays
  setTextAll("[data-rewards-points]", state.rewardPoints || 0);
  setTextAll("[data-rewards-streak]", state.rewardStreak || 0);

  // Update level display
  const currentLevel = getCurrentLevel();
  const nextLevel = getNextLevel();
  const progress = getLevelProgress();

  setTextAll("[data-rewards-level]", currentLevel.level);
  setTextAll("[data-rewards-level-name]", currentLevel.name);

  const levelProgress = document.querySelector("[data-rewards-level-progress]");
  if (levelProgress) {
    levelProgress.style.width = `${progress}%`;
    levelProgress.style.background = currentLevel.color;
  }

  const levelInfo = document.querySelector("[data-rewards-level-info]");
  if (levelInfo && nextLevel) {
    levelInfo.textContent = `${state.rewardPoints || 0} / ${nextLevel.minPoints} pts to ${nextLevel.name}`;
  } else if (levelInfo) {
    levelInfo.textContent = "Maximum level reached!";
  }

  // Update badges grid
  const badgesGrid = document.querySelector("[data-rewards-badges]");
  if (badgesGrid) {
    const unlockedBadges = state.unlockedBadges || [];
    badgesGrid.innerHTML = Object.entries(REWARD_BADGES)
      .map(([id, badge]) => {
        const unlocked = unlockedBadges.includes(id);
        return `
          <div class="badge-item ${unlocked ? "unlocked" : "locked"}" title="${escapeHtml(badge.description)}">
            <div class="badge-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${getBadgeIcon(badge.icon)}
              </svg>
            </div>
            <span class="badge-name">${escapeHtml(badge.name)}</span>
            <span class="badge-points">${unlocked ? "Unlocked" : `${badge.points} pts`}</span>
          </div>
        `;
      })
      .join("");
  }

  // Update offers grid
  const offersGrid = document.querySelector("[data-rewards-offers]");
  if (offersGrid) {
    const claimedOffers = state.claimedOffers || [];
    const points = state.rewardPoints || 0;

    offersGrid.innerHTML = PARTNER_OFFERS.map((offer) => {
      const claimed = claimedOffers.includes(offer.id);
      const canAfford = points >= offer.cost;
      return `
        <div class="offer-item ${claimed ? "claimed" : ""} ${!canAfford && !claimed ? "locked" : ""}">
          <div class="offer-icon ${escapeHtml(offer.category)}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${getOfferIcon(offer.icon)}
            </svg>
          </div>
          <div class="offer-info">
            <p class="offer-name">${escapeHtml(offer.name)}</p>
            <p class="offer-partner">${escapeHtml(offer.partner)}</p>
          </div>
          <div class="offer-action">
            ${claimed
              ? '<span class="offer-claimed">Claimed</span>'
              : `<button class="btn small ${canAfford ? "" : "disabled"}" data-claim-offer="${escapeHtml(offer.id)}" ${!canAfford ? "disabled" : ""}>${offer.cost} pts</button>`
            }
          </div>
        </div>
      `;
    }).join("");

    // Attach claim listeners
    offersGrid.querySelectorAll("[data-claim-offer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const offerId = btn.dataset.claimOffer;
        if (claimOffer(offerId)) {
          updateRewardsUI();
        }
      });
    });
  }

  // Update streak display
  const streakDisplay = document.querySelector("[data-rewards-streak-display]");
  if (streakDisplay) {
    const streak = state.rewardStreak || 0;
    const streakDays = [];
    for (let i = 6; i >= 0; i--) {
      const dayStreak = streak > i;
      streakDays.push(`<div class="streak-day ${dayStreak ? "active" : ""}"></div>`);
    }
    streakDisplay.innerHTML = streakDays.join("");
  }
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
  updateBillsList();
}

// Goal Engine v2
function calculateGoalETA(goal) {
  if (!goal || typeof goal !== "object") {
    return { months: 0, date: null, status: "invalid" };
  }

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
    const now = new Date();
    const monthsToTarget = Math.max(
      0,
      (targetDate.getFullYear() - now.getFullYear()) * 12 + targetDate.getMonth() - now.getMonth()
    );
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
    const color = safeColor(goal.color || GOAL_COLORS[displayIdx % GOAL_COLORS.length]);

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
        state.goals[index].target = Math.max(0, Number(targetInput.value) || 0);
        scheduleSave();
      });
      targetInput.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (savedInput) {
      savedInput.addEventListener("input", () => {
        state.goals[index].saved = Math.max(0, Number(savedInput.value) || 0);
        scheduleSave();
      });
      savedInput.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (monthlyInput) {
      monthlyInput.addEventListener("input", () => {
        const value = Math.max(0, Number(monthlyInput.value) || 0);
        state.goals[index].monthly = value;
        if (monthlySlider) monthlySlider.value = value;
        scheduleSave();
      });
      monthlyInput.addEventListener("change", () => {
        updateGoalList();
      });
    }
    if (monthlySlider) {
      monthlySlider.addEventListener("input", () => {
        const value = Math.max(0, Number(monthlySlider.value) || 0);
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

// Protection Check - Comprehensive Financial Health Score
function calculateProtectionScore() {
  const snapshot = getFinanceSnapshot();
  const bufferMonths = snapshot.expenses > 0 ? snapshot.savings / snapshot.expenses : 0;
  const debtRatio = snapshot.income > 0 ? snapshot.debt / snapshot.income : 0;
  const savingsRate = snapshot.income > 0 ? snapshot.surplus / snapshot.income : 0;

  const categories = {
    emergency: { name: "Emergency Fund", score: 0, max: 25, status: "", issues: [], tips: [] },
    debt: { name: "Debt Health", score: 0, max: 25, status: "", issues: [], tips: [] },
    budget: { name: "Budget Balance", score: 0, max: 25, status: "", issues: [], tips: [] },
    goals: { name: "Goal Progress", score: 0, max: 25, status: "", issues: [], tips: [] },
  };

  // Emergency Fund scoring (0-25 points)
  // Target: 6+ months buffer = full score
  if (bufferMonths >= 6) {
    categories.emergency.score = 25;
    categories.emergency.status = "excellent";
  } else if (bufferMonths >= 3) {
    categories.emergency.score = 15 + Math.round((bufferMonths - 3) * 3.33);
    categories.emergency.status = "good";
    categories.emergency.tips.push("Build to 6 months for full protection");
  } else if (bufferMonths >= 1) {
    categories.emergency.score = 5 + Math.round((bufferMonths - 1) * 5);
    categories.emergency.status = "fair";
    categories.emergency.issues.push({ text: "Emergency buffer below 3 months", severity: "medium" });
    categories.emergency.tips.push("Aim for 3 months of expenses saved");
  } else {
    categories.emergency.score = Math.round(bufferMonths * 5);
    categories.emergency.status = "poor";
    categories.emergency.issues.push({ text: "Emergency buffer below 1 month", severity: "high" });
    categories.emergency.tips.push("Prioritise building a 1-month buffer");
  }

  // Debt Health scoring (0-25 points)
  // Target: debt ratio < 10% = full score
  if (debtRatio <= 0.1) {
    categories.debt.score = 25;
    categories.debt.status = "excellent";
  } else if (debtRatio <= 0.2) {
    categories.debt.score = 20 - Math.round((debtRatio - 0.1) * 50);
    categories.debt.status = "good";
  } else if (debtRatio <= 0.35) {
    categories.debt.score = 15 - Math.round((debtRatio - 0.2) * 33);
    categories.debt.status = "fair";
    categories.debt.issues.push({ text: "Debt payments above 20% of income", severity: "medium" });
    categories.debt.tips.push("Consider debt consolidation or faster repayment");
  } else {
    categories.debt.score = Math.max(0, 10 - Math.round((debtRatio - 0.35) * 20));
    categories.debt.status = "poor";
    categories.debt.issues.push({ text: "Debt payments exceed 35% of income", severity: "high" });
    categories.debt.tips.push("Review high-interest debts urgently");
  }

  // Budget Balance scoring (0-25 points)
  // Target: savings rate >= 20% = full score
  if (snapshot.surplus < 0) {
    categories.budget.score = 0;
    categories.budget.status = "poor";
    categories.budget.issues.push({ text: "Monthly expenses exceed income", severity: "high" });
    categories.budget.tips.push("Review and reduce non-essential spending");
  } else if (savingsRate >= 0.2) {
    categories.budget.score = 25;
    categories.budget.status = "excellent";
  } else if (savingsRate >= 0.1) {
    categories.budget.score = 15 + Math.round((savingsRate - 0.1) * 100);
    categories.budget.status = "good";
    categories.budget.tips.push("Increase savings rate to 20% for optimal growth");
  } else if (savingsRate > 0) {
    categories.budget.score = Math.round(savingsRate * 150);
    categories.budget.status = "fair";
    categories.budget.issues.push({ text: "Savings rate below 10%", severity: "medium" });
    categories.budget.tips.push("Look for ways to increase monthly surplus");
  } else {
    categories.budget.score = 5;
    categories.budget.status = "fair";
  }

  // Goal Progress scoring (0-25 points)
  const goals = state.goals || [];
  if (goals.length === 0) {
    categories.goals.score = 5;
    categories.goals.status = "fair";
    categories.goals.issues.push({ text: "No financial goals set", severity: "low" });
    categories.goals.tips.push("Set at least one savings goal to track progress");
  } else {
    const goalsWithTargets = goals.filter((g) => g.target > 0);
    const goalsOnTrack = goalsWithTargets.filter((g) => {
      const eta = calculateGoalETA(g);
      return eta.status === "complete" || eta.status === "on-track" || eta.status === "in-progress";
    });
    const goalsContributing = goals.filter((g) => g.monthly > 0);

    let goalScore = 5; // Base for having goals
    if (goalsWithTargets.length > 0) {
      const trackRate = goalsOnTrack.length / goalsWithTargets.length;
      goalScore += Math.round(trackRate * 15);
    }
    if (goalsContributing.length > 0) {
      goalScore += 5;
    }

    categories.goals.score = Math.min(25, goalScore);

    if (categories.goals.score >= 20) {
      categories.goals.status = "excellent";
    } else if (categories.goals.score >= 15) {
      categories.goals.status = "good";
    } else {
      categories.goals.status = "fair";
      const behindGoals = goals.filter((g) => {
        const eta = calculateGoalETA(g);
        return eta.status === "behind";
      });
      if (behindGoals.length > 0) {
        categories.goals.issues.push({ text: `${behindGoals.length} goal(s) behind schedule`, severity: "medium" });
        categories.goals.tips.push("Increase contributions to catch up");
      }
      if (goalsContributing.length === 0 && goals.length > 0) {
        categories.goals.issues.push({ text: "No goals receiving monthly contributions", severity: "medium" });
        categories.goals.tips.push("Set up monthly contributions to reach goals");
      }
    }
  }

  // Calculate total score
  const totalScore = Object.values(categories).reduce((sum, cat) => sum + cat.score, 0);

  // Determine overall status
  let overallStatus = "poor";
  let statusLabel = "Needs Work";
  if (totalScore >= 80) {
    overallStatus = "excellent";
    statusLabel = "Excellent";
  } else if (totalScore >= 60) {
    overallStatus = "good";
    statusLabel = "Good";
  } else if (totalScore >= 40) {
    overallStatus = "fair";
    statusLabel = "Fair";
  }

  // Collect all issues
  const allIssues = Object.values(categories).flatMap((cat) => cat.issues);

  // Get top tips (prioritise based on lowest category scores)
  const sortedCategories = Object.entries(categories).sort((a, b) => a[1].score - b[1].score);
  const topTips = sortedCategories.flatMap(([, cat]) => cat.tips).slice(0, 3);

  return {
    total: totalScore,
    status: overallStatus,
    statusLabel,
    categories,
    issues: allIssues,
    tips: topTips,
    metrics: { bufferMonths, debtRatio, savingsRate },
  };
}

function updateProtectionCheck() {
  const container = document.querySelector("[data-protection-check]");
  if (!container) return;

  const score = calculateProtectionScore();

  // Update gauge
  const gaugeValue = container.querySelector("[data-protection-score]");
  const gaugeLabel = container.querySelector("[data-protection-label]");
  const gaugeFill = container.querySelector("[data-protection-gauge-fill]");

  if (gaugeValue) gaugeValue.textContent = score.total;
  if (gaugeLabel) {
    gaugeLabel.textContent = score.statusLabel;
    gaugeLabel.className = `protection-label ${score.status}`;
  }
  if (gaugeFill) {
    gaugeFill.style.setProperty("--score", score.total);
  }

  // Update category bars
  const categoryList = container.querySelector("[data-protection-categories]");
  if (categoryList) {
    categoryList.innerHTML = Object.entries(score.categories)
      .map(
        ([key, cat]) => `
        <div class="protection-category" data-status="${cat.status}">
          <div class="category-header">
            <span class="category-name">${escapeHtml(cat.name)}</span>
            <span class="category-score">${cat.score}/${cat.max}</span>
          </div>
          <div class="category-bar">
            <div class="category-fill" style="width: ${(cat.score / cat.max) * 100}%"></div>
          </div>
        </div>
      `
      )
      .join("");
  }

  // Update issues
  const issuesList = container.querySelector("[data-protection-issues]");
  if (issuesList) {
    if (score.issues.length === 0) {
      issuesList.innerHTML = '<li class="protection-issue good"><span>No critical issues found</span></li>';
    } else {
      issuesList.innerHTML = score.issues
        .map(
          (issue) =>
            `<li class="protection-issue ${escapeHtml(issue.severity)}"><span>${escapeHtml(issue.text)}</span><span class="severity ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span></li>`
        )
        .join("");
    }
  }

  // Update tips
  const tipsList = container.querySelector("[data-protection-tips]");
  if (tipsList) {
    if (score.tips.length === 0) {
      tipsList.innerHTML = '<li class="protection-tip">Keep up the great work!</li>';
    } else {
      tipsList.innerHTML = score.tips.map((tip) => `<li class="protection-tip">${escapeHtml(tip)}</li>`).join("");
    }
  }
}

// Legacy vulnerability panel (calls new Protection Check)
function updateVulnerabilityPanel() {
  updateProtectionCheck();

  // Also update legacy elements if they exist
  const vulnList = document.querySelector("[data-vulnerability-list]");
  const vulnScore = document.querySelector("[data-vulnerability-score]");
  if (!vulnList && !vulnScore) return;

  const score = calculateProtectionScore();

  if (vulnList) {
    if (score.issues.length === 0) {
      vulnList.innerHTML = '<li class="vuln-item"><span>No major vulnerabilities detected</span><span class="severity low">Good</span></li>';
    } else {
      vulnList.innerHTML = score.issues
        .map((v) => `<li class="vuln-item"><span>${escapeHtml(v.text)}</span><span class="severity ${escapeHtml(v.severity)}">${escapeHtml(v.severity)}</span></li>`)
        .join("");
    }
  }

  if (vulnScore) {
    vulnScore.textContent = score.statusLabel;
  }
}

// Smart Alerts System
function generateSmartAlerts() {
  const alerts = [];
  const snapshot = getFinanceSnapshot();
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // Bill due alerts
  const activeBills = (state.bills || []).filter((b) => b.active);
  activeBills.forEach((bill) => {
    const dueDay = bill.dueDay;
    let daysUntilDue;

    if (dueDay >= currentDay) {
      daysUntilDue = dueDay - currentDay;
    } else {
      daysUntilDue = daysInMonth - currentDay + dueDay;
    }

    if (daysUntilDue <= bill.reminderDays) {
      const dueText = daysUntilDue === 0 ? "Due today" : daysUntilDue === 1 ? "Due tomorrow" : `Due in ${daysUntilDue} days`;
      alerts.push({
        type: "bill",
        title: `${bill.name} payment`,
        subtitle: `${formatCurrency(bill.amount)} ${dueText}`,
        severity: daysUntilDue === 0 ? "high" : daysUntilDue <= 2 ? "medium" : "low",
        icon: "calendar",
        action: bill.autoPay ? "Auto-pay enabled" : "Manual payment needed",
      });
    }
  });

  // Budget health alerts
  if (snapshot.surplus < 0) {
    const deficit = Math.abs(snapshot.surplus);
    alerts.push({
      type: "budget",
      title: "Budget deficit this month",
      subtitle: `${formatCurrency(deficit)} over budget`,
      severity: "high",
      icon: "alert-triangle",
      action: "Review expenses",
    });
  }

  // Savings rate alert
  const savingsRate = snapshot.income > 0 ? snapshot.surplus / snapshot.income : 0;
  if (savingsRate > 0 && savingsRate < 0.1) {
    alerts.push({
      type: "savings",
      title: "Low savings rate",
      subtitle: `${Math.round(savingsRate * 100)}% of income saved`,
      severity: "medium",
      icon: "piggy-bank",
      action: "Aim for 10-20%",
    });
  }

  // Emergency fund alerts
  const bufferMonths = snapshot.expenses > 0 ? snapshot.savings / snapshot.expenses : 0;
  if (bufferMonths < 1 && snapshot.expenses > 0) {
    alerts.push({
      type: "emergency",
      title: "Emergency fund critical",
      subtitle: `${bufferMonths.toFixed(1)} months of expenses saved`,
      severity: "high",
      icon: "shield-alert",
      action: "Build to 1 month minimum",
    });
  } else if (bufferMonths < 3 && bufferMonths >= 1) {
    alerts.push({
      type: "emergency",
      title: "Emergency fund needs attention",
      subtitle: `${bufferMonths.toFixed(1)} months buffer`,
      severity: "medium",
      icon: "shield",
      action: "Target 3-6 months",
    });
  }

  // Goal milestone alerts
  const goals = state.goals || [];
  goals.forEach((g) => {
    if (!g.target || g.target <= 0) return;

    const progress = g.saved / g.target;
    const eta = calculateGoalETA(g);

    // Goal almost reached (90%+)
    if (progress >= 0.9 && progress < 1) {
      const remaining = g.target - g.saved;
      alerts.push({
        type: "goal-milestone",
        title: `${g.name} almost reached!`,
        subtitle: `${formatCurrency(remaining)} to go`,
        severity: "low",
        icon: "flag",
        action: "Nearly there!",
      });
    }

    // Goal completed
    if (progress >= 1) {
      alerts.push({
        type: "goal-complete",
        title: `${g.name} completed!`,
        subtitle: `${formatCurrency(g.target)} goal reached`,
        severity: "success",
        icon: "check-circle",
        action: "Celebrate!",
      });
    }

    // Goal behind schedule
    if (eta.status === "behind" && g.targetDate) {
      alerts.push({
        type: "goal-behind",
        title: `${g.name} behind schedule`,
        subtitle: `Increase to ${formatCurrency(eta.requiredMonthly || 0)}/month`,
        severity: "medium",
        icon: "clock",
        action: "Adjust contribution",
      });
    }
  });

  // Subscription audit suggestion (if total subscriptions > 5% of income)
  const totalSubscriptions = activeBills.filter((b) => b.category === "subscription").reduce((sum, b) => sum + b.amount, 0);
  if (snapshot.income > 0 && totalSubscriptions > snapshot.income * 0.05) {
    alerts.push({
      type: "subscription",
      title: "High subscription spend",
      subtitle: `${formatCurrency(totalSubscriptions)}/month on subscriptions`,
      severity: "low",
      icon: "scissors",
      action: "Review and trim",
    });
  }

  // Sort alerts by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2, success: 3 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

function getAlertIcon(iconName) {
  const icons = {
    calendar: `
      <defs>
        <linearGradient id="al-teal-cal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="al-gold-cal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect x="3" y="5" width="14" height="14" rx="2" fill="url(#al-teal-cal)"/>
      <path d="M7 3v4M13 3v4M3 10h14" stroke="url(#al-teal-cal)" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 10a4 4 0 00-4 4v2h8v-2a4 4 0 00-4-4z" fill="url(#al-gold-cal)"/>
      <circle cx="18" cy="10" r="1.5" fill="url(#al-gold-cal)"/>`,
    "alert-triangle": `
      <defs>
        <linearGradient id="al-pink-tri" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" fill="url(#al-pink-tri)"/>
      <path d="M12 9v4M12 16h.01" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    "piggy-bank": `
      <defs>
        <linearGradient id="al-pink-pig" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <ellipse cx="11" cy="14" rx="7" ry="5" fill="url(#al-pink-pig)" opacity="0.7"/>
      <circle cx="16" cy="11" r="3.5" fill="url(#al-pink-pig)" opacity="0.7"/>
      <ellipse cx="19" cy="12" rx="1.8" ry="1.2" fill="#fda4af"/>
      <circle cx="16.5" cy="9.5" r="0.8" fill="#1d3557"/>
      <path d="M15 11.5q2-1 4 0" stroke="#1d3557" stroke-width="0.8" stroke-linecap="round" fill="none"/>`,
    shield: `
      <defs>
        <linearGradient id="al-teal-sh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <path d="M12 2l8 4v6c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V6l8-4z" fill="url(#al-teal-sh)"/>
      <path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    "shield-alert": `
      <defs>
        <linearGradient id="al-teal-sha" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="al-pink-sha" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <path d="M12 2l8 4v6c0 5.5-3.5 10-8 12-4.5-2-8-6.5-8-12V6l8-4z" fill="url(#al-teal-sha)"/>
      <path d="M12 8v4M12 16h.01" stroke="url(#al-pink-sha)" stroke-width="2" stroke-linecap="round"/>`,
    flag: `
      <defs>
        <linearGradient id="al-teal-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="al-navy-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
        <linearGradient id="al-gold-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M5 4v18" stroke="url(#al-navy-fl)" stroke-width="2" stroke-linecap="round"/>
      <path d="M5 4h12l-3 5 3 5H5" fill="url(#al-teal-fl)"/>
      <circle cx="3" cy="3" r="1" fill="url(#al-gold-fl)"/>
      <circle cx="19" cy="6" r="0.8" fill="url(#al-gold-fl)"/>`,
    "check-circle": `
      <defs>
        <linearGradient id="al-teal-ch" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="al-gold-ch" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#al-teal-ch)"/>
      <circle cx="8.5" cy="10" r="1.2" fill="#1d3557"/>
      <circle cx="15.5" cy="10" r="1.2" fill="#1d3557"/>
      <path d="M8 15c2 2 6 2 8 0" stroke="#1d3557" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <path d="M8 12l2.5 2.5L16 9" stroke="url(#al-gold-ch)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    clock: `
      <defs>
        <linearGradient id="al-navy-cl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
        <linearGradient id="al-gold-cl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#al-navy-cl)" opacity="0.2"/>
      <circle cx="12" cy="12" r="9" fill="none" stroke="url(#al-navy-cl)" stroke-width="2"/>
      <path d="M12 6v6l4 2" stroke="url(#al-gold-cl)" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="url(#al-gold-cl)"/>`,
    scissors: `
      <defs>
        <linearGradient id="al-teal-sc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="al-pink-sc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <circle cx="6" cy="6" r="3" fill="url(#al-teal-sc)"/>
      <circle cx="6" cy="18" r="3" fill="url(#al-teal-sc)"/>
      <path d="M20 4l-12 12M14.5 14.5L20 20M8.12 8.12L12 12" stroke="url(#al-pink-sc)" stroke-width="2" stroke-linecap="round"/>`,
  };
  return icons[iconName] || icons.calendar;
}

function updateAlertList() {
  const alertList = document.querySelector("[data-alert-list]");
  const alertCount = document.querySelector("[data-alert-count]");
  if (!alertList) return;

  const alerts = generateSmartAlerts();

  // Update count badge if exists
  if (alertCount) {
    const urgentCount = alerts.filter((a) => a.severity === "high" || a.severity === "medium").length;
    alertCount.textContent = urgentCount > 0 ? urgentCount : "";
    alertCount.style.display = urgentCount > 0 ? "flex" : "none";
  }

  if (alerts.length === 0) {
    alertList.innerHTML = `
      <li class="alert-item all-clear">
        <div class="alert-icon success">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="alert-content">
          <p class="alert-title">All clear</p>
          <p class="alert-subtitle">No alerts at this time</p>
        </div>
      </li>
    `;
  } else {
    alertList.innerHTML = alerts
      .map(
        (a) => `
        <li class="alert-item ${escapeHtml(a.severity)}">
          <div class="alert-icon ${escapeHtml(a.severity)}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${getAlertIcon(a.icon)}
            </svg>
          </div>
          <div class="alert-content">
            <p class="alert-title">${escapeHtml(a.title)}</p>
            <p class="alert-subtitle">${escapeHtml(a.subtitle)}</p>
          </div>
          <span class="alert-action">${escapeHtml(a.action)}</span>
        </li>
      `
      )
      .join("");
  }
}

// Bills management
function updateBillsList() {
  const billsList = document.querySelector("[data-bills-list]");
  const billsTotal = document.querySelector("[data-bills-total]");
  if (!billsList) return;

  const bills = state.bills || [];
  const activeBills = bills.filter((b) => b.active);
  const totalMonthly = activeBills.reduce((sum, b) => {
    switch (b.frequency) {
      case "weekly":
        return sum + b.amount * 4.33;
      case "quarterly":
        return sum + b.amount / 3;
      case "yearly":
        return sum + b.amount / 12;
      default:
        return sum + b.amount;
    }
  }, 0);

  if (billsTotal) {
    billsTotal.textContent = formatCurrency(totalMonthly);
  }

  if (bills.length === 0) {
    billsList.innerHTML = `
      <li class="bill-item empty">
        <p>No recurring bills added</p>
        <button type="button" class="btn small" data-add-bill>Add your first bill</button>
      </li>
    `;
  } else {
    const categoryIcons = {
      subscription: "tv",
      utility: "zap",
      insurance: "shield",
      loan: "credit-card",
      rent: "home",
      other: "file-text",
    };

    billsList.innerHTML = bills
      .map(
        (bill, idx) => `
        <li class="bill-item ${bill.active ? "" : "inactive"}" data-bill-id="${escapeHtml(bill.id)}">
          <div class="bill-icon ${escapeHtml(bill.category)}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${getBillIcon(categoryIcons[bill.category] || "file-text")}
            </svg>
          </div>
          <div class="bill-info">
            <p class="bill-name">${escapeHtml(bill.name)}</p>
            <p class="bill-meta">Day ${bill.dueDay} &middot; ${escapeHtml(bill.frequency)}${bill.autoPay ? " &middot; Auto-pay" : ""}</p>
          </div>
          <div class="bill-amount">${formatCurrency(bill.amount)}</div>
          <button type="button" class="bill-delete" data-delete-bill="${idx}" aria-label="Delete bill">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </li>
      `
      )
      .join("");
  }

  attachBillListeners();
}

function getBillIcon(iconName) {
  const icons = {
    tv: '<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    "credit-card": '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    "file-text": '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  };
  return icons[iconName] || icons["file-text"];
}

function attachBillListeners() {
  // Add bill button
  document.querySelectorAll("[data-add-bill]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showAddBillModal();
    });
  });

  // Delete bill buttons
  document.querySelectorAll("[data-delete-bill]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.dataset.deleteBill, 10);
      if (!isNaN(idx) && state.bills[idx]) {
        state.bills.splice(idx, 1);
        scheduleSave();
        updateBillsList();
        updateAlertList();
      }
    });
  });
}

function showAddBillModal() {
  // Simple prompt-based addition for now
  const name = prompt("Bill name (e.g., Netflix, Electricity):");
  if (!name || !name.trim()) return;

  const amountStr = prompt("Amount (£):");
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount");
    return;
  }

  const dueDayStr = prompt("Due day of month (1-31):");
  const dueDay = parseInt(dueDayStr, 10);
  if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
    alert("Please enter a valid day (1-31)");
    return;
  }

  const categoryChoice = prompt("Category:\n1. Subscription\n2. Utility\n3. Insurance\n4. Loan\n5. Rent\n6. Other\n\nEnter number (1-6):");
  const categories = ["subscription", "utility", "insurance", "loan", "rent", "other"];
  const categoryIdx = parseInt(categoryChoice, 10) - 1;
  const category = categories[categoryIdx] || "other";

  const autoPay = confirm("Is this bill on auto-pay?");

  const newBill = {
    id: `bill-${Date.now()}`,
    name: name.trim(),
    amount,
    dueDay,
    category,
    frequency: "monthly",
    autoPay,
    reminderDays: 3,
    active: true,
    createdAt: Date.now(),
  };

  state.bills.push(newBill);
  scheduleSave();
  updateBillsList();
  updateAlertList();
}

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

let hasUnsavedChanges = false;

function markUnsavedChanges() {
  hasUnsavedChanges = true;
}

function clearUnsavedChanges() {
  hasUnsavedChanges = false;
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

  // Statement import handlers
  const statementDropzone = document.querySelector("[data-statement-dropzone]");
  const statementFileInput = document.querySelector("[data-statement-file]");
  const statementApply = document.querySelector("[data-statement-apply]");
  const statementClear = document.querySelector("[data-statement-clear]");

  if (statementDropzone) {
    statementDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      statementDropzone.classList.add("drag-over");
    });

    statementDropzone.addEventListener("dragleave", () => {
      statementDropzone.classList.remove("drag-over");
    });

    statementDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      statementDropzone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) handleStatementFile(file);
    });

    statementDropzone.addEventListener("click", () => {
      statementFileInput?.click();
    });
  }

  if (statementFileInput) {
    statementFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleStatementFile(file);
    });
  }

  if (statementApply) {
    statementApply.addEventListener("click", applyStatementToBudget);
  }

  if (statementClear) {
    statementClear.addEventListener("click", clearStatementImport);
  }

  // Beforeunload handler to prevent data loss
  window.addEventListener("beforeunload", (e) => {
    if (hasUnsavedChanges) {
      saveLocalState();
    }
  });
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
  updateQuickActions();
  handleDailyCheckIn();
  updateRewardsUI();

  await loadFxRates();
  updateConverter();

  await initFirebase();

  // Initial Monte Carlo
  setTimeout(updateMonteCarlo, 500);
}

attachEventListeners();
init();
