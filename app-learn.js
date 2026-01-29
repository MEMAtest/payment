const LEARN_STORAGE_KEY = "consumerpay_learn_progress";

const LEARNING_MODULES = {
  budgeting: {
    title: "Budgeting Basics",
    lessons: [
      {
        content: "The 50/30/20 rule is a simple way to budget: allocate 50% of your income to needs (rent, utilities, groceries), 30% to wants (entertainment, dining out), and 20% to savings and debt repayment.",
        question: "According to the 50/30/20 rule, what percentage should go to savings?",
        options: ["10%", "20%", "30%", "50%"],
        correct: 1,
        explanation: "20% of your after-tax income should go towards savings and paying off debt.",
      },
      {
        content: "Zero-based budgeting means every pound has a job. You assign all your income to specific categories until you have zero left to allocate. This doesn't mean spending everything - savings is a category too!",
        question: "What does zero-based budgeting mean?",
        options: ["Spending nothing", "Having no savings", "Every pound is assigned a purpose", "Starting fresh each year"],
        correct: 2,
        explanation: "Zero-based budgeting means assigning every pound of income to a specific purpose, including savings.",
      },
      {
        content: "Fixed expenses stay the same each month (rent, insurance), while variable expenses change (groceries, utilities). Track both to understand your true spending patterns.",
        question: "Which is typically a fixed expense?",
        options: ["Groceries", "Electricity", "Rent", "Entertainment"],
        correct: 2,
        explanation: "Rent typically stays the same each month, making it a fixed expense.",
      },
      {
        content: "Pay yourself first! Set up automatic transfers to savings on payday, before you spend on anything else. This makes saving effortless and consistent.",
        question: "When should you transfer money to savings?",
        options: ["End of the month", "When you have spare money", "On payday before spending", "Once a year"],
        correct: 2,
        explanation: "Paying yourself first means transferring to savings immediately on payday, before other spending.",
      },
    ],
  },
  emergency: {
    title: "Emergency Fund Essentials",
    lessons: [
      {
        content: "An emergency fund is money set aside for unexpected expenses - car repairs, medical bills, or job loss. It's your financial safety net that prevents you from going into debt when life happens.",
        question: "What is an emergency fund for?",
        options: ["Holidays", "Unexpected expenses", "Shopping", "Investments"],
        correct: 1,
        explanation: "An emergency fund covers unexpected costs like repairs, medical bills, or job loss.",
      },
      {
        content: "Financial experts recommend saving 3-6 months of essential expenses. Start with a smaller goal of £1,000 to build the habit, then grow from there.",
        question: "How much should your emergency fund ideally cover?",
        options: ["1 week of expenses", "1 month of expenses", "3-6 months of expenses", "1 year of expenses"],
        correct: 2,
        explanation: "Aim for 3-6 months of essential expenses to handle most emergencies.",
      },
      {
        content: "Keep your emergency fund in an easy-access savings account. It should be liquid (quickly accessible) but separate from your current account to avoid temptation.",
        question: "Where should you keep your emergency fund?",
        options: ["Under the mattress", "Invested in stocks", "Easy-access savings account", "Locked term deposit"],
        correct: 2,
        explanation: "An easy-access savings account offers quick access while keeping funds separate from daily spending.",
      },
    ],
  },
  investing: {
    title: "Investing 101",
    lessons: [
      {
        content: "Compound interest is interest on interest. If you invest £1,000 at 7% annually, after 10 years you'd have about £1,967 - nearly double! The earlier you start, the more powerful compounding becomes.",
        question: "What makes compound interest so powerful?",
        options: ["Government guarantees", "Interest earning interest over time", "No risk involved", "Fixed returns"],
        correct: 1,
        explanation: "Compound interest means your earnings generate their own earnings over time.",
      },
      {
        content: "An index fund tracks a market index (like the FTSE 100). Instead of picking individual stocks, you own a small piece of many companies. This provides instant diversification at low cost.",
        question: "What is an index fund?",
        options: ["A single company stock", "A fund tracking a market index", "A savings account", "A type of bond"],
        correct: 1,
        explanation: "Index funds track market indices, giving you exposure to many companies in one investment.",
      },
      {
        content: "Risk and reward are linked. Higher potential returns usually mean higher risk. Young investors can typically take more risk because they have time to recover from market downturns.",
        question: "Why might younger investors take more risk?",
        options: ["They have less to lose", "They have more time to recover from losses", "They're more intelligent", "Markets are less risky for them"],
        correct: 1,
        explanation: "Younger investors have more time before retirement, allowing them to ride out market volatility.",
      },
      {
        content: "Pound-cost averaging means investing a fixed amount regularly (e.g., £200/month) regardless of market conditions. This reduces the impact of market timing and smooths out your purchase price.",
        question: "What is pound-cost averaging?",
        options: ["Timing the market", "Investing the same amount regularly", "Only buying when prices fall", "Selling at the right time"],
        correct: 1,
        explanation: "Pound-cost averaging means investing consistent amounts regularly, regardless of market conditions.",
      },
      {
        content: "Fees matter! A 1% annual fee might seem small, but over 30 years it can reduce your returns by 25% or more. Look for low-cost index funds with fees below 0.25%.",
        question: "Why do investment fees matter so much?",
        options: ["They don't really matter", "They compound and reduce returns significantly", "Higher fees mean better returns", "They're tax deductible"],
        correct: 1,
        explanation: "Fees compound over time and can dramatically reduce your long-term investment returns.",
      },
    ],
  },
  debt: {
    title: "Debt Destruction",
    lessons: [
      {
        content: "Not all debt is equal. 'Good debt' (mortgages, education) can build wealth or income. 'Bad debt' (credit cards, payday loans) has high interest and funds consumption, not assets.",
        question: "Which is typically considered 'good debt'?",
        options: ["Credit card debt", "Payday loans", "A mortgage", "Store credit"],
        correct: 2,
        explanation: "Mortgages are generally considered good debt as they help build home equity.",
      },
      {
        content: "The avalanche method: pay minimum on all debts, then put extra money toward the highest interest rate debt first. This saves the most money mathematically.",
        question: "What debt does the avalanche method target first?",
        options: ["Smallest balance", "Highest interest rate", "Oldest debt", "Largest balance"],
        correct: 1,
        explanation: "The avalanche method targets the highest interest rate debt first to minimize total interest paid.",
      },
      {
        content: "The snowball method: pay minimums on all debts, then put extra money toward the smallest balance first. Quick wins build momentum and motivation, even if it costs more in interest.",
        question: "What's the main benefit of the snowball method?",
        options: ["Saves the most money", "Psychological wins and motivation", "Fastest overall", "Lowest minimum payments"],
        correct: 1,
        explanation: "The snowball method provides quick wins that build motivation to keep paying off debt.",
      },
      {
        content: "Balance transfers can help - move high-interest debt to a 0% card. But watch out for transfer fees (usually 3%) and ensure you can pay off before the promotional rate ends.",
        question: "What should you watch out for with balance transfers?",
        options: ["Nothing, they're risk-free", "Transfer fees and promotional period end", "They improve credit score", "Lower minimum payments"],
        correct: 1,
        explanation: "Balance transfers often have fees and promotional rates that end, potentially leading to high interest.",
      },
    ],
  },
  psychology: {
    title: "Money Psychology",
    lessons: [
      {
        content: "We often spend emotionally - retail therapy when stressed, impulse buys for dopamine hits. Recognizing your emotional spending triggers is the first step to controlling them.",
        question: "What is 'retail therapy'?",
        options: ["Shopping for medicine", "Spending to cope with emotions", "Getting therapy about shopping", "Budget counseling"],
        correct: 1,
        explanation: "Retail therapy refers to spending money to improve mood or cope with negative emotions.",
      },
      {
        content: "The hedonic treadmill: we quickly adapt to new purchases and return to our baseline happiness. That new phone brings joy briefly, then becomes normal. Experiences often bring more lasting happiness than things.",
        question: "What does the hedonic treadmill suggest?",
        options: ["Exercise makes you happy", "We adapt to purchases and need more", "Spending always increases happiness", "Money buys permanent happiness"],
        correct: 1,
        explanation: "The hedonic treadmill shows we adapt to new purchases and return to baseline happiness.",
      },
      {
        content: "Your money mindset often comes from childhood. How your parents talked about (or avoided) money shapes your beliefs. Identifying these beliefs helps you change unhelpful patterns.",
        question: "Where do money mindsets often originate?",
        options: ["School education", "Childhood and family", "Social media", "Banks"],
        correct: 1,
        explanation: "Our attitudes toward money are often shaped by our family and childhood experiences.",
      },
    ],
  },
};

