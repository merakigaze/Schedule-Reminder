// Shared by main.js (Node/ESM) and index.html (browser ESM) so the occurrence
// rule for monthly reminders is defined in exactly one place.

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m: m - 1, d }; // m is 0-indexed to match Date's month
}

export function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// Does `reminder` occur on `dateStr` ("YYYY-MM-DD"), given its anchor `date`
// and `repeat` rule ("none" | "daily" | "weekly" | "monthly")?
export function occursOn(reminder, dateStr) {
  const anchor = parseDate(reminder.date);
  const target = parseDate(dateStr);

  const anchorTime = new Date(anchor.y, anchor.m, anchor.d).getTime();
  const targetTime = new Date(target.y, target.m, target.d).getTime();

  if (targetTime < anchorTime) return false; // never fires before the anchor date

  switch (reminder.repeat) {
    case 'daily':
      return true;
    case 'weekly': {
      const anchorDow = new Date(anchor.y, anchor.m, anchor.d).getDay();
      const targetDow = new Date(target.y, target.m, target.d).getDay();
      return anchorDow === targetDow;
    }
    case 'monthly': {
      // clamp to the last day of shorter months, e.g. anchor day 31 fires on Feb 28
      const clampedDay = Math.min(anchor.d, daysInMonth(target.y, target.m));
      return target.d === clampedDay;
    }
    case 'none':
    default:
      return targetTime === anchorTime;
  }
}

export function isDoneOn(reminder, dateStr) {
  return Array.isArray(reminder.completedDates) && reminder.completedDates.includes(dateStr);
}

// All dates within the given month (monthIndex0: 0-11) that `reminder` occurs on.
export function getOccurrencesInMonth(reminder, year, monthIndex0) {
  const numDays = daysInMonth(year, monthIndex0);
  const dates = [];
  for (let day = 1; day <= numDays; day++) {
    const dateStr = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (occursOn(reminder, dateStr)) dates.push(dateStr);
  }
  return dates;
}
