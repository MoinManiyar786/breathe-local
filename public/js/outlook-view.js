import { bandFor, bestWindow, forecastSamples, localTime } from './air.js';
import { windowCaption } from './plan.js';
import { glyph } from './icons.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function axis(ceiling) {
  const grid = element('div', 'plot-grid');
  grid.setAttribute('aria-hidden', 'true');
  const divisions = ceiling <= 200 ? 2 : ceiling === 300 ? 3 : 4;
  for (let index = 0; index <= divisions; index++) {
    const row = element('div');
    row.append(element('span', '', Math.round(ceiling * (1 - index / divisions))), element('i'));
    grid.append(row);
  }
  return grid;
}

function plotColumn({ time, aqi }, timezone, window, ceiling) {
  const clock = localTime(time, timezone, { hour: '2-digit', minute: '2-digit' });
  const day = localTime(time, timezone, { weekday: 'short' });
  const band = aqi == null ? null : bandFor(aqi);
  const description = band ? 'U.S. AQI ' + aqi + ', ' + band.label : 'Forecast unavailable';

  const column = element('div', 'plot-column');
  column.setAttribute('role', 'listitem');
  column.setAttribute('aria-label', day + ' ' + clock + ', ' + description);
  column.title = day + ' ' + clock + ', ' + description;

  const plot = element('div', 'bar-space');
  plot.setAttribute('aria-hidden', 'true');
  if (band) {
    const bar = element('div', 'plot-bar');
    bar.dataset.band = band.id;
    bar.classList.toggle('highlighted', Boolean(window && time >= window.start && time < window.end));
    bar.style.height = Math.max(3, aqi / ceiling * 100) + '%';
    bar.append(element('span', '', aqi));
    plot.append(bar);
  } else {
    plot.append(element('span', 'plot-missing', '—'));
  }
  column.append(plot, element('span', 'plot-time', clock));
  return column;
}

function renderWindow(card, window, air) {
  let detail = 'Check again when more daytime data is available.';
  if (window) {
    const status = window.aqi > 150
      ? 'Air still ' + bandFor(window.aqi).short.toLowerCase()
      : 'Recheck before going out';
    detail = 'Peak AQI ' + window.aqi + ' · ' + status;
  }
  const icon = element('span', 'icon-tile window-icon');
  icon.innerHTML = glyph('clock');
  const summary = element('div');
  summary.append(element('p', '', 'Lowest forecast daytime window'),
    element('strong', '', windowCaption(window, air)), element('small', '', detail));
  card.replaceChildren(icon, summary);
}

export function renderOutlook(air, { chart, gapNote, windowCard }) {
  const window = bestWindow(air);
  const samples = forecastSamples(air);
  const max = Math.max(...samples.map(({ aqi }) => aqi ?? 0));
  const ceiling = Math.max(100, Math.ceil(max / 100) * 100);
  const columns = element('div', 'plot-columns');
  columns.setAttribute('role', 'list');
  columns.setAttribute('aria-label', 'AQI values at three-hour intervals');
  columns.append(...samples.map((sample) => plotColumn(sample, air.timezone, window, ceiling)));
  chart.replaceChildren(axis(ceiling), columns);
  gapNote.hidden = samples.every(({ aqi }) => aqi != null);
  renderWindow(windowCard, window, air);
}