function getLearnProgress() {
  try {
    const data = localStorage.getItem(LEARN_STORAGE_KEY);
    return data ? JSON.parse(data) : { completed: {}, points: 0, lastLearnDate: null };
  } catch {
    return { completed: {}, points: 0, lastLearnDate: null };
  }
}

function saveLearnProgress(progress) {
  localStorage.setItem(LEARN_STORAGE_KEY, JSON.stringify(progress));
}

function calculateLearnStreak() {
  const progress = getLearnProgress();
  if (!progress.lastLearnDate) return 0;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (progress.lastLearnDate === today || progress.lastLearnDate === yesterday) {
    return progress.streak || 1;
  }
  return 0;
}

function updateLearnUI() {
  const progress = getLearnProgress();
  const completedCount = Object.values(progress.completed).reduce((sum, lessons) => sum + lessons.length, 0);

  setTextAll("[data-learn-completed]", completedCount);
  setTextAll("[data-learn-streak]", calculateLearnStreak());
  setTextAll("[data-learn-points]", progress.points || 0);

  // Update module progress
  Object.keys(LEARNING_MODULES).forEach(moduleId => {
    const module = LEARNING_MODULES[moduleId];
    const completed = progress.completed[moduleId]?.length || 0;
    const total = module.lessons.length;
    const pct = Math.round((completed / total) * 100);

    const progressBar = document.querySelector(`[data-module-progress="${moduleId}"]`);
    if (progressBar) progressBar.style.width = `${pct}%`;

    const moduleEl = document.querySelector(`[data-module="${moduleId}"]`);
    if (moduleEl) {
      const label = moduleEl.querySelector(".module-progress .muted");
      if (label) label.textContent = `${completed}/${total} lessons`;

      const btn = moduleEl.querySelector("[data-start-module]");
      if (btn) btn.textContent = completed === 0 ? "Start" : completed === total ? "Review" : "Continue";
    }
  });
}

