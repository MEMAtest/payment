// GAMIFICATION & ACHIEVEMENTS - INIT
// ============================================================

// Initialize gamification
function initGamification() {
  // Update streak
  updateStreak();

  // Check for achievements
  const newBadges = checkAchievements();

  // Show first new badge if any
  if (newBadges.length > 0) {
    setTimeout(() => showBadgeUnlock(newBadges[0]), 1000);
  }

  // Load challenges
  getCurrentChallenges();

  // Update UI (event listeners are attached in updateGamificationUI)
  updateGamificationUI();
}

// Expose gamification functions globally for cross-module access
Object.assign(window, {
  initGamification,
});
