// PHASE 1: BILL CALENDAR & REMINDERS
// ============================================================

const BILLS_STORAGE_KEY = "consumerpay_bills_v1";
let currentCalendarDate = new Date();

const BILL_ICONS = {
  utilities: "⚡",
  subscriptions: "📺",
  insurance: "🛡️",
  loans: "💳",
  housing: "🏠",
  transport: "🚗",
  other: "📄"
};

function loadBills() {
  try {
    const stored = localStorage.getItem(BILLS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveBills(bills) {
  localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(bills));
  state.bills = bills;
  scheduleSave();
}

function generateBillId() {
  return generateSecureId('bill');
}

function getBillDueDate(bill, month, year) {
  const dueDay = Math.min(bill.dueDay, new Date(year, month + 1, 0).getDate());
  return new Date(year, month, dueDay);
}

function getBillStatus(bill) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = getBillDueDate(bill, today.getMonth(), today.getFullYear());
  const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  if (bill.isPaid) return { status: "paid", label: "Paid", class: "paid" };
  if (diffDays < 0) return { status: "overdue", label: "Overdue", class: "overdue" };
  if (diffDays === 0) return { status: "today", label: "Due Today", class: "overdue" };
  if (diffDays === 1) return { status: "tomorrow", label: "Tomorrow", class: "tomorrow" };
  if (diffDays <= 7) return { status: "this-week", label: `${diffDays} days`, class: "this-week" };
  return { status: "upcoming", label: `${diffDays} days`, class: "" };
}

let upcomingBillsDelegationAttached = false;
let allBillsDelegationAttached = false;

function renderBillsCalendar() {
  const grid = document.querySelector("[data-calendar-grid]");
  const monthLabel = document.querySelector("[data-calendar-month]");
  if (!grid || !monthLabel) return;

  const bills = loadBills();
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const today = new Date();

  monthLabel.textContent = new Date(year, month).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let html = days.map(d => `<div class="calendar-day-header">${d}</div>`).join("");

  // Previous month days
  const prevMonth = new Date(year, month, 0);
  for (let i = startDay - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month">${prevMonth.getDate() - i}</div>`;
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    const billsOnDay = bills.filter(b => b.dueDay === day);
    const hasBills = billsOnDay.length > 0;
    const allPaid = hasBills && billsOnDay.every(b => b.isPaid);

    let classes = "calendar-day";
    if (isToday) classes += " today";
    if (hasBills) classes += " has-bills";
    if (allPaid) classes += " all-paid";

    html += `<div class="${classes}" data-day="${day}">
      ${day}
      ${hasBills ? '<span class="bill-dot"></span>' : ""}
    </div>`;
  }

  // Next month days
  const remainingDays = 42 - (startDay + lastDay.getDate());
  for (let i = 1; i <= remainingDays; i++) {
    html += `<div class="calendar-day other-month">${i}</div>`;
  }

  grid.innerHTML = html;
}

function renderBillsSummary() {
  const bills = loadBills();
  const totalEl = document.querySelector("[data-bills-total]");
  const paidEl = document.querySelector("[data-bills-paid]");
  const remainingEl = document.querySelector("[data-bills-remaining]");

  const total = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const paid = bills.filter(b => b.isPaid).reduce((sum, b) => sum + (b.amount || 0), 0);
  const remaining = total - paid;

  if (totalEl) totalEl.textContent = formatCurrency(total);
  if (paidEl) paidEl.textContent = formatCurrency(paid);
  if (remainingEl) remainingEl.textContent = formatCurrency(remaining);
}

function renderUpcomingBills() {
  const container = document.querySelector("[data-bills-upcoming]");
  if (!container) return;

  const bills = loadBills();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = bills
    .filter(b => !b.isPaid)
    .map(b => ({
      ...b,
      dueDate: getBillDueDate(b, today.getMonth(), today.getFullYear()),
      statusInfo: getBillStatus(b)
    }))
    .filter(b => {
      const diffDays = Math.ceil((b.dueDate - today) / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0;
    })
    .sort((a, b) => a.dueDate - b.dueDate);

  if (upcoming.length === 0) {
    container.innerHTML = '<p class="muted">No bills due this week</p>';
    return;
  }

  container.innerHTML = upcoming.map(bill => `
    <div class="bill-item ${bill.statusInfo.class}" data-bill-id="${escapeHtml(bill.id)}">
      <div class="bill-icon ${escapeHtml(bill.category)}">${escapeHtml(BILL_ICONS[bill.category] || "📄")}</div>
      <div class="bill-info">
        <div class="bill-name">${escapeHtml(bill.name)}</div>
        <div class="bill-meta">${escapeHtml(bill.frequency)} • Due ${bill.dueDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}</div>
      </div>
      <div class="bill-amount">${formatCurrency(bill.amount)}</div>
      <div class="bill-status">
        <span class="bill-due-badge ${bill.statusInfo.class}">${escapeHtml(bill.statusInfo.label)}</span>
        <button class="bill-check" type="button" data-mark-paid="${escapeHtml(bill.id)}" title="Mark as paid">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </button>
      </div>
    </div>
  `).join("");
  ensureUpcomingBillsDelegation(container);
}

function renderAllBills() {
  const container = document.querySelector("[data-bills-all]");
  if (!container) return;

  const bills = loadBills();

  if (bills.length === 0) {
    container.innerHTML = '<p class="muted">No bills added yet.</p>';
    return;
  }

  const sortedBills = [...bills].sort((a, b) => a.dueDay - b.dueDay);

  container.innerHTML = sortedBills.map(bill => {
    const statusInfo = getBillStatus(bill);
    return `
      <div class="bill-item ${statusInfo.class} ${bill.isPaid ? "paid" : ""}" data-bill-id="${escapeHtml(bill.id)}">
        <div class="bill-icon ${escapeHtml(bill.category)}">${escapeHtml(BILL_ICONS[bill.category] || "📄")}</div>
        <div class="bill-info">
          <div class="bill-name">${escapeHtml(bill.name)}</div>
          <div class="bill-meta">${escapeHtml(bill.frequency)} • Due on ${bill.dueDay}${getOrdinalSuffix(bill.dueDay)}</div>
        </div>
        <div class="bill-amount">${formatCurrency(bill.amount)}</div>
        <div class="bill-actions">
          <button class="btn ghost small" type="button" data-edit-bill="${escapeHtml(bill.id)}">Edit</button>
          <button class="btn ghost small" type="button" data-delete-bill="${escapeHtml(bill.id)}">Delete</button>
        </div>
      </div>
    `;
  }).join("");
  ensureAllBillsDelegation(container);
}

function ensureUpcomingBillsDelegation(container) {
  if (upcomingBillsDelegationAttached || !container) return;

  container.addEventListener("click", (event) => {
    const markPaidBtn = event.target.closest("[data-mark-paid]");
    if (!markPaidBtn) return;
    const id = markPaidBtn.getAttribute("data-mark-paid");
    if (id) {
      markBillAsPaid(id);
    }
  });

  upcomingBillsDelegationAttached = true;
}

function ensureAllBillsDelegation(container) {
  if (allBillsDelegationAttached || !container) return;

  container.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-edit-bill]");
    if (editBtn) {
      const id = editBtn.getAttribute("data-edit-bill");
      if (id) openBillModal(id);
      return;
    }

    const deleteBtn = event.target.closest("[data-delete-bill]");
    if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-delete-bill");
      if (id) deleteBill(id);
    }
  });

  allBillsDelegationAttached = true;
}

