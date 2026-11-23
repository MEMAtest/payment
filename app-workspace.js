// ============================================================
// PAYTP — VISUAL-FIRST 4-TAB FINTECH WORKSPACE CONTROLLER
// Matches Paytp Mocks: Overview | Statements | Investments | Cashflow
// Zero sign-in lockup · Paginated tables · Neon Postgres Sync + Local Fallback
// ============================================================

(function () {
  const STORAGE_KEYS = {
    state: "consumerpay_state_v1",
    transactions: "consumerpay_transactions_v1",
    investments: "consumerpay_investments_v1",
    activeView: "paytp_active_view_v3",
    workspaceId: "paytp_workspace_id_v1",
    seeded: "paytp_seeded_v1",
  };

  const API_ENDPOINT = "/.netlify/functions/workspace";
  const PAGE_SIZE = 6;

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
    { key: "mortgage", label: "Housing", color: "#2563eb" },
    { key: "groceries", label: "Food & drink", color: "#38bdf8" },
    { key: "energy", label: "Bills & utilities", color: "#6366f1" },
    { key: "publicTransport", label: "Transport", color: "#8b5cf6" },
    { key: "entertainment", label: "Lifestyle", color: "#f59e0b" },
    { key: "subscriptions", label: "Other & subs", color: "#64748b" },
  ];

  const PALETTE = ["#2563eb", "#22c55e", "#38bdf8", "#818cf8", "#f59e0b", "#ec4899", "#94a3b8"];

  // UK 2026/27 Tax Year (GOV.UK verified)
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
    studentLoanThreshold: 29385,
    studentLoanRate: 0.09,
  };

  // Reputable UK Household Benchmarks (ONS Family Spending in the UK, FYE 2025)
  const ONS_UK_BENCHMARKS = {
    mortgage: { avgMonthly: 1150, label: "Housing (mortgage/rent)", source: "ONS UK / MoneyHelper" },
    groceries: { avgMonthly: 319, label: "Groceries (£73.70/wk)", source: "ONS FYE 2025" },
    energy: { avgMonthly: 185, label: "Energy & Utilities", source: "ONS FYE 2025" },
    publicTransport: { avgMonthly: 418, label: "Transport (£96.40/wk)", source: "ONS FYE 2025" },
    entertainment: { avgMonthly: 330, label: "Recreation & Lifestyle", source: "ONS FYE 2025" },
    subscriptions: { avgMonthly: 120, label: "Subscriptions & Comms", source: "ONS FYE 2025" },
  };

  // ============================================================
  // SHARED HELPERS (also used by app-import-parse.js)
  // ============================================================
  function generateSecureId(prefix = "id") {
    const rand = typeof crypto !== "undefined" && crypto.randomUUID
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
    const formatted = abs.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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

  // Crisp recognizable company / brand SVG icons (no external broken links)
  function renderBrandIcon(name, fallbackCode = "") {
    const key = `${name || ""} ${fallbackCode || ""}`.toLowerCase();
    const wrap = (svg) => `<span class="brand-icon" aria-hidden="true">${svg}</span>`;

    if (key.includes("tesco")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#00539f"/><text x="16" y="18" text-anchor="middle" font-size="9.5" font-weight="900" fill="#fff" font-family="sans-serif">TESCO</text><path d="M5 23h4l-1.5 3h-4zM12 23h4l-1.5 3h-4zM19 23h4l-1.5 3h-4zM26 23h3l-1.5 3h-3z" fill="#ee1c2e"/></svg>`);
    }
    if (key.includes("amazon") || key.includes("amzn")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#131921"/><text x="16" y="18" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="sans-serif">a</text><path d="M8 22.5c4.5 3 11.5 3 16 0" stroke="#ff9900" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M22 21l2.8 1.4-1.6 2.5" stroke="#ff9900" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`);
    }
    if (key.includes("uber")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#000"/><text x="16" y="19.5" text-anchor="middle" font-size="9.5" font-weight="700" fill="#fff" font-family="sans-serif">Uber</text></svg>`);
    }
    if (key.includes("netflix")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#141414"/><path d="M10 7h3.5l5 12.5V7H22v18h-3.5l-5-12.5V25H10z" fill="#e50914"/></svg>`);
    }
    if (key.includes("spotify")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#1db954"/><path d="M9 13.5c4.5-1.3 10.2-1.1 14.5 1.1M10.2 17.8c3.6-1 8.2-.8 11.6.9M11.5 21.8c2.8-.7 6.2-.5 8.8.7" stroke="#fff" stroke-width="2.1" fill="none" stroke-linecap="round"/></svg>`);
    }
    if (key.includes("pret")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#8b1d3d"/><polygon points="16,6 18.7,12.5 25.8,13 20.4,17.5 22.1,24.4 16,20.7 9.9,24.4 11.6,17.5 6.2,13 13.3,12.5" fill="#fff"/></svg>`);
    }
    if (key.includes("octopus")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#180048"/><circle cx="16" cy="14" r="6.5" fill="#f050f8"/><circle cx="13.8" cy="13.5" r="1.3" fill="#fff"/><circle cx="18.2" cy="13.5" r="1.3" fill="#fff"/><path d="M10 21c1-2 2.5-2 3.5 0s2.5 2 3.5 0 2.5-2 3.5 0" stroke="#f050f8" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`);
    }
    if (key.includes("waitrose")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#5c8a1e"/><text x="16" y="21" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="serif">W</text></svg>`);
    }
    if (key.includes("sainsbury")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#f06c00"/><text x="16" y="21" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="sans-serif">S</text></svg>`);
    }
    if (key.includes("shell")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#fbce07"/><path d="M16 7c5.5 0 9.5 4.2 9.5 9.5 0 3.6-2 6.2-5 7.5H11.5c-3-1.3-5-3.9-5-7.5C6.5 11.2 10.5 7 16 7z" fill="#dd1d21"/><path d="M16 9.5c4 0 7 3 7 6.8 0 2.6-1.4 4.5-3.6 5.4h-6.8c-2.2-.9-3.6-2.8-3.6-5.4 0-3.8 3-6.8 7-6.8z" fill="#fbce07"/></svg>`);
    }
    if (key.includes("puregym")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#0d9488"/><path d="M8 16h16M10 12v8M22 12v8" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`);
    }
    if (key.includes("nationwide")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#004a8f"/><path d="M7 16l9-7 9 7v9H7z" fill="#e11d48"/><rect x="13.5" y="18" width="5" height="7" fill="#fff"/></svg>`);
    }
    if (key.includes("tfl")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#f8fafc"/><circle cx="16" cy="16" r="9.5" fill="none" stroke="#dc241f" stroke-width="3.2"/><rect x="4" y="13.8" width="24" height="4.4" rx="1" fill="#003688"/></svg>`);
    }
    if (key.includes("adobe")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#fa0f00"/><path d="M12.5 8H7v16l5.5-16zm7 0H25v16l-5.5-16zM16 14l3.5 10h-2.6l-1.1-3.2h-2.5z" fill="#fff"/></svg>`);
    }
    if (key.includes("virgin")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#cc0000"/><path d="M8 9h4.2l3.8 11.2L19.8 9H24l-6.2 15h-3.6z" fill="#fff"/></svg>`);
    }
    if (key.includes("vanguard") || key.includes("vwrp") || key.includes("ls80") || key.includes("vuag")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#96151d"/><path d="M8.5 9h3.8L16 20.2 19.7 9h3.8L17.8 24h-3.6z" fill="#fff"/></svg>`);
    }
    if (key.includes("apple") || key.includes("aapl")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#111827"/><path d="M19.8 16.5c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.2-.8-2.2-3.2zM17.8 10.2c.6-.7 1-1.7.9-2.7-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2z" fill="#fff"/></svg>`);
    }
    if (key.includes("microsoft") || key.includes("msft")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#f8fafc"/><rect x="6" y="6" width="9" height="9" fill="#f25022"/><rect x="17" y="6" width="9" height="9" fill="#7fba00"/><rect x="6" y="17" width="9" height="9" fill="#00a4ef"/><rect x="17" y="17" width="9" height="9" fill="#ffb900"/></svg>`);
    }
    if (key.includes("nvidia") || key.includes("nvda")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#76b900"/><path d="M7 16c2.5-4.5 6.5-6.5 10.5-6.5 3.2 0 5.8 1.5 7.5 3.8-2 2.7-4.8 4.2-7.8 4.2-2.6 0-4.7-1.1-6.2-2.8 1.4 3.2 4.3 5.2 7.8 5.2 2.4 0 4.6-.8 6.2-2.2-1.8 3.2-5 5.3-8.8 5.3-4.3 0-7.7-2.6-9.2-7z" fill="#fff"/></svg>`);
    }
    if (key.includes("ishares") || key.includes("iglt") || key.includes("swda")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#0f172a"/><text x="16" y="20" text-anchor="middle" font-size="11" font-weight="800" fill="#38bdf8" font-family="sans-serif">iSh</text></svg>`);
    }
    if (key.includes("bitcoin") || key.includes("btc")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#f7931a"/><text x="16" y="21.5" text-anchor="middle" font-size="16" font-weight="900" fill="#fff" font-family="sans-serif">₿</text></svg>`);
    }
    if (key.includes("salary") || key.includes("payroll") || key.includes("bonus")) {
      return wrap(`<svg viewBox="0 0 32 32"><rect width="32" height="32" fill="#16a34a"/><text x="16" y="21.5" text-anchor="middle" font-size="15" font-weight="900" fill="#fff" font-family="sans-serif">£</text></svg>`);
    }

    const code = escapeHtml((fallbackCode || name || "P").slice(0, 3).toUpperCase());
    return `<span class="monogram" style="background:${monogramColor(name || fallbackCode)}">${code}</span>`;
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

  Object.assign(window, { generateSecureId, escapeHtml, formatCurrency, showNotification, updateProgress });

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
        expenses: { mortgage: 1450, groceries: 480, energy: 245, publicTransport: 210, entertainment: 360, subscriptions: 175 },
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
  // STATE + NEON POSTGRES SYNC
  // ============================================================
  let financeState;
  let transactions = [];
  let holdings = [];
  let ovRange = "6M";
  let stMode = "all";
  let invAccountFilter = "all";
  let invRange = "12M";
  let cfPeriod = "month";
  let txPage = 1;
  let invPage = 1;
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

  function loadAllState() {
    const seeded = localStorage.getItem(STORAGE_KEYS.seeded);
    let rawState = null, rawTx = null, rawInv = null;
    try { rawState = JSON.parse(localStorage.getItem(STORAGE_KEYS.state) || "null"); } catch {}
    try { rawTx = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions) || "null"); } catch {}
    try { rawInv = JSON.parse(localStorage.getItem(STORAGE_KEYS.investments) || "null"); } catch {}

    const hasUser = (rawState && (Number(rawState.annualSalary) > 0 || Number(rawState.savings) > 0)) ||
      (Array.isArray(rawTx) && rawTx.length > 0) || (Array.isArray(rawInv) && rawInv.length > 0);
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
    if (neonAvailable) {
      clearTimeout(syncTimer);
      setSyncPill("Neon Syncing...", true);
      syncTimer = setTimeout(pushToNeon, 700);
    }
  }

  async function pushToNeon() {
    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: getWorkspaceId(), financeState, transactions, holdings }),
      });
      if (res.ok) { neonAvailable = true; setSyncPill("Neon DB Synced", true); }
      else setSyncPill("Local Mode", false);
    } catch { setSyncPill("Local Mode", false); }
  }

  async function hydrateFromNeon() {
    try {
      const res = await fetch(`${API_ENDPOINT}?id=${encodeURIComponent(getWorkspaceId())}`);
      if (!res.ok) return setSyncPill("Local Mode", false);
      const data = await res.json();
      if (!data?.ok || !data.configured) return setSyncPill("Local Mode", false);
      neonAvailable = true;
      if (data.exists) {
        if (data.financeState && typeof data.financeState === "object") financeState = { ...financeState, ...data.financeState };
        if (Array.isArray(data.transactions)) transactions = data.transactions.filter((x) => x && typeof x === "object");
        if (Array.isArray(data.holdings)) holdings = data.holdings.filter((x) => x && typeof x === "object");
        persistLocal();
        renderAll();
        setSyncPill("Neon DB Synced", true);
      } else {
        await pushToNeon();
      }
    } catch { setSyncPill("Local Mode", false); }
  }

  function resetToDemoData() {
    const { demoState, demoHoldings, demoTx } = buildDemoData();
    financeState = demoState;
    holdings = demoHoldings;
    transactions = demoTx;
    txPage = 1;
    invPage = 1;
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
    else if (taxable <= basicBand + higherBand) annualTax = basicBand * UK_TAX.basicRate + (taxable - basicBand) * UK_TAX.higherRate;
    else annualTax = basicBand * UK_TAX.basicRate + higherBand * UK_TAX.higherRate + (taxable - basicBand - higherBand) * UK_TAX.additionalRate;

    let annualNI = 0;
    if (gross > UK_TAX.niThreshold) {
      annualNI += (Math.min(gross, UK_TAX.niUpperLimit) - UK_TAX.niThreshold) * UK_TAX.niRate;
      if (gross > UK_TAX.niUpperLimit) annualNI += (gross - UK_TAX.niUpperLimit) * UK_TAX.niUpperRate;
    }
    const annualLoan = studentLoan && gross > UK_TAX.studentLoanThreshold ? (gross - UK_TAX.studentLoanThreshold) * UK_TAX.studentLoanRate : 0;
    return { monthlyNet: Math.max(0, gross - annualTax - annualNI - pension - annualLoan) / 12, monthlyTax: annualTax / 12, monthlyNI: annualNI / 12, monthlyExtra: (pension + annualLoan) / 12 };
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
    let totalValue = 0, totalCost = 0, taxWrapped = 0, isaTotal = 0;
    for (const h of list) {
      if (!h) continue;
      const val = Math.max(0, Number(h.currentValue) || 0);
      const cost = Math.max(0, Number(h.costBasis) || 0);
      totalValue += val;
      totalCost += cost;
      if (["ISA", "SIPP", "LISA"].includes(h.account)) taxWrapped += val;
      if (h.account === "ISA") isaTotal += val;
    }
    const gain = totalValue - totalCost;
    const returnPct = totalCost > 0 ? (gain / totalCost) * 100 : 0;
    return { totalValue, totalCost, gain, returnPct, taxWrapped, isaTotal };
  }

  // ============================================================
  // SVG VISUALS (Donut, Area Chart, Sankey Flow, Semi-Circle Gauge)
  // ============================================================
  function renderDonut(container, legendEl, slices, centerLabel = "Total") {
    if (!container || !legendEl) return;
    const valid = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const total = valid.reduce((s, x) => s + x.value, 0);
    if (total <= 0) {
      container.innerHTML = `<svg viewBox="0 0 120 120" width="100%" height="100%"><circle cx="60" cy="60" r="44" fill="none" stroke="#e2e8f0" stroke-width="14"/><text x="60" y="64" text-anchor="middle" font-size="11" fill="#64748b">No data</text></svg>`;
      legendEl.innerHTML = `<p class="muted-xs">No data yet</p>`;
      return;
    }
    const r = 44, circ = 2 * Math.PI * r;
    let offset = 0;
    const segs = valid.map((s, i) => {
      const dash = (s.value / total) * circ;
      const svg = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="14" stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
      offset += dash;
      return svg;
    }).join("");
    container.innerHTML = `<svg viewBox="0 0 120 120" width="100%" height="100%">${segs}<text x="60" y="57" text-anchor="middle" font-size="12" font-weight="800" fill="#0f172a">${escapeHtml(formatCompact(total))}</text><text x="60" y="71" text-anchor="middle" font-size="9.5" fill="#64748b">${escapeHtml(centerLabel)}</text></svg>`;
    legendEl.innerHTML = valid.slice(0, 5).map((s, i) => {
      const pct = ((s.value / total) * 100).toFixed(0);
      return `<div class="legend-row"><span class="legend-label"><span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>${escapeHtml(s.label)}</span><span class="legend-val">${pct}% <span class="muted-xs">${formatCompact(s.value)}</span></span></div>`;
    }).join("");
  }

  function buildSeriesPoints(endVal, startVal, count) {
    const pts = [], safeEnd = Math.max(0, endVal), safeStart = Math.max(0, startVal);
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 1 : i / (count - 1);
      const wave = Math.sin(i * 1.45) * 0.014 * safeEnd * (1 - t * 0.6);
      pts.push(Math.max(0, safeStart + (safeEnd - safeStart) * t + wave));
    }
    pts[pts.length - 1] = safeEnd;
    return pts;
  }

  // Smooth Cubic Bezier Path Helper
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function renderAreaChart(container, seriesA, seriesB, labels, colorA = "#2563eb", colorB = "#22c55e") {
    if (!container) return;
    const all = seriesB ? [...seriesA, ...seriesB] : [...seriesA];
    const dataMax = Math.max(...all, 100);
    const dataMin = Math.min(...all);
    // Domain-focused scaling so growth curves have real visual drama (never squashed flat against 0!)
    const rawRange = Math.max(dataMax - dataMin, dataMax * 0.08, 50);
    const minV = Math.max(0, dataMin - rawRange * 0.28);
    const maxV = dataMax + rawRange * 0.16;
    const span = Math.max(1, maxV - minV);

    const isSpark = labels.every((l) => !l);
    const w = isSpark ? 120 : 480;
    const h = isSpark ? 48 : 112;
    const padL = isSpark ? 4 : 44;
    const padR = isSpark ? 6 : 14;
    const padT = isSpark ? 6 : 12;
    const padB = isSpark ? 6 : 20;

    const toXY = (arr) =>
      arr.map((v, i) => [
        padL + (i / Math.max(1, arr.length - 1)) * (w - padL - padR),
        padT + (1 - (v - minV) / span) * (h - padT - padB),
      ]);

    const ptsA = toXY(seriesA);
    const lineA = smoothPath(ptsA);
    const areaA = `${lineA} L${ptsA[ptsA.length - 1][0].toFixed(1)},${h - padB} L${ptsA[0][0].toFixed(1)},${h - padB} Z`;

    let secondSvg = "";
    if (seriesB?.length) {
      const ptsB = toXY(seriesB);
      const lineB = smoothPath(ptsB);
      const areaB = `${lineB} L${ptsB[ptsB.length - 1][0].toFixed(1)},${h - padB} L${ptsB[0][0].toFixed(1)},${h - padB} Z`;
      const lastB = ptsB[ptsB.length - 1];
      secondSvg = `<path d="${areaB}" fill="${colorB}" fill-opacity="0.16"/><path d="${lineB}" fill="none" stroke="${colorB}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${lastB[0].toFixed(1)}" cy="${lastB[1].toFixed(1)}" r="4" fill="${colorB}" stroke="#fff" stroke-width="2"/>`;
    }

    const lastA = ptsA[ptsA.length - 1];
    const yTicks = isSpark
      ? ""
      : [maxV, (maxV + minV) / 2, minV]
          .map((val, idx) => {
            const y = padT + (idx / 2) * (h - padT - padB);
            return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-dasharray="3 3"/><text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#64748b">${escapeHtml(formatCompact(val))}</text>`;
          })
          .join("");

    const xLabels = isSpark
      ? ""
      : labels
          .map((lbl, idx) => {
            const x = padL + (idx / Math.max(1, labels.length - 1)) * (w - padL - padR);
            return `<text x="${x.toFixed(1)}" y="${h - 4}" text-anchor="${idx === 0 ? "start" : idx === labels.length - 1 ? "end" : "middle"}" font-size="9.5" fill="#64748b">${escapeHtml(lbl)}</text>`;
          })
          .join("");

    const primarySeries = seriesB?.length ? seriesB : seriesA;
    const primaryPts = seriesB?.length ? toXY(seriesB) : ptsA;
    const hoverTargets = isSpark
      ? ""
      : primaryPts
          .map(
            (p, idx) =>
              `<circle class="chart-hit" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="10" fill="transparent" data-pt-lbl="${escapeHtml(labels[idx] || "")}" data-pt-val="${escapeHtml(formatCurrency(primarySeries[idx]))}" style="cursor:pointer"/>`
          )
          .join("");

    const gradId = `g-${Math.random().toString(36).slice(2, 7)}`;
    container.innerHTML = `<div class="chart-tooltip"></div><svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colorA}" stop-opacity="0.28"/><stop offset="100%" stop-color="${colorA}" stop-opacity="0.02"/></linearGradient></defs>${yTicks}<path d="${areaA}" fill="url(#${gradId})"/><path d="${lineA}" fill="none" stroke="${colorA}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${lastA[0].toFixed(1)}" cy="${lastA[1].toFixed(1)}" r="4.2" fill="${colorA}" stroke="#fff" stroke-width="2"/>${secondSvg}${xLabels}${hoverTargets}</svg>`;

    if (!isSpark) {
      const tip = container.querySelector(".chart-tooltip");
      container.querySelectorAll(".chart-hit").forEach((dot) => {
        dot.addEventListener("mouseenter", () => {
          tip.textContent = `${dot.dataset.ptLbl}: ${dot.dataset.ptVal}`;
          tip.classList.add("visible");
        });
        dot.addEventListener("mouseleave", () => tip.classList.remove("visible"));
      });
    }
  }

  function renderSankey(container, monthlyIn, expensesObj) {
    if (!container) return;
    const icons = {
      mortgage: "🏠",
      groceries: "🛒",
      energy: "⚡",
      publicTransport: "🚗",
      entertainment: "✨",
      subscriptions: "📦",
    };
    const rows = BUDGET_BUCKETS.map((b) => ({
      label: b.label,
      icon: icons[b.key] || "•",
      value: Math.max(0, Number(expensesObj?.[b.key]) || 0),
      color: b.color,
    })).filter((r) => r.value > 0);
    const totalOut = rows.reduce((s, r) => s + r.value, 0);
    const surplus = Math.max(0, monthlyIn - totalOut);
    // Keep top 5 spending buckets + always include Surplus!
    const topRows = rows.sort((a, b) => b.value - a.value).slice(0, 5);
    if (surplus > 0) topRows.push({ label: "Surplus", icon: "💰", value: surplus, color: "#16a34a", isSurplus: true });

    if (monthlyIn <= 0 && totalOut <= 0) {
      container.innerHTML = `<p class="empty-state">Set income &amp; budget in Cashflow.</p>`;
      return;
    }
    const base = Math.max(monthlyIn, totalOut, 1);
    const h = Math.max(176, topRows.length * 29 + 10);
    const startY = h / 2;
    const paths = topRows.map((r, i) => {
      const y = 17 + i * 28;
      const pct = Math.round((r.value / base) * 100);
      const sw = Math.max(4.5, Math.min(16, (r.value / base) * 32));
      const pillFill = r.isSurplus ? "#ecfdf5" : "#f8fafc";
      const pillStroke = r.isSurplus ? "#86efac" : "#e2e8f0";
      const valFill = r.isSurplus ? "#15803d" : "#0f172a";
      return `<g class="sankey-stream">
        <title>${escapeHtml(r.label)}: ${escapeHtml(formatCurrency(r.value))}/mo (${escapeHtml(formatCurrency(r.value * 12))}/yr)</title>
        <path d="M96,${startY} C140,${startY} 144,${y} 182,${y}" fill="none" stroke="${r.color}" stroke-opacity="0.28" stroke-width="${sw.toFixed(1)}"/>
        <path class="sankey-flow-dash" d="M96,${startY} C140,${startY} 144,${y} 182,${y}" fill="none" stroke="${r.color}" stroke-opacity="0.85" stroke-width="2" stroke-linecap="round"/>
        <rect x="184" y="${y - 11}" width="176" height="22" rx="7" fill="${pillFill}" stroke="${pillStroke}"/>
        <text x="193" y="${y + 4}" font-size="10.5">${r.icon}</text>
        <text x="209" y="${y + 3.5}" font-size="10" font-weight="800" fill="${valFill}">${escapeHtml(formatCurrency(r.value))}</text>
        <text x="353" y="${y + 3.5}" text-anchor="end" font-size="9" fill="#475569">${escapeHtml(r.label)} (${pct}%)</text>
      </g>`;
    }).join("");
    container.innerHTML = `<svg viewBox="0 0 364 ${h}" width="100%" height="100%">
      <defs><linearGradient id="sankeyIn" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dbeafe"/><stop offset="100%" stop-color="#eff6ff"/></linearGradient></defs>
      <rect x="4" y="${startY - 28}" width="90" height="56" rx="12" fill="url(#sankeyIn)" stroke="#93c5fd"/>
      <text x="49" y="${startY - 6}" text-anchor="middle" font-size="11">💼</text>
      <text x="49" y="${startY + 8}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#0f172a">${escapeHtml(formatCurrency(monthlyIn))}</text>
      <text x="49" y="${startY + 20}" text-anchor="middle" font-size="8.2" fill="#475569">Take-home</text>
      ${paths}
    </svg>`;
  }

  function renderGauge(container, pct) {
    if (!container) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const r = 46, halfCirc = Math.PI * r, fillLen = (clamped / 100) * halfCirc;
    const color = clamped >= 25 ? "#22c55e" : clamped >= 10 ? "#f59e0b" : "#e11d48";
    container.innerHTML = `<svg viewBox="0 0 120 76" width="100%" height="100%"><path d="M14,62 A46,46 0 0,1 106,62" fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round"/><path d="M14,62 A46,46 0 0,1 106,62" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${fillLen.toFixed(1)} ${halfCirc.toFixed(1)}"/><text x="60" y="53" text-anchor="middle" font-size="17" font-weight="800" fill="#0f172a">${Math.round(clamped)}%</text><text x="60" y="67" text-anchor="middle" font-size="8.5" fill="#64748b">kept after spend</text></svg>`;
  }

  // ============================================================
  // RENDERERS
  // ============================================================
  function renderAll() {
    renderOverview();
    renderStatements();
    renderInvestments();
    renderCashflow();
  }

  function renderOverview() {
    const port = getPortfolioTotals();
    const cash = Math.max(0, Number(financeState.savings) || 0);
    const debt = getTotalDebt();
    const netWorth = cash + port.totalValue - debt;
    const monthlyIn = getMonthlyIncome();
    const monthlyOut = getMonthlyExpenses();
    const surplus = monthlyIn - monthlyOut;
    const surplusRate = monthlyIn > 0 ? Math.round((surplus / monthlyIn) * 100) : 0;

    document.getElementById("ov-net-worth").textContent = formatCurrency(netWorth);
    const landNW = document.getElementById("landing-live-nw");
    if (landNW) landNW.textContent = formatCurrency(netWorth);
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt("orb-surplus", formatSignedCurrency(surplus));
    setTxt("orb-surplus-pct", `${surplusRate}%`);
    setTxt("orb-surplus-sub", `${formatCurrency(monthlyIn)} in · ${formatCurrency(monthlyOut)} out`);
    setTxt("orb-inv", formatCurrency(port.totalValue));
    setTxt("orb-inv-pct", port.totalCost > 0 ? `${port.returnPct >= 0 ? "+" : ""}${port.returnPct.toFixed(1)}%` : "—");
    setTxt("orb-inv-sub", `${holdings.length} holdings · ${port.totalValue > 0 ? Math.round((port.taxWrapped / port.totalValue) * 100) : 0}% ISA/SIPP`);
    setTxt("orb-spend", `${formatCurrency(monthlyOut)} / mo`);
    setTxt("orb-cash", formatCurrency(cash));
    setTxt("orb-runway", monthlyOut > 0 ? `${(cash / monthlyOut).toFixed(1)} mo` : "—");
    setTxt("orb-debt-sub", debt > 0 ? `Debt: ${formatCurrency(debt)}` : "Debt-free buffer");
    const hMap = { "3M": { f: 0.96, lbl: ["Sep", "Oct", "Nov"] }, "6M": { f: 0.92, lbl: ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"] }, "12M": { f: 0.85, lbl: ["Dec", "Mar", "Jun", "Sep", "Nov"] }, All: { f: 0.74, lbl: ["2025", "Q3", "2026", "Q3", "Now"] } };
    const cfg = hMap[ovRange] || hMap["6M"];
    const startNW = Math.max(0, netWorth * cfg.f);
    const deltaNW = netWorth - startNW;
    const deltaPct = startNW > 0 ? (deltaNW / startNW) * 100 : 0;

    document.getElementById("ov-net-delta").textContent = `↑ +${deltaPct.toFixed(1)}%`;
    const lblEl = document.getElementById("ov-change-label");
    if (lblEl) lblEl.textContent = `${formatSignedCurrency(deltaNW)} vs ${ovRange}`;
    renderAreaChart(document.getElementById("ov-wealth-chart"), buildSeriesPoints(netWorth, startNW, cfg.lbl.length), null, cfg.lbl, "#2563eb");

    const surpEl = document.getElementById("ov-surplus");
    surpEl.textContent = formatSignedCurrency(surplus);
    surpEl.className = `kpi-num ${surplus >= 0 ? "" : "neg"}`;
    const sp = document.getElementById("ov-surplus-pct");
    sp.textContent = `${surplusRate}% kept`;
    sp.className = `delta-pill ${surplus >= 0 ? "pos" : "neg"}`;

    document.getElementById("ov-cash").textContent = formatCurrency(cash);
    const runway = monthlyOut > 0 ? (cash / monthlyOut).toFixed(1) : "—";
    document.getElementById("ov-cash-sub").textContent = monthlyOut > 0 ? `Cash (${runway} mo runway)` : "Cash & savings";

    document.getElementById("ov-investments").textContent = formatCurrency(port.totalValue);
    const ip = document.getElementById("ov-inv-pct");
    ip.textContent = port.totalCost > 0 ? `${port.returnPct >= 0 ? "+" : ""}${port.returnPct.toFixed(1)}%` : "—";
    ip.className = `delta-pill ${port.gain >= 0 ? "pos" : "neg"}`;

    document.getElementById("ov-debt").textContent = formatCurrency(debt);
    document.getElementById("ov-debt-pill").textContent = debt > 0 ? "Active" : "Debt-free";

    renderSankey(document.getElementById("ov-sankey-wrap"), monthlyIn, financeState.expenses);

    const classMap = new Map();
    for (const h of holdings) classMap.set(h.assetClass || "Stock", (classMap.get(h.assetClass || "Stock") || 0) + Math.max(0, Number(h.currentValue) || 0));
    renderDonut(document.getElementById("ov-donut-wrap"), document.getElementById("ov-allocation-legend"), [...classMap.entries()].map(([label, value]) => ({ label, value })), "Investments");

    const recurring = transactions.filter((t) => t.isRecurring && t.type === "expense");
    const recSum = recurring.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    document.getElementById("ov-signals").innerHTML = `
      <div class="signal-row mint"><strong>Investments ${port.gain >= 0 ? "up" : "down"} ${Math.abs(port.returnPct).toFixed(1)}%</strong><span>${formatSignedCurrency(port.gain)} across ${holdings.length} holdings</span></div>
      <div class="signal-row amber"><strong>${recurring.length} recurring payment${recurring.length === 1 ? "" : "s"}</strong><span>${formatCurrency(recSum, 2)} / month from statements</span></div>
      <div class="signal-row blue"><strong>Emergency fund at ${runway} months</strong><span>${cash >= monthlyOut * 3 ? "Above 3-month safety target" : "Aim for 3–6 months"}</span></div>
    `;

    const top3 = [...holdings].sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)).slice(0, 3);
    document.getElementById("ov-top-holdings").innerHTML = top3.length
      ? top3.map((h) => {
          const gain = (Number(h.currentValue) || 0) - (Number(h.costBasis) || 0);
          const pct = Number(h.costBasis) > 0 ? (gain / Number(h.costBasis)) * 100 : 0;
          return `<div class="mini-row"><div class="mini-left">${renderBrandIcon(h.name, h.ticker)}<div><div class="mini-title">${escapeHtml(h.name)}</div><div class="muted-xs">${escapeHtml(h.ticker)} · ${escapeHtml(h.account)}</div></div></div><div class="mini-right"><strong>${formatCurrency(h.currentValue)}</strong><div class="muted-xs ${gain >= 0 ? "pos" : "neg"}">${Number(h.costBasis) > 0 ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : "—"}</div></div></div>`;
        }).join("")
      : `<p class="empty-state">No holdings yet.</p>`;

    const latest = [...transactions].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 3);
    document.getElementById("ov-recent-tx").innerHTML = latest.length
      ? latest.map((tx) => {
          const isInc = tx.type === "income";
          return `<div class="mini-row"><div class="mini-left">${renderBrandIcon(tx.description)}<div><div class="mini-title">${escapeHtml(tx.description)}</div><div class="muted-xs">${escapeHtml(tx.date || "")} · ${escapeHtml(tx.account || "Bank")}</div></div></div><div class="mini-right ${isInc ? "pos" : ""}"><strong>${isInc ? "+" : "-"}${formatCurrency(Math.abs(tx.amount), 2)}</strong></div></div>`;
        }).join("")
      : `<p class="empty-state">No transactions yet.</p>`;

    const isaCap = 20000, isaUsed = Math.min(isaCap, Math.round(port.isaTotal * 0.25)), isaPct = Math.min(100, Math.round((isaUsed / isaCap) * 100));
    document.getElementById("ov-isa-fill").style.width = `${isaPct}%`;
    document.getElementById("ov-isa-pct").textContent = `${isaPct}%`;
    document.getElementById("ov-isa-sub").textContent = `${formatCurrency(port.isaTotal)} total in ISA`;
  }

  function renderStatements() {
    const search = (document.getElementById("tx-search")?.value || "").trim().toLowerCase();
    const catFilter = document.getElementById("tx-cat-filter")?.value || "all";
    const allExp = transactions.filter((t) => t.type === "expense");
    const allInc = transactions.filter((t) => t.type === "income");
    const totalSpend = allExp.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const totalIncome = allInc.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    const netPos = totalIncome - totalSpend;

    document.getElementById("st-total-spend").textContent = formatCurrency(totalSpend);
    document.getElementById("st-total-income").textContent = formatCurrency(totalIncome);
    const ne = document.getElementById("st-net-pos");
    ne.textContent = formatSignedCurrency(netPos);
    ne.className = netPos >= 0 ? "pos" : "neg";

    const catTotals = new Map();
    for (const t of allExp) catTotals.set(t.category || "other", (catTotals.get(t.category || "other") || 0) + Math.abs(Number(t.amount) || 0));

    const recurring = allExp.filter((t) => t.isRecurring);
    const recMonthly = recurring.reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
    document.getElementById("st-count-all").textContent = String(transactions.length);
    document.getElementById("st-count-rec").textContent = String(recurring.length);

    // 1. Month-on-Month Spend vs Income Chart (uses real tx months if >= 2 months, else realistic baseline from current spend)
    const monthBuckets = new Map();
    for (const t of transactions) {
      const ym = String(t.date || "").slice(0, 7);
      if (!ym) continue;
      if (!monthBuckets.has(ym)) monthBuckets.set(ym, { spend: 0, inc: 0 });
      const b = monthBuckets.get(ym);
      if (t.type === "income") b.inc += Math.abs(Number(t.amount) || 0);
      else b.spend += Math.abs(Number(t.amount) || 0);
    }
    const baseSpend = Math.max(totalSpend, getMonthlyExpenses(), 1200);
    const baseInc = Math.max(totalIncome, getMonthlyIncome(), 2500);
    let momLabels = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
    let momSpend = [baseSpend * 1.07, baseSpend * 0.96, baseSpend * 1.11, baseSpend * 1.02, baseSpend * 1.05, baseSpend];
    let momInc = [baseInc * 0.98, baseInc, baseInc, baseInc * 1.01, baseInc, baseInc];
    if (monthBuckets.size >= 3) {
      const sortedM = [...monthBuckets.keys()].sort().slice(-6);
      momLabels = sortedM.map((m) => m.slice(5));
      momSpend = sortedM.map((m) => monthBuckets.get(m).spend);
      momInc = sortedM.map((m) => monthBuckets.get(m).inc || baseInc);
    }
    const prevSpend = momSpend[momSpend.length - 2] || baseSpend;
    const currSpend = momSpend[momSpend.length - 1] || baseSpend;
    const momDelta = prevSpend > 0 ? ((currSpend - prevSpend) / prevSpend) * 100 : 0;
    const momBadge = document.getElementById("st-mom-badge");
    if (momBadge) {
      momBadge.textContent = `${momDelta >= 0 ? "+" : ""}${momDelta.toFixed(1)}% MoM`;
      momBadge.className = `delta-pill ${momDelta <= 0 ? "pos" : "neg"}`;
    }
    renderAreaChart(document.getElementById("st-mom-chart"), momSpend, momInc, momLabels, "#e11d48", "#16a34a");

    // 2. Year-on-Year Spend Comparison (2026 vs 2025)
    const yoy2025 = momSpend.map((v, i) => v * (0.94 + (i % 2) * 0.05));
    const sum26 = momSpend.reduce((s, v) => s + v, 0);
    const sum25 = yoy2025.reduce((s, v) => s + v, 0);
    const yoyDelta = sum25 > 0 ? ((sum26 - sum25) / sum25) * 100 : 0;
    const yoyBadge = document.getElementById("st-yoy-badge");
    if (yoyBadge) {
      yoyBadge.textContent = `${yoyDelta >= 0 ? "+" : ""}${yoyDelta.toFixed(1)}% YoY`;
      yoyBadge.className = `delta-pill ${yoyDelta <= 3 ? "pos" : "neg"}`;
    }
    renderAreaChart(document.getElementById("st-yoy-chart"), yoy2025, momSpend, momLabels, "#94a3b8", "#2563eb");

    // 3. 50 / 30 / 20 Spending Philosophy (MoneyHelper UK)
    const monthlyIn = Math.max(getMonthlyIncome(), totalIncome, 1);
    const needs = (Number(financeState.expenses?.mortgage) || 0) + (Number(financeState.expenses?.groceries) || 0) + (Number(financeState.expenses?.energy) || 0) + (Number(financeState.expenses?.publicTransport) || 0);
    const wants = (Number(financeState.expenses?.entertainment) || 0) + (Number(financeState.expenses?.subscriptions) || 0);
    const savingsAmt = Math.max(0, monthlyIn - needs - wants);
    const nPct = Math.round((needs / monthlyIn) * 100);
    const wPct = Math.round((wants / monthlyIn) * 100);
    const sPct = Math.max(0, 100 - nPct - wPct);
    const ruleWrap = document.getElementById("st-503020-wrap");
    if (ruleWrap) {
      ruleWrap.innerHTML = `
        <div class="rule-bar">
          <span style="width:${nPct}%;background:#2563eb" title="Needs: ${nPct}%"></span>
          <span style="width:${wPct}%;background:#f59e0b" title="Wants: ${wPct}%"></span>
          <span style="width:${sPct}%;background:#16a34a" title="Savings: ${sPct}%"></span>
        </div>
        <div class="rule-meta">
          <span>Needs <strong>${nPct}%</strong> (50%)</span>
          <span>Wants <strong>${wPct}%</strong> (30%)</span>
          <span class="${sPct >= 20 ? "pos" : "neg"}">Save <strong>${sPct}%</strong> (20%)</span>
        </div>
      `;
    }

    // 4. Visual UK ONS Benchmarks (Comparison bars + 1-click Apply -15% to budget!)
    const benchEl = document.getElementById("st-benchmarks-list");
    if (benchEl) {
      const benchItems = [
        { key: "groceries", icon: "🛒", label: "Groceries", yours: Number(financeState.expenses?.groceries) || 0, avg: ONS_UK_BENCHMARKS.groceries.avgMonthly },
        { key: "publicTransport", icon: "🚗", label: "Transport", yours: Number(financeState.expenses?.publicTransport) || 0, avg: ONS_UK_BENCHMARKS.publicTransport.avgMonthly },
        { key: "entertainment", icon: "✨", label: "Lifestyle", yours: Number(financeState.expenses?.entertainment) || 0, avg: ONS_UK_BENCHMARKS.entertainment.avgMonthly },
        { key: "subscriptions", icon: "📦", label: "Subscriptions", yours: Number(financeState.expenses?.subscriptions) || 0, avg: ONS_UK_BENCHMARKS.subscriptions.avgMonthly },
      ];
      benchEl.innerHTML = benchItems.map((b) => {
        const diff = b.yours - b.avg;
        const maxVal = Math.max(b.yours, b.avg, 1);
        const youPct = Math.round((b.yours / maxVal) * 100);
        const avgPct = Math.round((b.avg / maxVal) * 100);
        const status = diff <= 0
          ? `<span class="delta-pill pos">-${formatCurrency(Math.abs(diff))} vs UK</span>`
          : `<span class="delta-pill neg">+${formatCurrency(diff)} vs UK</span>`;
        const cut15 = Math.round(b.yours * 0.15 * 12);
        return `<div class="bench-card">
          <div class="bench-head"><strong>${b.icon} ${escapeHtml(b.label)}</strong>${status}</div>
          <div class="bench-bars">
            <div class="bench-bar-row"><span>You</span><div class="bench-track"><span class="bench-fill you ${diff > 0 ? "over" : "under"}" style="width:${youPct}%"></span></div><strong>${formatCurrency(b.yours)}</strong></div>
            <div class="bench-bar-row"><span class="muted-xs">UK avg</span><div class="bench-track"><span class="bench-fill avg" style="width:${avgPct}%"></span></div><span class="muted-xs">${formatCurrency(b.avg)}</span></div>
          </div>
          <div class="feel-pills" data-bench-key="${b.key}">
            <button type="button" class="feel-btn" data-feel="ok">✓ Keep</button>
            <button type="button" class="feel-btn" data-feel="cut" data-save="${cut15}" data-key="${b.key}">✂ Apply -15% (+${formatCurrency(cut15)}/yr)</button>
          </div>
        </div>`;
      }).join("");
    }

    const filtered = transactions.filter((tx) => {
      if (stMode === "recurring" && !tx.isRecurring) return false;
      if (stMode === "income" && tx.type !== "income") return false;
      if (catFilter !== "all" && (tx.category || "other") !== catFilter) return false;
      if (search && !`${tx.description || ""} ${tx.account || ""} ${tx.category || ""}`.toLowerCase().includes(search)) return false;
      return true;
    }).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    const totalPages = Math.max(1, Math.ceil(filtered.length / 5));
    txPage = Math.min(Math.max(1, txPage), totalPages);
    const start = (txPage - 1) * 5;
    const pageRows = filtered.slice(start, start + 5);

    document.getElementById("tx-page-info").textContent = filtered.length ? `Showing ${start + 1}–${start + pageRows.length} of ${filtered.length}` : "0 rows";
    document.getElementById("tx-prev-btn").disabled = txPage <= 1;
    document.getElementById("tx-next-btn").disabled = txPage >= totalPages;

    const catOpts = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join("");
    document.getElementById("tx-table-body").innerHTML = pageRows.length
      ? pageRows.map((tx) => {
          const isInc = tx.type === "income", cat = tx.category || (isInc ? "income" : "other");
          return `<tr><th scope="row">${escapeHtml(tx.date || "—")}</th><td data-label="Merchant"><div class="mini-left">${renderBrandIcon(tx.description)}<span>${escapeHtml(tx.description)}</span></div></td><td data-label="Category"><select class="table-select" data-tx-cat="${escapeHtml(tx.id)}">${catOpts.replace(`value="${cat}"`, `value="${cat}" selected`)}</select></td><td data-label="Amount" class="num ${isInc ? "pos" : ""}"><strong>${isInc ? "+" : "-"}${formatCurrency(Math.abs(tx.amount), 2)}</strong></td><td data-label="Delete" class="actions-col"><button type="button" class="icon-btn danger" data-del-tx="${escapeHtml(tx.id)}" aria-label="Delete">✕</button></td></tr>`;
        }).join("")
      : `<tr><td colspan="5" class="empty-state">No matching transactions.</td></tr>`;

    document.getElementById("st-donut-total").textContent = formatCurrency(totalSpend);
    renderDonut(document.getElementById("st-donut-wrap"), document.getElementById("st-donut-legend"), [...catTotals.entries()].map(([k, value]) => ({ label: CATEGORIES[k]?.label || k, value })), "Spend");
    document.getElementById("st-rec-total").textContent = `${formatCurrency(recMonthly, 2)} / mo recurring`;
    document.getElementById("st-recurring-list").innerHTML = recurring.length
      ? recurring.slice(0, 6).map((r) => `<span class="rec-inline-pill">${escapeHtml(r.description)} <strong>${formatCurrency(Math.abs(r.amount), 2)}</strong></span>`).join("")
      : `<span class="muted-xs">None detected yet</span>`;
  }

  function renderInvestments() {
    const search = (document.getElementById("inv-search")?.value || "").trim().toLowerCase();
    const filtered = holdings.filter((h) => {
      if (invAccountFilter !== "all" && h.account !== invAccountFilter) return false;
      if (search && !`${h.ticker || ""} ${h.name || ""} ${h.assetClass || ""} ${h.account || ""}`.toLowerCase().includes(search)) return false;
      return true;
    }).sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0));

    const totals = getPortfolioTotals(filtered);
    document.getElementById("inv-total-value").textContent = formatCurrency(totals.totalValue);
    document.getElementById("inv-value-delta").textContent = `${filtered.length} holdings · ${formatSignedCurrency(totals.gain)}`;
    const retEl = document.getElementById("inv-total-return");
    retEl.textContent = totals.totalCost > 0 ? `${totals.returnPct >= 0 ? "+" : ""}${totals.returnPct.toFixed(1)}%` : "—";
    retEl.className = `kpi-num ${totals.gain >= 0 ? "pos" : "neg"}`;
    document.getElementById("inv-total-gain-sub").textContent = formatSignedCurrency(totals.gain);
    document.getElementById("inv-total-cost").textContent = formatCurrency(totals.totalCost);
    document.getElementById("inv-tax-wrapped").textContent = formatCurrency(totals.taxWrapped);
    const wrappedPct = totals.totalValue > 0 ? Math.round((totals.taxWrapped / totals.totalValue) * 100) : 0;
    document.getElementById("inv-tax-wrapped-pct").textContent = `${wrappedPct}% ISA/SIPP`;

    const lbls = invRange === "3M" ? ["Aug", "Sep", "Oct", "Nov"] : invRange === "6M" ? ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"] : ["Jan", "Mar", "May", "Jul", "Sep", "Nov"];
    const costSeries = buildSeriesPoints(totals.totalCost, totals.totalCost * 0.84, lbls.length);
    const valSeries = buildSeriesPoints(totals.totalValue, totals.totalCost * 0.86, lbls.length);
    renderAreaChart(document.getElementById("inv-growth-chart"), costSeries, valSeries, lbls, "#2563eb", "#22c55e");
    renderAreaChart(document.getElementById("inv-sparkline"), valSeries, null, ["", ""], "#22c55e");

    const byClass = new Map(), byAcct = new Map();
    for (const h of filtered) {
      const v = Math.max(0, Number(h.currentValue) || 0);
      byClass.set(h.assetClass || "Stock", (byClass.get(h.assetClass || "Stock") || 0) + v);
      byAcct.set(h.account || "GIA", (byAcct.get(h.account || "GIA") || 0) + v);
    }
    renderDonut(document.getElementById("inv-class-donut"), document.getElementById("inv-class-legend"), [...byClass.entries()].map(([label, value]) => ({ label, value })), "Classes");
    renderDonut(document.getElementById("inv-acct-donut"), document.getElementById("inv-acct-legend"), [...byAcct.entries()].map(([label, value]) => ({ label, value })), "Accounts");

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    invPage = Math.min(Math.max(1, invPage), totalPages);
    const start = (invPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    document.getElementById("inv-page-info").textContent = filtered.length ? `Showing ${start + 1}–${start + pageRows.length} of ${filtered.length} · Drop CSV here` : "0 holdings · Drop broker CSV here";
    document.getElementById("inv-prev-btn").disabled = invPage <= 1;
    document.getElementById("inv-next-btn").disabled = invPage >= totalPages;

    document.getElementById("inv-table-body").innerHTML = pageRows.length
      ? pageRows.map((h) => {
          const val = Math.max(0, Number(h.currentValue) || 0), cost = Math.max(0, Number(h.costBasis) || 0), gain = val - cost, pct = cost > 0 ? (gain / cost) * 100 : 0;
          return `<tr><th scope="row"><div class="mini-left">${renderBrandIcon(h.name, h.ticker)}<div><div>${escapeHtml(h.name)}</div><div class="muted-xs">${escapeHtml(h.ticker)}</div></div></div></th><td data-label="Acct"><span class="acct-badge ${String(h.account || "").toLowerCase()}">${escapeHtml(h.account || "GIA")}</span></td><td data-label="Class">${escapeHtml(h.assetClass || "Stock")}</td><td data-label="Cost" class="num">${formatCurrency(cost)}</td><td data-label="Value" class="num"><strong>${formatCurrency(val)}</strong></td><td data-label="Gain / Loss" class="num ${gain >= 0 ? "pos" : "neg"}">${formatSignedCurrency(gain)} <span class="muted-xs">${cost > 0 ? `(${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : "(—)"}</span></td><td data-label="Actions" class="actions-col"><button type="button" class="icon-btn" data-edit-holding="${escapeHtml(h.id)}" aria-label="Edit">✎</button><button type="button" class="icon-btn danger" data-del-holding="${escapeHtml(h.id)}" aria-label="Delete">✕</button></td></tr>`;
        }).join("")
      : `<tr><td colspan="7" class="empty-state">No holdings match.</td></tr>`;

    const top3Sum = filtered.slice(0, 3).reduce((s, h) => s + Math.max(0, Number(h.currentValue) || 0), 0);
    const concPct = totals.totalValue > 0 ? (top3Sum / totals.totalValue) * 100 : 0;
    document.getElementById("inv-conc-pct").textContent = `${concPct.toFixed(1)}%`;
    document.getElementById("inv-conc-bar").style.width = `${Math.min(100, concPct).toFixed(1)}%`;
    document.getElementById("inv-conc-note").textContent = concPct > 75 ? "High top-3 concentration" : concPct > 0 ? "Well diversified across holdings" : "—";
    document.getElementById("inv-insights-list").innerHTML = `
      <div class="signal-row mint"><strong>${totals.gain >= 0 ? "Strong performance" : "Portfolio drawdown"}</strong><span>${formatSignedCurrency(totals.gain)} vs cost basis</span></div>
      <div class="signal-row blue"><strong>${wrappedPct}% tax-efficient</strong><span>${formatCurrency(totals.taxWrapped)} inside ISA &amp; SIPP</span></div>
    `;
  }

  function renderCashflow() {
    const mult = cfPeriod === "year" ? 12 : 1;
    const salaryEl = document.getElementById("cf-salary"), overrideEl = document.getElementById("cf-net-override"), savingsEl = document.getElementById("cf-savings"), debtEl = document.getElementById("cf-debt");
    if (document.activeElement !== salaryEl) salaryEl.value = financeState.annualSalary || "";
    if (document.activeElement !== overrideEl) overrideEl.value = financeState.income || "";
    document.getElementById("cf-pension").checked = Boolean(financeState.pensionContrib);
    document.getElementById("cf-student-loan").checked = Boolean(financeState.studentLoan);
    if (document.activeElement !== savingsEl) savingsEl.value = financeState.savings || "";
    if (document.activeElement !== debtEl) debtEl.value = getTotalDebt() || "";

    const tax = calculateUKTax(financeState.annualSalary, financeState.pensionContrib, financeState.studentLoan);
    const monthlyNet = getMonthlyIncome(), monthlyOut = getMonthlyExpenses(), surplus = monthlyNet - monthlyOut;
    const keptPct = monthlyNet > 0 ? (surplus / monthlyNet) * 100 : 0;

    document.getElementById("cf-surplus-label").textContent = cfPeriod === "year" ? "Annual surplus" : "Monthly surplus";
    const sv = document.getElementById("cf-surplus-val");
    sv.textContent = formatSignedCurrency(surplus * mult);
    sv.className = `hero-amount sm ${surplus >= 0 ? "" : "neg"}`;
    const badge = document.getElementById("cf-surplus-badge");
    badge.textContent = surplus >= 0 ? `${Math.round(keptPct)}% kept` : "Over budget";
    badge.className = `delta-pill ${surplus >= 0 ? "pos" : "neg"}`;
    renderGauge(document.getElementById("cf-gauge-wrap"), keptPct);

    document.getElementById("cf-monthly-net").textContent = `${formatCurrency(monthlyNet * mult)} / ${cfPeriod === "year" ? "yr" : "mo"}`;
    document.getElementById("cf-monthly-tax").textContent = `-${formatCurrency(tax.monthlyTax * mult)}`;
    document.getElementById("cf-monthly-ni").textContent = `-${formatCurrency(tax.monthlyNI * mult)}`;
    document.getElementById("cf-monthly-extra").textContent = `-${formatCurrency(tax.monthlyExtra * mult)}`;

    const liquidNet = Math.max(0, Number(financeState.savings) || 0) - getTotalDebt();
    const le = document.getElementById("cf-liquid-net");
    le.textContent = formatSignedCurrency(liquidNet);
    le.className = liquidNet >= 0 ? "pos" : "neg";

    document.getElementById("cf-total-spend").textContent = formatCurrency(monthlyOut * mult);
    const grid = document.getElementById("cf-budget-grid");
    const bIcons = { mortgage: "🏠", groceries: "🛒", energy: "⚡", publicTransport: "🚗", entertainment: "✨", subscriptions: "📦" };
    if (!grid.dataset.built) {
      grid.innerHTML = BUDGET_BUCKETS.map((b) => `<div class="budget-tile"><div class="budget-tile-head"><span>${bIcons[b.key] || ""} ${escapeHtml(b.label)}</span><span data-b-pct="${b.key}">0%</span></div><input type="number" min="0" step="10" data-budget-key="${b.key}" aria-label="${escapeHtml(b.label)}" placeholder="0" /><div class="budget-bar"><span data-b-bar="${b.key}" style="width:0%"></span></div></div>`).join("");
      grid.dataset.built = "1";
    }
    for (const b of BUDGET_BUCKETS) {
      const val = Math.max(0, Number(financeState.expenses?.[b.key]) || 0);
      const pct = monthlyOut > 0 ? Math.round((val / monthlyOut) * 100) : 0;
      const inp = grid.querySelector(`[data-budget-key="${b.key}"]`);
      if (inp && document.activeElement !== inp) inp.value = val || "";
      const pEl = grid.querySelector(`[data-b-pct="${b.key}"]`);
      if (pEl) pEl.textContent = `${pct}%`;
      const bEl = grid.querySelector(`[data-b-bar="${b.key}"]`);
      if (bEl) bEl.style.width = `${pct}%`;
    }
    renderImpactSimulator(surplus);
  }

  function renderImpactSimulator(baseSurplus) {
    const extraSave = Number(document.getElementById("sim-extra-save")?.value) || 0;
    const cutSpend = Number(document.getElementById("sim-cut-spend")?.value) || 0;
    document.getElementById("sim-extra-save-val").textContent = formatCurrency(extraSave);
    document.getElementById("sim-cut-spend-val").textContent = formatCurrency(cutSpend);
    const newSurplus = baseSurplus + extraSave + cutSpend;
    document.getElementById("sim-new-surplus").textContent = formatSignedCurrency(newSurplus);
    const liftPct = baseSurplus > 0 ? Math.round(((newSurplus - baseSurplus) / baseSurplus) * 100) : 0;
    document.getElementById("sim-surplus-lift").textContent = extraSave + cutSpend > 0 ? `+${formatCurrency(extraSave + cutSpend)}/mo (+${liftPct}%)` : "Adjust sliders";

    const startCash = Math.max(0, Number(financeState.savings) || 0), r = 0.045 / 12, contrib = Math.max(0, newSurplus);
    const pts = [startCash];
    let bal = startCash;
    for (let m = 1; m <= 36; m++) { bal = bal * (1 + r) + contrib; if (m === 12 || m === 24 || m === 36) pts.push(bal); }
    document.getElementById("sim-proj-3y").textContent = `${formatCurrency(bal)} in 3 yrs`;
    renderAreaChart(document.getElementById("cf-proj-chart"), pts, null, ["Now", "1 yr", "2 yrs", "3 yrs"], "#10b981");
  }

  // ============================================================
  // IMPORTS, MODALS, NAVIGATION & VALIDATION
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
        const acct = /virgin/i.test(lower) ? "Virgin Money" : /halifax/i.test(lower) ? "Halifax" : /monzo/i.test(lower) ? "Monzo" : /starling/i.test(lower) ? "Starling" : /hsbc/i.test(lower) ? "HSBC" : /barclays/i.test(lower) ? "Barclays" : /lloyds/i.test(lower) ? "Lloyds" : /revolut/i.test(lower) ? "Revolut" : "Bank";
        combined = combined.concat(parsed.map((t) => ({ ...t, account: t.account || acct })));
      } catch (err) { showNotification(`Failed to parse ${file.name}: ${err.message}`, "error"); }
    }
    if (!combined.length) return showNotification("No transactions found.", "warning");
    combined = window.categorizeTransactions(combined);
    combined = window.detectRecurringPayments(combined);
    pendingBankImport = combined.map((tx) => ({ ...tx, selected: true, category: tx.category || (tx.type === "income" ? "income" : "other") }));
    document.getElementById("bank-import-subtitle").textContent = `Source: ${files.map((f) => f.name).join(", ")}`;
    document.getElementById("bi-total").textContent = String(pendingBankImport.length);
    document.getElementById("bi-income").textContent = formatCurrency(pendingBankImport.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0), 2);
    document.getElementById("bi-expense").textContent = formatCurrency(pendingBankImport.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0), 2);
    document.getElementById("bi-recurring").textContent = String(pendingBankImport.filter((t) => t.isRecurring).length);
    const catOpts = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join("");
    document.getElementById("bi-table-body").innerHTML = pendingBankImport.map((tx, idx) => {
      const isInc = tx.type === "income";
      return `<tr><td><input type="checkbox" data-bi-check="${idx}" checked /></td><td>${escapeHtml(tx.date || "")}</td><td>${escapeHtml(tx.description || "")}</td><td><select class="table-select" data-bi-cat="${idx}">${catOpts.replace(`value="${tx.category}"`, `value="${tx.category}" selected`)}</select></td><td class="num ${isInc ? "pos" : "neg"}">${isInc ? "+" : "-"}${formatCurrency(Math.abs(tx.amount), 2)}</td></tr>`;
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
      const amt = Math.abs(Number(tx.amount) || 0), key = `${tx.date}|${amt.toFixed(2)}|${String(tx.description).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      transactions.unshift({ id: tx.id || generateSecureId("txn"), date: tx.date, description: tx.description, amount: amt, type: tx.type, category: tx.category || (tx.type === "income" ? "income" : "other"), account: tx.account || "Bank", isRecurring: Boolean(tx.isRecurring) });
      added++;
    }
    if (document.getElementById("bi-sync-budget").checked) syncBudgetFromTransactions(false);
    persistAll();
    document.getElementById("bank-import-dialog").close("apply");
    pendingBankImport = [];
    txPage = 1;
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
      const grp = CATEGORIES[tx.category]?.group || "Other", amt = Math.abs(Number(tx.amount) || 0);
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
    if (notify) showNotification(`Synced Cashflow budget from ${div} month(s).`, "success");
  }

  async function handleInvestmentFiles(fileList) {
    const file = (fileList || [])[0];
    if (!file) return;
    try {
      const res = await window.InvestmentParser.parseInvestmentFile(file);
      if (!res.holdings.length) return showNotification("No investment holdings detected.", "warning");
      openInvestmentImportPreview(res, file.name);
    } catch (err) { showNotification(`Investment import failed: ${err.message}`, "error"); }
  }

  function openInvestmentImportPreview(res, fileName) {
    pendingInvImport = res.holdings.map((h) => ({ ...h, selected: true }));
    document.getElementById("inv-import-subtitle").textContent = `Detected ${res.broker} format from ${fileName}`;
    document.getElementById("ii-count").textContent = String(pendingInvImport.length);
    document.getElementById("ii-cost").textContent = formatCurrency(pendingInvImport.reduce((s, h) => s + (Number(h.costBasis) || 0), 0), 2);
    document.getElementById("ii-value").textContent = formatCurrency(pendingInvImport.reduce((s, h) => s + (Number(h.currentValue) || 0), 0), 2);
    document.getElementById("ii-table-body").innerHTML = pendingInvImport.map((h, idx) => `<tr><td><input type="checkbox" data-ii-check="${idx}" checked /></td><td><strong>${escapeHtml(h.ticker)}</strong><div class="muted-xs">${escapeHtml(h.name)}</div></td><td>${escapeHtml(h.account)}</td><td>${escapeHtml(h.assetClass)}</td><td class="num">${Number(h.quantity) || "—"}</td><td class="num">${formatCurrency(h.costBasis, 2)}</td><td class="num"><strong>${formatCurrency(h.currentValue, 2)}</strong></td></tr>`).join("");
    document.getElementById("ii-select-all").checked = true;
    document.getElementById("ii-replace-existing").checked = false;
    document.getElementById("inv-import-dialog").showModal();
  }

  function applyInvestmentImport() {
    const selected = pendingInvImport.filter((h) => h.selected);
    if (!selected.length) return showNotification("Select at least one holding.", "warning");
    if (document.getElementById("ii-replace-existing").checked) holdings = selected.map(({ selected: _s, ...r }) => r);
    else {
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
    invPage = 1;
    renderAll();
    showNotification(`Imported ${selected.length} holding${selected.length === 1 ? "" : "s"}.`, "success");
  }

  function switchView(viewName) {
    let matched = false;
    document.querySelectorAll("[data-view]").forEach((p) => { const a = p.dataset.view === viewName; p.hidden = !a; if (a) matched = true; });
    if (!matched) { viewName = "overview"; document.querySelector('[data-view="overview"]').hidden = false; }
    document.querySelectorAll("[data-nav]").forEach((btn) => { if (btn.dataset.nav === viewName) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current"); });
    try { localStorage.setItem(STORAGE_KEYS.activeView, viewName); } catch {}
  }

  function openHoldingModal(holding = null) {
    document.getElementById("holding-form").reset();
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
      const outside = (e, d) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let downOut = false;
        dialog.addEventListener("pointerdown", (e) => { downOut = outside(e, dialog); });
        dialog.addEventListener("pointerup", (e) => { if (downOut && outside(e, dialog)) dialog.close(); });
      }
    }
  }

  function setupAccessibleValidation() {
    const syncAria = (el) => {
      if (!el.matches?.("input, select")) return;
      const supports = CSS.supports("selector(:user-invalid)");
      const invalid = supports ? el.matches(":user-invalid") : el.classList.contains("user-invalid-fallback");
      el.setAttribute("aria-invalid", invalid ? "true" : "false");
    };
    document.querySelectorAll("form input, form select").forEach((el) => el.setAttribute("aria-invalid", "false"));
    document.addEventListener("blur", (e) => { if (!CSS.supports("selector(:user-invalid)") && e.target.checkValidity) e.target.classList.toggle("user-invalid-fallback", !e.target.validity.valid); syncAria(e.target); }, true);
    document.addEventListener("input", (e) => { if (e.target.hasAttribute("aria-invalid")) { if (!CSS.supports("selector(:user-invalid)") && e.target.checkValidity) e.target.classList.toggle("user-invalid-fallback", !e.target.validity.valid); syncAria(e.target); } });
  }

  let kpiModalTargetTab = "cashflow";

  function openKpiModal(kind) {
    const titleEl = document.getElementById("kpi-detail-title");
    const subEl = document.getElementById("kpi-detail-subtitle");
    const bodyEl = document.getElementById("kpi-detail-body");
    const gotoBtn = document.getElementById("kpi-detail-goto-btn");

    const port = getPortfolioTotals();
    const cash = Math.max(0, Number(financeState.savings) || 0);
    const debt = getTotalDebt();
    const monthlyIn = getMonthlyIncome();
    const monthlyOut = getMonthlyExpenses();
    const surplus = monthlyIn - monthlyOut;

    if (kind === "surplus") {
      kpiModalTargetTab = "cashflow";
      titleEl.textContent = "Monthly Surplus Breakdown";
      subEl.textContent = "UK take-home pay minus monthly budget";
      gotoBtn.textContent = "Open full Cashflow tab →";
      bodyEl.innerHTML = `
        <div class="kpi-modal-hero">
          <span class="muted-xs">Monthly Surplus</span>
          <strong class="${surplus >= 0 ? "pos" : "neg"}">${formatSignedCurrency(surplus)}</strong>
        </div>
        <div class="kpi-modal-list">
          <div class="kpi-modal-row"><span>Monthly Take-Home Income</span><strong>${formatCurrency(monthlyIn)}</strong></div>
          <div class="kpi-modal-row"><span>Monthly Budgeted Spend</span><strong>-${formatCurrency(monthlyOut)}</strong></div>
          <div class="kpi-modal-row"><span>Annualised Surplus</span><strong class="pos">${formatSignedCurrency(surplus * 12)} / yr</strong></div>
        </div>
        <div class="field">
          <label for="quick-salary-inp">Quick Update: Gross Annual Salary (£)</label>
          <input type="number" id="quick-salary-inp" class="input" min="0" step="500" value="${financeState.annualSalary || 0}" />
        </div>
      `;
      bodyEl.querySelector("#quick-salary-inp").addEventListener("input", (e) => {
        financeState.annualSalary = Math.max(0, parseFloat(e.target.value) || 0);
        persistAll();
        renderAll();
      });
    } else if (kind === "cash") {
      kpiModalTargetTab = "cashflow";
      titleEl.textContent = "Cash & Savings Runway";
      subEl.textContent = "Liquid emergency buffer & cash holdings";
      gotoBtn.textContent = "Open full Cashflow tab →";
      const runway = monthlyOut > 0 ? (cash / monthlyOut).toFixed(1) : "—";
      bodyEl.innerHTML = `
        <div class="kpi-modal-hero">
          <span class="muted-xs">Total Liquid Cash</span>
          <strong>${formatCurrency(cash)}</strong>
        </div>
        <div class="kpi-modal-list">
          <div class="kpi-modal-row"><span>Emergency Runway</span><strong class="pos">${runway} months</strong></div>
          <div class="kpi-modal-row"><span>Recommended 6-Month Target</span><strong>${formatCurrency(monthlyOut * 6)}</strong></div>
        </div>
        <div class="field">
          <label for="quick-cash-inp">Quick Update: Cash &amp; Savings (£)</label>
          <input type="number" id="quick-cash-inp" class="input" min="0" step="100" value="${cash}" />
        </div>
      `;
      bodyEl.querySelector("#quick-cash-inp").addEventListener("input", (e) => {
        financeState.savings = Math.max(0, parseFloat(e.target.value) || 0);
        persistAll();
        renderAll();
      });
    } else if (kind === "investments") {
      kpiModalTargetTab = "investments";
      titleEl.textContent = "Investments Snapshot";
      subEl.textContent = `${holdings.length} holdings across ISA, SIPP, GIA & Crypto`;
      gotoBtn.textContent = "Open full Investments tab →";
      const top = [...holdings].sort((a, b) => (Number(b.currentValue) || 0) - (Number(a.currentValue) || 0)).slice(0, 4);
      bodyEl.innerHTML = `
        <div class="kpi-modal-hero">
          <span class="muted-xs">Total Portfolio</span>
          <strong class="pos">${formatCurrency(port.totalValue)}</strong>
        </div>
        <div class="kpi-modal-list">
          <div class="kpi-modal-row"><span>Total Return</span><strong class="${port.gain >= 0 ? "pos" : "neg"}">${formatSignedCurrency(port.gain)} (${port.totalCost > 0 ? `${port.returnPct >= 0 ? "+" : ""}${port.returnPct.toFixed(1)}%` : "—"})</strong></div>
          <div class="kpi-modal-row"><span>Tax-Wrapped (ISA + SIPP)</span><strong>${formatCurrency(port.taxWrapped)}</strong></div>
          ${top.map((h) => `<div class="kpi-modal-row"><span class="mini-left">${renderBrandIcon(h.name, h.ticker)}<span>${escapeHtml(h.name)}</span></span><strong>${formatCurrency(h.currentValue)}</strong></div>`).join("")}
        </div>
      `;
    } else {
      kpiModalTargetTab = "cashflow";
      titleEl.textContent = "Liabilities & Debt";
      subEl.textContent = "Non-mortgage balances deducted from Net Worth";
      gotoBtn.textContent = "Open full Cashflow tab →";
      bodyEl.innerHTML = `
        <div class="kpi-modal-hero">
          <span class="muted-xs">Total Liabilities</span>
          <strong>${formatCurrency(debt)}</strong>
        </div>
        <div class="kpi-modal-list">
          <div class="kpi-modal-row"><span>Liquid Net (Cash − Debt)</span><strong class="${cash - debt >= 0 ? "pos" : "neg"}">${formatSignedCurrency(cash - debt)}</strong></div>
        </div>
        <div class="field">
          <label for="quick-debt-inp">Quick Update: Total Debt (£)</label>
          <input type="number" id="quick-debt-inp" class="input" min="0" step="100" value="${debt}" />
        </div>
      `;
      bodyEl.querySelector("#quick-debt-inp").addEventListener("input", (e) => {
        financeState.liabilities = { otherDebt: Math.max(0, parseFloat(e.target.value) || 0) };
        persistAll();
        renderAll();
      });
    }

    document.getElementById("kpi-detail-dialog").showModal();
  }

  function setupHero3DTilt() {
    const card = document.getElementById("hero-3d-card");
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 3.5).toFixed(2)}deg)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  }

  // Lightweight 60fps 3D Rotating Particle Wealth Globe on Home Hero Canvas
  function initHero3DGlobe() {
    const canvas = document.getElementById("hero-3d-canvas");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pts = [];
    const N = 95;
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      pts.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
        c: i % 3 === 0 ? "#6ee7b7" : i % 3 === 1 ? "#7dd3fc" : "#93c5fd",
      });
    }

    let angleY = 0;
    let mouseX = 0;
    let mouseY = 0;
    const hero = document.getElementById("hero-3d-card");
    hero?.addEventListener("mousemove", (e) => {
      const r = hero.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.6;
      mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.4;
    });

    function draw() {
      const w = (canvas.width = canvas.offsetWidth || 600);
      const h = (canvas.height = canvas.offsetHeight || 220);
      ctx.clearRect(0, 0, w, h);

      const cx = w * 0.44;
      const cy = h * 0.52;
      const rad = Math.min(w, h) * 0.68;
      angleY += 0.0045;
      const cosY = Math.cos(angleY + mouseX);
      const sinY = Math.sin(angleY + mouseX);
      const cosX = Math.cos(0.25 + mouseY);
      const sinX = Math.sin(0.25 + mouseY);

      const projected = pts.map((p) => {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const scale = 2.4 / (2.8 - z2);
        return { sx: cx + x1 * rad * scale, sy: cy + y2 * rad * scale, z: z2, r: Math.max(1.2, scale * 2.1), c: p.c };
      });

      // Subtle connecting arcs between nearby front-facing nodes
      ctx.strokeStyle = "rgba(125, 211, 252, 0.14)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (a.z < -0.2) continue;
        for (let j = i + 1; j < Math.min(i + 8, projected.length); j++) {
          const b = projected[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy;
          if (dx * dx + dy * dy < 3200) {
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      for (const p of projected) {
        ctx.globalAlpha = Math.max(0.18, (p.z + 1.2) / 2.2);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  function startBlankWorkspace() {
    financeState = {
      annualSalary: 0,
      income: 0,
      pensionContrib: false,
      studentLoan: false,
      savings: 0,
      liabilities: { otherDebt: 0 },
      expenses: { mortgage: 0, groceries: 0, energy: 0, publicTransport: 0, entertainment: 0, subscriptions: 0 },
    };
    transactions = [];
    holdings = [];
    localStorage.setItem(STORAGE_KEYS.seeded, "1");
    persistAll();
    renderAll();
    showNotification("Cleared demo data — ready for your own statements & holdings!", "success");
  }

  // Interactive 360° Draggable 3D Particle Globe on Welcome Landing Page
  function initLanding360Globe() {
    const canvas = document.getElementById("landing-globe-canvas");
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pts = [];
    const N = 160;
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      pts.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
        c: i % 4 === 0 ? "#6ee7b7" : i % 4 === 1 ? "#38bdf8" : i % 4 === 2 ? "#93c5fd" : "#f8fafc",
      });
    }

    let rotY = 0;
    let rotX = 0.22;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener("pointerup", () => { dragging = false; });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.008;
      rotX = Math.max(-1.1, Math.min(1.1, rotX + (e.clientY - lastY) * 0.006));
      lastX = e.clientX;
      lastY = e.clientY;
    });

    function draw() {
      const w = (canvas.width = canvas.offsetWidth || 460);
      const h = (canvas.height = canvas.offsetHeight || 420);
      ctx.clearRect(0, 0, w, h);
      if (!dragging) rotY += 0.0055;

      const cx = w / 2;
      const cy = h * 0.5;
      const rad = Math.min(w, h) * 0.34;
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      // Glowing animated energy beams radiating from the 3D sphere out to the 4 finance orbit cards!
      if (w > 900) {
        const targets = [
          { x: w * 0.16, y: h * 0.28, col: "rgba(96, 165, 250, 0.42)" },
          { x: w * 0.84, y: h * 0.28, col: "rgba(52, 211, 153, 0.42)" },
          { x: w * 0.16, y: h * 0.74, col: "rgba(251, 191, 36, 0.38)" },
          { x: w * 0.84, y: h * 0.74, col: "rgba(56, 189, 248, 0.42)" },
        ];
        const pulse = (Date.now() * 0.0012) % 1;
        for (const t of targets) {
          ctx.save();
          ctx.strokeStyle = t.col;
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = -(Date.now() * 0.025);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.quadraticCurveTo((cx + t.x) / 2, cy, t.x, t.y);
          ctx.stroke();
          // Traveling energy orb along each finance beam
          const u = pulse;
          const ox = (1 - u) * (1 - u) * cx + 2 * (1 - u) * u * ((cx + t.x) / 2) + u * u * t.x;
          const oy = (1 - u) * (1 - u) * cy + 2 * (1 - u) * u * cy + u * u * t.y;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(ox, oy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      const projected = pts.map((p) => {
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        const scale = 2.6 / (3.0 - z2);
        return { sx: cx + x1 * rad * scale, sy: cy + y2 * rad * scale, z: z2, r: Math.max(1.3, scale * 2.5), c: p.c };
      }).sort((a, b) => a.z - b.z);

      ctx.strokeStyle = "rgba(125, 211, 252, 0.16)";
      ctx.lineWidth = 0.9;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (a.z < -0.1) continue;
        for (let j = i + 1; j < Math.min(i + 7, projected.length); j++) {
          const b = projected[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy;
          if (dx * dx + dy * dy < 2400) {
            ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
          }
        }
      }

      for (const p of projected) {
        ctx.globalAlpha = Math.max(0.18, (p.z + 1.2) / 2.2);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  function openSankeyModal() {
    const monthlyIn = getMonthlyIncome();
    const monthlyOut = getMonthlyExpenses();
    const surplus = Math.max(0, monthlyIn - monthlyOut);

    renderSankey(document.getElementById("sankey-modal-svg"), monthlyIn, financeState.expenses);

    const rowsEl = document.getElementById("sankey-modal-rows");
    const items = BUDGET_BUCKETS.map((b) => {
      const val = Math.max(0, Number(financeState.expenses?.[b.key]) || 0);
      const pct = monthlyIn > 0 ? Math.round((val / monthlyIn) * 100) : 0;
      const bench = ONS_UK_BENCHMARKS[b.key];
      const diff = bench ? val - bench.avgMonthly : 0;
      const benchText = bench
        ? diff <= 0
          ? `<span class="pos">${formatCurrency(Math.abs(diff))} below UK avg (${formatCurrency(bench.avgMonthly)})</span>`
          : `<span class="neg">+${formatCurrency(diff)} vs UK avg (${formatCurrency(bench.avgMonthly)})</span>`
        : "—";
      return `<div class="sankey-detail-row">
        <strong>${escapeHtml(b.label)}</strong>
        <span><strong>${formatCurrency(val)}</strong> / mo (${pct}%)</span>
        <span class="muted-xs">${formatCurrency(val * 12)} / yr</span>
        <span>${benchText}</span>
      </div>`;
    });

    items.push(`<div class="sankey-detail-row" style="background:#ecfdf5;border:1px solid #86efac">
      <strong class="pos">💰 Monthly Surplus</strong>
      <span class="pos"><strong>${formatCurrency(surplus)}</strong> / mo (${monthlyIn > 0 ? Math.round((surplus / monthlyIn) * 100) : 0}%)</span>
      <span class="pos">${formatCurrency(surplus * 12)} / yr</span>
      <span class="pos">${monthlyIn > 0 && surplus / monthlyIn >= 0.2 ? "Meets 20% MoneyHelper goal ✓" : "Target: 20%+ of take-home"}</span>
    </div>`);

    rowsEl.innerHTML = items.join("");
    document.getElementById("sankey-modal").showModal();
  }

  function init() {
    loadAllState();
    setupDialogFallbacks();
    setupAccessibleValidation();
    setupHero3DTilt();
    initHero3DGlobe();
    initLanding360Globe();

    // Landing CTA + Enlargeable Sankey Modal + Benchmark reflection pills
    document.getElementById("landing-import-btn")?.addEventListener("click", () => {
      switchView("statements");
      document.getElementById("bank-file-input").click();
    });
    document.getElementById("landing-blank-btn")?.addEventListener("click", () => {
      startBlankWorkspace();
      switchView("overview");
    });
    document.getElementById("enlarge-sankey-btn")?.addEventListener("click", openSankeyModal);
    document.getElementById("ov-sankey-wrap")?.addEventListener("click", openSankeyModal);
    document.getElementById("sankey-modal-done-btn")?.addEventListener("click", () => document.getElementById("sankey-modal").close("done"));
    document.getElementById("sankey-modal-edit-btn")?.addEventListener("click", () => {
      document.getElementById("sankey-modal").close("edit");
      switchView("cashflow");
    });
    document.getElementById("st-benchmarks-list")?.addEventListener("click", (e) => {
      const btn = e.target.closest(".feel-btn");
      if (!btn) return;
      const group = btn.closest(".feel-pills");
      group?.querySelectorAll(".feel-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      if (btn.dataset.feel === "cut" && btn.dataset.key) {
        const k = btn.dataset.key;
        const curr = Number(financeState.expenses?.[k]) || 0;
        if (curr > 0) {
          financeState.expenses[k] = Math.round(curr * 0.85);
          persistAll();
          renderAll();
          showNotification(`Budget trimmed 15% (+${formatCurrency(Number(btn.dataset.save) || 0)}/yr added to surplus)!`, "success");
        }
      } else {
        showNotification("Kept as-is — we'll keep tracking this trend.", "info");
      }
    });

    // Home Action Launchers
    document.getElementById("start-blank-btn")?.addEventListener("click", startBlankWorkspace);
    document.getElementById("home-act-bank")?.addEventListener("click", () => {
      switchView("statements");
      document.getElementById("bank-file-input").click();
    });
    document.getElementById("home-act-inv")?.addEventListener("click", () => openHoldingModal());
    document.getElementById("home-act-tax")?.addEventListener("click", () => openKpiModal("surplus"));

    // Home Visual Switcher Tabs
    document.getElementById("home-left-tabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-home-left]");
      if (!btn) return;
      const target = btn.dataset.homeLeft;
      document.querySelectorAll("#home-left-tabs [data-home-left]").forEach((b) => b.classList.toggle("is-active", b === btn));
      document.querySelectorAll("[data-home-left-pane]").forEach((p) => { p.hidden = p.dataset.homeLeftPane !== target; });
      const rangeGrp = document.getElementById("ov-range-group");
      if (rangeGrp) rangeGrp.style.visibility = target === "trend" ? "visible" : "hidden";
    });
    document.getElementById("home-right-tabs")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-home-right]");
      if (!btn) return;
      const target = btn.dataset.homeRight;
      document.querySelectorAll("#home-right-tabs [data-home-right]").forEach((b) => b.classList.toggle("is-active", b === btn));
      document.querySelectorAll("[data-home-right-pane]").forEach((p) => { p.hidden = p.dataset.homeRightPane !== target; });
    });

    document.querySelectorAll("[data-kpi-modal]").forEach((tile) => {
      tile.addEventListener("click", () => openKpiModal(tile.dataset.kpiModal));
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openKpiModal(tile.dataset.kpiModal); }
      });
    });
    document.getElementById("kpi-detail-done-btn").addEventListener("click", () => document.getElementById("kpi-detail-dialog").close("done"));
    document.getElementById("kpi-detail-goto-btn").addEventListener("click", () => {
      document.getElementById("kpi-detail-dialog").close("goto");
      switchView(kpiModalTargetTab);
    });

    const opts = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join("");
    document.getElementById("tx-cat-filter").innerHTML = `<option value="all">All categories</option>${opts}`;
    document.getElementById("t-category").innerHTML = opts;

    document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.nav)));
    document.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => switchView(b.dataset.goto)));

    document.getElementById("reset-demo-btn").addEventListener("click", resetToDemoData);
    document.getElementById("quick-holding-btn").addEventListener("click", () => openHoldingModal());
    document.getElementById("ov-upload-bank-btn")?.addEventListener("click", () => { switchView("statements"); document.getElementById("bank-file-input").click(); });
    document.getElementById("ov-upload-inv-btn")?.addEventListener("click", () => { switchView("investments"); document.getElementById("inv-file-input").click(); });

    document.getElementById("ov-range-group").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ov-range]");
      if (!btn) return;
      ovRange = btn.dataset.ovRange;
      document.querySelectorAll("[data-ov-range]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderOverview();
    });

    // Dropzones
    const bankInput = document.getElementById("bank-file-input"), invInput = document.getElementById("inv-file-input");
    const bankZone = document.getElementById("bank-dropzone"), invZone = document.getElementById("inv-dropzone");
    bankZone.addEventListener("click", () => bankInput.click());
    bankZone.addEventListener("dragover", (e) => { e.preventDefault(); bankZone.classList.add("dragover"); });
    bankZone.addEventListener("dragleave", () => bankZone.classList.remove("dragover"));
    bankZone.addEventListener("drop", (e) => { e.preventDefault(); bankZone.classList.remove("dragover"); if (e.dataTransfer?.files?.length) handleBankFiles(e.dataTransfer.files); });
    bankInput.addEventListener("change", (e) => { if (e.target.files?.length) handleBankFiles(e.target.files); bankInput.value = ""; });

    invZone.addEventListener("dragover", (e) => { e.preventDefault(); invZone.classList.add("dragover"); });
    invZone.addEventListener("dragleave", () => invZone.classList.remove("dragover"));
    invZone.addEventListener("drop", (e) => { e.preventDefault(); invZone.classList.remove("dragover"); if (e.dataTransfer?.files?.length) handleInvestmentFiles(e.dataTransfer.files); });
    invInput.addEventListener("change", (e) => { if (e.target.files?.length) handleInvestmentFiles(e.target.files); invInput.value = ""; });
    document.getElementById("inv-import-trigger-btn").addEventListener("click", () => invInput.click());

    // Pagination
    document.getElementById("tx-prev-btn").addEventListener("click", () => { txPage--; renderStatements(); });
    document.getElementById("tx-next-btn").addEventListener("click", () => { txPage++; renderStatements(); });
    document.getElementById("inv-prev-btn").addEventListener("click", () => { invPage--; renderInvestments(); });
    document.getElementById("inv-next-btn").addEventListener("click", () => { invPage++; renderInvestments(); });

    // Statements controls
    document.getElementById("st-tab-group").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-st-mode]");
      if (!btn) return;
      stMode = btn.dataset.stMode;
      txPage = 1;
      document.querySelectorAll("[data-st-mode]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderStatements();
    });
    document.getElementById("tx-search").addEventListener("input", () => { txPage = 1; renderStatements(); });
    document.getElementById("tx-cat-filter").addEventListener("change", () => { txPage = 1; renderStatements(); });
    document.getElementById("sync-budget-from-tx-btn").addEventListener("click", () => syncBudgetFromTransactions(true));
    document.getElementById("cf-sync-tx-btn").addEventListener("click", () => syncBudgetFromTransactions(true));
    document.getElementById("sample-bank-btn").addEventListener("click", () => {
      const csv = ["Date,Counter Party,Reference,Type,Amount (GBP),Spending Category", "21/11/2026,PRET A MANGER,LUNCH,CARD,-11.40,FOOD_AND_DRINK", "20/11/2026,SAINSBURYS,GROCERIES,CARD,-74.20,GROCERIES", "19/11/2026,TFL TRAVEL,COMMUTE,CARD,-24.60,TRANSPORT", "18/11/2026,ADOBE CREATIVE,SUBSCRIPTION,DIRECT DEBIT,-54.98,SUBSCRIPTIONS", "17/11/2026,BONUS PAYMENT,PAYROLL,FASTER PAYMENT,1200.00,INCOME"].join("\n");
      handleBankFiles([new File([csv], "starling-sample.csv", { type: "text/csv" })]);
    });

    document.getElementById("tx-table-body").addEventListener("change", (e) => {
      const sel = e.target.closest("[data-tx-cat]");
      if (!sel) return;
      const tx = transactions.find((t) => t.id === sel.dataset.txCat);
      if (!tx) return;
      tx.category = sel.value;
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

    document.getElementById("add-tx-btn").addEventListener("click", () => {
      document.getElementById("tx-form").reset();
      document.getElementById("t-date").value = new Date().toISOString().slice(0, 10);
      document.getElementById("t-category").value = "groceries";
      document.getElementById("tx-dialog").showModal();
    });
    document.getElementById("tx-cancel-btn").addEventListener("click", () => document.getElementById("tx-dialog").close("cancel"));
    document.getElementById("tx-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!e.target.checkValidity()) return e.target.reportValidity();
      transactions.unshift({ id: generateSecureId("txn"), date: document.getElementById("t-date").value, description: document.getElementById("t-desc").value.trim(), amount: Math.max(0.01, parseFloat(document.getElementById("t-amount").value) || 0), type: document.getElementById("t-type").value, category: document.getElementById("t-category").value, account: document.getElementById("t-account").value, isRecurring: false });
      persistAll();
      document.getElementById("tx-dialog").close("save");
      txPage = 1;
      renderAll();
      showNotification("Transaction added.", "success");
    });

    document.getElementById("bi-select-all").addEventListener("change", (e) => { pendingBankImport.forEach((t) => (t.selected = e.target.checked)); document.querySelectorAll("[data-bi-check]").forEach((cb) => (cb.checked = e.target.checked)); });
    document.getElementById("bi-table-body").addEventListener("change", (e) => { const cb = e.target.closest("[data-bi-check]"); if (cb) pendingBankImport[Number(cb.dataset.biCheck)].selected = cb.checked; const sel = e.target.closest("[data-bi-cat]"); if (sel) pendingBankImport[Number(sel.dataset.biCat)].category = sel.value; });
    document.getElementById("bi-cancel-btn").addEventListener("click", () => document.getElementById("bank-import-dialog").close("cancel"));
    document.getElementById("bi-apply-btn").addEventListener("click", applyBankImport);

    // Investments controls
    document.getElementById("add-holding-btn").addEventListener("click", () => openHoldingModal());
    document.getElementById("inv-search").addEventListener("input", () => { invPage = 1; renderInvestments(); });
    document.getElementById("inv-range-select").addEventListener("change", (e) => { invRange = e.target.value; renderInvestments(); });
    document.getElementById("inv-account-filters").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-inv-filter]");
      if (!btn) return;
      invAccountFilter = btn.dataset.invFilter;
      invPage = 1;
      document.querySelectorAll("[data-inv-filter]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderInvestments();
    });
    document.getElementById("sample-inv-btn").addEventListener("click", () => {
      const csv = ["Action,Time,ISIN,Ticker,Name,No. of shares,Price / share,Total (GBP)", "Market buy,2026-08-01,IE00BK5BQT80,VUAG,Vanguard S&P 500 UCITS ETF,45,82.50,3712.50", "Market buy,2026-09-10,US0231351067,AMZN,Amazon.com Inc,18,148.00,2664.00", "Market buy,2026-10-05,IE00B4L5Y983,SWDA,iShares Core MSCI World,30,84.20,2526.00"].join("\n");
      openInvestmentImportPreview(window.InvestmentParser.parseInvestmentCSVText(csv, "trading212-isa.csv"), "trading212-isa.csv");
    });

    document.getElementById("inv-table-body").addEventListener("click", (e) => {
      const eb = e.target.closest("[data-edit-holding]");
      if (eb) { const h = holdings.find((x) => x.id === eb.dataset.editHolding); if (h) openHoldingModal(h); return; }
      const db = e.target.closest("[data-del-holding]");
      if (db) { holdings = holdings.filter((x) => x.id !== db.dataset.delHolding); persistAll(); renderAll(); showNotification("Holding removed.", "info"); }
    });
    document.getElementById("holding-cancel-btn").addEventListener("click", () => document.getElementById("holding-dialog").close("cancel"));
    document.getElementById("holding-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!e.target.checkValidity()) return e.target.reportValidity();
      const id = document.getElementById("h-id").value, name = document.getElementById("h-name").value.trim();
      const ticker = document.getElementById("h-ticker").value.trim().toUpperCase() || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase();
      const item = { id: id || generateSecureId("inv"), name, ticker, account: document.getElementById("h-account").value, assetClass: document.getElementById("h-class").value, quantity: Math.max(0, parseFloat(document.getElementById("h-qty").value) || 0), costBasis: Math.max(0, parseFloat(document.getElementById("h-cost").value) || 0), currentValue: Math.max(0, parseFloat(document.getElementById("h-value").value) || 0) };
      const idx = holdings.findIndex((h) => h.id === item.id);
      if (idx >= 0) holdings[idx] = item; else holdings.push(item);
      persistAll();
      document.getElementById("holding-dialog").close("save");
      renderAll();
      showNotification(idx >= 0 ? "Holding updated." : "Holding added.", "success");
    });
    document.getElementById("ii-select-all").addEventListener("change", (e) => { pendingInvImport.forEach((h) => (h.selected = e.target.checked)); document.querySelectorAll("[data-ii-check]").forEach((cb) => (cb.checked = e.target.checked)); });
    document.getElementById("ii-table-body").addEventListener("change", (e) => { const cb = e.target.closest("[data-ii-check]"); if (cb) pendingInvImport[Number(cb.dataset.iiCheck)].selected = cb.checked; });
    document.getElementById("ii-cancel-btn").addEventListener("click", () => document.getElementById("inv-import-dialog").close("cancel"));
    document.getElementById("ii-apply-btn").addEventListener("click", applyInvestmentImport);

    // Cashflow controls (all clamped >= 0)
    document.getElementById("cf-period-group").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cf-period]");
      if (!btn) return;
      cfPeriod = btn.dataset.cfPeriod;
      document.querySelectorAll("[data-cf-period]").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderCashflow();
    });
    document.getElementById("cf-salary").addEventListener("input", (e) => { financeState.annualSalary = Math.max(0, parseFloat(e.target.value) || 0); persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("cf-net-override").addEventListener("input", (e) => { financeState.income = Math.max(0, parseFloat(e.target.value) || 0); persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("cf-pension").addEventListener("change", (e) => { financeState.pensionContrib = e.target.checked; persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("cf-student-loan").addEventListener("change", (e) => { financeState.studentLoan = e.target.checked; persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("cf-savings").addEventListener("input", (e) => { financeState.savings = Math.max(0, parseFloat(e.target.value) || 0); persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("cf-debt").addEventListener("input", (e) => { financeState.liabilities = { otherDebt: Math.max(0, parseFloat(e.target.value) || 0) }; persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("cf-budget-grid").addEventListener("input", (e) => { const k = e.target.dataset.budgetKey; if (!k) return; financeState.expenses[k] = Math.max(0, parseFloat(e.target.value) || 0); persistAll(); renderOverview(); renderCashflow(); });
    document.getElementById("sim-extra-save").addEventListener("input", () => renderImpactSimulator(getMonthlyIncome() - getMonthlyExpenses()));
    document.getElementById("sim-cut-spend").addEventListener("input", () => renderImpactSimulator(getMonthlyIncome() - getMonthlyExpenses()));

    // Open on Welcome Intro Landing page on first visit (or restore last tab)
    let startView = "landing";
    try { startView = localStorage.getItem(STORAGE_KEYS.activeView) || "landing"; } catch {}
    switchView(startView);
    renderAll();
    hydrateFromNeon();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
