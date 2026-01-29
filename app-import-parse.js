// Statement import parsing utilities (extracted from app-import.js)
const MERCHANT_CATEGORIES = {
  // Groceries
  tesco: "groceries", sainsburys: "groceries", asda: "groceries", aldi: "groceries",
  lidl: "groceries", morrisons: "groceries", waitrose: "groceries", coop: "groceries",
  iceland: "groceries", ocado: "groceries", marks: "groceries",

  // Dining
  mcdonalds: "diningOut", "mcdonald's": "diningOut", "burger king": "diningOut",
  kfc: "diningOut", subway: "diningOut", nandos: "diningOut", "nando's": "diningOut",
  starbucks: "coffeeSnacks", costa: "coffeeSnacks", pret: "coffeeSnacks",
  greggs: "coffeeSnacks", deliveroo: "diningOut", "uber eats": "diningOut",
  "just eat": "diningOut",

  // Transport
  uber: "publicTransport", bolt: "publicTransport", tfl: "publicTransport",
  oyster: "publicTransport", trainline: "publicTransport", national: "publicTransport",
  shell: "fuel", bp: "fuel", esso: "fuel", texaco: "fuel", "ev charging": "fuel",
  tesla: "fuel", gridserve: "fuel", ionity: "fuel",

  // Utilities
  british: "energy", edf: "energy", octopus: "energy", ovo: "energy",
  bulb: "energy", scottish: "energy", sse: "energy", "e.on": "energy",
  thames: "water", severn: "water", united: "water", anglian: "water",
  bt: "internet", sky: "internet", virgin: "internet", ee: "internet",
  vodafone: "internet", three: "internet", o2: "internet", plusnet: "internet",
  netflix: "streaming", spotify: "streaming", apple: "streaming", disney: "streaming",
  "prime video": "streaming", youtube: "streaming",

  // Housing
  rightmove: "mortgage", zoopla: "mortgage", "direct debit": "mortgage",
  council: "councilTax", aviva: "homeInsurance", "direct line": "homeInsurance",

  // Personal & Shopping
  amazon: "entertainment", ebay: "entertainment", argos: "entertainment",
  john: "clothing", next: "clothing", primark: "clothing", asos: "clothing",
  zara: "clothing", "h&m": "clothing", boots: "personalCare", superdrug: "personalCare",
  gym: "gym", puregym: "gym", "the gym": "gym", nuffield: "gym", david: "gym",

  // Subscriptions
  subscription: "subscriptions", membership: "subscriptions", monthly: "subscriptions",

  // Family
  nursery: "childcare", childminder: "childcare", childcare: "childcare",
  school: "schoolCosts", uniform: "schoolCosts",

  // Debt
  loan: "personalLoans", credit: "creditCards", barclaycard: "creditCards",
  amex: "creditCards", "american express": "creditCards",
};

