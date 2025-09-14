import React, { useState, useCallback, useEffect } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';

export default function EnrichmentScanner({ token, openAiKey }) {
  const [objectType, setObjectType] = useState('contacts');
  const [coverage, setCoverage] = useState([]);
  const [sampleMissing, setSampleMissing] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [schemas, setSchemas] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await hubSpotApiRequest('/crm/v3/schemas', 'GET', token);
        const list = (res.results || []).map((s) => ({ name: s.name, labels: s.labels }));
        const priority = ['contacts', 'companies', 'deals', 'tickets'];
        list.sort((a, b) => (priority.indexOf(a.name) + 999) - (priority.indexOf(b.name) + 999) || a.name.localeCompare(b.name));
        setSchemas(list);
      } catch {}
    };
    load();
  }, [token]);

  const CORE = {
    contacts: ['firstname', 'lastname', 'email', 'phone', 'city', 'state', 'country'],
    companies: ['name', 'domain', 'website', 'industry', 'numberofemployees', 'city', 'state', 'country'],
  };

  const scan = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setCoverage([]);
    setSampleMissing([]);
    try {
      const props = CORE[objectType];
      const { total } = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, { limit: 1, filterGroups: [] });
      if (!total) { setCoverage([]); setIsLoading(false); return; }

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const concurrency = 5;
      const groups = Array.from({ length: Math.ceil(props.length / concurrency) }, (_, i) => props.slice(i * concurrency, i * concurrency + concurrency));
      const cov = [];
      for (const g of groups) {
        const out = await Promise.all(g.map(async (p) => {
          const body = { limit: 1, filterGroups: [{ filters: [{ propertyName: p, operator: 'HAS_PROPERTY' }] }] };
          const resp = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, body);
          return { property: p, rate: ((resp.total || 0) / total * 100).toFixed(2) };
        }));
        cov.push(...out);
        await sleep(300);
      }
      setCoverage(cov);

      // Load a small sample of records missing any of the core fields
      let after = undefined;
      const sample = [];
      do {
        const page = await hubSpotApiRequest(`/crm/v3/objects/${objectType}?limit=100&properties=${props.join(',')},hs_object_id${after ? `&after=${after}` : ''}`, 'GET', token);
        const pageResults = (page.results || []);
        const missing = pageResults.filter((r) => {
          const pr = r.properties || {};
          return props.some((p) => !pr[p]);
        });
        sample.push(...missing);
        after = page.paging?.next?.after;
        if (sample.length >= 50) break; // cap
        await sleep(200);
      } while (after);
      setSampleMissing(sample.slice(0, 50));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [objectType, token]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Enrichment Coverage</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className="p-2 border rounded-md">
            {schemas.length > 0 ? (
              schemas.map((s) => <option key={s.name} value={s.name}>{s.labels?.plural || s.name}</option>)
            ) : (
              <>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
              </>
            )}
          </select>
          <button onClick={scan} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Scan for Enrichment Gaps'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {!isLoading && coverage.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {coverage.map((c, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-md">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">{c.property}</span>
                  <span className="font-semibold text-gray-800">{c.rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${c.rate}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && sampleMissing.length > 0 && (
          <div>
            <h4 className="text-lg font-medium text-gray-700 mb-2">Sample Records Missing Core Fields</h4>
            <ul className="divide-y divide-gray-200">
              {sampleMissing.map((r) => (
                <li key={r.id} className="py-2 text-sm text-gray-700">ID {r.id}</li>
              ))}
            </ul>
          </div>
        )}
        {!isLoading && !error && coverage.length === 0 && <p>No coverage data yet. Run a scan.</p>}
      </div>
    </div>
  );
}
