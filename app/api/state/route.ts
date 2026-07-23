import { NextResponse } from "next/server";
import { getMeals, minutesNowInZurich, OVERDUE_GRACE_MINUTES } from "@/lib/config";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await readState();
  const meals = getMeals();
  return NextResponse.json({
    state,
    meals,
    nowMinutes: minutesNowInZurich(),
    graceMinutes: OVERDUE_GRACE_MINUTES,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
  });
}