// UK Bank CSV formats
const BANK_FORMATS = {
  monzo: {
    dateCol: "Date",
    descCol: "Name",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  starling: {
    dateCol: "Date",
    descCol: "Counter Party",
    amountCol: "Amount (GBP)",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  hsbc: {
    dateCol: "Date",
    descCol: "Description",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  barclays: {
    dateCol: "Date",
    descCol: "Memo",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  natwest: {
    dateCol: "Date",
    descCol: "Description",
    amountCol: "Value",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  lloyds: {
    dateCol: "Transaction Date",
    descCol: "Transaction Description",
    debitCol: "Debit Amount",
    creditCol: "Credit Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  santander: {
    dateCol: "Date",
    descCol: "Description",
    amountCol: "Amount",
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  },
  revolut: {
    dateCol: "Started Date",
    descCol: "Description",
    amountCol: "Amount",
    dateFormat: "YYYY-MM-DD",
    delimiter: ","
  }
};

// Current import state
let importedTransactions = [];
let currentFilter = "all";
let importTransactionsDelegationAttached = false;

// Initialize import functionality
async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          resolve([]);
          return;
        }

        // Detect bank format from headers
        const headers = parseCSVLine(lines[0]).map((h) => String(h || "").trim());
        if (headers.length < 2) {
          reject(new Error("CSV header row is missing or invalid"));
          return;
        }
        const format = detectBankFormat(headers);
        if (!format || !format.dateCol || !format.descCol) {
          reject(new Error("Unable to detect required CSV columns"));
          return;
        }

        const requiredColumns = [format.dateCol, format.descCol].filter(Boolean);
        if (format.creditCol) requiredColumns.push(format.creditCol);
        if (format.debitCol) requiredColumns.push(format.debitCol);
        if (!format.creditCol && !format.debitCol && format.amountCol) {
          requiredColumns.push(format.amountCol);
        }

        const headerIndex = new Map(headers.map((h, idx) => [h, idx]));
        const missingColumns = requiredColumns.filter((col) => !headerIndex.has(col));
        if (missingColumns.length > 0) {
          reject(new Error(`CSV missing required column(s): ${missingColumns.join(", ")}`));
          return;
        }

        const maxRequiredIndex = requiredColumns.reduce((max, col) => {
          const idx = headerIndex.get(col);
          return idx > max ? idx : max;
        }, 0);

        updateProgress(20, "Detected format, parsing transactions...");

        const transactions = [];
        let skippedRows = 0;
        let skippedInvalid = 0;
        for (let i = 1; i < lines.length; i++) {
          // Throttle progress updates (every 50 rows) to prevent UI freeze
          if (i % 50 === 0 || i === lines.length - 1) {
            updateProgress(20 + (i / lines.length) * 60, `Parsing row ${i} of ${lines.length - 1}...`);
          }

          const values = parseCSVLine(lines[i]);
          if (values.length <= maxRequiredIndex) {
            skippedRows++;
            continue;
          }

          const row = {};
          headers.forEach((h, idx) => {
            row[h.trim()] = values[idx]?.trim() || "";
          });

          const tx = extractTransaction(row, format);
          if (!tx) {
            skippedInvalid++;
            continue;
          }
          if (tx.amount !== 0) transactions.push(tx);
        }

        if (skippedRows > 0) {
          showNotification(`${skippedRows} row(s) skipped due to missing columns.`, "warning");
        }
        if (skippedInvalid > 0) {
          showNotification(`${skippedInvalid} row(s) skipped due to invalid data.`, "warning");
        }

        updateProgress(90, "Finalizing...");
        resolve(transactions);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// Parse CSV line handling quoted values and escaped quotes (RFC 4180 compliant)
function parseCSVLine(line, maxFieldLength = 10000) {
  if (!line || typeof line !== 'string') return [];

  // Limit line length to prevent DoS
  if (line.length > 100000) {
    console.warn('CSV line too long, truncating');
    line = line.substring(0, 100000);
  }

  const result = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\t') {
        // Trim and limit field length
        result.push(current.trim().substring(0, maxFieldLength));
        current = "";
      } else if (char !== '\r') {
        current += char;
      }
    }
    i++;
  }

  // Add the last field
  result.push(current.trim().substring(0, maxFieldLength));
  return result;
}

// Detect bank format from CSV headers
function detectBankFormat(headers) {
  const headerStr = headers.join(",").toLowerCase();

  if (headerStr.includes("counter party")) return BANK_FORMATS.starling;
  if (headerStr.includes("started date")) return BANK_FORMATS.revolut;
  if (headerStr.includes("transaction description") && headerStr.includes("debit amount")) return BANK_FORMATS.lloyds;
  if (headerStr.includes("memo")) return BANK_FORMATS.barclays;
  if (headerStr.includes("value") && headerStr.includes("date")) return BANK_FORMATS.natwest;

  // Default generic format
  return {
    dateCol: headers.find((h) => h.toLowerCase().includes("date")) || headers[0],
    descCol: headers.find((h) => h.toLowerCase().includes("desc") || h.toLowerCase().includes("name") || h.toLowerCase().includes("memo")) || headers[1],
    amountCol: headers.find((h) => h.toLowerCase().includes("amount") || h.toLowerCase().includes("value")) || headers[2],
    dateFormat: "DD/MM/YYYY",
    delimiter: ","
  };
}

// Extract transaction from row
function extractTransaction(row, format) {
  const rawDate = row[format.dateCol] ?? Object.values(row)[0];
  const rawDesc = row[format.descCol] ?? Object.values(row)[1];
  const dateText = rawDate == null ? "" : String(rawDate).trim();
  const descText = rawDesc == null ? "" : String(rawDesc).trim();
  let amount = 0;

  const parseAmount = (value) => {
    const numeric = parseFloat(String(value ?? "").replace(/[£,]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  // Handle separate debit/credit columns (Lloyds)
  if (format.creditCol && format.debitCol) {
    const credit = parseAmount(row[format.creditCol]);
    const debit = parseAmount(row[format.debitCol]);
    amount = credit - debit;
  } else if (format.debitCol && !format.creditCol) {
    // Only debit column - treat as expense (negative)
    amount = -parseAmount(row[format.debitCol]);
  } else if (format.creditCol && !format.debitCol) {
    // Only credit column - treat as income (positive)
    amount = parseAmount(row[format.creditCol]);
  } else {
    amount = parseAmount(row[format.amountCol]);
  }

  // Parse date
  const parsedDate = parseDate(dateText, { fallbackToToday: false });
  if (!parsedDate) return null;

  return {
    id: generateSecureId('tx'),
    date: parsedDate,
    description: descText,
    amount: amount,
    type: amount >= 0 ? "income" : "expense",
    category: null,
    isRecurring: false,
    selected: true
  };
}

// Parse date from various formats
function parseDate(dateStr, { fallbackToToday = true } = {}) {
  const fallback = fallbackToToday ? new Date().toISOString().split("T")[0] : null;
  if (!dateStr) return fallback;

  const value = String(dateStr).trim();
  if (!value) return fallback;

  // Try common UK format DD/MM/YYYY
  const ukMatch = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (ukMatch) {
    const day = ukMatch[1].padStart(2, "0");
    const month = ukMatch[2].padStart(2, "0");
    let year = ukMatch[3];
    if (year.length === 2) year = "20" + year;
    const candidate = `${year}-${month}-${day}`;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? fallback : candidate;
  }

  // Try ISO format YYYY-MM-DD
  const isoMatch = value.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (isoMatch) {
    const candidate = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
    const parsed = new Date(candidate);
    return Number.isNaN(parsed.getTime()) ? fallback : candidate;
  }

  // Fallback
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().split("T")[0];
}

// Parse Excel file
async function parseExcel(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === "undefined") {
      reject(new Error("Excel parsing library not loaded"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        updateProgress(20, "Reading Excel file...");

        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });

        updateProgress(40, "Parsing sheets...");

        const transactions = [];
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          resolve([]);
          return;
        }

        const headers = rows[0].map((h) => String(h || ""));
        const format = detectBankFormat(headers);

        for (let i = 1; i < rows.length; i++) {
          updateProgress(40 + (i / rows.length) * 50, `Processing row ${i}...`);

          const row = {};
          headers.forEach((h, idx) => {
            row[h] = rows[i][idx] !== undefined ? String(rows[i][idx]) : "";
          });

          const tx = extractTransaction(row, format);
          if (tx && tx.amount !== 0) {
            transactions.push(tx);
          }
        }

        resolve(transactions);

      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read Excel file"));
    reader.readAsArrayBuffer(file);
  });
}

// Parse PDF file (handles unstructured PDFs like Virgin Media bills)
async function parsePDF(file) {
  return new Promise(async (resolve, reject) => {
    if (typeof pdfjsLib === "undefined") {
      reject(new Error("PDF parsing library not loaded"));
      return;
    }

    try {
      updateProgress(10, "Loading PDF...");

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      updateProgress(30, "Extracting text...");

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        updateProgress(30 + (i / pdf.numPages) * 40, `Reading page ${i} of ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      updateProgress(75, "Extracting transactions...");

      // Extract transactions using pattern matching
      const transactions = extractTransactionsFromText(fullText);

      updateProgress(95, "Finalizing...");
      resolve(transactions);

    } catch (err) {
      reject(err);
    }
  });
}

// Extract transactions from unstructured text (for PDFs like Virgin Media)
function extractTransactionsFromText(text) {
  const transactions = [];

  // Pattern for amounts: £X,XXX.XX or £X.XX or -£X.XX
  const amountPattern = /[-]?£[\d,]+\.?\d{0,2}/g;

  // Pattern for dates
  const datePattern = /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g;

  // Find all amounts
  const amounts = text.match(amountPattern) || [];
  const dates = text.match(datePattern) || [];

  // Extract lines that contain amounts
  const lines = text.split(/\n|\r/).filter((line) => amountPattern.test(line));

  lines.forEach((line, idx) => {
    const lineAmounts = line.match(amountPattern);
    if (!lineAmounts || lineAmounts.length === 0) return;

    // Get the primary amount (usually the last one on the line)
    const amountStr = lineAmounts[lineAmounts.length - 1];
    const amount = parseFloat(amountStr.replace(/[£,]/g, "")) || 0;

    if (amount === 0) return;

    // Extract description (text before the amount)
    let desc = line.replace(amountPattern, "").trim();
    desc = desc.replace(datePattern, "").trim();
    desc = desc.replace(/\s+/g, " ").trim();

    // Skip very short or numeric-only descriptions
    if (desc.length < 3 || /^\d+$/.test(desc)) {
      desc = "Unknown Transaction";
    }

    // Try to find a date in this line or nearby
    const lineDates = line.match(datePattern);
    const dateStr = lineDates ? lineDates[0] : (dates[idx] || null);

    transactions.push({
      id: generateSecureId('pdf'),
      date: parseDate(dateStr),
      description: desc.substring(0, 100),
      amount: amount,
      type: amount >= 0 ? "income" : "expense",
      category: null,
      isRecurring: false,
      selected: true
    });
  });

  // Remove duplicates
  const seen = new Set();
  return transactions.filter((tx) => {
    const key = `${tx.date}-${tx.amount}-${tx.description.substring(0, 20)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Categorize transactions using merchant mapping
function categorizeTransactions(transactions) {
  return transactions.map((tx) => {
    const descLower = tx.description.toLowerCase();

    for (const [keyword, category] of Object.entries(MERCHANT_CATEGORIES)) {
      if (descLower.includes(keyword)) {
        tx.category = category;
        break;
      }
    }

    return tx;
  });
}

// Detect recurring payments
function detectRecurringPayments(transactions) {
  // Group by similar descriptions
  const groups = {};

  transactions.forEach((tx) => {
    // Normalize description for grouping
    const normalized = tx.description.toLowerCase()
      .replace(/\d+/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 30);

    if (!groups[normalized]) {
      groups[normalized] = [];
    }
    groups[normalized].push(tx);
  });

  // Mark as recurring if similar transaction appears 2+ times with similar amounts
  Object.values(groups).forEach((group) => {
    if (group.length >= 2) {
      // Check if amounts are similar (within 10%)
      const amounts = group.map((tx) => Math.abs(tx.amount));
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      // Guard against division by zero
      const allSimilar = avg > 0 && amounts.every((a) => Math.abs(a - avg) / avg < 0.1);

      if (allSimilar) {
        group.forEach((tx) => {
          tx.isRecurring = true;
        });
      }
    }
  });

  return transactions;
}

// Update import summary stats
function updateImportSummary() {
  const total = importedTransactions.length;
  const income = importedTransactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expense = importedTransactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const recurring = importedTransactions.filter((tx) => tx.isRecurring).length;

  const totalEl = document.querySelector("[data-import-total]");
  const incomeEl = document.querySelector("[data-import-income]");
  const expenseEl = document.querySelector("[data-import-expense]");
  const recurringEl = document.querySelector("[data-import-recurring]");

  if (totalEl) totalEl.textContent = total;
  if (incomeEl) incomeEl.textContent = formatCurrency(income);
  if (expenseEl) expenseEl.textContent = formatCurrency(expense);
  if (recurringEl) recurringEl.textContent = recurring;
}

// Expose import parsing functions and state globally for cross-module access
Object.assign(window, {
  // Shared state
  get importedTransactions() { return importedTransactions; },
  set importedTransactions(val) { importedTransactions = val; },
  get currentFilter() { return currentFilter; },
  set currentFilter(val) { currentFilter = val; },
  get importTransactionsDelegationAttached() { return importTransactionsDelegationAttached; },
  set importTransactionsDelegationAttached(val) { importTransactionsDelegationAttached = val; },
  // Parsing functions
  parseCSV,
  parseCSVLine,
  detectBankFormat,
  extractTransaction,
  parseDate,
  parseExcel,
  parsePDF,
  extractTransactionsFromText,
  categorizeTransactions,
  detectRecurringPayments,
  updateImportSummary,
  MERCHANT_CATEGORIES,
  BANK_FORMATS,
});
