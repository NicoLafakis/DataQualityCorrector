import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../lib/api';
import { Spinner } from './icons';

const AnomalyDetector = ({ token }) => {
  const [objectType, setObjectType] = useState('contacts');
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

  const findAnomalies = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setAnomalies([]);

    try {
      const propertiesToFetch = ['firstname', 'lastname', 'email', 'website', 'hs_object_id'];
      let allRecords = [];
      let after = undefined;

      do {
        const path = `/crm/v3/objects/${objectType}?limit=100&properties=${propertiesToFetch.join(',')}${after ? `&after=${after}` : ''}`;
        const data = await hubSpotApiRequest(path, 'GET', token);
        allRecords = [...allRecords, ...data.results];
        after = data.paging?.next?.after;
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
      });

      setAnomalies(foundAnomalies);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [objectType, token]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Data Anomaly Detection</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <select value={objectType} onChange={(e) => setObjectType(e.target.value)} className="p-2 border rounded-md">
            <option value="contacts">Contacts</option>
            <option value="companies">Companies</option>
          </select>
          <button onClick={findAnomalies} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Scan for Anomalies'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {isLoading && <p>Scanning records...</p>}
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
