// GAMIFICATION & ACHIEVEMENTS - UI
// ============================================================

// Show badge unlock celebration
function showBadgeUnlock(badge) {
  const modal = document.querySelector("[data-celebration-modal]");
  if (!modal) return;

  const iconEl = modal.querySelector("[data-celebration-icon]");
  const titleEl = modal.querySelector("[data-celebration-title]");
  const messageEl = modal.querySelector("[data-celebration-message]");
  const badgeNameEl = modal.querySelector("[data-badge-name]");
  const badgeDescEl = modal.querySelector("[data-badge-desc]");
  const badgeIconEl = modal.querySelector(".badge-icon");

  if (iconEl) iconEl.textContent = badge.icon;
  if (titleEl) titleEl.textContent = "Badge Unlocked!";
  if (messageEl) messageEl.textContent = badge.name;
  if (badgeNameEl) badgeNameEl.textContent = badge.name;
  if (badgeDescEl) badgeDescEl.textContent = badge.description;
  if (badgeIconEl) badgeIconEl.textContent = badge.icon;

  // Hide stats for badge unlock
  const statsEl = modal.querySelector("[data-celebration-stats]");
  if (statsEl) statsEl.style.display = "none";

  modal.hidden = false;

  // Trigger confetti
  triggerConfetti();
}

// Trigger confetti animation
function triggerConfetti() {
  const container = document.querySelector("[data-confetti-container]");
  if (!container) return;

  // Create confetti pieces using DocumentFragment for better performance
  const colors = ["#259d91", "#f4c542", "#e86c5f", "#9f7aea", "#48bb78"];
  const fragment = document.createDocumentFragment();
  const pieces = [];

  for (let i = 0; i < 50; i += 1) {
    const confetti = document.createElement("div");
    confetti.className = "confetti-piece";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;
    fragment.appendChild(confetti);
    pieces.push(confetti);
  }

  container.appendChild(fragment); // Single DOM reflow

  // Remove all pieces after animation
  setTimeout(() => {
    pieces.forEach((p) => p.remove());
  }, 4000);
}

// Update gamification UI elements
function updateGamificationUI() {
  const achievements = loadAchievements();
  const challenges = getCurrentChallenges();

  // Update streak display
  const streakEl = document.querySelector("[data-streak-count]");
  if (streakEl) {
    streakEl.textContent = achievements.streak;
  }

  // Update points display
  const pointsEl = document.querySelector("[data-total-points]");
  if (pointsEl) {
    pointsEl.textContent = achievements.totalPoints;
  }

  // Update badges display
  const badgesListEl = document.querySelector("[data-badges-list]");
  if (badgesListEl) {
    const unlockedBadges = achievements.unlocked
      .map((id) => BADGES[id])
      .filter(Boolean)
      .slice(-8); // Show last 8

    if (unlockedBadges.length === 0) {
      badgesListEl.innerHTML = '<p class="no-badges">Complete actions to unlock badges</p>';
    } else {
      badgesListEl.innerHTML = unlockedBadges
        .map(
          (badge) => `
        <div class="badge-item ${badge.tier}">
          <span class="badge-icon">${escapeHtml(badge.icon)}</span>
          <span class="badge-name">${escapeHtml(badge.name)}</span>
        </div>
      `,
        )
        .join("");
    }
  }

  // Update badges count
  const badgesCountEl = document.querySelector("[data-badges-count]");
  if (badgesCountEl) {
    badgesCountEl.textContent = `${achievements.unlocked.length}/${Object.keys(BADGES).length}`;
  }

  // Update challenges display
  const challengesListEl = document.querySelector("[data-challenges-list]");
  if (challengesListEl) {
    challengesListEl.innerHTML = challenges.active
      .map(
        (challenge) => `
      <div class="challenge-card ${
        ["active", "in-progress", "completed"].includes(challenge.status)
          ? challenge.status
          : "active"
      }">
        <span class="challenge-icon">${escapeHtml(challenge.icon)}</span>
        <div class="challenge-info">
          <h4>${escapeHtml(challenge.name)}</h4>
          <p>${escapeHtml(challenge.description)}</p>
          <span class="challenge-points">+${parseInt(challenge.points, 10) || 0} pts</span>
        </div>
        <div class="challenge-actions">
          ${
            challenge.status === "active"
              ? `
            <button class="btn small" type="button" data-challenge-action="accept" data-challenge-id="${escapeHtml(challenge.id)}">Accept</button>
          `
              : challenge.status === "in-progress"
                ? `
            <button class="btn small primary" type="button" data-challenge-action="complete" data-challenge-id="${escapeHtml(challenge.id)}">Complete</button>
          `
                : ""
          }
        </div>
      </div>
    `,
      )
      .join("");

    // Attach event listeners for challenge buttons
    challengesListEl.querySelectorAll("[data-challenge-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-challenge-action");
        const id = btn.getAttribute("data-challenge-id");
        if (action === "accept") acceptChallenge(id);
        else if (action === "complete") completeChallenge(id);
      });
    });
  }
}
