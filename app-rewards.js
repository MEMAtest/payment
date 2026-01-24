// Rewards v2 System
const REWARD_BADGES = {
  "first-goal": { name: "Goal Setter", description: "Create your first savings goal", icon: "target", points: 50 },
  "budget-master": { name: "Budget Master", description: "Set up your full budget", icon: "pie-chart", points: 100 },
  "emergency-starter": { name: "Safety Net", description: "Save 1 month of expenses", icon: "shield", points: 150 },
  "emergency-pro": { name: "Fully Protected", description: "Save 3 months of expenses", icon: "shield-check", points: 300 },
  "streak-7": { name: "Week Warrior", description: "Maintain a 7-day streak", icon: "flame", points: 75 },
  "streak-30": { name: "Monthly Master", description: "Maintain a 30-day streak", icon: "fire", points: 200 },
  "streak-100": { name: "Centurion", description: "Maintain a 100-day streak", icon: "crown", points: 500 },
  "goal-complete": { name: "Goal Crusher", description: "Complete your first goal", icon: "trophy", points: 200 },
  "debt-free": { name: "Debt Destroyer", description: "Reduce debt to under 10% of income", icon: "broken-chain", points: 250 },
  "saver-10": { name: "Smart Saver", description: "Achieve 10% savings rate", icon: "piggy-bank", points: 100 },
  "saver-20": { name: "Super Saver", description: "Achieve 20% savings rate", icon: "rocket", points: 200 },
  "bill-tracker": { name: "Bill Boss", description: "Track 5 recurring bills", icon: "calendar-check", points: 75 },
  "protection-80": { name: "Well Protected", description: "Reach 80+ protection score", icon: "award", points: 300 },
};

const REWARD_LEVELS = [
  { level: 1, name: "Starter", minPoints: 0, color: "#94a3b8" },
  { level: 2, name: "Bronze", minPoints: 200, color: "#cd7f32" },
  { level: 3, name: "Silver", minPoints: 500, color: "#c0c0c0" },
  { level: 4, name: "Gold", minPoints: 1000, color: "#ffd700" },
  { level: 5, name: "Platinum", minPoints: 2000, color: "#e5e4e2" },
  { level: 6, name: "Diamond", minPoints: 3500, color: "#b9f2ff" },
  { level: 7, name: "Master", minPoints: 5000, color: "#9333ea" },
  { level: 8, name: "Legend", minPoints: 7500, color: "#dc2626" },
  { level: 9, name: "Champion", minPoints: 10000, color: "#f59e0b" },
  { level: 10, name: "Elite", minPoints: 15000, color: "#059669" },
];

const PARTNER_OFFERS = [
  { id: "travel-5", name: "5% off Holiday Bookings", partner: "TravelSave", cost: 500, category: "travel", icon: "plane" },
  { id: "groceries-10", name: "£10 Supermarket Voucher", partner: "FreshMart", cost: 300, category: "groceries", icon: "shopping-cart" },
  { id: "fitness-month", name: "Free Month Gym Pass", partner: "FitLife", cost: 400, category: "wellness", icon: "dumbbell" },
  { id: "coffee-free", name: "Free Coffee Bundle", partner: "BeanBrew", cost: 150, category: "food", icon: "coffee" },
  { id: "streaming-month", name: "1 Month Streaming Free", partner: "StreamPlus", cost: 250, category: "entertainment", icon: "tv" },
  { id: "home-discount", name: "£20 Home Insurance Discount", partner: "SafeHome", cost: 600, category: "insurance", icon: "home" },
  { id: "book-credit", name: "£5 Book Credit", partner: "ReadMore", cost: 200, category: "education", icon: "book" },
  { id: "restaurant-deal", name: "25% off Dining", partner: "TastyEats", cost: 350, category: "food", icon: "utensils" },
];

function getCurrentLevel() {
  const points = state.rewardPoints || 0;
  let currentLevel = REWARD_LEVELS[0];
  for (const level of REWARD_LEVELS) {
    if (points >= level.minPoints) {
      currentLevel = level;
    } else {
      break;
    }
  }
  return currentLevel;
}

