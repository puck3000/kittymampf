import { get, put } from "@vercel/blob";
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

function ensureToken(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN fehlt oder ist leer – Blob Store in Vercel verbinden und neu deployen."
    );
  }
}

/** Liest ein JSON-Blob direkt aus dem Origin-Storage (kein CDN-Cache, nie veraltet). */
async function readJson<T>(pathname: string): Promise<T | null> {
  ensureToken();
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    return null; // Blob existiert noch nicht
  }
  return (await new Response(result.stream).json()) as T;
}

async function writeJson(pathname: string, data: unknown): Promise<void> {
  ensureToken();
  await put(pathname, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
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
