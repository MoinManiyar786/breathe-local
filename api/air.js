import { allow, send, upstream } from '../lib/http.js';
import { readForecast } from '../public/js/air.js';

export default async function handler(req, res) {
  if (!allow(req, res, 'GET')) return;
  const input = new URL(req.url, 'http://localhost').searchParams;
  const latitude = input.get('lat');
  const longitude = input.get('lon');
  const isCoordinate = (value, max) => /^-?\d{1,3}(\.\d{1,2})?$/.test(value || '') && Math.abs(Number(value)) <= max;
  if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) {
    return send(res, 400, { error: 'Enter valid latitude and longitude.' });
  }
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search = new URLSearchParams({
    latitude, longitude, timezone: 'auto', timeformat: 'unixtime', forecast_days: '3',
    current: 'us_aqi,pm2_5', hourly: 'us_aqi'
  });
  try {
    const air = readForecast(await upstream(url));
    return send(res, 200, air, 'public, max-age=120, s-maxage=600');
  } catch {
    return send(res, 503, { error: 'The modeled forecast is temporarily unavailable.' });
  }
}
