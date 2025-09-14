import React, { useState, useMemo } from 'react';

export default function MergeModal({ visible, records = [], onCancel = () => {}, onConfirm = () => {} }) {
  const [primaryId, setPrimaryId] = useState(records[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState(records.map((r) => r.id));

  // reset when records change
  React.useEffect(() => {
    setPrimaryId(records[0]?.id || null);
    setSelectedIds(records.map((r) => r.id));
  }, [records]);

  const selectedRecords = useMemo(() => records.filter((r) => selectedIds.includes(r.id)), [records, selectedIds]);

  if (!visible) return null;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    if (primaryId === id) setPrimaryId(null);
  };

  const confirm = () => {
    const mergeIds = selectedIds.filter((id) => id !== primaryId);
    onConfirm(primaryId, mergeIds);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white w-11/12 md:w-3/4 lg:w-2/3 p-4 rounded shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Merge Records</h3>
        <p className="text-sm text-gray-600 mb-4">Select which records to merge and pick the primary record to keep. Fields from the primary will be preserved unless empty; other selected records will be merged into it.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-auto mb-4">
          {records.map((r) => (
            <div key={r.id} className={`border p-3 rounded ${selectedIds.includes(r.id) ? 'bg-gray-50' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">ID: {r.id}</div>
                <div className="flex items-center space-x-2">
                  <label className="inline-flex items-center space-x-2">
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelect(r.id)} />
                    <span className="text-xs">Select</span>
                  </label>
                  <label className="inline-flex items-center space-x-2">
                    <input type="radio" name="primary" checked={primaryId === r.id} onChange={() => setPrimaryId(r.id)} disabled={!selectedIds.includes(r.id)} />
                    <span className="text-xs">Primary</span>
                  </label>
                </div>
              </div>
              <div className="text-sm text-gray-700">
                {Object.entries(r.properties || {}).slice(0, 20).map(([k, v]) => (
                  <div key={k} className="truncate"><span className="font-mono text-xs text-gray-600">{k}:</span> <span className="ml-1">{String(v || '')}</span></div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-2">
          <button onClick={onCancel} className="px-3 py-2 bg-gray-200 rounded">Cancel</button>
          <button onClick={confirm} disabled={!primaryId || selectedIds.length < 2} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-60">Confirm Merge</button>
        </div>
      </div>
    </div>
  );
}
