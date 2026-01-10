let permissionGranted = false;

export async function requestPermission() {
  if (!('Notification' in window)) {
    console.log('Browser notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    permissionGranted = true;
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  const result = await Notification.requestPermission();
  permissionGranted = result === 'granted';
  return permissionGranted;
}

export function canNotify() {
  return permissionGranted || Notification.permission === 'granted';
}

export function showNotification(title, options = {}) {
  if (!canNotify()) return null;

  // Don't show if document is focused
  if (document.hasFocus()) return null;

  const notification = new Notification(title, {
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    ...options
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Auto-close after 10 seconds
  setTimeout(() => notification.close(), 10000);

  return notification;
}

export function notifyPermissionRequest(toolName, sessionName) {
  return showNotification('Permission Required', {
    body: `${toolName} needs approval in ${sessionName}`,
    tag: 'permission-request',
    requireInteraction: true
  });
}

export function notifyError(error, sessionName) {
  return showNotification('Session Error', {
    body: `${sessionName}: ${error}`,
    tag: 'session-error'
  });
}

export function notifySessionComplete(sessionName) {
  return showNotification('Session Idle', {
    body: `${sessionName} is waiting for input`,
    tag: 'session-complete'
  });
}