function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function markBillAsPaid(billId) {
  const bills = loadBills();
  const bill = bills.find(b => b.id === billId);
  if (bill) {
    bill.isPaid = true;
    bill.lastPaidDate = new Date().toISOString();
    saveBills(bills);
    updateBillsUI();
  }
}

async function deleteBill(billId) {
  const confirmed = await showConfirmation("Are you sure you want to delete this bill?", "Delete Bill", "Delete", "Cancel");
  if (!confirmed) return;
  const bills = loadBills().filter(b => b.id !== billId);
  saveBills(bills);
  updateBillsUI();
  showNotification("Bill deleted successfully", "success");
}

function openBillModal(billId = null) {
  const modal = document.querySelector("[data-bill-modal]");
  const title = document.querySelector("[data-bill-modal-title]");
  const form = document.querySelector("[data-bill-form]");
  if (!modal || !form) return;

  form.reset();
  document.querySelector("[data-bill-id]").value = "";

  if (billId) {
    const bills = loadBills();
    const bill = bills.find(b => b.id === billId);
    if (bill) {
      title.textContent = "Edit Bill";
      document.querySelector("[data-bill-id]").value = bill.id;
      document.querySelector("[data-bill-name]").value = bill.name;
      document.querySelector("[data-bill-amount]").value = bill.amount;
      document.querySelector("[data-bill-category]").value = bill.category;
      document.querySelector("[data-bill-due-day]").value = bill.dueDay;
      document.querySelector("[data-bill-frequency]").value = bill.frequency;
    }
  } else {
    title.textContent = "Add New Bill";
  }

  modal.hidden = false;
}

