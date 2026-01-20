// Consumer Pay - Smart Financial Planning App
const defaultConfig = {
  fxApiUrl: "https://api.frankfurter.app/latest?from=GBP",
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

const CURRENCIES = {
  GBP: { flag: "GB", name: "British Pound", symbol: "£" },
  USD: { flag: "US", name: "US Dollar", symbol: "$" },
  EUR: { flag: "EU", name: "Euro", symbol: "€" },
  NGN: { flag: "NG", name: "Nigerian Naira", symbol: "₦" },
  GHS: { flag: "GH", name: "Ghanaian Cedi", symbol: "₵" },
  ZAR: { flag: "ZA", name: "South African Rand", symbol: "R" },
  KES: { flag: "KE", name: "Kenyan Shilling", symbol: "KSh" },
  CAD: { flag: "CA", name: "Canadian Dollar", symbol: "C$" },
};

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

let hasUnsavedChanges = false;

function markUnsavedChanges() {
  hasUnsavedChanges = true;
}

function clearUnsavedChanges() {
  hasUnsavedChanges = false;
}

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
