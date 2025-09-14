import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';

export default function EnrichmentScanner({ token, openAiKey }) {
  const [objectType, setObjectType] = useState('contacts');
  const [coverage, setCoverage] = useState([]);
  const [sampleMissing, setSampleMissing] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

      const cov = [];
      for (const p of props) {
        const body = { limit: 1, filterGroups: [{ filters: [{ propertyName: p, operator: 'HAS_PROPERTY' }] }] };
        const resp = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, body);
        cov.push({ property: p, rate: ((resp.total || 0) / total * 100).toFixed(2) });
      }
      setCoverage(cov);

      // Load a small sample of records missing any of the core fields
      const sample = await hubSpotApiRequest(`/crm/v3/objects/${objectType}?limit=200&properties=${props.join(',')},hs_object_id`, 'GET', token);
      const missing = (sample.results || []).filter((r) => {
        const pr = r.properties || {};
        return props.some((p) => !pr[p]);
      }).slice(0, 50);
      setSampleMissing(missing);
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
            <option value="contacts">Contacts</option>
            <option value="companies">Companies</option>
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
