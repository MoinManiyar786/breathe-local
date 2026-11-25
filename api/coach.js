import { coachContext } from '../lib/coach-context.js';
import { selectCoachOption } from '../lib/gemini.js';
import { allow, readJson, send } from '../lib/http.js';
import { validAqi } from '../public/js/air.js';
import { actionsForFocus, buildActions, FOCUS, readProfile } from '../public/js/plan.js';

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
  const fallback = (reason) => send(res, 200, { actionId: actions[0].id, mode: 'rules', reason });
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return fallback('setup');
  if (!withinLimit()) return fallback('limit');

  try {
    const context = coachContext(focus, aqi, windowAqi, profile, actions);
    const answer = await selectCoachOption(key, context);
    if (!answer) return fallback('unavailable');
    return send(res, 200, { actionId: answer.actionId, brief: answer.explanation, mode: 'ai' });
  } catch (error) {
    if (error.status === 429) {
      blockedUntil = Date.now() + minute;
      return fallback('limit');
    }
    return fallback('unavailable');
  }
}