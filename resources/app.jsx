import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- ICONS ---
const ShieldCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ChartPieIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
  </svg>
);
const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2h1a2 2 0 002-2v-1a2 2 0 012-2h1.945M12 3v2.553m0 12.894V21M3.055 11A9 9 0 0112 3m0 18a9 9 0 01-8.945-8M20.945 11A9 9 0 0012 3m8.945 8a9 9 0 01-8.945 8" />
  </svg>
);
const DocumentDuplicateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// --- UI COMPONENTS ---
const ExclamationCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);
const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);
const Spinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
);

// --- API ABSTRACTION ---
const apiRequest = async (endpoint, method, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    try {
        const response = await fetch(endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error (${response.status}): ${errorData.message}`);
        }
        return response.status === 204 ? null : await response.json();
    } catch (error) {
        console.error("API request failed:", error);
        throw error;
    }
};

const hubSpotApiRequest = (path, method, token, body = null) => {
    return apiRequest('/api/hubspot', 'POST', { path, method, token, body });
};

const openAiApiRequest = (apiKey, prompt) => {
    return apiRequest('/api/openai', 'POST', { apiKey, prompt });
};


// --- TOOL COMPONENTS ---

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
        <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Data Anomaly Detection</h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex items-center space-x-4 mb-4">
                    <select value={objectType} onChange={e => setObjectType(e.target.value)} className="p-2 border rounded-md">
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" style={{ maxWidth: '200px' }}>{a.value}</td>
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

const PropertyFillRate = ({ token }) => {
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
        <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Geographic Data Correction</h3>
            <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desired Format</label>
                    <input type="text" value={format} onChange={e => setFormat(e.target.value)} className="w-full p-2 border rounded-md" />
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
                                {corrections.map(c => (
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

            const foundDuplicates = Object.values(emails).filter(group => group.length > 1);
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
        const sortedGroup = group.sort((a,b) => new Date(b.properties.createdate) - new Date(a.properties.createdate));
        const primaryRecord = sortedGroup[0];
        const recordsToMerge = sortedGroup.slice(1);

        for (const recordToMerge of recordsToMerge) {
            setMergeStatus(prev => ({...prev, [recordToMerge.id]: 'merging'}));
            try {
                const path = `/crm/v3/objects/contacts/${primaryRecord.id}/merge`;
                const body = { objectIdToMerge: recordToMerge.id };
                await hubSpotApiRequest(path, 'POST', token, body);
                setMergeStatus(prev => ({...prev, [recordToMerge.id]: 'merged'}));
            } catch (err) {
                 setError(`Failed to merge ${recordToMerge.id}: ${err.message}`);
                 setMergeStatus(prev => ({...prev, [recordToMerge.id]: 'failed'}));
            }
        }
        
        await findDuplicatesByEmail(); 
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
                                <h4 className="font-semibold text-gray-800 mb-2">Duplicate Set {index + 1} for: <span className="font-mono text-blue-700">{group[0].properties.email}</span></h4>
                                <ul className="divide-y divide-gray-200">
                                    {group.map(record => (
                                        <li key={record.id} className="py-2 flex justify-between items-center">
                                            <div>
                                                <span className="font-medium">{record.properties.firstname} {record.properties.lastname}</span>
                                                <span className="text-sm text-gray-500 ml-4">ID: {record.id}</span>
                                            </div>
                                            <div className="h-5 w-5">
                                            {getStatusIndicator(mergeStatus[record.id])}
                                            </div>
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

// --- MAIN APP COMPONENT ---
export default function App() {
    const [hubSpotToken, setHubSpotToken] = useState('');
    const [openAiKey, setOpenAiKey] = useState('');
    const [activeTab, setActiveTab] = useState('anomalies');
    const [tokenValid, setTokenValid] = useState(null);
    const [isCheckingToken, setIsCheckingToken] = useState(false);

    // Read API keys from URL on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const hsToken = params.get('hubSpotToken');
        const oaKey = params.get('openAiKey');
        if (hsToken) {
            setHubSpotToken(hsToken);
        }
        if (oaKey) {
            setOpenAiKey(oaKey);
        }
    }, []);

    // Validate HubSpot token whenever it changes
    useEffect(() => {
        const handler = setTimeout(() => {
            if (hubSpotToken) {
                const checkToken = async () => {
                    setIsCheckingToken(true);
                    try {
                        // This token check needs to go through the proxy as well
                        await hubSpotApiRequest('/oauth/v1/access-tokens/' + hubSpotToken.split(' ').pop(), 'GET', hubSpotToken);
                        setTokenValid(true);
                    } catch (error) {
                        setTokenValid(false);
                    } finally {
                        setIsCheckingToken(false);
                    }
                };
                checkToken();
            } else {
                setTokenValid(null);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [hubSpotToken]);

    const TABS = {
        anomalies: { label: 'Anomalies', icon: <ShieldCheckIcon />, component: <AnomalyDetector token={hubSpotToken} /> },
        fillRate: { label: 'Fill Rate', icon: <ChartPieIcon />, component: <PropertyFillRate token={hubSpotToken} /> },
        geoCorrect: { label: 'Geo Correction', icon: <GlobeIcon />, component: <GeoCorrector token={hubSpotToken} openAiKey={openAiKey} /> },
        duplicates: { label: 'Duplicates', icon: <DocumentDuplicateIcon />, component: <DuplicateFinder token={hubSpotToken} /> },
    };

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <header className="bg-white shadow-md">
                <div className="container mx-auto px-6 py-4">
                    <h1 className="text-3xl font-bold text-gray-800">HubSpot Data Quality Suite</h1>
                </div>
            </header>

            <main className="container mx-auto px-6 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    <aside className="md:w-1/4 lg:w-1/5">
                        <nav className="space-y-2">
                            {Object.entries(TABS).map(([key, tab]) => (
                                <button
                                    key={key}
                                    onClick={() => setActiveTab(key)}
                                    disabled={!tokenValid}
                                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${activeTab === key ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-200'} disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
                                >
                                    {tab.icon}
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                        
                        <div className="mt-8 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                             <h3 className="text-lg font-semibold text-gray-800 mb-3">Configuration</h3>
                             <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">HubSpot Token</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={hubSpotToken}
                                            onChange={(e) => setHubSpotToken(e.target.value)}
                                            className="w-full p-2 border rounded-md pr-10 text-sm"
                                            placeholder="paste-your-token-here"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                            {isCheckingToken ? <Spinner /> : (
                                                <>
                                                    {tokenValid === true && <CheckCircleIcon />}
                                                    {tokenValid === false && <ExclamationCircleIcon />}
                                                </>
                                            )}
                                         </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI Key</label>
                                    <input
                                        type="password"
                                        value={openAiKey}
                                        onChange={(e) => setOpenAiKey(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm"
                                        placeholder="sk-..."
                                    />
                                </div>
                             </div>
                        </div>
                    </aside>
                    
                    <div className="flex-1">
                        {tokenValid ? (
                            TABS[activeTab].component
                        ) : (
                            <div className="text-center bg-white p-8 rounded-lg shadow-md h-full flex flex-col justify-center items-center">
                                <h2 className="text-xl font-semibold text-gray-700">
                                    {isCheckingToken ? 'Validating HubSpot Token...' : 'Please enter a valid HubSpot Private App Token to begin.'}
                                </h2>
                                <p className="text-gray-500 mt-2">The data quality tools will be enabled once a valid token is provided.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

