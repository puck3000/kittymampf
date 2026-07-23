export const TIMEZONE = "Europe/Zurich";

export type MealId = "breakfast" | "lunch" | "dinner";

export interface MealDef {
  id: MealId;
  label: string;
  emoji: string;
  /** Fällige Uhrzeit in Minuten seit Mitternacht (Europe/Zurich) */
  dueMinutes: number;
}

const DEFAULT_FEED_TIMES = "06:00,12:00,18:00";

/** Minuten, die eine Fütterung überfällig sein darf, bevor benachrichtigt wird */
export const OVERDUE_GRACE_MINUTES = 60;

function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new Error(`Ungültige Zeitangabe in FEED_TIMES: "${time}"`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function getMeals(): MealDef[] {
  const raw = process.env.FEED_TIMES || DEFAULT_FEED_TIMES;
  const times = raw.split(",").map(parseTimeToMinutes);
  if (times.length !== 3) {
    throw new Error(`FEED_TIMES muss genau 3 Zeiten enthalten, z.B. "${DEFAULT_FEED_TIMES}"`);
  }
  return [
    { id: "breakfast", label: "Frühstück", emoji: "🌅", dueMinutes: times[0] },
    { id: "lunch", label: "Mittag", emoji: "☀️", dueMinutes: times[1] },
    { id: "dinner", label: "Znacht", emoji: "🌙", dueMinutes: times[2] },
  ];
}

/** Heutiges Datum als YYYY-MM-DD in Europe/Zurich */
export function todayInZurich(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Aktuelle Uhrzeit in Minuten seit Mitternacht (Europe/Zurich) */
export function minutesNowInZurich(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("de-CH", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function formatMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}
