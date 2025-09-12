import React, { useState, useEffect } from 'react';

// Import icons
import { ShieldCheckIcon, ChartPieIcon, GlobeIcon, DocumentDuplicateIcon } from './icons';

// Import UI components
import { ExclamationCircleIcon, CheckCircleIcon, Spinner } from './ui';

// Import API functions
import { hubSpotApiRequest } from './api';

// Import tool components
import { AnomalyDetector } from './tools/AnomalyDetector';
import { PropertyFillRate } from './tools/PropertyFillRate';
import { GeoCorrector } from './tools/GeoCorrector';
import { DuplicateFinder } from './tools/DuplicateFinder';

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
                                <form>
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
                                </form>
                                <form>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI Key</label>
                                    <input
                                        type="password"
                                        value={openAiKey}
                                        onChange={(e) => setOpenAiKey(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm"
                                        placeholder="sk-..."
                                    />
                                </form>
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

