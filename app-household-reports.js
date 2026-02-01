// PHASE 3: HOUSEHOLD & SHARING - REPORTS
// ============================================================

let lastGeneratedReport = null;

function formatCategoryName(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}

function generateReport(type) {
  const now = new Date();
  const monthName = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  let title = "";
  let content = "";

  const income = state.income || 0;
  const expenses = Object.entries(state.expenses)
    .filter(([_, v]) => v > 0)
    .map(([k, v]) => ({ category: k, amount: v }));
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const surplus = income - totalExpenses;
  const assets = calculateTotalAssets();
  const liabilities = calculateTotalLiabilities();
  const netWorth = assets - liabilities;
  let rows = [];

  switch (type) {
    case "monthly":
      title = `Monthly Summary - ${monthName}`;
      rows = [
        ["Report Period", monthName],
        ["Primary Salary (Monthly)", formatCurrency(income)],
        ["Total Income (Monthly)", formatCurrency(income)],
        ["", ""],
        ["Expenses", ""],
        ...expenses.map((e) => [formatCategoryName(e.category), formatCurrency(e.amount)]),
        ["Total Expenses", formatCurrency(totalExpenses)],
        ["", ""],
        ["Monthly Surplus", formatCurrency(surplus)],
        ["Savings Rate", `${income > 0 ? ((surplus / income) * 100).toFixed(1) : 0}%`],
        ["Generated", now.toLocaleString("en-GB")],
      ];
      content = `
MONTHLY FINANCIAL SUMMARY
${monthName}
${"=".repeat(40)}

INCOME
------
Primary Salary:           ${formatCurrency(income)}
${"─".repeat(40)}
Total Income:             ${formatCurrency(income)}

EXPENSES
--------
${expenses.map((e) => `${e.category.padEnd(25)} ${formatCurrency(e.amount)}`).join("\n")}
${"─".repeat(40)}
Total Expenses:           ${formatCurrency(totalExpenses)}

SUMMARY
-------
Monthly Surplus:          ${formatCurrency(surplus)}
Savings Rate:             ${income > 0 ? ((surplus / income) * 100).toFixed(1) : 0}%

Generated: ${now.toLocaleString("en-GB")}
      `;
      break;

    case "annual":
      title = `Annual Report - ${now.getFullYear()}`;
      rows = [
        ["Year", String(now.getFullYear())],
        ["Projected Annual Income", formatCurrency(income * 12)],
        ["Projected Annual Expenses", formatCurrency(totalExpenses * 12)],
        ["Projected Annual Savings", formatCurrency(surplus * 12)],
        ["", ""],
        ["Net Worth", formatCurrency(netWorth)],
        ["Total Assets", formatCurrency(assets)],
        ["Total Liabilities", formatCurrency(liabilities)],
        ["", ""],
        ["Monthly Savings Rate", `${income > 0 ? ((surplus / income) * 100).toFixed(1) : 0}%`],
        ["Debt to Income Ratio", `${income > 0 ? ((liabilities / (income * 12)) * 100).toFixed(1) : 0}%`],
        ["Generated", now.toLocaleString("en-GB")],
      ];
      content = `
ANNUAL FINANCIAL REPORT
Year: ${now.getFullYear()}
${"=".repeat(40)}

ANNUAL PROJECTIONS
------------------
Projected Annual Income:    ${formatCurrency(income * 12)}
Projected Annual Expenses:  ${formatCurrency(totalExpenses * 12)}
Projected Annual Savings:   ${formatCurrency(surplus * 12)}

CURRENT POSITION
----------------
Net Worth:                  ${formatCurrency(netWorth)}
Total Assets:               ${formatCurrency(assets)}
Total Liabilities:          ${formatCurrency(liabilities)}

KEY METRICS
-----------
Monthly Savings Rate:       ${income > 0 ? ((surplus / income) * 100).toFixed(1) : 0}%
Debt to Income Ratio:       ${income > 0 ? ((liabilities / (income * 12)) * 100).toFixed(1) : 0}%

Generated: ${now.toLocaleString("en-GB")}
      `;
      break;

    case "tax": {
      const taxYear =
        now.getMonth() >= 3
          ? `${now.getFullYear()}/${now.getFullYear() + 1}`
          : `${now.getFullYear() - 1}/${now.getFullYear()}`;
      title = `Tax Year Summary - ${taxYear}`;
      rows = [
        ["Tax Year", taxYear],
        ["Gross Annual Salary", formatCurrency(state.annualSalary || income * 12)],
        ["Income Tax", "Calculated via PAYE"],
        ["National Insurance", "Calculated via PAYE"],
        ...(state.pensionContrib ? [["Pension Contributions", "5% of gross"]] : []),
        ...(state.studentLoan ? [["Student Loan Repayments", "Plan 2"]] : []),
        ["Generated", now.toLocaleString("en-GB")],
      ];
      content = `
TAX YEAR SUMMARY
Tax Year: ${taxYear} (6 April - 5 April)
${"=".repeat(40)}

EMPLOYMENT INCOME
-----------------
Gross Annual Salary:        ${formatCurrency(state.annualSalary || income * 12)}

DEDUCTIONS (ESTIMATED)
----------------------
Income Tax:                 Calculated via PAYE
National Insurance:         Calculated via PAYE
${state.pensionContrib ? "Pension Contributions:      5% of gross" : ""}
${state.studentLoan ? "Student Loan Repayments:    Plan 2" : ""}

NOTES
-----
- This is a summary for record-keeping
- Consult HMRC for official tax calculations
- Keep receipts for any tax-deductible expenses

Generated: ${now.toLocaleString("en-GB")}
      `;
      break;
    }

    case "networth":
      title = "Net Worth Statement";
      rows = [
        ["As of", now.toLocaleDateString("en-GB")],
        ["", ""],
        ["Assets", ""],
        ["Cash Savings", formatCurrency(state.assets.cashSavings || 0)],
        ["Cash ISA", formatCurrency(state.assets.cashISA || 0)],
        ["Stocks & Shares ISA", formatCurrency(state.assets.stocksISA || 0)],
        ["General Investments", formatCurrency(state.assets.generalInvestments || 0)],
        ["Pension Value", formatCurrency(state.assets.pensionValue || 0)],
        ["Property Value", formatCurrency(state.assets.propertyValue || 0)],
        ["Other Property Value", formatCurrency(state.assets.otherPropertyValue || 0)],
        ["Vehicle Value", formatCurrency(state.assets.vehicleValue || 0)],
        ["Other Assets", formatCurrency(state.assets.otherAssets || 0)],
        ["Total Assets", formatCurrency(assets)],
        ["", ""],
        ["Liabilities", ""],
        ["Mortgage Balance", formatCurrency(state.liabilities.mortgageBalance || 0)],
        ["Other Mortgages", formatCurrency(state.liabilities.otherMortgages || 0)],
        ["Personal Loans", formatCurrency(state.liabilities.personalLoansBalance || 0)],
        ["Car Finance", formatCurrency(state.liabilities.carFinanceBalance || 0)],
        ["Credit Cards", formatCurrency(state.liabilities.creditCardBalance || 0)],
        ["Overdraft", formatCurrency(state.liabilities.overdraftBalance || 0)],
        ["Student Loan", formatCurrency(state.liabilities.studentLoanBalance || 0)],
        ["Other Debts", formatCurrency(state.liabilities.otherDebts || 0)],
        ["Total Liabilities", formatCurrency(liabilities)],
        ["", ""],
        ["Net Worth", formatCurrency(netWorth)],
        ["Generated", now.toLocaleString("en-GB")],
      ];
      content = `
NET WORTH STATEMENT
As of: ${now.toLocaleDateString("en-GB")}
${"=".repeat(40)}

ASSETS
------
Cash Savings:               ${formatCurrency(state.assets.cashSavings || 0)}
Cash ISA:                   ${formatCurrency(state.assets.cashISA || 0)}
Stocks & Shares ISA:        ${formatCurrency(state.assets.stocksISA || 0)}
General Investments:        ${formatCurrency(state.assets.generalInvestments || 0)}
Pension Value:              ${formatCurrency(state.assets.pensionValue || 0)}
Property Value:             ${formatCurrency(state.assets.propertyValue || 0)}
Other Property Value:       ${formatCurrency(state.assets.otherPropertyValue || 0)}
Vehicle Value:              ${formatCurrency(state.assets.vehicleValue || 0)}
Other Assets:               ${formatCurrency(state.assets.otherAssets || 0)}
${"─".repeat(40)}
TOTAL ASSETS:               ${formatCurrency(assets)}

LIABILITIES
-----------
Mortgage:                   ${formatCurrency(state.liabilities.mortgageBalance || 0)}
Other Mortgages:            ${formatCurrency(state.liabilities.otherMortgages || 0)}
Personal Loans:             ${formatCurrency(state.liabilities.personalLoansBalance || 0)}
Car Finance:                ${formatCurrency(state.liabilities.carFinanceBalance || 0)}
Credit Cards:               ${formatCurrency(state.liabilities.creditCardBalance || 0)}
Overdraft:                  ${formatCurrency(state.liabilities.overdraftBalance || 0)}
Student Loan:               ${formatCurrency(state.liabilities.studentLoanBalance || 0)}
Other Debts:                ${formatCurrency(state.liabilities.otherDebts || 0)}
${"─".repeat(40)}
TOTAL LIABILITIES:          ${formatCurrency(liabilities)}

${"=".repeat(40)}
NET WORTH:                  ${formatCurrency(netWorth)}
${"=".repeat(40)}

Generated: ${now.toLocaleString("en-GB")}
      `;
      break;

    default:
      return;
  }

  showReportModal(title, content);
  lastGeneratedReport = { title, content, rows };
}

