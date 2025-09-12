import React, { useState, useCallback, useMemo } from 'react';
import { hubSpotApiRequest } from '../api';
import { Spinner } from '../ui';

export const PropertyFillRate = ({ token }) => {
    const [rates, setRates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [objectType, setObjectType] = useState('contacts');

    const calculateRates = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setRates([]);
        try {
            const { total } = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, { limit: 1, filterGroups: [] });
            if (total === 0) {
                setRates([]);
                setIsLoading(false);
                return;
            }

            const { results: properties } = await hubSpotApiRequest(`/crm/v3/properties/${objectType}`, 'GET', token);
            
            const ratePromises = properties.map(async (prop) => {
                const body = {
                    limit: 1,
                    filterGroups: [{ filters: [{ propertyName: prop.name, operator: 'HAS_PROPERTY' }] }]
                };
                const { total: filledCount } = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, body);
                const rate = total > 0 ? (filledCount / total) * 100 : 0;
                return { name: prop.label, rate: rate.toFixed(2), group: prop.groupName };
            });

            const calculatedRates = await Promise.all(ratePromises);
            setRates(calculatedRates);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [objectType, token]);
    
    const groupedRates = useMemo(() => {
        return rates.reduce((acc, rate) => {
            const group = rate.group || 'nogroup';
            if(!acc[group]) acc[group] = [];
            acc[group].push(rate);
            return acc;
        }, {});
    }, [rates]);


    return (
        <div className="p-8">
            <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                    <ChartPieIcon className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Property Fill Rate Analysis</h2>
                    <p className="text-slate-600">Analyze completion rates across all properties in your HubSpot objects</p>
                </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Analysis Configuration</h3>
                        <p className="text-sm text-slate-600">Select the object type to analyze property completion</p>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                        <label className="text-sm font-medium text-slate-700">Object Type:</label>
                        <select
                            value={objectType}
                            onChange={e => setObjectType(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                        >
                            <option value="contacts">Contacts</option>
                            <option value="companies">Companies</option>
                            <option value="deals">Deals</option>
                            <option value="tickets">Tickets</option>
                        </select>
                    </div>
                    <button
                        onClick={calculateRates}
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading ? <Spinner /> : (
                            <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Calculate Fill Rates
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
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                    <div className="flex items-center">
                        <Spinner />
                        <p className="ml-3 text-sm text-green-800">Calculating rates... This may take a moment for portals with many properties.</p>
                    </div>
                </div>
            )}

            {!isLoading && rates.length > 0 && (
                <div className="space-y-6">
                    {Object.entries(groupedRates).sort().map(([groupName, props]) => (
                        <div key={groupName} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                                <h3 className="text-lg font-medium text-slate-900 capitalize">
                                    {groupName.replace(/_/g, ' ')} Properties
                                </h3>
                                <p className="text-sm text-slate-600">{props.length} properties in this group</p>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {props.sort((a,b) => a.name.localeCompare(b.name)).map((prop, index) => (
                                        <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                            <div className="flex justify-between items-start mb-3">
                                                <h4 className="text-sm font-medium text-slate-900 leading-tight">{prop.name}</h4>
                                                <span className="text-lg font-semibold text-slate-700">{prop.rate}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-2">
                                                <div
                                                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${prop.rate}%` }}
                                                ></div>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-500">
                                                {prop.rate >= 80 ? 'Excellent' : prop.rate >= 60 ? 'Good' : prop.rate >= 40 ? 'Fair' : 'Needs Attention'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && !error && rates.length === 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No Data to Analyze</h3>
                    <p className="text-slate-600">Run a calculation to view property fill rates for the selected object type.</p>
                </div>
            )}
        </div>
    );
};
