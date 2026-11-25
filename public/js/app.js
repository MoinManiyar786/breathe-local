import { AQI_BANDS, PLACES, EXAMPLE, bandFor, bestWindow, localTime, nextHours } from './air.js';
import { DEFAULT_PROFILE, FOCUS, SOURCES, actionsForFocus, communityBrief, exposureAdvice, makePlan,
  readProfile, travelImpact, windowCaption } from './plan.js';
import { glyph } from './icons.js';

const byId = (id) => document.getElementById(id);
const put = (id, text) => { byId(id).textContent = text; };
const escape = (value) => String(value).replace(/[&<>"']/g, (match) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[match]);
const linkTo = (key, label = SOURCES[key].title) =>
  '<a href="' + SOURCES[key].url + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a>';

function saved(key) {
  try { return JSON.parse(localStorage.getItem('breathe-local:' + key)); }
  catch { return null; }
}

function save(key, value) {
  try { localStorage.setItem('breathe-local:' + key, JSON.stringify(value)); }
  catch { /* Preferences still apply for this session. */ }
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Try again in a moment.');
  return data;
}

const state = { air: EXAMPLE, place: PLACES[0], profile: readProfile(saved('profile')) || DEFAULT_PROFILE };
let airLoad, citySearch, coachLoad;

function renderAir() {
  const { air, place, profile } = state;
  const example = air.source === 'example';
  const band = bandFor(air.aqi);
  put('nav-city', place.name);
  put('hero-place', [place.name, place.country].filter(Boolean).join(', '));
  byId('open-location').setAttribute('aria-label', 'Change city, currently ' + place.name);
  byId('air-hero').classList.toggle('has-photo', place.id === 'delhi');
  put('data-badge', example ? 'Winter example' : 'Modeled forecast');
  put('aqi-value', air.aqi);
  put('aq-status', band.label);
  byId('aq-status').dataset.band = band.id;
  put('pm-reading', air.pm25 == null ? 'PM₂.₅ unavailable' : 'PM₂.₅ ' + Math.round(air.pm25) + ' µg/m³');
  put('hero-advice', exposureAdvice(air.aqi, profile.sensitive));
  const bandIndex = AQI_BANDS.indexOf(band);
  const min = [0, 50, 100, 150, 200, 300][bandIndex];
  const max = Math.min(band.max, 500);
  const position = Math.min(96, Math.max(4, (bandIndex + Math.min(1, (air.aqi - min) / (max - min))) / 6 * 100));
  byId('scale-caret').style.left = position + '%';
  put('forecast-label', example ? 'Load current forecast' : 'Refresh forecast');
  byId('use-example').hidden = example;
  byId('data-details').innerHTML = example
    ? 'Illustrative winter smog in New Delhi. Load the current forecast to plan an actual trip.'
    : 'Modeled for ' + escape(localTime(air.time, air.timezone, { dateStyle: 'medium', timeStyle: 'short' })) +
      ' local time. Source ' + linkTo('forecast') + '. Street-level air can vary.';
  renderChart();
  renderPlan();
}

function renderChart() {
  const air = state.air;
  const window = bestWindow(air);
  const hours = nextHours(air);
  const firstTime = hours[0].time;
  const points = hours.filter(({ time }) => (time - firstTime) % 10800 === 0);
  const ceiling = Math.max(100, Math.ceil(Math.max(...points.map(({ aqi }) => aqi)) / 100) * 100);
  const step = ceiling <= 300 ? ceiling / (ceiling === 100 ? 2 : 3) : ceiling / 4;
  const ticks = Array.from({ length: Math.round(ceiling / step) + 1 }, (_, index) =>
    Math.round(ceiling - step * index));
  const columns = points.map(({ time, aqi }) => {
    const clock = localTime(time, air.timezone, { hour: '2-digit', minute: '2-digit' });
    const day = localTime(time, air.timezone, { weekday: 'short' });
    const inWindow = window && time >= window.start && time < window.end;
    const label = day + ' ' + clock + ', U.S. AQI ' + aqi + ', ' + bandFor(aqi).label;
    return '<div class="plot-column" aria-label="' + escape(label) + '" role="listitem" title="' + escape(label) +
      '"><div class="bar-space"><div data-aqi="' + aqi + '" data-band="' + bandFor(aqi).id +
      '" class="plot-bar' + (inWindow ? ' highlighted' : '') + '"><span>' + aqi +
      '</span></div></div><span class="plot-time">' + escape(clock) + '</span></div>';
  }).join('');
  const chart = byId('forecast-chart');
  chart.innerHTML = '<div class="plot-grid" aria-hidden="true">' + ticks.map((value) => '<div><span>' + value +
    '</span><i></i></div>').join('') + '</div><div class="plot-columns" role="list" aria-label="AQI values at three-hour intervals">' + columns + '</div>';
  for (const bar of chart.querySelectorAll('.plot-bar')) {
    bar.style.height = Math.max(3, Number(bar.dataset.aqi) / ceiling * 100) + '%';
  }
  const detail = !window ? 'Check again when more daytime data is available.' : window.aqi > 150
    ? 'Peak AQI ' + window.aqi + ' · Air still ' + bandFor(window.aqi).short.toLowerCase()
    : 'Peak AQI ' + window.aqi + ' · Recheck before going out';
  byId('window-card').innerHTML = '<span class="icon-tile window-icon">' + glyph('clock') +
    '</span><div><p>Lowest forecast daytime window</p><strong>' + escape(windowCaption(window, air)) +
    '</strong><small>' + escape(detail) + '</small></div>';
}

function renderPlan() {
  const actions = makePlan(state.air, state.profile);
  byId('actions').innerHTML = actions.map((action) =>
    '<article class="panel action-card"><span class="icon-tile action-icon ' + action.id + '">' + glyph(action.icon) +
    '</span><div class="action-content"><p class="action-label">' + escape(action.label) +
    '</p><h3>' + escape(action.title) + '</h3><p class="action-detail">' + escape(action.detail) +
    '</p><div class="action-impact"><strong>' + action.type + '</strong><span>' + escape(action.impact) +
    '</span></div><p class="action-source">' + linkTo(action.source) + '</p></div></article>').join('');
}

function setDataMessage(message = '') {
  const output = byId('data-message');
  output.hidden = !message;
  output.textContent = message;
}

async function loadForecast(place, { closeDialog = false } = {}) {
  airLoad?.abort();
  const token = new AbortController();
  airLoad = token;
  byId('forecast-button').disabled = true;
  put('forecast-label', 'Loading forecast…');
  setDataMessage('Looking up the forecast for ' + place.name + '…');
  if (closeDialog) byId('location-dialog').close();
  try {
    const params = new URLSearchParams({ lat: place.latitude, lon: place.longitude });
    const result = await request('/api/air?' + params, { signal: token.signal });
    if (token.signal.aborted) return;
    state.air = result;
    state.place = place;
    save('place', place);
    setDataMessage();
  } catch {
    if (!token.signal.aborted) {
      setDataMessage('Could not load the forecast for ' + place.name + '. The brief below still shows ' +
        (state.air.source === 'example' ? 'the winter example.' : state.place.name + '’s last available forecast.'));
    }
  } finally {
    if (!token.signal.aborted) {
      byId('forecast-button').disabled = false;
      airLoad = undefined;
      renderAir();
    }
  }
}

function openExample() {
  airLoad?.abort();
  airLoad = undefined;
  byId('forecast-button').disabled = false;
  state.air = EXAMPLE;
  state.place = PLACES[0];
  save('place', null);
  setDataMessage();
  renderAir();
}

function renderCities(places) {
  const list = byId('city-results');
  list.replaceChildren();
  for (const place of places) {
    const item = document.createElement('button');
    item.className = 'city-option';
    item.type = 'button';
    item.innerHTML = glyph('pin') + '<span><strong>' + escape(place.name) + '</strong><small>' +
      escape([place.region, place.country].filter(Boolean).join(', ')) + '</small></span>';
    item.addEventListener('click', () => loadForecast(place, { closeDialog: true }));
    list.append(item);
  }
}

function paintCoach(result, actions) {
  const action = actions.find(({ id }) => result.actionId === id) || actions[0];
  const reasons = {
    setup: 'Rule-based guidance · AI key not configured.',
    limit: 'Rule-based guidance · The AI coach is busy.',
    unavailable: 'Rule-based guidance · The AI coach is temporarily unavailable.'
  };
  put('coach-status', result.mode === 'ai' ? 'AI summary · Grounded in the action below.' :
    reasons[result.reason] || reasons.unavailable);
  const container = byId('coach-result');
  container.innerHTML = (result.brief ? '<p class="ai-brief">' + escape(result.brief) + '</p>' : '') +
    '<h3>' + escape(action.title) + '</h3><p>' + escape(action.detail) +
    '</p><p class="coach-impact"><strong>Direct impact</strong> ' + escape(action.impact) +
    '</p><p class="action-source">' + linkTo(action.source) + '</p>';
  container.hidden = false;
}

function renderImpact() {
  const distance = Number(byId('distance').value);
  const days = Number(byId('days').value);
  const impact = travelImpact(distance, days);
  put('distance-value', distance + ' km');
  put('days-value', days + (days === 1 ? ' trip' : ' trips'));
  put('km-value', impact.avoidedKm + ' km');
  put('co2-value', (impact.co2 ? '≈ ' + impact.co2.toFixed(1) : '0') + ' kg');
}

for (const node of document.querySelectorAll('[data-icon]')) node.innerHTML = glyph(node.dataset.icon);
for (const anchor of document.querySelectorAll('.main-nav a')) {
  anchor.addEventListener('click', () => {
    for (const item of document.querySelectorAll('.main-nav a')) {
      item.classList.toggle('nav-active', item === anchor);
      if (item === anchor) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    }
  });
}

const profileForm = byId('profile-form');
for (const [key, value] of Object.entries(state.profile)) {
  const input = profileForm.elements.namedItem(key);
  if (typeof value === 'boolean') input.checked = value;
  else input.value = value;
}
profileForm.addEventListener('change', () => {
  const fields = new FormData(profileForm);
  state.profile = readProfile({ sensitive: fields.has('sensitive'), purifier: fields.has('purifier'),
    commute: fields.get('commute'), flexibility: fields.get('flexibility') }) || DEFAULT_PROFILE;
  save('profile', state.profile);
  put('hero-advice', exposureAdvice(state.air.aqi, state.profile.sensitive));
  renderPlan();
  put('profile-status', 'Action plan updated.');
});

byId('forecast-button').addEventListener('click', () => loadForecast(state.place));
byId('use-example').addEventListener('click', openExample);
byId('open-location').addEventListener('click', () => {
  byId('city-form').reset();
  put('city-status', 'Popular cities');
  renderCities(PLACES);
  byId('location-dialog').showModal();
});
byId('location-dialog').addEventListener('close', () => citySearch?.abort());
byId('city-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = byId('city-query').value.trim();
  citySearch?.abort();
  const token = new AbortController();
  citySearch = token;
  put('city-status', 'Searching for ' + query + '…');
  renderCities([]);
  try {
    const result = await request('/api/places?' + new URLSearchParams({ q: query }), { signal: token.signal });
    if (token.signal.aborted) return;
    put('city-status', result.places.length ? 'Select a matching city' : 'No matching cities. Try a nearby city.');
    renderCities(result.places);
  } catch (error) {
    if (token.signal.aborted) return;
    put('city-status', error.message + ' Popular cities are available below.');
    renderCities(PLACES);
  }
});

for (const [key, label] of Object.entries(FOCUS)) byId('coach-focus').add(new Option(label, key));
byId('coach-focus').addEventListener('change', () => {
  if (coachLoad) return;
  put('coach-status', '');
  byId('coach-result').hidden = true;
});
byId('open-coach').addEventListener('click', () => {
  put('coach-status', '');
  byId('coach-result').hidden = true;
  byId('coach-dialog').showModal();
});
byId('coach-dialog').addEventListener('close', () => {
  coachLoad?.abort();
  coachLoad = undefined;
  byId('coach-form').querySelector('button').disabled = false;
  byId('coach-focus').disabled = false;
});
byId('coach-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const focus = byId('coach-focus').value;
  const { profile, air } = state;
  const actions = actionsForFocus(makePlan(air, profile), focus);
  const button = event.currentTarget.querySelector('button');
  const token = new AbortController();
  coachLoad = token;
  button.disabled = true;
  byId('coach-focus').disabled = true;
  byId('coach-result').hidden = true;
  put('coach-status', 'Finding a useful next step…');
  try {
    const result = await request('/api/coach', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: token.signal,
      body: JSON.stringify({ focus, profile, aqi: air.aqi, windowAqi: bestWindow(air)?.aqi })
    });
    if (!token.signal.aborted) paintCoach(result, actions);
  } catch {
    if (!token.signal.aborted) paintCoach({ mode: 'rules' }, actions);
  } finally {
    if (!token.signal.aborted) {
      coachLoad = undefined;
      button.disabled = false;
      byId('coach-focus').disabled = false;
    }
  }
});

