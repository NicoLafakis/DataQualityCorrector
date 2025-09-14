import React, { useState, useCallback } from 'react';
import { Spinner } from './icons';
import { hubSpotApiRequest } from '../lib/api';
import ProgressBar from './ProgressBar';
import QuickScanDetailsModal from './QuickScanDetailsModal';

export default function Overview({ token, onNavigate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    duplicates: 0,
    formatting: 0,
    enrichmentGaps: 0,
    propertiesToReview: 0,
    companyDuplicates: 0,
    unassignedContacts: 0,
    unassignedCompanies: 0,
    orphanedContacts: 0,
    hardBounced: 0,
    invalidPhones: 0,
  });
  const [details, setDetails] = useState({
    duplicates: [],
    companyDuplicates: [],
    formatting: [],
    enrichmentGaps: [],
    unassignedContacts: [],
    unassignedCompanies: [],
    orphanedContacts: [],
    hardBounced: [],
    invalidPhones: [],
    propertiesToReview: [],
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalRows, setModalRows] = useState([]);
  const openDetails = (key, title) => {
    setModalRows(details[key] || []);
    setModalTitle(title);
    setModalOpen(true);
  };

  const quickScan = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setProgress(0);
    try {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      // Duplicates (contacts by email only quick estimate: first 100 per API page limit)
      const dupResult = await (async () => {
        const data = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=email,createdate`, 'GET', token);
        const map = {};
        (data.results || []).forEach((c) => {
          const e = (c.properties?.email || '').toLowerCase();
          if (!e) return;
          if (!map[e]) map[e] = { count: 0, ids: [] };
          map[e].count += 1;
          map[e].ids.push(c.id);
        });
        const rows = Object.entries(map)
          .filter(([, v]) => v.count > 1)
          .map(([email, v]) => ({ label: email, meta: { count: v.count, ids: v.ids } }));
        return { count: rows.length, rows };
      })();
      setProgress(15);

      // Formatting: count obvious email/website issues in first 200 contacts & companies
      const fmtResult = await (async () => {
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
        const rows = [];
        (c1.results || []).forEach((r) => {
          const p = r.properties || {};
          if (p.email && !reEmail.test(p.email)) rows.push({ label: `contact:${r.id}`, meta: { field: 'email', value: p.email } });
          if (p.website) { try { new URL(p.website); } catch { rows.push({ label: `contact:${r.id}`, meta: { field: 'website', value: p.website } }); } }
        });
        (c2.results || []).forEach((r) => {
          const p = r.properties || {};
          if (p.website) { try { new URL(p.website); } catch { rows.push({ label: `company:${r.id}`, meta: { field: 'website', value: p.website } }); } }
          if (p.domain) {
            const s = String(p.domain).toLowerCase().trim();
            // a very loose domain sanity test
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) rows.push({ label: `company:${r.id}`, meta: { field: 'domain', value: p.domain } });
          }
        });
        return { count: rows.length, rows: rows.slice(0, 200) };
      })();
      setProgress(30);

      // Enrichment gaps: contacts missing city/state/country in first page (100)
      const enrichmentResult = await (async () => {
        const c = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=city,state,country`, 'GET', token);
        const rows = (c.results || []).filter((r) => {
          const p = r.properties || {};
          return !p.city || !p.state || !p.country;
        }).map((r) => {
          const p = r.properties || {};
          const missing = ['city', 'state', 'country'].filter((k) => !p[k]);
          return { label: `contact:${r.id}`, meta: { missing, properties: { city: p.city, state: p.state, country: p.country } } };
        });
        return { count: rows.length, rows };
      })();
      setProgress(45);

      // Company duplicates (quick by normalized domain)
      const companyDupResult = await (async () => {
        try {
          const res = await hubSpotApiRequest(`/crm/v3/objects/companies?limit=100&properties=domain,website,name`, 'GET', token);
          const normalize = (d) => {
            if (!d) return '';
            try { const s = String(d).toLowerCase().trim(); return s.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''); } catch { return '';}
          };
          const byDomain = (res.results || []).reduce((acc, c) => { const key = normalize(c.properties?.domain || c.properties?.website); if (key) { (acc[key] = acc[key] || []).push(c); } return acc; }, {});
          const rows = Object.entries(byDomain).filter(([, g]) => g.length > 1).map(([domain, g]) => ({ label: domain, meta: { count: g.length, ids: g.map((x) => x.id) } }));
          return { count: rows.length, rows };
        } catch { return { count: 0, rows: [] }; }
      })();
      setProgress(60);

      // Unassigned owners: contacts and companies missing hubspot_owner_id
      const unassigned = await (async () => {
        try {
          const [cRes, coRes] = await Promise.all([
            hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=hubspot_owner_id`, 'GET', token),
            hubSpotApiRequest(`/crm/v3/objects/companies?limit=100&properties=hubspot_owner_id`, 'GET', token),
          ]);
          const ucRows = (cRes.results || []).filter((r) => !(r.properties && r.properties.hubspot_owner_id)).map((r) => ({ label: `contact:${r.id}`, meta: { hubspot_owner_id: r.properties?.hubspot_owner_id || null } }));
          const ucoRows = (coRes.results || []).filter((r) => !(r.properties && r.properties.hubspot_owner_id)).map((r) => ({ label: `company:${r.id}`, meta: { hubspot_owner_id: r.properties?.hubspot_owner_id || null } }));
          return { uc: ucRows.length, uco: ucoRows.length, ucRows, ucoRows };
        } catch { return { uc: 0, uco: 0, ucRows: [], ucoRows: [] }; }
      })();
      setProgress(72);

      // Orphaned contacts: contacts without company associations (quick sample via associations field)
      const orphanedResult = await (async () => {
        try {
          const res = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=firstname,lastname&associations=companies`, 'GET', token);
          const items = (res.results || []);
          const rows = items.filter((r) => {
            const a = r.associations || {};
            const companies = a.companies?.results || a.companies || [];
            return !companies || companies.length === 0;
          }).map((r) => ({ label: `contact:${r.id}`, meta: { associations: r.associations || {} } }));
          return { count: rows.length, rows };
        } catch { return { count: 0, rows: [] }; }
      })();
      setProgress(84);

      // Hard bounced contacts
      const hardBouncedResult = await (async () => {
        try {
          const res = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=hs_email_hard_bounced,hs_email_hard_bounce_reason`, 'GET', token);
          const rows = (res.results || []).filter((r) => r.properties && (r.properties.hs_email_hard_bounced === 'true' || r.properties.hs_email_hard_bounced === true)).map((r) => ({ label: `contact:${r.id}`, meta: { reason: r.properties?.hs_email_hard_bounce_reason || '' } }));
          return { count: rows.length, rows };
        } catch { return { count: 0, rows: [] }; }
      })();
      setProgress(90);

      // Invalid phone numbers (basic heuristic)
      const invalidPhonesResult = await (async () => {
        try {
          const res = await hubSpotApiRequest(`/crm/v3/objects/contacts?limit=100&properties=phone,mobilephone`, 'GET', token);
          const rePhone = /^[+]?\d[\d\s\-()]{6,}$/; // loose E.164-ish check
          const rows = (res.results || []).reduce((acc, r) => {
            const p = r.properties || {};
            const invalidFields = [];
            if (p.phone && !rePhone.test(String(p.phone))) invalidFields.push({ field: 'phone', value: p.phone });
            if (p.mobilephone && !rePhone.test(String(p.mobilephone))) invalidFields.push({ field: 'mobilephone', value: p.mobilephone });
            if (invalidFields.length) acc.push({ label: `contact:${r.id}`, meta: { invalid: invalidFields } });
            return acc;
          }, []);
          return { count: rows.length, rows };
        } catch { return { count: 0, rows: [] }; }
      })();
      setProgress(96);

      // Properties to review: light heuristic — count of text-like properties (first 50) with label present
      const propertiesResult = await (async () => {
        try {
          const propsRes = await hubSpotApiRequest(`/crm/v3/properties/contacts`, 'GET', token);
          const props = (propsRes.results || []).slice(0, 50);
          const rows = props.filter((p) => p.label && p.type).map((p) => ({ label: `${p.name} — ${p.label}`, meta: { type: p.type, fieldType: p.fieldType } }));
          return { count: rows.length, rows };
        } catch { return { count: 0, rows: [] }; }
      })();

  setProgress(100);

      setSummary({
        duplicates: dupResult.count,
        formatting: fmtResult.count,
        enrichmentGaps: enrichmentResult.count,
        propertiesToReview: propertiesResult.count,
        companyDuplicates: companyDupResult.count,
        unassignedContacts: unassigned.uc,
        unassignedCompanies: unassigned.uco,
        orphanedContacts: orphanedResult.count,
        hardBounced: hardBouncedResult.count,
        invalidPhones: invalidPhonesResult.count,
      });
      setDetails({
        duplicates: dupResult.rows,
        companyDuplicates: companyDupResult.rows,
        formatting: fmtResult.rows,
        enrichmentGaps: enrichmentResult.rows,
        unassignedContacts: unassigned.ucRows,
        unassignedCompanies: unassigned.ucoRows,
        orphanedContacts: orphanedResult.rows,
        hardBounced: hardBouncedResult.rows,
        invalidPhones: invalidPhonesResult.rows,
        propertiesToReview: propertiesResult.rows,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const [progress, setProgress] = useState(0);

  return (
    <div>
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Overview</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex items-center space-x-4 mb-4">
          <button onClick={quickScan} disabled={isLoading} className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:bg-blue-300 flex items-center">
            {isLoading ? <Spinner /> : 'Run Quick Scan'}
          </button>
        </div>
        {isLoading && <ProgressBar percent={progress} text="Running quick overview scan..." />}
        {error && <p className="text-red-500">{error}</p>}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Duplicates" value={summary.duplicates} onDetails={() => openDetails('duplicates', 'Contact Duplicates (sample)')} />
            <Card title="Company Duplicates" value={summary.companyDuplicates} onDetails={() => openDetails('companyDuplicates', 'Company Duplicates (sample)')} />
            <Card title="Formatting Issues" value={summary.formatting} onDetails={() => openDetails('formatting', 'Formatting Issues (sample)')} />
            <Card title="Enrichment Gaps" value={summary.enrichmentGaps} onDetails={() => openDetails('enrichmentGaps', 'Enrichment Gaps (sample)')} />
            <Card title="Unassigned Contacts" value={summary.unassignedContacts} onDetails={() => openDetails('unassignedContacts', 'Unassigned Contacts (sample)')} />
            <Card title="Unassigned Companies" value={summary.unassignedCompanies} onDetails={() => openDetails('unassignedCompanies', 'Unassigned Companies (sample)')} />
            <Card title="Orphaned Contacts" value={summary.orphanedContacts} onDetails={() => openDetails('orphanedContacts', 'Orphaned Contacts (sample)')} />
            <Card title="Hard Bounced" value={summary.hardBounced} onDetails={() => openDetails('hardBounced', 'Hard Bounced Contacts (sample)')} />
            <Card title="Invalid Phones" value={summary.invalidPhones} onDetails={() => openDetails('invalidPhones', 'Invalid Phone Numbers (sample)')} />
            <Card title="Properties to Review" value={summary.propertiesToReview} onDetails={() => openDetails('propertiesToReview', 'Properties to Review (sample)')} />
          </div>
        )}
        <QuickScanDetailsModal
          visible={modalOpen}
          title={modalTitle}
          rows={modalRows}
          onClose={() => setModalOpen(false)}
        />
      </div>
    </div>
  );
}

function Card({ title, value, onDetails }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-3xl font-semibold text-gray-800 my-2">{value}</div>
      <button onClick={onDetails} className="text-blue-600 hover:underline text-sm">View details</button>
    </div>
  );
}

// no-op placeholder for future helpers
