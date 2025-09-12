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
        <div className="min-h-screen font-sans antialiased bg-slate-50">
            {/* Modern Header */}
            <header className="bg-white border-b shadow-sm border-slate-200">
                <div className="px-6 mx-auto max-w-7xl lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700">
                                <ShieldCheckIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-slate-900">Data Quality Suite</h1>
                                <p className="text-xs text-slate-500">HubSpot Integration</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-sm text-slate-600">System Online</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="px-6 py-8 mx-auto max-w-7xl lg:px-8">
                <div className="flex gap-8">
                    {/* Modern Sidebar */}
                    <aside className="flex-shrink-0 w-80">
                        <div className="p-6 bg-white border shadow-sm rounded-xl border-slate-200">
                            <div className="mb-6">
                                <h2 className="mb-1 text-lg font-semibold text-slate-900">Tools</h2>
                                <p className="text-sm text-slate-500">Select a tool to get started</p>
                            </div>

                            <nav className="space-y-2">
                                {Object.entries(TABS).map(([key, tab]) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveTab(key)}
                                        disabled={!tokenValid}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 group ${
                                            activeTab === key
                                                ? 'bg-blue-50 border border-blue-200 text-blue-700 shadow-sm'
                                                : tokenValid
                                                    ? 'text-slate-700 hover:bg-slate-50 hover:border-slate-200 border border-transparent'
                                                    : 'text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className={`flex-shrink-0 ${activeTab === key ? 'text-blue-600' : tokenValid ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-300'}`}>
                                            {tab.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium truncate ${activeTab === key ? 'text-blue-700' : tokenValid ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {tab.label}
                                            </div>
                                            <div className={`text-xs ${activeTab === key ? 'text-blue-600' : tokenValid ? 'text-slate-500' : 'text-slate-300'}`}>
                                                {key === 'anomalies' && 'Detect data inconsistencies'}
                                                {key === 'fillRate' && 'Analyze property completion'}
                                                {key === 'geoCorrect' && 'Fix location data'}
                                                {key === 'duplicates' && 'Manage duplicate records'}
                                            </div>
                                        </div>
                                        {activeTab === key && (
                                            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0">
                        {/* Configuration Panel */}
                        <div className="p-8 mb-8 bg-white border shadow-sm rounded-xl border-slate-200">
                            <div className="flex items-center mb-6 space-x-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-slate-900">Configuration</h3>
                                    <p className="text-sm text-slate-500">Set up your API credentials to get started</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">HubSpot Private App Token</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={hubSpotToken}
                                            onChange={(e) => setHubSpotToken(e.target.value)}
                                            className="w-full px-4 py-3 text-sm transition-colors bg-white border rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Enter your HubSpot token..."
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {isCheckingToken ? (
                                                <Spinner />
                                            ) : tokenValid === true ? (
                                                <CheckCircleIcon />
                                            ) : tokenValid === false ? (
                                                <ExclamationCircleIcon />
                                            ) : null}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500">Required for all data quality operations</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-700">OpenAI API Key</label>
                                    <input
                                        type="password"
                                        value={openAiKey}
                                        onChange={(e) => setOpenAiKey(e.target.value)}
                                        className="w-full px-4 py-3 text-sm transition-colors bg-white border rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="sk-..."
                                    />
                                    <p className="text-xs text-slate-500">Required for geographic data correction</p>
                                </div>
                            </div>
                        </div>

                        {/* Tool Content */}
                        {tokenValid ? (
                            <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
                                {TABS[activeTab].component}
                            </div>
                        ) : (
                            <div className="p-16 bg-white border shadow-sm rounded-xl border-slate-200">
                                <div className="max-w-md mx-auto text-center">
                                    <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-slate-100">
                                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                                        {isCheckingToken ? 'Validating Credentials...' : 'Setup Required'}
                                    </h2>
                                    <p className="mb-6 text-slate-600">
                                        {isCheckingToken
                                            ? 'Please wait while we verify your HubSpot token.'
                                            : 'Configure your API credentials above to unlock all data quality tools.'
                                        }
                                    </p>
                                    {isCheckingToken && (
                                        <div className="flex justify-center">
                                            <Spinner />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