function getNextLevel() {
  const current = getCurrentLevel();
  const nextIdx = REWARD_LEVELS.findIndex((l) => l.level === current.level) + 1;
  return nextIdx < REWARD_LEVELS.length ? REWARD_LEVELS[nextIdx] : null;
}

function getLevelProgress() {
  const points = state.rewardPoints || 0;
  const current = getCurrentLevel();
  const next = getNextLevel();
  if (!next) return 100;
  const levelPoints = points - current.minPoints;
  const levelRange = next.minPoints - current.minPoints;
  return Math.min(100, Math.round((levelPoints / levelRange) * 100));
}

function awardPoints(amount, reason) {
  state.rewardPoints = (state.rewardPoints || 0) + amount;

  // Check for level up
  const newLevel = getCurrentLevel();
  if (newLevel.level > (state.rewardLevel || 1)) {
    state.rewardLevel = newLevel.level;
  }

  scheduleSave();
  updateRewardsUI();
}

function checkAndAwardBadge(badgeId) {
  if (!REWARD_BADGES[badgeId]) return false;
  if ((state.unlockedBadges || []).includes(badgeId)) return false;

  state.unlockedBadges = [...(state.unlockedBadges || []), badgeId];
  awardPoints(REWARD_BADGES[badgeId].points, `Badge: ${REWARD_BADGES[badgeId].name}`);
  return true;
}

function checkAllBadges() {
  const snapshot = getFinanceSnapshot();
  const bufferMonths = snapshot.expenses > 0 ? snapshot.savings / snapshot.expenses : 0;
  const debtRatio = snapshot.income > 0 ? snapshot.debt / snapshot.income : 0;
  const savingsRate = snapshot.income > 0 ? snapshot.surplus / snapshot.income : 0;
  const protectionScore = typeof calculateProtectionScore === "function" ? calculateProtectionScore().total : 0;

  // Check badge conditions
  if (state.goals && state.goals.length >= 1) checkAndAwardBadge("first-goal");
  if (state.snapshotSet) checkAndAwardBadge("budget-master");
  if (bufferMonths >= 1) checkAndAwardBadge("emergency-starter");
  if (bufferMonths >= 3) checkAndAwardBadge("emergency-pro");
  if (state.rewardStreak >= 7) checkAndAwardBadge("streak-7");
  if (state.rewardStreak >= 30) checkAndAwardBadge("streak-30");
  if (state.rewardStreak >= 100) checkAndAwardBadge("streak-100");
  if (state.goals && state.goals.some((g) => g.target > 0 && g.saved >= g.target)) checkAndAwardBadge("goal-complete");
  if (debtRatio <= 0.1 && snapshot.debt > 0) checkAndAwardBadge("debt-free");
  if (savingsRate >= 0.1) checkAndAwardBadge("saver-10");
  if (savingsRate >= 0.2) checkAndAwardBadge("saver-20");
  if (state.bills && state.bills.length >= 5) checkAndAwardBadge("bill-tracker");
  if (protectionScore >= 80) checkAndAwardBadge("protection-80");
}

function handleDailyCheckIn() {
  const today = new Date().toDateString();
  const lastCheckIn = state.rewardLastCheckIn;

  if (lastCheckIn === today) return; // Already checked in today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (lastCheckIn === yesterday.toDateString()) {
    // Continue streak
    state.rewardStreak = (state.rewardStreak || 0) + 1;
  } else if (lastCheckIn) {
    // Streak broken
    state.rewardStreak = 1;
  } else {
    // First check-in
    state.rewardStreak = 1;
  }

  state.rewardLastCheckIn = today;

  // Award daily points (base + streak bonus)
  const streakBonus = Math.min(state.rewardStreak, 30); // Cap bonus at 30
  awardPoints(5 + streakBonus, "Daily check-in");

  checkAllBadges();
}

function claimOffer(offerId) {
  const offer = PARTNER_OFFERS.find((o) => o.id === offerId);
  if (!offer) return false;
  if ((state.claimedOffers || []).includes(offerId)) return false;
  if ((state.rewardPoints || 0) < offer.cost) return false;

  state.rewardPoints -= offer.cost;
  state.claimedOffers = [...(state.claimedOffers || []), offerId];
  scheduleSave();
  updateRewardsUI();
  return true;
}

