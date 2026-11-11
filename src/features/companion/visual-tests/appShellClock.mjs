// Synthetic calendar offset; native browser timers and CDP virtual time still run.
const NativeDate = Date;
let offset = 0;
export function setShellCalendar(parts) {
  offset = new NativeDate(...parts).getTime() - NativeDate.now();
}
window.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [NativeDate.now() + offset])); }
  static now() { return NativeDate.now() + offset; }
};
setShellCalendar([2026, 9, 20, 12]);
