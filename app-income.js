// PHASE 2: MULTI-INCOME TRACKING
// ============================================================

const INCOME_SOURCES_KEY = "consumerpay_income_sources_v1";

const INCOME_ICONS = {
  salary: "💼",
  freelance: "💻",
  rental: "🏠",
  dividends: "📈",
  interest: "🏦",
  benefits: "📋",
  pension: "👴",
  "side-hustle": "🚀",
  other: "📄"
};

function loadIncomeSources() {
  try {
    const stored = localStorage.getItem(INCOME_SOURCES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveIncomeSources(sources) {
  localStorage.setItem(INCOME_SOURCES_KEY, JSON.stringify(sources));
}

function generateIncomeId() {
  return generateSecureId('income');
}

function calculateDiversificationScore(sources) {
  const totalSources = sources.length + 1; // +1 for primary salary
  const primarySalary = state.income || 0;
  const otherIncome = sources.reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
  const totalIncome = primarySalary + otherIncome;

  if (totalIncome === 0) return { score: 0, label: "Low", percent: 0 };

  // Calculate concentration ratio (Herfindahl-like)
  const primaryRatio = primarySalary / totalIncome;
  const sourceRatios = sources.map(s => (s.monthlyAmount || 0) / totalIncome);

  // If primary is over 90%, low diversification
  if (primaryRatio > 0.9) {
    return { score: 1, label: "Low", percent: 15 };
  } else if (primaryRatio > 0.7) {
    return { score: 2, label: "Medium", percent: 45 };
  } else if (primaryRatio > 0.5) {
    return { score: 3, label: "Good", percent: 70 };
  } else {
    return { score: 4, label: "Excellent", percent: 90 };
  }
}

function renderIncomeSources() {
  const container = document.querySelector("[data-income-sources]");
  if (!container) return;

  const sources = loadIncomeSources();
  const primarySalary = state.income || 0;
  const totalOther = sources.reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
  const totalIncome = primarySalary + totalOther;

  const primaryPercent = totalIncome > 0 ? Math.round((primarySalary / totalIncome) * 100) : 100;

  let html = `
    <div class="income-source primary">
      <div class="source-icon salary">${escapeHtml(INCOME_ICONS.salary)}</div>
      <div class="source-info">
        <span class="source-name">Primary Salary</span>
        <span class="source-meta">Monthly • PAYE</span>
      </div>
      <div class="source-amount">${formatCurrency(primarySalary)}</div>
      <div class="source-percent">${primaryPercent}%</div>
    </div>
  `;

  sources.forEach(source => {
    const percent = totalIncome > 0 ? Math.round((source.monthlyAmount / totalIncome) * 100) : 0;
    const icon = INCOME_ICONS[source.type] || INCOME_ICONS.other;

    html += `
      <div class="income-source" data-income-source-id="${escapeHtml(source.id)}">
        <div class="source-icon ${escapeHtml(source.type)}">${escapeHtml(icon)}</div>
        <div class="source-info">
          <span class="source-name">${escapeHtml(source.name)}</span>
          <span class="source-meta">${escapeHtml(source.frequency)} ${source.taxable ? '• Taxable' : ''}</span>
        </div>
        <div class="source-amount">${formatCurrency(source.monthlyAmount)}</div>
        <div class="source-percent">${percent}%</div>
        <button class="btn ghost small" type="button" data-delete-income="${escapeHtml(source.id)}">×</button>
      </div>
    `;
  });

  if (sources.length === 0) {
    html += '<p class="muted add-prompt">Add additional income sources to improve your diversification score</p>';
  }

  container.innerHTML = html;

  // Attach delete handlers
  container.querySelectorAll("[data-delete-income]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirmation("Are you sure you want to remove this income source?", "Remove Income Source", "Remove", "Cancel");
      if (confirmed) {
        deleteIncomeSource(btn.getAttribute("data-delete-income"));
        showNotification("Income source removed", "success");
      }
    });
  });
}

