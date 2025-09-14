import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner, CheckCircleIcon, ExclamationCircleIcon } from './icons';
import { jaroWinkler, normalizeKey } from '../lib/fuzzy';
import { recordAction } from '../lib/history';
import ProgressBar from './ProgressBar';

// Fuzzy duplicate finder: compares name + email + company using Jaro-Winkler
export default function FuzzyDuplicateFinder({ token }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const scan = useCallback(async () => {
    setLoading(true); setError(''); setStatus('Scanning records...'); setSets([]);
    setProgress(0);
    try {
      let all = []; let after;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      do {
        const path = `/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,company,createdate${after ? `&after=${after}` : ''}`;
        const res = await hubSpotApiRequest(path, 'GET', token);
        all = all.concat(res.results || []);
        after = res.paging?.next?.after;
        if (after) await sleep(200);
        setProgress((prev) => Math.min(95, prev + 5));
      } while (after);

      // build keys
      const items = all.map((c) => ({
        id: c.id,
        firstname: c.properties.firstname || '',
        lastname: c.properties.lastname || '',
        email: c.properties.email || '',
        company: c.properties.company || '',
        createdate: c.properties.createdate,
      }));

      // naive O(n^2) comparison for now (small-to-medium portals)
      const used = new Set();
      const found = [];
      for (let i = 0; i < items.length; i++) {
        if (used.has(items[i].id)) continue;
        const group = [items[i]];
        for (let j = i + 1; j < items.length; j++) {
          if (used.has(items[j].id)) continue;
          const nameA = normalizeKey(`${items[i].firstname} ${items[i].lastname}`);
          const nameB = normalizeKey(`${items[j].firstname} ${items[j].lastname}`);
          const emailA = normalizeKey(items[i].email);
          const emailB = normalizeKey(items[j].email);
          const compA = normalizeKey(items[i].company);
          const compB = normalizeKey(items[j].company);

          // score components: name (0.5), email (0.3), company (0.2)
          const nameScore = jaroWinkler(nameA, nameB);
          const emailScore = emailA && emailB ? jaroWinkler(emailA, emailB) : 0;
          const compScore = compA && compB ? jaroWinkler(compA, compB) : 0;
          const score = (nameScore * 0.5) + (emailScore * 0.3) + (compScore * 0.2);

          if (score >= 0.85) {
            group.push({ ...items[j], _score: Number(score.toFixed(3)) });
            used.add(items[j].id);
          }
        }
        if (group.length > 1) found.push(group);
      }

      // attach approximate scores to group members
      const annotated = found.map((g) => g.map((m) => ({ ...m, _score: m._score || 1 })));
      setSets(annotated);
      setStatus(annotated.length ? `Found ${annotated.length} fuzzy duplicate sets` : 'No fuzzy duplicates found');
      setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const [progress, setProgress] = useState(0);

  const handleSuggestMerge = async (group) => {
    if (group.length < 2) return;
    setError('');
    const sorted = group.slice().sort((a, b) => new Date(b.createdate) - new Date(a.createdate));
    const primary = sorted[0];
    const toMerge = sorted.slice(1);

    try {
      // capture snapshots for undoPayload
      const snapshots = [];
      for (const r of [primary, ...toMerge]) {
        const obj = await hubSpotApiRequest(`/crm/v3/objects/contacts/${r.id}`, 'GET', token);
        snapshots.push({ id: r.id, properties: obj.properties || {} });
      }

      const undoPayload = {
        action: 'recreate',
        payload: {
          patch: [{ id: primary.id, properties: snapshots[0].properties }],
          create: toMerge.map((t, idx) => ({ properties: snapshots[idx + 1].properties })),
        },
      };

      const payload = { primaryId: primary.id, mergeIds: toMerge.map((t) => t.id), topScore: Math.max(...group.map((g) => g._score || 1)), source: 'fuzzy' };
      recordAction('merge_suggestion', primary.id, payload, undoPayload);
      setStatus('Suggested merge recorded to review queue');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Fuzzy Duplicate Finder</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={scan} disabled={loading || merging} className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center">
            {loading ? <Spinner /> : 'Scan for Fuzzy Duplicates'}
          </button>
        </div>
        {loading && <ProgressBar percent={progress} text="Scanning contacts for fuzzy duplicates..." />}
        {error && <p className="text-red-500">{error}</p>}
        {status && <p className="text-gray-600">{status}</p>}

        {sets.length > 0 && (
          <div className="space-y-4">
            {sets.map((group, idx) => (
              <div key={idx} className="border p-3 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium">Set {idx + 1} — highest score: {Math.max(...group.map((g) => g._score)).toFixed(3)}</div>
                  <div className="space-x-2">
                    <button onClick={() => handleSuggestMerge(group)} disabled={merging} className="bg-yellow-500 text-white px-3 py-1 rounded-md">Suggest Merge</button>
                  </div>
                </div>
                <ul className="divide-y divide-gray-200">
                  {group.map((r) => (
                    <li key={r.id} className="py-2 flex justify-between items-center">
                      <div>
                        <div className="font-medium">{r.firstname} {r.lastname}</div>
                        <div className="text-sm text-gray-500">{r.email} • {r.company} • ID: {r.id}</div>
                      </div>
                      <div className="text-sm font-semibold">{(r._score || 1).toFixed(3)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
