import { bandFor, bestWindow, localTime } from './air.js';

export const DEFAULT_PROFILE = { sensitive: true, purifier: false, commute: 'car', flexibility: 'fixed' };
export const COMMUTES = { car: 'Private car', transit: 'Bus or metro', active: 'Walk or cycle', remote: 'No regular commute' };
export const FLEXIBILITY = { fixed: 'Fixed schedule', flexible: 'Can move trips' };
export const FOCUS = { today: 'What should I do first?', home: 'How can I improve the air indoors?',
  travel: 'How should I get around?', outdoors: 'When can we go outside?' };

export const SOURCES = {
  health: { title: 'AirNow activity guide', url: 'https://www.airnow.gov/air-quality-and-health/' },
  school: { title: 'AirNow school activity guide', url: 'https://www.airnow.gov/publications/activity-guides-publications/air-quality-and-outdoor-activity-guidance-for-schools/' },
  filters: { title: 'EPA guide to home air cleaners', url: 'https://www.epa.gov/indoor-air-quality-iaq/air-cleaners-and-air-filters-home' },
  indoor: { title: 'EPA indoor air guidance', url: 'https://www.epa.gov/indoor-air-quality-iaq/improving-indoor-air-quality' },
  cooking: { title: 'EPA guide to cooking and indoor air', url: 'https://www.epa.gov/indoor-air-quality-iaq/indoor-air-pollution-cooking' },
  forecast: { title: 'Open-Meteo / CAMS', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  car: { title: 'EPA typical gasoline car', url: 'https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle' }
};

export function readProfile(value) {
  if (!value || typeof value.sensitive !== 'boolean' || typeof value.purifier !== 'boolean' ||
      typeof value.commute !== 'string' || typeof value.flexibility !== 'string' ||
      !Object.hasOwn(COMMUTES, value.commute) || !Object.hasOwn(FLEXIBILITY, value.flexibility)) {
    return null;
  }
  return { sensitive: value.sensitive, purifier: value.purifier,
    commute: value.commute, flexibility: value.flexibility };
}

export function exposureAdvice(aqi, sensitive) {
  if (aqi > 300) return 'Everyone should avoid outdoor physical activity. Move exercise indoors and keep essential trips brief.';
  if (aqi > 200) return sensitive
    ? 'Have sensitive family members avoid outdoor physical activity. Everyone should move long or strenuous exercise indoors.'
    : 'Move long or strenuous exercise indoors. Sensitive people should avoid outdoor physical activity.';
  if (aqi > 150) return sensitive
    ? 'Move long or strenuous activities indoors for sensitive family members. Everyone can shorten outdoor exertion.'
    : 'Shorten outdoor exertion and take more breaks. Move long or strenuous activities indoors for sensitive people.';
  if (aqi > 100) return 'Sensitive people should shorten or ease prolonged outdoor exertion and take more breaks.';
  if (aqi > 50) return 'Most people can keep their plans. Unusually sensitive people can ease prolonged exertion if symptoms appear.';
  return 'Outdoor activity can generally go ahead. Check the forecast again before heading out.';
}

export function windowCaption(window, air) {
  if (!window) return 'No complete daytime window available';
  const options = { hour: 'numeric', minute: '2-digit', hour12: true };
  const display = (time) => localTime(time, air.timezone, options).replace(/:00(?=\s)/, '').toUpperCase();
  const from = display(window.start);
  const to = display(window.end);
  const compactFrom = from.slice(-2) === to.slice(-2) ? from.slice(0, -2).trim() : from;
  const startDay = localTime(window.start, air.timezone, { day: 'numeric' });
  const currentDay = localTime(air.time, air.timezone, { day: 'numeric' });
  return compactFrom + '–' + to + (startDay !== currentDay ? ' tomorrow' : '');
}

export function makePlan(air, profile) {
  const window = bestWindow(air);
  return buildActions(air.aqi, profile, window?.aqi, window ? windowCaption(window, air) : '');
}

export function buildActions(aqi, profile, windowAqi, windowLabel = '') {
  const canVentilate = aqi <= 100 && (aqi <= 50 || !profile.sensitive);
  const home = {
    id: 'home', icon: 'home', label: 'At home', type: 'Exposure',
    title: profile.purifier ? 'Set up one cleaner room' : 'Cut smoke at the source',
    detail: profile.purifier
      ? 'Run a room-sized HEPA air cleaner where your family spends the most time. Avoid devices that intentionally produce ozone.'
      : 'Skip incense, candles, and indoor smoking. Use an outdoor-vented range hood while cooking if you have one.',
    impact: profile.purifier
      ? 'Filtration removes airborne particles from the air that passes through the unit.'
      : 'Preventing smoke and capturing cooking particles reduces what builds up indoors.',
    source: profile.purifier ? 'filters' : 'cooking'
  };
  const outdoors = {
    id: 'outdoors', icon: 'clock', label: 'Outdoor time', type: 'Exposure',
    title: aqi > 150 ? 'Move strenuous plans indoors' : aqi > 100 && profile.sensitive
      ? 'Ease outdoor activity' : 'Check conditions before heading out',
    detail: exposureAdvice(aqi, profile.sensitive) + (windowAqi == null ? '' : windowAqi > 100
      ? ' Even the lowest modeled daytime window needs care.' : profile.flexibility === 'flexible'
        ? ' Recheck conditions ' + (windowLabel ? 'around ' + windowLabel : 'before a flexible outing') + '.' : ''),
    impact: 'Shorter or lighter outdoor activity reduces the time or effort spent breathing polluted air.',
    source: 'health'
  };
  let travel;
  if (profile.commute === 'car') {
    travel = {
      title: 'Replace one solo car trip', detail: profile.flexibility === 'fixed'
        ? 'Keep your departure time. If a practical rail trip is available, use it for one journey and keep outdoor waits short. If you drive, combine stops and switch off the engine when safely parked.'
        : 'Combine errands into one trip or swap a solo drive for rail where practical. Move optional trips indoors or defer them when pollution is high.',
      impact: 'Each solo car-kilometre you eliminate avoids the associated vehicle tailpipe emissions.'
    };
  } else if (profile.commute === 'transit') {
    travel = {
      title: 'Make the wait shorter', detail: 'Check departures before leaving and use a covered indoor waiting area where available. Choose a route with fewer roadside transfers if the options are similar.',
      impact: 'A shorter roadside wait reduces time near traffic exhaust while keeping your shared ride.'
    };
  } else if (profile.commute === 'active') {
    travel = {
      title: aqi > 100 ? 'Have an alternative to cycling' : 'Take the quieter route',
      detail: aqi > 100
        ? 'For an essential trip, take rail or another practical lower-exertion option if available. Save vigorous cycling for a better forecast.'
        : 'If conditions suit your household, use quieter side streets for short trips and check the forecast before departure.',
      impact: aqi > 100 ? 'A lower-exertion trip can reduce how much polluted air you breathe outdoors.' : 'Active travel has zero tailpipe emissions and quieter routes can cut time beside traffic.',
    };
  } else {
    travel = {
      title: 'Bundle the errands you keep', detail: profile.flexibility === 'flexible'
        ? 'Group errands for a day with better air. Coordinate with neighbours to avoid separate car trips where practical.'
        : 'Keep essential errands and combine nearby stops. Coordinate a shared pickup when practical.',
      impact: 'Fewer separate car journeys reduce total driving when a trip is actually avoided.'
    };
  }
  const ventilation = {
    id: 'ventilation', icon: 'wind', label: 'Ventilation', type: 'Exposure',
    title: canVentilate ? 'Ventilate while outdoor air is better' : 'Time fresh air carefully',
    detail: canVentilate
      ? 'Air rooms briefly if outdoor conditions and household needs allow. Check the latest air reading first.'
      : 'Limit open windows while outdoor air is poor, if you can do so safely. Keep required ventilation for fuel-burning appliances and follow building or local health guidance.',
    impact: canVentilate
      ? 'Ventilation can dilute indoor pollutants when the incoming air is cleaner.'
      : 'Closing windows during an outdoor pollution spike can reduce the amount of outdoor pollution that enters.',
    source: 'indoor'
  };
  const mobility = { ...travel, id: 'travel', icon: 'route', label: 'Getting around',
    type: profile.commute === 'car' || profile.commute === 'remote' || (profile.commute === 'active' && aqi <= 100) ? 'Emissions' : 'Exposure',
    source: profile.commute === 'car' || profile.commute === 'remote' ? 'car' : 'health' };
  return aqi > 150 ? [outdoors, home, mobility, ventilation] : [mobility, home, outdoors, ventilation];
}

export function actionsForFocus(actions, focus) {
  const ids = {
    today: actions.map(({ id }) => id),
    home: ['home', 'ventilation'],
    travel: ['travel', 'outdoors'],
    outdoors: ['outdoors', 'ventilation']
  }[focus];
  return ids.map((id) => actions.find((action) => action.id === id));
}

export function travelImpact(km, days) {
  if (!Number.isFinite(km) || !Number.isFinite(days) || km < 0 || km > 100 || days < 0 || days > 7) return null;
  const avoidedKm = km * days;
  return { avoidedKm, co2: avoidedKm * (0.4 / 1.609344) };
}

function aqiCommunityIdea(aqi) {
  return aqi > 150
    ? 'Neighbourhood idea: move group exercise indoors and coordinate one shared pickup for essential errands.'
    : 'Neighbourhood idea: combine errands with a neighbour to avoid a separate drive.';
}

export function communityBrief(place, air) {
  const window = bestWindow(air);
  const band = bandFor(air.aqi);
  const source = air.source === 'example' ? 'Example scenario' : 'Open-Meteo / CAMS modeled forecast';
  const local = localTime(air.time, air.timezone, { dateStyle: 'medium', timeStyle: 'short' });
  return [
    'BreatheLocal • ' + place.name + ' air brief',
    source + ' • ' + local + ' local time',
    'U.S. AQI ' + air.aqi + ' (' + band.label + ').',
    exposureAdvice(air.aqi, true),
    ...(window ? ['Lowest modeled daytime window: ' + windowCaption(window, air) +
      ' (peak U.S. AQI ' + window.aqi + '). Check conditions and local advisories before acting.'] : []),
    aqiCommunityIdea(air.aqi)
  ].join('\n');
}
