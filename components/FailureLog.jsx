import React from 'react';
import { listFailures, clearFailures } from '../lib/history';

export default function FailureLog() {
  const [items, setItems] = React.useState(() => listFailures());

  const refresh = () => setItems(listFailures());

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold mb-3">Failure Log</h3>
      <div className="mb-3">
        <button className="bg-red-500 text-white px-3 py-1 rounded-md mr-2" onClick={() => { clearFailures(); refresh(); }}>Clear Failures</button>
        <button className="bg-gray-200 px-3 py-1 rounded-md" onClick={refresh}>Refresh</button>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-600">No recorded failures.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.map((f) => (
            <li key={f.id} className="py-2">
              <div className="text-sm font-medium">{f.reason} <span className="text-gray-400 text-xs ml-2">{new Date(f.ts).toLocaleString()}</span></div>
              <pre className="text-xs text-gray-700 mt-1 bg-gray-50 p-2 rounded">{JSON.stringify(f.details, null, 2)}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