function showReportModal(title, content) {
  const modal = document.querySelector("[data-report-modal]");
  const titleEl = document.querySelector("[data-report-title]");
  const previewEl = document.querySelector("[data-report-preview]");

  if (!modal || !previewEl) return;

  titleEl.textContent = title;
  previewEl.textContent = content.trim();

  modal.hidden = false;
}

function closeReportModal() {
  const modal = document.querySelector("[data-report-modal]");
  if (modal) modal.hidden = true;
}

function copyReport() {
  const content = document.querySelector("[data-report-preview]")?.textContent;
  if (!content) return;

  navigator.clipboard
    .writeText(content)
    .then(() => {
      showNotification("Report copied to clipboard!", "success");
    })
    .catch(() => {
      showNotification("Failed to copy to clipboard", "error");
    });
}

function downloadReport() {
  const title = document.querySelector("[data-report-title]")?.textContent || "Report";
  const content = document.querySelector("[data-report-preview]")?.textContent;

  if (!content) {
    showNotification("No report content to download", "error");
    return;
  }

  let url = null;
  try {
    const blob = new Blob([content], { type: "text/plain" });
    url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9 ]/gi, "_").replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotification("Report downloaded successfully!", "success");
  } catch (error) {
    console.error("Download failed:", error);
    showNotification("Failed to download report", "error");
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

function downloadReportExcel() {
  if (!lastGeneratedReport || !lastGeneratedReport.rows) {
    showNotification("Generate a report before downloading.", "warning");
    return;
  }

  if (typeof XLSX === "undefined") {
    showNotification("Excel export is unavailable. Please refresh and try again.", "error");
    return;
  }

  const title = lastGeneratedReport.title || "Report";
  const rows = [["Metric", "Value"], ...lastGeneratedReport.rows];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9 ]/gi, "_").replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification("Excel report downloaded!", "success");
}
