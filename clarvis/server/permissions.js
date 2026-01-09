import { broadcast } from './ws-hub.js';

const pendingPermissions = new Map();
const PERMISSION_TIMEOUT_MS = 5 * 60 * 1000;

export function createPermissionHandler(sessionId) {
  return async (toolName, input) => {
    const readOnlyTools = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
    if (readOnlyTools.includes(toolName)) {
      return { behavior: 'allow' };
    }

    const requestId = Math.random().toString(36).slice(2);

    broadcast(sessionId, {
      type: 'permission:request',
      payload: { requestId, toolName, input }
    });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingPermissions.delete(requestId);
        resolve({ behavior: 'deny', message: 'Permission request timed out' });
      }, PERMISSION_TIMEOUT_MS);

      pendingPermissions.set(requestId, {
        resolve: (decision) => {
          clearTimeout(timeout);
          pendingPermissions.delete(requestId);
          resolve(decision);
        },
        sessionId,
        toolName
      });
    });
  };
}

export function handlePermissionResponse(requestId, decision, updatedInput) {
  const pending = pendingPermissions.get(requestId);
  if (!pending) {
    return false;
  }

  if (decision === 'allow') {
    pending.resolve({
      behavior: 'allow',
      ...(updatedInput && { updatedInput })
    });
  } else {
    pending.resolve({
      behavior: 'deny',
      message: 'User denied permission'
    });
  }

  return true;
}

export function getPendingPermissions(sessionId) {
  const result = [];
  for (const [requestId, pending] of pendingPermissions) {
    if (pending.sessionId === sessionId) {
      result.push({ requestId, toolName: pending.toolName });
    }
  }
  return result;
}
