// ============================================================
// INPUT VALIDATION & ACCESSIBILITY HELPERS
// ============================================================

const VALIDATION_LIMITS = {
  salary: { min: 0, max: 10000000 },      // Max £10M salary
  expense: { min: 0, max: 100000 },       // Max £100K per expense
  amount: { min: 0, max: 10000000 },      // General amount max £10M
  percentage: { min: 0, max: 100 },
  months: { min: 1, max: 600 },           // Max 50 years
  dueDay: { min: 1, max: 31 },
  interestRate: { min: 0, max: 100 },
  name: { minLength: 1, maxLength: 100 },
  description: { minLength: 0, maxLength: 500 },
};

// Validate and sanitize numeric input
function validateNumericInput(value, type = "amount") {
  const limits = VALIDATION_LIMITS[type] || VALIDATION_LIMITS.amount;
  const num = parseFloat(value);

  if (Number.isNaN(num)) {
    return { valid: false, value: 0, error: "Please enter a valid number" };
  }

  if (num < limits.min) {
    return {
      valid: false,
      value: limits.min,
      error: `Value cannot be less than ${limits.min}`,
    };
  }

  if (num > limits.max) {
    return {
      valid: false,
      value: limits.max,
      error: `Value cannot exceed ${formatCurrency(limits.max)}`,
    };
  }

  return { valid: true, value: num, error: null };
}

// Validate string input
function validateStringInput(value, type = "name") {
  const limits = VALIDATION_LIMITS[type] || VALIDATION_LIMITS.name;
  const str = String(value || "").trim();

  if (str.length < limits.minLength) {
    return {
      valid: false,
      value: str,
      error: `Please enter at least ${limits.minLength} character(s)`,
    };
  }

  if (str.length > limits.maxLength) {
    return {
      valid: false,
      value: str.substring(0, limits.maxLength),
      error: `Text is too long (max ${limits.maxLength} characters)`,
    };
  }

  return { valid: true, value: str, error: null };
}

// Setup input validation with live feedback
function setupInputValidation(input, type, showFeedback = true) {
  if (!input) return;

  const limits = VALIDATION_LIMITS[type] || VALIDATION_LIMITS.amount;

  // Set HTML5 validation attributes
  if (limits.min !== undefined) input.min = limits.min;
  if (limits.max !== undefined) input.max = limits.max;
  if (limits.maxLength !== undefined) input.maxLength = limits.maxLength;

  // Add validation feedback
  if (showFeedback) {
    input.addEventListener("input", () => {
      const validation = input.type === "number"
        ? validateNumericInput(input.value, type)
        : validateStringInput(input.value, type);

      if (!validation.valid && validation.error) {
        input.setCustomValidity(validation.error);
        input.classList.add("input-invalid");
        input.setAttribute("aria-invalid", "true");
      } else {
        input.setCustomValidity("");
        input.classList.remove("input-invalid");
        input.setAttribute("aria-invalid", "false");
      }
    });
  }
}

// ============================================================
// ACCESSIBILITY HELPERS
// ============================================================

// Announce message to screen readers
function announceToScreenReader(message, priority = "polite") {
  const announcer = document.getElementById("sr-announcer") || createScreenReaderAnnouncer();
  announcer.setAttribute("aria-live", priority);
  announcer.textContent = message;

  // Clear after announcement
  setTimeout(() => {
    announcer.textContent = "";
  }, 1000);
}

function createScreenReaderAnnouncer() {
  const announcer = document.createElement("div");
  announcer.id = "sr-announcer";
  announcer.className = "sr-only";
  announcer.setAttribute("aria-live", "polite");
  announcer.setAttribute("aria-atomic", "true");
  document.body.appendChild(announcer);
  return announcer;
}

// Trap focus within a modal/dialog
function trapFocus(element) {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  function handleTabKey(e) {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else if (document.activeElement === lastFocusable) {
      firstFocusable.focus();
      e.preventDefault();
    }
  }

  element.addEventListener("keydown", handleTabKey);
  return () => element.removeEventListener("keydown", handleTabKey);
}
