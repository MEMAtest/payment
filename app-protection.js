// Protection Check - Comprehensive Financial Health Score
function calculateProtectionScore() {
  const snapshot = getFinanceSnapshot();
  const bufferMonths = snapshot.expenses > 0 ? snapshot.savings / snapshot.expenses : 0;
  const debtRatio = snapshot.income > 0 ? snapshot.debt / snapshot.income : 0;
  const savingsRate = snapshot.income > 0 ? snapshot.surplus / snapshot.income : 0;

  const categories = {
    emergency: { name: "Emergency Fund", score: 0, max: 25, status: "", issues: [], tips: [] },
    debt: { name: "Debt Health", score: 0, max: 25, status: "", issues: [], tips: [] },
    budget: { name: "Budget Balance", score: 0, max: 25, status: "", issues: [], tips: [] },
    goals: { name: "Goal Progress", score: 0, max: 25, status: "", issues: [], tips: [] },
  };

  // Emergency Fund scoring (0-25 points)
  // Target: 6+ months buffer = full score
  if (bufferMonths >= 6) {
    categories.emergency.score = 25;
    categories.emergency.status = "excellent";
  } else if (bufferMonths >= 3) {
    categories.emergency.score = 15 + Math.round((bufferMonths - 3) * 3.33);
    categories.emergency.status = "good";
    categories.emergency.tips.push("Build to 6 months for full protection");
  } else if (bufferMonths >= 1) {
    categories.emergency.score = 5 + Math.round((bufferMonths - 1) * 5);
    categories.emergency.status = "fair";
    categories.emergency.issues.push({ text: "Emergency buffer below 3 months", severity: "medium" });
    categories.emergency.tips.push("Aim for 3 months of expenses saved");
  } else {
    categories.emergency.score = Math.round(bufferMonths * 5);
    categories.emergency.status = "poor";
    categories.emergency.issues.push({ text: "Emergency buffer below 1 month", severity: "high" });
    categories.emergency.tips.push("Prioritise building a 1-month buffer");
  }

  // Debt Health scoring (0-25 points)
  // Target: debt ratio < 10% = full score
  if (debtRatio <= 0.1) {
    categories.debt.score = 25;
    categories.debt.status = "excellent";
  } else if (debtRatio <= 0.2) {
    categories.debt.score = 20 - Math.round((debtRatio - 0.1) * 50);
    categories.debt.status = "good";
  } else if (debtRatio <= 0.35) {
    categories.debt.score = 15 - Math.round((debtRatio - 0.2) * 33);
    categories.debt.status = "fair";
    categories.debt.issues.push({ text: "Debt payments above 20% of income", severity: "medium" });
    categories.debt.tips.push("Consider debt consolidation or faster repayment");
  } else {
    categories.debt.score = Math.max(0, 10 - Math.round((debtRatio - 0.35) * 20));
    categories.debt.status = "poor";
    categories.debt.issues.push({ text: "Debt payments exceed 35% of income", severity: "high" });
    categories.debt.tips.push("Review high-interest debts urgently");
  }

  // Budget Balance scoring (0-25 points)
  // Target: savings rate >= 20% = full score
  if (snapshot.surplus < 0) {
    categories.budget.score = 0;
    categories.budget.status = "poor";
    categories.budget.issues.push({ text: "Monthly expenses exceed income", severity: "high" });
    categories.budget.tips.push("Review and reduce non-essential spending");
  } else if (savingsRate >= 0.2) {
    categories.budget.score = 25;
    categories.budget.status = "excellent";
  } else if (savingsRate >= 0.1) {
    categories.budget.score = 15 + Math.round((savingsRate - 0.1) * 100);
    categories.budget.status = "good";
    categories.budget.tips.push("Increase savings rate to 20% for optimal growth");
  } else if (savingsRate > 0) {
    categories.budget.score = Math.round(savingsRate * 150);
    categories.budget.status = "fair";
    categories.budget.issues.push({ text: "Savings rate below 10%", severity: "medium" });
    categories.budget.tips.push("Look for ways to increase monthly surplus");
  } else {
    categories.budget.score = 5;
    categories.budget.status = "fair";
  }

  // Goal Progress scoring (0-25 points)
  const goals = state.goals || [];
  if (goals.length === 0) {
    categories.goals.score = 5;
    categories.goals.status = "fair";
    categories.goals.issues.push({ text: "No financial goals set", severity: "low" });
    categories.goals.tips.push("Set at least one savings goal to track progress");
  } else {
    const goalsWithTargets = goals.filter((g) => g.target > 0);
    const goalsOnTrack = goalsWithTargets.filter((g) => {
      const eta = calculateGoalETA(g);
      return eta.status === "complete" || eta.status === "on-track" || eta.status === "in-progress";
    });
    const goalsContributing = goals.filter((g) => g.monthly > 0);

    let goalScore = 5; // Base for having goals
    if (goalsWithTargets.length > 0) {
      const trackRate = goalsOnTrack.length / goalsWithTargets.length;
      goalScore += Math.round(trackRate * 15);
    }
    if (goalsContributing.length > 0) {
      goalScore += 5;
    }

    categories.goals.score = Math.min(25, goalScore);

    if (categories.goals.score >= 20) {
      categories.goals.status = "excellent";
    } else if (categories.goals.score >= 15) {
      categories.goals.status = "good";
    } else {
      categories.goals.status = "fair";
      const behindGoals = goals.filter((g) => {
        const eta = calculateGoalETA(g);
        return eta.status === "behind";
      });
      if (behindGoals.length > 0) {
        categories.goals.issues.push({ text: `${behindGoals.length} goal(s) behind schedule`, severity: "medium" });
        categories.goals.tips.push("Increase contributions to catch up");
      }
      if (goalsContributing.length === 0 && goals.length > 0) {
        categories.goals.issues.push({ text: "No goals receiving monthly contributions", severity: "medium" });
        categories.goals.tips.push("Set up monthly contributions to reach goals");
      }
    }
  }

  // Calculate total score
  const totalScore = Object.values(categories).reduce((sum, cat) => sum + cat.score, 0);

  // Determine overall status
  let overallStatus = "poor";
  let statusLabel = "Needs Work";
  if (totalScore >= 80) {
    overallStatus = "excellent";
    statusLabel = "Excellent";
  } else if (totalScore >= 60) {
    overallStatus = "good";
    statusLabel = "Good";
  } else if (totalScore >= 40) {
    overallStatus = "fair";
    statusLabel = "Fair";
  }

  // Collect all issues
  const allIssues = Object.values(categories).flatMap((cat) => cat.issues);

  // Get top tips (prioritise based on lowest category scores)
  const sortedCategories = Object.entries(categories).sort((a, b) => a[1].score - b[1].score);
  const topTips = sortedCategories.flatMap(([, cat]) => cat.tips).slice(0, 3);

  return {
    total: totalScore,
    status: overallStatus,
    statusLabel,
    categories,
    issues: allIssues,
    tips: topTips,
    metrics: { bufferMonths, debtRatio, savingsRate },
  };
}