byId('open-share').addEventListener('click', () => {
  byId('share-text').value = communityBrief(state.place, state.air);
  put('share-status', '');
  byId('share-dialog').showModal();
});
byId('copy-brief').addEventListener('click', async () => {
  const field = byId('share-text');
  try {
    await navigator.clipboard.writeText(field.value);
    put('share-status', 'Air brief copied.');
  } catch {
    field.focus();
    field.select();
    put('share-status', 'The brief is selected. Use your device’s copy command.');
  }
});

for (const button of document.querySelectorAll('[data-open-help]')) {
  button.addEventListener('click', () => byId('help-dialog').showModal());
}
byId('aqi-legend').innerHTML = AQI_BANDS.map(({ id, label, max }, index) =>
  '<li><span data-band="' + id + '"></span><strong>' + escape(label) + '</strong><small>' +
  (index === 5 ? '301+' : (index ? AQI_BANDS[index - 1].max + 1 : 0) + '–' + max) + '</small></li>').join('');
byId('help-sources').innerHTML = Object.keys(SOURCES).map((key) => '<li>' + linkTo(key) + '</li>').join('');

byId('impact-form').addEventListener('input', renderImpact);
renderImpact();
renderAir();
const remembered = saved('place');
if (remembered && typeof remembered.name === 'string' && Number.isFinite(remembered.latitude) &&
    Number.isFinite(remembered.longitude)) loadForecast(remembered);
