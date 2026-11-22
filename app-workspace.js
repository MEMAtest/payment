// ============================================================
// PAYTP — SINGLE-SCREEN UNIFIED COMMAND CENTER CONTROLLER
// Zero sign-in lockup · Live Neon Postgres Sync + Local Fallback
// ============================================================

(function () {
  const STORAGE_KEYS = {
    state: "consumerpay_state_v1",
    transactions: "consumerpay_transactions_v1",
    investments: "consumerpay_investments_v1",
    workspaceId: "paytp_workspace_id_v1",
    seeded: "paytp_seeded_v1",
  };

  const API_ENDPOINT = "/.netlify/functions/workspace";

  const CATEGORIES = {
    mortgage: { label: "Housing", group: "Housing" },
    councilTax: { label: "Council Tax", group: "Housing" },
    homeInsurance: { label: "Home Insurance", group: "Housing" },
    energy: { label: "Bills & Utilities", group: "Utilities" },
    water: { label: "Water", group: "Utilities" },
    internet: { label: "Internet & Phone", group: "Utilities" },
    streaming: { label: "Streaming", group: "Subscriptions" },
    groceries: { label: "Groceries", group: "Food" },
    diningOut: { label: "Eating Out", group: "Food" },
    coffeeSnacks: { label: "Coffee & Snacks", group: "Food" },
    fuel: { label: "Fuel / EV", group: "Transport" },
    publicTransport: { label: "Transport", group: "Transport" },
    carPayment: { label: "Car Payment", group: "Transport" },
    carInsurance: { label: "Car Insurance", group: "Transport" },
    subscriptions: { label: "Subscriptions", group: "Subscriptions" },
    gym: { label: "Gym & Health", group: "Lifestyle" },
    clothing: { label: "Shopping", group: "Lifestyle" },
    personalCare: { label: "Personal Care", group: "Lifestyle" },
    entertainment: { label: "Entertainment", group: "Lifestyle" },
    childcare: { label: "Childcare", group: "Other" },
    creditCards: { label: "Credit Cards", group: "Debt" },
    personalLoans: { label: "Loans", group: "Debt" },
    income: { label: "Income", group: "Income" },
    other: { label: "Other", group: "Other" },
  };

  const BUDGET_BUCKETS = [
    { key: "mortgage", label: "Housing" },
    { key: "groceries", label: "Food & drink" },
    { key: "energy", label: "Bills & utilities" },
    { key: "publicTransport", label: "Transport" },
    { key: "entertainment", label: "Lifestyle" },
    { key: "subscriptions", label: "Other & subs" },
  ];

  const PALETTE = ["#2563eb", "#22c55e", "#38bdf8", "#818cf8", "#f59e0b", "#ec4899", "#94a3b8"];

  const UK_TAX = {
    personalAllowance: 12570,
    basicRateLimit: 50270,
    higherRateLimit: 125140,
    basicRate: 0.2,
    higherRate: 0.4,
    additionalRate: 0.45,
    niThreshold: 12570,
    niUpperLimit: 50270,
    niRate: 0.08,
    niUpperRate: 0.02,
    studentLoanThreshold: 27295,
    studentLoanRate: 0.09,
  };

  // ============================================================
  // SHARED HELPERS (also used by app-import-parse.js)
  // ============================================================
  function generateSecureId(prefix = "id") {
    const rand =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    return `${prefix}-${Date.now()}-${rand}`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(val, decimals = 0) {
    const num = Number(val) || 0;
    const abs = Math.abs(num);
    const formatted = abs.toLocaleString("en-GB", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${num < 0 ? "-" : ""}£${formatted}`;
  }

  function formatSignedCurrency(val, decimals = 0) {
    const num = Number(val) || 0;
    if (num === 0) return formatCurrency(0, decimals);
    return `${num > 0 ? "+" : ""}${formatCurrency(num, decimals)}`;
  }

  function formatCompact(val) {
    const num = Number(val) || 0;
    const abs = Math.abs(num);
    if (abs >= 1_000_000) return `${num < 0 ? "-" : ""}£${(abs / 1_000_000).toFixed(2)}m`;
    if (abs >= 10_000) return `${num < 0 ? "-" : ""}£${(abs / 1_000).toFixed(1)}k`;
    return formatCurrency(num, 0);
  }

  function monogramColor(text) {
    const s = String(text || "P");
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % PALETTE.length;
    return PALETTE[Math.abs(hash) % PALETTE.length];
  }

  function showNotification(message, type = "info") {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(() => toast.remove(), 3400);
  }

  function updateProgress() {}

  Object.assign(window, {
    generateSecureId,
    escapeHtml,
    formatCurrency,
    showNotification,
    updateProgress,
  });

  // ============================================================
  // DEMO DATA FACTORY
  // ============================================================
  function buildDemoData() {
    return {
      demoState: {
        annualSalary: 88000,
        income: 0,
        pensionContrib: true,
        studentLoan: false,
        savings: 46800,
        liabilities: { otherDebt: 8400 },
        expenses: {
          mortgage: 1450,
          groceries: 480,
          energy: 245,
          publicTransport: 210,
          entertainment: 360,
          subscriptions: 175,
        },
      },
      demoHoldings: [
        { id: "inv-demo-1", ticker: "VWRP", name: "Vanguard FTSE All-World ETF", account: "ISA", assetClass: "ETF", quantity: 820, costBasis: 74000, currentValue: 88420 },
        { id: "inv-demo-2", ticker: "LS80", name: "Vanguard LifeStrategy 80%", account: "SIPP", assetClass: "Fund", quantity: 410, costBasis: 96000, currentValue: 118600 },
        { id: "inv-demo-3", ticker: "AAPL", name: "Apple Inc", account: "GIA", assetClass: "Stock", quantity: 140, costBasis: 19200, currentValue: 26840 },
        { id: "inv-demo-4", ticker: "MSFT", name: "Microsoft Corp", account: "GIA", assetClass: "Stock", quantity: 62, costBasis: 17500, currentValue: 22910 },
        { id: "inv-demo-5", ticker: "NVDA", name: "NVIDIA Corp", account: "GIA", assetClass: "Stock", quantity: 165, costBasis: 11800, currentValue: 19430 },
        { id: "inv-demo-6", ticker: "IGLT", name: "iShares Core UK Gilts", account: "SIPP", assetClass: "Bond", quantity: 1600, costBasis: 14800, currentValue: 15620 },
        { id: "inv-demo-7", ticker: "BTC", name: "Bitcoin", account: "Crypto", assetClass: "Crypto", quantity: 0.24, costBasis: 11200, currentValue: 16800 },
        { id: "inv-demo-8", ticker: "CSH2", name: "Lyxor Overnight Cash ETF", account: "ISA", assetClass: "Cash", quantity: 140, costBasis: 13800, currentValue: 14450 },
      ],
      demoTx: [
        { id: "tx-d1", date: "2026-11-20", description: "Amazon UK", amount: 79.99, type: "expense", category: "clothing", account: "Monzo", isRecurring: false },
        { id: "tx-d2", date: "2026-11-19", description: "Tesco Superstore", amount: 86.42, type: "expense", category: "groceries", account: "Barclays", isRecurring: false },
        { id: "tx-d3", date: "2026-11-18", description: "Uber Trip", amount: 18.80, type: "expense", category: "publicTransport", account: "Monzo", isRecurring: false },
        { id: "tx-d4", date: "2026-11-16", description: "Netflix UK", amount: 17.99, type: "expense", category: "subscriptions", account: "Starling", isRecurring: true },
        { id: "tx-d5", date: "2026-11-15", description: "Pret A Manger", amount: 9.75, type: "expense", category: "diningOut", account: "Monzo", isRecurring: false },
        { id: "tx-d6", date: "2026-11-14", description: "Octopus Energy", amount: 142.00, type: "expense", category: "energy", account: "Lloyds", isRecurring: true },
        { id: "tx-d7", date: "2026-11-12", description: "Spotify Family", amount: 19.99, type: "expense", category: "subscriptions", account: "Starling", isRecurring: true },
        { id: "tx-d8", date: "2026-11-10", description: "Waitrose & Partners", amount: 114.30, type: "expense", category: "groceries", account: "Barclays", isRecurring: false },
        { id: "tx-d9", date: "2026-11-08", description: "PureGym Membership", amount: 34.99, type: "expense", category: "gym", account: "Monzo", isRecurring: true },
        { id: "tx-d10", date: "2026-11-05", description: "Shell Fuel", amount: 58.40, type: "expense", category: "fuel", account: "Barclays", isRecurring: false },
        { id: "tx-d11", date: "2026-11-02", description: "Nationwide Mortgage", amount: 1450.00, type: "expense", category: "mortgage", account: "HSBC", isRecurring: true },
        { id: "tx-d12", date: "2026-11-01", description: "Monthly Salary", amount: 4920.00, type: "income", category: "income", account: "HSBC", isRecurring: true },
      ],
    };
  }

  // ============================================================
  // STATE + NEON POSTGRES CLOUD SYNC
  // ============================================================
  let financeState;
  let transactions = [];
  let holdings = [];
  let stMode = "all";
  let invAccountFilter = "all";
  let txPage = 1;
  let invPage = 1;
  const PAGE_SIZE = 7;
  let pendingBankImport = [];
  let pendingInvImport = [];
  let neonAvailable = false;
  let syncTimer = null;

  function getWorkspaceId() {
    let id = "";
    try { id = localStorage.getItem(STORAGE_KEYS.workspaceId) || ""; } catch {}
    if (!id) {
      id = `ws-${Math.random().toString(36).slice(2, 10)}`;
      try { localStorage.setItem(STORAGE_KEYS.workspaceId, id); } catch {}
    }
    return id;
  }

  function setSyncPill(text, isCloud = false) {
    const pill = document.getElementById("sync-status-pill");
    if (!pill) return;
    pill.textContent = text;
    pill.classList.toggle("cloud", isCloud);
  }

  function loadLocalState() {
    const seeded = localStorage.getItem(STORAGE_KEYS.seeded);
    let rawState = null;
    let rawTx = null;
    let rawInv = null;
    try { rawState = JSON.parse(localStorage.getItem(STORAGE_KEYS.state) || "null"); } catch {}
    try { rawTx = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || "null"); } catch {}
    try { rawInv = JSON.parse(localStorage.getItem(STORAGE_KEYS.investments) || "null"); } catch {}

    const hasUser =
      (rawState && (Number(rawState.annualSalary) > 0 || Number(rawState.savings) > 0)) ||
      (Array.isArray(rawTx) && rawTx.length > 0) ||
      (Array.isArray(rawInv) && rawInv.length > 0);

    const { demoState, demoHoldings, demoTx } = buildDemoData();
    if (!seeded && !hasUser) {
      financeState = demoState;
      holdings = demoHoldings;
      transactions = demoTx;
      localStorage.setItem(STORAGE_KEYS.seeded, "1");
      persistLocal();
      return;
    }

    financeState = {
      ...demoState,
      ...(rawState && typeof rawState === "object" ? rawState : {}),
      expenses: { ...demoState.expenses, ...(rawState?.expenses && typeof rawState.expenses === "object" ? rawState.expenses : {}) },
      liabilities: { ...(rawState?.liabilities && typeof rawState.liabilities === "object" ? rawState.liabilities : { otherDebt: 0 }) },
    };
    transactions = Array.isArray(rawTx) ? rawTx.filter((x) => x && typeof x === "object") : [];
    holdings = Array.isArray(rawInv) ? rawInv.filter((x) => x && typeof x === "object") : [];
  }

  function persistLocal() {
    try {
      localStorage.setItem(STORAGE_KEYS.state, JSON.stringify({ ...financeState, updatedAt: Date.now() }));
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
      localStorage.setItem(STORAGE_KEYS.investments, JSON.stringify(holdings));
    } catch {}
  }

  function persistAll() {
    persistLocal();
    if (neonAvailable) scheduleNeonSync();
  }

  function scheduleNeonSync() {
    clearTimeout(syncTimer);
    setSyncPill("Neon Syncing...", true);
    syncTimer = setTimeout(pushToNeon, 700);
  }

  async function pushToNeon() {
    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: getWorkspaceId(),
          financeState,
          transactions,
          holdings,
        }),
      });
      if (res.ok) {
        neonAvailable = true;
        setSyncPill("Neon DB Synced", true);
      } else {
        setSyncPill("Local Mode", false);
      }
    } catch {
      setSyncPill("Local Mode", false);
    }
  }

  async function hydrateFromNeon() {
    try {
      const res = await fetch(`${API_ENDPOINT}?id=${encodeURIComponent(getWorkspaceId())}`);
      if (!res.ok) {
        setSyncPill("Local Mode", false);
        return;
      }
      const data = await res.json();
      if (!data?.ok || !data.configured) {
        setSyncPill("Local Mode", false);
        return;
      }
      neonAvailable = true;
      if (data.exists) {
        if (data.financeState && typeof data.financeState === "object") {
          financeState = { ...financeState, ...data.financeState };
        }
        if (Array.isArray(data.transactions)) {
          transactions = data.transactions.filter((x) => x && typeof x === "object");
        }
        if (Array.isArray(data.holdings)) {
          holdings = data.holdings.filter((x) => x && typeof x === "object");
        }
        persistLocal();
        renderAll();
        setSyncPill("Neon DB Synced", true);
      } else {
        // First cloud visit: seed Neon with current local/demo workspace
        await pushToNeon();
      }
    } catch {
      setSyncPill("Local Mode", false);
    }
  }

  function resetToDemoData() {
    const { demoState, demoHoldings, demoTx } = buildDemoData();
    financeState = demoState;
    holdings = demoHoldings;
    transactions = demoTx;
    localStorage.setItem(STORAGE_KEYS.seeded, "1");
    persistAll();
    renderAll();
    showNotification("Demo finances, statements & portfolio restored.", "success");
  }

  // ============================================================
  // CALCULATIONS
  // ============================================================
  function calculateUKTax(annualSalary, pensionContrib, studentLoan) {
    const gross = Math.max(0, Number(annualSalary) || 0);
    if (gross === 0) return { monthlyNet: 0, monthlyTax: 0, monthlyNI: 0, monthlyExtra: 0 };

    const pension = pensionContrib ? gross * 0.05 : 0;
    const taxableBase = Math.max(0, gross - pension);
    let allowance = UK_TAX.personalAllowance;
    if (taxableBase > 100000) allowance = Math.max(0, allowance - (taxableBase - 100000) / 2);

    const taxable = Math.max(0, taxableBase - allowance);
    const basicBand = UK_TAX.basicRateLimit - UK_TAX.personalAllowance;
    const higherBand = UK_TAX.higherRateLimit - UK_TAX.basicRateLimit;

    let annualTax = 0;
    if (taxable <= basicBand) annualTax = taxable * UK_TAX.basicRate;
    else if (taxable <= basicBand + higherBand) {
      annualTax = basicBand * UK_TAX.basicRate + (taxable - basicBand) * UK_TAX.higherRate;
    } else {
      annualTax =
        basicBand * UK_TAX.basicRate +
        higherBand * UK_TAX.higherRate +
        (taxable - basicBand - higherBand) * UK_TAX.additionalRate;
    }

    let annualNI = 0;
    if (gross > UK_TAX.niThreshold) {
      annualNI += (Math.min(gross, UK_TAX.niUpperLimit) - UK_TAX.niThreshold) * UK_TAX.niRate;
      if (gross > UK_TAX.niUpperLimit) annualNI += (gross - UK_TAX.niUpperLimit) * UK_TAX.niUpperRate;
    }

    const annualLoan =
      studentLoan && gross > UK_TAX.studentLoanThreshold
        ? (gross - UK_TAX.studentLoanThreshold) * UK_TAX.studentLoanRate
        : 0;

    return {
      monthlyNet: Math.max(0, gross - annualTax - annualNI - pension - annualLoan) / 12,
      monthlyTax: annualTax / 12,
      monthlyNI: annualNI / 12,
      monthlyExtra: (pension + annualLoan) / 12,
    };
  }

  function getMonthlyIncome() {
    if (Number(financeState.income) > 0) return Number(financeState.income);
    return calculateUKTax(financeState.annualSalary, financeState.pensionContrib, financeState.studentLoan).monthlyNet;
  }

  function getMonthlyExpenses() {
    return BUDGET_BUCKETS.reduce((s, b) => s + Math.max(0, Number(financeState.expenses?.[b.key]) || 0), 0);
  }

  function getTotalDebt() {
    return Object.values(financeState.liabilities || {}).reduce((s, v) => s + Math.max(0, Number(v) || 0), 0);
  }

  function getPortfolioTotals(list = holdings) {
    let totalValue = 0;
    let totalCost = 0;
    let taxWrapped = 0;
    for (const h of list) {
      if (!h) continue;
      const val = Math.max(0, Number(h.currentValue) || 0);
      const cost = Math.max(0, Number(h.costBasis) || 0);
      totalValue += val;
      totalCost += cost;
      if (["ISA", "SIPP", "LISA"].includes(h.account)) taxWrapped += val;
    }
    const gain = totalValue - totalCost;
    const returnPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    return { totalValue, totalCost, gain, returnPct, taxWrapped };
  }

  // ============================================================
  // MINI CHARTS
  // ============================================================
  function renderSparkline(container, endVal) {
    if (!container) return;
    const v = Math.max(100, endVal);
    const pts = [0.88, 0.91, 0.90, 0.94, 0.96, 1.0].map((m, i) => [4 + i * 13, 26 - (m - 0.85) * 140]);
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1].toFixed(1)}`).join(" ");
    container.innerHTML = `<svg viewBox="0 0 74 30" width="100%" height="100%" aria-hidden="true">
      <path d="${path}" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="${pts[5][0]}" cy="${pts[5][1].toFixed(1)}" r="3" fill="#2563eb" />
    </svg>`;
  }

  function renderAllocBar(barEl, legendEl, slices) {
    if (!barEl || !legendEl) return;
    const valid = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const total = valid.reduce((s, x) => s + x.value, 0);
    if (total <= 0) {
      barEl.innerHTML = "";
      legendEl.innerHTML = `<span class="muted-xs">Drop a brokerage CSV or add holdings</span>`;
      return;
    }
    barEl.innerHTML = valid
      .map((s, i) => `<span style="width:${((s.value / total) * 100).toFixed(2)}%;background:${PALETTE[i % PALETTE.length]}" title="${escapeHtml(s.label)}: ${formatCompact(s.value)}"></span>`)
      .join("");
    legendEl.innerHTML = valid.slice(0, 6).map((s, i) => {
      const pct = Math.round((s.value / total) * 100);
      return `<span class="legend-chip"><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span><strong>${escapeHtml(s.label)}</strong> ${pct}%</span>`;
    }).join("");
  }

  // ============================================================
  // RENDERERS
  // ============================================================
  function renderAll() {
    renderKPIs();
    renderStatements();
    renderInvestments();
    renderCashflowModal();
  }

  function renderKPIs() {
    const port = getPortfolioTotals();
    const cash = Math.max(0, Number(financeState.savings) || 0);
    const debt = getTotalDebt();
    const netWorth = cash + port.totalValue - debt;
    const monthlyIn = getMonthlyIncome();
    const monthlyOut = getMonthlyExpenses();
    const surplus = monthlyIn - monthlyOut;
    const keptPct = monthlyIn > 0 ? Math.round((surplus / monthlyIn) * 100) : 0;

    document.getElementById("kpi-net-worth").textContent = formatCurrency(netWorth);
    document.getElementById("kpi-nw-sub").textContent =
      debt > 0 ? `Assets ${formatCompact(cash + port.totalValue)} − Debt ${formatCompact(debt)}` : "Cash + Investments";
    renderSparkline(document.getElementById("kpi-nw-spark"), netWorth);

    document.getElementById("kpi-investments").textContent = formatCurrency(port.totalValue);
    const invRet = document.getElementById("kpi-inv-return");
    invRet.textContent = port.totalCost > 0 ? `${port.returnPct >= 0 ? "+" : ""}${port.returnPct.toFixed(1)}%` : "—";
    invRet.className = `delta-pill ${port.gain >= 0 ? "pos" : "neg"}`;
    const wrapPct = port.totalValue > 0 ? Math.round((port.taxWrapped / port.totalValue) * 100) : 0;
    document.getElementById("kpi-inv-sub").textContent = `${holdings.length} holdings · ${wrapPct}% ISA/SIPP`;

    const surpEl = document.getElementById("kpi-surplus");
    surpEl.textContent = formatSignedCurrency(surplus);
    surpEl.className = `kpi-num ${surplus >= 0 ? "" : "neg"}`;
    const surpPill = document.getElementById("kpi-surplus-pct");
    surpPill.textContent = `${keptPct}% kept`;
    surpPill.className = `delta-pill ${surplus >= 0 ? "pos" : "neg"}`;
    document.getElementById("kpi-surplus-sub").textContent = `${formatCurrency(monthlyIn)} in · ${formatCurrency(monthlyOut)} out · Edit →`;

    document.getElementById("kpi-cash").textContent = formatCurrency(cash);
    const runway = monthlyOut > 0 ? `${(cash / monthlyOut).toFixed(1)} mo runway` : "No budget";
    document.getElementById("kpi-runway").textContent = runway;
    document.getElementById("kpi-debt-sub").textContent = debt > 0 ? `Debt: ${formatCurrency(debt)} · Edit →` : "Debt-free · Edit →";
  }

  function renderStatements() {
    const search = (document.getElementById("tx-search")?.value || "").trim().toLowerCase();
    const catFilter = document.getElementById("tx-cat-filter")?.value || "all";

    const totalIn = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const totalOut = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const recCount = transactions.filter((t) => t.isRecurring && t.type === "expense").length;

    document.getElementById("st-summary-line").textContent =
      `In ${formatCurrency(totalIn)} · Out ${formatCurrency(totalOut)} · Net ${formatSignedCurrency(totalIn - totalOut)}`;
    document.getElementById("st-count-all").textContent = String(transactions.length);
    document.getElementById("st-count-rec").textContent = String(recCount);

    const filtered = transactions
      .filter((tx) => {
        if (stMode === "recurring" && !tx.isRecurring) return false;
        if (stMode === "income" && tx.type !== "income") return false;
        if (catFilter !== "all" && (tx.category || "other") !== catFilter) return false;
        if (search) {
          const hay = `${tx.description || ""} ${tx.account || ""} ${tx.category || ""}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const catOptionsHtml = Object.entries(CATEGORIES)
      .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`)
      .join("");

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    txPage = Math.min(Math.max(1, txPage), totalPages);
    const startIdx = (txPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    const pageInfo = document.getElementById("tx-page-info");
    if (pageInfo) {
      pageInfo.textContent = filtered.length
        ? `Showing ${startIdx + 1}–${startIdx + pageRows.length} of ${filtered.length} · Drop CSV/XLSX/PDF here`
        : "0 rows · Drop CSV/XLSX/PDF here";
    }
    const prevBtn = document.getElementById("tx-prev-btn");
    const nextBtn = document.getElementById("tx-next-btn");
    if (prevBtn) prevBtn.disabled = txPage <= 1;
    if (nextBtn) nextBtn.disabled = txPage >= totalPages;

    const tbody = document.getElementById("tx-table-body");
    tbody.innerHTML = pageRows.length
      ? pageRows.map((tx) => {
          const isInc = tx.type === "income";
          const cat = tx.category || (isInc ? "income" : "other");
          return `<tr>
            <th scope="row">${escapeHtml(tx.date || "—")}</th>
            <td data-label="Merchant">
              <div class="mini-left">
                <span class="monogram" style="background:${monogramColor(tx.description)}">${escapeHtml((tx.description || "T").slice(0, 2).toUpperCase())}</span>
                <div>
                  <div>${escapeHtml(tx.description || "Transaction")}</div>
                  <div class="muted-xs">${escapeHtml(tx.account || "Bank")}${tx.isRecurring ? " · Recurring" : ""}</div>
                </div>
              </div>
            </td>
            <td data-label="Category">
              <select class="table-select" data-tx-cat="${escapeHtml(tx.id)}" aria-label="Category for ${escapeHtml(tx.description)}">
                ${catOptionsHtml.replace(`value="${cat}"`, `value="${cat}" selected`)}
              </select>
            </td>
            <td data-label="Amount" class="num ${isInc ? "pos" : ""}">
              <strong>${isInc ? "+" : "-"}${formatCurrency(Math.abs(tx.amount), 2)}</strong>
            </td>
            <td data-label="Delete" class="actions-col">
              <button type="button" class="icon-btn danger" data-del-tx="${escapeHtml(tx.id)}" aria-label="Delete">✕</button>
            </td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="5" class="empty-state">No transactions. Drop a bank CSV/PDF above or click "Sample".</td></tr>`;
  }

  function renderInvestments() {
    const search = (document.getElementById("inv-search")?.value || "").trim().toLowerCase();
    const filtered = holdings
      .filter((h) => {
        if (invAccountFilter !== "all" && h.account !== invAccountFilter) return false;
        if (search) {
          const hay = `${h.ticker || ""} ${h.name || ""} ${h.assetClass || ""} ${h.account || ""}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0));

    const totals = getPortfolioTotals(filtered);
    document.getElementById("inv-summary-line").textContent =
      `Cost ${formatCurrency(totals.totalCost)} · Value ${formatCurrency(totals.totalValue)} · ${formatSignedCurrency(totals.gain)}`;

    const byClass = new Map();
    for (const h of filtered) {
      const k = h.assetClass || "Stock";
      byClass.set(k, (byClass.get(k) || 0) + Math.max(0, Number(h.currentValue) || 0));
    }
    renderAllocBar(
      document.getElementById("inv-alloc-bar"),
      document.getElementById("inv-alloc-legend"),
      [...byClass.entries()].map(([label, value]) => ({ label, value }))
    );

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    invPage = Math.min(Math.max(1, invPage), totalPages);
    const startIdx = (invPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    const pageInfo = document.getElementById("inv-page-info");
    if (pageInfo) {
      pageInfo.textContent = filtered.length
        ? `Showing ${startIdx + 1}–${startIdx + pageRows.length} of ${filtered.length} · Drop broker CSV here`
        : "0 holdings · Drop broker CSV here";
    }
    const prevBtn = document.getElementById("inv-prev-btn");
    const nextBtn = document.getElementById("inv-next-btn");
    if (prevBtn) prevBtn.disabled = invPage <= 1;
    if (nextBtn) nextBtn.disabled = invPage >= totalPages;

    const tbody = document.getElementById("inv-table-body");
    tbody.innerHTML = pageRows.length
      ? pageRows.map((h) => {
          const val = Math.max(0, Number(h.currentValue) || 0);
          const cost = Math.max(0, Number(h.costBasis) || 0);
          const gain = val - cost;
          const pct = cost > 0 ? (gain / cost) * 100 : 0;
          return `<tr>
            <th scope="row">
              <div class="mini-left">
                <span class="monogram" style="background:${monogramColor(h.ticker)}">${escapeHtml((h.ticker || "H").slice(0, 3))}</span>
                <div>
                  <div>${escapeHtml(h.name)}</div>
                  <div class="muted-xs">${escapeHtml(h.ticker)} · ${escapeHtml(h.assetClass || "Stock")}</div>
                </div>
              </div>
            </th>
            <td data-label="Acct"><span class="acct-badge ${String(h.account || "").toLowerCase()}">${escapeHtml(h.account || "GIA")}</span></td>
            <td data-label="Cost" class="num">${formatCurrency(cost)}</td>
            <td data-label="Value" class="num"><strong>${formatCurrency(val)}</strong></td>
            <td data-label="Return" class="num ${gain >= 0 ? "pos" : "neg"}">
              ${formatSignedCurrency(gain)}<br /><span class="muted-xs">${cost > 0 ? `(${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : "(—)"}</span>
            </td>
            <td data-label="Actions" class="actions-col">
              <button type="button" class="icon-btn" data-edit-holding="${escapeHtml(h.id)}" aria-label="Edit">✎</button>
              <button type="button" class="icon-btn danger" data-del-holding="${escapeHtml(h.id)}" aria-label="Delete">✕</button>
            </td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="6" class="empty-state">No holdings. Click "+ Holding", drop a brokerage CSV, or click "Sample".</td></tr>`;
  }

  function renderCashflowModal() {
    const salaryEl = document.getElementById("cf-salary");
    const overrideEl = document.getElementById("cf-net-override");
    const savingsEl = document.getElementById("cf-savings");
    const debtEl = document.getElementById("cf-debt");

    if (document.activeElement !== salaryEl) salaryEl.value = financeState.annualSalary || "";
    if (document.activeElement !== overrideEl) overrideEl.value = financeState.income || "";
    document.getElementById("cf-pension").checked = Boolean(financeState.pensionContrib);
    document.getElementById("cf-student-loan").checked = Boolean(financeState.studentLoan);
    if (document.activeElement !== savingsEl) savingsEl.value = financeState.savings || "";
    if (document.activeElement !== debtEl) debtEl.value = getTotalDebt() || "";

    const tax = calculateUKTax(financeState.annualSalary, financeState.pensionContrib, financeState.studentLoan);
    const monthlyNet = getMonthlyIncome();
    const monthlyOut = getMonthlyExpenses();
    const surplus = monthlyNet - monthlyOut;

    document.getElementById("cf-monthly-net").textContent = `${formatCurrency(monthlyNet)} / mo`;
    document.getElementById("cf-monthly-tax").textContent = `-${formatCurrency(tax.monthlyTax)}`;
    document.getElementById("cf-monthly-ni").textContent = `-${formatCurrency(tax.monthlyNI)}`;
    document.getElementById("cf-monthly-extra").textContent = `-${formatCurrency(tax.monthlyExtra)}`;

    const liquidNet = Math.max(0, Number(financeState.savings) || 0) - getTotalDebt();
    const liqEl = document.getElementById("cf-liquid-net");
    liqEl.textContent = formatSignedCurrency(liquidNet);
    liqEl.className = liquidNet >= 0 ? "pos" : "neg";

    document.getElementById("cf-total-spend").textContent = formatCurrency(monthlyOut);
    const grid = document.getElementById("cf-budget-grid");
    if (!grid.dataset.built) {
      grid.innerHTML = BUDGET_BUCKETS.map(
        (b) => `<label class="budget-tile">
          <span>${escapeHtml(b.label)}</span>
          <input type="number" class="input" min="0" step="10" data-budget-key="${b.key}" placeholder="0" />
        </label>`
      ).join("");
      grid.dataset.built = "1";
    }
    for (const b of BUDGET_BUCKETS) {
      const inp = grid.querySelector(`[data-budget-key="${b.key}"]`);
      if (inp && document.activeElement !== inp) inp.value = financeState.expenses?.[b.key] || "";
    }

    const extra = Number(document.getElementById("sim-extra-save")?.value) || 0;
    document.getElementById("sim-extra-val").textContent = `+${formatCurrency(extra)}/mo`;
    const r = 0.045 / 12;
    let bal = Math.max(0, Number(financeState.savings) || 0);
    const contrib = Math.max(0, surplus + extra);
    for (let m = 0; m < 36; m++) bal = bal * (1 + r) + contrib;
    document.getElementById("sim-proj-3y").textContent = `${formatCurrency(bal)} in 3 yrs`;
  }

  // ============================================================
  // BANK & INVESTMENT IMPORTS
  // ============================================================
  async function handleBankFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let combined = [];
    for (const file of files) {
      const lower = file.name.toLowerCase();
      try {
        let parsed = [];
        if (lower.endsWith(".csv") || lower.endsWith(".txt")) parsed = await window.parseCSV(file);
        else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) parsed = await window.parseExcel(file);
        else if (lower.endsWith(".pdf")) parsed = await window.parsePDF(file);
        else { showNotification(`Unsupported file: ${file.name}`, "warning"); continue; }
        const acct = /monzo/i.test(lower) ? "Monzo" : /starling/i.test(lower) ? "Starling" : /hsbc/i.test(lower) ? "HSBC" : /barclays/i.test(lower) ? "Barclays" : /lloyds/i.test(lower) ? "Lloyds" : /revolut/i.test(lower) ? "Revolut" : "Bank";
        combined = combined.concat(parsed.map((t) => ({ ...t, account: t.account || acct })));
      } catch (err) {
        showNotification(`Failed to parse ${file.name}: ${err.message}`, "error");
      }
    }
    if (!combined.length) return showNotification("No transactions detected in that file.", "warning");
    combined = window.categorizeTransactions(combined);
    combined = window.detectRecurringPayments(combined);
    openBankImportPreview(combined, files.map((f) => f.name).join(", "));
  }

  function openBankImportPreview(items, sourceLabel) {
    pendingBankImport = items.map((tx) => ({
      ...tx,
      selected: tx.selected !== false,
      category: tx.category || (tx.type === "income" ? "income" : "other"),
    }));
    document.getElementById("bank-import-subtitle").textContent = `Source: ${sourceLabel}`;
    document.getElementById("bi-total").textContent = String(pendingBankImport.length);
    document.getElementById("bi-income").textContent = formatCurrency(pendingBankImport.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0), 2);
    document.getElementById("bi-expense").textContent = formatCurrency(pendingBankImport.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0), 2);
    document.getElementById("bi-recurring").textContent = String(pendingBankImport.filter((t) => t.isRecurring).length);

    const catOpts = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join("");
    document.getElementById("bi-table-body").innerHTML = pendingBankImport.map((tx, idx) => {
      const isInc = tx.type === "income";
      return `<tr>
        <td><input type="checkbox" data-bi-check="${idx}" checked aria-label="Select ${escapeHtml(tx.description)}" /></td>
        <td>${escapeHtml(tx.date || "")}</td>
        <td>${escapeHtml(tx.description || "")}</td>
        <td><select class="table-select" data-bi-cat="${idx}">${catOpts.replace(`value="${tx.category}"`, `value="${tx.category}" selected`)}</select></td>
        <td class="num ${isInc ? "pos" : "neg"}">${isInc ? "+" : "-"}${formatCurrency(Math.abs(tx.amount), 2)}</td>
      </tr>`;
    }).join("");
    document.getElementById("bi-select-all").checked = true;
    document.getElementById("bank-import-dialog").showModal();
  }

  function applyBankImport() {
    const selected = pendingBankImport.filter((t) => t.selected);
    if (!selected.length) return showNotification("Select at least one row.", "warning");
    const seen = new Set(transactions.map((t) => `${t.date}|${Number(t.amount).toFixed(2)}|${String(t.description).toLowerCase()}`));
    let added = 0;
    for (const tx of selected) {
      const amt = Math.abs(Number(tx.amount) || 0);
      const key = `${tx.date}|${amt.toFixed(2)}|${String(tx.description).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      transactions.unshift({
        id: tx.id || generateSecureId("txn"),
        date: tx.date,
        description: tx.description,
        amount: amt,
        type: tx.type,
        category: tx.category || (tx.type === "income" ? "income" : "other"),
        account: tx.account || "Bank",
        isRecurring: Boolean(tx.isRecurring),
      });
      added++;
    }
    if (document.getElementById("bi-sync-budget").checked) syncBudgetFromTransactions(false);
    persistAll();
    document.getElementById("bank-import-dialog").close("apply");
    pendingBankImport = [];
    renderAll();
    showNotification(`Imported ${added} transaction${added === 1 ? "" : "s"}.`, "success");
  }

  function syncBudgetFromTransactions(notify = true) {
    const expenses = transactions.filter((t) => t.type === "expense");
    if (!expenses.length) { if (notify) showNotification("Import bank transactions first.", "warning"); return; }
    const months = new Set(expenses.map((t) => String(t.date || "").slice(0, 7)).filter(Boolean));
    const div = Math.max(1, months.size);
    const sums = Object.fromEntries(BUDGET_BUCKETS.map((b) => [b.key, 0]));
    for (const tx of expenses) {
      const grp = CATEGORIES[tx.category]?.group || "Other";
      const amt = Math.abs(Number(tx.amount) || 0);
      if (grp === "Housing") sums.mortgage += amt;
      else if (grp === "Food") sums.groceries += amt;
      else if (grp === "Utilities") sums.energy += amt;
      else if (grp === "Transport") sums.publicTransport += amt;
      else if (grp === "Lifestyle") sums.entertainment += amt;
      else sums.subscriptions += amt;
    }
    for (const [k, sum] of Object.entries(sums)) financeState.expenses[k] = Math.round(sum / div);
    persistAll();
    renderAll();
    if (notify) showNotification(`Updated budget from ${div} month(s) of statements.`, "success");
  }

  async function handleInvestmentFiles(fileList) {
    const file = (fileList || [])[0];
    if (!file) return;
    try {
      const res = await window.InvestmentParser.parseInvestmentFile(file);
      if (!res.holdings.length) return showNotification("No investment holdings detected in that CSV.", "warning");
      openInvestmentImportPreview(res, file.name);
    } catch (err) {
      showNotification(`Investment import failed: ${err.message}`, "error");
    }
  }

  function openInvestmentImportPreview(res, fileName) {
    pendingInvImport = res.holdings.map((h) => ({ ...h, selected: true }));
    document.getElementById("inv-import-subtitle").textContent = `Detected ${res.broker} format from ${fileName}`;
    document.getElementById("ii-count").textContent = String(pendingInvImport.length);
    document.getElementById("ii-cost").textContent = formatCurrency(pendingInvImport.reduce((s, h) => s + (Number(h.costBasis) || 0), 0), 2);
    document.getElementById("ii-value").textContent = formatCurrency(pendingInvImport.reduce((s, h) => s + (Number(h.currentValue) || 0), 0), 2);
    document.getElementById("ii-table-body").innerHTML = pendingInvImport.map((h, idx) => `<tr>
      <td><input type="checkbox" data-ii-check="${idx}" checked aria-label="Select ${escapeHtml(h.name)}" /></td>
      <td><strong>${escapeHtml(h.ticker)}</strong><div class="muted-xs">${escapeHtml(h.name)}</div></td>
      <td>${escapeHtml(h.account)}</td>
      <td>${escapeHtml(h.assetClass)}</td>
      <td class="num">${Number(h.quantity) || "—"}</td>
      <td class="num">${formatCurrency(h.costBasis, 2)}</td>
      <td class="num"><strong>${formatCurrency(h.currentValue, 2)}</strong></td>
    </tr>`).join("");
    document.getElementById("ii-select-all").checked = true;
    document.getElementById("ii-replace-existing").checked = false;
    document.getElementById("inv-import-dialog").showModal();
  }

  function applyInvestmentImport() {
    const selected = pendingInvImport.filter((h) => h.selected);
    if (!selected.length) return showNotification("Select at least one holding.", "warning");
    if (document.getElementById("ii-replace-existing").checked) {
      holdings = selected.map(({ selected: _s, ...r }) => r);
    } else {
      for (const incoming of selected) {
        const { selected: _s, ...clean } = incoming;
        const idx = holdings.findIndex((h) => h.ticker?.toUpperCase() === clean.ticker?.toUpperCase() && h.account === clean.account);
        if (idx >= 0) holdings[idx] = { ...holdings[idx], ...clean, id: holdings[idx].id };
        else holdings.push(clean);
      }
    }
    persistAll();
    document.getElementById("inv-import-dialog").close("apply");
    pendingInvImport = [];
    renderAll();
    showNotification(`Imported ${selected.length} holding${selected.length === 1 ? "" : "s"}.`, "success");
  }

  // ============================================================
  // MODALS, VALIDATION & WIRING
  // ============================================================
  function openHoldingModal(holding = null) {
    const form = document.getElementById("holding-form");
    form.reset();
    document.getElementById("holding-dialog-title").textContent = holding ? "Edit Investment Holding" : "Add Investment Holding";
    document.getElementById("h-id").value = holding?.id || "";
    document.getElementById("h-name").value = holding?.name || "";
    document.getElementById("h-ticker").value = holding?.ticker || "";
    document.getElementById("h-account").value = holding?.account || "ISA";
    document.getElementById("h-class").value = holding?.assetClass || "ETF";
    document.getElementById("h-qty").value = holding?.quantity || "";
    document.getElementById("h-cost").value = holding ? holding.costBasis : "";
    document.getElementById("h-value").value = holding ? holding.currentValue : "";
    document.getElementById("holding-dialog").showModal();
  }

  function setupDialogFallbacks() {
    document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => { d.returnValue = ""; }));
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e, d) => {
        const r = d.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let downOut = false;
        dialog.addEventListener("pointerdown", (e) => { downOut = outside(e, dialog); });
        dialog.addEventListener("pointerup", (e) => { if (downOut && outside(e, dialog)) dialog.close(); });
      }
    }
  }

  function setupAccessibleValidation() {
    const linkError = (el, shown) => {
      const errId = el.dataset.error;
      if (!errId) return;
      const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== errId);
      if (shown) ids.push(errId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };
    const syncAria = (el) => {
      if (!el.matches?.("input, select")) return;
      const supports = CSS.supports("selector(:user-invalid)");
      const invalid = supports ? el.matches(":user-invalid") : el.classList.contains("user-invalid-fallback");
      el.setAttribute("aria-invalid", invalid ? "true" : "false");
      linkError(el, invalid);
    };
    document.querySelectorAll("form input, form select").forEach((el) => el.setAttribute("aria-invalid", "false"));
    document.addEventListener("blur", (e) => {
      if (!CSS.supports("selector(:user-invalid)") && e.target.checkValidity) {
        e.target.classList.toggle("user-invalid-fallback", !e.target.validity.valid);
      }
      syncAria(e.target);
    }, true);
    document.addEventListener("input", (e) => {
      if (e.target.hasAttribute("aria-invalid")) {
        if (!CSS.supports("selector(:user-invalid)") && e.target.checkValidity) {
          e.target.classList.toggle("user-invalid-fallback", !e.target.validity.valid);
        }
        syncAria(e.target);
      }
    });
  }

  function init() {
    loadLocalState();
    setupDialogFallbacks();
    setupAccessibleValidation();

    const opts = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join("");
    document.getElementById("tx-cat-filter").innerHTML = `<option value="all">All categories</option>${opts}`;
    document.getElementById("t-category").innerHTML = opts;

    // Topbar & KPI triggers
    const bankInput = document.getElementById("bank-file-input");
    const invInput = document.getElementById("inv-file-input");
    document.getElementById("top-import-bank-btn").addEventListener("click", () => bankInput.click());
    document.getElementById("top-import-inv-btn").addEventListener("click", () => invInput.click());
    document.getElementById("inv-import-btn").addEventListener("click", () => invInput.click());
    document.getElementById("quick-holding-btn").addEventListener("click", () => openHoldingModal());
    document.getElementById("add-holding-btn").addEventListener("click", () => openHoldingModal());
    document.getElementById("reset-demo-btn").addEventListener("click", resetToDemoData);

    const openCashflow = () => { renderCashflowModal(); document.getElementById("cashflow-dialog").showModal(); };
    document.getElementById("open-cashflow-btn").addEventListener("click", openCashflow);
    document.getElementById("kpi-surplus-card").addEventListener("click", openCashflow);
    document.getElementById("kpi-cash-card").addEventListener("click", openCashflow);
    document.getElementById("kpi-surplus-card").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCashflow(); } });
    document.getElementById("kpi-cash-card").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCashflow(); } });
    document.getElementById("cf-done-btn").addEventListener("click", () => document.getElementById("cashflow-dialog").close("done"));

    // Narrow-viewport switcher (prevents vertical scroll stacking on split panes)
    document.getElementById("narrow-switch")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pane]");
      if (!btn) return;
      document.querySelector(".split-workspace")?.setAttribute("data-active-pane", btn.dataset.pane);
      document.querySelectorAll("#narrow-switch [data-pane]").forEach((b) => b.classList.toggle("is-active", b === btn));
    });

    // Pagination buttons
    document.getElementById("tx-prev-btn")?.addEventListener("click", () => { txPage--; renderStatements(); });
    document.getElementById("tx-next-btn")?.addEventListener("click", () => { txPage++; renderStatements(); });
    document.getElementById("inv-prev-btn")?.addEventListener("click", () => { invPage--; renderInvestments(); });
    document.getElementById("inv-next-btn")?.addEventListener("click", () => { invPage++; renderInvestments(); });

    // File inputs & Dropzones (entire panel accepts drag-and-drop)
    bankInput.addEventListener("change", (e) => { if (e.target.files?.length) handleBankFiles(e.target.files); bankInput.value = ""; });
    invInput.addEventListener("change", (e) => { if (e.target.files?.length) handleInvestmentFiles(e.target.files); invInput.value = ""; });
    document.getElementById("bank-upload-inline-btn")?.addEventListener("click", () => bankInput.click());

    const bankZone = document.getElementById("bank-dropzone");
    bankZone.addEventListener("dragover", (e) => { e.preventDefault(); bankZone.classList.add("dragover"); });
    bankZone.addEventListener("dragleave", () => bankZone.classList.remove("dragover"));
    bankZone.addEventListener("drop", (e) => { e.preventDefault(); bankZone.classList.remove("dragover"); if (e.dataTransfer?.files?.length) handleBankFiles(e.dataTransfer.files); });

    const invZone = document.getElementById("inv-dropzone");
    invZone.addEventListener("dragover", (e) => { e.preventDefault(); invZone.classList.add("dragover"); });
    invZone.addEventListener("dragleave", () => invZone.classList.remove("dragover"));
    invZone.addEventListener("drop", (e) => { e.preventDefault(); invZone.classList.remove("dragover"); if (e.dataTransfer?.files?.length) handleInvestmentFiles(e.dataTransfer.files); });

    // Statements controls
    document.getElementById("st-mode-group").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-st-mode]");
      if (!btn) return;
      stMode = btn.dataset.stMode;
      document.querySelectorAll("[data-st-mode]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderStatements();
    });
    document.getElementById("tx-search").addEventListener("input", renderStatements);
    document.getElementById("tx-cat-filter").addEventListener("change", renderStatements);
    document.getElementById("sync-budget-btn").addEventListener("click", () => syncBudgetFromTransactions(true));
    document.getElementById("cf-sync-tx-btn").addEventListener("click", () => syncBudgetFromTransactions(true));

    document.getElementById("sample-bank-btn").addEventListener("click", () => {
      const csv = [
        "Date,Counter Party,Reference,Type,Amount (GBP),Spending Category",
        "21/11/2026,PRET A MANGER,LUNCH,CARD,-11.40,FOOD_AND_DRINK",
        "20/11/2026,SAINSBURYS,GROCERIES,CARD,-74.20,GROCERIES",
        "19/11/2026,TFL TRAVEL,COMMUTE,CARD,-24.60,TRANSPORT",
        "18/11/2026,ADOBE CREATIVE,SUBSCRIPTION,DIRECT DEBIT,-54.98,SUBSCRIPTIONS",
        "17/11/2026,BONUS PAYMENT,PAYROLL,FASTER PAYMENT,1200.00,INCOME",
      ].join("\n");
      handleBankFiles([new File([csv], "starling-sample.csv", { type: "text/csv" })]);
    });

    document.getElementById("tx-table-body").addEventListener("change", (e) => {
      const sel = e.target.closest("[data-tx-cat]");
      if (!sel) return;
      const tx = transactions.find((t) => t.id === sel.dataset.txCat);
      if (!tx) return;
      tx.category = sel.value;
      if (typeof window.normalizeMerchant === "function" && typeof window.loadCustomCategoryMap === "function") {
        const key = window.normalizeMerchant(tx.description);
        if (key) {
          const map = window.loadCustomCategoryMap();
          map[key] = sel.value;
          try { localStorage.setItem("consumerpay_custom_category_map_v1", JSON.stringify(map)); } catch {}
        }
      }
      persistAll();
      renderAll();
      showNotification("Category saved & learned.", "success");
    });

    document.getElementById("tx-table-body").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-del-tx]");
      if (!btn) return;
      transactions = transactions.filter((t) => t.id !== btn.dataset.delTx);
      persistAll();
      renderAll();
    });

    // Manual transaction modal
    document.getElementById("add-tx-btn").addEventListener("click", () => {
      const form = document.getElementById("tx-form");
      form.reset();
      document.getElementById("t-date").value = new Date().toISOString().slice(0, 10);
      document.getElementById("t-category").value = "groceries";
      document.getElementById("tx-dialog").showModal();
    });
    document.getElementById("tx-cancel-btn").addEventListener("click", () => document.getElementById("tx-dialog").close("cancel"));
    document.getElementById("tx-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!e.target.checkValidity()) return e.target.reportValidity();
      transactions.unshift({
        id: generateSecureId("txn"),
        date: document.getElementById("t-date").value,
        description: document.getElementById("t-desc").value.trim(),
        amount: Math.max(0.01, parseFloat(document.getElementById("t-amount").value) || 0),
        type: document.getElementById("t-type").value,
        category: document.getElementById("t-category").value,
        account: document.getElementById("t-account").value,
        isRecurring: false,
      });
      persistAll();
      document.getElementById("tx-dialog").close("save");
      renderAll();
      showNotification("Transaction added.", "success");
    });

    // Bank import preview
    document.getElementById("bi-select-all").addEventListener("change", (e) => {
      pendingBankImport.forEach((t) => (t.selected = e.target.checked));
      document.querySelectorAll("[data-bi-check]").forEach((cb) => (cb.checked = e.target.checked));
    });
    document.getElementById("bi-table-body").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-bi-check]");
      if (cb) pendingBankImport[Number(cb.dataset.biCheck)].selected = cb.checked;
      const sel = e.target.closest("[data-bi-cat]");
      if (sel) pendingBankImport[Number(sel.dataset.biCat)].category = sel.value;
    });
    document.getElementById("bi-cancel-btn").addEventListener("click", () => document.getElementById("bank-import-dialog").close("cancel"));
    document.getElementById("bi-apply-btn").addEventListener("click", applyBankImport);

    // Investments controls
    document.getElementById("inv-search").addEventListener("input", renderInvestments);
    document.getElementById("inv-account-filters").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-inv-filter]");
      if (!btn) return;
      invAccountFilter = btn.dataset.invFilter;
      document.querySelectorAll("[data-inv-filter]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderInvestments();
    });
    document.getElementById("sample-inv-btn").addEventListener("click", () => {
      const csv = [
        "Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Total (GBP)",
        "Market buy,2026-08-01,IE00BK5BQT80,VUAG,Vanguard S&P 500 UCITS ETF,45,82.50,3712.50",
        "Market buy,2026-09-10,US0231351067,AMZN,Amazon.com Inc,18,148.00,2664.00",
        "Market buy,2026-10-05,IE00B4L5Y983,SWDA,iShares Core MSCI World,30,84.20,2526.00",
      ].join("\n");
      const res = window.InvestmentParser.parseInvestmentCSVText(csv, "trading212-isa.csv");
      openInvestmentImportPreview(res, "trading212-isa.csv");
    });

    document.getElementById("inv-table-body").addEventListener("click", (e) => {
      const editBtn = e.target.closest("[data-edit-holding]");
      if (editBtn) {
        const h = holdings.find((item) => item.id === editBtn.dataset.editHolding);
        if (h) openHoldingModal(h);
        return;
      }
      const delBtn = e.target.closest("[data-del-holding]");
      if (delBtn) {
        holdings = holdings.filter((item) => item.id !== delBtn.dataset.delHolding);
        persistAll();
        renderAll();
        showNotification("Holding removed.", "info");
      }
    });

    document.getElementById("holding-cancel-btn").addEventListener("click", () => document.getElementById("holding-dialog").close("cancel"));
    document.getElementById("holding-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!e.target.checkValidity()) return e.target.reportValidity();
      const id = document.getElementById("h-id").value;
      const name = document.getElementById("h-name").value.trim();
      const ticker = document.getElementById("h-ticker").value.trim().toUpperCase() || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase();
      const item = {
        id: id || generateSecureId("inv"),
        name,
        ticker,
        account: document.getElementById("h-account").value,
        assetClass: document.getElementById("h-class").value,
        quantity: Math.max(0, parseFloat(document.getElementById("h-qty").value) || 0),
        costBasis: Math.max(0, parseFloat(document.getElementById("h-cost").value) || 0),
        currentValue: Math.max(0, parseFloat(document.getElementById("h-value").value) || 0),
      };
      const idx = holdings.findIndex((h) => h.id === item.id);
      if (idx >= 0) holdings[idx] = item;
      else holdings.push(item);
      persistAll();
      document.getElementById("holding-dialog").close("save");
      renderAll();
      showNotification(idx >= 0 ? "Holding updated." : "Holding added.", "success");
    });

    document.getElementById("ii-select-all").addEventListener("change", (e) => {
      pendingInvImport.forEach((h) => (h.selected = e.target.checked));
      document.querySelectorAll("[data-ii-check]").forEach((cb) => (cb.checked = e.target.checked));
    });
    document.getElementById("ii-table-body").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-ii-check]");
      if (cb) pendingInvImport[Number(cb.dataset.iiCheck)].selected = cb.checked;
    });
    document.getElementById("ii-cancel-btn").addEventListener("click", () => document.getElementById("inv-import-dialog").close("cancel"));
    document.getElementById("ii-apply-btn").addEventListener("click", applyInvestmentImport);

    // Cashflow modal live inputs (all clamped >= 0)
    document.getElementById("cf-salary").addEventListener("input", (e) => {
      financeState.annualSalary = Math.max(0, parseFloat(e.target.value) || 0);
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("cf-net-override").addEventListener("input", (e) => {
      financeState.income = Math.max(0, parseFloat(e.target.value) || 0);
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("cf-pension").addEventListener("change", (e) => {
      financeState.pensionContrib = e.target.checked;
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("cf-student-loan").addEventListener("change", (e) => {
      financeState.studentLoan = e.target.checked;
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("cf-savings").addEventListener("input", (e) => {
      financeState.savings = Math.max(0, parseFloat(e.target.value) || 0);
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("cf-debt").addEventListener("input", (e) => {
      financeState.liabilities = { otherDebt: Math.max(0, parseFloat(e.target.value) || 0) };
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("cf-budget-grid").addEventListener("input", (e) => {
      const k = e.target.dataset.budgetKey;
      if (!k) return;
      financeState.expenses[k] = Math.max(0, parseFloat(e.target.value) || 0);
      persistAll();
      renderKPIs();
      renderCashflowModal();
    });
    document.getElementById("sim-extra-save").addEventListener("input", renderCashflowModal);

    renderAll();
    hydrateFromNeon();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
