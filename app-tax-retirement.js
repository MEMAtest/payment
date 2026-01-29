// PHASE 4: TAX PLANNING & RETIREMENT
// ============================================================

const TAX_ALLOWANCES_KEY = "consumerpay_tax_allowances_v1";

// UK Tax Allowances 2024/25
const UK_ALLOWANCES = {
  isa: 20000,
  capitalGains: 3000,
  dividend: 500,
  personalSavingsBasic: 1000,
  personalSavingsHigher: 500,
  statePensionWeekly: 221.20 // Full new state pension 2024/25
};

function loadTaxAllowances() {
  try {
    const stored = localStorage.getItem(TAX_ALLOWANCES_KEY);
    return stored ? JSON.parse(stored) : {
      cashIsaContrib: 0,
      stocksIsaContrib: 0,
      capitalGains: 0,
      dividends: 0,
      savingsInterest: 0
    };
  } catch (e) {
    return {};
  }
}

function saveTaxAllowances(allowances) {
  localStorage.setItem(TAX_ALLOWANCES_KEY, JSON.stringify(allowances));
}

function updateTaxAllowancesUI() {
  const allowances = loadTaxAllowances();

  // ISA
  const isaUsed = (allowances.cashIsaContrib || 0) + (allowances.stocksIsaContrib || 0);
  const isaRemaining = Math.max(0, UK_ALLOWANCES.isa - isaUsed);
  const isaPercent = Math.min(100, (isaUsed / UK_ALLOWANCES.isa) * 100);

  updateAllowanceDisplay("isa", isaUsed, isaRemaining, isaPercent);

  // Capital Gains
  const cgtUsed = allowances.capitalGains || 0;
  const cgtRemaining = Math.max(0, UK_ALLOWANCES.capitalGains - cgtUsed);
  const cgtPercent = Math.min(100, (cgtUsed / UK_ALLOWANCES.capitalGains) * 100);

  updateAllowanceDisplay("cgt", cgtUsed, cgtRemaining, cgtPercent);

  // Dividends
  const divUsed = allowances.dividends || 0;
  const divRemaining = Math.max(0, UK_ALLOWANCES.dividend - divUsed);
  const divPercent = Math.min(100, (divUsed / UK_ALLOWANCES.dividend) * 100);

  updateAllowanceDisplay("dividend", divUsed, divRemaining, divPercent);

  // Personal Savings Allowance (varies by tax band)
  const annualIncome = state.annualSalary || (state.income * 12) || 0;
  const psaLimit = annualIncome > 50270 ? UK_ALLOWANCES.personalSavingsHigher : UK_ALLOWANCES.personalSavingsBasic;
  const psaUsed = allowances.savingsInterest || 0;
  const psaRemaining = Math.max(0, psaLimit - psaUsed);
  const psaPercent = Math.min(100, (psaUsed / psaLimit) * 100);

  const psaLimitEl = document.querySelector("[data-psa-limit]");
  if (psaLimitEl) psaLimitEl.textContent = `£${psaLimit.toLocaleString()}/year`;

  updateAllowanceDisplay("psa", psaUsed, psaRemaining, psaPercent);

  // Tax year countdown
  updateTaxYearCountdown();
}

function updateAllowanceDisplay(type, used, remaining, percent) {
  const progressEl = document.querySelector(`[data-${type}-progress]`);
  const usedEl = document.querySelector(`[data-${type}-used]`);
  const remainingEl = document.querySelector(`[data-${type}-remaining]`);

  if (progressEl) progressEl.style.width = `${percent}%`;
  if (usedEl) usedEl.textContent = `£${used.toLocaleString()} ${type === "cgt" ? "gains" : type === "dividend" ? "received" : type === "psa" ? "interest" : "used"}`;
  if (remainingEl) remainingEl.textContent = `£${remaining.toLocaleString()} ${type === "cgt" || type === "psa" ? "tax-free" : "remaining"}`;
}

function updateTaxYearCountdown() {
  const container = document.querySelector("[data-tax-year-countdown]");
  if (!container) return;

  const now = new Date();
  const taxYearEnd = new Date(now.getFullYear(), 3, 5); // April 5th

  if (now > taxYearEnd) {
    taxYearEnd.setFullYear(taxYearEnd.getFullYear() + 1);
  }

  const diffTime = taxYearEnd - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);

  container.innerHTML = `
    <span class="countdown-value">${diffDays}</span>
    <span class="countdown-label">days until tax year ends</span>
  `;
}

