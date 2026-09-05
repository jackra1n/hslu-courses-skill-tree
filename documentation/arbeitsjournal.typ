#import "template.typ": primary-color, secondary-color, border-color, muted-color, callout

#let target-hours = 60.0

// Liste aller Arbeitsjournal-Einträge
// Neue Einträge werden am Ende des Arrays hinzugefügt
#let journal-entries = (
  (
    date: "2026-09-04",
    hours: 1.5,
    activity: "Projekt-Kickoff: Analyse der Modulanforderungen für WEBLAB, Konzeption der Repository- und Worktree-Struktur, Planung der Architektur-Dokumentation sowie Aufsetzen der Typst-Umgebung."
  ),
  (
    date: "2026-09-05",
    hours: 1.0,
    activity: "Course-Browser Grundgerüst: neue Route /courses als einfache Katalogliste auf Basis des bestehenden statischen Kurskatalogs angelegt, Styling an das App-Theme (Light/Dark-Tokens, Kartenlayout) angeglichen, Typcheck/Lint/Build verifiziert."
  ),
  (
    date: "2026-09-05",
    hours: 0.5,
    activity: "Theme-Fix: Darkmode galt nur auf der Startseite, da themeStore nur dort initialisiert wurde. Initialisierung von Theme und Locale ins Root-Layout (+layout.svelte) verlagert, redundante Aufrufe aus den Seiten entfernt."
  ),
)

// Berechnung der Statistiken
#let compute-journal-stats(entries) = {
  let total = 0.0
  for e in entries {
    total += e.hours
  }
  let pct = calc.round((total / target-hours) * 100, digits: 1)
  (total: total, remaining: calc.max(0.0, target-hours - total), percentage: pct)
}

#let journal-summary(entries: journal-entries) = {
  let stats = compute-journal-stats(entries)
  block(
    width: 100%,
    stroke: 1pt + border-color,
    radius: 4pt,
    fill: rgb("#f8fafc"),
    inset: 12pt,
    [
      #grid(
        columns: (1fr, 1fr, 1fr),
        align: center,
        [
          #text(size: 0.82em, fill: muted-color, weight: "bold")[GESAMTER ARBEITSAUFWAND] \
          #v(0.2em)
          #text(size: 1.35em, weight: "bold", fill: primary-color)[#str(stats.total) h]
        ],
        [
          #text(size: 0.82em, fill: muted-color, weight: "bold")[SOLL-AUFWAND] \
          #v(0.2em)
          #text(size: 1.35em, weight: "bold", fill: primary-color)[#str(target-hours) h]
        ],
        [
          #text(size: 0.82em, fill: muted-color, weight: "bold")[FORTSCHRITT] \
          #v(0.2em)
          #text(size: 1.35em, weight: "bold", fill: if stats.percentage >= 100 { rgb("#166534") } else { secondary-color })[#str(stats.percentage)%]
        ]
      )
    ]
  )
}

#let journal-table(entries: journal-entries) = {
  let running = 0.0
  let rows = ()
  let idx = 0
  for entry in entries {
    running += entry.hours
    let bg = if calc.even(idx) { rgb("#ffffff") } else { rgb("#f8fafc") }
    rows.push(table.cell(fill: bg)[#entry.date])
    rows.push(table.cell(fill: bg)[#str(entry.hours) h])
    rows.push(table.cell(fill: bg)[#entry.activity])
    rows.push(table.cell(fill: bg)[#str(running) h])
    idx += 1
  }

  table(
    columns: (2.5cm, 1.8cm, 1fr, 2.2cm),
    align: (center + horizon, right + horizon, left + horizon, right + horizon),
    stroke: (x, y) => if y == 0 {
      (bottom: 1.5pt + primary-color)
    } else {
      (bottom: 0.5pt + border-color)
    },
    table.header(
      table.cell(fill: rgb("#f1f5f9"))[*Datum*],
      table.cell(fill: rgb("#f1f5f9"))[*Aufwand*],
      table.cell(fill: rgb("#f1f5f9"))[*Aktivität / Beschreibung*],
      table.cell(fill: rgb("#f1f5f9"))[*Kumuliert*]
    ),
    ..rows,
    table.cell(colspan: 3, fill: rgb("#f1f5f9"), align: right + horizon)[*Gesamtaufwand:*],
    table.cell(fill: rgb("#f1f5f9"), align: right + horizon)[*#str(running) h*]
  )
}

// Eigenständige Ansicht (Standalone Compilation)
#let is-standalone = sys.inputs.at("standalone", default: "true") == "true"

#if is-standalone [
  #set page(
    paper: "a4",
    margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
    header: [
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        text(size: 8.5pt, fill: muted-color)[HSLU Courses Skill Tree - Arbeitsjournal],
        text(size: 8.5pt, fill: muted-color)[WEBLAB]
      )
      #line(length: 100%, stroke: 0.5pt + border-color)
    ],
    footer: context [
      #line(length: 100%, stroke: 0.5pt + border-color)
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        text(size: 8.5pt, fill: muted-color)[jackra1n - HSLU Informatik],
        text(size: 8.5pt, fill: muted-color)[Seite #counter(page).display("1")]
      )
    ]
  )
  #set text(
    font: ("Liberation Sans", "Noto Sans", "Cantarell"),
    size: 10pt,
    lang: "de",
    spacing: 120%
  )

  = Arbeitsjournal - WEBLAB

  #v(0.5em)
  Dieses Arbeitsjournal dokumentiert den kontinuierlichen Arbeitsaufwand für das Projekt *HSLU Courses Skill Tree - Course Browser* im Rahmen des Moduls *WEBLAB* an der Hochschule Luzern (HSLU). Der Richtwert für den Gesamtaufwand beträgt rund 60 Stunden über das gesamte Semester.

  #v(0.8em)
  #journal-summary()
  #v(1em)

  #journal-table()
]
