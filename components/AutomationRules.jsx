import React, { useState, useEffect, useCallback } from 'react';
import { listRules, saveRule, deleteRule, newRuleId, applyRules } from '../lib/rules';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';
import ProgressBar from './ProgressBar';

const OPS = [
  { value: 'lowercase', label: 'Lowercase' },
  { value: 'trim', label: 'Trim' },
  { value: 'titlecase', label: 'Title-case' },
  { value: 'email', label: 'Normalize email' },
  { value: 'phone', label: 'Normalize phone' },
  { value: 'country', label: 'Normalize country' },
  { value: 'state', label: 'Normalize state' },
  { value: 'date', label: 'Normalize date' },
];

export default function AutomationRules({ token }) {
  const [rules, setRules] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  const [objectType, setObjectType] = useState('contacts');
  const [error, setError] = useState('');
  const [schemas, setSchemas] = useState([]);

  useEffect(() => { setRules(listRules()); }, []);

  // Load schemas so rules can target any discovered object (standard + custom)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await hubSpotApiRequest('/crm/v3/schemas', 'GET', token);
        const list = (res.results || []).map((s) => ({ name: s.name, labels: s.labels }));
        const priority = ['contacts', 'companies', 'deals', 'tickets'];
        list.sort((a, b) => {
          const ia = priority.indexOf(a.name);
          const ib = priority.indexOf(b.name);
          const pa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
          const pb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
          return pa - pb || a.name.localeCompare(b.name);
        });
        setSchemas(list);
        if (!list.find((s) => s.name === objectType) && list.length) setObjectType(list[0].name);
      } catch (err) {
        // keep fallback
      }
    };
    load();
  }, [token]);

  const addRule = () => {
    const r = { id: newRuleId(), label: 'New rule', objectType, property: 'email', type: 'transform', config: { op: 'lowercase' }, enabled: true, createdAt: Date.now() };
    saveRule(r); setRules(listRules());
  };

  const updateRule = (id, patch) => {
    const r = rules.find((x) => x.id === id);
    if (!r) return;
    saveRule({ ...r, ...patch }); setRules(listRules());
  };

  const removeRule = (id) => { deleteRule(id); setRules(listRules()); };

  const applyNow = useCallback(async () => {
    setIsApplying(true); setError('');
    setProgress(0);
    try {
      // Fetch a page of records and apply enabled rules
      const props = 'hs_object_id,firstname,lastname,email,website,phone,city,state,country,name,domain';
      const res = await hubSpotApiRequest(`/crm/v3/objects/${objectType}?limit=100&properties=${props}`, 'GET', token);
      const records = res.results || [];
      const { updates } = applyRules(objectType, records, rules);
      if (updates.length) {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const chunks = Array.from({ length: Math.ceil(updates.length / 100) }, (_, i) => updates.slice(i * 100, i * 100 + 100));
        for (const batch of chunks) {
          await hubSpotApiRequest(`/crm/v3/objects/${objectType}/batch/update`, 'POST', token, { inputs: batch });
          await sleep(300);
          setProgress((prev) => Math.min(95, prev + Math.round(100 / chunks.length)));
        }
        setProgress(100);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  }, [objectType, token, rules]);

  const [progress, setProgress] = useState(0);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Automation Rules</h3>
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
          <button onClick={addRule} className="bg-blue-600 text-white px-4 py-2 rounded-md">Add Rule</button>
          <button onClick={applyNow} disabled={isApplying} className="bg-green-600 text-white px-4 py-2 rounded-md disabled:bg-green-300 flex items-center">{isApplying ? <Spinner /> : 'Apply Now (sample)'}
          </button>
        </div>
  {isApplying && <ProgressBar percent={progress} text="Applying automation rules..." />}
        {error && <p className="text-red-500">{error}</p>}
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="border border-gray-200 rounded-md p-3">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                <input className="p-2 border rounded" value={r.label} onChange={(e) => updateRule(r.id, { label: e.target.value })} />
                <select className="p-2 border rounded" value={r.objectType} onChange={(e) => updateRule(r.id, { objectType: e.target.value })}>
                  {schemas.length > 0 ? (
                    schemas.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)
                  ) : (
                    <>
                      <option value="contacts">contacts</option>
                      <option value="companies">companies</option>
                    </>
                  )}
                </select>
                <input className="p-2 border rounded" value={r.property} onChange={(e) => updateRule(r.id, { property: e.target.value })} />
                <select className="p-2 border rounded" value={r.config?.op || 'lowercase'} onChange={(e) => updateRule(r.id, { config: { ...(r.config || {}), op: e.target.value } })}>
                  {OPS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <label className="inline-flex items-center space-x-2">
                  <input type="checkbox" checked={!!r.enabled} onChange={(e) => updateRule(r.id, { enabled: e.target.checked })} />
                  <span>Enabled</span>
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => removeRule(r.id)} className="text-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {rules.length === 0 && <p className="text-gray-500">No rules yet. Click "Add Rule" to create one.</p>}
        </div>
      </div>
    </div>
  );
}
