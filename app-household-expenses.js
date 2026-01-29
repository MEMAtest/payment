// PHASE 3: HOUSEHOLD & SHARING - SHARED EXPENSES
// ============================================================

function calculateSplitBalance() {
  const expenses = loadSharedExpenses();
  const members = loadHouseholdMembers();

  let youOwe = 0;
  let youAreOwed = 0;

  expenses.forEach((expense) => {
    const yourShare = expense.amount / 2; // Simple 50/50 for now

    if (expense.paidBy === "you") {
      youAreOwed += yourShare;
    } else {
      youOwe += yourShare;
    }
  });

  const net = youAreOwed - youOwe;

  return { youOwe, youAreOwed, net };
}

function renderSplitSummary() {
  const container = document.querySelector("[data-split-summary]");
  if (!container) return;

  const balance = calculateSplitBalance();
  const members = loadHouseholdMembers();

  if (members.length === 0) {
    container.innerHTML = `
      <div class="split-balance">
        <span class="balance-status">Add household members to split expenses</span>
      </div>
    `;
    return;
  }

  let status;
  let statusClass;
  if (Math.abs(balance.net) < 1) {
    status = "All settled up";
    statusClass = "settled";
  } else if (balance.net > 0) {
    status = `You are owed ${formatCurrency(balance.net)}`;
    statusClass = "owed";
  } else {
    status = `You owe ${formatCurrency(Math.abs(balance.net))}`;
    statusClass = "owes";
  }

  container.innerHTML = `
    <div class="split-balance">
      <span class="balance-status ${statusClass}">${status}</span>
    </div>
  `;

  // Show/hide settle up button
  const settleBtn = document.querySelector("[data-settle-up]");
  if (settleBtn) {
    settleBtn.hidden = Math.abs(balance.net) < 1;
  }
}

function renderSharedExpenses() {
  const container = document.querySelector("[data-shared-expenses]");
  if (!container) return;

  const expenses = loadSharedExpenses();
  const members = loadHouseholdMembers();

  if (expenses.length === 0) {
    container.innerHTML =
      '<p class="muted">No shared expenses yet. Add your first shared expense to start splitting bills.</p>';
    return;
  }

  container.innerHTML = expenses
    .map((expense) => {
      const icon = EXPENSE_ICONS[expense.category] || "📄";
      const paidByName =
        expense.paidBy === "you"
          ? state.name || "You"
          : members.find((m) => m.id === expense.paidBy)?.name || "Unknown";
      const yourShare = expense.amount / 2;

      return `
      <div class="shared-expense-item" data-expense-id="${escapeHtml(expense.id)}">
        <div class="expense-icon ${escapeHtml(expense.category)}">${escapeHtml(icon)}</div>
        <div class="expense-info">
          <h4>${escapeHtml(expense.name)}</h4>
          <div class="expense-meta">Paid by ${escapeHtml(paidByName)} • ${escapeHtml(expense.frequency)}</div>
        </div>
        <div class="expense-amount">
          <div class="expense-total">${formatCurrency(expense.amount)}</div>
          <div class="expense-split">Your share: ${formatCurrency(yourShare)}</div>
        </div>
        <button class="btn ghost small" type="button" data-delete-expense="${escapeHtml(expense.id)}">×</button>
      </div>
    `;
    })
    .join("");

  // Attach delete handlers
  container.querySelectorAll("[data-delete-expense]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirmation(
        "Are you sure you want to remove this shared expense?",
        "Remove Expense",
        "Remove",
        "Cancel",
      );
      if (confirmed) {
        deleteSharedExpense(btn.getAttribute("data-delete-expense"));
        showNotification("Shared expense removed", "success");
      }
    });
  });
}

function openSharedExpenseModal(preset = null) {
  const modal = document.querySelector("[data-shared-expense-modal]");
  const form = document.querySelector("[data-shared-expense-form]");
  if (!modal || !form) return;

  form.reset();

  if (preset) {
    const presets = {
      rent: { name: "Monthly Rent/Mortgage", category: "housing", amount: "" },
      utilities: { name: "Utilities (Energy, Water, Internet)", category: "utilities", amount: "" },
      groceries: { name: "Weekly Groceries", category: "groceries", amount: "" },
      streaming: { name: "Streaming Services", category: "subscriptions", amount: "" },
    };

    const p = presets[preset];
    if (p) {
      document.querySelector("[data-shared-name]").value = p.name;
      document.querySelector("[data-shared-category]").value = p.category;
    }
  }

  modal.hidden = false;
}

function closeSharedExpenseModal() {
  const modal = document.querySelector("[data-shared-expense-modal]");
  if (modal) modal.hidden = true;
}

function saveSharedExpenseFromForm() {
  const name = document.querySelector("[data-shared-name]")?.value?.trim();
  const amount = parseFloat(document.querySelector("[data-shared-amount]")?.value) || 0;
  const category = document.querySelector("[data-shared-category]")?.value || "other";
  const splitType = document.querySelector("[data-shared-split-type]")?.value || "equal";
  const paidBy = document.querySelector("[data-shared-paid-by]")?.value || "you";
  const frequency = document.querySelector("[data-shared-frequency]")?.value || "monthly";

  if (!name || amount <= 0) {
    showNotification("Please fill in all required fields", "warning");
    return;
  }

  const expenses = loadSharedExpenses();
  expenses.push({
    id: generateSharedExpenseId(),
    name,
    amount,
    category,
    splitType,
    paidBy,
    frequency,
    createdAt: new Date().toISOString(),
  });

  saveSharedExpenses(expenses);
  closeSharedExpenseModal();
  updateSharedExpensesUI();
}

function deleteSharedExpense(id) {
  const expenses = loadSharedExpenses().filter((e) => e.id !== id);
  saveSharedExpenses(expenses);
  updateSharedExpensesUI();
}

function updateSharedExpensesUI() {
  renderSplitSummary();
  renderSharedExpenses();
  updateHouseholdSummary();
}
