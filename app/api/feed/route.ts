import { NextRequest, NextResponse } from "next/server";
import { getMeals, type MealId } from "@/lib/config";
import { readState, writeState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { meal?: string; done?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const meals = getMeals();
  const meal = meals.find((m) => m.id === body.meal);
  if (!meal) {
    return NextResponse.json({ error: "Unbekannte Mahlzeit" }, { status: 400 });
  }
  const done = body.done !== false;

  try {
    const state = await readState();
    state.meals[meal.id as MealId] = {
      doneAt: done ? new Date().toISOString() : null,
      notified: done ? state.meals[meal.id].notified : false,
    };
    await writeState(state);
    return NextResponse.json({ state });
  } catch (err) {
    console.error("Speichern fehlgeschlagen:", err);
    return NextResponse.json(
      { error: `Speichern fehlgeschlagen: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
