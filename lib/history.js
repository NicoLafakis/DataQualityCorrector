const KEY = 'dqc.scanHistory';
const ACTION_KEY = 'dqc.actions';

export function listScans() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordScan(tool, objectType, metrics) {
  const scans = listScans();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    tool,
    objectType,
    metrics: metrics || {},
  };
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...scans].slice(0, 500)));
  } catch {}
  return entry;
}

export function clearScans() {
  try { localStorage.removeItem(KEY); } catch {}
}

export function listActions() {
  try {
    const raw = localStorage.getItem(ACTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// recordAction stores an action with optional undo payload
export function recordAction(type, targetId, payload = {}, undoPayload = null) {
  const actions = listActions();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    ts: Date.now(),
    type,
    targetId,
    payload,
    undoPayload,
  };
  try {
    localStorage.setItem(ACTION_KEY, JSON.stringify([entry, ...actions].slice(0, 1000)));
  } catch {}
  return entry;
}

export function clearActions() {
  try { localStorage.removeItem(ACTION_KEY); } catch {}
}

// undoAction returns the undoPayload for the action and marks it undone
export function undoAction(actionId) {
  const actions = listActions();
  const idx = actions.findIndex((a) => a.id === actionId);
  if (idx === -1) return null;
  const action = actions[idx];
  // For simplicity mark entry as undone by setting undoneTs
  actions[idx] = { ...action, undoneTs: Date.now() };
  try { localStorage.setItem(ACTION_KEY, JSON.stringify(actions)); } catch {}
  return action.undoPayload || null;
}
