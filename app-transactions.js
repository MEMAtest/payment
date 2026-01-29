// PHASE 1: MANUAL TRANSACTION ENTRY
// ============================================================

const TRANSACTIONS_STORAGE_KEY = "consumerpay_transactions_v1";
let currentTransactionType = "expense";
let transactionsDelegationAttached = false;

const CATEGORY_ICONS = {
  mortgage: "🏠", councilTax: "🏛️", homeInsurance: "🔒",
  energy: "⚡", water: "💧", internet: "📶",
  fuel: "⛽", publicTransport: "🚌", carInsurance: "🚗",
  groceries: "🛒", diningOut: "🍽️", coffeeSnacks: "☕",
  clothing: "👕", personalCare: "💅", entertainment: "🎬",
  subscriptions: "📺", gym: "💪", other: "📄"
};

function loadTransactions() {
  try {
    const stored = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveTransactions(transactions) {
  localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
  state.transactions = transactions;
  scheduleSave();
}

function generateTransactionId() {
  return generateSecureId('txn');
}

function addTransaction(transaction) {
  const transactions = loadTransactions();
  transactions.unshift({
    id: generateTransactionId(),
    ...transaction,
    createdAt: new Date().toISOString()
  });
  saveTransactions(transactions);
  updateTransactionsUI();
}

function deleteTransaction(id) {
  const transactions = loadTransactions().filter(t => t.id !== id);
  saveTransactions(transactions);
  updateTransactionsUI();
}

function renderTransactionsSummary() {
  const transactions = loadTransactions();
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthTransactions = transactions.filter(t => {
    const txnDate = new Date(t.date);
    return txnDate.getMonth() === currentMonth && txnDate.getFullYear() === currentYear;
  });

  const spending = monthTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const income = monthTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const net = income - spending;

  const spendingEl = document.querySelector("[data-month-spending]");
  const incomeEl = document.querySelector("[data-month-income]");
  const netEl = document.querySelector("[data-month-net]");

  if (spendingEl) spendingEl.textContent = formatCurrency(spending);
  if (incomeEl) incomeEl.textContent = formatCurrency(income);
  if (netEl) {
    netEl.textContent = formatCurrency(Math.abs(net));
    netEl.className = `balance-value ${net >= 0 ? "positive" : "negative"}`;
    netEl.textContent = (net >= 0 ? "+" : "-") + formatCurrency(Math.abs(net));
  }
}

function renderTransactionsList(filterCategory = "all") {
  const container = document.querySelector("[data-transactions-list]");
  if (!container) return;

  let transactions = loadTransactions();

  if (filterCategory !== "all") {
    transactions = transactions.filter(t => t.category === filterCategory);
  }

  // Show last 20 transactions
  transactions = transactions.slice(0, 20);

  if (transactions.length === 0) {
    container.innerHTML = '<p class="muted">No transactions yet. Add your first transaction above.</p>';
    return;
  }

  container.innerHTML = transactions.map(txn => {
    const icon = CATEGORY_ICONS[txn.category] || "📄";
    const date = new Date(txn.date);
    const formattedDate = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return `
      <div class="transaction-item" data-txn-id="${escapeHtml(txn.id)}">
        <div class="transaction-icon ${txn.type}">${escapeHtml(icon)}</div>
        <div class="transaction-info">
          <div class="transaction-desc">${escapeHtml(txn.description || txn.category)}</div>
          <div class="transaction-meta">${formattedDate} • ${escapeHtml(txn.paymentMethod || "card")}</div>
        </div>
        <div class="transaction-amount ${txn.type}">
          ${txn.type === "expense" ? "-" : "+"}${formatCurrency(txn.amount)}
        </div>
        <button class="btn ghost small" type="button" data-delete-txn="${escapeHtml(txn.id)}">×</button>
      </div>
    `;
  }).join("");
  ensureTransactionsDelegation(container);
}

function ensureTransactionsDelegation(container) {
  if (transactionsDelegationAttached || !container) return;

  container.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest("[data-delete-txn]");
    if (!deleteBtn) return;

    const confirmed = await showConfirmation(
      "Are you sure you want to delete this transaction?",
      "Delete Transaction",
      "Delete",
      "Cancel"
    );
    if (!confirmed) return;

    const id = deleteBtn.getAttribute("data-delete-txn");
    if (id) {
      deleteTransaction(id);
      showNotification("Transaction deleted successfully", "success");
    }
  });

  transactionsDelegationAttached = true;
}

function updateTransactionsUI() {
  renderTransactionsSummary();
  renderTransactionsList();
}

function initTransactions() {
  state.transactions = loadTransactions();

  // Set default date to today
  const dateInput = document.querySelector("[data-txn-date]");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  // Transaction type toggle
  document.querySelectorAll("[data-txn-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-txn-type]").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentTransactionType = btn.getAttribute("data-txn-type");
    });
  });

  // Save transaction
  document.querySelector("[data-save-transaction]")?.addEventListener("click", () => {
    const amount = parseFloat(document.querySelector("[data-txn-amount]")?.value) || 0;
    const category = document.querySelector("[data-txn-category]")?.value || "other";
    const date = document.querySelector("[data-txn-date]")?.value || new Date().toISOString().split("T")[0];
    const paymentMethod = document.querySelector("[data-txn-method]")?.value || "card";
    const description = document.querySelector("[data-txn-description]")?.value?.trim() || "";

    if (amount <= 0) {
      showNotification("Please enter a valid amount", "warning");
      return;
    }

    addTransaction({
      amount,
      category,
      date,
      paymentMethod,
      description,
      type: currentTransactionType
    });

    // Reset form
    document.querySelector("[data-txn-amount]").value = "";
    document.querySelector("[data-txn-description]").value = "";
    document.querySelector("[data-txn-date]").value = new Date().toISOString().split("T")[0];
  });

  // Add button in header
  document.querySelector("[data-add-transaction]")?.addEventListener("click", () => {
    document.querySelector("[data-txn-amount]")?.focus();
  });

  // Category filter
  document.querySelector("[data-txn-filter-category]")?.addEventListener("change", (e) => {
    renderTransactionsList(e.target.value);
  });

  // Initial render
  updateTransactionsUI();
}

// Expose transaction functions globally for cross-module access
Object.assign(window, {
  initTransactions,
});

// ============================================================
