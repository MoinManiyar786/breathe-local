import { allow, send, upstream } from '../lib/http.js';

export default async function handler(req, res) {
  if (!allow(req, res, 'GET')) return;
  const query = new URL(req.url, 'http://localhost').searchParams.get('q')?.trim() || '';
  if (query.length < 2 || query.length > 60 || !/^[\p{L}\p{M}\p{N} .,'’-]+$/u.test(query)) {
    return send(res, 400, { error: 'Enter a city name between 2 and 60 characters.' });
  }
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: query, count: '7', language: 'en', format: 'json' });
  try {
    const data = await upstream(url);
    const places = (data.results || []).filter((item) => Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude) && typeof item.name === 'string').map((item) => ({
      id: String(item.id), name: item.name, region: item.admin1 || '', country: item.country || '',
      latitude: Number(item.latitude.toFixed(2)), longitude: Number(item.longitude.toFixed(2))
    }));
    return send(res, 200, { places }, 'public, max-age=900, s-maxage=3600');
  } catch {
    return send(res, 503, { error: 'City search is temporarily unavailable.' });
  }
}
