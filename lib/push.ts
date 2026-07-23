import webpush from "web-push";
import {
  readSubscriptions,
  writeSubscriptions,
  type PushSubscriptionRecord,
} from "./store";

export interface PushPayload {
  title: string;
  body: string;
}

function configureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

/**
 * Sendet eine Benachrichtigung an alle gespeicherten Subscriptions.
 * Tote Subscriptions (404/410 vom Push-Dienst) werden entfernt.
 * Gibt die Anzahl erfolgreicher Zustellungen zurück.
 */
export async function sendToAll(payload: PushPayload): Promise<number> {
  if (!configureVapid()) {
    console.warn("VAPID-Keys fehlen – es werden keine Push-Nachrichten versendet.");
    return 0;
  }
  const subs = await readSubscriptions();
  if (subs.length === 0) return 0;

  const gone = new Set<string>();
  let delivered = 0;

  await Promise.all(
    subs.map(async (sub: PushSubscriptionRecord) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        delivered++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          gone.add(sub.endpoint);
        } else {
          console.error(`Push an ${sub.endpoint} fehlgeschlagen:`, err);
        }
      }
    })
  );

  if (gone.size > 0) {
    await writeSubscriptions(subs.filter((s) => !gone.has(s.endpoint)));
  }
  return delivered;
}
