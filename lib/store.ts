import { head, put } from "@vercel/blob";
import { getMeals, todayInZurich, type MealId } from "./config";

export interface MealState {
  doneAt: string | null;
  notified: boolean;
}

export interface DayState {
  date: string;
  meals: Record<MealId, MealState>;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
}

const STATE_PATH = "state.json";
const SUBS_PATH = "subscriptions.json";

function freshState(): DayState {
  const meals = Object.fromEntries(
    getMeals().map((m) => [m.id, { doneAt: null, notified: false }])
  ) as Record<MealId, MealState>;
  return { date: todayInZurich(), meals };
}

/**
 * Liest ein JSON-Blob. Der Cache-Buster (?v=uploadedAt) umgeht den
 * Blob-CDN-Cache, damit nach einem Überschreiben nie veraltete Daten kommen.
 */
async function readJson<T>(pathname: string): Promise<T | null> {
  let blob;
  try {
    blob = await head(pathname);
  } catch {
    return null; // Blob existiert noch nicht
  }
  const url = `${blob.url}${blob.url.includes("?") ? "&" : "?"}v=${blob.uploadedAt.getTime()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function writeJson(pathname: string, data: unknown): Promise<void> {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

/** Liest den Tageszustand; bei Datumswechsel (Europe/Zurich) wird automatisch zurückgesetzt. */
export async function readState(): Promise<DayState> {
  const stored = await readJson<DayState>(STATE_PATH);
  if (!stored || stored.date !== todayInZurich()) {
    return freshState();
  }
  // Fehlende Mahlzeiten ergänzen (falls sich die Konfiguration geändert hat)
  const fresh = freshState();
  return { date: stored.date, meals: { ...fresh.meals, ...stored.meals } };
}

export async function writeState(state: DayState): Promise<void> {
  await writeJson(STATE_PATH, state);
}

export async function readSubscriptions(): Promise<PushSubscriptionRecord[]> {
  return (await readJson<PushSubscriptionRecord[]>(SUBS_PATH)) ?? [];
}

export async function writeSubscriptions(subs: PushSubscriptionRecord[]): Promise<void> {
  await writeJson(SUBS_PATH, subs);
}
