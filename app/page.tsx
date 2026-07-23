"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type MealId = "breakfast" | "lunch" | "dinner";

interface MealDef {
  id: MealId;
  label: string;
  emoji: string;
  dueMinutes: number;
}

interface MealState {
  doneAt: string | null;
  notified: boolean;
}

interface StateResponse {
  state: { date: string; meals: Record<MealId, MealState> };
  meals: MealDef[];
  nowMinutes: number;
  graceMinutes: number;
  vapidPublicKey: string | null;
}

function formatMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  });
}

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export default function Home() {
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [iosInstallHint, setIosInstallHint] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch {
      setError("Status konnte nicht geladen werden. Bitte später erneut versuchen.");
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  // Service Worker registrieren und Push-Status ermitteln
  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);

    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        registrationRef.current = reg;
        if ("PushManager" in window) {
          setPushSupported(true);
          const sub = await reg.pushManager.getSubscription();
          setPushEnabled(!!sub);
        } else if (isIos && !isStandalone) {
          setIosInstallHint(true);
        }
      })
      .catch(() => {
        /* SW-Registrierung fehlgeschlagen – App funktioniert trotzdem */
      });
  }, []);

  const setFed = async (meal: MealId, done: boolean) => {
    setBusy(meal);
    try {
      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal, done }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { state } = await res.json();
      setData((prev) => (prev ? { ...prev, state } : prev));
      setError(null);
    } catch {
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(null);
    }
  };

  const togglePush = async () => {
    const reg = registrationRef.current;
    if (!reg || !data?.vapidPublicKey) return;
    setPushBusy(true);
    try {
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setPushEnabled(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Benachrichtigungen wurden im Browser nicht erlaubt.");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.vapidPublicKey) as BufferSource,
        });
        const res = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setPushEnabled(true);
        setError(null);
      }
    } catch {
      setError("Benachrichtigungen konnten nicht eingerichtet werden.");
    } finally {
      setPushBusy(false);
    }
  };

  if (!data) {
    return (
      <main className="container">
        <div className="loading">{error ?? "Lade… 🐾"}</div>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="app-header">
        <h1>🐱 Kittymampf</h1>
        <div className="date">{formatDate(data.state.date)}</div>
      </header>

      {error && <div className="error">{error}</div>}

      {data.meals.map((meal) => {
        const mealState = data.state.meals[meal.id];
        const done = !!mealState.doneAt;
        const overdue = !done && data.nowMinutes > meal.dueMinutes + data.graceMinutes;
        const pendingLater = !done && data.nowMinutes < meal.dueMinutes;

        let statusText: string;
        if (done) {
          statusText = `Gefüttert um ${formatTime(mealState.doneAt!)} ✅`;
        } else if (overdue) {
          statusText = `Überfällig seit ${formatMinutes(meal.dueMinutes)}! 🔴`;
        } else if (pendingLater) {
          statusText = `Fällig um ${formatMinutes(meal.dueMinutes)}`;
        } else {
          statusText = `Ausstehend (fällig ${formatMinutes(meal.dueMinutes)}) ⏳`;
        }

        return (
          <div
            key={meal.id}
            className={`meal-card${done ? " done" : ""}${overdue ? " overdue" : ""}`}
          >
            <div className="meal-emoji">{meal.emoji}</div>
            <div className="meal-info">
              <h2>{meal.label}</h2>
              <div className="meal-status">{statusText}</div>
            </div>
            {done ? (
              <button
                className="undo-button"
                onClick={() => setFed(meal.id, false)}
                disabled={busy === meal.id}
              >
                Rückgängig
              </button>
            ) : (
              <button
                className="feed-button"
                onClick={() => setFed(meal.id, true)}
                disabled={busy === meal.id}
              >
                Gefüttert ✓
              </button>
            )}
          </div>
        );
      })}

      <section className="notify-section">
        {pushSupported && data.vapidPublicKey && (
          <button
            className={`notify-button${pushEnabled ? " active" : ""}`}
            onClick={togglePush}
            disabled={pushBusy}
          >
            {pushEnabled
              ? "🔔 Benachrichtigungen aktiv – tippen zum Deaktivieren"
              : "🔕 Benachrichtigungen aktivieren"}
          </button>
        )}
        {iosInstallHint && (
          <p className="hint">
            📲 Auf dem iPhone/iPad: Zuerst die App über „Teilen → Zum Home-Bildschirm“
            installieren, dann können Benachrichtigungen aktiviert werden.
          </p>
        )}
        <p className="hint">
          Wird eine Fütterung mehr als 1 Stunde nicht abgehakt, bekommen alle mit
          aktivierten Benachrichtigungen eine Push-Nachricht.
        </p>
      </section>
    </main>
  );
}
