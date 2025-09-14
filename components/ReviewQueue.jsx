import React, { useEffect, useState } from 'react';
import { listActions, recordAction, undoAction } from '../lib/history';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';
import ProgressBar from './ProgressBar';

export default function ReviewQueue({ token }) {
  const [actions, setActions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => { setActions(listActions()); }, []);

  const refresh = () => setActions(listActions());

  const handleAccept = async (action) => {
    setIsProcessing(true); setError('');
    setProgress(0);
    try {
      // Process known suggestion types
      if (action.type === 'merge_suggestion') {
        const primaryId = action.payload.primaryId;
        const mergeIds = action.payload.mergeIds || [];
        // Process sequentially and adapt to HubSpot rate-limit headers
        for (const mid of mergeIds) {
          try {
            const res = await hubSpotApiRequest(`/crm/v3/objects/contacts/${primaryId}/merge`, 'POST', token, { objectIdToMerge: mid });
            // hubSpotApiRequest attaches response headers as __headers on the returned data when available
            const headers = res && res.__headers;
            try {
              const retryAfter = headers?.get?.('retry-after');
              if (retryAfter) {
                // Retry-After can be seconds or a date
                const asNum = Number(retryAfter);
                let delayMs = 0;
                if (!Number.isNaN(asNum)) delayMs = asNum * 1000;
                else {
                  const dateMs = Date.parse(retryAfter);
                  if (!Number.isNaN(dateMs)) delayMs = Math.max(0, dateMs - Date.now());
                }
                if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
              } else {
                const remaining = Number(headers?.get?.('x-hubspot-ratelimit-remaining'));
                const intervalMs = Number(headers?.get?.('x-hubspot-ratelimit-interval-milliseconds'));
                if (!Number.isNaN(remaining) && remaining < 5) {
                  // slow down when remaining requests are low
                  const delay = (!Number.isNaN(intervalMs) && intervalMs > 0) ? Math.max(intervalMs, 1000) : 2000;
                  await new Promise((r) => setTimeout(r, delay));
                } else if (!Number.isNaN(intervalMs) && intervalMs > 0) {
                  // in normal conditions respect provided interval
                  await new Promise((r) => setTimeout(r, Math.max(200, Math.floor(intervalMs / 2))));
                } else {
                  // conservative short pause
                  await new Promise((r) => setTimeout(r, 300));
                }
              }
            } catch (_) {}
            // update progress per mergeId processed
            setProgress((prev) => Math.min(95, prev + Math.round(100 / Math.max(1, mergeIds.length))));
          } catch (err) {
            // Record error but continue processing others
            setError((prev) => prev ? prev + `; ${err.message}` : err.message);
          }
        }
        setProgress(100);
      }

      // mark as accepted in local history
      recordAction('accepted', action.targetId, { sourceId: action.id }, null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
    setIsProcessing(false);
  };

  const handleReject = (action) => {
    // mark as rejected
    recordAction('rejected', action.targetId, { sourceId: action.id }, null);
    refresh();
  };

  const toggleSelect = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const handleBulkAccept = async () => {
    const toProcess = actions.filter((a) => selected.has(a.id));
    for (const a of toProcess) await handleAccept(a);
  };

  const handleBulkReject = () => {
    const toProcess = actions.filter((a) => selected.has(a.id));
    for (const a of toProcess) handleReject(a);
  };

  const handleUndo = async (action) => {
    setIsProcessing(true); setError('');
    setProgress(0);
    try {
      const undoPayload = undoAction(action.id);
      if (!undoPayload) throw new Error('No undo information available');
      // example undo for merge: undoPayload = { action: 'recreate', payload: { ... } }
      if (undoPayload.action === 'patch') {
        // apply batch/patch to revert fields
        await hubSpotApiRequest(`/crm/v3/objects/contacts/batch/update`, 'POST', token, { inputs: undoPayload.payload });
      } else if (undoPayload.action === 'recreate') {
        // Attempt to restore primary's fields and recreate secondaries
        const patchInputs = undoPayload.payload.patch || [];
        const createInputs = undoPayload.payload.create || [];
        if (patchInputs.length > 0) {
          await hubSpotApiRequest(`/crm/v3/objects/contacts/batch/update`, 'POST', token, { inputs: patchInputs });
          setProgress(40);
        }
        // recreate removed records
        if (createInputs.length > 0) {
          // HubSpot batch create endpoint expects { inputs: [ { properties } ] }
            try {
              await hubSpotApiRequest(`/crm/v3/objects/contacts/batch/create`, 'POST', token, { inputs: createInputs });
              setProgress(80);
            } catch (err) {
              // fallback: create one-by-one
              for (const c of createInputs) {
                try { await hubSpotApiRequest(`/crm/v3/objects/contacts`, 'POST', token, { properties: c.properties }); } catch (e) { /* best-effort */ }
                setProgress((prev) => Math.min(95, prev + Math.round(80 / createInputs.length)));
              }
            }
        }
      }
      recordAction('undone', action.targetId, { sourceId: action.id }, null);
      refresh();
    } catch (err) { setError(err.message); }
    setIsProcessing(false);
  };

  const [progress, setProgress] = useState(0);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Review Queue</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        {error && <p className="text-red-500">{error}</p>}
  {isProcessing && <div><p className="text-gray-600"><Spinner /> Processing…</p><ProgressBar percent={progress} text="Processing review queue..." /></div>}
        {actions.length === 0 && <p className="text-gray-500">No pending suggested actions.</p>}
        {actions.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={handleBulkAccept} className="bg-green-600 text-white px-3 py-1 rounded-md">Accept Selected</button>
              <button onClick={handleBulkReject} className="bg-gray-300 px-3 py-1 rounded-md">Reject Selected</button>
              <span className="text-sm text-gray-500">{selected.size} selected</span>
            </div>
            <div className="space-y-4">
              {actions.map((a) => (
                <div key={a.id} className="border p-3 rounded-md flex items-start gap-3">
                  <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelect(a.id)} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{a.type} • {a.targetId}</div>
                        <div className="text-sm text-gray-500">{new Date(a.ts).toLocaleString()}</div>
                      </div>
                      <div className="text-sm text-gray-500">Source: {a.payload?.source || 'unknown'} • Confidence: {a.payload?.topScore ? a.payload.topScore.toFixed(3) : 'n/a'}</div>
                    </div>
                    <div className="mt-2 space-x-2">
                      <button onClick={() => handleAccept(a)} className="bg-green-600 text-white px-3 py-1 rounded-md">Accept</button>
                      <button onClick={() => handleReject(a)} className="bg-gray-300 px-3 py-1 rounded-md">Reject</button>
                      <button onClick={() => handleUndo(a)} className="bg-yellow-500 text-white px-3 py-1 rounded-md">Undo</button>
                    </div>
                    <pre className="mt-2 text-xs text-gray-600">{JSON.stringify(a.payload, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
