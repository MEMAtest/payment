// PHASE 3: HOUSEHOLD & SHARING - STORAGE HELPERS
// ============================================================

const HOUSEHOLD_MEMBERS_KEY = "consumerpay_household_members_v1";
const SHARED_EXPENSES_KEY = "consumerpay_shared_expenses_v1";
const SHARED_GOALS_KEY = "consumerpay_shared_goals_v1";
const SETTLEMENTS_KEY = "consumerpay_settlements_v1";

const EXPENSE_ICONS = {
  housing: "🏠",
  utilities: "⚡",
  groceries: "🛒",
  subscriptions: "📺",
  transport: "🚗",
  dining: "🍽️",
  other: "📄",
};

function loadHouseholdMembers() {
  try {
    const stored = localStorage.getItem(HOUSEHOLD_MEMBERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveHouseholdMembers(members) {
  localStorage.setItem(HOUSEHOLD_MEMBERS_KEY, JSON.stringify(members));
}

function generateMemberId() {
  return generateSecureId("member");
}

function loadSharedExpenses() {
  try {
    const stored = localStorage.getItem(SHARED_EXPENSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveSharedExpenses(expenses) {
  localStorage.setItem(SHARED_EXPENSES_KEY, JSON.stringify(expenses));
}

function generateSharedExpenseId() {
  return generateSecureId("shexp");
}

function loadSharedGoals() {
  try {
    const stored = localStorage.getItem(SHARED_GOALS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveSharedGoals(goals) {
  localStorage.setItem(SHARED_GOALS_KEY, JSON.stringify(goals));
}

function generateSharedGoalId() {
  return generateSecureId("shgoal");
}

function loadSettlements() {
  try {
    const stored = localStorage.getItem(SETTLEMENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveSettlements(settlements) {
  localStorage.setItem(SETTLEMENTS_KEY, JSON.stringify(settlements));
}