function updateProtectionCheck() {
  const container = document.querySelector("[data-protection-check]");
  if (!container) return;

  const score = calculateProtectionScore();

  // Update gauge
  const gaugeValue = container.querySelector("[data-protection-score]");
  const gaugeLabel = container.querySelector("[data-protection-label]");
  const gaugeFill = container.querySelector("[data-protection-gauge-fill]");

  if (gaugeValue) gaugeValue.textContent = score.total;
  if (gaugeLabel) {
    gaugeLabel.textContent = score.statusLabel;
    gaugeLabel.className = `protection-label ${score.status}`;
  }
  if (gaugeFill) {
    gaugeFill.style.setProperty("--score", score.total);
  }

  // Update category bars
  const categoryList = container.querySelector("[data-protection-categories]");
  if (categoryList) {
    categoryList.innerHTML = Object.entries(score.categories)
      .map(
        ([key, cat]) => `
        <div class="protection-category" data-status="${cat.status}">
          <div class="category-header">
            <span class="category-name">${escapeHtml(cat.name)}</span>
            <span class="category-score">${cat.score}/${cat.max}</span>
          </div>
          <div class="category-bar">
            <div class="category-fill" style="width: ${(cat.score / cat.max) * 100}%"></div>
          </div>
        </div>
      `
      )
      .join("");
  }

  // Update issues
  const issuesList = container.querySelector("[data-protection-issues]");
  if (issuesList) {
    if (score.issues.length === 0) {
      issuesList.innerHTML = '<li class="protection-issue good"><span>No critical issues found</span></li>';
    } else {
      issuesList.innerHTML = score.issues
        .map(
          (issue) =>
            `<li class="protection-issue ${escapeHtml(issue.severity)}"><span>${escapeHtml(issue.text)}</span><span class="severity ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span></li>`
        )
        .join("");
    }
  }

  // Update tips
  const tipsList = container.querySelector("[data-protection-tips]");
  if (tipsList) {
    if (score.tips.length === 0) {
      tipsList.innerHTML = '<li class="protection-tip">Keep up the great work!</li>';
    } else {
      tipsList.innerHTML = score.tips.map((tip) => `<li class="protection-tip">${escapeHtml(tip)}</li>`).join("");
    }
  }
}

// Legacy vulnerability panel (calls new Protection Check)
function updateVulnerabilityPanel() {
  updateProtectionCheck();

  // Also update legacy elements if they exist
  const vulnList = document.querySelector("[data-vulnerability-list]");
  const vulnScore = document.querySelector("[data-vulnerability-score]");
  if (!vulnList && !vulnScore) return;

  const score = calculateProtectionScore();

  if (vulnList) {
    if (score.issues.length === 0) {
      vulnList.innerHTML = '<li class="vuln-item"><span>No major vulnerabilities detected</span><span class="severity low">Good</span></li>';
    } else {
      vulnList.innerHTML = score.issues
        .map((v) => `<li class="vuln-item"><span>${escapeHtml(v.text)}</span><span class="severity ${escapeHtml(v.severity)}">${escapeHtml(v.severity)}</span></li>`)
        .join("");
    }
  }

  if (vulnScore) {
    vulnScore.textContent = score.statusLabel;
  }
}
