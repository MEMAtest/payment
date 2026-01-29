// GAMIFICATION & ACHIEVEMENTS - STORAGE + CORE HELPERS
// ============================================================

// Load achievements from storage
function loadAchievements() {
  try {
    const stored = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // ignore
  }
  return {
    unlocked: [],
    streak: 0,
    lastVisit: null,
    totalPoints: 0,
    challengesCompleted: 0,
  };
}

// Save achievements to storage
function saveAchievements(data) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

// Load active challenges
function loadChallenges() {
  try {
    const stored = localStorage.getItem(CHALLENGES_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    // ignore
  }
  return {
    active: [],
    completed: [],
    month: null,
  };
}

// Save challenges
function saveChallenges(data) {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(data));
  } catch (e) {
    // ignore
  }
}

// Get points for badge tier
function getBadgePoints(tier) {
  const points = { bronze: 50, silver: 100, gold: 200 };
  return points[tier] || 50;
}

// Update streak tracking
function updateStreak() {
  const achievements = loadAchievements();
  const today = new Date().toDateString();

  if (achievements.lastVisit === today) {
    // Already visited today
    return achievements.streak;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (achievements.lastVisit === yesterday.toDateString()) {
    // Consecutive day - increase streak
    achievements.streak += 1;
  } else if (achievements.lastVisit !== today) {
    // Streak broken - reset
    achievements.streak = 1;
  }

  achievements.lastVisit = today;
  saveAchievements(achievements);

  return achievements.streak;
}