function updateIncomeUI() {
  const sources = loadIncomeSources();
  const primarySalary = state.income || 0;
  const totalOther = sources.reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
  const totalIncome = primarySalary + totalOther;

  // Total income
  const totalEl = document.querySelector("[data-total-income]");
  if (totalEl) totalEl.textContent = formatCurrency(totalIncome);

  // Primary salary display
  const salaryEl = document.querySelector("[data-primary-salary]");
  if (salaryEl) salaryEl.textContent = formatCurrency(primarySalary);

  // Diversification
  const diversification = calculateDiversificationScore(sources);
  const fillEl = document.querySelector("[data-diversification-fill]");
  const scoreEl = document.querySelector("[data-diversification-score]");

  if (fillEl) fillEl.style.width = diversification.percent + "%";
  if (scoreEl) {
    scoreEl.textContent = diversification.label;
    scoreEl.className = "diversification-value " + diversification.label.toLowerCase();
  }

  renderIncomeSources();
}

function openIncomeModal(incomeId = null) {
  const modal = document.querySelector("[data-income-modal]");
  const form = document.querySelector("[data-income-form]");
  const title = document.querySelector("[data-income-modal-title]");
  if (!modal || !form) return;

  form.reset();
  document.querySelector("[data-income-id]").value = "";

  if (incomeId) {
    const sources = loadIncomeSources();
    const source = sources.find(s => s.id === incomeId);
    if (source) {
      title.textContent = "Edit Income Source";
      document.querySelector("[data-income-id]").value = source.id;
      document.querySelector("[data-income-name]").value = source.name;
      document.querySelector("[data-income-amount]").value = source.monthlyAmount;
      document.querySelector("[data-income-type]").value = source.type;
      document.querySelector("[data-income-frequency]").value = source.frequency;
      document.querySelector("[data-income-taxable]").checked = source.taxable;
    }
  } else {
    title.textContent = "Add Income Source";
    const sources = loadIncomeSources();
    if (sources.length === 0 && state.income > 0) {
      document.querySelector("[data-income-name]").value = "Primary Salary";
      document.querySelector("[data-income-amount]").value = state.income;
      document.querySelector("[data-income-type]").value = "salary";
      document.querySelector("[data-income-frequency]").value = "monthly";
    }
  }

  modal.hidden = false;
}

function closeIncomeModal() {
  const modal = document.querySelector("[data-income-modal]");
  if (modal) modal.hidden = true;
}

function saveIncomeFromForm() {
  const id = document.querySelector("[data-income-id]").value;
  const name = document.querySelector("[data-income-name]").value.trim();
  const monthlyAmount = parseFloat(document.querySelector("[data-income-amount]").value) || 0;
  const type = document.querySelector("[data-income-type]").value;
  const frequency = document.querySelector("[data-income-frequency]").value;
  const taxable = document.querySelector("[data-income-taxable]").checked;

  if (!name || monthlyAmount <= 0) {
    showNotification("Please fill in all required fields.", "warning");
    return;
  }

  const sources = loadIncomeSources();

  if (id) {
    const index = sources.findIndex(s => s.id === id);
    if (index !== -1) {
      sources[index] = { ...sources[index], name, monthlyAmount, type, frequency, taxable };
    }
  } else {
    sources.push({
      id: generateIncomeId(),
      name,
      monthlyAmount,
      type,
      frequency,
      taxable
    });
  }

  saveIncomeSources(sources);
  closeIncomeModal();
  updateIncomeUI();
}

function deleteIncomeSource(id) {
  const sources = loadIncomeSources().filter(s => s.id !== id);
  saveIncomeSources(sources);
  updateIncomeUI();
}

function initIncomeSources() {
  document.querySelector("[data-add-income]")?.addEventListener("click", () => openIncomeModal());

  document.querySelectorAll("[data-close-income-modal]").forEach(btn => {
    btn.addEventListener("click", closeIncomeModal);
  });

  document.querySelector("[data-income-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveIncomeFromForm();
  });

  updateIncomeUI();
}

// Expose income functions globally for cross-module access
Object.assign(window, {
  initIncomeSources,
});

// ============================================================