function initTaxPlanning() {
  const allowances = loadTaxAllowances();

  // Populate inputs
  document.querySelectorAll("[data-tax-input]").forEach(input => {
    const key = input.getAttribute("data-tax-input");
    if (allowances[key] !== undefined) {
      input.value = allowances[key] || "";
    }

    input.addEventListener("input", () => {
      const newAllowances = loadTaxAllowances();
      newAllowances[key] = parseFloat(input.value) || 0;
      saveTaxAllowances(newAllowances);
      updateTaxAllowancesUI();
    });
  });

  updateTaxAllowancesUI();
}

// Retirement Calculator
const RETIREMENT_KEY = "consumerpay_retirement_v1";

function loadRetirementSettings() {
  try {
    const stored = localStorage.getItem(RETIREMENT_KEY);
    return stored ? JSON.parse(stored) : {
      currentAge: 30,
      retireAge: 65,
      pensionPot: 0,
      monthlyContrib: 0,
      employerContrib: 3,
      expectedReturn: 5
    };
  } catch (e) {
    return {};
  }
}

function saveRetirementSettings(settings) {
  localStorage.setItem(RETIREMENT_KEY, JSON.stringify(settings));
}

function calculatePensionProjection(settings) {
  const yearsToRetirement = Math.max(0, settings.retireAge - settings.currentAge);
  const monthsToRetirement = yearsToRetirement * 12;
  const monthlyReturn = (settings.expectedReturn / 100) / 12;

  let pot = settings.pensionPot || 0;
  const monthlyTotal = (settings.monthlyContrib || 0) * (1 + (settings.employerContrib || 0) / 100);

  // Compound growth calculation
  for (let month = 0; month < monthsToRetirement; month++) {
    pot = pot * (1 + monthlyReturn) + monthlyTotal;
  }

  return {
    finalPot: pot,
    yearsToRetirement,
    monthlyDrawdown: pot * 0.04 / 12, // 4% safe withdrawal rate
    statePensionMonthly: UK_ALLOWANCES.statePensionWeekly * 52 / 12
  };
}

function updateRetirementUI() {
  const settings = loadRetirementSettings();
  const projection = calculatePensionProjection(settings);

  // Projected pension
  const pensionEl = document.querySelector("[data-projected-pension]");
  const yearsEl = document.querySelector("[data-pension-years]");
  if (pensionEl) pensionEl.textContent = formatCurrency(projection.finalPot);
  if (yearsEl) yearsEl.textContent = `in ${projection.yearsToRetirement} years`;

  // Monthly drawdown
  const drawdownEl = document.querySelector("[data-monthly-drawdown]");
  if (drawdownEl) drawdownEl.textContent = formatCurrency(projection.monthlyDrawdown);

  // State pension
  const statePensionEl = document.querySelector("[data-state-pension]");
  if (statePensionEl) statePensionEl.textContent = `£${UK_ALLOWANCES.statePensionWeekly.toFixed(0)}/week`;

  // Total retirement income
  const totalRetirement = projection.monthlyDrawdown + projection.statePensionMonthly;
  const totalEl = document.querySelector("[data-total-retirement]");
  if (totalEl) totalEl.textContent = formatCurrency(totalRetirement);

  // Pension gap analysis
  const currentExpenses = Object.values(state.expenses).reduce((sum, val) => sum + (val || 0), 0);
  const currentExpensesEl = document.querySelector("[data-current-expenses]");
  const retirementIncomeEl = document.querySelector("[data-retirement-income]");
  const gapResultEl = document.querySelector("[data-pension-gap-result]");

  if (currentExpensesEl) currentExpensesEl.textContent = formatCurrency(currentExpenses);
  if (retirementIncomeEl) retirementIncomeEl.textContent = formatCurrency(totalRetirement);

  if (gapResultEl) {
    const gap = totalRetirement - currentExpenses;
    if (gap >= 0) {
      gapResultEl.className = "gap-result surplus";
      gapResultEl.innerHTML = `
        <span class="result-label">Surplus</span>
        <span class="result-value">+${formatCurrency(gap)}/month</span>
      `;
    } else {
      gapResultEl.className = "gap-result shortfall";
      gapResultEl.innerHTML = `
        <span class="result-label">Shortfall</span>
        <span class="result-value">${formatCurrency(gap)}/month</span>
      `;
    }
  }

  // Retirement scenarios
  renderRetirementScenarios(settings);
}

function renderRetirementScenarios(settings) {
  const container = document.querySelector("[data-retirement-scenarios]");
  if (!container) return;

  const ages = [55, 60, 65, 67];
  const currentAge = settings.currentAge || 30;

  container.innerHTML = ages.map(age => {
    const scenarioSettings = { ...settings, retireAge: age };
    const projection = calculatePensionProjection(scenarioSettings);
    const isCurrent = age === settings.retireAge;

    return `
      <div class="scenario-card ${isCurrent ? "current" : ""}">
        <div class="scenario-age">${age}</div>
        <div class="scenario-label">years old</div>
        <div class="scenario-pot">${formatCurrency(projection.finalPot)}</div>
        <div class="scenario-monthly">${formatCurrency(projection.monthlyDrawdown)}/month</div>
      </div>
    `;
  }).join("");
}

