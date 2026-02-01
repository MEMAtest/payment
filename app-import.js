// STATEMENT IMPORT FEATURE
// ============================================================

const IMPORT_STORAGE_KEY = "consumerpay_import_history";
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
let importInitialized = false;
let importSuggestionsDelegationAttached = false;

function shouldRememberCategories() {
  return document.querySelector("[data-import-remember]")?.checked ?? false;
}

function saveCategoryPreference(description, category) {
  if (!category) return;
  if (typeof loadCustomCategoryMap !== "function" || typeof saveCustomCategoryMap !== "function") {
    return;
  }
  const normalized = normalizeMerchant(description);
  if (!normalized) return;
  const map = loadCustomCategoryMap();
  map[normalized] = category;
  saveCustomCategoryMap(map);
}

function applyCategoryToSimilar(description, category, type) {
  if (!category) return 0;
  if (typeof normalizeMerchant !== "function") return 0;
  const normalized = normalizeMerchant(description);
  if (!normalized) return 0;
  let count = 0;
  importedTransactions.forEach((tx) => {
    if (type && tx.type !== type) return;
    if (normalizeMerchant(tx.description) === normalized) {
      tx.category = category;
      count += 1;
    }
  });
  return count;
}

function applyCategoryToNormalizedKey(normalizedKey, category, type) {
  if (!category || !normalizedKey) return 0;
  if (typeof normalizeMerchant !== "function") return 0;
  let count = 0;
  importedTransactions.forEach((tx) => {
    if (type && tx.type !== type) return;
    if (normalizeMerchant(tx.description) === normalizedKey) {
      tx.category = category;
      count += 1;
    }
  });
  return count;
}

// Merchant to category mapping for smart categorization
function initStatementImport() {
  const dropzone = document.querySelector("[data-import-dropzone]");
  const fileInput = document.querySelector("[data-import-file]");
  const modal = document.querySelector("[data-import-modal]");

  if (!dropzone || !fileInput) return;
  if (importInitialized) return;
  importInitialized = true;

  // Click to upload
  dropzone.addEventListener("click", (e) => {
    if (e.target === fileInput) return;
    fileInput.click();
  });

  // File selection
  fileInput.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await handleFiles(files);
    } catch (error) {
      console.error("File import failed:", error);
      const firstName = files[0]?.name || "file";
      updateProgress(100, `Failed to import ${escapeHtml(firstName)}.`);
      showNotification(`Import failed: ${error.message}`, "error");
    } finally {
      fileInput.value = "";
    }
  });

  // Drag and drop
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    try {
      await handleFiles(files);
    } catch (error) {
      console.error("Drop import failed:", error);
      const firstName = files[0]?.name || "file";
      updateProgress(100, `Failed to import ${escapeHtml(firstName)}.`);
      showNotification(`Import failed: ${error.message}`, "error");
    }
  });

  // Modal controls
  document.querySelector("[data-import-close]")?.addEventListener("click", closeImportModal);
  document.querySelector("[data-import-cancel]")?.addEventListener("click", closeImportModal);
  document.querySelector("[data-import-apply]")?.addEventListener("click", applyImportedTransactions);
  document.querySelector("[data-import-select-all]")?.addEventListener("click", selectAllTransactions);
  document.querySelector("[data-import-deselect-all]")?.addEventListener("click", deselectAllTransactions);

  // Filter buttons
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderTransactions();
    });
  });

  document.querySelector("[data-import-autocategorize]")?.addEventListener("click", () => {
    const before = importedTransactions.filter((tx) => !tx.category).length;
    importedTransactions = categorizeTransactions(importedTransactions);
    const after = importedTransactions.filter((tx) => !tx.category).length;
    const applied = Math.max(0, before - after);
    renderTransactions();
    showNotification(`Auto-categorized ${applied} transactions.`, "success");
  });

  // Load import history
  renderImportHistory();
}

