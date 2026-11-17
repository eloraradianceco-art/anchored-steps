// "Your week": the week you are working through on the Steps page, worked out from step progress
// (ds_start and ds_1 … ds_7, each holding the date it was done). The app opens here, however far
// you browsed last time. Returns 0 when no step has been done yet.
//   - the week you worked in most recently, if it still has steps left;
//   - if that week is finished (all seven steps), the next unfinished week after it.
export function yourWeek(entries, totalWeeks = 52) {
  const weeks = new Map(); // week → { done: Set of step numbers, last: latest date worked }
  for (const e of entries || []) {
    const m = /^ds_(start|[1-7])$/.exec(e?.field_key || "");
    const v = String(e?.field_value || "");
    if (!m || !v || !(e.week >= 1)) continue;
    const w = weeks.get(e.week) || { done: new Set(), last: "" };
    if (m[1] !== "start") w.done.add(m[1]);
    const day = /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "";
    if (day > w.last) w.last = day;
    weeks.set(e.week, w);
  }
  if (!weeks.size) return 0;
  const finished = (n) => (weeks.get(n)?.done.size || 0) >= 7;
  let latest = 0, latestDay = "";
  for (const [n, w] of weeks) if (!latest || w.last > latestDay || (w.last === latestDay && n > latest)) { latest = n; latestDay = w.last; }
  let n = latest;
  while (n < totalWeeks && finished(n)) n++;
  return n;
}
