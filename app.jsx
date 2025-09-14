import React, { useState, useEffect } from 'react';
import { ShieldCheckIcon, ChartPieIcon, GlobeIcon, DocumentDuplicateIcon, ExclamationCircleIcon, CheckCircleIcon, Spinner } from './components/icons';
import { hubSpotApiRequest } from './lib/api';
import AnomalyDetector from './components/AnomalyDetector';
import PropertyFillRate from './components/PropertyFillRate';
import GeoCorrector from './components/GeoCorrector';
import DuplicateFinder from './components/DuplicateFinder';
import FuzzyDuplicateFinder from './components/FuzzyDuplicateFinder';
import Overview from './components/Overview';
import CompanyDuplicateFinder from './components/CompanyDuplicateFinder';
import FormattingIssues from './components/FormattingIssues';
import PropertyInsights from './components/PropertyInsights';
import EnrichmentScanner from './components/EnrichmentScanner';
import AutomationRules from './components/AutomationRules';
import UniversalAnalyzer from './components/UniversalAnalyzer';
import ScanHistory from './components/ScanHistory';
import ReviewQueue from './components/ReviewQueue';
import FailureLog from './components/FailureLog';

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
        const envKey = import.meta.env && import.meta.env.VITE_OPENAI_KEY;
        const oaKey = params.get('openAiKey') || envKey || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('openAiKey') : '');
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
        fuzzyDuplicates: { label: 'Fuzzy Duplicates', icon: <DocumentDuplicateIcon />, component: <FuzzyDuplicateFinder token={hubSpotToken} /> },
        review: { label: 'Review Queue', icon: <DocumentDuplicateIcon />, component: <ReviewQueue token={hubSpotToken} /> },
    failures: { label: 'Failures', icon: <ExclamationCircleIcon />, component: <FailureLog /> },
        companyDuplicates: { label: 'Company Duplicates', icon: <DocumentDuplicateIcon />, component: <CompanyDuplicateFinder token={hubSpotToken} /> },
        geoCorrect: { label: 'Geo Correction', icon: <GlobeIcon />, component: <GeoCorrector token={hubSpotToken} openAiKey={openAiKey} /> },
        automation: { label: 'Automation Rules', icon: <ShieldCheckIcon />, component: <AutomationRules token={hubSpotToken} /> },
    };

    // Sidebar grouped sections for nested menu
    const SIDEBAR_SECTIONS = [
        {
            id: 'analysis',
            label: 'Analysis',
            items: ['overview', 'anomalies', 'formatting', 'fillRate', 'universal', 'history', 'propertyInsights', 'enrichment']
        },
        {
            id: 'duplicates',
            label: 'Duplicates',
            items: ['duplicates', 'fuzzyDuplicates', 'companyDuplicates', 'review', 'failures']
        },
        {
            id: 'tools',
            label: 'Tools',
            items: ['geoCorrect', 'automation']
        }
    ];

    // Expansion state for collapsible sections. Start with sections that contain the activeTab expanded.
    const initialExpanded = SIDEBAR_SECTIONS.reduce((acc, s) => {
        acc[s.id] = s.items.includes(activeTab);
        return acc;
    }, {});
    const [expandedSections, setExpandedSections] = useState(initialExpanded);

    // Whenever activeTab changes, auto-expand the section containing it and optionally collapse others
    useEffect(() => {
        const containing = SIDEBAR_SECTIONS.find(s => s.items.includes(activeTab));
        if (containing) {
            setExpandedSections(prev => ({ ...prev, [containing.id]: true }));
        }
    }, [activeTab]);

    const toggleSection = (sectionId) => {
        setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
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
                        <nav className="space-y-4">
                            {SIDEBAR_SECTIONS.map(section => (
                                // Add a taller container for the Analysis section and use flex layout for its items
                                <div key={section.id} className={`bg-white border border-gray-100 rounded-md shadow-sm ${section.id === 'analysis' && expandedSections[section.id] ? 'min-h-[260px]' : ''}`}>
                                    {/* Make the whole header clickable to toggle the section */}
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleSection(section.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(section.id); } }}
                                        className="px-4 py-2 border-b border-gray-100 flex items-center justify-between cursor-pointer"
                                    >
                                        <h4 className="text-sm font-semibold text-gray-700">{section.label}</h4>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); toggleSection(section.id); }}
                                            className="p-1 text-gray-500 hover:text-gray-700"
                                            aria-expanded={!!expandedSections[section.id]}
                                            aria-controls={`section-${section.id}`}
                                        >
                                            {/* simple chevron */}
                                            <svg className={`w-4 h-4 transform transition-transform duration-150 ${expandedSections[section.id] ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor">
                                                <path d="M6 6 L14 10 L6 14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </button>
                                    </div>
                                    {expandedSections[section.id] ? (
                                        <div id={`section-${section.id}`} className={`${section.id === 'analysis' ? 'p-4 flex flex-col justify-between' : 'p-2 space-y-1'}`}>
                                            {section.items.map((key, idx) => {
                                                const tab = TABS[key];
                                                if (!tab) return null;

                                                // For analysis section, render items in a flex column with even spacing
                                                if (section.id === 'analysis') {
                                                    return (
                                                        <button
                                                            key={key}
                                                            onClick={() => setActiveTab(key)}
                                                            disabled={!tokenValid}
                                                            className={`w-full flex items-center space-x-3 px-4 py-3 my-2 rounded-lg text-left transition-colors duration-200 ${activeTab === key ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-200'} disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
                                                            style={{ marginTop: idx === 0 ? '0' : undefined }}
                                                        >
                                                            {tab.icon}
                                                            <span className="font-medium">{tab.label}</span>
                                                        </button>
                                                    );
                                                }

                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => setActiveTab(key)}
                                                        disabled={!tokenValid}
                                                        className={`w-full flex items-center space-x-3 px-4 py-3 my-2 rounded-lg text-left transition-colors duration-200 ${activeTab === key ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-200'} disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
                                                    >
                                                        {tab.icon}
                                                        <span className="font-medium">{tab.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                </div>
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
                                {/* OpenAI key: keep managed in state for features that need it, but hide the input from the UI
                                    The key can still be provided via URL param or sessionStorage (handled in useEffect).
                                    Render a hidden, readOnly input so automated tools or browser extensions that look for inputs
                                    still see a field if needed, but regular users cannot view or edit it. */}
                                <input type="hidden" readOnly value={openAiKey} />
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