// Constants for import validation
const MAX_TRANSACTIONS_PER_IMPORT = 5000;
const LARGE_IMPORT_TX_THRESHOLD = 200;
const LARGE_IMPORT_TOTAL_THRESHOLD = 10000;
const ALLOWED_MIME_TYPES = {
  csv: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  xls: ['application/vnd.ms-excel'],
  pdf: ['application/pdf']
};

// Validate file type by extension and MIME type
function validateFileType(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const allowedExts = ['csv', 'xlsx', 'xls', 'pdf'];

  if (!allowedExts.includes(ext)) {
    return { valid: false, error: `Unsupported file type: .${ext}. Allowed: CSV, Excel, PDF` };
  }

  // Check MIME type if available (some browsers may not provide it)
  if (file.type && ALLOWED_MIME_TYPES[ext]) {
    const expectedTypes = ALLOWED_MIME_TYPES[ext];
    // Allow empty type as some browsers don't report it correctly
    if (file.type !== '' && !expectedTypes.includes(file.type)) {
      console.warn(`MIME type mismatch for ${file.name}: expected ${expectedTypes.join('/')}, got ${file.type}`);
      // Continue anyway since extension matched - MIME types can be unreliable
    }
  }

  return { valid: true, ext };
}

// Handle uploaded files
async function handleFiles(files) {
  const modal = document.querySelector("[data-import-modal]");
  const progressEl = document.querySelector("[data-import-progress]");
  const summaryEl = document.querySelector("[data-import-summary]");
  const transactionsEl = document.querySelector("[data-import-transactions]");

  modal.hidden = false;
  progressEl.hidden = false;
  summaryEl.hidden = true;
  transactionsEl.style.display = "none";

  importedTransactions = [];

  for (const file of files) {
    const filenameEl = document.querySelector("[data-import-filename]");
    if (filenameEl) filenameEl.textContent = file.name;
    updateProgress(0, `Processing ${escapeHtml(file.name)}...`);

    // File size validation
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      updateProgress(100, `File ${escapeHtml(file.name)} exceeds 10MB limit. Please use a smaller file.`);
      showNotification(`File too large: ${file.name}`, 'error');
      continue;
    }

    // File type validation
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      updateProgress(100, typeValidation.error);
      showNotification(typeValidation.error, 'error');
      continue;
    }

    try {
      let transactions = [];

      if (typeValidation.ext === "csv") {
        transactions = await parseCSV(file);
      } else if (typeValidation.ext === "xlsx" || typeValidation.ext === "xls") {
        transactions = await parseExcel(file);
      } else if (typeValidation.ext === "pdf") {
        transactions = await parsePDF(file);
      }

      // Limit transaction count to prevent memory issues
      if (transactions.length > MAX_TRANSACTIONS_PER_IMPORT) {
        showNotification(`File contains ${transactions.length} transactions. Limiting to first ${MAX_TRANSACTIONS_PER_IMPORT}.`, 'warning');
        transactions = transactions.slice(0, MAX_TRANSACTIONS_PER_IMPORT);
      }

      importedTransactions = importedTransactions.concat(transactions);

      // Check total transaction count
      if (importedTransactions.length > MAX_TRANSACTIONS_PER_IMPORT) {
        showNotification(`Total transactions exceed limit. Truncating to ${MAX_TRANSACTIONS_PER_IMPORT}.`, 'warning');
        importedTransactions = importedTransactions.slice(0, MAX_TRANSACTIONS_PER_IMPORT);
        break;
      }

    } catch (error) {
      console.error("Error parsing file:", error);
      updateProgress(100, `Error parsing ${escapeHtml(file.name)}: ${escapeHtml(error.message)}`);
      showNotification(`Error parsing file: ${error.message}`, 'error');
    }
  }

  // Categorize and detect recurring
  importedTransactions = categorizeTransactions(importedTransactions);
  importedTransactions = detectRecurringPayments(importedTransactions);

  // Update UI
  progressEl.hidden = true;
  summaryEl.hidden = false;
  transactionsEl.style.display = "flex";

  updateImportSummary();
  renderTransactions();
}

