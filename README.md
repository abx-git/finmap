# Finmap

Portfolio-Performance-Visualisierung im Stil von [Finviz](https://finviz.com/map.ashx) für deutsche Wertpapiere (WKN).

Importieren Sie Ihr Depot per CSV oder JSON, analysieren Sie Kursentwicklung und Ausschüttungen – dargestellt als interaktive Treemap, Tabelle und Zusammenfassung.

## Features

- **Portfolio-Import** – CSV/JSON (Drag & Drop), manueller Editor, Export
- **WKN-Auflösung** – automatische Zuordnung zu Yahoo-Tickern (OpenFIGI + Yahoo Finance)
- **Performance-Map** – Finviz-ähnliche Treemap (Größe = Portfoliogewicht, Farbe = Performance %)
- **ETF-Aufschlüsselung** – hierarchische Map der Top-Bestandteile je ETF
- **Zeiträume** – 1 Tag, 1 Monat, 3 Monate, 6 Monate, 12 Monate, 3 Jahre, 5 Jahre
- **Gesamtentwicklung** – Kursgewinn + Ausschüttungen (Dividenden) pro Zeitraum
- **Positionen-Tabelle** – sortierbar mit Kurs, Dividende und Gesamtrendite

## Schnellstart

```bash
git clone https://github.com/abx-git/finmap.git
cd finmap
npm install
npm run dev
```

Öffnen Sie [http://localhost:3000](http://localhost:3000) und klicken Sie auf **Analysieren**.

## GitHub Pages

Live-Demo: **[https://abx-git.github.io/finmap/](https://abx-git.github.io/finmap/)**

### Einmalige Aktivierung (wichtig)

Der Deploy schlägt mit `404 Not Found` fehl, wenn Pages noch nicht aktiviert ist:

1. Öffnen Sie **[github.com/abx-git/finmap/settings/pages](https://github.com/abx-git/finmap/settings/pages)**
2. Unter **Build and deployment → Source** wählen Sie **GitHub Actions** (nicht „Deploy from a branch“)
3. Speichern – danach unter **Actions** den Workflow **Deploy GitHub Pages** erneut ausführen („Re-run all jobs“ oder `workflow_dispatch`)

Bei jedem Push auf `main` wird die Seite danach automatisch gebaut und veröffentlicht. Die Analyse läuft im Browser; auf GitHub Pages werden Anfragen an Yahoo Finance und OpenFIGI über einen CORS-Proxy geleitet (lokal direkt).

**Nach einem Update:** Im Browser **hart neu laden** (Strg+Shift+R / Cmd+Shift+R), damit kein altes JavaScript aus dem Cache läuft.

Optional können Sie einen eigenen [Cloudflare Worker](workers/cors-proxy/) deployen und die URL per `NEXT_PUBLIC_CORS_PROXY_URL` im Pages-Build setzen.

Lokaler Pages-Build:

```bash
npm run build:pages
```

Statische Dateien liegen danach in `out/`.

## Portfolio-Format

CSV (Semikolon oder Komma):

```csv
wkn;anteile
716460;100
840400;50
593393;40
```

JSON:

```json
{
  "holdings": [
    { "wkn": "716460", "shares": 100 },
    { "wkn": "840400", "shares": 50 }
  ]
}
```

Eine Beispiel-Datei liegt unter [`public/example-portfolio.csv`](public/example-portfolio.csv).

## Tech-Stack

| Bereich      | Technologie        |
| ------------ | ------------------ |
| Framework    | Next.js 16, React 19, TypeScript |
| Styling      | Tailwind CSS 4     |
| Charts       | Apache ECharts     |
| Kursdaten    | Yahoo Finance (`yahoo-finance2`) |
| WKN-Lookup   | OpenFIGI           |
| CSV-Parsing  | PapaParse          |

## Skripte

| Befehl          | Beschreibung              |
| --------------- | ------------------------- |
| `npm run dev`   | Entwicklungsserver        |
| `npm run build` | Produktions-Build         |
| `npm run start` | Produktionsserver         |
| `npm run lint`  | ESLint                    |

## Architektur

```
src/
├── app/
│   └── page.tsx                    # Hauptseite
├── components/                     # UI (Map, Tabelle, Import, …)
└── lib/
    ├── analyze-client.ts           # Portfolio-Analyse (Browser)
    ├── yahoo-browser.ts            # Yahoo Finance API (Browser)
    ├── wkn-browser.ts              # WKN → Ticker (OpenFIGI)
    ├── dividends-calc.ts           # Dividenden-Berechnung
    └── portfolio-summary.ts        # Zusammenfassung
```

Server-seitige Module (`wkn.ts`, `prices.ts`, …) bleiben für lokale Node-Deployments erhalten. GitHub Pages nutzt die Browser-Variante.

## Hinweise

- **Keine Anlageberatung** – nur zu Informationszwecken
- **Verzögerte Kurse** – Yahoo Finance liefert keine Echtzeitdaten
- **WKN-Abdeckung** – deutsche Aktien und ETFs funktionieren zuverlässig; exotische Produkte können fehlschlagen
- **ETF-Holdings** – Yahoo liefert typischerweise nur die Top-10-Positionen (~30–65 % Abdeckung)
- **Kein Login** – Portfolio bleibt lokal im Browser bzw. in importierten Dateien

## Lizenz

MIT – siehe [LICENSE](LICENSE).
