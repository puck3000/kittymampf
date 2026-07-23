import { NextRequest, NextResponse } from "next/server";
import {
  formatMinutes,
  getMeals,
  minutesNowInZurich,
  OVERDUE_GRACE_MINUTES,
} from "@/lib/config";
import { sendToAll } from "@/lib/push";
import { readState, writeState } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Überfälligkeits-Check, aufgerufen alle 15 Minuten durch GitHub Actions.
 * Geschützt durch `Authorization: Bearer $CRON_SECRET` (nicht durch Basic Auth).
 */
async function runCheck(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nicht konfiguriert" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const state = await readState();
    const now = minutesNowInZurich();
    const notifications: string[] = [];

    for (const meal of getMeals()) {
      const mealState = state.meals[meal.id];
      const isOverdue = now > meal.dueMinutes + OVERDUE_GRACE_MINUTES;
      if (isOverdue && !mealState.doneAt && !mealState.notified) {
        const delivered = await sendToAll({
          title: `🐱 ${meal.label} ist überfällig!`,
          body: `Die Katzen hätten bis ${formatMinutes(meal.dueMinutes)} ihr ${meal.label} bekommen sollen (${meal.food}). Bitte füttern und in der App abhaken.`,
        });
        mealState.notified = true;
        notifications.push(`${meal.id} (${delivered} zugestellt)`);
      }
    }

    if (notifications.length > 0) {
      await writeState(state);
    }

    return NextResponse.json({
      ok: true,
      date: state.date,
      nowMinutes: now,
      notified: notifications,
    });
  } catch (err) {
    console.error("Check fehlgeschlagen:", err);
    return NextResponse.json(
      { error: `Check fehlgeschlagen: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return runCheck(request);
}

export async function POST(request: NextRequest) {
  return runCheck(request);
}
