export const PLACES = [
  { id: 'delhi', name: 'New Delhi', region: 'Delhi', country: 'India', latitude: 28.61, longitude: 77.21, timezone: 'Asia/Kolkata' },
  { id: 'lucknow', name: 'Lucknow', region: 'Uttar Pradesh', country: 'India', latitude: 26.85, longitude: 80.95, timezone: 'Asia/Kolkata' },
  { id: 'mumbai', name: 'Mumbai', region: 'Maharashtra', country: 'India', latitude: 19.08, longitude: 72.88, timezone: 'Asia/Kolkata' },
  { id: 'bengaluru', name: 'Bengaluru', region: 'Karnataka', country: 'India', latitude: 12.97, longitude: 77.59, timezone: 'Asia/Kolkata' }
];

export const AQI_BANDS = [
  { max: 50, id: 'good', label: 'Good', short: 'Good' },
  { max: 100, id: 'moderate', label: 'Moderate', short: 'Moderate' },
  { max: 150, id: 'sensitive', label: 'Unhealthy for sensitive groups', short: 'Sensitive groups' },
  { max: 200, id: 'unhealthy', label: 'Unhealthy', short: 'Unhealthy' },
  { max: 300, id: 'very-unhealthy', label: 'Very unhealthy', short: 'Very unhealthy' },
  { max: Infinity, id: 'hazardous', label: 'Hazardous', short: 'Hazardous' }
];

export const bandFor = (aqi) => AQI_BANDS.find(({ max }) => aqi <= max);
export const validAqi = (value) => Number.isFinite(value) && value >= 0 && value <= 2000;

const HOUR = 3600;
const EXAMPLE_AQI = [268, 279, 285, 274, 255, 245, 226, 212, 198, 181, 171, 164,
  160, 172, 190, 203, 221, 236, 247, 259, 268, 274, 279, 282];
const exampleTime = Date.parse('2026-01-15T07:00:00+05:30') / 1000;
export const EXAMPLE = {
  source: 'example', time: exampleTime, aqi: 268, pm25: 192,
  timezone: 'Asia/Kolkata',
  hours: EXAMPLE_AQI.map((aqi, index) => ({ aqi, time: exampleTime + index * HOUR }))
};

export function localTime(time, timezone, options = { hour: 'numeric', minute: '2-digit' }) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, ...options }).format(time * 1000);
}

function outlookStart(air) {
  const anchor = air.hours[0]?.time ?? air.time;
  return anchor + Math.floor((air.time - anchor) / HOUR) * HOUR;
}

export function nextHours(air) {
  const from = outlookStart(air);
  return air.hours.filter(({ time }) => time >= from && time < from + 24 * HOUR);
}

export function forecastSamples(air) {
  const from = outlookStart(air);
  const readings = new Map(nextHours(air).map(({ time, aqi }) => [time, aqi]));
  return Array.from({ length: 8 }, (_, index) => {
    const time = from + index * 3 * HOUR;
    return { time, aqi: readings.get(time) ?? null };
  });
}

export function bestWindow(air) {
  const hours = nextHours(air);
  const localHour = new Intl.DateTimeFormat('en-GB', {
    timeZone: air.timezone, hour: 'numeric', hourCycle: 'h23'
  });
  let best;
  for (let index = 0; index + 2 < hours.length; index++) {
    const window = hours.slice(index, index + 3);
    const [start, middle, end] = window;
    const startHour = Number(localHour.format(start.time * 1000));
    const endHour = Number(localHour.format(end.time * 1000));
    if (start.time < air.time || startHour < 7 || startHour > 16 || endHour > 18 || endHour < startHour ||
        middle.time - start.time !== HOUR || end.time - middle.time !== HOUR) continue;
    const aqi = Math.max(...window.map((point) => point.aqi));
    const mean = window.reduce((sum, point) => sum + point.aqi, 0) / 3;
    if (!best || aqi < best.aqi || (aqi === best.aqi && mean < best.mean)) {
      best = { start: start.time, end: end.time + HOUR, aqi, mean };
    }
  }
  return best;
}

export function readForecast(payload) {
  const { timezone, current, hourly } = payload || {};
  if (typeof timezone !== 'string' || !Number.isFinite(current?.time) ||
      !validAqi(current.us_aqi) || !Array.isArray(hourly?.time) || !Array.isArray(hourly.us_aqi)) {
    throw new Error('Incomplete forecast');
  }
  new Intl.DateTimeFormat('en', { timeZone: timezone });
  const hours = hourly.time.flatMap((time, index) => {
    const aqi = hourly.us_aqi[index];
    return Number.isFinite(time) && validAqi(aqi) ? [{ time, aqi: Math.round(aqi) }] : [];
  }).sort((a, b) => a.time - b.time);
  const air = {
    source: 'forecast', timezone, hours, time: current.time, aqi: Math.round(current.us_aqi),
    pm25: Number.isFinite(current.pm2_5) && current.pm2_5 >= 0 ? current.pm2_5 : null
  };
  if (!nextHours(air).length) throw new Error('Missing forecast hours');
  return air;
}