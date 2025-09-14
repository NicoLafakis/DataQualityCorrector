import React, { useState, useCallback } from 'react';
import { Spinner } from './icons';
import { hubSpotApiRequest } from '../lib/api';

export default function Overview({ token, onNavigate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ duplicates: 0, formatting: 0, enrichmentGaps: 0, propertiesToReview: 0 });

  const quickScan = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      // Duplicates (contacts by email only quick estimate: first 100 per API page limit)
      const dupCount = await (async () => {
        const data = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=email,createdate`, 'GET', token);
        const map = {};
        (data.results || []).forEach((c) => {
          const e = (c.properties?.email || '').toLowerCase();
          if (!e) return;
          map[e] = (map[e] || 0) + 1;
        });
        return Object.values(map).filter((n) => n > 1).length;
      })();

      // Formatting: count obvious email/website issues in first 200 contacts & companies
      const fmtCount = await (async () => {
        const reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const check = (arr) => arr.reduce((acc, r) => {
          const p = r.properties || {};
          if (p.email && !reEmail.test(p.email)) acc += 1;
          if (p.website) {
            try { new URL(p.website); } catch { acc += 1; }
          }
          return acc;
        }, 0);
        const c1 = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=email,website`, 'GET', token);
        await sleep(150);
        const c2 = await hubSpotApiRequest(`/crm/v3/objects/companies?limit=100&properties=website,domain`, 'GET', token);
        return check(c1.results || []) + check(c2.results || []);
      })();

      // Enrichment gaps: contacts missing city/state/country in first page (100)
      const enrichmentGaps = await (async () => {
        const c = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=city,state,country`, 'GET', token);
        return (c.results || []).filter((r) => {
          const p = r.properties || {};
          return !p.city || !p.state || !p.country;
        }).length;
      })();

      // Properties to review: light heuristic — count of text-like properties (first 50) with label present
      const propertiesToReview = await (async () => {
        try {
          const propsRes = await hubSpotApiRequest(`/crm/v3/properties/contacts`, 'GET', token);
          const props = (propsRes.results || []).slice(0, 50);
          return props.filter((p) => p.label && p.type).length;
        } catch { return 0; }
      })();

      setSummary({ duplicates: dupCount, formatting: fmtCount, enrichmentGaps, propertiesToReview });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Overview</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <button onClick={quickScan} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Run Quick Scan'}
          </button>
        </div>
        {error && <p className="text-red-500">{error}</p>}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Duplicates" value={summary.duplicates} cta={() => onNavigate && onNavigate('duplicates')} />
            <Card title="Formatting Issues" value={summary.formatting} cta={() => onNavigate && onNavigate('formatting')} />
            <Card title="Enrichment Gaps" value={summary.enrichmentGaps} cta={() => onNavigate && onNavigate('enrichment')} />
            <Card title="Properties to Review" value={summary.propertiesToReview} cta={() => onNavigate && onNavigate('propertyInsights')} />
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, value, cta }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-3xl font-semibold text-gray-800 my-2">{value}</div>
      <button onClick={cta} className="text-blue-600 hover:underline text-sm">View details</button>
    </div>
  );
}
