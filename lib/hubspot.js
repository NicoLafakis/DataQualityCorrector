import { hubSpotApiRequest } from './api';

// Fetch all objects of a type with selected properties using cursor pagination
export async function fetchAll(objectType, token, properties = [], { limit = 100, after: startAfter } = {}) {
  let results = [];
  let after = startAfter;
  const props = properties.length ? `&properties=${properties.join(',')}` : '';
  do {
    const path = `/crm/v3/objects/${objectType}?limit=${limit}${after ? `&after=${after}` : ''}${props}`;
    const page = await hubSpotApiRequest(path, 'GET', token);
    if (Array.isArray(page.results)) results = results.concat(page.results);
    after = page.paging?.next?.after;
  } while (after);
  return results;
}

export async function batchUpdate(objectType, token, inputs) {
  if (!inputs || inputs.length === 0) return { updated: 0 };
  // HubSpot batch limits generally 100 per request
  const chunkSize = 100;
  let updated = 0;
  for (let i = 0; i < inputs.length; i += chunkSize) {
    const chunk = inputs.slice(i, i + chunkSize);
    const body = { inputs: chunk };
    await hubSpotApiRequest(`/crm/v3/objects/${objectType}/batch/update`, 'POST', token, body);
    updated += chunk.length;
  }
  return { updated };
}

export async function merge(objectType, token, primaryId, idToMerge) {
  const path = `/crm/v3/objects/${objectType}/${primaryId}/merge`;
  const body = { objectIdToMerge: idToMerge };
  return hubSpotApiRequest(path, 'POST', token, body);
}

export async function listProperties(objectType, token) {
  return hubSpotApiRequest(`/crm/v3/properties/${objectType}`, 'GET', token).then((r) => r.results || r);
}

export async function objectTotal(objectType, token, filterGroups = []) {
  const body = { limit: 1, filterGroups };
  const res = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, body);
  return res.total || 0;
}

export async function countWithHasProperty(objectType, token, propertyName) {
  const body = { limit: 1, filterGroups: [{ filters: [{ propertyName, operator: 'HAS_PROPERTY' }] }] };
  const res = await hubSpotApiRequest(`/crm/v3/objects/${objectType}/search`, 'POST', token, body);
  return res.total || 0;
}