// Update progress bar
function updateProgress(percent, text) {
  const fill = document.querySelector("[data-progress-fill]");
  const textEl = document.querySelector("[data-progress-text]");
  if (fill) fill.style.width = `${percent}%`;
  if (textEl) textEl.textContent = text;
}

// Parse CSV file
function renderTransactions() {
  const list = document.querySelector("[data-transaction-list]");
  if (!list) return;

  const normalizedCounts = {};
  if (typeof normalizeMerchant === "function") {
    importedTransactions.forEach((tx) => {
      const key = normalizeMerchant(tx.description);
      if (!key) return;
      normalizedCounts[key] = (normalizedCounts[key] || 0) + 1;
    });
  }

  // Filter transactions
  let filtered = importedTransactions;
  if (currentFilter === "income") {
    filtered = importedTransactions.filter((tx) => tx.type === "income");
  } else if (currentFilter === "expense") {
    filtered = importedTransactions.filter((tx) => tx.type === "expense");
  } else if (currentFilter === "recurring") {
    filtered = importedTransactions.filter((tx) => tx.isRecurring);
  } else if (currentFilter === "uncategorized") {
    filtered = importedTransactions.filter((tx) => !tx.category);
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="import-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>No transactions match this filter</p>
      </div>
    `;
    renderImportSuggestions();
    return;
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  list.innerHTML = filtered.map((tx) => {
    const normalizedKey = typeof normalizeMerchant === "function" ? normalizeMerchant(tx.description) : "";
    const similarCount = normalizedKey ? normalizedCounts[normalizedKey] || 0 : 0;
    const showApplySimilar = similarCount > 1;
    const categoryOptions = Object.keys(state.expenses).map((key) =>
      `<option value="${key}" ${tx.category === key ? "selected" : ""}>${escapeHtml(formatExpenseLabel(key))}</option>`
    ).join("");

    return `
      <div class="transaction-item ${tx.type} ${tx.isRecurring ? "recurring" : ""}" data-tx-id="${escapeHtml(tx.id)}">
        <input type="checkbox" class="transaction-checkbox" ${tx.selected ? "checked" : ""} data-tx-checkbox="${escapeHtml(tx.id)}">
        <div class="transaction-details">
          <span class="transaction-name">${escapeHtml(tx.description)}</span>
          <div class="transaction-meta">
            <span>${escapeHtml(formatDateDisplay(tx.date))}</span>
            ${tx.isRecurring ? '<span class="recurring-badge">Recurring</span>' : ""}
          </div>
        </div>
        <div class="transaction-category">
          <select data-tx-category="${escapeHtml(tx.id)}">
            <option value="">Uncategorized</option>
            ${categoryOptions}
          </select>
          ${showApplySimilar ? `
            <div class="transaction-similar">
              <button type="button" data-apply-similar="${escapeHtml(tx.id)}">
                Apply to similar (${similarCount})
              </button>
            </div>
          ` : ""}
        </div>
        <span class="transaction-amount ${tx.amount >= 0 ? "positive" : "negative"}">
          ${tx.amount >= 0 ? "+" : ""}${formatCurrency(tx.amount)}
        </span>
      </div>
    `;
  }).join("");
  ensureImportTransactionsDelegation(list);
  renderImportSuggestions();
}

function renderImportSuggestions() {
  const container = document.querySelector("[data-import-suggestions]");
  if (!container) return;

  const uncategorized = importedTransactions.filter((tx) => !tx.category && tx.type === "expense");
  if (uncategorized.length === 0) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "block";

  const groups = new Map();
  uncategorized.forEach((tx) => {
    const key = typeof normalizeMerchant === "function"
      ? normalizeMerchant(tx.description)
      : String(tx.description || "").toLowerCase();
    if (!key) return;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        example: tx.description,
        count: 0,
        total: 0
      });
    }
    const group = groups.get(key);
    group.count += 1;
    group.total += Math.abs(tx.amount);
    if (!group.example || String(tx.description).length < String(group.example).length) {
      group.example = tx.description;
    }
  });

  const topGroups = Array.from(groups.values())
    .sort((a, b) => (b.count - a.count) || (b.total - a.total))
    .slice(0, 5);

  if (topGroups.length === 0) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  const categoryOptions = Object.keys(state.expenses).map((key) =>
    `<option value="${key}">${escapeHtml(formatExpenseLabel(key))}</option>`
  ).join("");

  container.innerHTML = `
    <div class="suggestions-header">
      <strong>Quick categorization</strong>
      <span class="muted">${uncategorized.length} uncategorized</span>
    </div>
    <div class="suggestions-list">
      ${topGroups.map((group) => `
        <div class="suggestion-item" data-suggestion-key="${escapeHtml(group.key)}">
          <div class="suggestion-info">
            <span class="suggestion-name">${escapeHtml(group.example)}</span>
            <span class="suggestion-meta">${group.count} tx · ${formatCurrency(group.total)}</span>
          </div>
          <div class="suggestion-action">
            <select data-suggestion-category="${escapeHtml(group.key)}">
              <option value="">Choose category...</option>
              ${categoryOptions}
            </select>
          </div>
        </div>
      `).join("")}
    </div>
  `;

  ensureImportSuggestionsDelegation(container);
}

function ensureImportSuggestionsDelegation(container) {
  if (!container || importSuggestionsDelegationAttached) return;

  container.addEventListener("change", (event) => {
    const select = event.target.closest("[data-suggestion-category]");
    if (!select) return;
    const key = select.dataset.suggestionCategory;
    const category = select.value || null;
    if (!key || !category) return;

    const count = applyCategoryToNormalizedKey(key, category, "expense");
    if (count > 0) {
      if (shouldRememberCategories()) {
        saveCategoryPreference(key, category);
      }
      renderTransactions();
      showNotification(`Applied "${formatExpenseLabel(category)}" to ${count} transactions.`, "success");
    }
  });

  importSuggestionsDelegationAttached = true;
}

function ensureImportTransactionsDelegation(list) {
  if (importTransactionsDelegationAttached || !list) return;

  list.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-tx-checkbox]");
    if (checkbox) {
      const txId = checkbox.dataset.txCheckbox;
      const tx = importedTransactions.find((t) => t.id === txId);
      if (tx) tx.selected = checkbox.checked;
      return;
    }

    const select = event.target.closest("[data-tx-category]");
    if (select) {
      const txId = select.dataset.txCategory;
      const tx = importedTransactions.find((t) => t.id === txId);
      if (tx) {
        tx.category = select.value || null;
        if (tx.category && shouldRememberCategories()) {
          saveCategoryPreference(tx.description, tx.category);
        }
      }
    }
  });

  list.addEventListener("click", (event) => {
    const applyBtn = event.target.closest("[data-apply-similar]");
    if (!applyBtn) return;
    const txId = applyBtn.dataset.applySimilar;
    const tx = importedTransactions.find((t) => t.id === txId);
    if (!tx || !tx.category) {
      showNotification("Select a category first, then apply to similar.", "warning");
      return;
    }
    const count = applyCategoryToSimilar(tx.description, tx.category, tx.type);
    if (count > 0) {
      if (shouldRememberCategories()) {
        saveCategoryPreference(tx.description, tx.category);
      }
      renderTransactions();
      showNotification(`Applied "${formatExpenseLabel(tx.category)}" to ${count} transactions.`, "success");
    }
  });

  importTransactionsDelegationAttached = true;
}

// Format expense key as label
function formatExpenseLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
}

// Format date for display
function formatDateDisplay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Select/deselect all transactions
function selectAllTransactions() {
  importedTransactions.forEach((tx) => tx.selected = true);
  renderTransactions();
}

function deselectAllTransactions() {
  importedTransactions.forEach((tx) => tx.selected = false);
  renderTransactions();
}

// Apply imported transactions to the app's expenses
async function applyImportedTransactions() {
  try {
    const selectedTx = importedTransactions.filter((tx) => tx.selected && tx.category && tx.type === "expense");

    if (selectedTx.length === 0) {
      showNotification("Please select transactions with categories to apply.", "warning");
      return;
    }

    // Aggregate expenses by category
    const categoryTotals = {};
    selectedTx.forEach((tx) => {
      if (!categoryTotals[tx.category]) {
        categoryTotals[tx.category] = 0;
      }
      categoryTotals[tx.category] += Math.abs(tx.amount);
    });

    const totalAmount = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    const categoryCount = Object.keys(categoryTotals).length;
    const requiresConfirmation =
      selectedTx.length >= LARGE_IMPORT_TX_THRESHOLD || totalAmount >= LARGE_IMPORT_TOTAL_THRESHOLD;

    if (requiresConfirmation) {
      const confirmed = await showConfirmation(
        `This will update ${categoryCount} categories using ${selectedTx.length} transactions (${formatCurrency(
          totalAmount
        )} total). Continue?`,
        "Large Import Detected",
        "Apply Changes",
        "Cancel"
      );
      if (!confirmed) {
        showNotification("Import cancelled.", "info");
        return;
      }
    }

    // Calculate monthly averages if we have multiple months
    const dates = selectedTx.map((tx) => new Date(tx.date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const monthSpan = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));

    // Apply to state
    Object.entries(categoryTotals).forEach(([category, total]) => {
      const monthlyAvg = Math.round(total / monthSpan);
      if (state.expenses[category] !== undefined) {
        state.expenses[category] = monthlyAvg;
        const input = document.querySelector(`[data-expense="${category}"]`);
        if (input) input.value = monthlyAvg;
      }
    });

    // Save import to history
    saveImportHistory({
      filename: document.querySelector("[data-import-filename]")?.textContent || "Unknown",
      date: new Date().toISOString(),
      transactionCount: selectedTx.length,
      totalAmount,
    });

    // Update app
    saveLocalState();
    updateSummary();
    updateSmartInsights();

    closeImportModal();

    showNotification(`Successfully imported ${selectedTx.length} transactions into your budget!`, "success");
  } catch (error) {
    console.error("Failed to apply imported transactions:", error);
    showNotification(`Failed to apply import: ${error.message}`, "error");
  }
}

// Close import modal
function closeImportModal() {
  const modal = document.querySelector("[data-import-modal]");
  if (modal) modal.hidden = true;
  importedTransactions = [];
  currentFilter = "all";
}

// Save import to history
function saveImportHistory(entry) {
  const history = JSON.parse(localStorage.getItem(IMPORT_STORAGE_KEY) || "[]");
  history.unshift(entry);
  // Keep only last 10 imports
  localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
  renderImportHistory();
}

// Render import history
function renderImportHistory() {
  const list = document.querySelector("[data-import-history-list]");
  if (!list) return;

  let history = [];
  try {
    const stored = localStorage.getItem(IMPORT_STORAGE_KEY);
    const parsed = JSON.parse(stored || "[]");
    if (Array.isArray(parsed)) history = parsed;
  } catch (e) {
    console.warn("Invalid import history, resetting");
    localStorage.removeItem(IMPORT_STORAGE_KEY);
  }

  if (history.length === 0) {
    list.innerHTML = '<p class="muted">No imports yet. Upload a file to get started.</p>';
    return;
  }

  list.innerHTML = history.map((entry) => `
    <div class="import-history-item">
      <div class="import-history-info">
        <strong>${escapeHtml(entry.filename || 'Unknown')}</strong>
        <span class="muted">${escapeHtml(formatDateDisplay(entry.date))}</span>
      </div>
      <div class="import-history-stats">
        <span>${entry.transactionCount} transactions</span>
        <span>${formatCurrency(entry.totalAmount)}</span>
      </div>
    </div>
  `).join("");
}

// Expose import functions globally for cross-module access
Object.assign(window, {
  initStatementImport,
  validateFileType,
  handleFiles,
  updateProgress,
  renderTransactions,
  ensureImportTransactionsDelegation,
  formatExpenseLabel,
  formatDateDisplay,
  selectAllTransactions,
  deselectAllTransactions,
  applyImportedTransactions,
  closeImportModal,
  saveImportHistory,
  renderImportHistory,
});

// ============================================================
// END STATEMENT IMPORT FEATURE
