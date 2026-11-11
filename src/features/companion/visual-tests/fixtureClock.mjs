// Synthetic local calendar for the isolated browser fixture only.
export const fixtureDates = { none: [2026, 5, 15], halloween: [2026, 9, 20], christmas: [2026, 11, 20], valentines: [2026, 1, 10] };
const NativeDate = Date;
let season = "none";
export function setFixtureSeason(next) { season = next; }
window.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [...fixtureDates[season], 12])); }
  static now() { return new NativeDate(...fixtureDates[season], 12).getTime(); }
};
