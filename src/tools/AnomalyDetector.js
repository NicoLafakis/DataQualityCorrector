import React, { useState, useCallback } from 'react';
import { hubSpotApiRequest } from '../api';
import { Spinner } from '../ui';

// Helper functions specific to this tool
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
};

export const AnomalyDetector = ({ token }) => {
    const [objectType, setObjectType] = useState('contacts');
    const [anomalies, setAnomalies] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

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
            allRecords.forEach(record => {
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
        <div className="p-8">
            <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Data Anomaly Detection</h2>
                    <p className="text-slate-600">Identify and resolve data inconsistencies in your HubSpot records</p>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Scan Configuration</h3>
                        <p className="text-sm text-slate-600">Choose which object type to analyze</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                        <label className="text-sm font-medium text-slate-700">Object Type:</label>
                        <select
                            value={objectType}
                            onChange={e => setObjectType(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                        >
                            <option value="contacts">Contacts</option>
                            <option value="companies">Companies</option>
                        </select>
                    </div>
                    <button
                        onClick={findAnomalies}
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Spinner /> : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                Scan for Anomalies
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <ExclamationCircleIcon />
                        <p className="ml-3 text-sm text-red-800">{error}</p>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <Spinner />
                        <p className="ml-3 text-sm text-blue-800">Scanning records...</p>
                    </div>
                </div>
            )}

            {!isLoading && anomalies.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                        <h3 className="text-lg font-medium text-slate-900">Anomalies Found ({anomalies.length})</h3>
                        <p className="text-sm text-slate-600">Review and address the following data inconsistencies</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Record ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Property</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Anomalous Value</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Issue</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {anomalies.map((a, index) => (
                                    <tr key={index} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{a.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">{a.property}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={a.value}>{a.value}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                {a.reason}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!isLoading && !error && anomalies.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircleIcon />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Anomalies Found</h3>
                    <p className="text-slate-600">Your data looks clean! No anomalies were detected for the selected criteria.</p>
                </div>
            )}
        </div>
    );
};
