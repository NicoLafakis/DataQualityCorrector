import { normalizeEmail, toTitleCase, normalizePhone, normalizeCountry, normalizeState, normalizeDate, trimString } from './format';

const STORAGE_KEY = 'dqc_rules_v1';

export function listRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRule(rule) {
  const rules = listRules();
  const idx = rules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) rules[idx] = rule; else rules.push(rule);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  return rule;
}

export function deleteRule(id) {
  const rules = listRules().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

export function newRuleId() {
  return 'r_' + Math.random().toString(36).slice(2, 10);
}

// Applies enabled rules to records of a given objectType and returns a list of updates
// records: array of HubSpot records { id, properties }
export function applyRules(objectType, records, rules) {
  const active = (rules || listRules()).filter((r) => r.enabled && r.objectType === objectType);
  const updates = [];

  for (const rec of records) {
    const props = { ...(rec.properties || {}) };
    let changed = false;
    for (const rule of active) {
      const prop = rule.property;
      const current = props[prop];
      const next = applyTransform(rule, props);
      if (next && Object.prototype.hasOwnProperty.call(next, prop) && next[prop] !== current) {
        props[prop] = next[prop];
        changed = true;
      }
    }
    if (changed) updates.push({ id: rec.id, properties: minimalChanges(rec.properties || {}, props) });
  }
  return { updates };
}

function minimalChanges(original, updated) {
  const delta = {};
  for (const k of Object.keys(updated)) {
    if (original[k] !== updated[k]) delta[k] = updated[k];
  }
  return delta;
}

function applyTransform(rule, properties) {
  const { type, config, property } = rule;
  const value = properties[property];
  if (type !== 'transform') return null;
  switch (config?.op) {
    case 'lowercase':
      if (typeof value === 'string') return { [property]: value.toLowerCase() };
      return null;
    case 'trim':
      if (typeof value === 'string') return { [property]: trimString(value) };
      return null;
    case 'titlecase':
      if (typeof value === 'string') return { [property]: toTitleCase(value) };
      return null;
    case 'email':
      if (typeof value === 'string') return { [property]: normalizeEmail(value) };
      return null;
    case 'phone':
      if (typeof value === 'string') return { [property]: normalizePhone(value, config?.defaultCountry) };
      return null;
    case 'country':
      if (typeof value === 'string') return { [property]: normalizeCountry(value) };
      return null;
    case 'state':
      if (typeof value === 'string') return { [property]: normalizeState(value, properties[config?.countryProperty || 'country']) };
      return null;
    case 'date':
      if (typeof value === 'string') return { [property]: normalizeDate(value) };
      return null;
    default:
      return null;
  }
}
