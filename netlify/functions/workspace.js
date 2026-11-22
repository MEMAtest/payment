// ============================================================
// PAYTP — NEON POSTGRES WORKSPACE API (Netlify Function)
// Replaces Firebase with serverless Neon Postgres
// Endpoints:
//   GET  /.netlify/functions/workspace?id=<workspaceId>
//   POST /.netlify/functions/workspace  { workspaceId, financeState, transactions, holdings }
// ============================================================

const { neon } = require("@neondatabase/serverless");

function getDatabaseUrl() {
  return process.env.NETLIFY_DB_URL || process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL || "";
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS paytp_workspaces (
      workspace_id TEXT PRIMARY KEY,
      finance_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS paytp_transactions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      tx_date TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      amount NUMERIC NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'expense',
      category TEXT NOT NULL DEFAULT 'other',
      account TEXT NOT NULL DEFAULT 'Bank',
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_paytp_tx_ws ON paytp_transactions (workspace_id)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS paytp_holdings (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      ticker TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      account TEXT NOT NULL DEFAULT 'GIA',
      asset_class TEXT NOT NULL DEFAULT 'Stock',
      quantity NUMERIC NOT NULL DEFAULT 0,
      cost_basis NUMERIC NOT NULL DEFAULT 0,
      current_value NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_paytp_holdings_ws ON paytp_holdings (workspace_id)
  `;
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    return jsonResponse(503, {
      ok: false,
      configured: false,
      error: "Neon database URL not configured (NETLIFY_DATABASE_URL / DATABASE_URL).",
    });
  }

  const sql = neon(dbUrl);

  try {
    await ensureSchema(sql);

    if (event.httpMethod === "GET") {
      const workspaceId = String(event.queryStringParameters?.id || "default").trim().slice(0, 64);
      if (!workspaceId) return jsonResponse(400, { ok: false, error: "Missing workspace id" });

      const wsRows = await sql`
        SELECT finance_state, updated_at
        FROM paytp_workspaces
        WHERE workspace_id = ${workspaceId}
        LIMIT 1
      `;

      const txRows = await sql`
        SELECT id, tx_date AS date, description, amount::float8 AS amount, type, category, account, is_recurring AS "isRecurring"
        FROM paytp_transactions
        WHERE workspace_id = ${workspaceId}
        ORDER BY tx_date DESC, created_at DESC
        LIMIT 500
      `;

      const holdingRows = await sql`
        SELECT id, ticker, name, account, asset_class AS "assetClass",
               quantity::float8 AS quantity, cost_basis::float8 AS "costBasis",
               current_value::float8 AS "currentValue"
        FROM paytp_holdings
        WHERE workspace_id = ${workspaceId}
        ORDER BY current_value DESC
      `;

      return jsonResponse(200, {
        ok: true,
        configured: true,
        exists: wsRows.length > 0 || txRows.length > 0 || holdingRows.length > 0,
        workspaceId,
        financeState: wsRows[0]?.finance_state || null,
        transactions: txRows,
        holdings: holdingRows,
        updatedAt: wsRows[0]?.updated_at || null,
      });
    }

    if (event.httpMethod === "POST") {
      const payload = JSON.parse(event.body || "{}");
      const workspaceId = String(payload.workspaceId || "default").trim().slice(0, 64);
      if (!workspaceId) return jsonResponse(400, { ok: false, error: "Missing workspaceId" });

      const financeState = payload.financeState && typeof payload.financeState === "object"
        ? payload.financeState
        : {};
      const transactions = Array.isArray(payload.transactions) ? payload.transactions.slice(0, 500) : [];
      const holdings = Array.isArray(payload.holdings) ? payload.holdings.slice(0, 200) : [];

      await sql`
        INSERT INTO paytp_workspaces (workspace_id, finance_state, updated_at)
        VALUES (${workspaceId}, ${JSON.stringify(financeState)}::jsonb, NOW())
        ON CONFLICT (workspace_id)
        DO UPDATE SET finance_state = EXCLUDED.finance_state, updated_at = NOW()
      `;

      // Replace workspace transactions & holdings cleanly so deletions sync too
      await sql`DELETE FROM paytp_transactions WHERE workspace_id = ${workspaceId}`;
      for (const tx of transactions) {
        if (!tx || typeof tx !== "object" || !tx.id) continue;
        await sql`
          INSERT INTO paytp_transactions
            (id, workspace_id, tx_date, description, amount, type, category, account, is_recurring)
          VALUES (
            ${String(tx.id).slice(0, 80)},
            ${workspaceId},
            ${String(tx.date || "").slice(0, 20)},
            ${String(tx.description || "").slice(0, 140)},
            ${Math.abs(Number(tx.amount) || 0)},
            ${tx.type === "income" ? "income" : "expense"},
            ${String(tx.category || "other").slice(0, 40)},
            ${String(tx.account || "Bank").slice(0, 40)},
            ${Boolean(tx.isRecurring)}
          )
          ON CONFLICT (id) DO UPDATE SET
            tx_date = EXCLUDED.tx_date,
            description = EXCLUDED.description,
            amount = EXCLUDED.amount,
            type = EXCLUDED.type,
            category = EXCLUDED.category,
            account = EXCLUDED.account,
            is_recurring = EXCLUDED.is_recurring
        `;
      }

      await sql`DELETE FROM paytp_holdings WHERE workspace_id = ${workspaceId}`;
      for (const h of holdings) {
        if (!h || typeof h !== "object" || !h.id) continue;
        await sql`
          INSERT INTO paytp_holdings
            (id, workspace_id, ticker, name, account, asset_class, quantity, cost_basis, current_value, updated_at)
          VALUES (
            ${String(h.id).slice(0, 80)},
            ${workspaceId},
            ${String(h.ticker || "").slice(0, 20)},
            ${String(h.name || "").slice(0, 120)},
            ${String(h.account || "GIA").slice(0, 30)},
            ${String(h.assetClass || "Stock").slice(0, 30)},
            ${Math.max(0, Number(h.quantity) || 0)},
            ${Math.max(0, Number(h.costBasis) || 0)},
            ${Math.max(0, Number(h.currentValue) || 0)},
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            ticker = EXCLUDED.ticker,
            name = EXCLUDED.name,
            account = EXCLUDED.account,
            asset_class = EXCLUDED.asset_class,
            quantity = EXCLUDED.quantity,
            cost_basis = EXCLUDED.cost_basis,
            current_value = EXCLUDED.current_value,
            updated_at = NOW()
        `;
      }

      return jsonResponse(200, {
        ok: true,
        configured: true,
        workspaceId,
        savedTransactions: transactions.length,
        savedHoldings: holdings.length,
        updatedAt: new Date().toISOString(),
      });
    }

    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Neon workspace sync error:", err);
    return jsonResponse(500, { ok: false, error: err.message || "Database error" });
  }
};
