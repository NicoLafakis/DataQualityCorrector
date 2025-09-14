// Small fuzzy matching utilities used by FuzzyDuplicateFinder
// Implement Jaro-Winkler similarity (lightweight, no deps)
export function jaroDistance(s1 = '', s2 = '') {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  const len1 = s1.length, len2 = s2.length;
  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const match1 = new Array(len1).fill(false);
  const match2 = new Array(len2).fill(false);
  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (match2[j]) continue;
      if (s1[i] !== s2[j]) continue;
      match1[i] = true; match2[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!match1[i]) continue;
    while (!match2[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  t = t / 2;
  return (matches / len1 + matches / len2 + (matches - t) / matches) / 3;
}

export function jaroWinkler(s1, s2, p = 0.1) {
  const j = jaroDistance(s1, s2);
  // common prefix up to 4
  let l = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i].toLowerCase() === s2[i].toLowerCase()) l++; else break;
  }
  return j + l * p * (1 - j);
}

// Normalize names/emails for comparison
export function normalizeKey(str = '') {
  return (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9@.\s]/g, '');
}
