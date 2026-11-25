const icons = {
  pin: '<path d="M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.2 8a7 7 0 0 1 11.6-2L20 9m-16 6 3.2 3A7 7 0 0 0 18.8 16"/>',
  chart: '<path d="M4 19h16M7 15v-3m5 3V5m5 10V8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  sparkles: '<path d="M12 3c.8 5.5 2.5 7.2 8 8-5.5.8-7.2 2.5-8 8-.8-5.5-2.5-7.2-8-8 5.5-.8 7.2-2.5 8-8Zm7 13v5m-2.5-2.5h5M5 3v4M3 5h4"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-14a3 3 0 0 1 0 6m4 8v-2a4 4 0 0 0-3-4"/>',
  home: '<path d="m3 11 9-7 9 7M6 10v10h12V10m-8 10v-5h4v5"/>',
  route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7.5a3 3 0 1 1 0 6h-7a3 3 0 1 0 0 6H16"/>',
  wind: '<path d="M3 9h12a2.5 2.5 0 1 0-2.5-2.5M3 13h16a2.5 2.5 0 1 0-2.5-2.5M5 17h9a2.5 2.5 0 1 1-2.5 2.5"/>',
  leaf: '<path d="M20 4C11 4 5 7 5 13a6 6 0 0 0 6 6c6 0 9-6 9-15ZM4 20l9-9"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8 11 8-5m-8 7 8 5"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>'
};

export const glyph = (name) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
