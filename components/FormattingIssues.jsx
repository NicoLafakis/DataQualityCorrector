import React, { useState, useCallback } from 'react';
import { Spinner } from './icons';
import { hubSpotApiRequest } from '../lib/api';
import { toTitleCase, normalizeEmail, normalizePhone, normalizeCountry, normalizeState, normalizeDate, isValidEmail, isValidUrl } from '../lib/format';

const detectors = {
  contacts: [
    { property: 'firstname', suggest: (p) => (p.firstname ? toTitleCase(p.firstname) : null), reason: 'Title-case first name' },
    { property: 'lastname', suggest: (p) => (p.lastname ? toTitleCase(p.lastname) : null), reason: 'Title-case last name' },
    { property: 'email', suggest: (p) => (p.email && (!isValidEmail(p.email) || p.email !== p.email.toLowerCase()) ? normalizeEmail(p.email) : null), reason: 'Lowercase/validate email' },
    { property: 'website', suggest: (p) => (p.website && !isValidUrl(p.website) ? null : null), reason: 'Invalid URL format' },
    { property: 'phone', suggest: (p) => (p.phone ? normalizePhone(p.phone, p.country) : null), reason: 'Normalize phone' },
    { property: 'country', suggest: (p) => (p.country ? normalizeCountry(p.country) : null), reason: 'Normalize country code' },
    { property: 'state', suggest: (p) => (p.state ? normalizeState(p.state, p.country) : null), reason: 'Normalize state code' },
  ],
  companies: [
    { property: 'name', suggest: (p) => (p.name ? toTitleCase(p.name) : null), reason: 'Title-case company name' },
    { property: 'website', suggest: (p) => (p.website && !isValidUrl(p.website) ? null : null), reason: 'Invalid URL format' },
    { property: 'city', suggest: (p) => (p.city ? toTitleCase(p.city) : null), reason: 'Title-case city' },
    { property: 'country', suggest: (p) => (p.country ? normalizeCountry(p.country) : null), reason: 'Normalize country code' },
    { property: 'state', suggest: (p) => (p.state ? normalizeState(p.state, p.country) : null), reason: 'Normalize state code' },
  ],
};

export default function FormattingIssues({ token }) {
  const [objectType, setObjectType] = useState('contacts');
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Gentle helpers for batching
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

  const scan = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setIssues([]);
    setSelected({});
    try {
      let all = [];
      let after = undefined;
      const props = objectType === 'contacts'
        ? 'hs_object_id,firstname,lastname,email,website,phone,city,state,country'
        : 'hs_object_id,name,website,city,state,country';
      do {
        const path = `/crm/v3/objects/${objectType}?limit=100&properties=${props}${after ? `&after=${after}` : ''}`;
        const data = await hubSpotApiRequest(path, 'GET', token);
        all = all.concat(data.results || []);
        after = data.paging?.next?.after;
        // Optional soft cap to avoid extremely large scans in one go
        if (all.length >= 2000) after = undefined;
      } while (after);

      const ds = detectors[objectType] || [];
      const found = [];
      for (const r of all) {
        const p = r.properties || {};
        for (const d of ds) {
          const suggestion = d.suggest(p);
          if (suggestion !== null && suggestion !== undefined && suggestion !== p[d.property]) {
            found.push({ objectType, id: r.id, property: d.property, currentValue: p[d.property] ?? '', suggestedValue: suggestion, reason: d.reason });
          }
        }
      }
      setIssues(found);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [objectType, token]);

  const toggleSelect = (key) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  const selectAll = (checked) => {
    const next = {};
    if (checked) issues.forEach((it, idx) => { next[idx] = true; });
    setSelected(next);
  };

  const applySelected = async () => {
    setIsSaving(true);
    setError('');
    try {
      const inputs = [];
      issues.forEach((it, idx) => {
        if (!selected[idx]) return;
        inputs.push({ id: it.id, properties: { [it.property]: it.suggestedValue } });
      });
      if (inputs.length) {
        // HubSpot batch size limit is typically 100 per request; chunk accordingly and add a short pause between batches
        const batches = chunk(inputs, 100);
        for (const b of batches) {
          await hubSpotApiRequest(`/crm/v3/objects/${objectType}/batch/update`, 'POST', token, { inputs: b });
          // small pacing to avoid hitting second-level limits when many batches
          await sleep(300);
        }
        // Remove applied issues from list
        const remaining = issues.filter((_, idx) => !selected[idx]);
        setIssues(remaining);
        setSelected({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Formatting Issues</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className="p-2 border rounded-md">
            <option value="contacts">Contacts</option>
            <option value="companies">Companies</option>
          </select>
          <button onClick={scan} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Scan for Issues'}
          </button>
          <button onClick={applySelected} disabled={isSaving || Object.values(selected).every((v) => !v)} className="bg-green-600 text-white px-4 py-2 rounded-md disabled:bg-green-300 flex items-center">
            {isSaving ? <Spinner /> : 'Apply Selected Fixes'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {!isLoading && issues.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3"><input type="checkbox" onChange={(e) => selectAll(e.target.checked)} /></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suggested</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {issues.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2"><input type="checkbox" checked={!!selected[idx]} onChange={() => toggleSelect(idx)} /></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{it.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{it.property}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" style={{ maxWidth: '200px' }}>{String(it.currentValue || '')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 truncate font-mono" style={{ maxWidth: '200px' }}>{String(it.suggestedValue || '')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{it.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && issues.length === 0 && <p>No issues found. Try scanning.</p>}
      </div>
    </div>
  );
}
