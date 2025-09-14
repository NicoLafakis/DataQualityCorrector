import React, { useState, useCallback, useEffect } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';

export default function PropertyInsights({ token }) {
  const [objectType, setObjectType] = useState('contacts');
  const [rows, setRows] = useState([]);
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

  const scan = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setRows([]);
    try {
      const { total } = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, { limit: 1, filterGroups: [] });
      const propsRes = await hubSpotApiRequest(`/crm/v3/properties/${objectType}`, 'GET', token);
      const properties = propsRes.results || propsRes;
      if (!total) { setRows([]); setIsLoading(false); return; }

      const out = [];
      // Limit to first 80 properties per scan to avoid excessive calls
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const list = properties.slice(0, 80);
      const concurrency = 5;
      for (let i = 0; i < list.length; i += concurrency) {
        const batch = list.slice(i, i + concurrency);
        const results = await Promise.all(batch.map(async (prop) => {
          const filledBody = { limit: 1, filterGroups: [{ filters: [{ propertyName: prop.name, operator: 'HAS_PROPERTY' }] }] };
          const filled = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, filledBody);
          const filledCount = filled.total || 0;
          const isText = ['string', 'textarea', 'enumeration'].includes(prop.type) || ['text', 'textarea', 'select', 'radio'].includes(prop.fieldType);
          const noData = filledCount === 0;
          const unused = noData && isText;
          return { name: prop.label || prop.name, internalName: prop.name, group: prop.groupName, fillRate: ((filledCount / total) * 100).toFixed(2), noData, unused };
        }));
        out.push(...results);
        await sleep(300);
      }

      setRows(out);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [objectType, token]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Property Insights</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className="p-2 border rounded-md">
            {schemas.length > 0 ? (
              schemas.map((s) => <option key={s.name} value={s.name}>{s.labels?.plural || s.name}</option>)
            ) : (
              <>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
                <option value="deals">Deals</option>
                <option value="tickets">Tickets</option>
              </>
            )}
          </select>
          <button onClick={scan} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Scan Properties'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {!isLoading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fill Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unused</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.name} <span className="text-gray-400 text-xs">({r.internalName})</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.fillRate}%</td>
                    <td className={"px-6 py-4 whitespace-nowrap text-sm " + (r.noData ? 'text-red-600' : 'text-gray-500')}>{r.noData ? 'Yes' : 'No'}</td>
                    <td className={"px-6 py-4 whitespace-nowrap text-sm " + (r.unused ? 'text-yellow-600' : 'text-gray-500')}>{r.unused ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && <p>No data to display. Run a scan.</p>}
      </div>
    </div>
  );
}
