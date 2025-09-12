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
        <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Property Fill Rate</h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-4 mb-4">
                     <select value={objectType} onChange={e => setObjectType(e.target.value)} className="p-2 border rounded-md">
                        <option value="contacts">Contacts</option>
                        <option value="companies">Companies</option>
                        <option value="deals">Deals</option>
                        <option value="tickets">Tickets</option>
                    </select>
                    <button onClick={calculateRates} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
                        {isLoading ? <Spinner /> : 'Calculate Fill Rates'}
                    </button>
                </div>
                {error && <p className="text-red-500">{error}</p>}
                {isLoading && <p>Calculating rates... This may take a moment for portals with many properties.</p>}
                {!isLoading && rates.length > 0 && (
                    <div className="space-y-4">
                        {Object.entries(groupedRates).sort().map(([groupName, props]) =>(
                            <div key={groupName}>
                                <h4 className="text-lg font-medium text-gray-700 capitalize mb-2">{groupName.replace(/_/g, ' ')}</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {props.sort((a,b) => a.name.localeCompare(b.name)).map((prop, index) => (
                                    <div key={index} className="bg-gray-50 p-3 rounded-md">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600 font-medium">{prop.name}</span>
                                            <span className="font-semibold text-gray-800">{prop.rate}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${prop.rate}%` }}></div>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {!isLoading && !error && rates.length === 0 && <p>No properties to analyze. Please run a calculation.</p>}
            </div>
        </div>
    );
};
