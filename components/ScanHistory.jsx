import React, { useEffect, useMemo, useState } from 'react';
import { listScans, clearScans } from '../lib/history';
import { toCSV, downloadCSV } from '../lib/csv';
import { Spinner } from './icons';

export default function ScanHistory() {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [toolFilter, setToolFilter] = useState('');
  const [objectFilter, setObjectFilter] = useState('');

  useEffect(() => {
    setIsLoading(true);
    const data = listScans();
    setItems(data);
    setIsLoading(false);
  }, []);

  const tools = useMemo(() => Array.from(new Set(items.map(i => i.tool))).sort(), [items]);
  const objects = useMemo(() => Array.from(new Set(items.map(i => i.objectType))).sort(), [items]);

  const filtered = useMemo(() => items.filter(i =>
    (!toolFilter || i.tool === toolFilter) && (!objectFilter || i.objectType === objectFilter)
  ), [items, toolFilter, objectFilter]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map(i => ({
      id: i.id,
      ts: new Date(i.ts).toISOString(),
      tool: i.tool,
      objectType: i.objectType,
      metrics: JSON.stringify(i.metrics || {}),
    }));
    const csv = toCSV(rows, ['id', 'ts', 'tool', 'objectType', 'metrics']);
    downloadCSV('scan-history.csv', csv);
  };

  const clearAll = () => {
    clearScans();
    setItems([]);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Scan History</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} className="p-2 border rounded-md">
            <option value="">All Tools</option>
            {tools.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={objectFilter} onChange={(e) => setObjectFilter(e.target.value)} className="p-2 border rounded-md">
            <option value="">All Objects</option>
            {objects.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={exportCSV} disabled={filtered.length === 0} className="bg-gray-600 text-white px-3 py-2 rounded-md disabled:bg-gray-300">Export CSV</button>
          <button onClick={clearAll} className="bg-red-600 text-white px-3 py-2 rounded-md">Clear History</button>
          {isLoading && <span className="text-gray-500 flex items-center"><Spinner /> Loading…</span>}
          <span className="text-sm text-gray-600">Total: {items.length} • Showing: {filtered.length}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="text-gray-500">No scans recorded yet. Run analyses like Universal Analyzer to populate history.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Object</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metrics</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map(i => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{new Date(i.ts).toLocaleString()}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{i.tool}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{i.objectType}</td>
                    <td className="px-4 py-2 whitespace-pre-wrap text-sm text-gray-700">{Object.entries(i.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
