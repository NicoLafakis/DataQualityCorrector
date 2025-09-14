import React from 'react';

export default function ProgressBar({ percent = 0, text = '' }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-gray-600">{text || 'Progress'}</div>
        <div className="text-xs font-medium text-gray-600">{safe}%</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-600 h-3 rounded-full transition-all" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
