// Lightweight, dependency-free formatting and validation utilities
// Keep transforms conservative and deterministic.

// Email
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return email;
  return email.trim().toLowerCase();
}

export function isValidEmail(email) {
  if (!email) return false;
  // Simple RFC 5322-ish check; keep consistent with AnomalyDetector
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// URL
export function isValidUrl(url) {
  if (!url) return false;
  try { new URL(url); return true; } catch { return false; }
}

// Names
export function toTitleCase(name) {
  if (!name || typeof name !== 'string') return name;
  const lowered = name.trim().toLowerCase();
  return lowered.split(/\s+/).map((part) => {
    if (!part) return part;
    // Handle O'Connor, McDonald basic patterns
    if (part.includes("'")) {
      return part.split("'").map((p) => cap(p)).join("'");
    }
    if (part.startsWith('mc') && part.length > 2) {
      return 'Mc' + cap(part.slice(2));
    }
    return cap(part);
  }).join(' ');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Phone (very conservative). If defaultCountry provided ('US'/'CA' etc), try to format +1XXXXXXXXXX
export function normalizePhone(raw, defaultCountry) {
  if (!raw || typeof raw !== 'string') return raw;
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  if (raw.startsWith('+')) {
    // Already has country code; return +digits
    return '+' + digits;
  }
  // Basic NA handling when defaultCountry provided
  if ((defaultCountry === 'US' || defaultCountry === 'CA') && digits.length === 10) {
    return '+1' + digits;
  }
  // Fallback: return digits grouped minimally
  return digits;
}

// Country/state normalization (minimal maps). Extend as needed.
const COUNTRY_MAP = {
  'united states': 'US', 'usa': 'US', 'us': 'US', 'u.s.': 'US', 'u.s.a.': 'US',
  'canada': 'CA', 'ca': 'CA',
  'united kingdom': 'GB', 'uk': 'GB', 'gb': 'GB'
};

export function normalizeCountry(value) {
  if (!value) return value;
  const key = String(value).trim().toLowerCase();
  return COUNTRY_MAP[key] || value;
}

const US_STATE_MAP = {
  'alabama': 'AL','alaska': 'AK','arizona': 'AZ','arkansas': 'AR','california': 'CA','colorado': 'CO','connecticut': 'CT','delaware': 'DE','florida': 'FL','georgia': 'GA','hawaii': 'HI','idaho': 'ID','illinois': 'IL','indiana': 'IN','iowa': 'IA','kansas': 'KS','kentucky': 'KY','louisiana': 'LA','maine': 'ME','maryland': 'MD','massachusetts': 'MA','michigan': 'MI','minnesota': 'MN','mississippi': 'MS','missouri': 'MO','montana': 'MT','nebraska': 'NE','nevada': 'NV','new hampshire': 'NH','new jersey': 'NJ','new mexico': 'NM','new york': 'NY','north carolina': 'NC','north dakota': 'ND','ohio': 'OH','oklahoma': 'OK','oregon': 'OR','pennsylvania': 'PA','rhode island': 'RI','south carolina': 'SC','south dakota': 'SD','tennessee': 'TN','texas': 'TX','utah': 'UT','vermont': 'VT','virginia': 'VA','washington': 'WA','west virginia': 'WV','wisconsin': 'WI','wyoming': 'WY'
};

export function normalizeState(value, country) {
  if (!value) return value;
  // Only normalize US for now when country is US
  if (country && String(country).toUpperCase() !== 'US') return value;
  const key = String(value).trim().toLowerCase();
  if (US_STATE_MAP[key]) return US_STATE_MAP[key];
  // If already two-letter code, uppercase it
  if (/^[A-Za-z]{2}$/.test(value)) return String(value).toUpperCase();
  return value;
}

// Dates
export function normalizeDate(value) {
  if (!value) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function trimString(value) {
  return typeof value === 'string' ? value.trim() : value;
}