function getBadgeIcon(iconName) {
  const icons = {
    target: `
      <defs>
        <linearGradient id="bdg-pink-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-gold-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-teal-${iconName}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#bdg-pink-${iconName})" opacity="0.2"/>
      <circle cx="12" cy="12" r="7" fill="#fff" opacity="0.4"/>
      <circle cx="12" cy="12" r="4" fill="url(#bdg-pink-${iconName})" opacity="0.6"/>
      <circle cx="12" cy="12" r="1.5" fill="url(#bdg-pink-${iconName})"/>
      <path d="M18 4l-5 7" stroke="url(#bdg-teal-${iconName})" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 4l2-2M20 4l-2 2M18 2l2 2" stroke="url(#bdg-gold-${iconName})" stroke-width="1.5" stroke-linecap="round"/>`,
    "pie-chart": `
      <defs>
        <linearGradient id="bdg-teal-pie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-gold-pie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-pie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="14" r="8" fill="url(#bdg-teal-pie)" opacity="0.3"/>
      <path d="M12 6v8l6 4" fill="url(#bdg-teal-pie)"/>
      <path d="M12 6a8 8 0 00-6.9 4" fill="url(#bdg-pink-pie)"/>
      <path d="M5.1 10A8 8 0 0012 22a8 8 0 006.9-12" fill="url(#bdg-gold-pie)" opacity="0.7"/>
      <path d="M7 4l2 3h6l2-3-2.5 2L12 2l-2.5 4L7 4z" fill="url(#bdg-gold-pie)"/>`,
    shield: `
      <defs>
        <linearGradient id="bdg-teal-sh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-gold-sh" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M3 8c3 0 4 4 9 4s6-4 9-4v10c-3 0-4 2-9 2s-6-2-9-2V8z" fill="none" stroke="url(#bdg-teal-sh)" stroke-width="2"/>
      <path d="M3 12h18M6 8v10M12 8v10M18 8v10" stroke="url(#bdg-teal-sh)" stroke-width="1" opacity="0.5"/>
      <circle cx="8" cy="6" r="2" fill="url(#bdg-gold-sh)"/>
      <circle cx="14" cy="4" r="2" fill="url(#bdg-gold-sh)"/>`,
    "shield-check": `
      <defs>
        <linearGradient id="bdg-gold-shc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M12 2l9 4v6c0 6-4 10-9 12-5-2-9-6-9-12V6l9-4z" fill="url(#bdg-gold-shc)"/>
      <path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="8" cy="7" r="0.8" fill="#fff" opacity="0.5"/>`,
    flame: `
      <defs>
        <linearGradient id="bdg-gold-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-fl" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <path d="M12 2c-4 4-6 6-6 10a6 6 0 0012 0c0-4-2-6-6-10z" fill="url(#bdg-gold-fl)"/>
      <path d="M12 6c-2 2-3 3-3 5a3 3 0 006 0c0-2-1-3-3-5z" fill="url(#bdg-pink-fl)" opacity="0.7"/>
      <text x="12" y="16" font-family="Arial" font-size="8" font-weight="bold" fill="#fff" text-anchor="middle">7</text>`,
    fire: `
      <defs>
        <linearGradient id="bdg-pink-fr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-gold-fr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M12 1c-5 5-7 7-7 12a7 7 0 0014 0c0-5-2-7-7-12z" fill="url(#bdg-pink-fr)"/>
      <path d="M12 5c-2.5 2.5-4 4-4 7a4 4 0 008 0c0-3-1.5-4.5-4-7z" fill="url(#bdg-gold-fr)"/>
      <text x="12" y="16" font-family="Arial" font-size="6" font-weight="bold" fill="#1d3557" text-anchor="middle">30</text>`,
    crown: `
      <defs>
        <linearGradient id="bdg-gold-cr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-cr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <ellipse cx="12" cy="16" rx="7" ry="5" fill="url(#bdg-gold-cr)"/>
      <path d="M5 16V11a7 7 0 0114 0v5" fill="url(#bdg-gold-cr)" opacity="0.9"/>
      <path d="M8 4c0 0 4-3 8 0" stroke="url(#bdg-pink-cr)" stroke-width="3" stroke-linecap="round"/>
      <path d="M12 1v5" stroke="url(#bdg-pink-cr)" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="12" cy="1" rx="2" ry="1" fill="url(#bdg-pink-cr)"/>`,
    trophy: `
      <defs>
        <linearGradient id="bdg-gold-tr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-teal-tr" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <path d="M7 4h10v7a5 5 0 01-10 0V4z" fill="url(#bdg-gold-tr)"/>
      <path d="M7 6H5a2 2 0 000 4h2M17 6h2a2 2 0 010 4h-2" fill="url(#bdg-gold-tr)" opacity="0.7"/>
      <path d="M10 15v3h4v-3" fill="url(#bdg-gold-tr)"/>
      <rect x="8" y="18" width="8" height="3" rx="1" fill="url(#bdg-teal-tr)"/>
      <circle cx="9" cy="7" r="1" fill="#fff" opacity="0.5"/>`,
    "broken-chain": `
      <defs>
        <linearGradient id="bdg-navy-bc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
        <linearGradient id="bdg-gold-bc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-bc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <ellipse cx="6" cy="14" rx="3" ry="4" fill="none" stroke="url(#bdg-navy-bc)" stroke-width="2.5"/>
      <ellipse cx="18" cy="14" rx="3" ry="4" fill="none" stroke="url(#bdg-navy-bc)" stroke-width="2.5"/>
      <path d="M12 4v12" stroke="url(#bdg-gold-bc)" stroke-width="2.5"/>
      <path d="M10 4l2-2 2 2" fill="url(#bdg-gold-bc)"/>
      <path d="M9 12l6 4M9 16l6-4" stroke="url(#bdg-pink-bc)" stroke-width="2" stroke-linecap="round"/>`,
    "piggy-bank": `
      <defs>
        <linearGradient id="bdg-pink-pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-navy-pg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d3557"/>
        </linearGradient>
      </defs>
      <ellipse cx="11" cy="14" rx="7" ry="5" fill="url(#bdg-pink-pg)"/>
      <circle cx="16" cy="11" r="3.5" fill="url(#bdg-pink-pg)"/>
      <ellipse cx="19" cy="12" rx="1.8" ry="1.2" fill="#fda4af"/>
      <circle cx="18.5" cy="11.8" r="0.4" fill="#db2777"/>
      <circle cx="19.8" cy="11.8" r="0.4" fill="#db2777"/>
      <ellipse cx="15" cy="8" rx="1" ry="1.3" fill="#db2777" transform="rotate(-15 15 8)"/>
      <rect x="8" y="10" width="3" height="1" rx="0.5" fill="#db2777"/>
      <circle cx="14" cy="9.5" r="2" fill="none" stroke="url(#bdg-navy-pg)" stroke-width="1"/>
      <circle cx="18" cy="9.5" r="2" fill="none" stroke="url(#bdg-navy-pg)" stroke-width="1"/>
      <path d="M16 9.5h-2M12 10h-1" stroke="url(#bdg-navy-pg)" stroke-width="0.8"/>`,
    rocket: `
      <defs>
        <linearGradient id="bdg-teal-rk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-pink-rk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-gold-rk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <path d="M12 2l7 3.5v5.5c0 5-3 9-7 11-4-2-7-6-7-11V5.5L12 2z" fill="url(#bdg-teal-rk)"/>
      <path d="M12 7c-1 0-2 1-2 2v4l2 3 2-3V9c0-1-1-2-2-2z" fill="url(#bdg-pink-rk)"/>
      <path d="M10 13l-1.5 2M14 13l1.5 2" stroke="url(#bdg-gold-rk)" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="12" cy="17" rx="1.5" ry="2" fill="url(#bdg-gold-rk)"/>
      <circle cx="12" cy="9" r="1" fill="#fff" opacity="0.7"/>`,
    "calendar-check": `
      <defs>
        <linearGradient id="bdg-teal-cc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
        <linearGradient id="bdg-gold-cc" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect x="4" y="5" width="16" height="16" rx="2" fill="url(#bdg-teal-cc)"/>
      <path d="M4 10h16" stroke="#fff" stroke-width="1" opacity="0.3"/>
      <path d="M8 3v4M16 3v4" stroke="url(#bdg-teal-cc)" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 1l1.5 2h5l1.5-2-2 1.5L12 0l-2 2.5L8 1z" fill="url(#bdg-gold-cc)"/>
      <path d="M8 14l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    award: `
      <defs>
        <linearGradient id="bdg-gold-aw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
        <linearGradient id="bdg-pink-aw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="bdg-teal-aw" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#5eead4"/><stop offset="100%" stop-color="#2a9d8f"/>
        </linearGradient>
      </defs>
      <path d="M8 21l4-3 4 3V10H8v11z" fill="url(#bdg-pink-aw)"/>
      <circle cx="12" cy="9" r="7" fill="url(#bdg-gold-aw)"/>
      <path d="M12 4l5 2.5v3.5c0 3-2 5-5 6-3-1-5-3-5-6V6.5L12 4z" fill="url(#bdg-teal-aw)"/>
      <path d="M10 9l1.5 1.5 3-3" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  return icons[iconName] || icons.target;
}

function getOfferIcon(iconName) {
  const icons = {
    plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    "shopping-cart": '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>',
    dumbbell: '<path d="M6.5 6.5h11M6.5 17.5h11M17.5 6.5a1 1 0 011 1v9a1 1 0 01-1 1M6.5 6.5a1 1 0 00-1 1v9a1 1 0 001 1M20.5 8a1 1 0 011 1v6a1 1 0 01-1 1M3.5 8a1 1 0 00-1 1v6a1 1 0 001 1"/>',
    coffee: '<path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>',
    tv: '<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',
  };
  return icons[iconName] || icons.plane;
}

function updateRewardsUI() {
  // Update basic displays
  setTextAll("[data-rewards-points]", state.rewardPoints || 0);
  setTextAll("[data-rewards-streak]", state.rewardStreak || 0);

  // Update level display
  const currentLevel = getCurrentLevel();
  const nextLevel = getNextLevel();
  const progress = getLevelProgress();

  setTextAll("[data-rewards-level]", currentLevel.level);
  setTextAll("[data-rewards-level-name]", currentLevel.name);

  const levelProgress = document.querySelector("[data-rewards-level-progress]");
  if (levelProgress) {
    levelProgress.style.width = `${progress}%`;
    levelProgress.style.background = currentLevel.color;
  }

  const levelInfo = document.querySelector("[data-rewards-level-info]");
  if (levelInfo && nextLevel) {
    levelInfo.textContent = `${state.rewardPoints || 0} / ${nextLevel.minPoints} pts to ${nextLevel.name}`;
  } else if (levelInfo) {
    levelInfo.textContent = "Maximum level reached!";
  }

  // Update badges grid
  const badgesGrid = document.querySelector("[data-rewards-badges]");
  if (badgesGrid) {
    const unlockedBadges = state.unlockedBadges || [];
    badgesGrid.innerHTML = Object.entries(REWARD_BADGES)
      .map(([id, badge]) => {
        const unlocked = unlockedBadges.includes(id);
        return `
          <div class="badge-item ${unlocked ? "unlocked" : "locked"}" title="${escapeHtml(badge.description)}">
            <div class="badge-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${getBadgeIcon(badge.icon)}
              </svg>
            </div>
            <span class="badge-name">${escapeHtml(badge.name)}</span>
            <span class="badge-points">${unlocked ? "Unlocked" : `${badge.points} pts`}</span>
          </div>
        `;
      })
      .join("");
  }

  // Update offers grid
  const offersGrid = document.querySelector("[data-rewards-offers]");
  if (offersGrid) {
    const claimedOffers = state.claimedOffers || [];
    const points = state.rewardPoints || 0;

    offersGrid.innerHTML = PARTNER_OFFERS.map((offer) => {
      const claimed = claimedOffers.includes(offer.id);
      const canAfford = points >= offer.cost;
      return `
        <div class="offer-item ${claimed ? "claimed" : ""} ${!canAfford && !claimed ? "locked" : ""}">
          <div class="offer-icon ${escapeHtml(offer.category)}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${getOfferIcon(offer.icon)}
            </svg>
          </div>
          <div class="offer-info">
            <p class="offer-name">${escapeHtml(offer.name)}</p>
            <p class="offer-partner">${escapeHtml(offer.partner)}</p>
          </div>
          <div class="offer-action">
            ${claimed
              ? '<span class="offer-claimed">Claimed</span>'
              : `<button class="btn small ${canAfford ? "" : "disabled"}" data-claim-offer="${escapeHtml(offer.id)}" ${!canAfford ? "disabled" : ""}>${offer.cost} pts</button>`
            }
          </div>
        </div>
      `;
    }).join("");

    // Attach claim listeners
    offersGrid.querySelectorAll("[data-claim-offer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const offerId = btn.dataset.claimOffer;
        if (claimOffer(offerId)) {
          updateRewardsUI();
        }
      });
    });
  }

  // Update streak display
  const streakDisplay = document.querySelector("[data-rewards-streak-display]");
  if (streakDisplay) {
    const streak = state.rewardStreak || 0;
    const streakDays = [];
    for (let i = 6; i >= 0; i--) {
      const dayStreak = streak > i;
      streakDays.push(`<div class="streak-day ${dayStreak ? "active" : ""}"></div>`);
    }
    streakDisplay.innerHTML = streakDays.join("");
  }
}

