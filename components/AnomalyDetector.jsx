import React, { useState, useCallback, useEffect } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';
import ProgressBar from './ProgressBar';

const AnomalyDetector = ({ token }) => {
  const [objectType, setObjectType] = useState('contacts');
  const [schemas, setSchemas] = useState([]);
  const [availableProps, setAvailableProps] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [fillRates, setFillRates] = useState({}); // { propName: percent }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };
  const isValidDomain = (domain) => {
    if (!domain || typeof domain !== 'string') return false;
    const s = domain.trim().toLowerCase();
    // Basic domain check: label.label TLD
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s);
  };

  // Load schemas for dynamic object selection
  useEffect(() => {
    const load = async () => {
      try {
        const res = await hubSpotApiRequest('/crm/v3/schemas', 'GET', token);
        const list = (res.results || []).map((s) => ({ name: s.name, labels: s.labels }));
        const priority = ['contacts', 'companies', 'deals', 'tickets'];
        // Place common objects first, then alphabetical. Use large index for non-priority items.
        list.sort((a, b) => {
          const ia = priority.indexOf(a.name);
          const ib = priority.indexOf(b.name);
          const pa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
          const pb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
          return pa - pb || a.name.localeCompare(b.name);
        });
        setSchemas(list);
        // If current objectType isn't present in the returned schemas, default to the first available schema
        if (objectType && !list.find((s) => s.name === objectType)) {
          setObjectType(list[0]?.name || 'contacts');
        }
      } catch {}
    };
    load();
  }, [token]);

  // Load available properties for the selected object for smarter scans
  useEffect(() => {
    const loadProps = async () => {
      try {
        const propRes = await hubSpotApiRequest(`/crm/v3/properties/${objectType}`, 'GET', token);
        const props = propRes.results || propRes || [];
        setAvailableProps(props);
      } catch { setAvailableProps([]); }
    };
    if (objectType) loadProps();
  }, [objectType, token]);

  const findAnomalies = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setAnomalies([]);
    setProgress(0);
    setFillRates({});
    setPage(1);

    try {
      // Build properties list: all available props + primary id
      const allProps = (availableProps || []).map((p) => p.name);
      const propertiesToFetch = Array.from(new Set(['hs_object_id', ...allProps]));

      // Get total for progress/fill %
      const totalRes = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, { limit: 1, filterGroups: [] });
      const total = totalRes.total || 0;
      if (!total) {
        setAnomalies([]);
        setFillRates({});
        setProgress(100);
        setIsLoading(false);
        return;
      }

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const perPage = 100;
      let after = undefined;
      const foundAnomalies = [];
      const fillCounts = {}; // propName -> count of non-empty
      let processed = 0;

      // Prepare quick lookup for prop metadata
      const propMeta = {};
      (availableProps || []).forEach((p) => { propMeta[p.name] = p; });

      do {
        const body = { limit: perPage, after, properties: propertiesToFetch };
        const data = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, body);
        const items = data.results || [];
        for (const record of items) {
          const p = record.properties || {};
          // Fill counts
          for (const name of propertiesToFetch) {
            if (name === 'hs_object_id') continue;
            const val = p[name];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              fillCounts[name] = (fillCounts[name] || 0) + 1;
            }
          }
          // Anomalies per property
          for (const name of propertiesToFetch) {
            if (name === 'hs_object_id') continue;
            const meta = propMeta[name] || {};
            const val = p[name];
            if (val === undefined || val === null || String(val) === '') continue; // only evaluate when value present
            const reason = evaluateValue(meta, name, val, p);
            if (reason) {
              foundAnomalies.push({ id: p.hs_object_id, property: name, value: val, reason });
            }
          }
        }
        processed += items.length;
        setProgress(Math.min(95, Math.floor((processed / total) * 95)));
        after = data.paging?.next?.after;
        if (after) await sleep(350); // pace requests to respect rate limits
      } while (after);

      // Compute fill rates per property
      const fr = {};
      for (const name of propertiesToFetch) {
        if (name === 'hs_object_id') continue;
        const count = fillCounts[name] || 0;
        fr[name] = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
      }

      // Attach property fill% to each anomaly row
      const withFill = foundAnomalies.map((a) => ({ ...a, fillPercent: fr[a.property] || '0.00' }));
      setFillRates(fr);
      setAnomalies(withFill);
      setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [objectType, token]);

  function evaluateValue(meta, name, value, properties) {
    const type = (meta.type || '').toLowerCase();
    const fieldType = (meta.fieldType || '').toLowerCase();
    const n = (name || '').toLowerCase();
    const v = typeof value === 'string' ? value.trim() : value;

    // Heuristics by name/field type
    if (n.includes('email') || fieldType === 'email') {
      if (!isValidEmail(String(v))) return 'Invalid email format';
    }
    if (n.includes('website') || n.includes('url') || fieldType === 'url') {
      if (!isValidUrl(String(v))) return 'Invalid URL format';
    }
    if (n === 'domain' || n.includes('domain')) {
      if (!isValidDomain(String(v))) return 'Invalid domain value';
    }
    if (n.includes('phone') || fieldType === 'phonenumber') {
      const digits = String(v).replace(/\D+/g, '');
      if (digits.length < 7 || digits.length > 15) return 'Suspicious phone number length';
    }
    if (type === 'number') {
      const num = Number(String(v).replace(/,/g, ''));
      if (!Number.isFinite(num)) return 'Non-numeric value in number property';
    }
    if (type === 'date' || type === 'datetime') {
      // HubSpot stores dates as ms since epoch (string). Flag if not numeric.
      if (!/^\d+$/.test(String(v))) return 'Invalid date value (expected milliseconds since epoch)';
    }
    if (type === 'bool') {
      const s = String(v).toLowerCase();
      if (!['true', 'false', '1', '0'].includes(s)) return 'Invalid boolean value';
    }
    if (type === 'enumeration' && Array.isArray(meta.options) && meta.options.length > 0) {
      const allowed = new Set(meta.options.map((o) => o.value));
      if (!allowed.has(String(v))) return 'Value not in allowed options';
    }
    if (type === 'string' || !type) {
      if (typeof v === 'string') {
        if (v.length > 500) return 'Unusually long string value';
        if (/^\s|\s$/.test(value)) return 'Leading or trailing whitespace';
      }
    }
    return '';
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Data Anomaly Detection</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className="p-2 border rounded-md">
            {schemas.length > 0 ? (
              schemas.map((s) => (
                <option key={s.name} value={s.name}>{s.labels?.plural || s.name}</option>
              ))
            ) : (
              <>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
                <option value="deals">Deals</option>
                <option value="tickets">Tickets</option>
              </>
            )}
          </select>
          <button onClick={findAnomalies} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Scan for Anomalies'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
  {isLoading && <ProgressBar percent={progress} text="Scanning records for anomalies..." />}
        {!isLoading && anomalies.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anomalous Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property Fill %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {anomalies.slice((page - 1) * pageSize, page * pageSize).map((a, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{a.property}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" style={{ maxWidth: '200px' }}>
                      {a.value}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{a.reason}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{a.fillPercent || fillRates[a.property] || '0.00'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">Total anomalies: {anomalies.length}</div>
              <div className="flex items-center space-x-2">
                <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                <span className="text-sm text-gray-700">Page {page} of {Math.max(1, Math.ceil(anomalies.length / pageSize))}</span>
                <button className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50" onClick={() => setPage((p) => Math.min(Math.ceil(anomalies.length / pageSize) || 1, p + 1))} disabled={page >= Math.ceil(anomalies.length / pageSize)}>Next</button>
                <select className="p-1 border rounded text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        )}
        {!isLoading && !error && anomalies.length === 0 && <p>No anomalies found for the selected criteria.</p>}
      </div>
    </div>
  );
};

export default AnomalyDetector;
