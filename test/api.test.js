import test from 'node:test';
import assert from 'node:assert/strict';
import air from '../api/air.js';
import coach from '../api/coach.js';
import places from '../api/places.js';
import { DEFAULT_PROFILE } from '../public/js/plan.js';

async function call(handler, { method = 'GET', url = '/', headers = {}, body } = {}) {
  const req = { method, url, headers, body, socket: { remoteAddress: '127.0.0.1' } };
  const response = {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(value) { this.data = JSON.parse(value); }
  };
  await handler(req, response);
  return response;
}

const coachInput = { profile: DEFAULT_PROFILE, focus: 'home', aqi: 268, windowAqi: 181 };
const json = { 'content-type': 'application/json' };
const modelOutput = (value) => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }]
});

function keyFor(testContext, key) {
  const original = process.env.GEMINI_API_KEY;
  if (key === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = key;
  testContext.after(() => {
    if (original === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = original;
  });
}

test('forecast route rejects invalid coordinates and methods', async () => {
  assert.equal((await call(air, { url: '/?lat=91&lon=2' })).status, 400);
  assert.equal((await call(air, { url: '/?lat=&lon=2' })).status, 400);
  assert.equal((await call(air, { method: 'POST' })).headers.Allow, 'GET');
});

test('forecast route normalizes Open-Meteo data and handles an outage', async (t) => {
  const time = 1768433400;
  const request = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.hostname, 'air-quality-api.open-meteo.com');
    assert.equal(url.searchParams.get('timeformat'), 'unixtime');
    return Response.json({
      timezone: 'Asia/Kolkata', current: { time, us_aqi: 256, pm2_5: 160 },
      hourly: { time: [time, time + 3600], us_aqi: [256, 249] }
    });
  });
  const result = await call(air, { url: '/?lat=28.61&lon=77.21' });
  assert.equal(result.status, 200);
  assert.equal(result.data.source, 'forecast');
  assert.equal(result.data.aqi, 256);
  assert.match(result.headers['Cache-Control'], /s-maxage/);

  request.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  const outage = await call(air, { url: '/?lat=28.61&lon=77.21' });
  assert.equal(outage.status, 503);
  assert.equal(outage.headers['Cache-Control'], 'no-store');
});

test('city search supports Unicode names and rounds coordinates', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url.searchParams.get('name'), 'São Paulo');
    return Response.json({ results: [{ id: 3, name: 'São Paulo', country: 'Brazil', latitude: -23.5475, longitude: -46.6361 }] });
  });
  const result = await call(places, { url: '/?q=S%C3%A3o+Paulo' });
  assert.deepEqual(result.data.places[0], {
    id: '3', name: 'São Paulo', country: 'Brazil', region: '', latitude: -23.55, longitude: -46.64
  });
  assert.equal((await call(places, { url: '/?q=x' })).status, 400);
});

test('coach validates requests and returns a useful offline answer with no API key', async (t) => {
  keyFor(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('unexpected'); });
  const base = { method: 'POST', headers: json, body: coachInput };
  assert.equal((await call(coach, { ...base, headers: { ...json, 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await call(coach, { ...base, body: { ...coachInput, focus: '__proto__' } })).status, 400);
  assert.equal((await call(coach, { ...base, body: 'x'.repeat(4097) })).status, 400);
  const result = await call(coach, base);
  assert.deepEqual(result.data, { actionId: 'home', mode: 'rules', reason: 'setup' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('coach sends bounded context and returns a vetted explanation for Gemini’s choice', async (t) => {
  keyFor(t, 'fake-test-key');
  const previousModel = process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MODEL;
  t.after(() => {
    if (previousModel !== undefined) process.env.GEMINI_MODEL = previousModel;
  });
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'fake-test-key');
    const { contents, generationConfig } = JSON.parse(options.body);
    const context = JSON.parse(contents[0].parts[0].text);
    assert.equal(generationConfig.responseMimeType, 'application/json');
    assert.equal(context.outdoorAirCategory, 'Very unhealthy');
    assert.equal(context.daytimeOutdoorWindowCategory, 'Unhealthy');
    assert.deepEqual(generationConfig.responseJsonSchema.properties.choiceId.enum, [
      'home:routine', 'home:current-outdoor-air', 'home:no-air-cleaner',
      'ventilation:routine', 'ventilation:current-outdoor-air'
    ]);
    assert.equal(JSON.stringify(context).includes('New Delhi'), false);
    return modelOutput({ choiceId: 'ventilation:current-outdoor-air' });
  });
  const args = { method: 'POST', headers: json, body: coachInput };
  const result = await call(coach, args);
  assert.equal(result.data.mode, 'ai');
  assert.equal(result.data.actionId, 'ventilation');
  assert.match(result.data.brief, /^The outdoor forecast is very unhealthy/);
});

test('coach rejects unknown choices and free text that claims a measured indoor condition', async (t) => {
  keyFor(t, 'fake-test-key');
  let selection;
  t.mock.method(globalThis, 'fetch', async () => modelOutput(selection));
  const args = { method: 'POST', headers: json, body: coachInput };
  const unsupportedClaims = 'The air inside is very unhealthy for sensitive groups.';
  for (const value of [
    { choiceId: 'outdoors:routine' },
    { choiceId: 'home:air-cleaner-available' },
    { actionId: 'home', brief: unsupportedClaims },
    { choiceId: 'home:routine', brief: unsupportedClaims }
  ]) {
    selection = value;
    assert.deepEqual((await call(coach, args)).data, { actionId: 'home', mode: 'rules', reason: 'unavailable' });
  }
});

test('coach allows 20 upstream calls in a rolling minute and falls back on the 21st', async (t) => {
  keyFor(t, 'fake-test-key');
  let now = Date.now() + 120_000;
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    modelOutput({ choiceId: 'home:routine' }));
  const args = { method: 'POST', headers: json, body: coachInput };
  for (let index = 0; index < 20; index++) assert.equal((await call(coach, args)).data.mode, 'ai');
  now += 59_999;
  assert.deepEqual((await call(coach, args)).data, { actionId: 'home', mode: 'rules', reason: 'limit' });
  assert.equal(fetch.mock.callCount(), 20);
  now++;
  assert.equal((await call(coach, args)).data.mode, 'ai');
  assert.equal(fetch.mock.callCount(), 21);
});

test('Gemini quota errors pause requests and return the rate-limit fallback', async (t) => {
  keyFor(t, 'fake-test-key');
  let now = Date.now() + 300_000;
  t.mock.method(Date, 'now', () => now);
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }));
  const args = { method: 'POST', headers: json, body: coachInput };
  const rateLimited = { actionId: 'home', mode: 'rules', reason: 'limit' };
  assert.deepEqual((await call(coach, args)).data, rateLimited);
  now += 1000;
  assert.deepEqual((await call(coach, args)).data, rateLimited);
  assert.equal(fetch.mock.callCount(), 1);
});