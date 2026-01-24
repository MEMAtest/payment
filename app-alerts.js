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
