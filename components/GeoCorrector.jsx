import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest, openAiApiRequest } from '../lib/api';
import { Spinner } from './icons';
import ProgressBar from './ProgressBar';

const GeoCorrector = ({ token, openAiKey }) => {
  const [format, setFormat] = useState('Full state name, full country name');
  const [corrections, setCorrections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const findMalignedData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setStatus('Fetching records with location data...');
    setCorrections([]);
    setProgress(5);

    try {
      const body = {
        limit: 5,
        filterGroups: [
          {
            filters: [
              { propertyName: 'city', operator: 'HAS_PROPERTY' },
              { propertyName: 'state', operator: 'HAS_PROPERTY' },
              { propertyName: 'country', operator: 'HAS_PROPERTY' },
            ],
          },
        ],
        properties: ['city', 'state', 'country'],
      };
      const { results } = await hubSpotApiRequest('/crm/v3/objects/contacts/search', 'POST', token, body);

      if (results.length === 0) {
        setStatus('No records with city, state, and country found to analyze.');
        setIsLoading(false);
        return;
      }

      setStatus('Analyzing data with AI...');
  setProgress(35);
      const prompt = `
                Analyze the following JSON array of contact location data. Correct any misaligned or misspelled city, state, and country combinations.
                Return a JSON object with a key "corrections" which is an array.
                Each item in the array must be an object with "id", and the corrected "city", "state", and "country" fields.
                Format the corrected data according to this style: "${format}".
                Only include contacts that require correction. If no corrections are needed, return an empty "corrections" array.
                Data: ${JSON.stringify(results.map((r) => ({ id: r.id, ...r.properties })))}
            `;

  const response = await openAiApiRequest(openAiKey, prompt);

  // after AI returns
  setProgress(80);

      const comparisonData = results.map((r) => ({ id: r.id, ...r.properties }));
      const proposedCorrections = (response.corrections || []).map((cor) => {
        const original = comparisonData.find((d) => d.id === cor.id) || {};
        return {
          id: cor.id,
          original: { city: original.city, state: original.state, country: original.country },
          corrected: { city: cor.city, state: cor.state, country: cor.country },
        };
      });

      setCorrections(proposedCorrections);
  setStatus(proposedCorrections.length > 0 ? `${proposedCorrections.length} potential corrections found.` : 'AI analysis complete. No corrections needed.');
  setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, openAiKey, format]);

  const applyCorrections = async () => {
    setIsUpdating(true);
    setError('');
    setStatus('Applying corrections...');

    setProgress(5);

    try {
      const updates = corrections.map((c) => ({
        id: c.id,
        properties: c.corrected,
      }));
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
      const batches = chunk(updates, 100);
      for (const b of batches) {
        await hubSpotApiRequest('/crm/v3/objects/contacts/batch/update', 'POST', token, { inputs: b });
        await sleep(300);
        setProgress((prev) => Math.min(95, prev + Math.round((100 / batches.length))));
      }
      setStatus('Successfully updated records.');
      setCorrections([]);
      setProgress(100);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const [progress, setProgress] = useState(0);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Geographic Data Correction</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Desired Format</label>
          <input type="text" value={format} onChange={(e) => setFormat(e.target.value)} className="w-full p-2 border rounded-md" />
        </div>
        <div className="flex items-center space-x-4 mb-4">
          <button onClick={findMalignedData} disabled={isLoading || !openAiKey} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center">
            {isLoading ? <Spinner /> : 'Find Misaligned Data'}
          </button>
          {corrections.length > 0 && (
            <button onClick={applyCorrections} disabled={isUpdating} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-green-300 flex items-center">
              {isUpdating ? <Spinner /> : 'Apply Corrections'}
            </button>
          )}
        </div>
        {(isLoading || isUpdating) && <ProgressBar percent={progress} text={isLoading ? 'Analyzing locations...' : 'Applying updates...'} />}
        {!openAiKey && <p className="text-yellow-600">OpenAI API Key is required for this feature.</p>}
        {error && <p className="text-red-500">{error}</p>}
        {(isLoading || isUpdating || status) && <p className="text-gray-600">{status}</p>}

        {corrections.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Record ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Original</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correction</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {corrections.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{`${c.original.city}, ${c.original.state}, ${c.original.country}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-semibold">{`${c.corrected.city}, ${c.corrected.state}, ${c.corrected.country}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeoCorrector;
