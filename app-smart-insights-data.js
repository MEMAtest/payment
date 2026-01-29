// SMART INSIGHTS ENGINE - DATA
// ============================================================

// UK Financial Benchmarks (Source: ONS, Money Helper, FCA)
const UK_BENCHMARKS = {
  // Savings rate by gross income bracket (% of income saved)
  savingsRate: {
    under20k: { poor: 0, fair: 3, good: 8, excellent: 12 },
    "20k-30k": { poor: 0, fair: 5, good: 10, excellent: 15 },
    "30k-50k": { poor: 2, fair: 8, good: 15, excellent: 20 },
    "50k-80k": { poor: 5, fair: 12, good: 20, excellent: 25 },
    over80k: { poor: 8, fair: 15, good: 25, excellent: 30 },
  },
  // Emergency fund months by age (recommended)
  emergencyFund: {
    under30: { minimum: 2, good: 3, excellent: 6 },
    "30-50": { minimum: 3, good: 6, excellent: 9 },
    over50: { minimum: 6, good: 9, excellent: 12 },
  },
  // Debt-to-income ratio benchmarks
  debtToIncome: {
    excellent: 15, // Under 15% is excellent
    good: 25,      // 15-25% is good
    fair: 35,      // 25-35% is fair
    poor: 50,      // 35-50% is concerning
  },
  // UK median spending by category (% of take-home pay)
  spendingByCategory: {
    housing: 28,      // Rent/mortgage
    transport: 12,    // Car, fuel, public transport
    food: 11,         // Groceries + dining
    utilities: 6,     // Energy, water, internet
    insurance: 4,     // All insurance
    entertainment: 5, // Subscriptions, leisure
    clothing: 3,
    childcare: 8,     // For those with children
  },
  // Credit utilization
  creditUtilization: {
    excellent: 10,
    good: 30,
    fair: 50,
    poor: 75,
  },
};

// Get income bracket for benchmarks
function getIncomeBracket(annualSalary) {
  if (annualSalary < 20000) return "under20k";
  if (annualSalary < 30000) return "20k-30k";
  if (annualSalary < 50000) return "30k-50k";
  if (annualSalary < 80000) return "50k-80k";
  return "over80k";
}
