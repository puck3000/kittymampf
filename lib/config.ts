export const TIMEZONE = "Europe/Zurich";

export type MealId = "breakfast" | "lunch" | "dinner1" | "dinner2";

export interface MealDef {
  id: MealId;
  label: string;
  emoji: string;
  /** Was es gibt, inkl. Portionsangabe */
  food: string;
  /** Deadline („bis“-Zeit) in Minuten seit Mitternacht (Europe/Zurich) – danach wird alarmiert */
  dueMinutes: number;
}

const DEFAULT_FEED_TIMES = "07:00,08:00,17:00,21:00";

/**
 * Die „bis“-Zeiten lösen den Alarm direkt aus – keine zusätzliche Karenzzeit.
 */
export const OVERDUE_GRACE_MINUTES = 0;

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
  if (times.length !== 4) {
    throw new Error(`FEED_TIMES muss genau 4 Zeiten enthalten, z.B. "${DEFAULT_FEED_TIMES}"`);
  }
  return [
    {
      id: "breakfast",
      label: "Zmorge",
      emoji: "🌅",
      food: "Feuchtfutter – ½ Packung pro Katze",
      dueMinutes: times[0],
    },
    {
      id: "lunch",
      label: "Zmittag",
      emoji: "☀️",
      food: "Trockenfutter – 1 Löffel pro Katze",
      dueMinutes: times[1],
    },
    {
      id: "dinner1",
      label: "Zvieri",
      emoji: "🌆",
      food: "Suppe oder Feuchtfutter – ½ Packung pro Katze",
      dueMinutes: times[2],
    },
    {
      id: "dinner2",
      label: "Znacht",
      emoji: "🌙",
      food: "Trockenfutter – 1 Löffel pro Katze",
      dueMinutes: times[3],
    },
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
