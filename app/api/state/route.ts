import { NextResponse } from "next/server";
import { getMeals, minutesNowInZurich, OVERDUE_GRACE_MINUTES } from "@/lib/config";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await readState();
    const meals = getMeals();
    return NextResponse.json({
      state,
      meals,
      nowMinutes: minutesNowInZurich(),
      graceMinutes: OVERDUE_GRACE_MINUTES,
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    });
  } catch (err) {
    console.error("Status laden fehlgeschlagen:", err);
    return NextResponse.json(
      { error: `Status laden fehlgeschlagen: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
