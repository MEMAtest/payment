// ============================================================
// ONE-CLICK ACTIONS: STATEMENT IMPORT WIDGET
// ============================================================

const STATEMENT_CATEGORIES = {
  groceries: {
    name: "Groceries",
    color: "#22c55e",
    keywords: [
      "tesco",
      "sainsbury",
      "asda",
      "aldi",
      "lidl",
      "morrisons",
      "waitrose",
      "co-op",
      "ocado",
      "grocery",
    ],
    expenseKey: "groceries",
  },
  utilities: {
    name: "Utilities",
    color: "#3b82f6",
    keywords: [
      "british gas",
      "edf",
      "eon",
      "octopus",
      "bulb",
      "scottish power",
      "water",
      "electric",
      "gas bill",
      "thames",
    ],
    expenseKey: "energy",
  },
  transport: {
    name: "Transport",
    color: "#f59e0b",
    keywords: [
      "tfl",
      "uber",
      "bolt",
      "shell",
      "bp",
      "esso",
      "petrol",
      "fuel",
      "train",
      "rail",
      "bus",
      "parking",
    ],
    expenseKey: "fuel",
  },
  entertainment: {
    name: "Entertainment",
    color: "#8b5cf6",
    keywords: [
      "netflix",
      "spotify",
      "amazon prime",
      "disney",
      "cinema",
      "theatre",
      "pub",
      "bar",
      "restaurant",
      "deliveroo",
      "uber eats",
      "just eat",
    ],
    expenseKey: "entertainment",
  },
  shopping: {
    name: "Shopping",
    color: "#ec4899",
    keywords: [
      "amazon",
      "ebay",
      "asos",
      "primark",
      "h&m",
      "zara",
      "next",
      "john lewis",
      "argos",
      "currys",
    ],
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
    expenseKey: "mortgage",
  },
  insurance: {
    name: "Insurance",
    color: "#14b8a6",
    keywords: ["insurance", "aviva", "direct line", "admiral", "compare the market"],
    expenseKey: "homeInsurance",
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
    expenseKey: "entertainment",
  },
};

let parsedStatementData = null;
let statementActionsInitialized = false;

function parseStatementCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
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

function categorizeStatementTransaction(description) {
  const descLower = String(description || "").toLowerCase();

  for (const [key, category] of Object.entries(STATEMENT_CATEGORIES)) {
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
  const columns = parseStatementCSVLine(lines[0]);

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

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseStatementCSVLine(lines[i]);
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
      const category = categorizeStatementTransaction(description);
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
            <span class="statement-category-dot" style="background: ${STATEMENT_CATEGORIES[key]?.color || "#94a3b8"}"></span>
            ${escapeHtml(STATEMENT_CATEGORIES[key]?.name || key)}
          </span>
          <span class="statement-category-amount">${formatCurrency(amount)}</span>
        </div>
      `,
      )
      .join("");
  }

  parsedStatementData = { transactions, summary };
}

function applyStatementToBudget() {
  if (!parsedStatementData) {
    showNotification("Import a statement before applying.", "warning");
    return;
  }

  const { summary } = parsedStatementData;
  let appliedCount = 0;

  // Apply spending categories to expenses
  Object.entries(summary.categories).forEach(([catKey, amount]) => {
    const cat = STATEMENT_CATEGORIES[catKey];
    if (!cat || !cat.expenseKey) return;

    if (Object.prototype.hasOwnProperty.call(state.expenses, cat.expenseKey)) {
      // Average monthly (assume statement is ~1 month)
      state.expenses[cat.expenseKey] = Math.round(amount);
      appliedCount += 1;
    }
  });

  scheduleSave();
  refreshUI();
  awardPoints(50, "Statement import");
  checkAllBadges();

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
  parsedStatementData = null;
  const dropzone = document.querySelector("[data-statement-dropzone]");
  const preview = document.querySelector("[data-statement-preview]");
  const fileInput = document.querySelector("[data-statement-file]");

  if (dropzone) dropzone.style.display = "block";
  if (preview) preview.style.display = "none";
  if (fileInput) fileInput.value = "";
}

function handleStatementFile(file) {
  if (!file || !file.name.toLowerCase().endsWith(".csv")) {
    showNotification("Please upload a CSV file.", "warning");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showNotification("File too large. Maximum 5MB allowed.", "warning");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    const transactions = parseStatementCSV(String(text || ""));

    if (!transactions || transactions.length === 0) {
      showNotification(
        "Could not parse transactions from this file. Please check the format.",
        "error",
      );
      return;
    }

    displayStatementPreview(transactions);
  };
  reader.onerror = () => showNotification("Error reading file.", "error");
  reader.readAsText(file);
}

function initStatementActionsWidget() {
  if (statementActionsInitialized) return;
  statementActionsInitialized = true;

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
      const file = e.dataTransfer?.files?.[0];
      if (file) handleStatementFile(file);
    });

    statementDropzone.addEventListener("click", () => {
      statementFileInput?.click();
    });
  }

  if (statementFileInput) {
    statementFileInput.addEventListener("change", (e) => {
      const file = e.target?.files?.[0];
      if (file) handleStatementFile(file);
    });
  }

  if (statementApply) {
    statementApply.addEventListener("click", applyStatementToBudget);
  }

  if (statementClear) {
    statementClear.addEventListener("click", clearStatementImport);
  }
}

// Expose statement actions functions globally
Object.assign(window, {
  initStatementActionsWidget,
});