function getFinanceSnapshot() {
  const totalExpenses = calculateTotalExpenses();
  return {
    income: state.income,
    expenses: totalExpenses,
    savings: state.savings,
    surplus: state.income - totalExpenses,
    debt: calculateCategoryTotal("debt"),
  };
}

function updateSummary() {
  const snapshot = getFinanceSnapshot();
  const surplus = snapshot.surplus;
  const surplusLabel = surplus >= 0 ? "surplus" : "deficit";
  const bufferMonths = snapshot.expenses ? snapshot.savings / (snapshot.expenses || 1) : 0;
  const goalsCount = state.goals.length;
  const debtRatio = snapshot.income ? snapshot.debt / snapshot.income : 0;
  const surplusRatio = snapshot.income ? snapshot.surplus / snapshot.income : 0;

  setTextAll("[data-summary-name]", state.name || "Friend");
  setTextAll("[data-user-name]", state.name || "Friend");
  setTextAll("[data-summary-surplus]", formatCurrency(surplus));
  setTextAll("[data-app-surplus]", `${formatCurrency(surplus)} ${surplusLabel}`);
  setTextAll("[data-summary-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-app-buffer]", `${bufferMonths.toFixed(1)} months`);
  setTextAll("[data-summary-goals]", `${goalsCount} goal${goalsCount === 1 ? "" : "s"}`);

  const summaryNext = document.querySelector("[data-summary-next]");
  let nextStep = "";
  if (surplus < 0) {
    nextStep = "Reduce expenses to reach break-even.";
  } else if (bufferMonths < 1) {
    nextStep = "Build a 1 month emergency buffer.";
  } else if (bufferMonths < 3) {
    nextStep = "Grow your buffer to 3 months.";
  } else if (goalsCount === 0) {
    nextStep = "Add your first goal to start tracking.";
  } else {
    nextStep = "Automate savings to your top goal.";
  }
  if (summaryNext) summaryNext.textContent = nextStep;

  // Confidence score
  const baseScore = 50;
  const bufferScore = Math.min(25, Math.round(bufferMonths * 6));
  const goalScore = Math.min(15, goalsCount * 3);
  const cashflowScore = Math.min(10, Math.round(Math.max(0, surplusRatio * 40)));
  let debtPenalty = 0;
  if (debtRatio > 0.35) debtPenalty = -12;
  else if (debtRatio > 0.2) debtPenalty = -6;

  let score = baseScore + bufferScore + goalScore + cashflowScore + debtPenalty;
  score = Math.max(35, Math.min(95, score));

  setTextAll("[data-app-confidence]", score);
  setTextAll("[data-confidence-total]", score);
  setTextAll("[data-confidence-base]", baseScore);
  setTextAll("[data-confidence-buffer]", formatSignedNumber(bufferScore));
  setTextAll("[data-confidence-goals]", formatSignedNumber(goalScore));
  setTextAll("[data-confidence-cashflow]", formatSignedNumber(cashflowScore));
  setTextAll("[data-confidence-debt]", formatSignedNumber(debtPenalty));

  updateRewardsUI();
  updateGoalList();
  updateDashboardVisibility();
  updateIncomeBreakdown();
  updateCashflowInsights();
  updateVulnerabilityPanel();
  updateAlertList();
  updateBillsList();
}