function closeBillModal() {
  const modal = document.querySelector("[data-bill-modal]");
  if (modal) modal.hidden = true;
}

function saveBillFromForm() {
  const id = document.querySelector("[data-bill-id]").value;
  const name = document.querySelector("[data-bill-name]").value.trim();
  const amount = parseFloat(document.querySelector("[data-bill-amount]").value) || 0;
  const category = document.querySelector("[data-bill-category]").value;
  const dueDay = parseInt(document.querySelector("[data-bill-due-day]").value) || 1;
  const frequency = document.querySelector("[data-bill-frequency]").value;

  if (!name || amount <= 0 || dueDay < 1 || dueDay > 31) {
    showNotification("Please fill in all required fields correctly.", "warning");
    return;
  }

  const bills = loadBills();

  if (id) {
    const index = bills.findIndex(b => b.id === id);
    if (index !== -1) {
      bills[index] = { ...bills[index], name, amount, category, dueDay, frequency };
    }
  } else {
    bills.push({
      id: generateBillId(),
      name,
      amount,
      category,
      dueDay,
      frequency,
      isPaid: false,
      lastPaidDate: null
    });
  }

  saveBills(bills);
  closeBillModal();
  updateBillsUI();
}

function updateBillsUI() {
  renderBillsCalendar();
  renderBillsSummary();
  renderUpcomingBills();
  renderAllBills();
}

function initBillCalendar() {
  // Load bills into state
  state.bills = loadBills();

  // Add Bill button
  document.querySelector("[data-add-bill]")?.addEventListener("click", () => openBillModal());

  // Close modal buttons
  document.querySelectorAll("[data-close-bill-modal]").forEach(btn => {
    btn.addEventListener("click", closeBillModal);
  });

  // Form submission
  document.querySelector("[data-bill-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveBillFromForm();
  });

  // Calendar navigation
  document.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderBillsCalendar();
  });

  document.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderBillsCalendar();
  });

  // Initial render
  updateBillsUI();

  // Reset paid status at start of new month
  checkBillsMonthReset();
}

function checkBillsMonthReset() {
  const bills = loadBills();
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${today.getMonth()}`;

  bills.forEach(bill => {
    if (bill.lastPaidDate) {
      const paidDate = new Date(bill.lastPaidDate);
      const paidMonth = `${paidDate.getFullYear()}-${paidDate.getMonth()}`;
      if (paidMonth !== currentMonth && bill.frequency === "monthly") {
        bill.isPaid = false;
      }
    }
  });

  saveBills(bills);
}

// Expose bill calendar functions globally for cross-module access
Object.assign(window, {
  loadBills,
  saveBills,
  initBillCalendar,
});

// ============================================================
