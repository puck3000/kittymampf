import { NextRequest, NextResponse } from "next/server";
import {
  readSubscriptions,
  writeSubscriptions,
  type PushSubscriptionRecord,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let sub: PushSubscriptionRecord;
  try {
    sub = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Ungültige Subscription" }, { status: 400 });
  }

  try {
    const subs = await readSubscriptions();
    const others = subs.filter((s) => s.endpoint !== sub.endpoint);
    await writeSubscriptions([...others, sub]);
    return NextResponse.json({ ok: true, count: others.length + 1 });
  } catch (err) {
    console.error("Subscription speichern fehlgeschlagen:", err);
    return NextResponse.json(
      { error: `Speichern fehlgeschlagen: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint fehlt" }, { status: 400 });
  }

  try {
    const subs = await readSubscriptions();
    await writeSubscriptions(subs.filter((s) => s.endpoint !== body.endpoint));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Subscription entfernen fehlgeschlagen:", err);
    return NextResponse.json(
      { error: `Speichern fehlgeschlagen: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
