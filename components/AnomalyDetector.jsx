import React, { useState, useCallback, useEffect } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';
import ProgressBar from './ProgressBar';

const AnomalyDetector = ({ token }) => {
  const [objectType, setObjectType] = useState('contacts');
  const [schemas, setSchemas] = useState([]);
  const [availableProps, setAvailableProps] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  // Load schemas for dynamic object selection
  useEffect(() => {
    const load = async () => {
      try {
        const res = await hubSpotApiRequest('/crm/v3/schemas', 'GET', token);
        const list = (res.results || []).map((s) => ({ name: s.name, labels: s.labels }));
        const priority = ['contacts', 'companies', 'deals', 'tickets'];
        list.sort((a, b) => (priority.indexOf(a.name) + 999) - (priority.indexOf(b.name) + 999) || a.name.localeCompare(b.name));
        setSchemas(list);
      } catch {}
    };
    load();
  }, [token]);

  // Load available properties for the selected object for smarter scans
  useEffect(() => {
    const loadProps = async () => {
      try {
        const propRes = await hubSpotApiRequest(`/crm/v3/properties/${objectType}`, 'GET', token);
        const props = propRes.results || propRes || [];
        setAvailableProps(props);
      } catch { setAvailableProps([]); }
    };
    if (objectType) loadProps();
  }, [objectType, token]);

  const findAnomalies = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setAnomalies([]);
    setProgress(0);

    try {
      // Heuristically choose relevant props by name if present for the selected object
      const propNames = new Set((availableProps || []).map((p) => p.name));
      const wanted = ['firstname', 'lastname', 'email', 'website', 'domain'];
      const propertiesToFetch = ['hs_object_id', ...wanted.filter((n) => propNames.has(n))];
      let allRecords = [];
      let after = undefined;
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      do {
        const path = `/crm/v3/objects/${objectType}?limit=100&properties=${propertiesToFetch.join(',')}${after ? `&after=${after}` : ''}`;
        const data = await hubSpotApiRequest(path, 'GET', token);
        allRecords = [...allRecords, ...data.results];
        after = data.paging?.next?.after;
        // brief pause between pages
        if (after) await sleep(200);
        setProgress((prev) => Math.min(95, prev + 5));
      } while (after);

      const foundAnomalies = [];
      allRecords.forEach((record) => {
        const { properties } = record;
        if (properties.email && !isValidEmail(properties.email)) {
          foundAnomalies.push({ id: properties.hs_object_id, property: 'email', value: properties.email, reason: 'Invalid email format' });
        }
        if (properties.website && !isValidUrl(properties.website)) {
          foundAnomalies.push({ id: properties.hs_object_id, property: 'website', value: properties.website, reason: 'Invalid URL format' });
        }
        if (!properties.website && properties.domain) {
          try { new URL(`http://${properties.domain}`); } catch { foundAnomalies.push({ id: properties.hs_object_id, property: 'domain', value: properties.domain, reason: 'Possibly invalid domain' }); }
        }
      });

      setAnomalies(foundAnomalies);
      setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [objectType, token]);

  const [progress, setProgress] = useState(0);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Data Anomaly Detection</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className="p-2 border rounded-md">
            {schemas.length > 0 ? (
              schemas.map((s) => (
                <option key={s.name} value={s.name}>{s.labels?.plural || s.name}</option>
              ))
            ) : (
              <>
                <option value="contacts">Contacts</option>
                <option value="companies">Companies</option>
              </>
            )}
          </select>
          <button onClick={findAnomalies} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Scan for Anomalies'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
  {isLoading && <ProgressBar percent={progress} text="Scanning records for anomalies..." />}
        {!isLoading && anomalies.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anomalous Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {anomalies.map((a, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{a.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{a.property}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" style={{ maxWidth: '200px' }}>
                      {a.value}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && anomalies.length === 0 && <p>No anomalies found for the selected criteria.</p>}
      </div>
    </div>
  );
};

export default AnomalyDetector;
