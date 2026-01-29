// GAMIFICATION & ACHIEVEMENTS - CHALLENGES
// ============================================================

// Get current month's challenges
function getCurrentChallenges() {
  const currentMonth = getCurrentMonthKey();
  let challenges = loadChallenges();

  // Reset challenges for new month
  if (challenges.month !== currentMonth) {
    // Pick 3 random challenges for this month
    const shuffled = [...MONTHLY_CHALLENGES].sort(() => 0.5 - Math.random());
    challenges = {
      active: shuffled.slice(0, 3).map((c) => ({
        ...c,
        status: "active",
        acceptedAt: null,
      })),
      completed: [],
      month: currentMonth,
    };
    saveChallenges(challenges);
  }

  return challenges;
}

// Accept a challenge
function acceptChallenge(challengeId) {
  const challenges = getCurrentChallenges();
  const challenge = challenges.active.find((c) => c.id === challengeId);

  if (challenge && !challenge.acceptedAt) {
    challenge.acceptedAt = new Date().toISOString();
    challenge.status = "in-progress";
    saveChallenges(challenges);
    updateGamificationUI();
  }
}

// Complete a challenge
function completeChallenge(challengeId) {
  const challenges = getCurrentChallenges();
  const challengeIndex = challenges.active.findIndex((c) => c.id === challengeId);

  if (challengeIndex >= 0) {
    const challenge = challenges.active[challengeIndex];
    challenge.status = "completed";
    challenge.completedAt = new Date().toISOString();

    challenges.active.splice(challengeIndex, 1);
    challenges.completed.push(challenge);
    saveChallenges(challenges);

    // Update achievements
    const achievements = loadAchievements();
    achievements.challengesCompleted += 1;
    achievements.totalPoints += challenge.points;
    saveAchievements(achievements);

    // Check for new badges
    const newBadges = checkAchievements();
    if (newBadges.length > 0) {
      showBadgeUnlock(newBadges[0]);
    }

    updateGamificationUI();
  }
}
