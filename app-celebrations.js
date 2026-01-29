const CELEBRATION_STORAGE_KEY = "consumerpay_celebrated_milestones";

function getCelebratedMilestones() {
  try {
    const data = localStorage.getItem(CELEBRATION_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveCelebratedMilestone(goalName, milestone) {
  const celebrated = getCelebratedMilestones();
  if (!celebrated[goalName]) celebrated[goalName] = [];
  if (!celebrated[goalName].includes(milestone)) {
    celebrated[goalName].push(milestone);
  }
  localStorage.setItem(CELEBRATION_STORAGE_KEY, JSON.stringify(celebrated));
}

function checkGoalMilestones() {
  const celebrated = getCelebratedMilestones();

  state.goals.forEach(goal => {
    if (!goal.target || goal.target === 0) return;

    const progress = Math.round((goal.saved / goal.target) * 100);
    const goalCelebrated = celebrated[goal.name] || [];

    for (const threshold of MILESTONE_THRESHOLDS) {
      if (progress >= threshold && !goalCelebrated.includes(threshold)) {
        saveCelebratedMilestone(goal.name, threshold);

        const badges = {
          25: { icon: "🌱", badge: "Getting Started", desc: "25% of the way there!" },
          50: { icon: "🔥", badge: "Halfway Hero", desc: "50% complete - amazing!" },
          75: { icon: "⭐", badge: "Almost There", desc: "75% - the finish line is in sight!" },
          100: { icon: "🏆", badge: "Goal Crusher", desc: "100% - You did it!" },
        };

        const badgeInfo = badges[threshold];
        triggerCelebration({
          icon: badgeInfo.icon,
          title: threshold === 100 ? "Goal Achieved!" : "Milestone Reached!",
          message: `${goal.name}: ${threshold}% complete!`,
          badge: badgeInfo.badge,
          badgeDesc: badgeInfo.desc,
          progress: `${progress}%`,
          saved: formatCurrency(goal.saved),
          remaining: formatCurrency(Math.max(0, goal.target - goal.saved)),
        });

        // Award bonus points
        const bonusPoints = threshold === 100 ? 100 : threshold === 75 ? 50 : 25;
        state.rewardPoints += bonusPoints;
        scheduleSave();

        break; // Only trigger one celebration at a time
      }
    }
  });
}

function triggerCelebration(data) {
  launchConfetti();

  const modal = document.querySelector("[data-celebration-modal]");
  if (!modal) return;

  document.querySelector("[data-celebration-icon]").textContent = data.icon || "🎉";
  document.querySelector("[data-celebration-title]").textContent = data.title || "Congratulations!";
  document.querySelector("[data-celebration-message]").textContent = data.message || "You're making progress!";
  document.querySelector("[data-badge-name]").textContent = data.badge || "Achievement";
  document.querySelector("[data-badge-desc]").textContent = data.badgeDesc || "Keep going!";

  if (data.progress) {
    document.querySelector("[data-celebration-progress]").textContent = data.progress;
    document.querySelector("[data-celebration-saved]").textContent = data.saved || "£0";
    document.querySelector("[data-celebration-remaining]").textContent = data.remaining || "£0";
    document.querySelector("[data-celebration-stats]").style.display = "flex";
  } else {
    document.querySelector("[data-celebration-stats]").style.display = "none";
  }

  modal.hidden = false;
}

function closeCelebration() {
  const modal = document.querySelector("[data-celebration-modal]");
  if (modal) modal.hidden = true;
}

function launchConfetti() {
  const container = document.querySelector("[data-confetti-container]");
  if (!container) return;

  const colors = ["#fbbf24", "#2dd4bf", "#1d3557", "#ef4444", "#a855f7", "#22c55e"];
  const shapes = ["square", "circle"];

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)] === "circle" ? "50%" : "2px";
    confetti.style.width = `${Math.random() * 10 + 5}px`;
    confetti.style.height = confetti.style.width;
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;

    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 4000);
  }
}

function initCelebrations() {
  document.querySelector("[data-celebration-close]")?.addEventListener("click", closeCelebration);
  document.querySelector("[data-celebration-share]")?.addEventListener("click", () => {
    // Simple share functionality
    if (navigator.share) {
      navigator.share({
        title: "I reached a financial milestone!",
        text: "Making progress on my financial goals with Consumer Pay!",
        url: window.location.href,
      });
    } else {
      closeCelebration();
    }
  });
}

// Expose celebration functions globally
Object.assign(window, {
  initCelebrations,
  checkGoalMilestones,
});
