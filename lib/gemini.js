import { upstream } from './http.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const INSTRUCTIONS = [
  'Prioritize the single best action and explanation for this question and household.',
  'Choose one choiceId from the provided options. Each option pairs an action with an explanation.',
  'Use the provided outdoor categories only as outdoor conditions. Indoor air quality is unknown.',
  'For hazardous outdoor air, prioritize protective actions. Respect fixed schedules and available equipment.',
  'Return only the selected choiceId as structured JSON.'
].join(' ');

export async function selectCoachOption(key, context) {
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(model)) return null;

  const ids = context.options.map(({ choiceId }) => choiceId);
  const result = await upstream('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(context) }] }],
      generationConfig: {
        maxOutputTokens: 80,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['choiceId'],
          properties: { choiceId: { type: 'string', enum: ids } }
        }
      }
    })
  }, 9_500);

  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== 'STOP') return null;
  const output = candidate.content?.parts?.filter((part) => !part.thought).map(({ text }) => text).join('');
  const selection = JSON.parse(output || 'null');
  if (typeof selection?.choiceId !== 'string' || Object.keys(selection).length !== 1) return null;
  return context.options.find((option) => option.choiceId === selection.choiceId) || null;
}