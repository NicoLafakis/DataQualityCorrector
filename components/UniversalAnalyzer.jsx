import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';
import ProgressBar from './ProgressBar';
import { toCSV, downloadCSV } from '../lib/csv';
import { recordScan } from '../lib/history';

// Universal analyzer that discovers CRM objects (standard + custom) via schemas
// and computes per-property fill rates with gentle batching and pagination.
export default function UniversalAnalyzer({ token }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [schemas, setSchemas] = useState([]);
  const [selected, setSelected] = useState('contacts');
  const [properties, setProperties] = useState([]);
  const [summary, setSummary] = useState({ total: 0, analyzed: 0 });
  const [rows, setRows] = useState([]);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Load available CRM object schemas
  const loadSchemas = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      // HubSpot: list object schemas
      // https://developers.hubspot.com/docs/api/crm/crm-custom-objects#endpoints
      const res = await hubSpotApiRequest('/crm/v3/schemas', 'GET', token);
      const list = (res.results || []).map((s) => ({
        name: s.name, // e.g., contacts, companies, deals, tickets, p_customobject
        labels: s.labels,
        fullyQualifiedName: s.fullyQualifiedName,
        objectTypeId: s.objectTypeId,
        primaryDisplayProperty: s.primaryDisplayProperty,
      }));
      // Put common objects on top
      const priority = ['contacts', 'companies', 'deals', 'tickets'];
      list.sort((a, b) => (priority.indexOf(a.name) + 999) - (priority.indexOf(b.name) + 999) || a.name.localeCompare(b.name));
      setSchemas(list);
      if (!selected && list.length) setSelected(list[0].name);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, selected]);

  useEffect(() => { loadSchemas(); }, [loadSchemas]);

  const loadProperties = useCallback(async () => {
    if (!selected) return;
    setError(''); setProperties([]);
    try {
      const propRes = await hubSpotApiRequest(`/crm/v3/properties/${selected}`, 'GET', token);
      const props = propRes.results || propRes;
      setProperties(props);
    } catch (err) {
      setError(err.message);
    }
  }, [selected, token]);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  const startScan = useCallback(async () => {
    setIsScanning(true); setError(''); setRows([]); setSummary({ total: 0, analyzed: 0 });
    setProgress(0);
    try {
      // Total count using search
      const search = await hubSpotApiRequest(`/crm/v3/objects/${selected}/search`, 'POST', token, { limit: 1, filterGroups: [] });
      const total = search.total || 0;
      setSummary((s) => ({ ...s, total }));
      if (!total) { setIsScanning(false); return; }

      // Compute fill rates in small waves
      const list = properties.slice();
      const concurrency = 5;
      const out = [];
      for (let i = 0; i < list.length; i += concurrency) {
        const batch = list.slice(i, i + concurrency);
        const results = await Promise.all(batch.map(async (prop) => {
          const body = { limit: 1, filterGroups: [{ filters: [{ propertyName: prop.name, operator: 'HAS_PROPERTY' }] }] };
          const resp = await hubSpotApiRequest(`/crm/v3/objects/${selected}/search`, 'POST', token, body);
          const filled = resp.total || 0;
          const rate = total > 0 ? ((filled / total) * 100).toFixed(2) : '0.00';
          return {
            label: prop.label || prop.name,
            name: prop.name,
            group: prop.groupName,
            type: prop.type,
            fieldType: prop.fieldType,
            filled,
            rate,
          };
        }));
        out.push(...results);
        setSummary((s) => ({ ...s, analyzed: Math.min(out.length, list.length) }));
        // update percent progress based on properties processed
        setProgress(Math.min(100, Math.round((out.length / list.length) * 100)));
        await sleep(300);
      }
      setRows(out);
      setProgress(100);
      // Record history summary for trends (counts only to keep it light)
      const filledSum = out.reduce((acc, r) => acc + (r.filled || 0), 0);
      recordScan('universal-analyzer', selected, { properties: out.length, total, filledSum });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  }, [selected, token, properties]);

  const [progress, setProgress] = useState(0);

  const grouped = useMemo(() => rows.reduce((acc, r) => {
    const key = r.group || 'nogroup';
    (acc[key] = acc[key] || []).push(r);
    return acc;
  }, {}), [rows]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Universal Analyzer</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="p-2 border rounded-md">
            {schemas.map((s) => (
              <option key={s.name} value={s.name}>{s.labels?.plural || s.name}</option>
            ))}
          </select>
          <button onClick={startScan} disabled={isScanning || !selected} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-blue-300 flex items-center">
            {isScanning ? <Spinner /> : 'Analyze Properties'}
          </button>
          <button
            onClick={() => {
              if (rows.length === 0) return;
              const csv = toCSV(rows.map((r) => ({ label: r.label, name: r.name, group: r.group, type: r.type, fieldType: r.fieldType, filled: r.filled, rate: r.rate })),
                ['label', 'name', 'group', 'type', 'fieldType', 'filled', 'rate']);
              downloadCSV(`${selected}-property-fill-rates.csv`, csv);
            }}
            disabled={isScanning || rows.length === 0}
            className="bg-gray-600 text-white px-3 py-2 rounded-md disabled:bg-gray-300"
          >Export CSV</button>
          {isLoading && <span className="text-gray-500 flex items-center"><Spinner /> Loading objects…</span>}
          <span className="text-sm text-gray-600">Total: {summary.total} • Analyzed: {summary.analyzed}</span>
        </div>
        {isScanning && <ProgressBar percent={progress} text={`Analyzing properties (${summary.analyzed}/${properties.length || 0})`} />}
        {error && <p className="text-red-500">{error}</p>}
        {rows.length > 0 && (
          <div className="space-y-4">
            {Object.entries(grouped).sort().map(([group, items]) => (
              <div key={group}>
                <h4 className="text-lg font-medium text-gray-700 capitalize mb-2">{group.replace(/_/g, ' ')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.sort((a, b) => a.label.localeCompare(b.label)).map((r) => (
                    <div key={r.name} className="bg-gray-50 p-3 rounded-md">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 font-medium">{r.label} <span className="text-xs text-gray-400">({r.name})</span></span>
                        <span className="font-semibold text-gray-800">{r.rate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${r.rate}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {!isScanning && !error && rows.length === 0 && (
          <p className="text-gray-500">Select any object and click Analyze to compute fill rates for all its properties.</p>
        )}
      </div>
    </div>
  );
}
