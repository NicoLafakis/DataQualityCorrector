import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner, CheckCircleIcon, ExclamationCircleIcon } from './icons';

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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

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
      } catch (err) {
        setError(`Failed to merge ${rec.id}: ${err.message}`);
        setMergeStatus((prev) => ({ ...prev, [rec.id]: 'failed' }));
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyDuplicateFinder;
