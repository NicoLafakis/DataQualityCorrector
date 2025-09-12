import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner, CheckCircleIcon, ExclamationCircleIcon } from './icons';

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
    try {
      let allContacts = [];
      let after = undefined;
      do {
        const path = `/crm/v3/objects/contacts?limit=100&properties=email,firstname,lastname,createdate${after ? `&after=${after}` : ''}`;
        const data = await hubSpotApiRequest(path, 'GET', token);
        allContacts = [...allContacts, ...data.results];
        after = data.paging?.next?.after;
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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const handleMerge = async (group) => {
    if (group.length < 2) return;
    setIsMerging(true);
    const sortedGroup = group.sort((a, b) => new Date(b.properties.createdate) - new Date(a.properties.createdate));
    const primaryRecord = sortedGroup[0];
    const recordsToMerge = sortedGroup.slice(1);

    for (const recordToMerge of recordsToMerge) {
      setMergeStatus((prev) => ({ ...prev, [recordToMerge.id]: 'merging' }));
      try {
        const path = `/crm/v3/objects/contacts/${primaryRecord.id}/merge`;
        const body = { objectIdToMerge: recordToMerge.id };
        await hubSpotApiRequest(path, 'POST', token, body);
        setMergeStatus((prev) => ({ ...prev, [recordToMerge.id]: 'merged' }));
      } catch (err) {
        setError(`Failed to merge ${recordToMerge.id}: ${err.message}`);
        setMergeStatus((prev) => ({ ...prev, [recordToMerge.id]: 'failed' }));
      }
    }

    await findDuplicatesByEmail();
    setIsMerging(false);
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
                <button onClick={() => handleMerge(group)} disabled={isMerging} className="mt-4 bg-orange-500 text-white px-3 py-1 text-sm rounded-md hover:bg-orange-600 disabled:bg-orange-300">
                  Merge All into Newest Record
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateFinder;
