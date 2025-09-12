import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest, openAiApiRequest } from '../api';
import { Spinner } from '../ui';

export const GeoCorrector = ({ token, openAiKey }) => {
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
        
        try {
            const body = {
                limit: 5, // Limit for demonstration
                filterGroups: [{
                    filters: [
                        { propertyName: 'city', operator: 'HAS_PROPERTY' },
                        { propertyName: 'state', operator: 'HAS_PROPERTY' },
                        { propertyName: 'country', operator: 'HAS_PROPERTY' },
                    ]
                }],
                properties: ['city', 'state', 'country']
            };
            const { results } = await hubSpotApiRequest('/crm/v3/objects/contacts/search', 'POST', token, body);

            if (results.length === 0) {
                setStatus('No records with city, state, and country found to analyze.');
                setIsLoading(false);
                return;
            }

            setStatus('Analyzing data with AI...');
            const prompt = `
                Analyze the following JSON array of contact location data. Correct any misaligned or misspelled city, state, and country combinations.
                Return a JSON object with a key "corrections" which is an array.
                Each item in the array must be an object with "id", and the corrected "city", "state", and "country" fields.
                Format the corrected data according to this style: "${format}".
                Only include contacts that require correction. If no corrections are needed, return an empty "corrections" array.
                Data: ${JSON.stringify(results.map(r => ({id: r.id, ...r.properties})))}
            `;
            
            const response = await openAiApiRequest(openAiKey, prompt);

            const comparisonData = results.map(r => ({ id: r.id, ...r.properties }));
            const proposedCorrections = response.corrections.map(cor => {
                const original = comparisonData.find(d => d.id === cor.id);
                return {
                    id: cor.id,
                    original: { city: original.city, state: original.state, country: original.country },
                    corrected: { city: cor.city, state: cor.state, country: cor.country },
                }
            });

            setCorrections(proposedCorrections);
            setStatus(proposedCorrections.length > 0 ? `${proposedCorrections.length} potential corrections found.` : 'AI analysis complete. No corrections needed.');
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
        
        try {
            const updates = corrections.map(c => ({
                id: c.id,
                properties: c.corrected
            }));
            const body = { inputs: updates };
            await hubSpotApiRequest('/crm/v3/objects/contacts/batch/update', 'POST', token, body);
            setStatus('Successfully updated records.');
            setCorrections([]);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsUpdating(false);
        }
    };
    
    return (
        <div className="p-8">
            <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                    <GlobeIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Geographic Data Correction</h2>
                    <p className="text-slate-600">Use AI to correct and standardize location data in your HubSpot records</p>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Correction Configuration</h3>
                        <p className="text-sm text-slate-600">Define the desired format for corrected location data</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Desired Format</label>
                        <input
                            type="text"
                            value={format}
                            onChange={e => setFormat(e.target.value)}
                            className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                            placeholder="e.g., Full state name, full country name"
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            onClick={findMalignedData}
                            disabled={isLoading || !openAiKey}
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? <Spinner /> : (
                                <>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Find Misaligned Data
                                </>
                            )}
                        </button>
                        {corrections.length > 0 && (
                            <button
                                onClick={applyCorrections}
                                disabled={isUpdating}
                                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {isUpdating ? <Spinner /> : (
                                    <>
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Apply Corrections
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {!openAiKey && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p className="text-sm text-yellow-800">OpenAI API Key is required for this feature.</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <ExclamationCircleIcon />
                        <p className="ml-3 text-sm text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {(isLoading || isUpdating || status) && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <Spinner />
                        <p className="ml-3 text-sm text-purple-800">{status}</p>
                    </div>
                </div>
            )}

            {corrections.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-medium text-slate-900">Corrections Found ({corrections.length})</h3>
                        <p className="text-sm text-slate-600">Review the proposed changes before applying them</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Record ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Original Location</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Corrected Location</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {corrections.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{c.id}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {`${c.original.city}, ${c.original.state}, ${c.original.country}`}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="font-medium text-green-700">
                                                {`${c.corrected.city}, ${c.corrected.state}, ${c.corrected.country}`}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