let currentQuiz = null;
let currentQuestionIndex = 0;

function startModule(moduleId) {
  const module = LEARNING_MODULES[moduleId];
  if (!module) return;

  const progress = getLearnProgress();
  const completedLessons = progress.completed[moduleId] || [];

  // Find first incomplete lesson, or start from beginning for review
  let lessonIndex = completedLessons.length;
  if (lessonIndex >= module.lessons.length) lessonIndex = 0;

  currentQuiz = { moduleId, module, lessonIndex };
  currentQuestionIndex = 0;

  showLesson(module.lessons[lessonIndex]);

  const modal = document.querySelector("[data-quiz-modal]");
  if (modal) {
    modal.hidden = false;
    document.querySelector("[data-quiz-title]").textContent = module.title;
    document.querySelector("[data-quiz-current]").textContent = lessonIndex + 1;
    document.querySelector("[data-quiz-total]").textContent = module.lessons.length;
  }
}

function showLesson(lesson) {
  const lessonEl = document.querySelector("[data-quiz-lesson]");
  const questionEl = document.querySelector("[data-quiz-question]");
  const feedbackEl = document.querySelector("[data-quiz-feedback]");
  const nextBtn = document.querySelector("[data-quiz-next]");
  const finishBtn = document.querySelector("[data-quiz-finish]");

  if (lessonEl) lessonEl.innerHTML = `<p>${lesson.content}</p>`;
  if (questionEl) questionEl.hidden = false;
  if (feedbackEl) feedbackEl.hidden = true;
  if (nextBtn) nextBtn.hidden = true;
  if (finishBtn) finishBtn.hidden = true;

  document.querySelector("[data-question-text]").textContent = lesson.question;

  const optionsEl = document.querySelector("[data-quiz-options]");
  if (optionsEl) {
    optionsEl.innerHTML = lesson.options
      .map((opt, i) => `<button class="quiz-option" type="button" data-option="${i}">${opt}</button>`)
      .join("");

    optionsEl.querySelectorAll(".quiz-option").forEach(btn => {
      btn.addEventListener("click", () => handleAnswer(parseInt(btn.dataset.option, 10), lesson));
    });
  }
}