function initRetirement() {
  const settings = loadRetirementSettings();

  // Populate inputs
  document.querySelectorAll("[data-retire-input]").forEach(input => {
    const key = input.getAttribute("data-retire-input");
    if (settings[key] !== undefined) {
      input.value = settings[key];
    }

    input.addEventListener("input", () => {
      const newSettings = loadRetirementSettings();
      newSettings[key] = parseFloat(input.value) || 0;
      saveRetirementSettings(newSettings);
      updateRetirementUI();
    });
  });

  updateRetirementUI();
}

// FIRE Calculator
const FIRE_KEY = "consumerpay_fire_v1";

function loadFireSettings() {
  try {
    const stored = localStorage.getItem(FIRE_KEY);
    return stored ? JSON.parse(stored) : {
      annualSpending: 30000,
      currentSavings: 0,
      monthlySavings: 0
    };
  } catch (e) {
    return {};
  }
}

function saveFireSettings(settings) {
  localStorage.setItem(FIRE_KEY, JSON.stringify(settings));
}

function calculateFire(settings) {
  const fireTarget = (settings.annualSpending || 30000) * 25; // 4% rule
  const currentSavings = settings.currentSavings || 0;
  const monthlySavings = settings.monthlySavings || 0;
  const annualReturn = 0.07; // 7% assumed return

  if (currentSavings >= fireTarget) {
    return { fireTarget, progress: 100, yearsToFire: 0, fireAge: null };
  }

  if (monthlySavings <= 0) {
    return { fireTarget, progress: (currentSavings / fireTarget) * 100, yearsToFire: null, fireAge: null };
  }

  // Calculate years to FIRE with compound growth
  let savings = currentSavings;
  let years = 0;
  const maxYears = 100;

  while (savings < fireTarget && years < maxYears) {
    savings = savings * (1 + annualReturn) + (monthlySavings * 12);
    years++;
  }

  const retireSettings = loadRetirementSettings();
  const currentAge = retireSettings.currentAge || 30;
  const fireAge = currentAge + years;

  return {
    fireTarget,
    progress: Math.min(100, (currentSavings / fireTarget) * 100),
    yearsToFire: years >= maxYears ? null : years,
    fireAge: years >= maxYears ? null : fireAge
  };
}

function updateFireUI() {
  const settings = loadFireSettings();
  const fire = calculateFire(settings);

  // FIRE target
  const targetEl = document.querySelector("[data-fire-target]");
  if (targetEl) targetEl.textContent = formatCurrency(fire.fireTarget);

  // Progress
  const progressEl = document.querySelector("[data-fire-progress]");
  const percentEl = document.querySelector("[data-fire-percent]");
  if (progressEl) progressEl.style.width = `${fire.progress}%`;
  if (percentEl) percentEl.textContent = `${fire.progress.toFixed(1)}%`;

  // Years to FIRE
  const yearsEl = document.querySelector("[data-fire-years]");
  if (yearsEl) {
    yearsEl.textContent = fire.yearsToFire !== null ? fire.yearsToFire : "N/A";
  }

  // FIRE age
  const ageEl = document.querySelector("[data-fire-age]");
  if (ageEl) {
    if (fire.fireAge !== null) {
      ageEl.innerHTML = `You could reach FIRE at age <span class="age-highlight">${fire.fireAge}</span>`;
    } else if (fire.progress >= 100) {
      ageEl.innerHTML = `<span class="age-highlight">You've reached FIRE!</span> Congratulations!`;
    } else {
      ageEl.innerHTML = `<span class="muted">Increase your savings rate to calculate FIRE age</span>`;
    }
  }
}

function initFire() {
  const settings = loadFireSettings();

  document.querySelectorAll("[data-fire-input]").forEach(input => {
    const key = input.getAttribute("data-fire-input");
    if (settings[key] !== undefined) {
      input.value = settings[key];
    }

    input.addEventListener("input", () => {
      const newSettings = loadFireSettings();
      newSettings[key] = parseFloat(input.value) || 0;
      saveFireSettings(newSettings);
      updateFireUI();
    });
  });

  updateFireUI();
}

function initPhase4() {
  initTaxPlanning();
  initRetirement();
  initFire();
}

// Expose phase 4 functions globally for cross-module access
Object.assign(window, {
  initPhase4,
  initTaxPlanning,
  initRetirement,
  initFire,
});

// ============================================================
