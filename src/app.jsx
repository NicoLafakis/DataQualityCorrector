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

    // Validate HubSpot token whenever it changes (Users API)
    useEffect(() => {
        const handler = setTimeout(() => {
            if (hubSpotToken) {
                const checkToken = async () => {
                    setIsCheckingToken(true);
                    try {
                        await hubSpotApiRequest('/crm/v3/owners/', 'GET', hubSpotToken);
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
            <header className="bg-white border-b border-slate-200">
                <div className="px-6 mx-auto max-w-7xl lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center rounded-lg shadow-sm w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700">
                                <ShieldCheckIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-slate-900">Data Quality Suite</h1>
                                <p className="text-xs text-slate-500">HubSpot Integration</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="items-center hidden gap-2 px-3 py-1 text-sm rounded-full sm:flex bg-slate-100 text-slate-600">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span>System Online</span>
                            </div>
                            <button className="items-center hidden px-3 py-2 text-sm text-white transition bg-indigo-600 rounded-md sm:inline-flex hover:bg-indigo-700">Upgrade</button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="px-6 py-10 mx-auto max-w-7xl lg:px-8">
                <div className="flex gap-8">
                    {/* Sidebar */}
                    <aside className="flex-shrink-0 w-80">
                        <div className="sticky p-6 bg-white border shadow-sm top-6 rounded-xl border-slate-200">
                            <div className="mb-6">
                                <h2 className="mb-1 text-base font-semibold text-slate-900">Tools</h2>
                                <p className="text-sm text-slate-500">Choose a tool to begin</p>
                            </div>

                            <nav className="space-y-2">
                                {Object.entries(TABS).map(([key, tab]) => (
                                    <button
                                        key={key}
                                        onClick={() => setActiveTab(key)}
                                        disabled={!tokenValid}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-all duration-200 group ${
                                            activeTab === key
                                                ? 'bg-white border-l-4 border-indigo-500 text-indigo-700 shadow-sm'
                                                : tokenValid
                                                    ? 'text-slate-700 hover:bg-slate-50 hover:border-slate-200 border border-transparent'
                                                    : 'text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed'
                                        }`}
                                    >
                                        <div className={`flex-shrink-0 ${activeTab === key ? 'text-indigo-600' : tokenValid ? 'text-slate-500 group-hover:text-slate-700' : 'text-slate-300'}`}>
                                            {tab.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium truncate ${activeTab === key ? 'text-slate-900' : tokenValid ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {tab.label}
                                            </div>
                                            <div className={`text-xs ${activeTab === key ? 'text-slate-500' : tokenValid ? 'text-slate-500' : 'text-slate-300'}`}>
                                                {key === 'anomalies' && 'Detect data inconsistencies'}
                                                {key === 'fillRate' && 'Analyze property completion'}
                                                {key === 'geoCorrect' && 'Fix location data'}
                                                {key === 'duplicates' && 'Manage duplicate records'}
                                            </div>
                                        </div>
                                        {activeTab === key && (
                                            <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0">
                        {/* Configuration Panel */}
                        <div className="grid grid-cols-1 gap-6 p-8 mb-8 lg:grid-cols-2">
                            <div className="p-6 bg-white border shadow-sm rounded-xl border-slate-200">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900">Configuration</h3>
                                        <p className="text-sm text-slate-500">Add API credentials to enable tools</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-slate-700">HubSpot Private App Token</label>
                                    <div className="relative">
                                        <input
                                            id="hubspot-token-input"
                                            type="password"
                                            value={hubSpotToken}
                                            onChange={(e) => setHubSpotToken(e.target.value)}
                                            className="w-full px-4 py-3 text-sm transition-colors bg-white border rounded-lg border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter your HubSpot API token"
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
                            </div>

                            <div className="p-6 bg-white border shadow-sm rounded-xl border-slate-200">
                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-slate-900">Optional Integrations</h4>
                                    <p className="text-xs text-slate-500">Enhance tool capabilities (e.g., geographic fixes)</p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">OpenAI API Key</label>
                                        <input
                                            type="password"
                                            value={openAiKey}
                                            onChange={(e) => setOpenAiKey(e.target.value)}
                                            className="w-full px-4 py-3 text-sm transition-colors bg-white border rounded-lg border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="Enter your OpenAI API key"
                                        />
                                        <p className="mt-1 text-xs text-slate-500">Needed for geographic data correction</p>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            onClick={() => {
                                                // quick helper to open HubSpot docs
                                                window.open('https://developers.hubspot.com/docs/api/private-apps', '_blank');
                                            }}
                                            className="inline-flex items-center px-4 py-2 text-sm text-white transition bg-indigo-600 rounded-md hover:bg-indigo-700"
                                        >
                                            How to find your HubSpot token
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tool Content or Onboarding Card */}
                        {tokenValid ? (
                            <div className="overflow-hidden bg-white border shadow-sm rounded-xl border-slate-200">
                                {TABS[activeTab].component}
                            </div>
                        ) : (
                            <div className="p-12 bg-white border shadow-sm rounded-xl border-slate-200">
                                <div className="max-w-2xl mx-auto text-center">
                                    <div className="mb-6">
                                        <div className="flex items-center justify-center w-20 h-20 mx-auto rounded-xl bg-gradient-to-tr from-indigo-50 to-slate-50">
                                            {/* Friendly onboarding illustration (simple) */}
                                            <svg className="w-10 h-10 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v6" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10a7 7 0 0014 0" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16" />
                                            </svg>
                                        </div>
                                    </div>
                                    <h2 className="mb-3 text-2xl font-semibold text-slate-900">Welcome to Data Quality Suite</h2>
                                    <p className="mb-6 text-slate-600">Let's get you set up — connect your HubSpot account and optionally add OpenAI to enable advanced fixes. Once configured, pick a tool from the left to begin analyzing your data.</p>

                                    <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                                        <button
                                            onClick={() => document.querySelector('#hubspot-token-input')?.focus()}
                                            className="inline-flex items-center px-5 py-3 text-sm text-white transition bg-indigo-600 rounded-md hover:bg-indigo-700"
                                        >
                                            Add HubSpot Token
                                        </button>
                                        <button
                                            onClick={() => window.open('https://app.hubspot.com/login')}
                                            className="inline-flex items-center px-5 py-3 text-sm transition bg-white border rounded-md border-slate-200 text-slate-700 hover:bg-slate-50"
                                        >
                                            Open HubSpot
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

