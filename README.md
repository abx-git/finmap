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
│   ├── page.tsx                    # Hauptseite
│   └── api/portfolio/analyze/      # Portfolio-Analyse-API
├── components/                     # UI (Map, Tabelle, Import, …)
└── lib/
    ├── wkn.ts                      # WKN → Ticker
    ├── prices.ts                   # Kurse & Performance
    ├── dividends.ts                # Ausschüttungen
    ├── etf-holdings.ts             # ETF-Bestandteile
    └── portfolio.ts                # Analyse-Logik
```

Kurs- und Dividendendaten werden serverseitig gecacht (`.cache/`, TTL 15 Minuten).

## Hinweise

- **Keine Anlageberatung** – nur zu Informationszwecken
- **Verzögerte Kurse** – Yahoo Finance liefert keine Echtzeitdaten
- **WKN-Abdeckung** – deutsche Aktien und ETFs funktionieren zuverlässig; exotische Produkte können fehlschlagen
- **ETF-Holdings** – Yahoo liefert typischerweise nur die Top-10-Positionen (~30–65 % Abdeckung)
- **Kein Login** – Portfolio bleibt lokal im Browser bzw. in importierten Dateien

## Lizenz

MIT – siehe [LICENSE](LICENSE).
