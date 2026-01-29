// PHASE 3: HOUSEHOLD & SHARING - SETTLEMENTS
// ============================================================

function settleUp() {
  const balance = calculateSplitBalance();
  if (Math.abs(balance.net) < 1) return;

  const settlements = loadSettlements();
  settlements.unshift({
    date: new Date().toISOString(),
    amount: Math.abs(balance.net),
    direction: balance.net > 0 ? "received" : "paid",
  });

  saveSettlements(settlements.slice(0, 20)); // Keep last 20

  // Clear shared expenses (mark as settled)
  saveSharedExpenses([]);

  updateSharedExpensesUI();
  renderSettlementHistory();
}

function renderSettlementHistory() {
  const container = document.querySelector("[data-settlement-history]");
  if (!container) return;

  const settlements = loadSettlements();

  if (settlements.length === 0) {
    container.innerHTML =
      '<p class="muted">No settlements yet. Settle up when someone owes money.</p>';
    return;
  }

  container.innerHTML = settlements
    .slice(0, 5)
    .map(
      (s) => `
    <div class="settlement-item">
      <div class="settlement-info">
        <span class="settlement-amount ${s.direction === "received" ? "positive" : "negative"}">
          ${s.direction === "received" ? "+" : "-"}${formatCurrency(s.amount)}
        </span>
        <span class="settlement-date">${new Date(s.date).toLocaleDateString("en-GB")}</span>
      </div>
      <span class="muted">${s.direction === "received" ? "Received" : "Paid"}</span>
    </div>
  `,
    )
    .join("");
}
