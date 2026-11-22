CREATE TABLE IF NOT EXISTS paytp_workspaces (
  workspace_id TEXT PRIMARY KEY,
  finance_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
);

CREATE INDEX IF NOT EXISTS idx_paytp_tx_ws ON paytp_transactions (workspace_id);

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
);

CREATE INDEX IF NOT EXISTS idx_paytp_holdings_ws ON paytp_holdings (workspace_id);
