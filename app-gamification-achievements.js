// GAMIFICATION & ACHIEVEMENTS - BADGE CHECKS
// ============================================================

// Check and unlock achievements
function checkAchievements() {
  const achievements = loadAchievements();
  const newUnlocks = [];

  // Helper to unlock a badge
  const unlock = (badgeId) => {
    if (!achievements.unlocked.includes(badgeId) && BADGES[badgeId]) {
      achievements.unlocked.push(badgeId);
      achievements.totalPoints += getBadgePoints(BADGES[badgeId].tier);
      newUnlocks.push(BADGES[badgeId]);
    }
  };

  // Profile complete check
  if (state.annualSalary > 0 && state.income > 0 && calculateMonthlyExpenses() > 0) {
    unlock("profileComplete");
  }

  // First goal check
  if (state.goals && state.goals.length > 0) {
    unlock("firstGoal");
  }

  // Savings milestones
  const liquidAssets = (state.assets.cashSavings || 0) + (state.assets.cashISA || 0);
  if (liquidAssets >= 1000) unlock("saved1k");
  if (liquidAssets >= 5000) unlock("saved5k");
  if (liquidAssets >= 10000) unlock("saved10k");

  // Emergency fund milestones
  const monthlyExpenses = calculateMonthlyExpenses();
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  if (monthsCovered >= 3) unlock("emergencyFund3");
  if (monthsCovered >= 6) unlock("emergencyFund6");

  // Net worth milestones
  const netWorth = calculateNetWorth();
  if (netWorth > 0) unlock("netWorthPositive");
  if (netWorth >= 10000) unlock("netWorth10k");
  if (netWorth >= 50000) unlock("netWorth50k");
  if (netWorth >= 100000) unlock("netWorth100k");

  // Debt freedom
  const hasFinancialData =
    state.income > 0 || calculateMonthlyExpenses() > 0 || calculateTotalLiabilities() > 0;
  const creditCardDebt = state.liabilities.creditCardBalance || 0;
  const consumerDebt =
    creditCardDebt +
    (state.liabilities.personalLoansBalance || 0) +
    (state.liabilities.carFinanceBalance || 0) +
    (state.liabilities.overdraftBalance || 0);

  if (hasFinancialData && creditCardDebt === 0 && state.expenses.creditCards === 0) {
    unlock("creditCardFree");
  }
  if (hasFinancialData && consumerDebt === 0) {
    unlock("debtFree");
  }

  // Health score milestones
  const healthScore = calculateHealthScore();
  if (healthScore.total >= 50) unlock("score50");
  if (healthScore.total >= 70) unlock("score70");
  if (healthScore.total >= 85) unlock("score85");

  // Streak milestones
  if (achievements.streak >= 7) unlock("streak7");
  if (achievements.streak >= 30) unlock("streak30");
  if (achievements.streak >= 90) unlock("streak90");

  // Challenge milestones
  if (achievements.challengesCompleted >= 1) unlock("challengeComplete");
  if (achievements.challengesCompleted >= 5) unlock("challenges5");

  // Save and return new unlocks
  saveAchievements(achievements);
  return newUnlocks;
}
