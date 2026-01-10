let container = null;

export function initToast() {
  if (container) return;

  container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
}

export function showToast(message, type = 'info', duration = 4000) {
  if (!container) initToast();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close">✕</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  const dismiss = () => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  toast.querySelector('.toast-close').addEventListener('click', dismiss);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return dismiss;
}

export function showError(message) {
  return showToast(message, 'error', 6000);
}

export function showWarning(message) {
  return showToast(message, 'warning', 5000);
}

export function showSuccess(message) {
  return showToast(message, 'success', 3000);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