function handleAnswer(selectedIndex, lesson) {
  const isCorrect = selectedIndex === lesson.correct;
  const optionsEl = document.querySelector("[data-quiz-options]");
  const feedbackEl = document.querySelector("[data-quiz-feedback]");
  const questionEl = document.querySelector("[data-quiz-question]");

  // Disable all options and show result
  optionsEl.querySelectorAll(".quiz-option").forEach((btn, i) => {
    btn.disabled = true;
    if (i === lesson.correct) btn.classList.add("correct");
    else if (i === selectedIndex && !isCorrect) btn.classList.add("incorrect");
  });

  // Award points
  const progress = getLearnProgress();
  if (isCorrect) {
    progress.points = (progress.points || 0) + 25;
    state.rewardPoints += 25;
  } else {
    progress.points = (progress.points || 0) + 5; // Participation points
    state.rewardPoints += 5;
  }

  // Update last learn date and streak
  const today = new Date().toISOString().split("T")[0];
  if (progress.lastLearnDate !== today) {
    progress.streak = progress.lastLearnDate === new Date(Date.now() - 86400000).toISOString().split("T")[0]
      ? (progress.streak || 0) + 1
      : 1;
    progress.lastLearnDate = today;
  }

  saveLearnProgress(progress);
  scheduleSave();

  // Show feedback
  setTimeout(() => {
    if (questionEl) questionEl.hidden = true;
    if (feedbackEl) {
      feedbackEl.hidden = false;
      document.querySelector("[data-feedback-icon]").textContent = isCorrect ? "🎉" : "📚";
      document.querySelector("[data-feedback-text]").textContent = isCorrect ? "Correct! +25 points" : "Not quite, but +5 points for learning!";
      document.querySelector("[data-feedback-explanation]").textContent = lesson.explanation;
    }

    const module = currentQuiz.module;
    const isLastLesson = currentQuiz.lessonIndex >= module.lessons.length - 1;

    if (isLastLesson) {
      document.querySelector("[data-quiz-finish]").hidden = false;
    } else {
      document.querySelector("[data-quiz-next]").hidden = false;
    }
  }, 800);
}

function nextLesson() {
  const progress = getLearnProgress();
  if (!progress.completed[currentQuiz.moduleId]) {
    progress.completed[currentQuiz.moduleId] = [];
  }
  if (!progress.completed[currentQuiz.moduleId].includes(currentQuiz.lessonIndex)) {
    progress.completed[currentQuiz.moduleId].push(currentQuiz.lessonIndex);
  }
  saveLearnProgress(progress);

  currentQuiz.lessonIndex++;
  const lesson = currentQuiz.module.lessons[currentQuiz.lessonIndex];

  document.querySelector("[data-quiz-current]").textContent = currentQuiz.lessonIndex + 1;
  showLesson(lesson);
}

function finishModule() {
  const progress = getLearnProgress();
  if (!progress.completed[currentQuiz.moduleId]) {
    progress.completed[currentQuiz.moduleId] = [];
  }
  if (!progress.completed[currentQuiz.moduleId].includes(currentQuiz.lessonIndex)) {
    progress.completed[currentQuiz.moduleId].push(currentQuiz.lessonIndex);
  }
  saveLearnProgress(progress);

  closeQuizModal();
  updateLearnUI();
  updateRewardsUI();

  // Trigger celebration for completing a module
  const completedCount = progress.completed[currentQuiz.moduleId]?.length || 0;
  if (completedCount === currentQuiz.module.lessons.length) {
    triggerCelebration({
      icon: "🎓",
      title: "Module Complete!",
      message: `You've finished ${currentQuiz.module.title}!`,
      badge: "Knowledge Seeker",
      badgeDesc: "Completed a learning module",
    });
  }
}

function closeQuizModal() {
  const modal = document.querySelector("[data-quiz-modal]");
  if (modal) modal.hidden = true;
  currentQuiz = null;
}

function initLearnTab() {
  // Module start buttons
  document.querySelectorAll("[data-start-module]").forEach(btn => {
    btn.addEventListener("click", () => startModule(btn.dataset.startModule));
  });

  // Quiz close button
  document.querySelector("[data-quiz-close]")?.addEventListener("click", closeQuizModal);
  document.querySelector("[data-quiz-next]")?.addEventListener("click", nextLesson);
  document.querySelector("[data-quiz-finish]")?.addEventListener("click", finishModule);

  updateLearnUI();
}

// Expose learn tab functions globally
Object.assign(window, {
  initLearnTab,
});

// Goal Celebrations & Confetti
const MILESTONE_THRESHOLDS = [25, 50, 75, 100];
