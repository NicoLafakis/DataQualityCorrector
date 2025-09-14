import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner, CheckCircleIcon, ExclamationCircleIcon } from './icons';
import { recordAction } from '../lib/history';
import { recordFailure } from '../lib/history';
import MergeModal from './MergeModal';
import ProgressBar from './ProgressBar';

const DuplicateFinder = ({ token }) => {
  const [duplicates, setDuplicates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [mergeStatus, setMergeStatus] = useState({});

  const findDuplicatesByEmail = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setStatus('Finding duplicates by email...');
    setDuplicates([]);
    setMergeStatus({});
    setProgress(0);
    try {
      let allContacts = [];
      let after = undefined;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      do {
        const path = `/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,createdate${after ? `&after=${after}` : ''}`;
        const data = await hubSpotApiRequest(path, 'GET', token);
        allContacts = [...allContacts, ...data.results];
        after = data.paging?.next?.after;
        if (after) await sleep(200);
        setProgress((prev) => Math.min(95, prev + 5));
      } while (after);

      const emails = allContacts.reduce((acc, contact) => {
        const email = contact.properties.email?.toLowerCase();
        if (email) {
          if (!acc[email]) acc[email] = [];
          acc[email].push(contact);
        }
        return acc;
      }, {});

      const foundDuplicates = Object.values(emails).filter((group) => group.length > 1);
      setDuplicates(foundDuplicates);
      setStatus(foundDuplicates.length > 0 ? `Found ${foundDuplicates.length} sets of duplicates.` : 'No duplicates found by email.');
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

  // Open merge modal for a specific duplicate group
  const openMergeModal = (group, index) => {
    setModalRecords(group);
    setSelectedGroupIndex(index);
    setModalVisible(true);
  };

  // Execute merges after modal confirm(primaryId, mergeIds)
  const executeMerge = async (primaryId, mergeIds) => {
    if (!primaryId || !mergeIds || mergeIds.length === 0) return;
    setModalVisible(false);
    setIsMerging(true);
    setError('');
    try {
      // capture snapshots for undo
      const snapshots = [];
      const idsToFetch = [primaryId, ...mergeIds];
      for (const id of idsToFetch) {
        try {
          const obj = await hubSpotApiRequest(`/crm/v3/objects/contacts/${id}`, 'GET', token);
          snapshots.push({ id, properties: obj.properties || {} });
        } catch (err) {
          // flag and skip malformed records
          recordFailure('fetch_snapshot_failed', { id, error: err.message });
        }
      }

      const undoPayload = {
        action: 'recreate',
        payload: {
          patch: [{ id: primaryId, properties: snapshots.find((s) => s.id === primaryId)?.properties || {} }],
          create: snapshots.filter((s) => s.id !== primaryId).map((s) => ({ properties: s.properties }))
        }
      };

      // perform merges sequentially and respect rate limits
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (const mid of mergeIds) {
        try {
          setMergeStatus((prev) => ({ ...prev, [mid]: 'merging' }));
          await hubSpotApiRequest(`/crm/v3/objects/contacts/${primaryId}/merge`, 'POST', token, { objectIdToMerge: mid });
          setMergeStatus((prev) => ({ ...prev, [mid]: 'merged' }));
          // small pause to avoid hitting limits
          await sleep(400);
        } catch (err) {
          setMergeStatus((prev) => ({ ...prev, [mid]: 'failed' }));
          recordFailure('merge_failed', { primaryId, mergeId: mid, error: err.message });
        }
      }

      // record action for history
      const payload = { primaryId, mergeIds, source: 'email' };
      recordAction('merged', primaryId, payload, undoPayload);
      setStatus('Merge completed.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsMerging(false);
    }
  };

  const getStatusIndicator = (status) => {
    switch (status) {
      case 'merging':
        return <Spinner />;
      case 'merged':
        return <CheckCircleIcon />;
      case 'failed':
        return <ExclamationCircleIcon />;
      default:
        return null;
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Duplicate Management (by Email)</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <button onClick={findDuplicatesByEmail} disabled={isLoading || isMerging} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Find Contact Duplicates'}
          </button>
        </div>
        {isLoading && <ProgressBar percent={progress} text="Scanning contacts for duplicates..." />}
        {error && <p className="text-red-500">{error}</p>}
        {(isLoading || status) && <p className="text-gray-600">{status}</p>}

        {duplicates.length > 0 && (
          <div className="space-y-6">
            {duplicates.map((group, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  Duplicate Set {index + 1} for: <span className="font-mono text-blue-700">{group[0].properties.email}</span>
                </h4>
                <ul className="divide-y divide-gray-200">
                  {group.map((record) => (
                    <li key={record.id} className="py-2 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{record.properties.firstname} {record.properties.lastname}</span>
                        <span className="text-sm text-gray-500 ml-4">ID: {record.id}</span>
                      </div>
                      <div className="h-5 w-5">{getStatusIndicator(mergeStatus[record.id])}</div>
                    </li>
                  ))}
                </ul>
                        <div className="flex items-center justify-between">
                          <button onClick={() => openMergeModal(group, index)} disabled={isMerging} className="mt-4 bg-blue-600 text-white px-3 py-1 text-sm rounded-md hover:bg-blue-700 disabled:bg-blue-300">Select & Merge</button>
                          <button onClick={() => {
                            // lightweight fallback: record suggestion for review queue
                            const sorted = group.slice().sort((a,b) => new Date(b.properties.createdate) - new Date(a.properties.createdate));
                            const primary = sorted[0];
                            const rest = sorted.slice(1);
                            const payload = { primaryId: primary.id, mergeIds: rest.map((r) => r.id), source: 'email' };
                            recordAction('merge_suggestion', primary.id, payload, null);
                            setStatus('Merge suggestion recorded to review queue');
                          }} disabled={isMerging} className="mt-4 bg-yellow-500 text-white px-3 py-1 text-sm rounded-md hover:bg-yellow-600 disabled:bg-yellow-300">Suggest Merge</button>
                        </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateFinder;
