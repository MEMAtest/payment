// PHASE 3: HOUSEHOLD & SHARING - MEMBERS
// ============================================================

function renderHouseholdMembers() {
  const container = document.querySelector("[data-members-list]");
  if (!container) return;

  const members = loadHouseholdMembers();
  const yourIncome = state.income || 0;
  const yourName = state.name || "You";

  let html = `
    <div class="member-item you">
      <div class="member-avatar">👤</div>
      <div class="member-info">
        <span class="member-name">${escapeHtml(yourName)}</span>
        <span class="member-role">Primary</span>
      </div>
      <div class="member-contribution">${formatCurrency(yourIncome)}/month</div>
    </div>
  `;

  members.forEach((member) => {
    const incomeDisplay = member.income ? `${formatCurrency(member.income)}/month` : "Not set";
    const contributionDisplay = member.contribution
      ? `Contributes ${formatCurrency(member.contribution)}`
      : "";
    html += `
      <div class="member-item" data-member-id="${escapeHtml(member.id)}">
        <div class="member-avatar">${
          member.relationship === "partner"
            ? "💑"
            : member.relationship === "family"
              ? "👨‍👩‍👧"
              : "🏠"
        }</div>
        <div class="member-info">
          <span class="member-name">${escapeHtml(member.name)}</span>
          <span class="member-role">${escapeHtml(member.relationship)}${
            contributionDisplay ? ` • ${contributionDisplay}` : ""
          }</span>
        </div>
        <div class="member-contribution">${incomeDisplay}</div>
        <button class="btn ghost small" type="button" data-remove-member="${escapeHtml(member.id)}">×</button>
      </div>
    `;
  });

  if (members.length === 0) {
    html +=
      '<p class="muted add-member-prompt">Add a partner or housemate to split bills and track shared expenses</p>';
  }

  container.innerHTML = html;

  // Attach remove handlers
  container.querySelectorAll("[data-remove-member]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirmed = await showConfirmation(
        "Are you sure you want to remove this household member?",
        "Remove Member",
        "Remove",
        "Cancel",
      );
      if (confirmed) {
        removeMember(btn.getAttribute("data-remove-member"));
        showNotification("Household member removed", "success");
      }
    });
  });
}

function updateHouseholdSummary() {
  const members = loadHouseholdMembers();
  const yourIncome = state.income || 0;
  // Use member income field if set, otherwise fall back to contribution for backwards compatibility
  const memberIncome = members.reduce((sum, m) => sum + (m.income || m.contribution || 0), 0);
  const combinedIncome = yourIncome + memberIncome;

  const sharedExpenses = loadSharedExpenses();
  const totalShared = sharedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const yourNetWorth = calculateTotalAssets() - calculateTotalLiabilities();

  const incomeEl = document.querySelector("[data-household-income]");
  const expensesEl = document.querySelector("[data-household-expenses]");
  const networthEl = document.querySelector("[data-household-networth]");

  if (incomeEl) incomeEl.textContent = formatCurrency(combinedIncome);
  if (expensesEl) expensesEl.textContent = formatCurrency(totalShared);
  if (networthEl) networthEl.textContent = formatCurrency(yourNetWorth);

  // Update paid by dropdown
  const paidBySelect = document.querySelector("[data-shared-paid-by]");
  if (paidBySelect) {
    const yourName = state.name || "You";
    paidBySelect.innerHTML = `<option value="you">${escapeHtml(yourName)}</option>`;
    members.forEach((m) => {
      paidBySelect.innerHTML += `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`;
    });
  }
}

function openMemberModal() {
  const modal = document.querySelector("[data-member-modal]");
  if (modal) {
    document.querySelector("[data-member-form]")?.reset();
    modal.hidden = false;
  }
}

function closeMemberModal() {
  const modal = document.querySelector("[data-member-modal]");
  if (modal) modal.hidden = true;
}

function saveMemberFromForm() {
  const name = document.querySelector("[data-member-name]")?.value?.trim();
  const income = parseFloat(document.querySelector("[data-member-income]")?.value) || 0;
  const contribution = parseFloat(document.querySelector("[data-member-contribution]")?.value) || 0;
  const relationship = document.querySelector("[data-member-relationship]")?.value || "partner";

  if (!name) {
    showNotification("Please enter a name", "warning");
    return;
  }

  const members = loadHouseholdMembers();
  members.push({
    id: generateMemberId(),
    name,
    income,
    contribution,
    relationship,
  });

  saveHouseholdMembers(members);
  closeMemberModal();
  updateHouseholdUI();
  showNotification(`${name} added to household`, "success");
}

function removeMember(id) {
  const members = loadHouseholdMembers().filter((m) => m.id !== id);
  saveHouseholdMembers(members);
  updateHouseholdUI();
}
