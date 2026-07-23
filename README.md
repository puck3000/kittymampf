# 🐱 Kittymampf

Haben die Katzen heute schon gefressen? Eine kleine PWA für Familie und
Stellvertreter: die Fütterungen des Tages abhaken – und wird eine Fütterung
bis zu ihrer „bis“-Zeit nicht erledigt, bekommen alle mit installierter App
eine Push-Benachrichtigung.

## Fressplan

| Mahlzeit | bis | Futter |
|---|---|---|
| Frühstück | 07:00 | Feuchtfutter – ½ Packung pro Katze |
| Zmittag | 08:00 | Trockenfutter – 1 Löffel pro Katze |
| Zvieri | 17:00 | Suppe oder Feuchtfutter – ½ Packung pro Katze |
| Znacht | 21:00 | Trockenfutter – 1 Löffel pro Katze |

Die „bis“-Zeiten lösen den Alarm aus und sind per `FEED_TIMES` konfigurierbar.

- **Kein Datenbank-Server**: Der Zustand liegt als JSON-Dateien in
  [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Basic Auth**: Ein gemeinsames Login für alle
- **Push-Benachrichtigungen**: Web Push (VAPID), funktioniert auf Android,
  Desktop und iOS (ab 16.4, als installierte Home-Screen-App)
- **Überfälligkeits-Check**: GitHub Actions ruft alle 15 Minuten einen
  geschützten Endpunkt auf (Vercel Cron kann das im Hobby-Plan nur 1×/Tag)

## Setup

### 1. Auf Vercel deployen

1. Repo in [Vercel](https://vercel.com/new) importieren (Framework: Next.js,
   keine weiteren Einstellungen nötig)
2. Im Projekt unter **Storage → Create Database → Blob** einen Blob Store
   anlegen und mit dem Projekt verbinden. Dadurch wird
   `BLOB_READ_WRITE_TOKEN` automatisch gesetzt.

### 2. VAPID-Keys generieren

```bash
npx web-push generate-vapid-keys
```

### 3. Umgebungsvariablen setzen

In Vercel unter **Settings → Environment Variables** (siehe auch
[.env.example](.env.example)):

| Variable | Wert |
|---|---|
| `BASIC_AUTH_USER` | Gemeinsamer Benutzername |
| `BASIC_AUTH_PASSWORD` | Gemeinsames Passwort |
| `VAPID_PUBLIC_KEY` | Public Key aus Schritt 2 |
| `VAPID_PRIVATE_KEY` | Private Key aus Schritt 2 |
| `VAPID_SUBJECT` | `mailto:deine@mail.ch` |
| `CRON_SECRET` | Langer Zufallswert, z.B. `openssl rand -hex 32` |
| `FEED_TIMES` | Optional, Standard `07:00,08:00,17:00,21:00` |

Danach einmal neu deployen, damit die Variablen aktiv werden.

### 4. GitHub-Secrets für den Überfälligkeits-Check

Im GitHub-Repo unter **Settings → Secrets and variables → Actions** zwei
Secrets anlegen:

| Secret | Wert |
|---|---|
| `APP_URL` | Deine Vercel-URL, z.B. `https://kittymampf.vercel.app` (ohne Slash am Ende) |
| `CRON_SECRET` | Derselbe Wert wie in Vercel |

Der Workflow [.github/workflows/check.yml](.github/workflows/check.yml) läuft
dann automatisch alle ~15 Minuten. Zum Testen kann er unter **Actions →
Überfälligkeits-Check → Run workflow** auch manuell gestartet werden.

### 5. App aufs Handy

- **iPhone/iPad** (iOS 16.4+): Seite in Safari öffnen, einloggen, dann
  **Teilen → Zum Home-Bildschirm**. Die installierte App öffnen und
  „Benachrichtigungen aktivieren“ antippen. (Push funktioniert auf iOS nur in
  der installierten App, nicht im Browser-Tab.)
- **Android**: Seite in Chrome öffnen → Menü → **App installieren** (oder
  direkt im Browser „Benachrichtigungen aktivieren“).
- **Desktop**: Funktioniert direkt im Browser.

## Wie es funktioniert

- Der Tageszustand (`state.json`) und die Push-Subscriptions
  (`subscriptions.json`) liegen im Vercel Blob Store. Beim ersten Zugriff
  nach Mitternacht (Europe/Zurich) wird der Tag automatisch zurückgesetzt.
- `/api/check` prüft: Ist eine Mahlzeit nach ihrer „bis“-Zeit weder abgehakt
  noch benachrichtigt, geht eine Push-Nachricht an alle Subscriptions
  (genau eine pro Mahlzeit und Tag). Der Endpunkt ist durch
  `Authorization: Bearer $CRON_SECRET` geschützt, nicht durch Basic Auth.
- Alle anderen Routen stehen hinter Basic Auth
  ([middleware.ts](middleware.ts)). Ausgenommen sind nur Manifest, Service
  Worker und Icons, die keine sensiblen Daten enthalten.

## Lokale Entwicklung

```bash
cp .env.example .env.local   # Werte eintragen (Blob-Token aus dem Vercel-Dashboard)
npm install
npm run dev
```

## Bewusste Vereinfachungen

- Kein Tracking, *wer* gefüttert hat (gemeinsames Login)
- Keine Historie vergangener Tage
- Kein Schutz gegen gleichzeitige Schreibzugriffe – bei einer Handvoll
  Nutzern ist das Risiko vernachlässigbar
