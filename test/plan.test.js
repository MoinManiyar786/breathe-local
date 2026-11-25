import test from 'node:test';
import assert from 'node:assert/strict';
import { bandFor, bestWindow, EXAMPLE, nextHours, PLACES, readForecast } from '../public/js/air.js';
import { actionsForFocus, communityBrief, DEFAULT_PROFILE, makePlan, readProfile,
  travelImpact, windowCaption } from '../public/js/plan.js';

test('U.S. AQI categories include their published upper endpoints', () => {
  for (const [number, name] of [[0, 'good'], [50, 'good'], [51, 'moderate'], [100, 'moderate'],
    [101, 'sensitive'], [150, 'sensitive'], [151, 'unhealthy'], [200, 'unhealthy'],
    [201, 'very-unhealthy'], [300, 'very-unhealthy'], [301, 'hazardous']]) {
    assert.equal(bandFor(number).id, name);
  }
});

test('best daytime example window minimizes peak AQI and remains unhealthy', () => {
  const window = bestWindow(EXAMPLE);
  assert.equal(window.aqi, 181);
  assert.equal(windowCaption(window, EXAMPLE), '4–7 PM');
  assert.equal(bandFor(window.aqi).id, 'unhealthy');
});

test('windows require three complete future hours and cannot cross midnight', () => {
  const first = Date.parse('2026-01-15T22:00:00+05:30') / 1000;
  const hours = Array.from({ length: 3 }, (_, index) => ({ time: first + index * 3600, aqi: 25 }));
  assert.equal(bestWindow({ ...EXAMPLE, time: first, hours }), undefined);
  assert.equal(bestWindow({ ...EXAMPLE, hours: EXAMPLE.hours.filter((_, index) => index % 2 === 0) }), undefined);
  assert.ok(bestWindow({ ...EXAMPLE, time: EXAMPLE.time + 45 * 60 }).start > EXAMPLE.time);
});

test('forecast keeps preceding current hour in a half-hour time zone and omits missing readings', () => {
  const time = EXAMPLE.time;
  const payload = {
    timezone: 'Asia/Kolkata',
    current: { time: time + 45 * 60, us_aqi: 275.4, pm2_5: null },
    hourly: { time: [time, time + 3600, time + 7200], us_aqi: [268, null, 250] }
  };
  const air = readForecast(payload);
  assert.equal(air.aqi, 275);
  assert.equal(air.pm25, null);
  assert.deepEqual(nextHours(air).map(({ aqi }) => aqi), [268, 250]);
  assert.throws(() => readForecast({ ...payload, current: { us_aqi: null } }));
});

test('routine adapts to health sensitivity, filtration access and travel mode', () => {
  const high = makePlan(EXAMPLE, DEFAULT_PROFILE);
  assert.equal(high[0].id, 'outdoors');
  assert.match(high[0].detail, /sensitive family members/);
  assert.equal(high[1].title, 'Cut smoke at the source');
  assert.match(high[2].detail, /Keep your departure time/);
  const alternate = makePlan(EXAMPLE, { ...DEFAULT_PROFILE, purifier: true, sensitive: false, commute: 'active' });
  assert.match(alternate[1].detail, /HEPA/);
  assert.equal(alternate[2].title, 'Have an alternative to cycling');
  const clean = { ...EXAMPLE, aqi: 42 };
  const cleanActions = makePlan(clean, { ...DEFAULT_PROFILE, commute: 'active' });
  assert.equal(cleanActions[0].title, 'Take the quieter route');
  assert.deepEqual(actionsForFocus(cleanActions, 'home').map(({ id }) => id), ['home', 'ventilation']);
});

test('hazardous air avoids outdoors even when an improved forecast exists', () => {
  const actions = makePlan({ ...EXAMPLE, aqi: 340 }, { ...DEFAULT_PROFILE, flexibility: 'flexible' });
  assert.match(actions[0].detail, /Everyone should avoid outdoor physical activity/);
  assert.match(actions[3].detail, /Keep required ventilation/);
});

test('invalid preference types do not reach the planner', () => {
  assert.deepEqual(readProfile(DEFAULT_PROFILE), DEFAULT_PROFILE);
  assert.equal(readProfile({ ...DEFAULT_PROFILE, commute: ['car'] }), null);
  assert.equal(readProfile({ ...DEFAULT_PROFILE, sensitive: 'true' }), null);
});

test('trip calculator quantifies displaced driving and supports zero trips', () => {
  assert.deepEqual(travelImpact(12, 2), { avoidedKm: 24, co2: 24 * (0.4 / 1.609344) });
  assert.deepEqual(travelImpact(12, 0), { avoidedKm: 0, co2: 0 });
  assert.equal(travelImpact(12, 8), null);
});

test('community brief discloses example data and contains generic guidance', () => {
  const brief = communityBrief(PLACES[0], EXAMPLE);
  assert.match(brief, /New Delhi/);
  assert.match(brief, /Example scenario/);
  assert.match(brief, /U\.S\. AQI 268/);
  assert.match(brief, /peak U\.S\. AQI 181/);
  assert.doesNotMatch(brief, /private car|HEPA|your household/i);
});
