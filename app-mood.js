const MOOD_STORAGE_KEY = "consumerpay_mood_history";

function getMoodHistory() {
  try {
    const data = localStorage.getItem(MOOD_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMoodEntry(mood) {
  const history = getMoodHistory();
  const today = new Date().toISOString().split("T")[0];

  // Remove any existing entry for today
  const filtered = history.filter(entry => entry.date !== today);
  filtered.push({ date: today, mood, timestamp: Date.now() });

  // Keep last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = filtered.filter(entry => entry.timestamp > cutoff);

  localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(recent));

  // Award points for logging mood
  state.rewardPoints += 5;
  scheduleSave();

  return recent;
}

function getTodaysMood() {
  const history = getMoodHistory();
  const today = new Date().toISOString().split("T")[0];
  const todayEntry = history.find(entry => entry.date === today);
  return todayEntry?.mood || null;
}

function updateMoodChart() {
  const chart = document.querySelector("[data-mood-chart]");
  const insight = document.querySelector("[data-mood-insight]");
  if (!chart) return;

  const history = getMoodHistory();
  const last7Days = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const entry = history.find(e => e.date === dateStr);
    const dayName = date.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);
    last7Days.push({
      day: dayName,
      mood: entry?.mood || 0,
    });
  }

  chart.innerHTML = last7Days
    .map(d => `<div class="mood-bar ${d.mood ? `level-${d.mood}` : ""}" data-day="${d.day}"></div>`)
    .join("");

  // Calculate insight
  const validMoods = last7Days.filter(d => d.mood > 0);
  if (validMoods.length === 0) {
    if (insight) insight.textContent = "Log your mood to see trends";
  } else {
    const avg = validMoods.reduce((sum, d) => sum + d.mood, 0) / validMoods.length;
    const trend = validMoods.length >= 3
      ? validMoods.slice(-3).reduce((sum, d) => sum + d.mood, 0) / 3 - validMoods.slice(0, 3).reduce((sum, d) => sum + d.mood, 0) / Math.min(3, validMoods.length)
      : 0;

    let insightText = `Average mood: ${avg.toFixed(1)}/5. `;
    if (trend > 0.5) insightText += "You're feeling more confident lately!";
    else if (trend < -0.5) insightText += "Your mood has dipped - check your spending patterns.";
    else insightText += "Staying steady. Keep tracking!";

    if (insight) insight.textContent = insightText;
  }
}

function initMoodTracker() {
  const selector = document.querySelector("[data-mood-selector]");
  if (!selector) return;

  const todaysMood = getTodaysMood();

  selector.querySelectorAll(".mood-btn").forEach(btn => {
    const mood = parseInt(btn.dataset.mood, 10);

    if (mood === todaysMood) {
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
    } else {
      btn.setAttribute("aria-pressed", "false");
    }

    btn.addEventListener("click", () => {
      selector.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("active"));
      selector.querySelectorAll(".mood-btn").forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      saveMoodEntry(mood);
      updateMoodChart();
      updateRewardsUI();
      if (typeof showNotification === "function") {
        showNotification("Mood saved", "success");
      }
    });
  });

  updateMoodChart();
}

// Expose mood tracker functions globally
Object.assign(window, {
  initMoodTracker,
});

// Financial Literacy Hub
