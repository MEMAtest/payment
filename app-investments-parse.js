// ============================================================
// INVESTMENT STATEMENT / BROKERAGE CSV PARSER
// Supports: Trading 212, Vanguard UK, Hargreaves Lansdown,
// Freetrade, Interactive Investor, and Generic Holdings CSVs.
// ============================================================

(function () {
  const ASSET_CLASS_KEYWORDS = [
    { match: /\b(etf|ucits|vusa|vwrl|vwrp|eqqq|iwda|swda|cspx|sp500|s&p|ftse|msci|ishares|vanguard|invesco|lyxor|xtrackers)\b/i, assetClass: "ETF" },
    { match: /\b(fund|lifestrategy|index|accumulation|income|oeic|unit trust|fidelity|fundsmith|baillie)\b/i, assetClass: "Fund" },
    { match: /\b(bond|gilt|treasury|fixed income|corporate bond)\b/i, assetClass: "Bond" },
    { match: /\b(btc|eth|sol|crypto|bitcoin|ethereum|coinbase|binance|usdc|usdt)\b/i, assetClass: "Crypto" },
    { match: /\b(cash|gbp|usd|eur|money market|savings)\b/i, assetClass: "Cash" },
  ];

  function inferAssetClass(name, ticker, rawType) {
    const combined = `${name || ""} ${ticker || ""} ${rawType || ""}`.trim();
    for (const rule of ASSET_CLASS_KEYWORDS) {
      if (rule.match.test(combined)) return rule.assetClass;
    }
    return "Stock";
  }

  function inferAccountType(rawAccount, fileName) {
    const text = `${rawAccount || ""} ${fileName || ""}`.toLowerCase();
    if (text.includes("sipp") || text.includes("pension")) return "SIPP";
    if (text.includes("lisa")) return "LISA";
    if (text.includes("isa")) return "ISA";
    if (text.includes("crypto") || text.includes("coinbase") || text.includes("kraken")) return "Crypto";
    if (text.includes("cash") || text.includes("saving")) return "Cash";
    return "GIA";
  }

  function parseNumeric(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const cleaned = String(value ?? "")
      .replace(/[£$€,\s%]/g, "")
      .replace(/\(([^)]+)\)/, "-$1")
      .trim();
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function findColumn(headers, patterns) {
    for (const pattern of patterns) {
      const found = headers.find((h) => pattern.test(h));
      if (found) return found;
    }
    return null;
  }

  function detectBrokerFormat(headers) {
    const joined = headers.join(" | ").toLowerCase();
    if (joined.includes("action") && joined.includes("ticker") && joined.includes("no. of shares")) {
      return "trading212";
    }
    if (joined.includes("investment name") && (joined.includes("units") || joined.includes("quantity"))) {
      return "vanguard";
    }
    if (joined.includes("stock") && joined.includes("value (£)")) {
      return "hl";
    }
    if (joined.includes("ticker") && joined.includes("title") && joined.includes("type")) {
      return "freetrade";
    }
    return "generic";
  }

  function parseInvestmentCSVText(text, fileName = "") {
    const rawLines = String(text || "").split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length < 2) {
      return { broker: "unknown", holdings: [], skipped: 0 };
    }

    const lineParser = typeof window.parseCSVLine === "function"
      ? window.parseCSVLine
      : (line) => line.split(",").map((s) => s.replace(/^"|"$/g, "").trim());

    // Skip metadata preamble lines common in HL/Vanguard exports until header row
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rawLines.length, 12); i++) {
      const cols = lineParser(rawLines[i]).map((c) => c.toLowerCase());
      const hits = cols.filter((c) =>
        /(ticker|symbol|stock|name|investment|asset|security|title|quantity|shares|units|value|cost|price|amount|total)/i.test(c)
      ).length;
      if (hits >= 2) {
        headerIdx = i;
        break;
      }
    }

    const headers = lineParser(rawLines[headerIdx]).map((h) => String(h || "").trim());
    const broker = detectBrokerFormat(headers);

    const rows = [];
    for (let i = headerIdx + 1; i < rawLines.length; i++) {
      const values = lineParser(rawLines[i]);
      if (values.length < 2) continue;
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] !== undefined ? String(values[idx]).trim() : "";
      });
      rows.push(row);
    }

    // Trading 212 / Freetrade activity log aggregation (Buy/Sell rows -> net holdings)
    if (broker === "trading212" || broker === "freetrade") {
      return aggregateActivityRows(rows, headers, broker, fileName);
    }

    // Snapshot / Holdings table (Vanguard, HL, Generic)
    return parseHoldingsRows(rows, headers, broker, fileName);
  }

  function aggregateActivityRows(rows, headers, broker, fileName) {
    const actionCol = findColumn(headers, [/^action$/i, /^type$/i, /order type/i]);
    const tickerCol = findColumn(headers, [/^ticker$/i, /^symbol$/i, /^isin$/i]);
    const nameCol = findColumn(headers, [/^name$/i, /^title$/i, /investment/i, /security/i]);
    const qtyCol = findColumn(headers, [/no\.?\s*of\s*shares/i, /^quantity$/i, /^shares$/i, /^units$/i]);
    const totalCol = findColumn(headers, [/^total/i, /total\s*\(gbp\)/i, /^amount/i, /net amount/i]);
    const priceCol = findColumn(headers, [/price\s*\/\s*share/i, /price per share/i, /^price$/i]);

    const map = new Map();
    let skipped = 0;

    for (const row of rows) {
      const action = String(row[actionCol] || "").toLowerCase();
      const isBuy = action.includes("buy");
      const isSell = action.includes("sell");
      if (!isBuy && !isSell) {
        skipped++;
        continue;
      }

      const ticker = String(row[tickerCol] || "").trim().toUpperCase();
      const name = String(row[nameCol] || ticker || "").trim();
      if (!name && !ticker) {
        skipped++;
        continue;
      }

      const qty = Math.abs(parseNumeric(row[qtyCol]));
      const price = Math.abs(parseNumeric(row[priceCol]));
      let total = Math.abs(parseNumeric(row[totalCol]));
      if (total === 0 && qty > 0 && price > 0) total = qty * price;
      if (qty === 0 && total === 0) {
        skipped++;
        continue;
      }

      const key = ticker || name.toUpperCase();
      if (!map.has(key)) {
        map.set(key, {
          ticker: ticker || name.slice(0, 6).toUpperCase(),
          name: name || ticker,
          account: inferAccountType("", fileName),
          assetClass: inferAssetClass(name, ticker, ""),
          quantity: 0,
          costBasis: 0,
          lastPrice: price,
        });
      }

      const item = map.get(key);
      if (price > 0) item.lastPrice = price;

      if (isBuy) {
        item.quantity += qty;
        item.costBasis += total;
      } else if (isSell) {
        const ratio = item.quantity > 0 ? Math.min(1, qty / item.quantity) : 1;
        item.quantity = Math.max(0, item.quantity - qty);
        item.costBasis = Math.max(0, item.costBasis * (1 - ratio));
      }
    }

    const holdings = [];
    for (const item of map.values()) {
      if (item.quantity <= 0.00001 && item.costBasis <= 0.01) continue;
      const estimatedValue =
        item.lastPrice > 0 && item.quantity > 0
          ? item.quantity * item.lastPrice
          : item.costBasis;
      holdings.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ticker: item.ticker,
        name: item.name,
        account: item.account,
        assetClass: item.assetClass,
        quantity: Number(item.quantity.toFixed(6)),
        costBasis: Number(item.costBasis.toFixed(2)),
        currentValue: Number(estimatedValue.toFixed(2)),
        notes: `Imported from ${broker === "trading212" ? "Trading 212" : "Freetrade"}`,
        selected: true,
      });
    }

    return {
      broker: broker === "trading212" ? "Trading 212" : "Freetrade",
      holdings,
      skipped,
    };
  }

  function parseHoldingsRows(rows, headers, broker, fileName) {
    const tickerCol = findColumn(headers, [/^ticker$/i, /^symbol$/i, /^code$/i, /^epic$/i, /^isin$/i]);
    const nameCol = findColumn(headers, [/investment\s*name/i, /^name$/i, /^stock$/i, /^holding$/i, /^security$/i, /^asset$/i, /^description$/i]);
    const accountCol = findColumn(headers, [/^account/i, /^wrapper/i, /^portfolio/i]);
    const classCol = findColumn(headers, [/asset\s*class/i, /^category$/i, /^type$/i]);
    const qtyCol = findColumn(headers, [/^quantity$/i, /^units$/i, /^shares$/i, /^qty$/i, /no\.?\s*of\s*shares/i]);
    const costCol = findColumn(headers, [/cost\s*basis/i, /book\s*cost/i, /total\s*cost/i, /^cost/i, /invested/i, /amount\s*invested/i]);
    const avgCostCol = findColumn(headers, [/avg\.?\s*cost/i, /average\s*price/i, /unit\s*cost/i]);
    const valueCol = findColumn(headers, [/current\s*value/i, /market\s*value/i, /^value/i, /^valuation/i, /^balance$/i, /^total$/i]);
    const priceCol = findColumn(headers, [/current\s*price/i, /^price/i, /last\s*price/i]);

    const holdings = [];
    let skipped = 0;

    for (const row of rows) {
      const name = String(row[nameCol] || row[tickerCol] || "").trim();
      const ticker = String(row[tickerCol] || "").trim().toUpperCase();
      if (!name || /^(total|subtotal|summary)$/i.test(name)) {
        skipped++;
        continue;
      }

      const quantity = qtyCol ? parseNumeric(row[qtyCol]) : 0;
      const price = priceCol ? parseNumeric(row[priceCol]) : 0;
      let currentValue = valueCol ? parseNumeric(row[valueCol]) : 0;
      if (currentValue === 0 && quantity > 0 && price > 0) {
        currentValue = quantity * price;
      }

      let costBasis = costCol ? parseNumeric(row[costCol]) : 0;
      if (costBasis === 0 && avgCostCol && quantity > 0) {
        costBasis = parseNumeric(row[avgCostCol]) * quantity;
      }
      if (costBasis === 0 && currentValue > 0) {
        costBasis = currentValue;
      }

      if (currentValue === 0 && costBasis === 0) {
        skipped++;
        continue;
      }

      const rawAccount = accountCol ? row[accountCol] : "";
      const rawClass = classCol ? row[classCol] : "";

      holdings.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ticker: ticker || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase(),
        name,
        account: inferAccountType(rawAccount, fileName),
        assetClass: ["ETF", "Stock", "Fund", "Bond", "Crypto", "Cash"].includes(rawClass)
          ? rawClass
          : inferAssetClass(name, ticker, rawClass),
        quantity: Number(quantity.toFixed(6)),
        costBasis: Number(costBasis.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        notes: broker === "generic" ? "Imported CSV" : `Imported from ${broker.toUpperCase()}`,
        selected: true,
      });
    }

    const brokerLabels = {
      vanguard: "Vanguard",
      hl: "Hargreaves Lansdown",
      generic: "CSV Portfolio",
    };

    return {
      broker: brokerLabels[broker] || "CSV Portfolio",
      holdings,
      skipped,
    };
  }

  async function parseInvestmentFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = parseInvestmentCSVText(e.target.result, file.name);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Could not read investment file"));
      reader.readAsText(file);
    });
  }

  window.InvestmentParser = {
    parseInvestmentCSVText,
    parseInvestmentFile,
    inferAssetClass,
    inferAccountType,
  };
})();
