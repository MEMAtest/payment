// ============================================================
// NOTIFICATIONS & CONFIRMATION MODAL
// ============================================================

// Notification container - created lazily
let notificationContainer = null;

function getNotificationContainer() {
  if (!notificationContainer) {
    notificationContainer = document.createElement("div");
    notificationContainer.className = "notification-container";
    notificationContainer.setAttribute("role", "alert");
    notificationContainer.setAttribute("aria-live", "polite");
    document.body.appendChild(notificationContainer);
  }
  return notificationContainer;
}

// Show toast notification (replaces alert() for non-blocking messages)
function showNotification(message, type = "info", duration = 4000) {
  const container = getNotificationContainer();

  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.setAttribute("role", "status");

  const iconMap = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  notification.innerHTML = `
    <span class="notification-icon" aria-hidden="true">${iconMap[type] || "ℹ"}</span>
    <span class="notification-message">${escapeHtml(message)}</span>
    <button class="notification-close" type="button" aria-label="Close notification">×</button>
  `;

  container.appendChild(notification);

  // Trigger animation
  requestAnimationFrame(() => {
    notification.classList.add("notification-show");
  });

  // Close button handler
  const closeBtn = notification.querySelector(".notification-close");
  const closeNotification = () => {
    notification.classList.remove("notification-show");
    notification.classList.add("notification-hide");
    setTimeout(() => notification.remove(), 300);
  };

  closeBtn?.addEventListener("click", closeNotification);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(closeNotification, duration);
  }

  return notification;
}

// Confirmation modal (replaces confirm())
let confirmationModal = null;
let confirmationResolve = null;

function createConfirmationModal() {
  if (confirmationModal) return confirmationModal;

  confirmationModal = document.createElement("div");
  confirmationModal.className = "confirmation-modal-overlay";
  confirmationModal.hidden = true;
  confirmationModal.setAttribute("role", "dialog");
  confirmationModal.setAttribute("aria-modal", "true");
  confirmationModal.setAttribute("aria-labelledby", "confirm-title");

  confirmationModal.innerHTML = `
    <div class="confirmation-modal" role="document">
      <h3 id="confirm-title" class="confirmation-title">Confirm Action</h3>
      <p class="confirmation-message" data-confirm-message></p>
      <div class="confirmation-actions">
        <button class="btn ghost" type="button" data-confirm-cancel>Cancel</button>
        <button class="btn primary" type="button" data-confirm-ok>Confirm</button>
      </div>
    </div>
  `;

  document.body.appendChild(confirmationModal);

  // Event handlers
  const cancelBtn = confirmationModal.querySelector("[data-confirm-cancel]");
  const okBtn = confirmationModal.querySelector("[data-confirm-ok]");
  const overlay = confirmationModal;

  cancelBtn?.addEventListener("click", () => {
    hideConfirmationModal(false);
  });

  okBtn?.addEventListener("click", () => {
    hideConfirmationModal(true);
  });

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      hideConfirmationModal(false);
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && confirmationModal && !confirmationModal.hidden) {
      hideConfirmationModal(false);
    }
  });

  return confirmationModal;
}

function hideConfirmationModal(result) {
  if (confirmationModal) {
    confirmationModal.hidden = true;
  }
  if (confirmationResolve) {
    confirmationResolve(result);
    confirmationResolve = null;
  }
}

// Promise-based confirmation dialog
function showConfirmation(
  message,
  title = "Confirm Action",
  confirmText = "Confirm",
  cancelText = "Cancel",
) {
  return new Promise((resolve) => {
    const modal = createConfirmationModal();
    confirmationResolve = resolve;

    const messageEl = modal.querySelector("[data-confirm-message]");
    const titleEl = modal.querySelector(".confirmation-title");
    const okBtn = modal.querySelector("[data-confirm-ok]");
    const cancelBtn = modal.querySelector("[data-confirm-cancel]");

    if (messageEl) messageEl.textContent = message;
    if (titleEl) titleEl.textContent = title;
    if (okBtn) okBtn.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;

    modal.hidden = false;

    // Focus the cancel button for safety
    setTimeout(() => cancelBtn?.focus(), 50);
  });
}

// Expose notification functions globally for cross-module access
Object.assign(window, {
  showNotification,
  showConfirmation,
});
