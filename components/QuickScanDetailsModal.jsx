import React from 'react';

export default function QuickScanDetailsModal({ visible, title, rows = [], onClose }) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white w-11/12 md:w-4/5 lg:w-2/3 max-h-[80vh] overflow-auto rounded shadow-lg">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="px-2 py-1 bg-gray-200 rounded" onClick={onClose}>Close</button>
        </div>
        <div className="p-4">
          <div className="text-sm text-gray-600 mb-2">Showing {rows.length} item{rows.length === 1 ? '' : 's'}</div>
          {rows.length === 0 ? (
            <p className="text-gray-600">No items found.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {rows.map((r, idx) => (
                <li key={idx} className="py-2">
                  <div className="font-medium break-all">{r.label || '(no label)'}</div>
                  {r.meta ? (
                    <pre className="text-xs text-gray-800 bg-gray-50 rounded p-2 mt-1 overflow-auto">{JSON.stringify(r.meta, null, 2)}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
