import React, { useState, useEffect } from 'react';
import { ShieldCheckIcon, ChartPieIcon, GlobeIcon, DocumentDuplicateIcon, ExclamationCircleIcon, CheckCircleIcon, Spinner } from './components/icons';
import { hubSpotApiRequest } from './lib/api';
import AnomalyDetector from './components/AnomalyDetector';
import PropertyFillRate from './components/PropertyFillRate';
import GeoCorrector from './components/GeoCorrector';
import DuplicateFinder from './components/DuplicateFinder';
import Overview from './components/Overview';
import CompanyDuplicateFinder from './components/CompanyDuplicateFinder';
import FormattingIssues from './components/FormattingIssues';
import PropertyInsights from './components/PropertyInsights';
import EnrichmentScanner from './components/EnrichmentScanner';
import AutomationRules from './components/AutomationRules';
import UniversalAnalyzer from './components/UniversalAnalyzer';
import ScanHistory from './components/ScanHistory';

// --- MAIN APP COMPONENT ---
export default function App() {
    const [hubSpotToken, setHubSpotToken] = useState('');
    const [openAiKey, setOpenAiKey] = useState('');
    const [activeTab, setActiveTab] = useState('overview');
    const [tokenValid, setTokenValid] = useState(null);
    const [isCheckingToken, setIsCheckingToken] = useState(false);

    // Dev-only telemetry for token validation
    const isDev = import.meta.env && import.meta.env.DEV;
    if (isDev && typeof window !== 'undefined') {
        window.__DQC_TELEMETRY__ = window.__DQC_TELEMETRY__ || { hsValidationSuccess: 0, hsValidationFailure: 0 };
    }
    const devLogValidation = (result) => {
        if (!isDev || typeof window === 'undefined') return;
        const t = window.__DQC_TELEMETRY__;
        if (!t) return;
        if (result === 'success') t.hsValidationSuccess += 1;
        if (result === 'failure') t.hsValidationFailure += 1;
        console.log('[DQC][DEV] HubSpot token validation:', result, {
            success: t.hsValidationSuccess,
            failure: t.hsValidationFailure,
        });
    };

    // Read API keys from URL or sessionStorage on initial load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const hsToken = params.get('hubSpotToken') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('hubSpotToken') : '');
        const oaKey = params.get('openAiKey') || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('openAiKey') : '');
        if (hsToken) setHubSpotToken(hsToken);
        if (oaKey) setOpenAiKey(oaKey);
    }, []);

    // Persist and validate HubSpot token whenever it changes
    useEffect(() => {
        const handler = setTimeout(() => {
            if (hubSpotToken) {
                try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('hubSpotToken', hubSpotToken); } catch (_) {}
                const checkToken = async () => {
                    setIsCheckingToken(true);
                    try {
                        // Robust validation covering both Private App tokens and OAuth tokens
                        const clean = (hubSpotToken || '').replace(/^Bearer\s+/i, '');

                        // 1) Private app token introspection
                        // POST /oauth/v2/private-apps/get/access-token-info with body { tokenKey }
                        try {
                            await hubSpotApiRequest('/oauth/v2/private-apps/get/access-token-info', 'POST', clean, { tokenKey: clean });
                            setTokenValid(true);
                            devLogValidation('success');
                            return; // success
                        } catch (_e1) {
                            // fall through to OAuth access token metadata
                        }

                        // 2) OAuth access token metadata
                        // GET /oauth/v1/access-tokens/{token}
                        await hubSpotApiRequest('/oauth/v1/access-tokens/' + clean, 'GET', clean);
                        setTokenValid(true);
                        devLogValidation('success');
                    } catch (error) {
                        setTokenValid(false);
                        devLogValidation('failure');
                    } finally {
                        setIsCheckingToken(false);
                    }
                };
                checkToken();
            } else {
                setTokenValid(null);
                try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('hubSpotToken'); } catch (_) {}
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [hubSpotToken]);

    // Persist OpenAI key
    useEffect(() => {
        try {
            if (openAiKey && typeof sessionStorage !== 'undefined') sessionStorage.setItem('openAiKey', openAiKey);
            else if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('openAiKey');
        } catch (_) {}
    }, [openAiKey]);

    const TABS = {
        overview: { label: 'Overview', icon: <ChartPieIcon />, component: <Overview token={hubSpotToken} onNavigate={setActiveTab} /> },
        anomalies: { label: 'Anomalies', icon: <ShieldCheckIcon />, component: <AnomalyDetector token={hubSpotToken} /> },
        formatting: { label: 'Formatting', icon: <ShieldCheckIcon />, component: <FormattingIssues token={hubSpotToken} /> },
        fillRate: { label: 'Fill Rate', icon: <ChartPieIcon />, component: <PropertyFillRate token={hubSpotToken} /> },
    universal: { label: 'Universal Analyzer', icon: <ChartPieIcon />, component: <UniversalAnalyzer token={hubSpotToken} /> },
    history: { label: 'Scan History', icon: <ChartPieIcon />, component: <ScanHistory /> },
        propertyInsights: { label: 'Property Insights', icon: <ChartPieIcon />, component: <PropertyInsights token={hubSpotToken} /> },
        enrichment: { label: 'Enrichment', icon: <GlobeIcon />, component: <EnrichmentScanner token={hubSpotToken} openAiKey={openAiKey} /> },
        duplicates: { label: 'Contact Duplicates', icon: <DocumentDuplicateIcon />, component: <DuplicateFinder token={hubSpotToken} /> },
        companyDuplicates: { label: 'Company Duplicates', icon: <DocumentDuplicateIcon />, component: <CompanyDuplicateFinder token={hubSpotToken} /> },
        geoCorrect: { label: 'Geo Correction', icon: <GlobeIcon />, component: <GeoCorrector token={hubSpotToken} openAiKey={openAiKey} /> },
        automation: { label: 'Automation Rules', icon: <ShieldCheckIcon />, component: <AutomationRules token={hubSpotToken} /> },
    };

    return (
        <div className="min-h-screen font-sans bg-gray-100">
            <header className="bg-white shadow-md">
                <div className="container px-6 py-4 mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800">HubSpot Data Quality Suite</h1>
                </div>
            </header>

            <main className="container px-6 py-8 mx-auto">
                <div className="flex flex-col gap-8 md:flex-row">
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

                        <div className="p-4 mt-8 bg-white border border-gray-200 rounded-lg shadow-sm">
                             <h3 className="mb-3 text-lg font-semibold text-gray-800">Configuration</h3>
                             <div className="space-y-4">
                                <div>
                                    <label className="block mb-1 text-sm font-medium text-gray-700">HubSpot Token</label>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={hubSpotToken}
                                            onChange={(e) => setHubSpotToken(e.target.value)}
                                            className="w-full p-2 pr-10 text-sm border rounded-md"
                                            placeholder="paste-your-token-here"
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
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
                                    <label className="block mb-1 text-sm font-medium text-gray-700">OpenAI Key</label>
                                    <input
                                        type="password"
                                        value={openAiKey}
                                        onChange={(e) => setOpenAiKey(e.target.value)}
                                        className="w-full p-2 text-sm border rounded-md"
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
                            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded-lg shadow-md">
                                <h2 className="text-xl font-semibold text-gray-700">
                                    {isCheckingToken ? 'Validating HubSpot Token...' : 'Please enter a valid HubSpot Private App Token to begin.'}
                                </h2>
                                <p className="mt-2 text-gray-500">The data quality tools will be enabled once a valid token is provided.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

