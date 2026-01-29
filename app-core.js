// Core shared utilities for Poapyments.
// Keep this file small and dependency-free so it can load early.

const __currencyFormatterCache = new Map();

function __getCurrencyFormatter(currency, decimals) {
  const safeCurrency = currency || "GBP";
  const safeDecimals = Number.isFinite(Number(decimals)) ? Number(decimals) : 0;
  const key = `${safeCurrency}:${safeDecimals}`;
  let formatter = __currencyFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: safeDecimals,
    });
    __currencyFormatterCache.set(key, formatter);
  }
  return formatter;
}

function formatCurrency(value, currency = "GBP", decimals = 0) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return __getCurrencyFormatter(currency, decimals).format(safeValue);
}

function formatSignedNumber(value) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const sign = safeValue > 0 ? "+" : safeValue < 0 ? "-" : "";
  return `${sign}${Math.abs(safeValue)}`;
}

function formatSignedCurrency(value, currency = "GBP") {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  const sign = safeValue > 0 ? "+" : safeValue < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(safeValue), currency, 0)}`;
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const __htmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text) {
  const value = text == null ? "" : String(text);
  return value.replace(/[&<>"']/g, (char) => __htmlEscapeMap[char]);
}

function setTextAll(selector, value) {
  const text = value == null ? "" : String(value);
  document.querySelectorAll(selector).forEach((el) => {
    el.textContent = text;
  });
}

function generateSecureId(prefix = "") {
  if (window.crypto && window.crypto.randomUUID) {
    return prefix ? `${prefix}-${window.crypto.randomUUID()}` : window.crypto.randomUUID();
  }
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    return prefix ? `${prefix}-${hex}` : hex;
  }
  throw new Error("Secure random generation not available. Please use a modern browser.");
}

// Explicitly expose core helpers for clarity across dynamically loaded scripts.
Object.assign(window, {
  formatCurrency,
  formatSignedNumber,
  formatSignedCurrency,
  formatTimestamp,
  escapeHtml,
  setTextAll,
  generateSecureId,
});

