import { allow, readJson, send, upstream } from '../lib/http.js';
import { validAqi, bandFor } from '../public/js/air.js';
import { actionsForFocus, buildActions, COMMUTES, FLEXIBILITY, FOCUS, readProfile } from '../public/js/plan.js';

const requests = [];
let blockedUntil = 0;
const minute = 60_000;

function withinLimit(now = Date.now()) {
  while (requests.length && requests[0] <= now - minute) requests.shift();
  if (now < blockedUntil || requests.length >= 20) return false;
  requests.push(now);
  return true;
}

function fromSameSite(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host && origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

function coachingResponse(value, ids) {
  if (!value || !ids.includes(value.actionId) || typeof value.brief !== 'string') return null;
  const brief = value.brief.trim();
  if (brief.length < 10 || brief.length > 280 || /[\p{N}<>\n\r]/u.test(brief)) return null;
  return { brief, actionId: value.actionId, mode: 'ai' };
}

export default async function handler(req, res) {
  if (!allow(req, res, 'POST')) return;
  if (!fromSameSite(req)) return send(res, 403, { error: 'Open the coach from BreatheLocal.' });

  let body;
  try {
    body = await readJson(req);
  } catch {
    return send(res, 400, { error: 'The request must contain a small JSON object.' });
  }
  const { focus, aqi, windowAqi, profile: input } = body || {};
  const profile = readProfile(input);
  if (typeof focus !== 'string' || !Object.hasOwn(FOCUS, focus) || !profile || !validAqi(aqi) ||
      (windowAqi != null && !validAqi(windowAqi))) {
    return send(res, 400, { error: 'Choose a supported question and household profile.' });
  }

  const actions = actionsForFocus(buildActions(aqi, profile, windowAqi), focus);
  const ids = actions.map(({ id }) => id);
  const fallback = (reason) => send(res, 200, { actionId: ids[0], mode: 'rules', reason });
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return fallback('setup');
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(model)) return fallback('unavailable');
  if (!withinLimit()) return fallback('limit');

  const schema = {
    type: 'object', additionalProperties: false, required: ['actionId', 'brief'],
    properties: { actionId: { type: 'string', enum: ids }, brief: { type: 'string' } }
  };
  try {
    const result = await upstream('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: [
          'You are an air-quality routine coach. Choose the most useful action from the supplied list.',
          'Write one or two short sentences (under 260 characters) explaining the priority in everyday terms for this household.',
          'The app separately displays the exact safety instructions and impact for the action you choose.',
          'Do not introduce extra actions, factual claims, diagnoses, medical guidance, numbers, times, or links.',
          'Respect fixed schedules. Never describe a lower reading as safe. Use plain text.'
        ].join(' ') }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({
          question: FOCUS[focus],
          air: bandFor(aqi).label,
          window: windowAqi == null ? 'unavailable' : bandFor(windowAqi).label,
          household: { sensitive: profile.sensitive, purifier: profile.purifier,
            commute: COMMUTES[profile.commute], flexibility: FLEXIBILITY[profile.flexibility] },
          actions: actions.map(({ id, title, detail, impact }) => ({ id, title, detail, impact }))
        }) }] }],
        generationConfig: {
          maxOutputTokens: 250,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseJsonSchema: schema
        }
      })
    }, 9_500);
    const candidate = result.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') return fallback('unavailable');
    const output = candidate.content?.parts?.filter((part) => !part.thought).map(({ text }) => text).join('');
    const answer = coachingResponse(JSON.parse(output || 'null'), ids);
    return answer ? send(res, 200, answer) : fallback('unavailable');
  } catch (error) {
    if (error.status === 429) {
      blockedUntil = Date.now() + minute;
      return fallback('limit');
    }
    return fallback('unavailable');
  }
}
