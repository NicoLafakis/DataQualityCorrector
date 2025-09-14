import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner, CheckCircleIcon, ExclamationCircleIcon } from './icons';
import ProgressBar from './ProgressBar';
import MergeModal from './MergeModal';
import { recordAction, recordFailure } from '../lib/history';

const CompanyDuplicateFinder = ({ token }) => {
  const [duplicates, setDuplicates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [mergeStatus, setMergeStatus] = useState({});

  const normalizeDomain = (d) => {
    if (!d) return '';
    const s = String(d).toLowerCase().trim();
    return s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  };

  const findDuplicates = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setStatus('Finding company duplicates (domain & name)...');
    setDuplicates([]);
    setMergeStatus({});
    setProgress(0);
    try {
      let all = [];
      let after = undefined;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      do {
        const path = `/crm/v3/objects/companies?limit=100&properties=name,domain,website,createdate${after ? `&after=${after}` : ''}`;
        const data = await hubSpotApiRequest(path, 'GET', token);
        all = all.concat(data.results || []);
        after = data.paging?.next?.after;
        if (after) await sleep(200);
        setProgress((prev) => Math.min(95, prev + 5));
      } while (after);

      // Group by domain
      const byDomain = all.reduce((acc, c) => {
        const key = normalizeDomain(c.properties?.domain || c.properties?.website);
        if (key) { (acc[key] = acc[key] || []).push(c); }
        return acc;
      }, {});

      // Group by exact name (case-insensitive) for those without domain
      const noDomain = all.filter((c) => !normalizeDomain(c.properties?.domain || c.properties?.website));
      const byName = noDomain.reduce((acc, c) => {
        const key = (c.properties?.name || '').trim().toLowerCase();
        if (key) { (acc[key] = acc[key] || []).push(c); }
        return acc;
      }, {});

      const groups = [
        ...Object.values(byDomain).filter((g) => g.length > 1),
        ...Object.values(byName).filter((g) => g.length > 1)
      ];
      setDuplicates(groups);
      setStatus(groups.length > 0 ? `Found ${groups.length} sets of duplicates.` : 'No duplicates found.');
      setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const [progress, setProgress] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalRecords, setModalRecords] = useState([]);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(null);

  const handleMerge = async (group) => {
    if (group.length < 2) return;
    setIsMerging(true);
    const sorted = group.slice().sort((a, b) => new Date(b.properties.createdate) - new Date(a.properties.createdate));
    const primary = sorted[0];
    const rest = sorted.slice(1);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const rec of rest) {
      setMergeStatus((prev) => ({ ...prev, [rec.id]: 'merging' }));
      try {
        const path = `/crm/v3/objects/companies/${primary.id}/merge`;
        const body = { objectIdToMerge: rec.id };
        await hubSpotApiRequest(path, 'POST', token, body);
        setMergeStatus((prev) => ({ ...prev, [rec.id]: 'merged' }));
        // record action snapshot for undo (best-effort)
        try {
          const snap = await hubSpotApiRequest(`/crm/v3/objects/companies/${rec.id}`, 'GET', token);
          recordAction('merged', primary.id, { primaryId: primary.id, mergeId: rec.id, source: 'company' }, { action: 'recreate', payload: { create: [{ properties: snap.properties || {} }] } });
        } catch (e) {
          recordFailure('company_snapshot_failed', { id: rec.id, error: e.message });
        }
      } catch (err) {
        setError(`Failed to merge ${rec.id}: ${err.message}`);
        setMergeStatus((prev) => ({ ...prev, [rec.id]: 'failed' }));
        recordFailure('company_merge_failed', { primaryId: primary.id, mergeId: rec.id, error: err.message });
      }
      // brief delay to avoid spamming merge endpoint
      await sleep(350);
    }
    await findDuplicates();
    setIsMerging(false);
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'merging': return <Spinner />;
      case 'merged': return <CheckCircleIcon />;
      case 'failed': return <ExclamationCircleIcon />;
      default: return null;
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Company Duplicate Management</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <button onClick={findDuplicates} disabled={isLoading || isMerging} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Find Company Duplicates'}
          </button>
        </div>
        {isLoading && <ProgressBar percent={progress} text="Scanning companies for duplicates..." />}
        {error && <p className="text-red-500">{error}</p>}
        {(isLoading || status) && <p className="text-gray-600">{status}</p>}

        {duplicates.length > 0 && (
          <div className="space-y-6">
            {duplicates.map((group, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Duplicate Set {index + 1}</h4>
                <ul className="divide-y divide-gray-200">
                  {group.map((record) => (
                    <li key={record.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{record.properties.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{record.properties.domain || record.properties.website || 'no-domain'}</span>
                        <span className="text-sm text-gray-500 ml-4">ID: {record.id}</span>
                      </div>
                      <div className="h-5 w-5">{getStatusIndicator(mergeStatus[record.id])}</div>
                    </li>
                  ))}
                </ul>
                <button onClick={() => handleMerge(group)} disabled={isMerging} className="mt-4 bg-orange-500 text-white px-3 py-1 text-sm rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                  Merge All into Newest Record
                </button>
                <button onClick={() => { const mapped = group.map((r) => ({ id: r.id, properties: r.properties || {} })); setModalRecords(mapped); setSelectedGroupIndex(index); setModalVisible(true); }} disabled={isMerging} className="mt-4 ml-3 bg-blue-600 text-white px-3 py-1 text-sm rounded-md hover:bg-blue-700 disabled:bg-blue-300">Select & Merge</button>
              </div>
            ))}
          </div>
        )}
        <MergeModal visible={modalVisible} records={modalRecords} onCancel={() => setModalVisible(false)} onConfirm={async (primaryId, mergeIds) => {
            // reuse pattern from DuplicateFinder: fetch snapshots, perform sequential merges, log failures
            setModalVisible(false);
            setIsMerging(true);
            try {
              const snapshots = [];
              for (const id of [primaryId, ...mergeIds]) {
                try {
                  const obj = await hubSpotApiRequest(`/crm/v3/objects/companies/${id}`, 'GET', token);
                  snapshots.push({ id, properties: obj.properties || {} });
                } catch (err) {
                  recordFailure('fetch_snapshot_failed', { id, error: err.message, source: 'company' });
                }
              }
              const undoPayload = { action: 'recreate', payload: { patch: [{ id: primaryId, properties: snapshots.find((s) => s.id === primaryId)?.properties || {} }], create: snapshots.filter((s) => s.id !== primaryId).map((s) => ({ properties: s.properties })) } };
              const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
              for (const mid of mergeIds) {
                try {
                  await hubSpotApiRequest(`/crm/v3/objects/companies/${primaryId}/merge`, 'POST', token, { objectIdToMerge: mid });
                  await sleep(400);
                } catch (err) {
                  recordFailure('merge_failed', { primaryId, mergeId: mid, error: err.message, source: 'company' });
                }
              }
              recordAction('merged', primaryId, { primaryId, mergeIds, source: 'company' }, undoPayload);
            } catch (err) {
              setError(err.message);
            } finally {
              setIsMerging(false);
            }
          }} />
      </div>
    </div>
  );
};

export default CompanyDuplicateFinder;
