import { bandFor } from '../public/js/air.js';
import { COMMUTES, FLEXIBILITY, FOCUS } from '../public/js/plan.js';

const BASE_REASON = {
  home: 'Start with a practical step in the room your household uses most.',
  outdoors: 'Check outdoor conditions before deciding how long or hard to exercise.',
  travel: 'Choose a change that fits the way you already get around.',
  ventilation: 'Consider outdoor conditions and the ventilation your home needs.'
};

export function coachContext(focus, aqi, windowAqi, profile, actions) {
  const outdoorAirCategory = bandFor(aqi).label;
  const reasons = [
    {
      id: 'current-outdoor-air', applies: aqi > 150, actions: ['outdoors', 'ventilation', 'home'],
      explanation: 'The outdoor forecast is ' + outdoorAirCategory.toLowerCase() +
        ', so reducing avoidable particle exposure is a priority.'
    },
    {
      id: 'no-air-cleaner', applies: !profile.purifier, actions: ['home'],
      explanation: 'Reducing smoke from indoor sources is a practical step with the equipment you already have.'
    },
    {
      id: 'air-cleaner-available', applies: profile.purifier, actions: ['home'],
      explanation: 'Your household already has a HEPA cleaner, so you can start by using it in one occupied room.'
    },
    {
      id: 'sensitive-household', applies: profile.sensitive && aqi > 100, actions: ['outdoors'],
      explanation: 'Outdoor activity is worth adjusting for household members who are more sensitive to pollution.'
    },
    {
      id: 'fixed-schedule', applies: profile.flexibility === 'fixed', actions: ['travel'],
      explanation: 'Your schedule is fixed, so focus on a change you can make to the trip itself.'
    },
    {
      id: 'better-window', applies: profile.flexibility === 'flexible' && windowAqi != null && windowAqi < aqi,
      actions: ['outdoors'],
      explanation: 'Your schedule allows some flexibility. Recheck conditions near the lower forecast window.'
    }
  ];

  const options = actions.flatMap((action) => {
    const matching = reasons.filter((reason) => reason.applies && reason.actions.includes(action.id));
    return [
      { id: 'routine', explanation: BASE_REASON[action.id] },
      ...matching
    ].map(({ id, explanation }) => ({
      choiceId: action.id + ':' + id,
      actionId: action.id,
      explanation
    }));
  });

  return {
    question: FOCUS[focus],
    outdoorAirCategory,
    daytimeOutdoorWindowCategory: windowAqi == null ? 'unavailable' : bandFor(windowAqi).label,
    household: {
      sensitive: profile.sensitive,
      purifier: profile.purifier,
      commute: COMMUTES[profile.commute],
      flexibility: FLEXIBILITY[profile.flexibility]
    },
    actions: actions.map(({ id, title, detail, impact }) => ({ id, title, detail, impact })),
    options
  };
}