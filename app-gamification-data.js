// GAMIFICATION & ACHIEVEMENTS - DATA
// ============================================================

const ACHIEVEMENTS_KEY = "consumerpay_achievements";
const CHALLENGES_KEY = "consumerpay_challenges";

// Badge definitions
const BADGES = {
  // Getting Started
  profileComplete: {
    id: "profileComplete",
    name: "Profile Complete",
    icon: "🎯",
    description: "Filled in all your basic financial details",
    category: "getting-started",
    tier: "bronze",
  },
  firstImport: {
    id: "firstImport",
    name: "Statement Imported",
    icon: "📄",
    description: "Imported your first bank statement",
    category: "getting-started",
    tier: "bronze",
  },
  firstGoal: {
    id: "firstGoal",
    name: "Goal Setter",
    icon: "🎯",
    description: "Created your first savings goal",
    category: "getting-started",
    tier: "bronze",
  },

  // Savings Milestones
  saved1k: {
    id: "saved1k",
    name: "First £1,000",
    icon: "💰",
    description: "Reached £1,000 in savings",
    category: "savings",
    tier: "bronze",
  },
  saved5k: {
    id: "saved5k",
    name: "£5K Saver",
    icon: "💰",
    description: "Reached £5,000 in savings",
    category: "savings",
    tier: "silver",
  },
  saved10k: {
    id: "saved10k",
    name: "Five Figures",
    icon: "🌟",
    description: "Reached £10,000 in savings",
    category: "savings",
    tier: "gold",
  },
  emergencyFund3: {
    id: "emergencyFund3",
    name: "Safety Net",
    icon: "🛡️",
    description: "Built 3 months of emergency savings",
    category: "savings",
    tier: "silver",
  },
  emergencyFund6: {
    id: "emergencyFund6",
    name: "Fully Protected",
    icon: "🏰",
    description: "Built 6 months of emergency savings",
    category: "savings",
    tier: "gold",
  },

  // Net Worth
  netWorth10k: {
    id: "netWorth10k",
    name: "£10K Club",
    icon: "📈",
    description: "Net worth reached £10,000",
    category: "networth",
    tier: "bronze",
  },
  netWorth50k: {
    id: "netWorth50k",
    name: "Halfway to 100K",
    icon: "🚀",
    description: "Net worth reached £50,000",
    category: "networth",
    tier: "silver",
  },
  netWorth100k: {
    id: "netWorth100k",
    name: "Six Figures",
    icon: "⭐",
    description: "Net worth reached £100,000",
    category: "networth",
    tier: "gold",
  },
  netWorthPositive: {
    id: "netWorthPositive",
    name: "In The Black",
    icon: "✅",
    description: "Achieved positive net worth",
    category: "networth",
    tier: "bronze",
  },

  // Debt Freedom
  creditCardFree: {
    id: "creditCardFree",
    name: "Card Crusher",
    icon: "💳",
    description: "Paid off all credit card debt",
    category: "debt",
    tier: "silver",
  },
  debtFree: {
    id: "debtFree",
    name: "Debt Free",
    icon: "🎊",
    description: "Paid off all consumer debt",
    category: "debt",
    tier: "gold",
  },

  // Health Score
  score50: {
    id: "score50",
    name: "Halfway There",
    icon: "📊",
    description: "Reached a health score of 50",
    category: "health",
    tier: "bronze",
  },
  score70: {
    id: "score70",
    name: "Strong Foundation",
    icon: "💪",
    description: "Reached a health score of 70",
    category: "health",
    tier: "silver",
  },
  score85: {
    id: "score85",
    name: "Financial Champion",
    icon: "🏆",
    description: "Reached a health score of 85",
    category: "health",
    tier: "gold",
  },

  // Streaks
  streak7: {
    id: "streak7",
    name: "Week Warrior",
    icon: "🔥",
    description: "7 consecutive days of tracking",
    category: "consistency",
    tier: "bronze",
  },
  streak30: {
    id: "streak30",
    name: "Monthly Master",
    icon: "🔥",
    description: "30 consecutive days of tracking",
    category: "consistency",
    tier: "silver",
  },
  streak90: {
    id: "streak90",
    name: "Quarter Champion",
    icon: "🔥",
    description: "90 consecutive days of tracking",
    category: "consistency",
    tier: "gold",
  },

  // Challenges
  challengeComplete: {
    id: "challengeComplete",
    name: "Challenge Accepted",
    icon: "🎮",
    description: "Completed your first monthly challenge",
    category: "challenges",
    tier: "bronze",
  },
  challenges5: {
    id: "challenges5",
    name: "Challenge Pro",
    icon: "🎖️",
    description: "Completed 5 monthly challenges",
    category: "challenges",
    tier: "silver",
  },
};

// Monthly challenges
const MONTHLY_CHALLENGES = [
  {
    id: "noSpendWeekend",
    name: "No-Spend Weekend",
    description: "Go a full weekend without spending money",
    icon: "🏠",
    points: 50,
    difficulty: "easy",
  },
  {
    id: "packLunchWeek",
    name: "Pack Lunch Week",
    description: "Bring lunch from home for 5 workdays",
    icon: "🥪",
    points: 75,
    difficulty: "easy",
  },
  {
    id: "subscriptionAudit",
    name: "Subscription Audit",
    description: "Review and cancel at least one unused subscription",
    icon: "📺",
    points: 100,
    difficulty: "medium",
  },
  {
    id: "savingsBoost",
    name: "Savings Boost",
    description: "Save 10% more than usual this month",
    icon: "📈",
    points: 150,
    difficulty: "medium",
  },
  {
    id: "cashOnlyWeek",
    name: "Cash Only Week",
    description: "Use only cash for all purchases for one week",
    icon: "💵",
    points: 100,
    difficulty: "medium",
  },
  {
    id: "billNegotiator",
    name: "Bill Negotiator",
    description: "Call a provider and negotiate a better rate",
    icon: "📞",
    points: 150,
    difficulty: "medium",
  },
  {
    id: "mealPrepSunday",
    name: "Meal Prep Master",
    description: "Prep all your weekday meals on Sunday",
    icon: "🍳",
    points: 75,
    difficulty: "easy",
  },
  {
    id: "financialCheckup",
    name: "Financial Checkup",
    description: "Review all your accounts and update balances",
    icon: "🔍",
    points: 100,
    difficulty: "medium",
  },
];
