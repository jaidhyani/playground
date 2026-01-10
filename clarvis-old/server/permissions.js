import { broadcast } from './ws-hub.js';

const pendingPermissions = new Map();

// timeoutMs: 0 or null means wait indefinitely (pause)
export function createPermissionHandler(sessionId, timeoutMs = null) {
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
      let timeoutHandle = null;

      // Only set timeout if a positive value is provided
      if (timeoutMs && timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          pendingPermissions.delete(requestId);
          resolve({ behavior: 'deny', message: 'Permission request timed out' });
        }, timeoutMs);
      }

      pendingPermissions.set(requestId, {
        resolve: (decision) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
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
